// Onglet Historique, écran StreamPulse+ et alertes intelligentes du popup.
// Séparé de popup.js pour garder chaque fichier lisible ; tout passe par
// chrome.storage, que le service worker alimente.

import { t, getCurrentLanguage } from "./i18n.js";
import { thankPlusSubscriber } from "./plus-thanks.js";
import { initPoints } from "./popup-points.js";
import { initDrops } from "./popup-drops.js";
import { initLayout } from "./popup-layout.js";
import { initReviewAsk } from "./popup-review.js";
import { initBadgeAsk } from "./popup-badge-ask.js";
import { initReferralAsk } from "./popup-referral-ask.js";
import { initLocalPrices } from "./plus-local-price.js";
import { createWatchLaterButton } from "./popup-watch-later.js";
import { IDENTITY_STORAGE_KEYS, initIdentity, renderIdentity } from "./popup-identity.js";
import { HISTORY_KEY, formatClock, missedView, summarize } from "./history-data.js";
import { groupMissedEntries } from "./history-grouping.js";
import { LINKED_ACCOUNTS_KEY, normalizeLinkedAccounts } from "./linked-accounts.js";
import { getPlatformIcon, getPlatformLabelKey } from "./platforms.js";
import { PREDICTION_HISTORY_KEY, PREDICTION_RULE_KEY, normalizeRule as normalizePredictionRule, summarize as summarizePredictions } from "./predictions-data.js";
import { TRIAL_STATE_KEY, trialStateFrom, trialTakenOnAccount } from "./sw/trial.js";
import { celebrateTrial } from "./confetti.js";
import { POPUP_SEEN_KEY } from "./trial-reminder.js";
import { PLUS_KEY, plusPageUrl, getDeviceId, isPlusActive, normalizeLicenseKey, portalUrl, releaseDevice, trialEndsAt, trialPaused, verifyLicense } from "./plus.js";
import { mountLiquidMetalButton } from "./promo-liquid-button.js";
import { mountClipsMorph } from "./promo-clips-morph.js";
import { hasRecentSuccess, reviewAskDecision, REMOTE_CONFIG_CACHE_KEY } from "./popup-review.js";
import { PLUS_VALUE_KEY, plusValueFrom } from "./plus-value.js";
import {
  SMART_ALERTS_KEY,
  MAX_RULES_PER_STREAMER,
  MAX_TERMS_PER_RULE,
  normalizeRule,
  normalizeRules,
} from "./smart-alerts.js";

const $ = (id) => document.getElementById(id);

// Titre tronqué par ellipse : le title garde la version complète.
function vodTitle(entry) {
  const label = [entry.title, entry.game].filter(Boolean).join(" · ") || entry.game || "";
  const span = node("span", "vod-title", label);
  span.title = label;
  return span;
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
const PLUS_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const TRASH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>';

function openTab(url) {
  if (!url) return;
  if (chrome.tabs?.create) chrome.tabs.create({ url });
  else window.open(url, "_blank", "noopener");
}

function durationLabel(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours <= 0) return t("popup.history.durationMinutes", { count: minutes });
  return minutes >= 30 && hours < 10
    ? t("popup.history.durationHoursShort", { h: hours, m: String(minutes).padStart(2, "0") })
    : t("popup.history.durationHours", { count: hours });
}

