// Proposition du badge communautaire, sans insistance déguisée : le réglage
// existe dans « Pseudo et badge » mais personne ne l'y cherche. La carte ne
// sort que si le badge est désactivé ; « Plus tard » la repousse d'un mois,
// « Non merci » et l'activation la retirent pour de bon. Les nouvelles
// installs voient d'abord la proposition à l'onboarding : on leur laisse une
// semaine avant de relancer depuis la popup.
//
// Même emplacement et même porte que la demande d'avis (popup-review.js) :
// ligne d'activité sous la scène, jamais à la première ouverture d'une version
// ni pendant le coup d'œil, et un seul bandeau à la fois (l'avis a la priorité).

import { t } from "./i18n.js";
import { askGate, reviewAskDecision } from "./popup-review.js";

const KEY = "streamPulseBadgeAsk";
const PREFERENCES_KEY = "betaGeneralPreferences";
const FIRST_ASK_MS = 7 * 86_400_000;
const LATER_MS = 30 * 86_400_000;
const CONFIRMED_MS = 2400;

const $ = (id) => document.getElementById(id);

/** Faut-il afficher la carte ? Pur, testé. */
export function shouldAsk(state, preferences, now) {
  if (!state?.firstSeen || state.done) return false;
  if (preferences?.communityBadge === true) return false;
  if (now - state.firstSeen < FIRST_ASK_MS) return false;
  return !state.snoozedUntil || now >= state.snoozedUntil;
}

async function save(state) {
  await chrome.storage.local.set({ [KEY]: state });
}

async function loadState() {
  const now = Date.now();
  const stored = await chrome.storage.local.get([KEY, PREFERENCES_KEY, "betaGeneralStreamers", "streamPulseWatchTimeDaily"]);
  let state = stored[KEY] || null;
  if (!state?.firstSeen) {
    // Utilisateur qui a déjà de l'historique (streamers ou temps de visionnage) :
    // éligible tout de suite. Nouvelle install : l'onboarding vient de proposer
    // le badge, on attend une semaine.
    const existing = (Array.isArray(stored.betaGeneralStreamers) && stored.betaGeneralStreamers.length > 0)
      || Object.keys(stored.streamPulseWatchTimeDaily || {}).length > 0;
    state = { firstSeen: existing ? now - FIRST_ASK_MS : now };
    await save(state);
  }
  return { state, due: shouldAsk(state, stored[PREFERENCES_KEY], now) };
}

/** Une seule carte à la fois : la demande d'avis, prioritaire, garde la place. */
async function slotIsFree() {
  try {
    const review = await reviewAskDecision();
    return !review.due;
  } catch (error) {
    console.warn("[popup] badge ask : décision de l'avis illisible", error);
    return false;
  }
}

async function activate(card, close) {
  // La carte reste visible le temps de la confirmation (voir plus bas).
  close({ done: true }, { hide: false }).catch((error) => console.warn("[popup] badge ask :", error));
  try {
    await chrome.runtime.sendMessage({ type: "updatePreferences", updates: { communityBadge: true } });
  } catch (error) {
    console.warn("[popup] badge ask activation failed:", error);
  }
  // Preuve immédiate : les actions laissent place à la confirmation, le
  // temps de voir le réglage pris en compte avant que la carte s'efface.
  const actions = card.querySelector(".badge-ask-actions");
  const body = card.querySelector(".badge-ask-text span");
  if (actions) actions.hidden = true;
  if (body) body.textContent = t("popup.badgeAsk.activated");
  setTimeout(() => { card.hidden = true; }, CONFIRMED_MS);
}

function wireButtons(card, initialState) {
  let state = initialState;
  const close = (patch, { hide = true } = {}) => {
    if (hide) card.hidden = true;
    state = { ...state, ...patch };
    return save(state);
  };
  const warn = (error) => console.warn("[popup] badge ask :", error);
  $("badge-ask-activate")?.addEventListener("click", () => activate(card, close));
  $("badge-ask-later")?.addEventListener("click", () => close({ snoozedUntil: Date.now() + LATER_MS }).catch(warn));
  $("badge-ask-never")?.addEventListener("click", () => close({ done: true }).catch(warn));
}

export async function initBadgeAsk() {
  if (!$("badge-ask")) return;
  const { state, due } = await loadState();
  if (!due || !(await slotIsFree()) || !(await askGate())) return;
  const card = $("badge-ask");
  if (!card) return;
  card.hidden = false;
  card.setAttribute("aria-label", t("popup.badgeAsk.title"));
  wireButtons(card, state);
}
