#!/usr/bin/env node
// Pre-package verification for the StreamPulse extension.
// Checks the manifest, i18n parity, JS syntax, HTML asset references,
// MV3 CSP compliance and stray secrets before the zip is built.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

// Sans argument on verifie le depot lui-meme ; build-zip.mjs passe le dossier
// du zip decompresse pour verifier le paquet reellement livre.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : REPO;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spverify-"));

const errors = [];
const warnings = [];
const ok = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);
const pass = (m) => ok.push(m);

const abs = (p) => path.join(ROOT, p);
const exists = (p) => fs.existsSync(abs(p));
const readJson = (p) => JSON.parse(fs.readFileSync(abs(p), "utf8"));

// ── 1. manifest ─────────────────────────────────────────────────────────────
let manifest;
try {
  manifest = readJson("manifest.json");
  pass("manifest.json is valid JSON");
} catch (e) {
  fail(`manifest.json does not parse: ${e.message}`);
  process.exit(report());
}

if (manifest.manifest_version !== 3) fail(`manifest_version is ${manifest.manifest_version}, expected 3`);
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) fail(`version "${manifest.version}" is not a valid Chrome version string`);
else pass(`version ${manifest.version}`);

// Every path the manifest points at must exist.
const refs = new Set();
refs.add(manifest.background?.service_worker);
refs.add(manifest.action?.default_popup);
for (const cs of manifest.content_scripts ?? []) {
  (cs.js ?? []).forEach((f) => refs.add(f));
  (cs.css ?? []).forEach((f) => refs.add(f));
}
for (const icons of [manifest.icons, manifest.action?.default_icon]) {
  Object.values(icons ?? {}).forEach((f) => refs.add(f));
}
for (const war of manifest.web_accessible_resources ?? []) {
  (war.resources ?? []).forEach((f) => refs.add(f));
}
refs.delete(undefined);
const missing = [...refs].filter((f) => !exists(f));
if (missing.length) missing.forEach((f) => fail(`manifest references a missing file: ${f}`));
else pass(`all ${refs.size} manifest-referenced files exist`);

// ── 2. i18n ─────────────────────────────────────────────────────────────────
const locales = fs.readdirSync(abs("_locales")).filter((d) => fs.statSync(abs(`_locales/${d}`)).isDirectory());
const localeMsgs = {};
for (const loc of locales) {
  try {
    localeMsgs[loc] = readJson(`_locales/${loc}/messages.json`);
  } catch (e) {
    fail(`_locales/${loc}/messages.json does not parse: ${e.message}`);
  }
}
const base = manifest.default_locale;
if (!localeMsgs[base]) fail(`default_locale "${base}" has no messages.json`);
else {
  const baseKeys = Object.keys(localeMsgs[base]);
  for (const [loc, msgs] of Object.entries(localeMsgs)) {
    if (loc === base) continue;
    const absent = baseKeys.filter((k) => !(k in msgs));
    const extra = Object.keys(msgs).filter((k) => !baseKeys.includes(k));
    if (absent.length) fail(`_locales/${loc} is missing keys present in ${base}: ${absent.join(", ")}`);
    if (extra.length) warn(`_locales/${loc} has keys absent from ${base}: ${extra.join(", ")}`);
  }
  // __MSG_x__ placeholders used by the manifest must resolve in every locale.
  const placeholders = [...JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)].map((m) => m[1]);
  for (const key of new Set(placeholders)) {
    for (const [loc, msgs] of Object.entries(localeMsgs)) {
      if (!(key in msgs)) fail(`__MSG_${key}__ (manifest) is not defined in _locales/${loc}`);
    }
  }
  pass(`${locales.length} locales (${locales.join(", ")}) parse with matching key sets`);
}

