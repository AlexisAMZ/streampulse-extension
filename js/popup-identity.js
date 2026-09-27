// Onglet « Pseudo et badge » et parrainage : effets StreamPulse+ du badge et du
// pseudo, rang (fondateur, ambassadeur) et code de parrainage. Le parrainage se
// montre à deux endroits : la rubrique StreamPulse+ des Réglages et l'écran
// StreamPulse+ (badge PLUS), avec un aperçu animé de chaque récompense.

import { t } from "./i18n.js";
import { LICENSE_VERIFY_URL, PLUS_KEY } from "./plus.js";
import { BADGE_FX, NAME_FX, TENURE_STYLES, TENURE_TIERS, fxLock, normalizeCosmetics, rankOf, tenureTier, visibleFx } from "./cosmetics-data.js";
import { isPaypalAddress, normalizeEarnings, shouldRefreshEarnings } from "./referral-data.js";

export const COSMETICS_KEY = "streamPulseCosmetics";
const REFERRAL_CODE_KEY = "streamPulseReferralCode";
const REFERRAL_EARNINGS_KEY = "streamPulseReferralEarnings";

/** Paliers du parrainage (mêmes seuils que le serveur) ; les deux premiers débloquent un effet. */
const REFERRAL_TIERS = [
  { count: 1, key: "popup.referral.tierName", fx: { kind: "name", value: "ambassador" } },
  { count: 3, key: "popup.referral.tierBadge", fx: { kind: "badge", value: "halo" } },
  { count: 5, key: "popup.referral.tierDevice" },
];

/** Aperçus de l'écran StreamPulse+ : un échantillon lisible de ce qu'on obtient. */
const SHOWCASE_NAMES = ["aurora", "gold", "fire", "rainbow"];

const $ = (id) => document.getElementById(id);

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

let deps = { getRecord: () => null, isPlus: () => false, openPlus: () => {} };
let cosmetics = { badgeFx: "", nameFx: "" };
let chatName = "";
let referralCode = "";
let earnings = null;

function access() {
  const record = deps.getRecord();
  return { plus: deps.isPlus(), role: record?.role || "", referrals: Math.max(0, Number(record?.referrals) || 0), plan: record?.plan || "", since: Number(record?.since) || 0 };
}

/** Paliers affichés, du premier mois à la licence à vie. */
const TENURE_LADDER = [...TENURE_TIERS.map(([, key]) => key).reverse(), "life"];

/** Une tuile d'ancienneté avec le logo : aperçu du popup et échelle des paliers. */
function tenureTile(tier, style = "gauge") {
  const tile = node("span", tileClass(tier, style));
  tile.append(node("span", "cosmetic-badge"));
  return tile;
}

function tileClass(tier, style) {
  return tier ? `cosmetic-tile sp-tier sp-tier--${style} sp-tier-${tier}` : "cosmetic-tile";
}

/** Échelle des paliers ; le sien est mis en avant quand StreamPulse+ est actif. */
function renderTenure(current, style) {
  const list = $("cosmetic-tenure");
  if (!list) return;
  const mine = current.plus ? tenureTier(current.plan, current.since) : "";
  list.replaceChildren(...TENURE_LADDER.map((tier) => {
    const item = node("li", `tenure-step${tier === mine ? " is-current" : ""}`);
    if (tier === mine) item.setAttribute("aria-current", "true");
    item.append(tenureTile(tier, style), node("span", "tenure-label", t(`popup.cosmetics.tier_${tier}`)));
    return item;
  }));
}

/** Rendu d'un effet : le pseudo (ou le texte donné) peint, ou le logo StreamPulse animé. */
function fxSample(kind, value, text) {
  if (kind === "name") {
    return node("b", `fx-sample-name${value ? ` sp-paint sp-paint--${value}` : ""}`, text || chatName || t("popup.cosmetics.sampleName"));
  }
  // « Ancienneté » (Jauge ou Pager) : la tuile de son palier (celle d'un an en exemple sans StreamPulse+).
  if (TENURE_STYLES[value]) return tenureTile(ownTier() || "y1", TENURE_STYLES[value]);
  return node("span", `cosmetic-badge${value ? ` sp-fx-${value}` : ""}`);
}

