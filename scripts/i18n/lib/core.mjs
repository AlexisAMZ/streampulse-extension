// Noyau de l'outillage de localisation : chemins, configuration, lecture des
// fichiers de langue, aplatissement des clés et pluriels CLDR.
//
// La source de vérité des chaînes reste i18n/lang/<code>.js (un objet JSON
// exporté par défaut). Ce module les relit depuis le disque à chaque appel :
// les commandes réécrivent ces fichiers, le cache des modules ES ne doit pas
// servir une version périmée.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const at = (...parts) => path.join(ROOT, ...parts);

export const PATHS = {
  langDir: at("i18n", "lang"),
  meta: at("i18n", "meta.js"),
  aggregator: at("i18n", "translations.js"),
  locales: at("_locales"),
  changelog: at("js", "changelog-data.js"),
  localization: at("localization"),
  config: at("localization", "config.json"),
  glossary: at("localization", "glossary.json"),
  protected: at("localization", "protected-terms.json"),
  statusDir: at("localization", "status"),
  history: at("localization", "history.jsonl"),
  usage: at("localization", "usage.jsonl"),
  cache: at("localization", ".cache"),
};

const readJsonSync = (file) => JSON.parse(readFileSync(file, "utf8"));

let configCache = null;
export function loadConfig() {
  configCache ??= {
    config: readJsonSync(PATHS.config),
    glossary: readJsonSync(PATHS.glossary),
    protected: readJsonSync(PATHS.protected),
  };
  return configCache;
}

/** Empreinte courte et stable d'une chaîne (détection des sources modifiées). */
export function fingerprint(text) {
  return createHash("sha1").update(String(text)).digest("hex").slice(0, 10);
}

// ── Pluriels ────────────────────────────────────────────────────────────────

/** Catégories CLDR, dans l'ordre canonique. */
export const PLURAL_CATEGORIES = ["zero", "one", "two", "few", "many", "other"];

/**
 * Un groupe de pluriel est un objet dont toutes les clés sont des catégories
 * CLDR et qui contient au moins `other` : { one: "…", other: "…" }.
 */
export function isPluralGroup(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return false;
  const keys = Object.keys(node);
  return keys.length > 0 && keys.includes("other") && keys.every((k) => PLURAL_CATEGORIES.includes(k));
}

/** Locale Intl à utiliser pour un code de langue StreamPulse. */
export function intlLocale(code) {
  return { ar: "ar-AE" }[code] || code;
}

/** Catégories de pluriel cardinal qu'emploie une langue (ordre CLDR). */
export function pluralCategoriesFor(code) {
  const used = new Intl.PluralRules(intlLocale(code)).resolvedOptions().pluralCategories;
  return PLURAL_CATEGORIES.filter((c) => used.includes(c));
}

// ── Arbres de traduction ────────────────────────────────────────────────────

/**
 * Aplatit un arbre en entrées { key, value, group, category }. Les feuilles
 * d'un groupe de pluriel gardent la trace de leur groupe.
 */
export function flattenTree(node, prefix = "") {
  const out = [];
  for (const [name, value] of Object.entries(node ?? {})) {
    const key = prefix ? `${prefix}.${name}` : name;
    if (isPluralGroup(value)) {
      for (const [category, text] of Object.entries(value)) {
        out.push({ key: `${key}.${category}`, value: text, group: key, category });
      }
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      out.push(...flattenTree(value, key));
    } else {
      out.push({ key, value, group: null, category: null });
    }
  }
  return out;
}

/**
 * Clés attendues dans une langue cible, avec leur texte source anglais.
 * Un groupe de pluriel anglais (one/other) devient, en ukrainien,
 * one/few/many/other : few et many traduisent la forme anglaise `other`.
 */
export function expectedEntries(sourceTree, code) {
  const expected = new Map();
  const categories = pluralCategoriesFor(code);
  const walk = (node, prefix) => {
    for (const [name, value] of Object.entries(node ?? {})) {
      const key = prefix ? `${prefix}.${name}` : name;
      if (isPluralGroup(value)) {
        for (const category of categories) {
          const source = value[category] ?? value.other;
          expected.set(`${key}.${category}`, { key: `${key}.${category}`, source, group: key, category });
        }
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        walk(value, key);
      } else {
        expected.set(key, { key, source: value, group: null, category: null });
      }
    }
  };
  walk(sourceTree, "");
  return expected;
}

/**
 * Reconstruit l'arbre d'une langue dans l'ordre des clés anglaises, à partir
 * d'une table clé → valeur. Les clés absentes sont omises (repli sur l'anglais
 * à l'exécution). Ne modifie aucun objet reçu.
 */