// ── 2b. translations.js ─────────────────────────────────────────────────────
// _locales/ only carries appName/appDesc (what the manifest needs). The real UI
// strings live in i18n/translations.js, so completeness must be checked there:
// a missing key silently falls back to English at runtime and ships unnoticed.
{
  const flatten = (node, prefix = "") =>
    Object.entries(node ?? {}).flatMap(([key, value]) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? flatten(value, `${prefix}${key}.`)
        : [`${prefix}${key}`],
    );

  try {
    const mod = await import(new URL("../i18n/translations.js", import.meta.url).href);
    const { translations, ALL_LANGUAGES, AVAILABLE_LANGUAGES, DEFAULT_LANGUAGE } = mod;
    // Toutes les langues doivent être structurellement complètes, y compris
    // celles pas encore publiées : elles restent résolvables à l'exécution.
    const declared = ALL_LANGUAGES.map((l) => l.code);
    const published = AVAILABLE_LANGUAGES.map((l) => l.code);

    const orphanBlocks = Object.keys(translations).filter((c) => !declared.includes(c));
    if (orphanBlocks.length) {
      warn(`translations.js defines blocks absent from ALL_LANGUAGES: ${orphanBlocks.join(", ")}`);
    }

    const referenceKeys = flatten(translations[DEFAULT_LANGUAGE]);
    let incomplete = 0;

    for (const code of declared) {
      const block = translations[code];
      if (!block) {
        fail(`translations.js has no block for declared language "${code}"`);
        incomplete += 1;
        continue;
      }
      const keys = new Set(flatten(block));
      const missing = referenceKeys.filter((k) => !keys.has(k));
      if (missing.length) {
        const preview = missing.slice(0, 5).join(", ");
        const rest = missing.length > 5 ? ` (+${missing.length - 5} more)` : "";
        fail(`translations.js "${code}" is missing ${missing.length} key(s): ${preview}${rest}`);
        incomplete += 1;
      }
    }

    if (!incomplete) {
      pass(`translations.js: ${declared.length} languages complete (${referenceKeys.length} keys each)`);
    }

    // Une langue publiée (ready: true) ne doit pas être un simple copier-coller
    // de l'anglais : ce serait promettre une traduction inexistante.
    const flattenPairs = (node, prefix = "") =>
      Object.entries(node ?? {}).flatMap(([key, value]) =>
        value && typeof value === "object" && !Array.isArray(value)
          ? flattenPairs(value, `${prefix}${key}.`)
          : [[`${prefix}${key}`, value]],
      );
    const enPairs = new Map(flattenPairs(translations.en));
    for (const code of published) {
      if (code === "en") continue;
      const pairs = flattenPairs(translations[code]).filter(([, v]) => typeof v === "string");
      const identical = pairs.filter(([k, v]) => enPairs.get(k) === v).length;
      const ratio = pairs.length ? identical / pairs.length : 0;
      if (ratio > 0.5) {
        fail(
          `translations.js "${code}" is marked ready but ${Math.round(ratio * 100)}% of its strings ` +
            `are identical to English — set ready:false until it is translated`,
        );
      }
    }
    pass(`language switcher exposes ${published.length}/${declared.length} translated languages (${published.join(", ")})`);

    // Every language declared here must also reach the content scripts, which
    // read the generated js/inject/i18n-inline.js rather than the ES module.
    const inlinePath = "js/inject/i18n-inline.js";
    if (!exists(inlinePath)) {
      fail(`${inlinePath} is missing — run: node scripts/build-inline-i18n.mjs`);
    } else {
      const sandbox = {};
      new Function("window", fs.readFileSync(abs(inlinePath), "utf8"))(sandbox);
      const api = sandbox.__SP_I18N__;
      if (!api) {
        fail(`${inlinePath} does not expose window.__SP_I18N__`);
      } else {
        const absent = declared.filter((c) => !api.languages.includes(c));
        if (absent.length) {
          fail(`${inlinePath} is stale, missing: ${absent.join(", ")} — run: node scripts/build-inline-i18n.mjs`);
        } else {
          pass(`${inlinePath} exposes all ${api.languages.length} languages to content scripts`);
        }
      }
    }
  } catch (e) {
    fail(`i18n/translations.js could not be analysed: ${e.message}`);
  }
}