function ownTier() {
  const current = access();
  return current.plus ? tenureTier(current.plan, current.since) : "";
}

/**
 * Un aperçu cliquable par effet. Verrou : PLUS (sans licence), nombre d'amis
 * requis (effets d'ambassadeur). Les effets du fondateur ne sont montrés qu'à lui.
 */
function fxOption(kind, value, selected, current) {
  const lock = fxLock(value, current);
  const button = node("button", "fx-option");
  button.type = "button";
  button.setAttribute("role", "radio");
  button.setAttribute("aria-checked", String(value === selected));
  button.dataset.kind = kind;
  button.dataset.value = value;
  button.dataset.lock = lock;
  // Comme les « paints » de 7TV : le nom de la couleur est écrit avec la couleur
  // elle-même ; pour le logo, le logo déjà coloré puis son nom.
  const label = t(`popup.cosmetics.${value || "none"}`);
  button.append(node("span", "fx-radio"));
  if (kind === "name") button.append(fxSample("name", value, label));
  else button.append(fxSample("badge", value), node("span", "fx-label", label));
  if (lock === "referrals") {
    const needed = REFERRAL_TIERS.find((tier) => tier.fx?.value === value)?.count || 1;
    button.setAttribute("aria-disabled", "true");
    button.title = t("popup.referral.needed", { count: needed });
    button.append(node("span", "fx-lock", t("popup.referral.needed", { count: needed })));
  } else if (lock === "plus" && value) {
    button.append(node("span", "fx-plus", t("popup.plus.badge")));
  } else if (value === "crown" || value === "founder") {
    button.append(node("span", "fx-founder", "★"));
  }
  return button;
}

function renderRank(current) {
  const target = $("identity-rank");
  if (!target) return;
  const rank = current.plus ? rankOf(current) : "";
  target.hidden = !rank;
  target.className = `identity-rank${rank ? ` is-${rank}` : ""}`;
  if (rank === "founder") target.textContent = t("popup.identity.rankFounder");
  else if (rank === "ambassador") target.textContent = t("popup.identity.rankAmbassador", { count: current.referrals });
}

/** Couleurs proposées pour le logo : le nuancier commun puis les récompenses. */
const LOGO_FX = BADGE_FX.filter((value) => !TENURE_STYLES[value]);
const SHAPES = ["logo", "tenure", "pager"];
let lookTab = "badge";
// Dernière couleur de logo choisie : reprise quand on revient à la forme Logo.
let lastLogoFx = "";

const shapeOf = (badgeFx) => (TENURE_STYLES[badgeFx] ? badgeFx : "logo");

/** Trois cartes de forme : Logo (sa couleur), Jauge et Pager (son palier). */
function shapeCard(shape, selected, current) {
  const button = node("button", "look-shape");
  button.type = "button";
  button.setAttribute("role", "radio");
  button.setAttribute("aria-checked", String(shape === selected));
  button.dataset.shape = shape;
  button.dataset.lock = fxLock(shape === "logo" ? "" : shape, current);
  const art = node("span", "look-shape-art");
  const tier = ownTier() || "y1";
  art.append(shape === "logo" ? fxSample("badge", selected === "logo" ? cosmetics.badgeFx : lastLogoFx) : tenureTile(tier, TENURE_STYLES[shape]));
  const sub = shape === "logo" ? t("popup.cosmetics.shapeLogoSub") : t("popup.cosmetics.shapeTenureSub", { tier: t(`popup.cosmetics.tier_${tier}`) });
  button.append(art, node("b", null, t(`popup.cosmetics.shape_${shape}`)), node("small", null, sub));
  if (button.dataset.lock === "plus") button.append(node("span", "fx-plus", t("popup.plus.badge")));
  return button;
}

