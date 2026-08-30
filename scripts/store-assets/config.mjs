/**
 * Configuration du générateur d'assets Chrome Web Store.
 *
 * Les captures sont produites en rendant le VRAI popup (html/popup.html +
 * css/popup.css) dans Chrome headless, avec les traductions réelles de
 * i18n/translations.js. Aucun texte n'est inventé : tout provient soit des
 * traductions embarquées, soit de CHROMEWEBSTORE.md.
 */

import { fileURLToPath } from "node:url";
import path from "node:path";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

/** Dossier de travail (HTML intermédiaires + PNG bruts). Supprimé en fin de run. */
export const WORK_DIR = path.join(ROOT, ".store-assets-build");

/** Racine des livrables, un sous-dossier par langue. */
export const OUT_DIR = path.join(ROOT, "images", "cws_screenshots");

export const CHROME_BIN =
  process.env.CHROME_BIN ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/**
 * Code de langue interne -> nom du dossier de sortie déjà créé dans
 * images/cws_screenshots/. On ne renomme rien : on remplit l'existant.
 */
export const LANG_DIRS = {
  fr: "FR",
  en: "EN",
  es: "ES",
  "pt-BR": "PT-BR",
  de: "DE",
  it: "IT",
  pl: "PL",
  tr: "TR",
  ru: "RU",
  ja: "JA",
  ko: "KO",
  id: "ID",
  nl: "NL",
  sv: "SV",
  cs: "CS",
};

/** Locale BCP-47 utilisée pour le formatage des nombres dans le popup de démo. */
export const LOCALES = {
  fr: "fr-FR",
  en: "en-US",
  es: "es-ES",
  "pt-BR": "pt-BR",
  de: "de-DE",
  it: "it-IT",
  pl: "pl-PL",
  tr: "tr-TR",
  ru: "ru-RU",
  ja: "ja-JP",
  ko: "ko-KR",
  id: "id-ID",
  nl: "nl-NL",
  sv: "sv-SE",
  cs: "cs-CZ",
};

/** Dimensions imposées par le Chrome Web Store. */
export const CANVAS = { width: 1280, height: 800 };

/** Taille de rendu du popup avant intégration dans le cadre marketing. */
export const POPUP_VIEWPORT = { width: 820, height: 600 };

/** Facteur de suréchantillonnage : on rend en 2x puis on réduit. */
export const SCALE = 2;
