/**
 * Métadonnées i18n, sans aucune chaîne traduite : registre des langues,
 * résolution d'un code de langue et interpolation des gabarits.
 *
 * Les pages de l'extension importent ce module (quelques Ko) puis chargent
 * seulement la langue choisie (i18n/lang/<code>.js) via js/i18n.js. Le service
 * worker et les outils passent par i18n/translations.js, qui regroupe tout.
 */

/**
 * Registre des langues.
 *
 * `ready: false` = le bloc de traduction existe et se résout normalement, mais
 * la langue n'est PAS proposée dans le sélecteur : ses chaînes sont encore de
 * l'anglais recopié. Passer une langue à `ready: true` la publie, rien d'autre
 * n'est à modifier.
 *
 * Chaque code a son fichier i18n/lang/<code>.js, importé par
 * i18n/translations.js. On ne retire jamais un code : matchLanguage() itère sur
 * ce registre, donc un utilisateur dont Chrome est en allemand continue d'être
 * résolu vers `de` plutôt que de tomber sur un état incohérent.
 */
export const ALL_LANGUAGES = [
  { code: "fr", label: "Français", ready: true },
  { code: "en", label: "English", ready: true },
  { code: "es", label: "Español", ready: true },
  { code: "pt-BR", label: "Português (Brasil)", ready: true },
  { code: "de", label: "Deutsch", ready: true },
  { code: "it", label: "Italiano", ready: true },
  { code: "pl", label: "Polski", ready: true },
  { code: "tr", label: "Türkçe", ready: true },
  { code: "ru", label: "Русский", ready: true },
  { code: "ja", label: "日本語", ready: true },
  { code: "ko", label: "한국어", ready: true },
];

/** Langues réellement proposées à l'utilisateur (celles qui sont traduites). */
export const AVAILABLE_LANGUAGES = ALL_LANGUAGES.filter((lang) => lang.ready);

/** Codes de langue, dans l'ordre du registre (fr, en, es…). */
export const LANGUAGE_CODES = ALL_LANGUAGES.map((lang) => lang.code);

export const DEFAULT_LANGUAGE = "en";

/**
 * Resolve any user/browser language tag to a supported translation key.
 * Case-insensitive and region-tolerant: "PT-br" and "pt_BR" both map to "pt-BR",
 * and "en-US" maps to "en". Returns null when nothing matches so callers can
 * decide their own fallback.
 */
export function matchLanguage(value) {
  if (typeof value !== "string") return null;
  const raw = value.trim().replace(/_/g, "-");
  if (!raw) return null;

  const keys = LANGUAGE_CODES;
  const lower = raw.toLowerCase();

  const exact = keys.find((key) => key.toLowerCase() === lower);
  if (exact) return exact;

  // "en-US" -> "en", "pt-PT" -> "pt-BR" (closest supported variant).
  const base = lower.split("-")[0];
  const baseExact = keys.find((key) => key.toLowerCase() === base);
  if (baseExact) return baseExact;

  const sameBase = keys.find((key) => key.toLowerCase().split("-")[0] === base);
  return sameBase || null;
}

/**
 * BCP 47 locale to use for Intl formatting (dates, numbers, durations).
 *
 * Our translation keys are language codes ("fr", "ja"), which Intl accepts
 * directly and resolves to that language's regional default. Only codes that
 * already carry a region ("pt-BR") need to pass through untouched. Unknown
 * input falls back to the default language rather than the browser locale, so
 * formatting always follows the language chosen in StreamPulse.
 */
export function resolveLocale(value) {
  return matchLanguage(value) || DEFAULT_LANGUAGE;
}

export function formatTemplate(template, params = {}) {
  if (typeof template !== "string") {
    return template;
  }
  return template.replace(/{{\s*([^}\s]+)\s*}}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      return String(params[key]);
    }
    return "";
  });
}
