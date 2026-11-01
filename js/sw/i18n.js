// Traductions côté service worker (langue des préférences, repli anglais).

import { DEFAULT_LANGUAGE, formatTemplate, resolveLocale, translations } from "../../i18n/translations.js";
import { normalizeLanguage } from "../preferences-data.js";

function resolveTranslationValue(lang, key) {
  if (!key) return null;
  const segments = key.split(".");
  let current = translations[lang] || translations[DEFAULT_LANGUAGE] || {};
  for (const segment of segments) {
    if (current && Object.prototype.hasOwnProperty.call(current, segment)) {
      current = current[segment];
    } else {
      current = null;
      break;
    }
  }
  if (current == null && lang !== DEFAULT_LANGUAGE) {
    return resolveTranslationValue(DEFAULT_LANGUAGE, key);
  }
  return current;
}

export function translate(lang, key, params = {}) {
  const value = resolveTranslationValue(lang, key);
  if (typeof value === "string") {
    return formatTemplate(value, params);
  }
  if (typeof value === "function") {
    return value(params, { lang });
  }
  if (value == null) {
    return key;
  }
  return value;
}

/** Pluriel CLDR côté service worker (même règle que tp() dans js/i18n.js). */
export function translatePlural(lang, key, count, params = {}) {
  const pick = (code) => {
    const group = resolveTranslationValue(code, key);
    if (!group || typeof group !== "object") return null;
    let category = "other";
    try {
      category = new Intl.PluralRules(resolveLocale(code)).select(Number(count));
    } catch {
      // Locale inconnue d'Intl : forme générale.
    }
    return typeof group[category] === "string" ? group[category] : typeof group.other === "string" ? group.other : null;
  };
  const form = pick(lang) ?? pick(DEFAULT_LANGUAGE);
  return form == null ? key : formatTemplate(form, { count, ...params });
}

export function translateWithPrefs(preferences, key, params = {}) {
  const lang = normalizeLanguage(preferences?.language);
  return translate(lang, key, params);
}

export function formatNumberForLanguage(lang, value) {
  try {
    return new Intl.NumberFormat(resolveLocale(lang)).format(value);
  } catch {
    return String(value);
  }
}
