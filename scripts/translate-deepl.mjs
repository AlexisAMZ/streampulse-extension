// Traduit i18n/lang/en.js vers une langue cible via DeepL et écrit
// i18n/lang/<code>.js. La clé vient de DEEPL_API_KEY (jamais dans le dépôt).
//
//   DEEPL_API_KEY=… node scripts/translate-deepl.mjs uk [--dry] [--cache=chemin.json]
//
// Les {{placeholders}} et les noms de marque sont remplacés par des balises XML
// vides <x i="n"/> que DeepL laisse intactes, puis restitués à l'identique.
// Chaque réponse est mise en cache sur disque : un second passage ne refacture
// rien (le quota gratuit est de 500 000 caractères par mois).
import { readFile, writeFile } from "node:fs/promises";
import {
  PLACEHOLDER_RE,
  PROTECTED_LITERALS,
  flattenPairs,
  restorationIsIntact,
} from "./lib/i18n-audit.mjs";
import { writeLanguageFile } from "./lib/i18n-files.mjs";

const CODE = process.argv[2];
const DRY = process.argv.includes("--dry");
const cacheArg = process.argv.find((a) => a.startsWith("--cache="));
const CACHE_FILE = cacheArg ? cacheArg.slice(8) : `deepl-${CODE}.cache.json`;
const KEY = process.env.DEEPL_API_KEY || "";
const TARGET = { uk: "UK" }[CODE];
const BATCH = 40;
const CONTEXT =
  "Short user interface text of StreamPulse, a browser extension for Twitch, Kick and YouTube viewers " +
  "(channel points, Drops, badges, live alerts, chat tools). Keep it concise and natural, as in a modern app.";

if (!CODE || !TARGET) throw new Error("Usage : node scripts/translate-deepl.mjs uk [--dry]");
if (!DRY && !KEY) throw new Error("DEEPL_API_KEY manquant dans l'environnement");

const EXTRA_PROTECTED = ["YouTube", "Discord", "TikTok", "Instagram", "CHZZK", "Chrome", "Edge", "Firefox"];
const LITERALS = [...new Set([...PROTECTED_LITERALS, ...EXTRA_PROTECTED])];

function mask(text) {
  const tokens = [];
  const stash = (m) => {
    let i = tokens.indexOf(m);
    if (i === -1) i = tokens.push(m) - 1;
    return `<x i="${i}"/>`;
  };
  let out = String(text).replace(/&/g, "&amp;");
  out = out.replace(PLACEHOLDER_RE, stash);
  // Les `%s`, `\n` et autres variables à la printf ne doivent jamais passer au traducteur.
  out = out.replace(/%[sd]|\\n/g, stash);
  for (const lit of LITERALS) out = out.replace(new RegExp(`\\b${lit}\\b`, "g"), stash);
  return { out, tokens };
}

function unmask(text, tokens) {
  return text
    .replace(/<x i="(\d+)"\s*\/>/g, (w, i) => tokens[Number(i)] ?? w)
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

async function deepl(texts) {
  const res = await fetch("https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: { Authorization: `DeepL-Auth-Key ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: texts,
      source_lang: "EN",
      target_lang: TARGET,
      tag_handling: "xml",
      ignore_tags: ["x"],
      preserve_formatting: true,
      split_sentences: "nonewlines",
      context: CONTEXT,
    }),
  });
  if (!res.ok) throw new Error(`DeepL ${res.status} ${await res.text()}`);
  return (await res.json()).translations.map((t) => t.text);
}

const en = (await import("../i18n/lang/en.js")).default;
const pairs = flattenPairs(en).filter(([, v]) => typeof v === "string");
const hasLetters = (s) => /\p{L}/u.test(s.replace(PLACEHOLDER_RE, "")) && !/^https?:\/\/\S+$/.test(s);

let cache = {};
try {
  cache = JSON.parse(await readFile(CACHE_FILE, "utf8"));
} catch {
  // pas de cache : premier passage
}

const todo = [...new Set(pairs.map(([, v]) => v).filter(hasLetters))].filter((v) => !(v in cache));
const chars = todo.reduce((n, s) => n + s.replace(PLACEHOLDER_RE, "").length, 0);
console.log(`${pairs.length} chaînes, ${todo.length} à traduire (~${chars} caractères facturés)`);
if (DRY) process.exit(0);

for (let i = 0; i < todo.length; i += BATCH) {
  const slice = todo.slice(i, i + BATCH);
  const masked = slice.map(mask);
  const out = await deepl(masked.map((m) => m.out));
  slice.forEach((src, j) => {
    const restored = unmask(out[j], masked[j].tokens);
    cache[src] = restorationIsIntact(src, restored) ? restored : null;
  });
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 1));
  console.log(`lot ${i / BATCH + 1}/${Math.ceil(todo.length / BATCH)}`);
}

const block = structuredClone(en);
const kept = [];
for (const [path, value] of pairs) {
  const tr = cache[value];
  if (tr == null) {
    if (hasLetters(value)) kept.push(path);
    continue;
  }
  const parts = path.split(".");
  let node = block;
  for (const p of parts.slice(0, -1)) node = node[p];
  node[parts.at(-1)] = tr;
}
for (const dotted of ["popup.htmlLang", "onboarding.htmlLang"]) {
  const parts = dotted.split(".");
  let node = block;
  for (const p of parts.slice(0, -1)) node = node[p];
  node[parts.at(-1)] = CODE;
}
await writeLanguageFile(CODE, block);
console.log(`i18n/lang/${CODE}.js écrit. Restées en anglais (jeton perdu) : ${kept.length}`);
kept.slice(0, 40).forEach((k) => console.log("  " + k));
