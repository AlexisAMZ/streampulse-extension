// Onglet Historique, écran StreamPulse+ et alertes intelligentes du popup.
// Séparé de popup.js pour garder chaque fichier lisible ; tout passe par
// chrome.storage, que le service worker alimente.

import { t, getCurrentLanguage } from "./i18n.js";
import { thankPlusSubscriber } from "./plus-thanks.js";
import { initPoints } from "./popup-points.js";
import { initDrops } from "./popup-drops.js";
import { initLayout } from "./popup-layout.js";
import { initReviewAsk } from "./popup-review.js";
import { HISTORY_KEY, formatClock, selectMissed, summarize } from "./history-data.js";
import { PREDICTION_HISTORY_KEY, PREDICTION_RULE_KEY, normalizeRule as normalizePredictionRule, summarize as summarizePredictions } from "./predictions-data.js";
import { LICENSE_VERIFY_URL, PLUS_KEY, plusPageUrl, getDeviceId, isPlusActive, normalizeLicenseKey, portalUrl, releaseDevice, verifyLicense } from "./plus.js";
import {
  SMART_ALERTS_KEY,
  MAX_RULES_PER_STREAMER,
  MAX_TERMS_PER_RULE,
  normalizeRule,
  normalizeRules,
} from "./smart-alerts.js";

const $ = (id) => document.getElementById(id);

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
    node("span", "vod-title", [entry.title, entry.game].filter(Boolean).join(" · ") || entry.game || ""),
    node("span", "vod-ago", agoLabel(entry.endedAt)),
  );
  info.append(avatar, text);

  card.append(thumb, info);
  card.addEventListener("click", () => {
    openTab(entry.vodUrl);
    if (!entry.seen) chrome.runtime.sendMessage({ type: "markHistorySeen", id: entry.id }).catch?.(() => {});
  });
  item.append(card);

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
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  const missed = selectMissed(stored[HISTORY_KEY], { platform: historyPlatform });
  const stats = summarize(missed);

  $("history-count").textContent =
    stats.count === 1 ? t("popup.history.countSingular") : t("popup.history.countPlural", { count: stats.count });
  $("history-sub").textContent = t("popup.history.summary", { duration: durationLabel(stats.totalSeconds) });

  grid.replaceChildren(...missed.map(createVodCard));
  grid.hidden = missed.length === 0;
  $("history-empty").hidden = missed.length !== 0;
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
let selectedPlan = "lifetime";
const plusListeners = new Set();

export function plusActive() {
  return isPlusActive(plusRecord);
}

function renderPlus() {
  const active = plusActive();
  $("open-plus")?.classList.toggle("is-active", active);
  if ($("plus-offer")) $("plus-offer").hidden = active;
  if ($("plus-active")) $("plus-active").hidden = !active;
  if (active && $("plus-active-plan")) {
    const key = plusRecord.licenseKey.replace(/^(SP-[A-Z0-9]{4}).*(.{4})$/, "$1-…-$2");
    $("plus-active-plan").textContent = t(
      plusRecord.plan === "lifetime" ? "popup.plus.planLifetime" : "popup.plus.planMonthly",
      { key },
    );
  }
  if ($("plus-menu-text")) $("plus-menu-text").textContent = t(active ? "popup.plusMenu.statusActive" : "popup.plusMenu.statusInactive");
  if ($("plus-menu-open")) $("plus-menu-open").textContent = t(active ? "popup.plusMenu.manage" : "popup.plusMenu.discover");
  plusListeners.forEach((listener) => listener(active));
}

export function openPlus() {
  const view = $("plus-view");
  if (!view) return;
  view.classList.remove("hidden");
  view.tabIndex = -1;
  view.focus({ preventScroll: true });
}

function closePlus() {
  $("plus-view")?.classList.add("hidden");
  $("open-plus")?.focus();
}

function showKeyError(key) {
  const error = $("plus-key-error");
  if (!error) return;
  error.textContent = key ? t(key) : "";
  error.hidden = !key;
}

