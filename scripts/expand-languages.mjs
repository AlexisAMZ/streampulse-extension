/**
 * Étend i18n/translations.js aux 16 langues du site public.
 *
 * Opérations :
 *   1. Remplace AVAILABLE_LANGUAGES par les 16 codes (ordre du site).
 *   2. Comble les 10 clés popup.settings.* absentes de es et pt-BR.
 *   3. Crée un bloc pour chaque nouvelle langue, hérité de `en`.
 *
 * Les nouvelles langues héritent volontairement de l'anglais : le repli est
 * ainsi explicite dans le fichier plutôt qu'implicite à l'exécution, et
 * `matchLanguage` (qui itère sur Object.keys(translations)) les résout.
 *
 * Idempotent : relancer le script ne duplique rien.
 */
import { readFile, writeFile } from "node:fs/promises";

const FILE = new URL("../i18n/translations.js", import.meta.url);

/** Ordre et libellés natifs alignés sur le sélecteur du site. */
const LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "pt-BR", label: "Português (Brasil)" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pl", label: "Polski" },
  { code: "tr", label: "Türkçe" },
  { code: "ru", label: "Русский" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "nl", label: "Nederlands" },
  { code: "hi", label: "हिन्दी" },
  { code: "sv", label: "Svenska" },
  { code: "cs", label: "Čeština" },
];

/** Langues déjà rédigées à la main : ne jamais les écraser. */
const CURATED = new Set(["fr", "en", "es", "pt-BR"]);

/** Les 10 clés de réglages absentes de es/pt-BR, traduites. */
const SETTINGS_GAP = {
  es: {
    autoClaimDropsTitle: "Reclamar Drops de Twitch automáticamente",
    autoClaimDropsDescription:
      "Reclama automáticamente los Drops de Twitch en cuanto estén disponibles.",
    autoClaimMomentsTitle: "Reclamar Moments de Twitch automáticamente",
    autoClaimMomentsDescription: "Reclama automáticamente los Moments de Twitch.",
    autoCancelRaidsTitle: "Cancelar raids automáticamente",
    autoCancelRaidsDescription:
      "Cancela automáticamente la redirección cuando te incluyen en un raid.",
    hideTwitchExtensionsTitle: "Ocultar extensiones de Twitch",
    hideTwitchExtensionsDescription:
      "Oculta las superposiciones de extensiones de Twitch en el reproductor de vídeo.",
    preventTabDiscardTitle: "Evitar la suspensión de pestañas",
    preventTabDiscardDescription:
      "Evita que Chrome descarte las pestañas inactivas de Twitch o Kick.",
  },
  "pt-BR": {
    autoClaimDropsTitle: "Resgatar Drops da Twitch automaticamente",
    autoClaimDropsDescription:
      "Resgata automaticamente os Drops da Twitch assim que ficarem disponíveis.",
    autoClaimMomentsTitle: "Resgatar Moments da Twitch automaticamente",
    autoClaimMomentsDescription: "Resgata automaticamente os Moments da Twitch.",
    autoCancelRaidsTitle: "Cancelar raids automaticamente",
    autoCancelRaidsDescription:
      "Cancela automaticamente o redirecionamento quando você recebe um raid.",
    hideTwitchExtensionsTitle: "Ocultar extensões da Twitch",
    hideTwitchExtensionsDescription:
      "Oculta as sobreposições de extensões da Twitch no player de vídeo.",
    preventTabDiscardTitle: "Impedir a suspensão de abas",
    preventTabDiscardDescription:
      "Impede que o Chrome descarte abas inativas da Twitch ou Kick.",
  },
};

const source = await readFile(FILE, "utf8");
const { translations } = await import(FILE.href);

// --- 1. AVAILABLE_LANGUAGES -------------------------------------------------
const registry = `export const AVAILABLE_LANGUAGES = [\n${LANGUAGES.map(
  ({ code, label }) => `  { code: ${JSON.stringify(code)}, label: ${JSON.stringify(label)} },`,
).join("\n")}\n];`;

const registryPattern = /export const AVAILABLE_LANGUAGES = \[[\s\S]*?\n\];/;
if (!registryPattern.test(source)) {
  throw new Error("AVAILABLE_LANGUAGES introuvable — le fichier a changé de forme.");
}
let output = source.replace(registryPattern, registry);