function renderLookTabs() {
  document.querySelectorAll(".look-tab").forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.look === lookTab)));
  if ($("look-badge")) $("look-badge").hidden = lookTab !== "badge";
  if ($("look-name")) $("look-name").hidden = lookTab !== "name";
}

function renderCosmetics() {
  const current = access();
  const shown = current.plus ? cosmetics : { badgeFx: "", nameFx: "" };
  const shape = shapeOf(shown.badgeFx);
  if (shape === "logo") lastLogoFx = shown.badgeFx;
  $("cosmetic-shape")?.replaceChildren(...SHAPES.map((value) => shapeCard(value, shape, current)));
  $("cosmetic-badge-fx")?.replaceChildren(...["", ...visibleFx(LOGO_FX, current)].map((value) => fxOption("badge", value, shape === "logo" ? shown.badgeFx : null, current)));
  $("cosmetic-name-fx")?.replaceChildren(...["", ...visibleFx(NAME_FX, current)].map((value) => fxOption("name", value, shown.nameFx, current)));
  if ($("cosmetic-logo-colors")) $("cosmetic-logo-colors").hidden = shape !== "logo";
  if ($("cosmetic-tenure-block")) $("cosmetic-tenure-block").hidden = shape === "logo";
  // Un seul badge : le logo coloré, ou la tuile d'ancienneté si elle est choisie.
  const style = TENURE_STYLES[shown.badgeFx] || "";
  const tier = style ? tenureTier(current.plan, current.since) : "";
  if ($("cosmetic-badge")) {
    $("cosmetic-badge").className = `cosmetic-badge${shown.badgeFx && !tier ? ` sp-fx-${shown.badgeFx}` : ""}`;
    $("cosmetic-badge").hidden = Boolean(tier);
  }
  if ($("cosmetic-tile")) $("cosmetic-tile").className = tileClass(tier, style);
  renderTenure(current, style || "gauge");
  if ($("cosmetic-name")) {
    $("cosmetic-name").className = `cosmetic-name${shown.nameFx ? ` sp-paint sp-paint--${shown.nameFx}` : ""}`;
    $("cosmetic-name").textContent = chatName || t("popup.cosmetics.sampleName");
  }
  renderLookTabs();
  renderRank(current);
}

function saveCosmetics(patch) {
  cosmetics = normalizeCosmetics({ ...cosmetics, ...patch });
  chrome.storage.local.set({ [COSMETICS_KEY]: cosmetics }).catch((error) => console.warn("[popup] effets :", error?.message || error));
  renderCosmetics();
}

function initCosmeticsPickers() {
  for (const id of ["cosmetic-name-fx", "cosmetic-badge-fx"]) {
    $(id)?.addEventListener("click", (event) => {
      const button = event.target.closest(".fx-option");
      if (!button) return;
      if (button.dataset.lock === "plus") {
        deps.openPlus();
        return;
      }
      if (button.dataset.lock) return;
      saveCosmetics({ [button.dataset.kind === "name" ? "nameFx" : "badgeFx"]: button.dataset.value });
    });
  }
  $("cosmetic-shape")?.addEventListener("click", (event) => {
    const button = event.target.closest(".look-shape");
    if (!button) return;
    if (button.dataset.lock === "plus") {
      deps.openPlus();
      return;
    }
    saveCosmetics({ badgeFx: button.dataset.shape === "logo" ? lastLogoFx : button.dataset.shape });
  });
  document.querySelectorAll(".look-tab").forEach((tab) => tab.addEventListener("click", () => {
    lookTab = tab.dataset.look;
    renderLookTabs();
  }));
}

// ─── Parrainage ───────────────────────────────────────────────────────────────

