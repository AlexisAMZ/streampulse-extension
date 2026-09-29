import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { ALL_LANGUAGES, DEFAULT_LANGUAGE, LANGUAGE_CODES } from "../i18n/meta.js";
import { translations } from "../i18n/translations.js";

// Une langue = un fichier source, i18n/lang/<code>.js, éditable seul. Chaque
// fichier doit porter exactement les clés de l'anglais (langue de repli) :
// une clé en moins retombe sur l'anglais à l'écran, une clé en trop est morte.

const LANG_DIR = new URL("../i18n/lang/", import.meta.url);

function leafPaths(node, prefix = "") {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" ? leafPaths(value, path) : [path];
  });
}

async function loadLanguageFile(code) {
  const module = await import(new URL(`${code}.js`, LANG_DIR).href);
  return module.default;
}

test("chaque langue déclarée a son fichier, et aucun fichier n'est orphelin", async () => {
  const files = (await readdir(LANG_DIR)).filter((name) => name.endsWith(".js"));
  const codes = files.map((name) => name.replace(/\.js$/, "")).sort();
  assert.deepEqual(codes, [...LANGUAGE_CODES].sort());
  assert.deepEqual(LANGUAGE_CODES, ALL_LANGUAGES.map((lang) => lang.code));
});

for (const code of LANGUAGE_CODES) {
  test(`i18n/lang/${code}.js a exactement les clés de en`, async () => {
    const reference = new Set(leafPaths(await loadLanguageFile(DEFAULT_LANGUAGE)));
    const keys = new Set(leafPaths(await loadLanguageFile(code)));
    const missing = [...reference.difference(keys)];
    const extra = [...keys.difference(reference)];
    assert.deepEqual(missing, [], `${code} : clés manquantes ${missing.slice(0, 10).join(", ")}`);
    assert.deepEqual(extra, [], `${code} : clés inconnues de en ${extra.slice(0, 10).join(", ")}`);
  });
}

test("l'agrégateur expose chaque fichier de langue tel quel, dans l'ordre du registre", async () => {
  assert.deepEqual(Object.keys(translations), LANGUAGE_CODES);
  for (const code of LANGUAGE_CODES) {
    assert.equal(translations[code], await loadLanguageFile(code), `${code} n'est pas le module i18n/lang/${code}.js`);
  }
});

test("les pages n'importent jamais l'agrégateur (seulement meta.js et une langue)", async () => {
  for (const file of ["js/i18n.js", "js/preferences-data.js", "i18n/meta.js"]) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.ok(!/from\s+["'][^"']*translations\.js["']/.test(source), `${file} importe translations.js`);
    assert.ok(!/import\(\s*["'][^"']*translations\.js/.test(source), `${file} importe translations.js`);
  }
});