function agoLabel(endedAt, now = Date.now()) {
  const minutes = Math.max(1, Math.round((now - endedAt) / 60000));
  if (minutes < 60) return t("popup.history.agoMinutes", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("popup.history.agoHours", { count: hours });
  return t("popup.history.agoDays", { count: Math.round(hours / 24) });
}

// ─── Historique ────────────────────────────────────────────────────────────────

let historyPlatform = "all";

function createVodCard(entry) {
  const item = node("li");
  const card = node("button", `vod-card${entry.seen ? " is-seen" : ""}`);
  card.type = "button";
  const name = entry.displayName || entry.handle;
  card.setAttribute(
    "aria-label",
    t(entry.hasVod ? "popup.history.watchVod" : "popup.history.openChannel", { name }),
  );

  const thumb = node("span", "vod-thumb");
  if (entry.thumbnailUrl) {
    const image = node("img");
    image.alt = "";
    image.loading = "lazy";
    image.src = entry.thumbnailUrl;
    image.addEventListener("error", () => image.remove(), { once: true });
    thumb.append(image);
  } else if (entry.avatarUrl) {
    const fallback = node("span", "vod-fallback");
    const avatar = node("img");
    avatar.alt = "";
    avatar.src = entry.avatarUrl;
    fallback.append(avatar);
    thumb.append(fallback);
  }
  if (!entry.seen) thumb.append(node("span", "vod-new", t("popup.history.newBadge")));
  if (entry.durationSec) thumb.append(node("span", "vod-duration", formatClock(entry.durationSec)));

  const info = node("span", "vod-info");
  const avatar = node("img", `mini-avatar ring-${entry.platform === "kick" ? "kick" : "twitch"}`);
  avatar.alt = "";
  if (entry.avatarUrl) avatar.src = entry.avatarUrl;
  const text = node("span", "vod-text");
  text.append(
    node("span", "vod-name", name),
    vodTitle(entry),
    node("span", "vod-ago", agoLabel(entry.endedAt)),
  );
  info.append(avatar, text);

  card.append(thumb, info);
  if (entry.vodUrl) item.append(createWatchLaterButton(entry));
  const markSeen = (variants) => variants
    .filter((variant) => !variant.seen)
    .forEach((variant) => chrome.runtime.sendMessage({ type: "markHistorySeen", id: variant.id }).catch?.(() => {}));
  card.addEventListener("click", () => {
    openTab(entry.vodUrl);
    markSeen(entry.variants);
  });
  item.append(card);

  // Compte relié sur deux plateformes : une seule carte, un lien par rediffusion.
  if (entry.variants.length > 1) {
    const platforms = node("span", "vod-platforms");
    entry.variants.forEach((variant) => {
      const chip = node("button", `vod-platform plat-${variant.platform}`);
      chip.type = "button";
      const logo = node("img");
      logo.alt = "";
      logo.src = chrome.runtime.getURL(getPlatformIcon(variant.platform));
      chip.append(logo);
      chip.title = t(getPlatformLabelKey(variant.platform));
      chip.setAttribute("aria-label", t("popup.history.watchVod", { name: `${name} · ${chip.title}` }));
      chip.addEventListener("click", () => {
        openTab(variant.vodUrl);
        markSeen([variant]);
      });
      platforms.append(chip);
    });
    item.append(platforms);
  }

  // Suppression directe : un « X » discret sur la carte, sans ouvrir le VOD.
  const dismiss = node("button", "vod-dismiss");
  dismiss.type = "button";
  dismiss.setAttribute("aria-label", t("popup.history.dismiss", { name }));
  dismiss.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  dismiss.addEventListener("click", (event) => {
    event.stopPropagation();
    event.preventDefault();
    chrome.runtime
      .sendMessage({ type: "removeHistoryEntry", id: entry.id })
      .catch?.(() => {});
    entry.ids.slice(1).forEach((id) => chrome.runtime.sendMessage({ type: "removeHistoryEntry", id }).catch?.(() => {}));
    item.remove();
    // Le compteur et l'état vide doivent se recalculer sans la carte retirée.
    renderHistory().catch(() => {});
  });
  item.append(dismiss);
  return item;
}

export async function renderHistory() {
  const grid = $("history-grid");
  if (!grid) return;
  const stored = await chrome.storage.local.get([HISTORY_KEY, LINKED_ACCOUNTS_KEY, "betaGeneralStreamers"]);
  const view = missedView(stored[HISTORY_KEY], { platform: historyPlatform });
  const roster = Array.isArray(stored.betaGeneralStreamers) ? stored.betaGeneralStreamers : [];
  const linked = normalizeLinkedAccounts(stored[LINKED_ACCOUNTS_KEY], roster);
  const missed = groupMissedEntries(view.entries, linked, roster);
  const stats = summarize(missed);

  $("history-count").textContent =
    stats.count === 1 ? t("popup.history.countSingular") : t("popup.history.countPlural", { count: stats.count });
  const sub = $("history-sub");
  sub.textContent = t("popup.history.summary", { duration: durationLabel(stats.totalSeconds) });
  sub.title = sub.textContent;

  grid.replaceChildren(...missed.map(createVodCard));
  grid.hidden = missed.length === 0;
  $("history-empty").hidden = missed.length !== 0;
  const emptyTitle = $("history-empty")?.querySelector(".history-empty-title");
  const emptyBody = $("history-empty")?.querySelector(".history-empty-body");
  if (emptyTitle && emptyBody && view.emptyReason) {
    emptyTitle.textContent = t(view.emptyReason === "filter" ? "popup.history.emptyFilterTitle" : "popup.history.emptyTitle");
    emptyBody.textContent = t(view.emptyReason === "filter" ? "popup.history.emptyFilterBody" : "popup.history.emptyBody");
  }
}

function initHistory() {
  const filter = $("history-filter");
  filter?.addEventListener("click", (event) => {
    const button = event.target.closest(".seg-btn");
    if (!button) return;
    historyPlatform = button.dataset.platform || "all";
    filter.querySelectorAll(".seg-btn").forEach((b) => {
      const active = b === button;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    renderHistory().catch(() => {});
  });
}

// ─── StreamPulse+ ──────────────────────────────────────────────────────────────

let plusRecord = null;
let selectedPlan = "yearly";
const PROMO_KEY = "streamPulsePromo";
const PROMO_FREQ_MS = 20 * 60 * 60 * 1000; // une fois par jour au plus
const PROMO_MIN_OPENS = 3; // pas avant la 3e ouverture éligible
let promoFreqMs = PROMO_FREQ_MS; // pilotable : config.promo.freqHours (distant)
let promoState = { plusClosed: false, clipsClosed: false, opens: 0, lastShownAt: 0 };
let promoDue = false;
let promoSuccess = false;
let promoPlusOk = false;
let promoClipsOk = false;
let promoRemoteOff = false;
let promoHasDrops = false;
let promoHasWatch = false;
const PLAN_LABELS = { monthly: "popup.plus.planMonthly", yearly: "popup.plus.planYearly", lifetime: "popup.plus.planLifetime", trial: "popup.plus.planTrial" };
const plusListeners = new Set();

/** Rappelé à chaque changement d'état de la licence. */
export function onPlusChange(listener) {
  plusListeners.add(listener);
}

export function plusActive() {
  return isPlusActive(plusRecord);
}

const DAY_MS = 86_400_000;
// En attente tant que le stockage n'est pas lu : le bandeau d'offre ne clignote pas.
let trialState = { ...trialStateFrom(null), pending: true };

/** Boutons « Essayer 7 jours gratuitement » : sans licence, tant que l'essai n'a jamais servi ici. */
function renderTrialOffer() {
  const eligible = !plusActive() && !trialState.used && !trialState.pending;
  for (const button of document.querySelectorAll(".trial-start, .trial-note")) button.hidden = !eligible;
  // Bandeau du haut : l'essai se propose, il ne démarre jamais sans ce clic.
  const strip = $("trial-offer-strip");
  if (strip) strip.hidden = !eligible;
  document.body.classList.toggle("has-trial", eligible || (plusRecord?.plan === "trial" && (plusActive() || trialPaused(plusRecord))));
  // Avec l'essai proposé, l'écran des alertes manquées garde un seul bouton.
  for (const buy of document.querySelectorAll(".missed-lcd-buy")) buy.hidden = eligible;
}

async function startTrialFromButton(event) {
  const button = event.currentTarget;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try {
    const response = await chrome.runtime.sendMessage({ type: "startTrial" });
    // « started » : la licence d'essai arrive par le stockage et rafraîchit tout le popup.
    if (response?.result === "started") {
      celebrateTrial({ line: t("popup.trial.unlockedLine"), big: t("popup.trial.offerBadge"), caption: t("popup.trial.unlockedCaption") })
        .then(() => $("trial-strip")?.classList.add("is-fresh"));
    }
    if (response?.result === "refused") openPlus();
  } catch (error) {
    console.warn("[plus] essai indisponible :", error?.message || error);
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}

/** Bandeau LCD de l'essai StreamPulse+ : jours restants et bouton S'abonner. */
function renderTrialStrip(trial) {
  const strip = $("trial-strip");
  if (!strip) return;
  strip.hidden = !trial;
  if (!trial) return;
  const days = Math.max(1, Math.ceil((trialEndsAt(plusRecord) - Date.now()) / DAY_MS));
  $("trial-days").textContent = t("popup.trial.days", { days });
  // Essai lié à un autre compte Twitch : les récupérations sont en pause, on le dit.
  const otherAccount = trialPaused(plusRecord);
  const body = strip.querySelector(".trial-body");
  // La clé data-i18n suit le texte : un changement de langue garde le bon message.
  if (body) {
    body.dataset.i18n = otherAccount ? "popup.trial.otherAccount" : "popup.trial.body";
    body.textContent = t(body.dataset.i18n);
  }
  // Les deux derniers jours, l'écran passe en alerte.
  strip.classList.toggle("is-ending", days <= 2);
}

function renderPlus() {
  const active = plusActive();
  const deviceLimited = plusRecord?.status === "device_limited";
  const openButton = $("open-plus");
  openButton?.classList.toggle("is-active", active);
  // Sans abonnement, le bouton + brille tant que le popup est ouvert.
  openButton?.classList.toggle("has-attention", !active);
  // Le pill de la barre change d'infobulle avec l'état : l'abonnement se
  // découvre ou se gère, et le lecteur d'écran entend la bonne action.
  if (openButton) {
    const hint = t(active ? "popup.plus.openActive" : "popup.plus.open");
    openButton.title = hint;
    openButton.setAttribute("aria-label", hint);
  }
  // Pendant l'essai, l'offre reste visible : c'est le moment de s'abonner.
  // Essai en cours, même en pause sur un autre compte Twitch : le bandeau reste.
  const trial = plusRecord?.plan === "trial" && (active || trialPaused(plusRecord));
  if ($("plus-offer")) $("plus-offer").hidden = (active && !trial) || deviceLimited;
  if ($("plus-device-limited")) $("plus-device-limited").hidden = !deviceLimited;
  if ($("plus-active")) $("plus-active").hidden = !active;
  if (active && $("plus-active-plan")) {
    const key = plusRecord.licenseKey.replace(/^(SP-[A-Z0-9]{4}).*(.{4})$/, "$1-…-$2");
    const date = new Date(trialEndsAt(plusRecord)).toLocaleDateString(getCurrentLanguage(), { day: "numeric", month: "long" });
    $("plus-active-plan").textContent = t(
      PLAN_LABELS[plusRecord.plan] || PLAN_LABELS.monthly,
      { key, date },
    );
  }
  if ($("plus-menu-text")) $("plus-menu-text").textContent = t(active ? "popup.plusMenu.statusActive" : "popup.plusMenu.statusInactive");
  if ($("plus-menu-open")) $("plus-menu-open").textContent = t(active ? "popup.plusMenu.manage" : "popup.plusMenu.discover");
  renderTrialStrip(trial);
  renderTrialOffer();
  renderPromo();
  renderPlusValue().catch(() => {});
  plusListeners.forEach((listener) => listener(active));
}

/**
 * La carte au-dessus de la barre d'ajout : l'essai StreamPulse+ d'abord (hors
 * abonnement), puis StreamPulse Clips — produit séparé, pour tous. Elle se
 * mérite : jamais aux nouvelles installations, au plus une fois par jour, et
 * chaque fermeture est gardée en storage.
 */
function renderPromo() {
  const showPlus = promoDue && promoPlusOk && !plusActive() && !promoState.plusClosed;
  const showClips = promoDue && promoClipsOk && !showPlus && !promoState.clipsClosed;
  const plus = $("promo-plus");
  const clips = $("promo-clips");
  if (plus) plus.hidden = !showPlus;
  if (clips) clips.hidden = !showClips;
  const container = $("promo-float");
  if (container) container.hidden = !showPlus && !showClips;
  if (showClips) ensureClipsMetal();
}

/**
 * Décide (une fois par ouverture) si la carte est due. Il faut avoir été
 * servi : au moins un streamer suivi ET une activité récente (visionnage ou
 * points des 2 derniers jours). Une installation toute fraîche n'est donc
 * jamais exposée à la promo. Puis : trois ouvertures éligibles avant la
 * première carte, une seule par jour, la demande d'avis passe devant elle,
 * et l'interrupteur distant (config.promo.enabled) peut tout couper.
 * Contextuel : Plus vise ceux qui ont de l'activité Drops, Clips ceux qui
 * ont de l'historique de visionnage (les futurs clippeurs).
 */
function decidePromoDue() {
  const activated = Array.isArray(smartStreamers) && smartStreamers.length > 0;
  if (!activated || !promoSuccess) return false;
  if (reviewAskDecision().due) return false; // la demande d'avis gagne la place
  if (promoRemoteOff) return false; // coupe-circuit piloté depuis streampulse.tech
  promoPlusOk = promoHasDrops;   // Plus vise ceux qui vivent des Drops
  promoClipsOk = promoHasWatch;  // Clips vise ceux qui regardent (futurs clippeurs)
  if (!promoPlusOk && !promoClipsOk) return false;
  promoState.opens = (promoState.opens || 0) + 1;
  const seenEnough = promoState.opens >= PROMO_MIN_OPENS;
  const cooled = Date.now() - (promoState.lastShownAt || 0) >= promoFreqMs;
  const due = seenEnough && cooled;
  if (due) promoState.lastShownAt = Date.now();
  chrome.storage.local.set({ [PROMO_KEY]: promoState }).catch((error) => console.warn("[popup] promo :", error?.message || error));
  return due;
}

/** Le bouton métal ne se monte que lorsque la carte est montrée : un canvas
 *  WebGL monté dans un conteneur masqué naît avec une taille nulle. */
let clipsMetalMounted = false;
function ensureClipsMetal() {
  const host = $("promo-clips-cta");
  if (host && !clipsMetalMounted) {
    clipsMetalMounted = true;
    mountLiquidMetalButton(host, {
      label: t("changelog.clipsCtaShort"),
      onClick: () => window.open("https://spclips.com/app?utm_source=streampulse&utm_medium=extension&utm_campaign=popup", "_blank", "noopener"),
    });
  }
  mountClipsMorph($("clips-morph"));
}

/**
 * Compteur de valeur : ce que les fonctions auto de Plus ont rapporté, badges
 * farmés et Drops récupérés (js/sw/plus-value.js tient le compte). Masqué tant
 * que rien n'a été gagné : un « 0 » n'encourage personne.
 */
async function renderPlusValue() {
  const target = $("plus-value");
  if (!target || !plusActive()) return;
  const { badges, drops } = plusValueFrom(await chrome.storage.local.get(PLUS_VALUE_KEY));
  if (badges + drops <= 0) {
    target.hidden = true;
    return;
  }
  const key = badges === 1 && drops === 1
    ? "popup.plus.valueBothOne"
    : badges === 1
      ? "popup.plus.valueBadgeOne"
      : drops === 1
        ? "popup.plus.valueDropOne"
        : "popup.plus.value";
  target.textContent = t(key, { badges, drops });
  target.hidden = false;
}

// Vue Plus = vraie modale : le reste du popup devient inerte, Tab boucle
// dans la vue et le focus revient à l'élément qui l'a ouverte.
const PLUS_FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
let plusOpener = null;

function setBackgroundInert(view, inert) {
  Array.from(document.body.children).forEach((child) => {
    if (
      child === view ||
      child.id === "toast-container" ||
      child.tagName === "SCRIPT" ||
      child.classList.contains("topbar") ||
      child.tagName === "HEADER"
    ) return;
    child.inert = inert;
  });
}

function trapPlusFocus(event) {
  const view = $("plus-view");
  if (event.key !== "Tab" || !view) return;
  const focusable = [...view.querySelectorAll(PLUS_FOCUSABLE)].filter((el) => el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const outside = !view.contains(document.activeElement) || document.activeElement === view;
  if (event.shiftKey && (document.activeElement === first || outside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || outside)) {
    event.preventDefault();
    first.focus();
  }
}

export function openPlus() {
  const view = $("plus-view");
  if (!view) return;
  if (!view.classList.contains("hidden")) {
    closePlus();
    return;
  }
  const active = document.activeElement;
  plusOpener = active && active !== document.body && !view.contains(active) ? active : null;
  view.classList.remove("hidden");
  setBackgroundInert(view, true);
  view.tabIndex = -1;
  view.focus({ preventScroll: true });
}

export function closePlus({ restoreFocus = true } = {}) {
  const view = $("plus-view");
  if (!view || view.classList.contains("hidden")) return;
  view.classList.add("hidden");
  setBackgroundInert(view, false);
  const target = plusOpener?.isConnected && plusOpener.offsetParent !== null ? plusOpener : $("open-plus");
  plusOpener = null;
  if (restoreFocus) target?.focus();
}

function showKeyError(key) {
  const error = $("plus-key-error");
  if (!error) return;
  error.textContent = key ? t(key) : "";
  error.hidden = !key;
}

function initPlus() {
  initLocalPrices().catch((error) => console.warn("[plus] prix locaux indisponibles :", error));
  $("open-plus")?.addEventListener("click", openPlus);
  $("trial-subscribe")?.addEventListener("click", openPlus);
  // Mode développeur (extension non empaquetée) : remettre l'essai à zéro pour le retester.
  const devReset = $("trial-dev-reset");
  if (devReset && !chrome.runtime.getManifest().update_url) {
    devReset.hidden = false;
    devReset.addEventListener("click", async () => {
      devReset.disabled = true;
      try {
        const response = await chrome.runtime.sendMessage({ type: "devResetTrial" });
        if (response?.reset) location.reload();
      } catch (error) {
        console.warn("[plus] réinitialisation de l'essai :", error?.message || error);
      } finally {
        devReset.disabled = false;
      }
    });
  }
  for (const button of document.querySelectorAll(".trial-start")) button.addEventListener("click", startTrialFromButton);
  // Popup ouvert : le rappel de l'essai par notification n'a pas lieu d'être.
  chrome.storage.local.set({ [POPUP_SEEN_KEY]: Date.now() }).catch(() => {});
  Promise.all([chrome.storage.local.get(TRIAL_STATE_KEY), trialTakenOnAccount(chrome.storage.sync)]).then(([stored, takenOnAccount]) => {
    // Essai déjà pris sur ce compte Google (autre ordinateur, réinstallation) : pas de bouton.
    const state = trialStateFrom(stored[TRIAL_STATE_KEY]);
    trialState = takenOnAccount ? { ...state, used: true } : state;
    renderPlus();
  }).catch(() => {});
  $("plus-close")?.addEventListener("click", () => closePlus());
  $("plus-menu-open")?.addEventListener("click", openPlus);
  $("plus-menu-recap")?.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("html/recap.html") }, () => window.close());
  });
  $("plus-view")?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePlus();
    else trapPlusFocus(event);
  });

  const plans = document.querySelectorAll(".plus-plan");
  const updateOfferUi = () => {
    const checkout = $("plus-checkout");
    const trustMain = $("plus-trust-main-text");
    if (selectedPlan === "monthly") {
      if (checkout) checkout.textContent = t("popup.plus.checkoutTrial");
      if (trustMain) trustMain.textContent = t("popup.plus.trustTrial");
    } else {
      if (checkout) checkout.textContent = t("popup.plus.checkoutYearly");
      if (trustMain) trustMain.textContent = t("popup.plus.trustYearly");
    }
  };
  const selectPlan = (plan) => {
    selectedPlan = plan.dataset.plan;
    plans.forEach((other) => {
      const on = other === plan;
      other.classList.toggle("active", on);
      other.setAttribute("aria-checked", String(on));
    });
    updateOfferUi();
  };
  plans.forEach((plan) => plan.addEventListener("click", () => selectPlan(plan)));
  updateOfferUi();
  // Motif radiogroup ARIA : les flèches déplacent la sélection (et le focus),
  // les deux boutons ne restent pas tous deux dans l'ordre de tabulation.
  document.querySelector(".plus-plans")?.addEventListener("keydown", (event) => {
    const list = Array.from(plans);
    const index = list.indexOf(document.activeElement);
    if (index === -1) return;
    const targets = {
      ArrowRight: list[(index + 1) % list.length],
      ArrowDown: list[(index + 1) % list.length],
      ArrowLeft: list[(index - 1 + list.length) % list.length],
      ArrowUp: list[(index - 1 + list.length) % list.length],
    };
    const next = targets[event.key];
    if (!next) return;
    event.preventDefault();
    selectPlan(next);
    next.focus();
  });
  plans.forEach((plan) => {
    plan.tabIndex = plan.classList.contains("active") ? 0 : -1;
  });

  $("plus-checkout")?.addEventListener("click", () => {
    const creator = $("plus-creator-input")?.value?.trim() || "";
    openTab(plusPageUrl(getCurrentLanguage(), selectedPlan, creator));
  });

  $("plus-key-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = $("plus-key-input");
    const button = $("plus-key-activate");
    if (!normalizeLicenseKey(input.value)) {
      showKeyError("popup.plus.errorFormat");
      input.focus();
      return;
    }
    showKeyError(null);
    button.disabled = true;
    button.textContent = t("popup.plus.activating");
    try {
      // Vérifié depuis le popup : l'activation ne dépend pas d'un service
      // worker encore sur une ancienne version après une mise à jour.
      const result = await verifyLicense(input.value, fetch, Date.now(), await getDeviceId(chrome.storage.local));
      if (result.ok) {
        await chrome.storage.local.set({ [PLUS_KEY]: result.record });
        plusRecord = result.record;
        input.value = "";
        renderPlus();
        thankPlusSubscriber(result.record.licenseKey, t).catch(() => {});
        chrome.runtime.sendMessage({ type: "refreshStatuses" }).catch?.(() => {});
        // Première activation : onboarding StreamPulse+ (fonctions et réglages
        // dédiés). Le service worker ne l'ouvre qu'une seule fois.
        chrome.runtime.sendMessage({ type: "openPlusOnboarding" }).catch?.(() => {});
      } else {
        const errors = {
          format: "popup.plus.errorFormat",
          invalid: "popup.plus.errorInvalid",
          device_limit: "popup.plus.errorDevices",
        };
        showKeyError(errors[result?.error] || "popup.plus.errorNetwork");
      }
    } catch {
      showKeyError("popup.plus.errorNetwork");
    } finally {
      button.disabled = false;
      button.textContent = t("popup.plus.activate");
    }
  });

  $("plus-manage")?.addEventListener("click", async () => {
    const button = $("plus-manage");
    const error = $("plus-manage-error");
    if (!plusRecord?.licenseKey || !button) return;
    button.disabled = true;
    if (error) error.hidden = true;
    try {
      const portal = await portalUrl(plusRecord.licenseKey, fetch, await getDeviceId(chrome.storage.local));
      if (portal?.url) {
        openTab(portal.url);
        return;
      }
      if (portal?.emailed) {
        if (error) {
          error.textContent = t("popup.plus.manageEmailed");
          error.hidden = false;
        }
        return;
      }
      throw new Error("no_portal");
    } catch {
      if (error) {
        error.textContent = t("popup.plus.manageError");
        error.hidden = false;
      }
    } finally {
      button.disabled = false;
    }
  });

  // Limite d'appareils atteinte : même portail, depuis le bandeau dédié.
  $("plus-manage-devices")?.addEventListener("click", async () => {
    const button = $("plus-manage-devices");
    const error = $("plus-manage-devices-error");
    if (!plusRecord?.licenseKey || !button) return;
    button.disabled = true;
    if (error) error.hidden = true;
    try {
      const portal = await portalUrl(plusRecord.licenseKey, fetch, await getDeviceId(chrome.storage.local));
      if (portal?.url) {
        openTab(portal.url);
        return;
      }
      if (portal?.emailed) {
        if (error) {
          error.textContent = t("popup.plus.manageEmailed");
          error.hidden = false;
        }
        return;
      }
      throw new Error("no_portal");
    } catch {
      if (error) {
        error.textContent = t("popup.plus.manageError");
        error.hidden = false;
      }
    } finally {
      button.disabled = false;
    }
  });

  $("plus-deactivate")?.addEventListener("click", async () => {
    // Directement dans le stockage, comme l'activation : le service worker
    // n'a pas besoin d'être à jour pour que le bouton marche.
    const licenseKey = plusRecord?.licenseKey;
    await chrome.storage.local.remove(PLUS_KEY);
    // eslint-disable-next-line require-atomic-updates -- la dernière vérification fait foi.
    plusRecord = null;
    renderPlus();
    releaseDevice(licenseKey, await getDeviceId(chrome.storage.local), fetch);
    chrome.runtime.sendMessage({ type: "refreshStatuses" }).catch?.(() => {});
  });
}

