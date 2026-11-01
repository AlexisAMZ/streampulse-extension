// Vue unifiée d'une langue : chaînes de l'interface (i18n/lang/<code>.js) et
// chaînes du manifeste (_locales/<dossier>/messages.json, clés « @manifest.* »),
// avec leurs statuts. Toutes les commandes passent par loadLocale/saveLocale.

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  PATHS,
  buildTree,
  expectedEntries,
  flattenTree,
  loadConfig,
  localeSettings,
  readLanguage,
  readRegistry,
} from "./core.mjs";
import { deriveStates, readStatus, writeStatus } from "./state.mjs";
import { serializeLanguage } from "../../lib/i18n-files.mjs";

export const MANIFEST_PREFIX = "@manifest.";

/** Dossier _locales d'une langue (pt-BR → pt_BR). */
export function chromeFolder(code) {
  return localeSettings(code)?.chrome ?? code.replace("-", "_");
}

function readManifestMessages(folder) {
  const file = path.join(PATHS.locales, folder, "messages.json");
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8"));
}

async function readSource() {
  const { config } = loadConfig();
  const { tree, duplicates } = await readLanguage(config.source);
  const manifest = readManifestMessages(chromeFolder(config.source)) ?? {};
  return { code: config.source, tree, duplicates, manifest };
}

let sourceCache = null;
/** Arbre anglais et messages du manifeste anglais (lus une fois par commande). */
export function loadSource() {
  sourceCache ??= readSource();
  return sourceCache;
}

/** Oublie la source en mémoire (après une écriture de en.js). */
export function resetSource() {
  sourceCache = null;
}

/** Charge tout ce qu'il faut savoir d'une langue cible. */
export async function loadLocale(code) {
  const source = await loadSource();
  const registry = await readRegistry();
  const entry = registry.find((l) => l.code === code);
  const { tree, duplicates } = await readLanguage(code);

  const expected = expectedEntries(source.tree, code);
  const values = new Map(flattenTree(tree ?? {}).map((e) => [e.key, e.value]));

  const manifestTarget = readManifestMessages(chromeFolder(code)) ?? {};
  for (const [name, { message }] of Object.entries(source.manifest)) {
    const key = `${MANIFEST_PREFIX}${name}`;
    expected.set(key, { key, source: message, group: null, category: null, manifest: true });
    if (manifestTarget[name]?.message !== undefined) values.set(key, manifestTarget[name].message);
  }

  const records = readStatus(code);
  const states = deriveStates(expected, values, records);
  return {
    code,
    label: entry?.label ?? localeSettings(code)?.label ?? code,
    ready: Boolean(entry?.ready),
    registered: Boolean(entry),
    fileExists: tree !== null,
    duplicates,
    expected,
    values,
    records,
    states,
    source,
  };
}

/**
 * Écrit la langue : fichier i18n/lang, messages du manifeste (seulement si
 * toutes les clés y sont, sinon verify refuserait le dossier) et statuts.
 * Les valeurs ne sont jamais mutées : on reconstruit à partir de `values`.
 */
export async function saveLocale(locale, values, records) {
  const ui = new Map([...values].filter(([k]) => !k.startsWith(MANIFEST_PREFIX)));
  const tree = buildTree(locale.source.tree, locale.code, ui);
  await writeFile(path.join(PATHS.langDir, `${locale.code}.js`), serializeLanguage(locale.code, tree), "utf8");

  const names = Object.keys(locale.source.manifest);
  const manifestValues = names.map((n) => values.get(`${MANIFEST_PREFIX}${n}`));
  if (manifestValues.every((v) => typeof v === "string")) {
    const folder = path.join(PATHS.locales, chromeFolder(locale.code));
    mkdirSync(folder, { recursive: true });
    const messages = Object.fromEntries(names.map((n, i) => [n, { message: manifestValues[i] }]));
    await writeFile(path.join(folder, "messages.json"), `${JSON.stringify(messages, null, 2)}\n`, "utf8");
  }

  await writeStatus(locale.code, records, [...locale.expected.keys()]);
}
