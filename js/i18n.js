import {
  AVAILABLE_LANGUAGES,
  DEFAULT_LANGUAGE,
  translations,
  formatTemplate,
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
    if (prefs && typeof prefs[LANGUAGE_PROP] === "string") {
      const candidate = prefs[LANGUAGE_PROP].toLowerCase();
      if (isValidLanguage(candidate)) {
        return candidate;
      }
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
  if (preloadedLanguage) {
    currentLanguage = preloadedLanguage;
  } else {
    currentLanguage = await readStoredLanguage();
  }
  return currentLanguage;
}

export async function setLanguage(nextLang) {
  if (!isValidLanguage(nextLang)) {
    return currentLanguage;
  }
  if (nextLang === currentLanguage) {
    return currentLanguage;
  }

  let updated = false;
  try {
    const response = await chrome.runtime.sendMessage({
      type: "updatePreferences",
      updates: { [LANGUAGE_PROP]: nextLang },
    });
    if (response?.success) {
      updated = true;
    }
  } catch (error) {
    try {
      const stored = await chrome.storage.local.get(PREFERENCES_KEY);
      const prefs = stored?.[PREFERENCES_KEY] || {};
      await chrome.storage.local.set({
        [PREFERENCES_KEY]: { ...prefs, [LANGUAGE_PROP]: nextLang },
      });
      updated = true;
    } catch (fallbackError) {
      console.warn("Language fallback write error:", fallbackError);
    }
  }

  if (updated) {
    currentLanguage = nextLang;
    notifyLanguageChange();
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

export { DEFAULT_LANGUAGE, AVAILABLE_LANGUAGES } from "../i18n/translations.js";