// ─── Alertes intelligentes ─────────────────────────────────────────────────────

let smartStreamers = [];
let smartRules = {};
let smartSelectedId = null;
let saveTimer = 0;

function saveRules({ immediate = false } = {}) {
  clearTimeout(saveTimer);
  const write = () => chrome.storage.local.set({ [SMART_ALERTS_KEY]: normalizeRules(smartRules) });
  if (immediate) write();
  else saveTimer = setTimeout(write, 350);
}

function rulesOf(id) {
  return smartRules[id] || [];
}

function renderSmartStreamers() {
  const list = $("smart-streamers");
  if (!list) return;
  list.replaceChildren(
    ...smartStreamers.map((streamer) => {
      const item = node("li");
      const button = node("button", "smart-streamer");
      button.type = "button";
      button.setAttribute("aria-selected", String(streamer.id === smartSelectedId));
      const avatar = node("img");
      avatar.alt = "";
      if (streamer.avatarUrl) avatar.src = streamer.avatarUrl;
      const active = rulesOf(streamer.id).filter((rule) => rule.enabled).length;
      button.append(
        avatar,
        node("span", "smart-name", streamer.displayName || streamer.handle),
        node(
          "span",
          "smart-count",
          active === 0 ? "" : String(active),
        ),
      );
      if (active) button.title = active === 1 ? t("popup.smart.ruleCountSingular") : t("popup.smart.ruleCountPlural", { count: active });
      button.addEventListener("click", () => {
        smartSelectedId = streamer.id;
        renderSmart();
      });
      item.append(button);
      return item;
    }),
  );
}