function initPlus() {
  $("open-plus")?.addEventListener("click", openPlus);
  $("plus-close")?.addEventListener("click", closePlus);
  $("plus-menu-open")?.addEventListener("click", openPlus);
  $("plus-menu-recap")?.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("html/recap.html") }, () => window.close());
  });
  $("plus-view")?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePlus();
  });

  const plans = document.querySelectorAll(".plus-plan");
  const selectPlan = (plan) => {
    selectedPlan = plan.dataset.plan;
    plans.forEach((other) => {
      const on = other === plan;
      other.classList.toggle("active", on);
      other.setAttribute("aria-checked", String(on));
    });
  };
  plans.forEach((plan) => plan.addEventListener("click", () => selectPlan(plan)));
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

  $("plus-checkout")?.addEventListener("click", () => openTab(plusPageUrl(getCurrentLanguage(), selectedPlan)));

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
      const url = await portalUrl(plusRecord.licenseKey, fetch);
      if (url) {
        openTab(url);
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

// ─── Couleur d'accent et badge (StreamPulse+) ─────────────────────────────────

export const ACCENT_KEY = "streamPulseAccent";

/**
 * La couleur d'accent a été retirée de StreamPulse+ : le popup reste violet,
 * même si une ancienne couleur est encore rangée dans le storage.
 */
function renderAccent() {
  const active = plusActive();
  delete document.body.dataset.accent;
  const note = $("badge-plus-note");
  if (note) note.textContent = t(active ? "popup.settings.badgePlusOn" : "popup.settings.badgePlusOff");
}

export const COSMETICS_KEY = "streamPulseCosmetics";
const BADGE_FX = ["pulse", "shine", "rainbow", "glow", "bounce", "spin", "flicker", "halo"];
const NAME_FX = ["aurora", "sunset", "lcd", "gold", "neon", "rainbow", "ambassador"];
/** Effets d'ambassadeur : nombre de filleuls abonnés exigé (mêmes paliers que le serveur). */
const REFERRAL_FX = { ambassador: 1, halo: 3 };
let cosmetics = { badgeFx: "", nameFx: "" };

function normalizeCosmetics(value) {
  const input = value && typeof value === "object" ? value : {};
  return {
    badgeFx: BADGE_FX.includes(input.badgeFx) ? input.badgeFx : "",
    nameFx: NAME_FX.includes(input.nameFx) ? input.nameFx : "",
  };
}

let chatName = "";

const referralsCount = () => Math.max(0, Number(plusRecord?.referrals) || 0);
const fxLocked = (value) => (REFERRAL_FX[value] || 0) > referralsCount();

/**
 * Un aperçu cliquable par effet : le pseudo de l'utilisateur (ou « TonPseudo »)
 * avec l'effet appliqué, ou le logo StreamPulse animé. Plus lisible qu'un menu.
 */
function fxOption(kind, value, selected) {
  const plus = plusActive();
  const locked = plus && fxLocked(value);
  const button = node("button", "fx-option");
  button.type = "button";
  button.setAttribute("role", "radio");
  button.setAttribute("aria-checked", String(value === selected));
  button.dataset.kind = kind;
  button.dataset.value = value;
  if (locked) button.setAttribute("aria-disabled", "true");
  if (kind === "name") {
    const sample = node("b", `fx-sample-name${value ? ` sp-paint sp-paint--${value}` : ""}`, chatName || t("popup.cosmetics.sampleName"));
    button.append(sample);
  } else {
    button.append(node("span", `cosmetic-badge${value ? ` sp-fx-${value}` : ""}`));
  }
  button.append(node("span", "fx-label", t(`popup.cosmetics.${value || "none"}`)));
  if (locked) {
    button.append(node("span", "fx-lock", t("popup.referral.needed", { count: REFERRAL_FX[value] })));
    button.title = t("popup.referral.needed", { count: REFERRAL_FX[value] });
  } else if (!plus && value) {
    button.append(node("span", "fx-plus", t("popup.plus.badge")));
  }
  return button;
}

function renderCosmetics() {
  const shown = plusActive() ? cosmetics : { badgeFx: "", nameFx: "" };
  $("cosmetic-name-fx")?.replaceChildren(...["", ...NAME_FX].map((value) => fxOption("name", value, shown.nameFx)));
  $("cosmetic-badge-fx")?.replaceChildren(...["", ...BADGE_FX].map((value) => fxOption("badge", value, shown.badgeFx)));
  if ($("cosmetic-badge")) $("cosmetic-badge").className = `cosmetic-badge${shown.badgeFx ? ` sp-fx-${shown.badgeFx}` : ""}`;
  if ($("cosmetic-name")) {
    $("cosmetic-name").className = `cosmetic-name${shown.nameFx ? ` sp-paint sp-paint--${shown.nameFx}` : ""}`;
    $("cosmetic-name").textContent = chatName || t("popup.cosmetics.sampleName");
  }
}

function initCosmetics() {
  for (const id of ["cosmetic-name-fx", "cosmetic-badge-fx"]) {
    $(id)?.addEventListener("click", (event) => {
      const button = event.target.closest(".fx-option");
      if (!button || button.getAttribute("aria-disabled") === "true") return;
      if (!plusActive()) {
        if (button.dataset.value) openPlus();
        return;
      }
      const field = button.dataset.kind === "name" ? "nameFx" : "badgeFx";
      cosmetics = normalizeCosmetics({ ...cosmetics, [field]: button.dataset.value });
      chrome.storage.local.set({ [COSMETICS_KEY]: cosmetics });
      renderCosmetics();
    });
  }
  plusListeners.add(() => renderCosmetics());
}

// ─── Parrainage (StreamPulse+) ────────────────────────────────────────────────

const REFERRAL_TIERS = [
  { count: 1, key: "popup.referral.tierName" },
  { count: 3, key: "popup.referral.tierBadge" },
  { count: 5, key: "popup.referral.tierDevice" },
  { count: 10, key: "popup.referral.tierGift" },
];
let referralCode = "";

function renderReferral() {
  const block = $("referral-block");
  if (!block) return;
  const active = plusActive();
  const count = referralsCount();
  $("referral-code").hidden = !referralCode;
  $("referral-code").textContent = referralCode;
  $("referral-copy").hidden = !referralCode;
  $("referral-get").hidden = Boolean(referralCode);
  $("referral-get").textContent = t(active ? "popup.referral.get" : "popup.plusMenu.discover");
  $("referral-tiers").replaceChildren(...REFERRAL_TIERS.map((tier) => {
    const item = node("li", count >= tier.count ? "referral-tier is-done" : "referral-tier");
    item.append(node("b", null, t("popup.referral.friends", { count: tier.count })), node("span", null, t(tier.key)));
    return item;
  }));
  if (active && count && !$("referral-status").dataset.busy) $("referral-status").textContent = t("popup.referral.count", { count });
}

async function fetchReferral() {
  const status = $("referral-status");
  status.dataset.busy = "1";
  status.textContent = t("popup.referral.loading");
  try {
    const response = await fetch(LICENSE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "referral", key: plusRecord.licenseKey }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 503) {
      status.textContent = t("popup.referral.soon");
      return;
    }
    if (!response.ok || !payload.code) throw new Error(payload.error || `HTTP ${response.status}`);
    referralCode = payload.code;
    plusRecord = { ...plusRecord, referrals: Number(payload.referrals) || 0 };
    await chrome.storage.local.set({ [PLUS_KEY]: plusRecord, streamPulseReferralCode: referralCode });
    status.textContent = t("popup.referral.count", { count: referralsCount() });
  } catch (error) {
    console.warn("[popup] code de parrainage indisponible :", error?.message || error);
    status.textContent = t("popup.referral.error");
  } finally {
    delete status.dataset.busy;
    renderReferral();
  }
}