export function buildTree(sourceTree, code, values) {
  const categories = pluralCategoriesFor(code);
  const build = (node, prefix) => {
    const out = {};
    for (const [name, value] of Object.entries(node ?? {})) {
      const key = prefix ? `${prefix}.${name}` : name;
      if (isPluralGroup(value)) {
        const group = {};
        for (const category of categories) {
          const text = values.get(`${key}.${category}`);
          if (text !== undefined) group[category] = text;
        }
        if (Object.keys(group).length) out[name] = group;
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        const child = build(value, key);
        if (Object.keys(child).length) out[name] = child;
      } else if (values.has(key)) {
        out[name] = values.get(key);
      }
    }
    return out;
  };
  return build(sourceTree, "");
}

// ── Fichiers de langue ──────────────────────────────────────────────────────

export const langFile = (code) => path.join(PATHS.langDir, `${code}.js`);

/**
 * Lit i18n/lang/<code>.js comme du JSON (les fichiers sont écrits par
 * JSON.stringify) et signale les clés dupliquées, que JSON.parse avale.
 */
export async function readLanguage(code) {
  const file = langFile(code);
  if (!existsSync(file)) return { tree: null, duplicates: [], file };
  const raw = await readFile(file, "utf8");
  const start = raw.indexOf("export default");
  if (start === -1) throw new Error(`${file} : « export default » introuvable`);
  const json = raw.slice(start + "export default".length).trim().replace(/;\s*$/, "");
  let tree;
  try {
    tree = JSON.parse(json);
  } catch (error) {
    throw new Error(`${path.relative(ROOT, file)} n'est pas un objet JSON valide : ${error.message}`, { cause: error });
  }
  return { tree, duplicates: findDuplicateKeys(json), file };
}

/** Clés JSON répétées dans un même objet (« popup.title » défini deux fois…). */
export function findDuplicateKeys(json) {
  const duplicates = [];
  const stack = [];
  let i = 0;
  let expectKey = false;
  const readString = () => {
    let out = "";
    i++;
    while (i < json.length && json[i] !== '"') {
      if (json[i] === "\\") {
        out += json[i] + json[i + 1];
        i += 2;
      } else {
        out += json[i++];
      }
    }
    i++;
    return out;
  };
  while (i < json.length) {
    const ch = json[i];
    if (ch === "{") {
      stack.push({ keys: new Set(), path: stack.at(-1)?.pending ?? "" });
      expectKey = true;
      i++;
    } else if (ch === "}") {
      stack.pop();
      i++;
    } else if (ch === "[") {
      stack.push(null);
      i++;
    } else if (ch === "]") {
      stack.pop();
      i++;
    } else if (ch === ",") {
      expectKey = stack.at(-1) != null;
      i++;
    } else if (ch === '"') {
      const text = readString();
      const frame = stack.at(-1);
      if (expectKey && frame) {
        const full = frame.path ? `${frame.path}.${text}` : text;
        if (frame.keys.has(text)) duplicates.push(full);
        frame.keys.add(text);
        frame.pending = full;
        expectKey = false;
      }
    } else {
      i++;
    }
  }
  return duplicates;
}

/** Registre des langues (i18n/meta.js), relu sans cache de module. */
export async function readRegistry() {
  const source = await readFile(PATHS.meta, "utf8");
  const match = source.match(/export const ALL_LANGUAGES = (\[[\s\S]*?\n\]);/);
  if (!match) throw new Error("ALL_LANGUAGES introuvable dans i18n/meta.js");
  const entries = [...match[1].matchAll(/\{\s*code:\s*"([^"]+)",\s*label:\s*"([^"]*)",\s*ready:\s*(true|false)\s*\}/g)];
  return entries.map(([, code, label, ready]) => ({ code, label, ready: ready === "true" }));
}

/** Langues cibles : celles du registre sauf la source, filtrées par --locale. */
export async function targetLocales(requested) {
  const { config } = loadConfig();
  const registry = await readRegistry();
  const known = registry.map((l) => l.code).filter((c) => c !== config.source);
  if (!requested?.length) return known;
  const unknown = requested.filter((c) => !known.includes(c));
  if (unknown.length) {
    throw new Error(`Langue(s) absente(s) du registre : ${unknown.join(", ")}. Ajouter d'abord avec « npm run i18n:add -- --locale=${unknown[0]} ».`);
  }
  return requested;
}

/** Réglages outillage d'une langue (config.json : locales puis planned). */
export function localeSettings(code) {
  const { config } = loadConfig();
  return config.locales[code] || config.planned?.[code] || null;
}

/** Clés dont la valeur est le code de langue lui-même, jamais traduites. */
export const LANG_CODE_KEYS = ["popup.htmlLang", "onboarding.htmlLang"];

/** Motif « a.b.* » → test de clé. */
export function keyMatcher(patterns) {
  const list = (patterns ?? []).filter(Boolean);
  if (!list.length) return () => true;
  const tests = list.map((p) =>
    p.endsWith("*") ? (k) => k.startsWith(p.slice(0, -1)) : (k) => k === p || k.startsWith(`${p}.`),
  );
  return (key) => tests.some((t) => t(key));
}