function termLine(rule, field, labelKey, anyKey, placeholderKey) {
  const line = node("div", "smart-line");
  const terms = node("div", "smart-terms");
  if (!rule[field].length) terms.append(node("span", "smart-any", t(anyKey)));
  rule[field].forEach((term) => {
    const chip = node("span", "smart-term", term);
    const remove = node("button");
    remove.type = "button";
    remove.innerHTML = CLOSE_ICON;
    remove.setAttribute("aria-label", t("popup.smart.removeTerm", { term }));
    remove.addEventListener("click", () => {
      rule[field] = rule[field].filter((value) => value !== term);
      saveRules({ immediate: true });
      renderSmartRules();
    });
    chip.append(remove);
    terms.append(chip);
  });
  if (rule[field].length < MAX_TERMS_PER_RULE) {
    const add = node("input", "smart-add");
    add.type = "text";
    add.placeholder = t(placeholderKey);
    add.setAttribute("aria-label", t(labelKey));
    add.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const value = add.value.trim();
      if (!value) return;
      rule[field] = normalizeRule({ ...rule, [field]: [...rule[field], value] })[field];
      saveRules({ immediate: true });
      renderSmartRules();
      $("smart-rules")?.querySelector(`[data-rule="${rule.id}"] .smart-add[data-field="${field}"]`)?.focus();
    });
    add.dataset.field = field;
    terms.append(add);
  }
  line.append(node("span", null, t(labelKey)), terms);
  return line;
}

