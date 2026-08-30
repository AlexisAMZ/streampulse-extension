/**
 * Extraction des textes marketing.
 *
 * Deux sources, aucune invention :
 *   - CHROMEWEBSTORE.md : short + detailed descriptions déjà traduites (15 langues)
 *   - i18n/translations.js : les chaînes réellement affichées par l'extension
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT, LANG_DIRS } from "./config.mjs";

/** Codes affichés dans les titres de section de CHROMEWEBSTORE.md -> code interne. */
const HEADING_CODES = {
  ES: "es",
  "PT-BR": "pt-BR",
  DE: "de",
  IT: "it",
  PL: "pl",
  TR: "tr",
  RU: "ru",
  JA: "ja",
  KO: "ko",
  ID: "id",
  NL: "nl",
  SV: "sv",
  CS: "cs",
};

function readListing() {
  return fs.readFileSync(path.join(ROOT, "CHROMEWEBSTORE.md"), "utf8");
}

function firstFencedBlock(source, fromIndex) {
  const open = source.indexOf("```text", fromIndex);
  if (open === -1) return "";
  const start = source.indexOf("\n", open) + 1;
  const close = source.indexOf("```", start);
  if (close === -1) return "";
  return source.slice(start, close).trim();
}

function inlineCodeAfter(source, marker) {
  const at = source.indexOf(marker);
  if (at === -1) return "";
  const open = source.indexOf("`", at);
  if (open === -1) return "";
  const close = source.indexOf("`", open + 1);
  if (close === -1) return "";
  return source.slice(open + 1, close).trim();
}

/**
 * Découpe une puce « • Titre : corps » en deux parties.
 * Gère le deux-points pleine largeur des locales CJK.
 */
function splitBullet(line) {
  const text = line.replace(/^[•\-*]\s*/, "").trim();
  const at = text.search(/[:：]/);
  if (at === -1) return { title: text, body: "" };
  return {
    title: text.slice(0, at).trim(),
    body: text.slice(at + 1).trim(),
  };
}

function bulletsFrom(detailed) {
  return detailed
    .split("\n")
    .filter((line) => line.trim().startsWith("•"))
    .map(splitBullet)
    .filter((bullet) => bullet.title);
}

/**
 * @returns {Record<string, {short: string, detailed: string, bullets: {title: string, body: string}[]}>}
 */
export function loadListingCopy() {
  const md = readListing();
  const out = {};

  // FR et EN vivent dans les sections principales, pas dans le bloc « Traductions ».
  const shortBlock = md.slice(md.indexOf("### Description Courte"));
  out.fr = { short: inlineCodeAfter(shortBlock, "**FR**") };
  out.en = { short: inlineCodeAfter(shortBlock, "**EN**") };
  out.fr.detailed = firstFencedBlock(
    md,
    md.indexOf("### Description Détaillée"),
  );
  out.en.detailed = firstFencedBlock(
    md,
    md.indexOf("### Detailed Description (EN)"),
  );

  for (const [heading, code] of Object.entries(HEADING_CODES)) {
    const at = md.indexOf(`(${heading})\n`);
    if (at === -1) {
      throw new Error(`Section absente dans CHROMEWEBSTORE.md : (${heading})`);
    }
    const section = md.slice(at);
    out[code] = {
      short: inlineCodeAfter(section, "**Short Description**"),
      detailed: firstFencedBlock(section, section.indexOf("**Detailed Description**")),
    };
  }

  for (const [code, entry] of Object.entries(out)) {
    if (!entry.short) throw new Error(`Short description manquante : ${code}`);
    if (!entry.detailed) throw new Error(`Detailed description manquante : ${code}`);
    entry.bullets = bulletsFrom(entry.detailed);
    if (entry.bullets.length < 4) {
      throw new Error(
        `Seulement ${entry.bullets.length} puces extraites pour ${code}`,
      );
    }
  }

  for (const code of Object.keys(LANG_DIRS)) {
    if (!out[code]) throw new Error(`Aucun texte store pour la langue ${code}`);
  }

  return out;
}

/**
 * Correctifs de tagline.
 *
 * `onboarding.welcomeTagline` a été produit par traduction automatique, qui a
 * traité « Chrome » comme le métal et non comme le nom du navigateur :
 *   de → CHROMVERLÄNGERUNG  (rallonge en chrome)
 *   it → ESTENSIONE CROMATA (extension chromée)
 *   pl → ROZSZERZENIE CHROMU (extension du chrome, génitif de l'élément)
 *
 * On corrige ici pour ne pas imprimer la faute sur les visuels du store. La
 * correction de fond appartient à i18n/translations.js, où la chaîne est aussi
 * affichée dans l'onboarding de l'extension.
 */
const TAGLINE_FIXES = {
  de: "CHROME-ERWEITERUNG · TWITCH · KICK",
  it: "ESTENSIONE CHROME · TWITCH · KICK",
  pl: "ROZSZERZENIE CHROME · TWITCH · KICK",
};

export function resolveTagline(translated, lang) {
  return TAGLINE_FIXES[lang] || translated;
}

/**
 * Typographie française : espace fine insécable avant ! ? ; et insécable avant
 * les deux-points. Sans ça le rendu casse la ligne entre le mot et la ponctuation
 * (« ...15 langues \n ! Gratuit »).
 */
export function applyTypography(text, lang) {
  if (lang !== "fr" || !text) return text;
  return text
    .replace(/ +([!?;])/g, "\u202F$1")
    .replace(/ +:/g, "\u00A0:")
    .replace(/«\s+/g, "\u00AB\u00A0")
    .replace(/\s+»/g, "\u00A0\u00BB");
}

/** Résout une clé pointée dans un bloc de traduction, avec repli sur l'anglais. */
export function makeTranslator(translations, lang) {
  const resolve = (key, table) => {
    let current = table;
    for (const segment of key.split(".")) {
      if (!current || typeof current !== "object") return null;
      current = current[segment];
    }
    return typeof current === "string" ? current : null;
  };

  return (key, vars = {}) => {
    const value =
      resolve(key, translations[lang]) ?? resolve(key, translations.en) ?? "";
    return value.replace(/\{\{(\w+)\}\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
    );
  };
}
