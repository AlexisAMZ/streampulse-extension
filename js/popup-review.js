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
//
// EMPLACEMENT ET MOMENT : le bandeau prend la place de la ligne d'activité, sous
// la scène, sans jamais recouvrir une carte de live. Il ne sort jamais à la
// première ouverture qui suit une installation ou une mise à jour, ni pendant
// le coup d'œil (GLANCE_MS) : voir openAskGate, partagée avec la carte badge
// (popup-badge-ask.js), qui ne sort que si la demande d'avis ne veut pas la place.

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

export const ASK_VERSION_KEY = "streamPulseAskVersion";
export const GLANCE_MS = 4000;

/** Pur : la popup s'ouvre-t-elle pour la première fois dans cette version ? */
export function isFirstOpenOfVersion(storedVersion, currentVersion) {
  return !storedVersion || storedVersion !== currentVersion;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Porte des bandeaux de l'accueil : false à la première ouverture d'une version
 * (retenue au passage) ou si le stockage est illisible ; sinon true, une fois
 * le coup d'œil passé. Dépendances injectables pour les tests.
 */
export async function openAskGate({ storage, version, delayMs = GLANCE_MS, wait = sleep, warn = console.warn }) {
  try {
    const stored = await storage.get(ASK_VERSION_KEY);
    if (isFirstOpenOfVersion(stored?.[ASK_VERSION_KEY], version)) {
      await storage.set({ [ASK_VERSION_KEY]: version });
      return false;
    }
  } catch (error) {
    warn("[popup] porte des bandeaux : stockage illisible", error);
    return false;
  }
  await wait(delayMs);
  return true;
}

let gate = null;

/** Une seule décision par ouverture du popup, partagée par les deux bandeaux. */
export function askGate() {
  gate ??= openAskGate({
    storage: chrome.storage.local,
    version: chrome.runtime.getManifest?.()?.version || "",
  });
  return gate;
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
  } catch (error) {
    // La mesure ne doit jamais faire plancher l'UI.
    console.warn("[popup] mesure de la demande d'avis :", error?.message || error);
  }
}

/** Lit le stockage et décide si la demande d'avis est due (sans l'afficher). */
async function decide() {
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
  return { due: shouldAsk(state, now, { variant, hasSuccess }), state, variant };
}

let decision = null;

/** Décision partagée (une lecture par ouverture) : la carte badge s'y range. */
export function reviewAskDecision() {
  decision ??= decide();
  return decision;
}

function wireButtons(banner, variant, initialState) {
  let state = initialState;
  const close = (patch) => {
    banner.hidden = true;
    state = { ...state, ...patch };
    return save(state);
  };
  const warn = (error) => console.warn("[popup] demande d'avis :", error?.message || error);
  $("review-ask-rate")?.addEventListener("click", () => {
    chrome.tabs.create({ url: storeUrl() });
    recordMetric(variant, "rate");
    close({ done: true }).catch(warn);
  });
  $("review-ask-later")?.addEventListener("click", () => {
    recordMetric(variant, "later");
    close({ snoozedUntil: Date.now() + LATER_MS }).catch(warn);
  });
  $("review-ask-never")?.addEventListener("click", () => {
    recordMetric(variant, "never");
    close({ done: true }).catch(warn);
  });
}

export async function initReviewAsk() {
  if (!$("review-ask")) return;
  const { due, state, variant } = await reviewAskDecision();
  if (!due || !(await askGate())) return;
  // Relu après les attentes : le popup a pu être redessiné entre-temps.
  const banner = $("review-ask");
  if (!banner) return;
  banner.hidden = false;
  const shownState = { ...state, variant };
  await save(shownState);
  recordMetric(variant, "shown");
  wireButtons(banner, variant, shownState);
  banner.setAttribute("aria-label", t("popup.review.title"));
}