function createRuleCard(rule, streamerId) {
  const card = node("div", `smart-rule${rule.enabled ? "" : " is-off"}`);
  card.dataset.rule = rule.id;

  const top = node("div", "smart-rule-top");
  const name = node("input", "text-input");
  name.type = "text";
  name.value = rule.name;
  name.placeholder = t("popup.smart.ruleNamePlaceholder");
  name.setAttribute("aria-label", t("popup.smart.ruleName"));
  name.addEventListener("input", () => {
    rule.name = name.value.slice(0, 60);
    saveRules();
  });

  const toggle = node("input");
  toggle.type = "checkbox";
  toggle.setAttribute("role", "switch");
  toggle.checked = rule.enabled;
  toggle.setAttribute("aria-label", t("popup.smart.enableRule"));
  toggle.addEventListener("change", () => {
    rule.enabled = toggle.checked;
    card.classList.toggle("is-off", !rule.enabled);
    saveRules({ immediate: true });
    renderSmartStreamers();
  });

  const remove = node("button", "icon-button");
  remove.type = "button";
  remove.innerHTML = TRASH_ICON;
  remove.setAttribute("aria-label", t("popup.smart.deleteRule"));
  remove.title = t("popup.smart.deleteRule");
  remove.addEventListener("click", () => {
    smartRules[streamerId] = rulesOf(streamerId).filter((item) => item.id !== rule.id);
    if (!smartRules[streamerId].length) delete smartRules[streamerId];
    saveRules({ immediate: true });
    renderSmart();
  });
  top.append(name, toggle, remove);

  const viewersLine = node("div", "smart-line");
  const viewers = node("input", "text-input smart-viewers");
  viewers.type = "number";
  viewers.min = "0";
  viewers.step = "100";
  viewers.inputMode = "numeric";
  viewers.value = rule.minViewers ? String(rule.minViewers) : "";
  viewers.placeholder = "0";
  viewers.setAttribute("aria-label", t("popup.smart.viewersLine"));
  viewers.addEventListener("input", () => {
    rule.minViewers = Math.max(0, Math.floor(Number(viewers.value) || 0));
    saveRules();
  });
  viewersLine.append(node("span", null, t("popup.smart.viewersLine")), viewers);

  card.append(
    top,
    termLine(rule, "games", "popup.smart.gameLine", "popup.smart.anyGame", "popup.smart.gamePlaceholder"),
    termLine(rule, "keywords", "popup.smart.keywordLine", "popup.smart.anyKeyword", "popup.smart.keywordPlaceholder"),
    viewersLine,
  );
  return card;
}

