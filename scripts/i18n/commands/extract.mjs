// extract : ce que le code demande à l'i18n, et ce qui lui échappe.
//
//  1. clés utilisées dans html/ et js/ mais absentes de en.js (erreur : la
//     clé brute s'afficherait) ;
//  2. clés de en.js jamais référencées littéralement (information : une
//     partie est résolue dynamiquement, voir MAX_UNUSED_KEYS dans verify) ;
//  3. textes visibles écrits en dur (heuristique) : nœuds texte et attributs
//     HTML sans data-i18n, chaînes affectées à textContent/title/placeholder…
//     Les exceptions assumées sont dans localization/extract-allowlist.json.
//
// --strict rend un code 1 s'il reste un texte en dur non listé.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { ROOT, at, flattenTree, isPluralGroup } from "../lib/core.mjs";
import { loadSource } from "../lib/catalog.mjs";
import { isLanguageNeutral } from "../lib/validate.mjs";

const SKIP = [/vendor/, /i18n-inline\.js$/, /changelog-data\.js$/, /history-data\.js$/, /predictions-data\.js$/];
const KEY = String.raw`[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_-]+)+`;
const KEY_CALLS = [
  new RegExp(String.raw`\bt\(\s*"(${KEY})"`, "g"),
  new RegExp(String.raw`\btp\(\s*"(${KEY})"`, "g"),
  new RegExp(String.raw`translate(?:WithPrefs|Plural)?\([^,\n]+,\s*"(${KEY})"`, "g"),
  new RegExp(String.raw`__SP_I18N__\.(?:get|plural)\([^,\n]+,\s*"(${KEY})"`, "g"),
  /data-i18n(?:-attr-[a-z-]+)?="([^"]+)"/g,
];

function files(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (SKIP.some((re) => re.test(full))) continue;
    if (entry.isDirectory()) files(full, out);
    else if (/\.(m?js|html)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

function loadAllowlist() {
  const file = at("localization", "extract-allowlist.json");
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, "utf8")).entries ?? [];
}

/** Textes visibles d'une page HTML qui ne passent pas par data-i18n. */
export function scanHtml(text) {
  const hits = [];
  const clean = text.replace(/<!--[\s\S]*?-->/g, (m) => " ".repeat(m.length));
  const stack = [];
  const re = /<![^>]*>|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>|([^<]+)/g;
  for (const m of clean.matchAll(re)) {
    const [, closing, name, attrs, textNode] = m;
    if (textNode !== undefined) {
      const inRaw = stack.some((f) => ["script", "style", "title", "template", "svg"].includes(f.name));
      const translated = stack.some((f) => f.i18n);
      const value = textNode.trim();
      if (!inRaw && !translated && /\p{L}{2,}/u.test(value) && !isLanguageNeutral(value)) {
        hits.push({ line: lineOf(text, m.index), text: value.slice(0, 80), kind: "texte" });
      }
      continue;
    }
    if (name === undefined) continue; // <!DOCTYPE …>
    const tag = name.toLowerCase();
    if (closing) {
      const i = stack.findLastIndex((f) => f.name === tag);
      if (i !== -1) stack.splice(i);
      continue;
    }
    for (const a of attrs.matchAll(/\s(title|placeholder|aria-label|alt)="([^"]*)"/g)) {
      const [, attr, value] = a;
      const translatedAttr = new RegExp(`data-i18n-attr-(?:${attr}|${attr.replace("-", "")})=`, "i").test(attrs);
      if (!translatedAttr && /\p{L}{2,}/u.test(value) && !isLanguageNeutral(value)) {
        hits.push({ line: lineOf(text, m.index), text: `${attr}="${value.slice(0, 60)}"`, kind: "attribut" });
      }
    }
    const selfClosing = /\/\s*$/.test(attrs) || ["br", "img", "input", "meta", "link", "hr", "source"].includes(tag);
    if (!selfClosing) stack.push({ name: tag, i18n: /\sdata-i18n="/.test(attrs) });
  }
  return hits;
}

/** Chaînes littérales affichées directement par le JavaScript. */
export function scanJs(text) {
  const hits = [];
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length));
  const patterns = [
    /\.(?:textContent|innerText|title|placeholder|ariaLabel)\s*=\s*(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g,
    /setAttribute\(\s*["'](?:title|aria-label|placeholder|alt)["']\s*,\s*(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g,
    /\b(?:alert|confirm)\(\s*(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g,
    /\bel\(\s*["'][a-z0-9]+["']\s*,\s*["'][^"']*["']\s*,\s*(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g,
  ];
  for (const re of patterns) {
    for (const m of clean.matchAll(re)) {
      const value = m[2];
      if (!/\p{L}{2,}/u.test(value.replace(/\$\{[^}]*\}/g, "")) || isLanguageNeutral(value)) continue;
      hits.push({ line: lineOf(text, m.index), text: value.slice(0, 80), kind: "js" });
    }
  }
  return hits;
}

export async function extract(options) {
  const source = await loadSource();
  const defined = new Set(flattenTree(source.tree).map((e) => e.key));
  const groups = new Set();
  const walk = (node, prefix) => {
    for (const [k, v] of Object.entries(node)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (isPluralGroup(v)) groups.add(key);
      else if (v && typeof v === "object") walk(v, key);
    }
  };
  walk(source.tree, "");

  const used = new Set();
  const unknown = [];
  const hardcoded = [];
  const allow = loadAllowlist();
  for (const file of [...files(at("html")), ...files(at("js"))]) {
    const rel = path.relative(ROOT, file);
    const text = readFileSync(file, "utf8");
    for (const re of KEY_CALLS) {
      for (const m of text.matchAll(re)) {
        const key = m[1];
        if (groups.has(key)) {
          for (const k of defined) if (k.startsWith(`${key}.`)) used.add(k);
        } else if (defined.has(key)) {
          used.add(key);
        } else if (!/\$\{|\.$/.test(key)) {
          unknown.push({ file: rel, line: lineOf(text, m.index), key });
        }
      }
    }
    for (const m of text.matchAll(new RegExp(`"(${KEY})"`, "g"))) {
      if (defined.has(m[1])) used.add(m[1]);
      if (groups.has(m[1])) for (const k of defined) if (k.startsWith(`${m[1]}.`)) used.add(k);
    }
    const found = rel.endsWith(".html") ? scanHtml(text) : scanJs(text);
    for (const hit of found) {
      const allowed = allow.some((a) => (a.file === rel || a.file === "*") && hit.text.includes(a.text));
      if (!allowed) hardcoded.push({ file: rel, ...hit });
    }
  }

  const unused = [...defined].filter((k) => !used.has(k));
  console.log(`Clés : ${defined.size} définies, ${used.size} référencées littéralement, ${unused.length} sans référence littérale (souvent dynamiques).`);
  if (options.verbose) unused.forEach((k) => console.log(`  · ${k}`));
  if (unknown.length) {
    console.log(`\n✗ ${unknown.length} clé(s) utilisée(s) mais absente(s) de en.js :`);
    unknown.forEach((u) => console.log(`  ${u.file}:${u.line}  ${u.key}`));
  }
  console.log(`\n${hardcoded.length ? "!" : "✓"} ${hardcoded.length} texte(s) visible(s) écrit(s) en dur hors exceptions :`);
  hardcoded.forEach((h) => console.log(`  ${h.file}:${h.line}  [${h.kind}] ${h.text}`));
  return unknown.length || (options.strict && hardcoded.length) ? 1 : 0;
}