/** Paliers avec l'aperçu animé de l'effet débloqué, cochés quand ils sont atteints. */
function tierItems(count) {
  // Tuile « argent » en tête : c'est la récompense principale, pour chaque ami.
  const money = node("li", "referral-tier referral-tier--money");
  money.append(node("b", null, t("popup.referral.each")), node("span", null, t("popup.referral.tierMoney")));
  return [money, ...REFERRAL_TIERS.map((tier) => {
    const item = node("li", count >= tier.count ? "referral-tier is-done" : "referral-tier");
    item.append(node("b", null, t("popup.referral.friends", { count: tier.count })));
    if (tier.fx) {
      const preview = node("span", "referral-fx");
      // Le nom de l'effet, peint avec l'effet : l'aperçu dit à la fois quoi et comment.
      preview.append(fxSample(tier.fx.kind, tier.fx.value, t(`popup.cosmetics.${tier.fx.value}`)));
      if (tier.fx.kind === "badge") preview.append(node("span", "referral-fx-name", t(`popup.cosmetics.${tier.fx.value}`)));
      item.append(preview);
    }
    item.append(node("span", null, t(tier.key)));
    return item;
  })];
}

const euros = (cents) => new Intl.NumberFormat(document.documentElement.lang || undefined, { style: "currency", currency: "EUR" }).format(cents / 100);

/** Gains, seuil de versement et adresse PayPal (abonnés avec un code seulement). */
function renderEarnings() {
  const box = $("referral-earnings");
  if (!box) return;
  const visible = Boolean(referralCode && deps.isPlus() && earnings);
  box.hidden = !visible;
  if (!visible) return;
  $("referral-balance").textContent = euros(earnings.balanceCents);
  $("referral-earned").textContent = t("popup.referral.earned", { earned: euros(earnings.earnedCents), paid: euros(earnings.paidCents) });
  $("referral-payout-rule").textContent = t("popup.referral.payoutRule", { min: euros(earnings.payoutMinCents) });
  const input = $("referral-paypal");
  if (document.activeElement !== input) input.value = earnings.paypal;
  if (!earnings.paypal && !$("referral-paypal-status").dataset.busy) $("referral-paypal-status").textContent = t("popup.referral.paypalMissing");
}

function renderReferral() {
  const current = access();
  const count = current.referrals;
  $("referral-tiers")?.replaceChildren(...tierItems(count));
  $("plus-referral-tiers")?.replaceChildren(...tierItems(count));
  if (!$("referral-block")) return;
  $("referral-code").hidden = !referralCode;
  $("referral-code").textContent = referralCode;
  $("referral-copy").hidden = !referralCode;
  $("referral-get").hidden = Boolean(referralCode);
  $("referral-get").textContent = t(current.plus ? "popup.referral.get" : "popup.plusMenu.discover");
  const status = $("referral-status");
  if (current.plus && count && !status.dataset.busy) status.textContent = t("popup.referral.count", { count });
  renderEarnings();
}

/** Code, filleuls et gains. `quiet` : rafraîchissement en arrière-plan, sans message d'attente. */
async function fetchReferral({ quiet = false } = {}) {
  const status = $("referral-status");
  status.dataset.busy = "1";
  if (!quiet) status.textContent = t("popup.referral.loading");
  try {
    const record = deps.getRecord();
    const response = await fetch(LICENSE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "referral", key: record.licenseKey }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 503) {
      status.textContent = t("popup.referral.soon");
      return;
    }
    if (!response.ok || !payload.code) throw new Error(payload.error || `HTTP ${response.status}`);
    referralCode = payload.code;
    earnings = normalizeEarnings(payload);
    const referrals = Math.max(0, Number(payload.referrals) || 0);
    // La mise à jour de la licence redessine tout par chrome.storage.onChanged.
    await chrome.storage.local.set({
      [PLUS_KEY]: { ...deps.getRecord(), referrals },
      [REFERRAL_CODE_KEY]: referralCode,
      [REFERRAL_EARNINGS_KEY]: earnings,
    });
    status.textContent = t("popup.referral.count", { count: referrals });
  } catch (error) {
    console.warn("[popup] code de parrainage indisponible :", error?.message || error);
    if (!quiet) status.textContent = t("popup.referral.error");
  } finally {
    delete status.dataset.busy;
    renderReferral();
  }
}