function renderSmartRules() {
  const host = $("smart-rules");
  if (!host) return;
  const streamer = smartStreamers.find((item) => item.id === smartSelectedId);
  if (!streamer) {
    host.replaceChildren(node("p", "smart-empty", t("popup.smart.noStreamers")));
    return;
  }
  const rules = rulesOf(streamer.id);
  const head = node("div", "smart-rules-head");
  const add = node("button", "button button-primary");
  add.type = "button";
  add.innerHTML = PLUS_ICON;
  add.append(document.createTextNode(t("popup.smart.addRule")));
  add.disabled = rules.length >= MAX_RULES_PER_STREAMER;
  add.addEventListener("click", () => {
    smartRules[streamer.id] = [...rules, normalizeRule({})];
    saveRules({ immediate: true });
    renderSmart();
    host.querySelector(".smart-rule:last-child .text-input")?.focus();
  });
  head.append(node("b", null, t("popup.smart.rulesFor", { name: streamer.displayName || streamer.handle })), add);

  const children = [head];
  if (rules.some((rule) => rule.enabled)) {
    children.push(node("p", "smart-replaces", t("popup.smart.replacesStreamer", { name: streamer.displayName || streamer.handle })));
  }
  if (!rules.length) children.push(node("p", "smart-empty", t("popup.smart.noRules")));
  rules.forEach((rule) => children.push(createRuleCard(rule, streamer.id)));
  host.replaceChildren(...children);
}

function renderSmart() {
  const active = plusActive();
  if ($("smart-locked")) $("smart-locked").hidden = active;
  if ($("smart-editor")) $("smart-editor").hidden = !active;
  if (!active) return;
  if (!smartStreamers.some((item) => item.id === smartSelectedId)) smartSelectedId = smartStreamers[0]?.id || null;
  renderSmartStreamers();
  renderSmartRules();
}

