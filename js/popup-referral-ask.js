// Carte « Parraine un ami » de l'onglet Streamers : le parrainage vivait derrière
// Réglages > StreamPulse+, personne ne l'y trouvait. Même emplacement et même
// porte que la demande d'avis et le badge (popup-review.js) : un seul bandeau à
// la fois, jamais à la première ouverture d'une version. « Plus tard » la repousse
// d'un mois, « Non merci » la retire pour de bon, et avoir obtenu son code aussi.

import { t } from "./i18n.js";
import { askGate, reviewAskDecision } from "./popup-review.js";
import { shouldAskReferral, REFERRAL_ASK_FIRST_MS, REFERRAL_ASK_LATER_MS } from "./referral-data.js";

const KEY = "streamPulseReferralAsk";
const CODE_KEY = "streamPulseReferralCode";

const $ = (id) => document.getElementById(id);

async function save(state) {
  await chrome.storage.local.set({ [KEY]: state });
}

async function loadState() {
  const now = Date.now();
  const stored = await chrome.storage.local.get([KEY, CODE_KEY, "betaGeneralStreamers", "streamPulseWatchTimeDaily"]);
  let state = stored[KEY] || null;
  if (!state?.firstSeen) {
    // Utilisateur qui a déjà de l'historique : éligible tout de suite ; installation fraîche : on attend.
    const existing = (Array.isArray(stored.betaGeneralStreamers) && stored.betaGeneralStreamers.length > 0)
      || Object.keys(stored.streamPulseWatchTimeDaily || {}).length > 0;
    state = { firstSeen: existing ? now - REFERRAL_ASK_FIRST_MS : now };
    await save(state);
  }
  return { state, due: shouldAskReferral(state, { hasCode: Boolean(stored[CODE_KEY]) }, now) };
}

/** Une seule carte à la fois : l'avis, le badge et CHZZK gardent la place s'ils sont affichés. */
async function slotIsFree() {
  try {
    if ((await reviewAskDecision()).due) return false;
  } catch (error) {
    console.warn("[popup] referral ask : décision de l'avis illisible", error);
    return false;
  }
  return ["badge-ask", "chzzk-ask", "review-ask"].every((id) => !$(id) || $(id).hidden);
}

/** Ouvre le bloc Parrainage : Réglages, puis l'onglet StreamPulse+, puis descente jusqu'au code. */
function openReferral() {
  $("tab-settings")?.click();
  const plusTab = $("menu-tab-plus") || document.querySelector('.menu-nav .menu-tab[data-panel="plus"]');
  plusTab?.click();
  requestAnimationFrame(() => {
    setTimeout(() => {
      const block = $("referral-block");
      if (block) {
        block.scrollIntoView({ block: "start", behavior: "smooth" });
        const getBtn = $("referral-get");
        if (getBtn && !getBtn.hidden) {
          getBtn.click();
        }
      }
    }, 80);
  });
}

function wireButtons(card, initialState) {
  let state = initialState;
  const close = (patch) => {
    card.hidden = true;
    state = { ...state, ...patch };
    return save(state);
  };
  const warn = (error) => console.warn("[popup] referral ask :", error);
  $("referral-ask-open")?.addEventListener("click", () => {
    close({ done: true }).catch(warn);
    openReferral();
  });
  $("referral-ask-later")?.addEventListener("click", () => close({ snoozedUntil: Date.now() + REFERRAL_ASK_LATER_MS }).catch(warn));
  $("referral-ask-never")?.addEventListener("click", () => close({ done: true }).catch(warn));
}

/** À appeler une fois les autres cartes décidées (leur état « hidden » est lu). */
export async function initReferralAsk() {
  const card = $("referral-ask");
  if (!card) return;
  const { state, due } = await loadState();
  if (!due || !(await askGate()) || !(await slotIsFree())) return;
  card.hidden = false;
  card.setAttribute("aria-label", t("popup.referralAsk.title"));
  wireButtons(card, state);
}
