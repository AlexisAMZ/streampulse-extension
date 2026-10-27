// Équivalent local des prix StreamPulse+ (facturés en euros).
//
// Règle : le prix réel reste celui de l'euro. On affiche en plus sa valeur dans
// la devise de la personne, au taux du jour, arrondie à l'unité supérieure :
// jamais moins cher qu'en France, quel que soit le pays. Sans taux fiable
// (hors ligne, API injoignable), on n'affiche rien plutôt qu'un montant faux.
// Ce fichier est identique côté extension et côté site (StreampulseSite/js).

export const EUR_PRICES = Object.freeze({ monthly: 2.99, yearly: 19 });

export const RATES_URL = "https://open.er-api.com/v6/latest/EUR";
export const RATES_TTL_MS = 24 * 60 * 60 * 1000;

const LANGUAGE_CURRENCY = Object.freeze({
  en: "USD",
  fr: "EUR",
  de: "EUR",
  es: "EUR",
  it: "EUR",
  pt: "BRL",
  ja: "JPY",
  ko: "KRW",
  pl: "PLN",
  tr: "TRY",
  ru: "RUB",
  ar: "EUR",
});

const EURO_REGIONS = "AT BE BG CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK".split(" ");

const REGION_CURRENCY = Object.freeze({
  ...Object.fromEntries(EURO_REGIONS.map((region) => [region, "EUR"])),
  US: "USD", GB: "GBP", CA: "CAD", AU: "AUD", NZ: "NZD", CH: "CHF", LI: "CHF",
  SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON",
  TR: "TRY", RU: "RUB", UA: "UAH", JP: "JPY", KR: "KRW", CN: "CNY", TW: "TWD",
  HK: "HKD", SG: "SGD", IN: "INR", ID: "IDR", TH: "THB", VN: "VND", PH: "PHP",
  MY: "MYR", BR: "BRL", MX: "MXN", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN",
  ZA: "ZAR", EG: "EGP", MA: "MAD", DZ: "DZD", TN: "TND", SA: "SAR", AE: "AED",
  QA: "QAR", KW: "KWD", IL: "ILS", NG: "NGN",
});

function parseLocale(tag) {
  try {
    const locale = new Intl.Locale(String(tag));
    return { language: locale.language, region: locale.region || "" };
  } catch {
    return { language: "", region: "" };
  }
}

/**
 * Devise de la personne. La langue de l'interface décide du défaut ; la région
 * du navigateur (fr-CH, en-GB, es-MX…) l'affine quand sa langue correspond.
 */
export function resolveCurrency(uiLanguage, browserLocales = []) {
  const { language } = parseLocale(uiLanguage || "en");
  for (const tag of browserLocales) {
    const parsed = parseLocale(tag);
    if (parsed.language === language && REGION_CURRENCY[parsed.region]) {
      return REGION_CURRENCY[parsed.region];
    }
  }
  return LANGUAGE_CURRENCY[language] || "EUR";
}

/** Taux EUR → `currency` tiré d'une réponse de l'API, ou null si inexploitable. */
export function rateFrom(payload, currency) {
  if (currency === "EUR") return 1;
  const rate = payload?.rates?.[currency];
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/** Montant converti, arrondi vers le haut à la plus petite unité de la devise. */
export function convertUp(eurAmount, rate, currency) {
  const digits =
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
  const factor = 10 ** digits;
  return Math.ceil(eurAmount * rate * factor - 1e-9) / factor;
}

/** « ≈ 3,47 $US » dans la langue donnée ; null pour l'euro ou sans taux. */
export function formatLocalEquivalent(eurAmount, { currency, rate, locale }) {
  if (!currency || currency === "EUR" || !rate) return null;
  try {
    const amount = convertUp(eurAmount, rate, currency);
    const text = new Intl.NumberFormat(locale || "en", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
    return `≈ ${text}`;
  } catch {
    return null;
  }
}

/** Charge les taux (cache injecté pour rester neutre : storage ou localStorage). */
export async function loadRates({ read, write, fetcher = fetch, now = Date.now() }) {
  const cached = await read().catch(() => null);
  if (cached?.payload && now - cached.savedAt < RATES_TTL_MS) return cached.payload;
  try {
    const response = await fetcher(RATES_URL);
    if (!response.ok) throw new Error(`taux ${response.status}`);
    const payload = await response.json();
    if (payload?.result !== "success" || !payload.rates) throw new Error("taux illisibles");
    await write({ savedAt: now, payload: { rates: payload.rates } }).catch(() => {});
    return { rates: payload.rates };
  } catch (error) {
    console.warn("[currency] taux indisponibles :", error?.message || error);
    // Mieux vaut un taux de quelques jours que rien ; au-delà d'une semaine, on se tait.
    return cached?.payload && now - cached.savedAt < 7 * RATES_TTL_MS ? cached.payload : null;
  }
}
