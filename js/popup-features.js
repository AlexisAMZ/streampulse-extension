// Onglet Historique, écran StreamPulse+ et alertes intelligentes du popup.
// Séparé de popup.js pour garder chaque fichier lisible ; tout passe par
// chrome.storage, que le service worker alimente.

import { t } from "./i18n.js";
import { HISTORY_KEY, formatClock, selectMissed, summarize } from "./history-data.js";
import { PLUS_KEY, PLUS_CHECKOUT_URL, getDeviceId, isPlusActive, normalizeLicenseKey, releaseDevice, verifyLicense } from "./plus.js";
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
  if (hours <= 0) return `${minutes} min`;
  return minutes >= 30 && hours < 10 ? `${hours} h ${String(minutes).padStart(2, "0")}` : `${hours} h`;
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
  $("plus-view")?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePlus();
  });

  const plans = document.querySelectorAll(".plus-plan");
  plans.forEach((plan) =>
    plan.addEventListener("click", () => {
      selectedPlan = plan.dataset.plan;
      plans.forEach((other) => {
        const on = other === plan;
        other.classList.toggle("active", on);
        other.setAttribute("aria-checked", String(on));
      });
    }),
  );

  $("plus-checkout")?.addEventListener("click", () => openTab(`${PLUS_CHECKOUT_URL}?plan=${selectedPlan}`));

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

function initSmartAlerts() {
  $("smart-unlock")?.addEventListener("click", openPlus);
  plusListeners.add(() => renderSmart());
}

/**
 * À l'ouverture du popup, revérifie la licence si le dernier contrôle date de
 * plus d'une heure : un client supprimé ou un abonnement résilié perd l'accès
 * dès la prochaine ouverture, sans attendre le contrôle quotidien.
 */
const OPEN_RECHECK_MS = 60 * 60 * 1000;

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

export async function initFeatures() {
  initHistory();
  initPlus();
  initSmartAlerts();

  const stored = await chrome.storage.local.get([PLUS_KEY, SMART_ALERTS_KEY, "betaGeneralStreamers"]);
  plusRecord = stored[PLUS_KEY] || null;
  recheckOnOpen().catch(() => {});
  smartRules = normalizeRules(stored[SMART_ALERTS_KEY]);
  smartStreamers = Array.isArray(stored.betaGeneralStreamers) ? stored.betaGeneralStreamers : [];
  renderPlus();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[HISTORY_KEY] && !$("history-view")?.classList.contains("hidden")) {
      renderHistory().catch(() => {});
    }
    if (changes[PLUS_KEY]) {
      plusRecord = changes[PLUS_KEY].newValue || null;
      renderPlus();
    }
    if (changes.betaGeneralStreamers) {
      smartStreamers = changes.betaGeneralStreamers.newValue || [];
      renderSmart();
    }
  });
}