// --- 2. Combler les trous es / pt-BR ---------------------------------------
// Fait AVANT le clonage : une nouvelle langue héritée d'un `en` incomplet
// propagerait le trou dans les 12 blocs générés.
let filledGaps = 0;
for (const [code, entries] of Object.entries(SETTINGS_GAP)) {
  const existing = translations[code]?.popup?.settings;
  if (!existing) continue;
  for (const [key, value] of Object.entries(entries)) {
    if (Object.prototype.hasOwnProperty.call(existing, key)) continue;
    // Insertion textuelle après une clé voisine déjà présente dans ce bloc.
    existing[key] = value;
    filledGaps += 1;
  }
}

// --- 3. Blocs de langue ----------------------------------------------------
/**
 * Clone profond préservant les fonctions.
 *
 * `structuredClone` échoue sur les valeurs fonction (background.badge.live est
 * un formateur de pluriel). On les reprend par référence : elles sont
 * ré-émises depuis leur source à la sérialisation, jamais mutées.
 */
function deepClone(value) {
  if (typeof value === "function") return value;
  if (Array.isArray(value)) return value.map(deepClone);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deepClone(v)]));
  }
  return value;
}

/** Clone `en` en substituant meta.languageName par le libellé natif. */
function buildBlock(code, label) {
  const base = deepClone(translations.en);
  base.meta = { ...base.meta, languageName: label };
  return base;
}

/** Sérialise en littéral JS indenté à 2 espaces, dans le style du fichier. */
function serialize(value, depth = 1) {
  const pad = "  ".repeat(depth);
  const padEnd = "  ".repeat(depth - 1);
  if (typeof value === "function") {
    // Réindente le corps de la fonction au niveau courant.
    const src = value.toString().trim();
    return src
      .split("\n")
      .map((line, index) => (index === 0 ? line : `${padEnd}${line.replace(/^\s{0,10}/, "")}`))
      .join("\n");
  }
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((item) => `${pad}${serialize(item, depth + 1)},`);
    return `[\n${items.join("\n")}\n${padEnd}]`;
  }
  const entries = Object.entries(value).map(([key, val]) => {
    const safeKey = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
    return `${pad}${safeKey}: ${serialize(val, depth + 1)},`;
  });
  return `{\n${entries.join("\n")}\n${padEnd}}`;
}

let added = 0;
for (const { code, label } of LANGUAGES) {
  if (CURATED.has(code)) continue;
  if (Object.prototype.hasOwnProperty.call(translations, code)) continue;
  translations[code] = buildBlock(code, label);
  added += 1;
}

// --- 4. Réécriture de l'objet translations ---------------------------------
// L'objet est régénéré depuis la structure en mémoire, ce qui applique d'un
// seul coup les trous comblés (étape 2) et les nouveaux blocs (étape 3).
// Sûr ici car le bloc ne contient aucun commentaire à préserver — vérifié.
const ordered = {};
for (const { code } of LANGUAGES) {
  if (translations[code]) ordered[code] = translations[code];
}
for (const [code, value] of Object.entries(translations)) {
  if (!ordered[code]) ordered[code] = value;
}

const marker = "export const translations = {";
const start = output.indexOf(marker);
if (start === -1) throw new Error("Objet translations introuvable.");

let depth = 0;
let end = -1;
for (let i = start + marker.length - 1; i < output.length; i += 1) {
  const char = output[i];
  if (char === "{") depth += 1;
  else if (char === "}") {
    depth -= 1;
    if (depth === 0) {
      end = i + 1;
      break;
    }
  }
}
if (end === -1) throw new Error("Accolade fermante de translations introuvable.");

output = `${output.slice(0, start)}export const translations = ${serialize(ordered, 1)};${output.slice(end + 1)}`;

await writeFile(FILE, output, "utf8");

console.log(`AVAILABLE_LANGUAGES : ${LANGUAGES.length} langues`);
console.log(`Clés es/pt-BR comblées : ${filledGaps}`);
console.log(`Blocs de langue ajoutés : ${added}`);