function initReferral() {
  $("referral-get")?.addEventListener("click", () => (plusActive() ? fetchReferral() : openPlus()));
  $("referral-copy")?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(referralCode).catch(() => {});
    $("referral-status").textContent = t("popup.referral.copied");
  });
  plusListeners.add(() => renderReferral());
}

/**
 * La couleur personnalisée du badge est un avantage StreamPulse+ : sans licence,
 * la choisir ouvre l'écran d'abonnement. Écouté en capture, avant le gestionnaire
 * de popup.js qui enregistrerait le réglage.
 */
function initBadgeColorLock() {
  document.addEventListener(
    "change",
    (event) => {
      const select = event.target;
      if (select?.id !== "pref-badge-color-mode" || select.value !== "custom" || plusActive()) return;
      event.stopImmediatePropagation();
      select.value = "author";
      openPlus();
    },
    true,
  );
  plusListeners.add((active) => {
    const option = document.querySelector('#pref-badge-color-mode option[value="custom"]');
    if (option) option.textContent = `${t("popup.settings.badgeColorCustom")}${active ? "" : " · PLUS"}`;
  });
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

function initAccent() {
  plusListeners.add(() => renderAccent());
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
  if (!plusRecord?.licenseKey || plusRecord.status !== "active") return;
  const now = Date.now();
  if (now - (Number(plusRecord.checkedAt || plusRecord.verifiedAt) || 0) < OPEN_RECHECK_MS) return;
  const result = await verifyLicense(plusRecord.licenseKey, fetch, now, await getDeviceId(chrome.storage.local));
  if (result.ok) {
    // eslint-disable-next-line require-atomic-updates -- la dernière vérification fait foi.
    plusRecord = { ...result.record, checkedAt: now };
    await chrome.storage.local.set({ [PLUS_KEY]: plusRecord });
  } else if (["invalid", "format", "device_limit"].includes(result.error)) {
    // eslint-disable-next-line require-atomic-updates -- la dernière vérification fait foi.
    plusRecord = null;
    await chrome.storage.local.remove(PLUS_KEY);
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
  initAccent();
  initBadgeColorLock();
  initClipDownloadLock();
  initCosmetics();
  initReferral();
  initPredictions();

  const stored = await chrome.storage.local.get([PLUS_KEY, SMART_ALERTS_KEY, ACCENT_KEY, COSMETICS_KEY, PREDICTION_RULE_KEY, PREDICTION_HISTORY_KEY, "betaGeneralStreamers", "userProfile", "streamPulseReferralCode"]);
  // Pseudo choisi dans l'extension, pour les aperçus des effets.
  chatName = String(stored.userProfile?.displayName || stored.userProfile?.handle || "").slice(0, 25);
  referralCode = typeof stored.streamPulseReferralCode === "string" ? stored.streamPulseReferralCode : "";
  plusRecord = stored[PLUS_KEY] || null;
  cosmetics = normalizeCosmetics(stored[COSMETICS_KEY]);
  predictionRule = normalizePredictionRule(stored[PREDICTION_RULE_KEY]);
  predictionHistory = Array.isArray(stored[PREDICTION_HISTORY_KEY]) ? stored[PREDICTION_HISTORY_KEY] : [];
  recheckOnOpen().catch(() => {});
  smartRules = normalizeRules(stored[SMART_ALERTS_KEY]);
  smartStreamers = Array.isArray(stored.betaGeneralStreamers) ? stored.betaGeneralStreamers : [];
  renderPlus();
  initPoints({ isPlus: plusActive, onPlusChange: (listener) => plusListeners.add(listener), openPlus })
    .catch((error) => console.warn("[popup] points init failed:", error));
  initReviewAsk().catch((error) => console.warn("[popup] review ask init failed:", error));
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
    if (changes[PREDICTION_HISTORY_KEY]) {
      predictionHistory = changes[PREDICTION_HISTORY_KEY].newValue || [];
      renderPredictions();
    }
    if (changes[ACCENT_KEY]) {
      renderAccent();
    }
    if (changes.betaGeneralStreamers) {
      smartStreamers = changes.betaGeneralStreamers.newValue || [];
      renderSmart();
    }
  });
}