/**
 * Le téléchargement des clips est un avantage StreamPulse+ : sans licence,
 * l'activer ouvre l'écran d'abonnement. Écouté en capture, avant popup.js.
 */
function initClipDownloadLock() {
  document.addEventListener(
    "change",
    (event) => {
      const toggle = event.target;
      if (toggle?.id !== "pref-clip-download" || !toggle.checked || plusActive()) return;
      event.stopImmediatePropagation();
      toggle.checked = false;
      openPlus();
    },
    true,
  );
}

// ─── Prédictions assistées (StreamPulse+) ────────────────────────────────────

let predictionRule = normalizePredictionRule(null);
let predictionHistory = [];

function savePredictionRule() {
  predictionRule = normalizePredictionRule(predictionRule);
  chrome.storage.local.set({ [PREDICTION_RULE_KEY]: predictionRule });
}

function formatPoints(value) {
  return new Intl.NumberFormat(getCurrentLanguage()).format(Math.round(value));
}

function predictionResult(bet) {
  const labels = {
    won: `+${formatPoints(bet.payout - bet.points)}`,
    lost: `−${formatPoints(bet.points)}`,
    refunded: t("popup.pred.refunded"),
    pending: t("popup.pred.pending"),
    unknown: t("popup.pred.unknown"),
    failed: t("popup.pred.failed"),
  };
  const chip = node("span", `pred-result is-${bet.status}`, labels[bet.status] || "");
  if (bet.status === "failed" && bet.error) chip.title = bet.error;
  return chip;
}

function renderPredictions() {
  const active = plusActive();
  if ($("pred-locked")) $("pred-locked").hidden = active;
  if ($("pred-editor")) $("pred-editor").hidden = !active;
  if (!active) return;

  if ($("pred-enabled")) $("pred-enabled").checked = predictionRule.enabled;
  if ($("pred-strategy")) $("pred-strategy").value = predictionRule.strategy;
  const fields = { "pred-percent": "percent", "pred-max": "maxPoints", "pred-reserve": "reserve" };
  Object.entries(fields).forEach(([id, field]) => {
    const input = $(id);
    if (input && document.activeElement !== input) input.value = String(predictionRule[field]);
  });

  const stats = summarizePredictions(predictionHistory);
  if ($("pred-stat-bets")) $("pred-stat-bets").textContent = formatPoints(stats.bets);
  if ($("pred-stat-rate")) $("pred-stat-rate").textContent = stats.rate === null ? "–" : `${Math.round(stats.rate * 100)} %`;
  if ($("pred-stat-net")) $("pred-stat-net").textContent = `${stats.net > 0 ? "+" : stats.net < 0 ? "−" : ""}${formatPoints(Math.abs(stats.net))}`;

  const list = $("pred-history");
  if (!list) return;
  const recent = predictionHistory.slice(0, 6);
  if (!recent.length) {
    list.replaceChildren(node("li", "pred-empty", t("popup.pred.empty")));
    return;
  }
  list.replaceChildren(
    ...recent.map((bet) => {
      const item = node("li", "pred-bet");
      item.append(
        node("b", null, bet.title || "—"),
        node("small", null, t("popup.pred.betLine", { outcome: bet.outcomeTitle || "—", points: formatPoints(bet.points), channel: bet.channel })),
        predictionResult(bet),
      );
      return item;
    }),
  );
}

function initPredictions() {
  $("pred-unlock")?.addEventListener("click", openPlus);
  $("pred-enabled")?.addEventListener("change", (event) => {
    predictionRule = { ...predictionRule, enabled: event.target.checked };
    savePredictionRule();
  });
  $("pred-strategy")?.addEventListener("change", (event) => {
    predictionRule = { ...predictionRule, strategy: event.target.value };
    savePredictionRule();
  });
  const fields = { "pred-percent": "percent", "pred-max": "maxPoints", "pred-reserve": "reserve" };
  Object.entries(fields).forEach(([id, field]) => {
    $(id)?.addEventListener("change", (event) => {
      predictionRule = { ...predictionRule, [field]: event.target.value };
      savePredictionRule();
      renderPredictions();
    });
  });
  plusListeners.add(() => renderPredictions());
}

function initSmartAlerts() {
  $("smart-unlock")?.addEventListener("click", openPlus);
  plusListeners.add(() => renderSmart());
}

/**
 * À l'ouverture du popup, revérifie la licence si le dernier contrôle date de
 * plus de 5 minutes : un client supprimé ou un abonnement résilié perd l'accès
 * dès la prochaine ouverture, sans attendre le contrôle quotidien.
 */
const OPEN_RECHECK_MS = 5 * 60 * 1000;

async function recheckOnOpen() {
  // device_limited reste contrôlé à chaque ouverture : dès qu'une place est
  // libérée dans le portail, ce navigateur se réactive tout seul.
  if (!plusRecord?.licenseKey || !["active", "device_limited", "unverified"].includes(plusRecord.status)) return;
  const now = Date.now();
  if (now - (Number(plusRecord.checkedAt || plusRecord.verifiedAt) || 0) < OPEN_RECHECK_MS) return;
  const result = await verifyLicense(plusRecord.licenseKey, fetch, now, await getDeviceId(chrome.storage.local));
  if (result.ok) {
    // eslint-disable-next-line require-atomic-updates -- la dernière vérification fait foi.
    plusRecord = { ...result.record, checkedAt: now };
    await chrome.storage.local.set({ [PLUS_KEY]: plusRecord });
  } else if (["invalid", "format"].includes(result.error)) {
    // eslint-disable-next-line require-atomic-updates -- la dernière vérification fait foi.
    plusRecord = null;
    await chrome.storage.local.remove(PLUS_KEY);
  } else if (result.error === "device_limit") {
    // La clé reste, avec un statut dédié : l'utilisateur voit POURQUOI c'est
    // verrouillé au lieu d'un « Débloquer » injustifié, et le portail peut
    // libérer une place. L'effacer ferait perdre la clé de ce navigateur.
    plusRecord = { ...plusRecord, status: "device_limited", checkedAt: now };
    await chrome.storage.local.set({ [PLUS_KEY]: plusRecord });
  } else {
    return;
  }
  renderPlus();
}

