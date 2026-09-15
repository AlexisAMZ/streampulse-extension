#!/usr/bin/env node
/**
 * Kit de remplissage de la fiche Chrome Web Store, sur le modèle du kit Edge.
 *
 *   npm run store:chrome-kit
 *
 * Sortie (hors dépôt) : ~/Desktop/dev/ZIPS/chrome-kit/
 *   index.html                page de travail : une langue à la fois, copie en un clic
 *   <LANGUE>/description.txt  description détaillée
 *   <LANGUE>/capture-1..5.png captures dans l'ordre de la fiche
 *   <LANGUE>/tuile-*.png      tuiles promo (françaises en FR, anglaises ailleurs)
 *   shared/, fonts/           icône du store, tuiles, polices de la page
 *
 * Textes : scripts/store-assets/chrome-listing.mjs (FR et EN à la main). Les 13
 * autres langues sont traduites de l'anglais par DeepL (DEEPL_API_KEY dans .env)
 * et gardées dans chrome-listing.i18n.json : on ne retraduit une langue que si
 * le texte anglais a changé, et une correction manuelle du JSON est conservée.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LISTING } from "./store-assets/chrome-listing.mjs";
import { LANG_DIRS } from "./store-assets/config.mjs";
import { SCREENSHOT_ORDER, PROMO_FILES } from "./lib/listing-order.mjs";
import { loadDotEnv, requireEnv } from "./lib/store-env.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = path.join(ROOT, "scripts", "store-assets");
const CACHE = path.join(ASSETS, "chrome-listing.i18n.json");
const TEMPLATE = path.join(ASSETS, "chrome-kit-template.html");
const OUT = path.join(process.env.STREAMPULSE_ZIP_DIR || path.join(os.homedir(), "Desktop/dev/ZIPS"), "chrome-kit");

/** Ordre et libellés du sélecteur de langues, identiques au kit Edge. */
const LANGS = [
  ["en", "English"], ["fr", "Français"], ["es", "Español"], ["pt-BR", "Português (Brasil)"],
  ["de", "Deutsch"], ["it", "Italiano"], ["pl", "Polski"], ["tr", "Türkçe"], ["ru", "Русский"],
  ["ja", "日本語"], ["ko", "한국어"], ["id", "Bahasa Indonesia"], ["nl", "Nederlands"],
  ["sv", "Svenska"], ["cs", "Čeština"],
];
const FONTS = [
  "unbounded-latin-10.woff2", "unbounded-latin-ext-9.woff2", "unbounded-cyrillic-8.woff2",
  "onest-latin-6.woff2", "onest-latin-ext-5.woff2", "onest-cyrillic-4.woff2",
];

/**
 * Ton familier partout (« du », « tu »…), comme l'interface de l'extension : sans
 * ce réglage DeepL alterne tutoiement et vouvoiement dans un même texte.
 */
const FORMALITY = "prefer_less";
const sha = (text) => crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
const readJson = (file, fallback) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback);

async function deepl(text, lang, key) {
  const response = await fetch("https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: [text], source_lang: "EN", target_lang: lang.toUpperCase(), preserve_formatting: true, formality: FORMALITY }),
  });
  if (!response.ok) throw new Error(`DeepL ${lang} : HTTP ${response.status}`);
  const data = await response.json();
  return data.translations[0].text;
}

/** Description par langue : FR et EN depuis la source, le reste depuis le cache ou DeepL. */
async function descriptions() {
  const cache = readJson(CACHE, {});
  const source = sha(`${FORMALITY}\n${LISTING.en}`);
  const stale = LANGS.map(([code]) => code).filter((code) => !LISTING[code] && cache[code]?.source !== source);
  if (stale.length) {
    loadDotEnv();
    const { DEEPL_API_KEY } = requireEnv(["DEEPL_API_KEY"]);
    for (const code of stale) {
      process.stdout.write(`Traduction ${code}…`);
      cache[code] = { source, text: await deepl(LISTING.en, code, DEEPL_API_KEY) };
      console.log(" ✓");
    }
    fs.writeFileSync(CACHE, `${JSON.stringify(cache, null, 2)}\n`);
  }
  return Object.fromEntries(LANGS.map(([code]) => [code, LISTING[code] || cache[code].text]));
}

/** Nom et description courte que Chrome lit dans le paquet, pour les montrer dans la page. */
function manifestStrings(code) {
  const file = path.join(ROOT, "_locales", code.replace("-", "_"), "messages.json");
  const messages = readJson(file, {});
  return { appName: messages.appName?.message || "", appDesc: messages.appDesc?.message || "" };
}

function copy(from, to) {
  if (!fs.existsSync(from)) throw new Error(`Fichier manquant : ${path.relative(ROOT, from)}`);
  fs.copyFileSync(from, to);
}

async function main() {
  const texts = await descriptions();
  fs.rmSync(OUT, { recursive: true, force: true });
  for (const dir of ["shared", "fonts"]) fs.mkdirSync(path.join(OUT, dir), { recursive: true });

  FONTS.forEach((font) => copy(path.join(ROOT, "font", font), path.join(OUT, "fonts", font)));
  copy(path.join(ROOT, "images", "promo", "store-icon-128.png"), path.join(OUT, "shared", "store-icon-128.png"));
  copy(path.join(ROOT, "images", "photos", "128px.png"), path.join(OUT, "shared", "mark.png"));
  for (const promo of Object.values(PROMO_FILES)) {
    for (const file of Object.values(promo)) copy(path.join(ROOT, "images", "promo", file), path.join(OUT, "shared", file));
  }

  const data = LANGS.map(([code, name]) => {
    const dir = LANG_DIRS[code];
    const langOut = path.join(OUT, dir);
    fs.mkdirSync(langOut, { recursive: true });
    fs.writeFileSync(path.join(langOut, "description.txt"), `${texts[code]}\n`);
    const shots = SCREENSHOT_ORDER.map((file, index) => {
      copy(path.join(ROOT, "images", "cws_screenshots", dir, file), path.join(langOut, `capture-${index + 1}.png`));
      return `${dir}/capture-${index + 1}.png`;
    });
    const promo = PROMO_FILES[code === "fr" ? "FR" : "EN"];
    copy(path.join(ROOT, "images", "promo", promo.marquee), path.join(langOut, "tuile-grande-1400x560.png"));
    copy(path.join(ROOT, "images", "promo", promo.small), path.join(langOut, "tuile-petite-440x280.png"));
    return { code, name, dir, desc: texts[code], ...manifestStrings(code), shots, tile: `shared/${promo.small}`, marquee: `shared/${promo.marquee}` };
  });

  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  fs.writeFileSync(path.join(OUT, "index.html"), fs.readFileSync(TEMPLATE, "utf8").replace("__DATA__", json));

  console.log(`Kit Chrome prêt : ${path.join(OUT, "index.html")}`);
  for (const l of data) console.log(`  ${l.dir.padEnd(5)} description ${String(l.desc.length).padStart(5)} car. · nom ${l.appName.length}/75 · courte ${l.appDesc.length}/132`);
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