// ── 3. JS syntax ────────────────────────────────────────────────────────────
// Each file must parse either as an ES module or as a classic script.
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(abs(dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
};
const jsFiles = [...walk("js"), "config.js", "i18n/translations.js"].filter((f) => f.endsWith(".js"));
const checkAs = (file, ext) => {
  const dest = path.join(tmp, `check.${ext}`);
  fs.copyFileSync(abs(file), dest);
  try {
    execFileSync(process.execPath, ["--check", dest], { stdio: "pipe" });
    return null;
  } catch (e) {
    return (e.stderr?.toString() || e.message).split("\n").slice(0, 4).join(" ").trim();
  }
};
let syntaxFails = 0;
for (const f of jsFiles) {
  const asModule = checkAs(f, "mjs");
  if (!asModule) continue;
  const asScript = checkAs(f, "cjs");
  if (!asScript) continue;
  syntaxFails++;
  fail(`${f} is not valid JS: ${asScript}`);
}
if (!syntaxFails) pass(`${jsFiles.length} JS files parse cleanly`);

// ── 4. HTML assets + MV3 CSP ────────────────────────────────────────────────
const htmlFiles = walk("html").filter((f) => f.endsWith(".html"));
let htmlIssues = 0;
for (const f of htmlFiles) {
  const src = fs.readFileSync(abs(f), "utf8");
  for (const m of src.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
    const url = m[1];
    if (/^(https?:|data:|mailto:|#|\/\/)/.test(url)) {
      if (/^(https?:|\/\/)/.test(url) && /src\s*=/.test(m[0])) {
        fail(`${f} loads a remote resource, which MV3 forbids: ${url}`);
        htmlIssues++;
      }
      continue;
    }
    const resolved = path.normalize(path.join(path.dirname(f), url.split(/[?#]/)[0]));
    if (!exists(resolved)) {
      fail(`${f} references a missing asset: ${url}`);
      htmlIssues++;
    }
  }
  for (const m of src.matchAll(/\son(click|load|error|change|input|submit)\s*=/gi)) {
    fail(`${f} uses an inline ${m[0].trim()} handler, which the MV3 CSP blocks`);
    htmlIssues++;
  }
}
if (!htmlIssues) pass(`${htmlFiles.length} HTML files reference only existing local assets, no inline handlers`);

// ── 5. secrets ──────────────────────────────────────────────────────────────
// Nothing from .env may leak into the packaged source, and no live token
// should be committed in config.js.
const envPath = abs(".env");
const packaged = [...jsFiles, ...htmlFiles, "manifest.json"];
if (fs.existsSync(envPath)) {
  const secrets = fs
    .readFileSync(envPath, "utf8")
    .split("\n")
    .map((l) => l.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, ""))
    .filter((v) => v.length >= 12);
  let leaks = 0;
  for (const f of packaged) {
    const src = fs.readFileSync(abs(f), "utf8");
    for (const s of secrets) if (src.includes(s)) { fail(`${f} contains a value from .env`); leaks++; }
  }
  if (!leaks) pass("no .env value appears in any packaged file");
}
const cfg = fs.readFileSync(abs("config.js"), "utf8");
const token = cfg.match(/accessToken:\s*["']([^"']*)["']/)?.[1];
if (token) fail(`config.js ships a non-empty accessToken (${token.length} chars) and would leak it in the zip`);
else pass("config.js ships no access token (credentials stay remote)");

// The patch notes page is shown automatically after every update, so a release
// whose version has no entry in changelog-data.js would greet users with an
// empty page. Fail the build instead of shipping that.
const CHANGELOG_DATA = "js/changelog-data.js";
if (!exists(CHANGELOG_DATA)) {
  fail(`${CHANGELOG_DATA} is missing (patch notes page depends on it)`);
} else {
  const src = fs.readFileSync(abs(CHANGELOG_DATA), "utf8");
  const versions = [...src.matchAll(/version:\s*["']([^"']+)["']/g)].map((m) => m[1]);
  if (!versions.length) {
    fail(`${CHANGELOG_DATA} declares no release entry`);
  } else if (!versions.includes(manifest.version)) {
    fail(
      `${CHANGELOG_DATA} has no entry for manifest version ${manifest.version} ` +
        `(found: ${versions.slice(0, 5).join(", ")}) — add the patch notes before shipping`
    );
  } else if (versions[0] !== manifest.version) {
    warn(
      `${CHANGELOG_DATA}: newest entry is ${versions[0]} but the manifest says ` +
        `${manifest.version}; the release being shipped should be first in the list`
    );
  } else {
    pass(`patch notes present for version ${manifest.version}`);
  }

  // Les notes sont rédigées à la main à chaque release, langue par langue. Sans
  // ce contrôle, une release écrite en français seulement s'afficherait telle
  // quelle à tous les utilisateurs espagnols ou anglais.
  try {
    const [data, i18n] = await Promise.all([
      import(pathToFileURL(abs(CHANGELOG_DATA)).href),
      import(pathToFileURL(abs("i18n/translations.js")).href),
    ]);
    const publishedCodes = i18n.AVAILABLE_LANGUAGES.map((l) => l.code);

    // Chaque chaîne visible par l'utilisateur, avec un chemin lisible dans le
    // message d'erreur pour aller la corriger directement.
    const localizedFields = (release) => [
      ["title", release.title],
      ["subtitle", release.subtitle],
      ...(release.changes ?? []).map((c, i) => [`changes[${i}].text`, c.text]),
      ...(release.thanks ?? []).map((p, i) => [`thanks[${i}].for`, p.for]),
    ];

    const gaps = [];
    for (const release of data.RELEASES ?? []) {
      for (const [field, value] of localizedFields(release)) {
        if (value == null) continue; // Champ optionnel non renseigné : correct.
        if (typeof value === "string") {
          gaps.push(`${release.version} ${field} is a plain string, not a { fr, en, ... } map`);
          continue;
        }
        const missing = publishedCodes.filter((code) => !value[code]?.trim());
        if (missing.length) gaps.push(`${release.version} ${field} misses ${missing.join(", ")}`);
      }
    }

    if (gaps.length) {
      const preview = gaps.slice(0, 6);
      preview.forEach((g) => fail(`${CHANGELOG_DATA}: ${g}`));
      if (gaps.length > preview.length) {
        fail(`${CHANGELOG_DATA}: +${gaps.length - preview.length} more untranslated patch note(s)`);
      }
    } else {
      pass(`patch notes translated into all ${publishedCodes.length} published languages (${publishedCodes.join(", ")})`);
    }
  } catch (e) {
    fail(`${CHANGELOG_DATA} could not be imported for the translation check: ${e.message}`);
  }
}

// Un libellé écrit en dur dans le HTML ne passe jamais par applyTranslations :
// il reste en français quelle que soit la langue choisie. C'est exactement ce
// qu'un testeur a remonté sur l'inventaire Drops, les icônes d'onglet et le
// journal. On refuse donc tout texte visible sans data-i18n dans les écrans
// traduits. Les libellés purement décoratifs (codes, marques, coordonnées)
// vivent dans l'allowlist ci-dessous.
{
  const I18N_PAGES = ["html/popup.html", "html/onboarding.html", "html/changelog.html"];
  // Étiquettes de design volontairement non traduites : sigles, noms propres,
  // repères type console. Les ajouter ici est un choix, pas un oubli.
  const DECORATIVE = new Set([
    "STREAMPULSE", "ON AIR", "STEP", "BUILD", "API TWITCH", "DISPLAY NAME",
    "TWITCH", "YOUTUBE", "KICK", "NOTIFICATIONS", "AUTO", "LIVE", "CONTACT",
    "Email", "StreamPulse", "Drops", "Moments", "Raids",
  ]);
  // Nœuds dont le contenu est écrit par le JS au rendu (avec t()), donc vides
  // de sens dans le HTML : ce qui s'y trouve n'est qu'un gabarit.
  const RUNTIME_OWNED = new Set(["greeting-title", "greeting-live-count", "logs-container"]);
  const VOID_TAGS = new Set(["br", "img", "input", "hr", "meta", "link", "source", "path", "line", "rect", "polyline", "circle", "polygon", "use"]);
  const untranslated = [];

  for (const page of I18N_PAGES) {
    if (!exists(page)) continue;
    const src = fs.readFileSync(abs(page), "utf8");
    // Pile d'ancêtres : un parent porteur de data-i18n réécrit tout son
    // sous-arbre, donc le texte de ses enfants n'a pas à être annoté.
    const stack = [];
    const covered = () => stack.some((f) => f.i18n || f.runtime);
    const lineAt = (index) => src.slice(0, index).split("\n").length;

    for (const m of src.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>([^<]*)/g)) {
      const [, closing, tag, attrs, selfClose, text] = m;
      const name = tag.toLowerCase();
      if (closing) {
        while (stack.length && stack.pop().tag !== name);
      } else if (!selfClose && !VOID_TAGS.has(name)) {
        const id = attrs.match(/\bid="([^"]+)"/)?.[1];
        stack.push({
          tag: name,
          i18n: /data-i18n/.test(attrs),
          runtime: Boolean(id && RUNTIME_OWNED.has(id)),
        });
      }

      const value = text.trim();
      if (!value || closing || covered()) continue;
      if (DECORATIVE.has(value)) continue;
      if (/\bbg-coords\b|\bstep-counter\b/.test(attrs)) continue;
      // Ni ponctuation seule, ni pseudo/URL, ni repère tout en capitales.
      if (!/\p{L}{3}/u.test(value)) continue;
      if (/^[@#]/.test(value) || /^https?:/.test(value)) continue;
      if (!/\p{Ll}/u.test(value)) continue;
      untranslated.push(`${page}:${lineAt(m.index)} <${name}> "${value.slice(0, 48)}"`);
    }
  }

  if (untranslated.length) {
    untranslated.slice(0, 8).forEach((hit) =>
      fail(`visible text without data-i18n, it will stay in one language: ${hit}`)
    );
    if (untranslated.length > 8) {
      fail(`+${untranslated.length - 8} more untranslated string(s) in the i18n pages`);
    }
  } else {
    pass(`${I18N_PAGES.length} translated pages: every visible string carries data-i18n`);
  }
}

function report() {
  console.log(ok.map((m) => `  PASS  ${m}`).join("\n"));
  if (warnings.length) console.log("\n" + warnings.map((m) => `  WARN  ${m}`).join("\n"));
  if (errors.length) console.log("\n" + errors.map((m) => `  FAIL  ${m}`).join("\n"));
  console.log(`\n${errors.length ? "FAILED" : "OK"} — ${ok.length} passed, ${warnings.length} warnings, ${errors.length} errors`);
  return errors.length ? 1 : 0;
}
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(report());
