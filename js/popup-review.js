// Demande d'avis, sans aucune contrepartie : les règles du Chrome Web Store,
// d'Edge et de Firefox interdisent de récompenser un avis. Le bandeau apparaît
// après 14 jours d'utilisation, une seule fois ; « Plus tard » le repousse d'un
// mois, « Non merci » et « Laisser un avis » le retirent pour de bon.

import { t } from "./i18n.js";

const KEY = "streamPulseReviewAsk";
const FIRST_ASK_MS = 14 * 86_400_000;
const LATER_MS = 30 * 86_400_000;
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

/** Faut-il afficher le bandeau ? Pur, testé. */
export function shouldAsk(state, now) {
  if (!state?.firstSeen || state.done) return false;
  if (now - state.firstSeen < FIRST_ASK_MS) return false;
  return !state.snoozedUntil || now >= state.snoozedUntil;
}

async function save(state) {
  await chrome.storage.local.set({ [KEY]: state });
}

export async function initReviewAsk() {
  if (!$("review-ask")) return;
  const now = Date.now();
  const stored = await chrome.storage.local.get([KEY, "betaGeneralStreamers", "streamPulseWatchTimeDaily"]);
  let state = stored[KEY] || null;
  if (!state?.firstSeen) {
    // Déjà des streamers ou du temps de visionnage : l'extension sert depuis un
    // moment, on peut demander tout de suite. Sinon, on attend 14 jours.
    const existing = (Array.isArray(stored.betaGeneralStreamers) && stored.betaGeneralStreamers.length > 0)
      || Object.keys(stored.streamPulseWatchTimeDaily || {}).length > 0;
    state = { firstSeen: existing ? now - FIRST_ASK_MS : now };
    await save(state);
  }
  if (!shouldAsk(state, now)) return;
  // Relu après les lectures du storage : le popup a pu être redessiné entre-temps.
  const banner = $("review-ask");
  if (!banner) return;
  banner.hidden = false;
  const close = (patch) => {
    banner.hidden = true;
    state = { ...state, ...patch };
    return save(state);
  };
  $("review-ask-rate")?.addEventListener("click", () => {
    chrome.tabs.create({ url: storeUrl() });
    close({ done: true }).catch(() => {});
  });
  $("review-ask-later")?.addEventListener("click", () => close({ snoozedUntil: Date.now() + LATER_MS }).catch(() => {}));
  $("review-ask-never")?.addEventListener("click", () => close({ done: true }).catch(() => {}));
  banner.setAttribute("aria-label", t("popup.review.title"));
}
