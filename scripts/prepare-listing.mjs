#!/usr/bin/env node
/**
 * Prépare les visuels à glisser dans les consoles Chrome Web Store et Edge,
 * qui n'ont pas d'API pour les captures.
 *
 *   npm run listing
 *
 * Sortie (exclue du dépôt) : ~/Desktop/dev/ZIPS/listing-<version>/
 *   chrome/FR/1-dashboard.png … 5-recap.png, 6-marquee-1400x560.png, 7-small-tile-440x280.png
 *   chrome/EN/…
 *   edge/FR/…  edge/EN/…
 *
 * Seules FR et EN reçoivent des visuels : les autres langues de la fiche
 * affichent ceux de la langue par défaut, et leurs captures reprennent de
 * toute façon le popup anglais.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCREENSHOT_ORDER, PROMO } from "./lib/listing-order.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
const OUT = path.join(process.env.STREAMPULSE_ZIP_DIR || path.join(os.homedir(), "Desktop/dev/ZIPS"), `listing-${version}`);
const STORES = ["chrome", "edge"];
const LANGS = ["FR", "EN"];

/** "01-dashboard.png" en position 1 -> "1-dashboard.png" : l'ordre se lit dans le nom. */
const numbered = (position, fileName) => `${position}-${fileName.replace(/^\d+-/, "")}`;

function copy(from, to) {
  if (!fs.existsSync(from)) throw new Error(`Fichier manquant : ${path.relative(ROOT, from)}`);
  fs.copyFileSync(from, to);
}

fs.rmSync(OUT, { recursive: true, force: true });
for (const store of STORES) {
  for (const lang of LANGS) {
    const dir = path.join(OUT, store, lang);
    fs.mkdirSync(dir, { recursive: true });
    SCREENSHOT_ORDER.forEach((name, index) => {
      copy(path.join(ROOT, "images", "cws_screenshots", lang, name), path.join(dir, numbered(index + 1, name)));
    });
    // Jeu de tuiles unique : les stores n'en acceptent qu'un par fiche.
    const next = SCREENSHOT_ORDER.length;
    copy(path.join(ROOT, "images", "promo", PROMO.marquee), path.join(dir, `${next + 1}-marquee-1400x560.png`));
    copy(path.join(ROOT, "images", "promo", PROMO.small), path.join(dir, `${next + 2}-small-tile-440x280.png`));
  }
}

console.log(`Visuels prêts : ${OUT}`);
for (const store of STORES) console.log(`  ${store}/FR et ${store}/EN : ${SCREENSHOT_ORDER.length} captures + 2 tuiles promo`);