// ─── Initialisation ────────────────────────────────────────────────────────────

/** Bandeau quand Chrome bloque les notifications de l'extension. */
function initNotificationPermissionBanner() {
  const banner = $("notif-blocked");
  if (!banner || !chrome?.notifications?.getPermissionLevel) return;
  const check = () =>
    chrome.notifications.getPermissionLevel((level) => {
      banner.hidden = level !== "denied";
    });
  $("notif-blocked-open")?.addEventListener("click", () => {
    chrome.tabs.create({ url: `chrome://settings/content/siteDetails?site=chrome-extension://${chrome.runtime.id}` });
  });
  chrome.notifications.onPermissionLevelChanged?.addListener(check);
  check();
}

export async function initFeatures() {
  initNotificationPermissionBanner();
  initHistory();
  initPlus();
  initSmartAlerts();
  initClipDownloadLock();
  initPredictions();

  const stored = await chrome.storage.local.get([PLUS_KEY, PROMO_KEY, SMART_ALERTS_KEY, PREDICTION_RULE_KEY, PREDICTION_HISTORY_KEY, "betaGeneralStreamers", "streamPulseWatchTimeDaily", "streamPulsePointsDaily", "streamPulseDropsProgress", REMOTE_CONFIG_CACHE_KEY, ...IDENTITY_STORAGE_KEYS]);
  plusRecord = stored[PLUS_KEY] || null;
  promoState = {
    plusClosed: stored[PROMO_KEY]?.plusClosed === true,
    clipsClosed: stored[PROMO_KEY]?.clipsClosed === true,
    opens: stored[PROMO_KEY]?.opens || 0,
    lastShownAt: stored[PROMO_KEY]?.lastShownAt || 0,
  };
  // Même règle que la demande d'avis : la promo ne se montre qu'à quelqu'un à
  // qui l'extension a déjà rendu service — du visionnage ou des points dans
  // les 2 derniers jours (tables quotidiennes locales, jamais renvoyées).
  promoSuccess = hasRecentSuccess([stored.streamPulseWatchTimeDaily, stored.streamPulsePointsDaily]);
  // Ciblage contextuel : Drops vécus → la carte Plus parle à la bonne personne ;
  // de l'historique de visionnage → la carte Clips (les futurs clippeurs).
  promoHasDrops = Object.keys(stored.streamPulseDropsProgress || {}).length > 0;
  promoHasWatch = Object.keys(stored.streamPulseWatchTimeDaily || {}).length > 0;
  // Coupe-circuit distant : config.promo.enabled = false coupe tout, sans republier.
  promoRemoteOff = stored[REMOTE_CONFIG_CACHE_KEY]?.data?.promo?.enabled === false;
  // Fréquence distante en heures (config.promo.freqHours) : l'ajustement est
  // effectif au prochain réveil du service worker, sans republier.
  const freqHours = Number(stored[REMOTE_CONFIG_CACHE_KEY]?.data?.promo?.freqHours);
  promoFreqMs = freqHours > 0 ? freqHours * 60 * 60 * 1000 : PROMO_FREQ_MS;
  plusListeners.add(() => renderIdentity());
  initIdentity({ getRecord: () => plusRecord, isPlus: plusActive, openPlus, stored });
  predictionRule = normalizePredictionRule(stored[PREDICTION_RULE_KEY]);
  predictionHistory = Array.isArray(stored[PREDICTION_HISTORY_KEY]) ? stored[PREDICTION_HISTORY_KEY] : [];
  recheckOnOpen().catch(() => {});
  smartRules = normalizeRules(stored[SMART_ALERTS_KEY]);
  smartStreamers = Array.isArray(stored.betaGeneralStreamers) ? stored.betaGeneralStreamers : [];
  promoDue = decidePromoDue();
  renderPlus();
  $("promo-plus-close")?.addEventListener("click", () => {
    promoState.plusClosed = true;
    renderPromo();
    chrome.storage.local.set({ [PROMO_KEY]: promoState }).catch((error) => console.warn("[popup] carte plus :", error?.message || error));
  });
  $("promo-plus-cta")?.addEventListener("click", openPlus);
  $("promo-clips-close")?.addEventListener("click", () => {
    promoState.clipsClosed = true;
    renderPromo();
    chrome.storage.local.set({ [PROMO_KEY]: promoState }).catch((error) => console.warn("[popup] carte clips :", error?.message || error));
  });
  initPoints({ isPlus: plusActive, onPlusChange: (listener) => plusListeners.add(listener), openPlus })
    .catch((error) => console.warn("[popup] points init failed:", error));
  // La carte parrainage passe après l'avis et le badge : une seule carte à la fois.
  Promise.all([initReviewAsk(), initBadgeAsk()])
    .catch((error) => console.warn("[popup] review/badge ask init failed:", error))
    .then(() => initReferralAsk())
    .catch((error) => console.warn("[popup] referral ask init failed:", error));
  initLayout().catch((error) => console.warn("[popup] layout init failed:", error));
  initDrops({ isPlus: plusActive, onPlusChange: (listener) => plusListeners.add(listener), openPlus })
    .catch((error) => console.warn("[popup] drops init failed:", error));

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[HISTORY_KEY] && !$("history-view")?.classList.contains("hidden")) {
      renderHistory().catch(() => {});
    }
    if (changes[PLUS_KEY]) {
      plusRecord = changes[PLUS_KEY].newValue || null;
      renderPlus();
    }
    if (changes[TRIAL_STATE_KEY]) {
      trialState = trialStateFrom(changes[TRIAL_STATE_KEY].newValue);
      renderTrialOffer();
    }
    if (changes[PLUS_VALUE_KEY]) renderPlusValue().catch(() => {});
    if (changes[PREDICTION_HISTORY_KEY]) {
      predictionHistory = changes[PREDICTION_HISTORY_KEY].newValue || [];
      renderPredictions();
    }
    if (changes.betaGeneralStreamers) {
      smartStreamers = changes.betaGeneralStreamers.newValue || [];
      renderSmart();
    }
  });
}