/** Enregistre l'adresse PayPal où verser les gains (vide : effacée). */
async function savePaypal() {
  const input = $("referral-paypal");
  const status = $("referral-paypal-status");
  const paypal = input.value.trim();
  if (paypal && !isPaypalAddress(paypal)) {
    status.textContent = t("popup.referral.paypalInvalid");
    return;
  }
  status.dataset.busy = "1";
  status.textContent = t("popup.referral.loading");
  try {
    const response = await fetch(LICENSE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "payout", key: deps.getRecord()?.licenseKey, paypal }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 422) {
      status.textContent = t("popup.referral.paypalInvalid");
      return;
    }
    if (!response.ok || !payload.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    earnings = { ...earnings, paypal: payload.paypal };
    await chrome.storage.local.set({ [REFERRAL_EARNINGS_KEY]: earnings });
    status.textContent = t(payload.paypal ? "popup.referral.paypalSaved" : "popup.referral.paypalMissing");
  } catch (error) {
    console.warn("[popup] adresse PayPal non enregistrée :", error?.message || error);
    status.textContent = t("popup.referral.error");
  } finally {
    delete status.dataset.busy;
  }
}

function initReferralActions() {
  $("referral-paypal-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    savePaypal();
  });
  $("referral-get")?.addEventListener("click", () => (deps.isPlus() ? fetchReferral() : deps.openPlus()));
  $("referral-copy")?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(referralCode).catch(() => {});
    $("referral-status").textContent = t("popup.referral.copied");
  });
}

// ─── Écran StreamPulse+ : aperçu des effets ──────────────────────────────────

function renderShowcase() {
  const strip = $("plus-fx-strip");
  if (!strip) return;
  const badges = node("span", "plus-fx-badges");
  badges.append(...visibleFx(BADGE_FX, {}).map((value) => fxSample("badge", value)));
  const names = node("span", "plus-fx-names");
  names.append(...SHOWCASE_NAMES.map((value) => fxSample("name", value)));
  strip.replaceChildren(badges, names);
  const count = $("plus-fx-count");
  if (count) count.textContent = t("popup.plus.perkFxCount", { badges: visibleFx(BADGE_FX, {}).length, names: visibleFx(NAME_FX, {}).length });
}

// ─── Initialisation ───────────────────────────────────────────────────────────

/** Tout redessiner : appelé au démarrage et à chaque changement de licence. */
export function renderIdentity() {
  renderCosmetics();
  renderReferral();
}

/**
 * @param {{ getRecord: () => object|null, isPlus: () => boolean, openPlus: () => void,
 *           stored: Record<string, unknown> }} options
 */
export function initIdentity({ getRecord, isPlus, openPlus, stored }) {
  deps = { getRecord, isPlus, openPlus };
  chatName = String(stored.userProfile?.displayName || stored.userProfile?.handle || "").slice(0, 25);
  referralCode = typeof stored[REFERRAL_CODE_KEY] === "string" ? stored[REFERRAL_CODE_KEY] : "";
  earnings = stored[REFERRAL_EARNINGS_KEY] && typeof stored[REFERRAL_EARNINGS_KEY] === "object" ? stored[REFERRAL_EARNINGS_KEY] : null;
  cosmetics = normalizeCosmetics(stored[COSMETICS_KEY]);
  initCosmeticsPickers();
  initReferralActions();
  renderShowcase();
  renderIdentity();
  // Les gains bougent lentement : un appel toutes les 6 heures au plus.
  if (referralCode && isPlus() && shouldRefreshEarnings(earnings)) fetchReferral({ quiet: true });
}

export const IDENTITY_STORAGE_KEYS = [COSMETICS_KEY, REFERRAL_CODE_KEY, REFERRAL_EARNINGS_KEY, "userProfile"];
