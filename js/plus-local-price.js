import { EUR_PRICES, formatLocalEquivalent, loadRates, rateFrom, resolveCurrency } from "./currency.js";
import { getCurrentLanguage, onLanguageChange } from "./i18n.js";

const STORAGE_KEY = "currencyRates";
const LOCAL_CLASS = "plan-local";

async function readCache() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return stored?.[STORAGE_KEY] ?? null;
}

function writeCache(value) {
  return chrome.storage.local.set({ [STORAGE_KEY]: value });
}

function browserLocales() {
  return typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
}

function render(payload) {
  const language = getCurrentLanguage();
  const currency = resolveCurrency(language, browserLocales());
  const rate = rateFrom(payload, currency);
  document.querySelectorAll(".plus-plan[data-plan]").forEach((button) => {
    const price = button.querySelector(".plan-price");
    if (!price) return;
    price.querySelector(`.${LOCAL_CLASS}`)?.remove();
    const text = formatLocalEquivalent(EUR_PRICES[button.dataset.plan], { currency, rate, locale: language });
    if (!text) return;
    const local = document.createElement("small");
    local.className = LOCAL_CLASS;
    local.textContent = text;
    price.append(local);
  });
}

/** Ajoute sous chaque prix en € sa valeur dans la devise locale (≈, jamais moins). */
export async function initLocalPrices() {
  const payload = await loadRates({ read: readCache, write: writeCache });
  render(payload);
  onLanguageChange(() => render(payload));
}
