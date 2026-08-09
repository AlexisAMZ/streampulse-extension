import {
  AVAILABLE_LANGUAGES,
  DEFAULT_LANGUAGE,
  translations,
  formatTemplate,
  matchLanguage,
} from "../i18n/translations.js";

const PREFERENCES_KEY = "betaGeneralPreferences";
const LANGUAGE_PROP = "language";

let currentLanguage = DEFAULT_LANGUAGE;
const listeners = new Set();

function isValidLanguage(code) {
  return Boolean(translations[code]);
}

async function readStoredLanguage() {
  try {
    const stored = await chrome.storage.local.get(PREFERENCES_KEY);
    const prefs = stored?.[PREFERENCES_KEY];
    const matched = matchLanguage(prefs?.[LANGUAGE_PROP]);
    if (matched) {
      return matched;
    }
  } catch (error) {
    console.warn("Language read error:", error);
  }
  return DEFAULT_LANGUAGE;
}

function getTranslationObject(lang) {
  return translations[lang] || translations[DEFAULT_LANGUAGE] || {};
}

function resolveTranslation(key, lang) {
  if (!key) return null;
  const segments = key.split(".");
  let current = getTranslationObject(lang);
  for (const segment of segments) {
    if (current && Object.prototype.hasOwnProperty.call(current, segment)) {
      current = current[segment];
    } else {
      current = null;
      break;
    }
  }
  if (current == null && lang !== DEFAULT_LANGUAGE) {
    return resolveTranslation(key, DEFAULT_LANGUAGE);
  }
  return current;
}

function notifyLanguageChange() {
  for (const listener of listeners) {
    try {
      listener(currentLanguage);
    } catch (error) {
      console.warn("Language listener error:", error);
    }
  }
}

export function getAvailableLanguages() {
  return AVAILABLE_LANGUAGES.slice();
}

export function getCurrentLanguage() {
  return currentLanguage;
}

export async function initI18n(preloadedLanguage = null) {
  // The caller may hand us a raw stored value ("pt_BR", "EN"), so normalize it
  // instead of trusting it blindly — an unmatched tag would silently render keys.
  const matched = matchLanguage(preloadedLanguage);
  if (matched) {
    currentLanguage = matched;
  } else {
    currentLanguage = await readStoredLanguage();
  }
  return currentLanguage;
}

export async function setLanguage(requestedLang) {
  const nextLang = matchLanguage(requestedLang);
  if (!nextLang || !isValidLanguage(nextLang)) {
    return currentLanguage;
  }
  if (nextLang === currentLanguage) {
    return currentLanguage;
  }

  // Apply locally first so the UI switches even if the service worker is asleep
  // or rejects the write; storage below is the durable source of truth.
  currentLanguage = nextLang;
  notifyLanguageChange();

  let persisted;
  try {
    const response = await chrome.runtime.sendMessage({
      type: "updatePreferences",
      updates: { [LANGUAGE_PROP]: nextLang },
    });
    persisted = Boolean(response?.success);
  } catch {
    persisted = false;
  }

  if (!persisted) {
    try {
      const stored = await chrome.storage.local.get(PREFERENCES_KEY);
      const prefs = stored?.[PREFERENCES_KEY] || {};
      await chrome.storage.local.set({
        [PREFERENCES_KEY]: { ...prefs, [LANGUAGE_PROP]: nextLang },
      });
    } catch (fallbackError) {
      console.warn("Language fallback write error:", fallbackError);
    }
  }

  return currentLanguage;
}

export function onLanguageChange(callback) {
  if (typeof callback !== "function") return () => {};
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function t(key, params = {}, lang = currentLanguage) {
  const resolved = resolveTranslation(key, lang);
  if (typeof resolved === "string") {
    return formatTemplate(resolved, params);
  }
  if (typeof resolved === "function") {
    return resolved(params, { lang });
  }
  if (resolved == null) {
    return key;
  }
  return resolved;
}

function camelToKebab(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

export function applyTranslations(root = document) {
  const scope = root.querySelectorAll
    ? root
    : document;

  const elements = scope.querySelectorAll
    ? scope.querySelectorAll("[data-i18n]")
    : [];

  elements.forEach((element) => {
    const key = element.dataset.i18n;
    if (!key) return;
    const mode = element.dataset.i18nMode || "text";
    const value = t(key);
    if (mode === "html") {
      element.innerHTML = value;
    } else {
      element.textContent = value;
    }
  });

  const attrElements = scope.querySelectorAll
    ? scope.querySelectorAll(
        "[data-i18n-attr-placeholder], [data-i18n-attr-title], [data-i18n-attr-ariaLabel], [data-i18n-attr-value]"
      )
    : [];

  attrElements.forEach((element) => {
    Object.entries(element.dataset).forEach(([dataKey, dataValue]) => {
      if (!dataKey.startsWith("i18nAttr")) return;
      const attrName = camelToKebab(dataKey.slice("i18nAttr".length));
      if (!attrName) return;
      const translated = t(dataValue);
      element.setAttribute(attrName, translated);
      if (attrName === "value") {
        element.value = translated;
      }
    });
  });
}

export async function syncDocumentLanguage(htmlLangKey) {
  const lang = t(htmlLangKey);
  if (lang && typeof lang === "string") {
    document.documentElement.lang = lang;
  }
}

export { DEFAULT_LANGUAGE, AVAILABLE_LANGUAGES, resolveLocale } from "../i18n/translations.js";
