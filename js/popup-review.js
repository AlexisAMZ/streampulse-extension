// Demande d'avis, sans aucune contrepartie : les règles du Chrome Web Store,
// d'Edge et de Firefox interdisent de récompenser un avis. Le bandeau apparaît
// après 14 jours d'utilisation, une seule fois ; « Plus tard » le repousse d'un
// mois, « Non merci » et « Laisser un avis » le retirent pour de bon.
//
// MESURE LOCALE (aucune donnée ne sort, aucun identifiant) : chaque affichage,
// clic et fermeture incrémente un compteur dans streamPulseReviewMetrics. Pour
// le lire : console du service worker, chrome.storage.local.get("streamPulseReviewMetrics").
//
// VARIANTES DE DÉCLENCHEUR, choisies par la config distante
// (streampulse:remoteConfig → data.reviewAsk.variant, modifiable sans republier
// l'extension ; à défaut, comportement historique « calendar ») :
//   calendar     14 jours après la première vue (comportement historique)
//   momentum     7 jours ET un succès vécu (temps de visionnage ou points relevés)
//   firstSuccess 3 jours ET un succès vécu
// Le succès vécu reste local : c'est un booléen calculé sur des compteurs déjà
// présents, jamais renvoyé nulle part.

import { t } from "./i18n.js";

const KEY = "streamPulseReviewAsk";
const METRICS_KEY = "streamPulseReviewMetrics";
const REMOTE_CONFIG_CACHE_KEY = "streampulse:remoteConfig";
const DAY_MS = 86_400_000;
const FIRST_ASK_MS = 14 * DAY_MS;
const LATER_MS = 30 * DAY_MS;
const VARIANTS = {
  calendar: { minDays: 14, needsSuccess: false },
  momentum: { minDays: 7, needsSuccess: true },
  firstSuccess: { minDays: 3, needsSuccess: true },
};
const STORES = {
  firefox: "https://addons.mozilla.org/firefox/addon/streampulse-twitch-kick/reviews/",
  edge: "https://microsoftedge.microsoft.com/addons/search/streampulse",
  chrome: "https://chromewebstore.google.com/detail/streampulse-multi-streame/ipfhbfabadbpkjimhdcjadopnahdpddh/reviews",
};

const $ = (id) => document.getElementById(id);

export function storeUrl(userAgent = navigator.userAgent) {
  if (/firefox/i.test(userAgent)) return STORES.firefox;
  if (/\bEdg\//.test(userAgent)) return STORES.edge;
  return STORES.chrome;
}

/** Variante active, validée contre la liste connue (« calendar » sinon). */
export function resolveVariant(reviewAskConfig) {
  const wanted = reviewAskConfig?.variant;
  return VARIANTS[wanted] ? wanted : "calendar";
}

/**
 * Faut-il afficher le bandeau ? Pur, testé.
 * signals.hasSuccess : un succès vécu a été constaté (voir initReviewAsk).
 */
export function shouldAsk(state, now, { variant = "calendar", hasSuccess = false } = {}) {
  if (!state?.firstSeen || state.done) return false;
  const rule = VARIANTS[variant] || VARIANTS.calendar;
  if (now - state.firstSeen < rule.minDays * DAY_MS) return false;
  if (rule.needsSuccess && !hasSuccess) return false;
  return !state.snoozedUntil || now >= state.snoozedUntil;
}

async function save(state) {
  await chrome.storage.local.set({ [KEY]: state });
}

/** Compteur local d'événements ; une entrée par variante, plus le total. */
async function recordMetric(variant, event) {
  try {
    const stored = await chrome.storage.local.get(METRICS_KEY);
    const metrics = stored[METRICS_KEY] || {};
    const byVariant = metrics.byVariant || {};
    const slot = byVariant[variant] || { shown: 0, rate: 0, later: 0, never: 0 };
    slot[event] = (slot[event] || 0) + 1;
    metrics[event] = (metrics[event] || 0) + 1;
    await chrome.storage.local.set({
      [METRICS_KEY]: { ...metrics, byVariant: { ...byVariant, [variant]: slot }, updatedAt: Date.now() },
    });
  } catch {
    // La mesure ne doit jamais faire plancher l'UI.
  }
}

export async function initReviewAsk() {
  if (!$("review-ask")) return;
  const now = Date.now();
  const stored = await chrome.storage.local.get([
    KEY,
    METRICS_KEY,
    REMOTE_CONFIG_CACHE_KEY,
    "betaGeneralStreamers",
    "streamPulseWatchTimeDaily",
    "streamPulsePointsDaily",
    "streamPulsePointsChannels",
  ]);
  const variant = resolveVariant(stored[REMOTE_CONFIG_CACHE_KEY]?.data?.reviewAsk);
  // Succès vécu : l'utilisateur a vraiment utilisé une fonction clé. Uniquement
  // des compteurs déjà écrits par l'extension, jamais renvoyés nulle part.
  const hasSuccess =
    Object.keys(stored.streamPulseWatchTimeDaily || {}).length > 0
    || Object.keys(stored.streamPulsePointsDaily || {}).length > 0
    || Object.keys(stored.streamPulsePointsChannels || {}).length > 0;
  let state = stored[KEY] || null;
  if (!state?.firstSeen) {
    // Installations existantes (streamers suivis ou visionnage déjà là) :
    // on antidate pour ne pas les faire attendre 14 jours. Les variantes à
    // succès vécu gardent leur condition propre, même dans ce cas.
    const existing = (Array.isArray(stored.betaGeneralStreamers) && stored.betaGeneralStreamers.length > 0)
      || Object.keys(stored.streamPulseWatchTimeDaily || {}).length > 0;
    state = { firstSeen: existing ? now - FIRST_ASK_MS : now };
    await save(state);
  }
  if (!shouldAsk(state, now, { variant, hasSuccess })) return;
  // Relu après les lectures du storage : le popup a pu être redessiné entre-temps.
  const banner = $("review-ask");
  if (!banner) return;
  banner.hidden = false;
  state = { ...state, variant };
  await save(state);
  recordMetric(variant, "shown");
  const close = (patch) => {
    banner.hidden = true;
    state = { ...state, ...patch };
    return save(state);
  };
  $("review-ask-rate")?.addEventListener("click", () => {
    chrome.tabs.create({ url: storeUrl() });
    recordMetric(variant, "rate");
    close({ done: true }).catch(() => {});
  });
  $("review-ask-later")?.addEventListener("click", () => {
    recordMetric(variant, "later");
    close({ snoozedUntil: Date.now() + LATER_MS }).catch(() => {});
  });
  $("review-ask-never")?.addEventListener("click", () => {
    recordMetric(variant, "never");
    close({ done: true }).catch(() => {});
  });
  banner.setAttribute("aria-label", t("popup.review.title"));
}
