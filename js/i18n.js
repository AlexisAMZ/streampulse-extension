import {
  AVAILABLE_LANGUAGES,
  DEFAULT_LANGUAGE,
  formatTemplate,
  matchLanguage,
} from "../i18n/meta.js";
import { detectInstallLanguage } from "./preferences-data.js";

// Les chaînes ne sont plus toutes chargées d'un bloc (≈ 700 Ko pour 11
// langues) : initI18n() importe la langue choisie (i18n/lang/<code>.js) et
// l'anglais, qui sert de repli clé par clé. Une fois l'init résolue, t() reste
// synchrone. Avant l'init, t() rend la clé brute : tout rendu doit l'attendre.

const PREFERENCES_KEY = "betaGeneralPreferences";
const LANGUAGE_PROP = "language";

let currentLanguage = DEFAULT_LANGUAGE;
const listeners = new Set();
/** Dictionnaires chargés, par code de langue. */
const dictionaries = new Map();
/** Imports en cours, pour ne jamais charger deux fois la même langue. */
const pendingLoads = new Map();
let warnedBeforeInit = false;
/**
 * Numéro de la dernière demande de langue (init ou clic). Un chargement plus
 * lent qu'un clic suivant ne doit pas écraser le choix le plus récent.
 */
let latestRequest = 0;

function applyLanguage(code) {
  currentLanguage = code;
}

async function importLanguage(code) {
  // `code` sort toujours de matchLanguage() : un des codes du registre.
  const module = await import(`../i18n/lang/${code}.js`);
  const dictionary = module?.default;
  if (!dictionary || typeof dictionary !== "object") {
    throw new Error(`i18n/lang/${code}.js n'exporte aucun dictionnaire`);
  }
  dictionaries.set(code, dictionary);
  return true;
}

function loadLanguage(code) {
  if (dictionaries.has(code)) return Promise.resolve(true);
  if (!pendingLoads.has(code)) {
    const load = importLanguage(code)
      .catch((error) => {
        console.warn(`[i18n] chargement de la langue « ${code} » impossible :`, error);
        return false;
      })
      .finally(() => pendingLoads.delete(code));
    pendingLoads.set(code, load);
  }
  return pendingLoads.get(code);
}

/** Charge `code` et l'anglais de repli ; vrai si `code` est utilisable. */
async function ensureLanguage(code) {
  const [loaded] = await Promise.all([loadLanguage(code), loadLanguage(DEFAULT_LANGUAGE)]);
  return loaded;
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
  // Aucun choix stocké (nouvelle installation, stockage lu avant le service
  // worker) : suivre la langue du navigateur plutôt que tomber direct sur
  // l'anglais — même règle que PreferenceStore.ensureDefaults côté SW.
  const uiLanguage =
    (typeof chrome !== "undefined" && chrome?.i18n?.getUILanguage?.()) ||
    (typeof navigator !== "undefined" ? navigator.language : "") ||
    "";
  return detectInstallLanguage(uiLanguage);
}

function lookup(dictionary, segments) {
  let current = dictionary;
  for (const segment of segments) {
    if (current && Object.prototype.hasOwnProperty.call(current, segment)) {
      current = current[segment];
    } else {
      return null;
    }
  }
  return current;
}

function resolveTranslation(key, lang) {
  if (!key) return null;
  const segments = key.split(".");
  const own = dictionaries.has(lang) ? lookup(dictionaries.get(lang), segments) : null;
  if (own != null || lang === DEFAULT_LANGUAGE) return own;
  const fallback = dictionaries.get(DEFAULT_LANGUAGE);
  return fallback ? lookup(fallback, segments) : null;
}

function warnIfNotReady(key) {
  if (dictionaries.size > 0 || warnedBeforeInit) return;
  warnedBeforeInit = true;
  console.warn(`[i18n] t("${key}") appelé avant initI18n() : la clé brute s'affiche.`);
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

/** Langues dont les chaînes sont en mémoire (diagnostic et tests). */
export function getLoadedLanguages() {
  return [...dictionaries.keys()];
}

export async function initI18n(preloadedLanguage = null) {
  // The caller may hand us a raw stored value ("pt_BR", "EN"), so normalize it
  // instead of trusting it blindly: an unmatched tag would silently render keys.
  const request = ++latestRequest;
  const requested = matchLanguage(preloadedLanguage) || (await readStoredLanguage());
  const usable = await ensureLanguage(requested);
  if (request === latestRequest) {
    applyLanguage(usable ? requested : DEFAULT_LANGUAGE);
  }
  return currentLanguage;
}

async function persistLanguage(nextLang) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "updatePreferences",
      updates: { [LANGUAGE_PROP]: nextLang },
    });
    if (response?.success) return;
  } catch (error) {
    console.warn("[i18n] service worker injoignable, écriture directe de la langue :", error?.message || error);
  }
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

export async function setLanguage(requestedLang) {
  const nextLang = matchLanguage(requestedLang);
  if (!nextLang || nextLang === currentLanguage) {
    return currentLanguage;
  }
  const request = ++latestRequest;
  // Les chaînes d'abord : les abonnés re-rendent aussitôt avec t().
  const loaded = await ensureLanguage(nextLang);
  if (!loaded || request !== latestRequest || nextLang === currentLanguage) {
    return currentLanguage;
  }

  // Apply locally first so the UI switches even if the service worker is asleep
  // or rejects the write; storage below is the durable source of truth.
  applyLanguage(nextLang);
  notifyLanguageChange();
  await persistLanguage(nextLang);
  return currentLanguage;
}

export function onLanguageChange(callback) {
  if (typeof callback !== "function") return () => {};
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function t(key, params = {}, lang = currentLanguage) {
  warnIfNotReady(key);
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

  // Le parseur HTML minuscule les noms d'attributs : la forme historique
  // data-i18n-attr-ariaLabel devient data-i18n-attr-arialabel, et la forme
  // lue data-i18n-attr-aria-label. Les deux doivent produire aria-label —
  // sinon le libellé arrive en "arialabel", attribut que rien ne lit.
  const ATTR_ALIASES = { arialabel: "aria-label" };

  const attrElements = scope.querySelectorAll
    ? scope.querySelectorAll(
        "[data-i18n-attr-placeholder], [data-i18n-attr-title], [data-i18n-attr-aria-label], [data-i18n-attr-arialabel], [data-i18n-attr-value]"
      )
    : [];

  attrElements.forEach((element) => {
    Object.entries(element.dataset).forEach(([dataKey, dataValue]) => {
      if (!dataKey.startsWith("i18nAttr")) return;
      const attrName = camelToKebab(dataKey.slice("i18nAttr".length));
      if (!attrName) return;
      const translated = t(dataValue);
      const finalName = ATTR_ALIASES[attrName] || attrName;
      element.setAttribute(finalName, translated);
      if (finalName === "value") {
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

export { DEFAULT_LANGUAGE, AVAILABLE_LANGUAGES, resolveLocale } from "../i18n/meta.js";
