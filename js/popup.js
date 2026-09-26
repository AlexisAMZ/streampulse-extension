import { BACKUP_KEYS, buildBackup, backupFileName } from "./backup.js";
import { DEFAULT_PREFERENCES } from "./preferences-data.js";
import {
  initI18n,
  applyTranslations,
  setLanguage,
  onLanguageChange,
  getAvailableLanguages,
  getCurrentLanguage,
  t,
  syncDocumentLanguage,
  resolveLocale,
} from "./i18n.js";
import {
  AVAILABLE_PLATFORMS,
  DEFAULT_PLATFORM,
  PLATFORM_DEFINITIONS,
  formatHandleForDisplay,
  getHandleComparisonKey,
  getPlatformLabelKey,
  getPlatformPlaceholderKey,
  normalizePlatform,
  sanitizeHandle,
} from "./platforms.js";
import { createAllChannelsTile, createChannelRow, createMiniCard, formatNumber, renderStage, renderStageEmpty } from "./ui.js";
import { initFeatures, renderHistory } from "./popup-features.js";

const PREFERENCES_STORAGE_KEY = "betaGeneralPreferences";

const defaultPreferences = DEFAULT_PREFERENCES;

const state = {
  streamers: [],
  statuses: {},
  preferences: { ...defaultPreferences },
  selectedPlatform: DEFAULT_PLATFORM,
  userProfile: null,
  selectedId: null,
  platformFilter: "all",
  pinnedIds: [],
  groups: [],
  groupFilter: "all",
  sheetQuery: "",
};

const streamerListEl = document.getElementById("streamer-list");
const addStreamerForm = document.getElementById("add-streamer-form");
const streamerInput = document.getElementById("streamer-input");
const platformPicker = document.getElementById("platform-picker");
const handlePrefix = document.getElementById("handle-prefix");
const addStreamerLabel = addStreamerForm?.querySelector("label[for='streamer-input']");
const helperTextEl = addStreamerForm?.querySelector(".helper-text");
const refreshButton = document.getElementById("refresh-button");
const stageEl = document.getElementById("stage");
const stageMediaEl = document.getElementById("stage-media");
const stageFeatureEl = document.getElementById("stage-feature");
const stagePagerEl = document.getElementById("stage-pager");
const stageCountEl = document.getElementById("stage-count");
const sheetEl = document.getElementById("channels-sheet");
const sheetScrimEl = document.getElementById("sheet-scrim");
const sheetListEl = document.getElementById("sheet-list");
const sheetSearchEl = document.getElementById("sheet-search");
const sheetGroupsEl = document.getElementById("sheet-groups");
const sheetTotalEl = document.getElementById("sheet-total");
const soundsToggle = document.getElementById("pref-sounds");
const backgroundRaidAlertsToggle = document.getElementById("pref-background-raid-alerts");
const autoClaimToggle = document.getElementById("pref-auto-claim");
const autoClaimDropsToggle = document.getElementById("pref-auto-claim-drops");
const autoClaimMomentsToggle = document.getElementById("pref-auto-claim-moments");
const autoOpenInventoryToggle = document.getElementById("pref-auto-open-inventory");
const autoOpenInventoryIntervalSelect = document.getElementById("pref-auto-open-inventory-interval");
const hideTwitchExtensionsToggle = document.getElementById("pref-hide-twitch-extensions");
const autoCancelRaidsToggle = document.getElementById("pref-auto-cancel-raids");
const preventTabDiscardToggle = document.getElementById("pref-prevent-tab-discard");
const streamerFaviconToggle = document.getElementById("pref-enable-streamer-favicon");
const tabLiveIconToggle = document.getElementById("pref-enable-tab-live-icon");
const keepQualityToggle = document.getElementById("pref-keep-quality");
const pipButtonToggle = document.getElementById("pref-pip-button");
const autoRefreshToggle = document.getElementById("pref-auto-refresh");
const clipDownloadToggle = document.getElementById("pref-clip-download");
const playerQualitySelect = document.getElementById("pref-player-quality");
const fastForwardToggle = document.getElementById("pref-fast-forward");
const previewsEnabledToggle = document.getElementById("pref-previews-enabled");
const previewsModeGroup = document.getElementById("previews-mode-group");
const previewsSizeGroup = document.getElementById("previews-size-group");
const previewsDirectoryToggle = document.getElementById("pref-previews-directory");
const previewsSidebarToggle = document.getElementById("pref-previews-sidebar");
const previewsClipsToggle = document.getElementById("pref-previews-clips");
const previewsSearchToggle = document.getElementById("pref-previews-search");
const previewsAudioToggle = document.getElementById("pref-previews-audio");
const previewsDelayInput = document.getElementById("pref-previews-delay");
const previewsDelayValue = document.getElementById("previews-delay-value");
const previewsAnimationsToggle = document.getElementById("pref-previews-animations");
const chatKeywordsInput = document.getElementById("pref-chat-keywords");
const blockedUsersInput = document.getElementById("pref-blocked-users");
const saveChatFilterButton = document.getElementById("save-chat-filter");
const testNotificationButton = document.getElementById("test-notification");
const tabButtons = Array.from(document.querySelectorAll(".tab-button"));
const languageOptions = document.getElementById("language-options-popup");

const statPointsEl = document.getElementById("stat-points");
const btnExport = document.getElementById("btn-export");
const btnImport = document.getElementById("btn-import");
const btnResetStats = document.getElementById("btn-reset-stats");

const watchTimeMonthSelect = document.getElementById("watch-time-month");
const wtTotalTime = document.getElementById("wt-total-time");
const wtTotalChannels = document.getElementById("wt-total-channels");
const wtTopWatched = document.getElementById("wt-top-watched");
const wtEmpty = document.getElementById("wt-empty");
const watchTimeToggle = document.getElementById("pref-watch-time");
const pointsTrackingToggle = document.getElementById("pref-points-tracking");
const dropsTrackingToggle = document.getElementById("pref-drops-tracking");
const communityBadgeToggle = document.getElementById("pref-community-badge");
const badgeColorMode = document.getElementById("pref-badge-color-mode");
const badgeColorValue = document.getElementById("pref-badge-color-value");
const patchNotesButton = document.getElementById("open-patch-notes");
const patchNotesDot = document.getElementById("patch-notes-dot");

const pseudoInput = document.getElementById("pref-pseudo-input");
const pseudoSaveButton = document.getElementById("pref-pseudo-save");

const toastContainer = document.getElementById("toast-container");
const MAX_TOASTS = 5;
const TOAST_DURATION = 4000;

let currentTab = "streamers";
let lastAddedId = null;
let previousLiveIds = new Set(); // track who was live last render
let lastPointsValue = null; // for odometer bump

function markButtonSuccess(button) {
  if (!button) return;
  button.classList.add("btn-success");
  setTimeout(() => {
    button.classList.remove("btn-success");
  }, 2000);
}

function sanitizeInput(value = "", platform = state.selectedPlatform) {
  return sanitizeHandle(platform, value);
}

function showFeedback(message, type = "success") {
  if (!message) return;
  if (!toastContainer) return;

  // Enforce max stack
  const existing = toastContainer.querySelectorAll(".toast:not(.removing)");
  if (existing.length >= MAX_TOASTS) {
    const oldest = existing[0];
    removeToast(oldest);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : "success"}`;
  if (type === "error") toast.setAttribute("role", "alert");
  toast.textContent = message;
  toast.addEventListener("click", () => removeToast(toast));
  toastContainer.appendChild(toast);

  setTimeout(() => removeToast(toast), TOAST_DURATION);
}

function removeToast(toast) {
  if (!toast || toast.classList.contains("removing")) return;
  toast.classList.add("removing");
  // Fallback in case animationend doesn't fire (no animation, browser bug, etc.)
  const fallback = setTimeout(() => toast.remove(), 400);
  toast.addEventListener("animationend", () => {
    clearTimeout(fallback);
    toast.remove();
  }, { once: true });
}

// --- Theme ---
function applyTheme(theme) {
  document.body.dataset.theme = theme;
  document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
    const isActive = btn.dataset.themeValue === theme;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function initTheme() {
  const saved = state.preferences.theme || "dark";
  applyTheme(saved);
  document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const theme = btn.dataset.themeValue;
      applyTheme(theme);
      state.preferences.theme = theme;
      chrome.storage.local.get(PREFERENCES_STORAGE_KEY).then((data) => {
        const prefs = data[PREFERENCES_STORAGE_KEY] || {};
        prefs.theme = theme;
        chrome.storage.local.set({ [PREFERENCES_STORAGE_KEY]: prefs });
      });
    });
  });
}

// --- Skeleton Loading ---
function showSkeletons(count = 3) {
  if (!streamerListEl) return;
  streamerListEl.innerHTML = "";
  streamerListEl.classList.remove("empty");
  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement("li");
    skeleton.className = "skeleton-card";
    skeleton.setAttribute("aria-hidden", "true");
    skeleton.innerHTML = `
      <span class="skeleton-avatar"></span>
      <span class="skeleton-lines">
        <span class="skeleton-line" style="width:${70 - i * 8}%"></span>
        <span class="skeleton-line" style="width:${45 - i * 5}%"></span>
      </span>
    `;
    streamerListEl.appendChild(skeleton);
  }
}

function removeSkeletons() {
  if (!streamerListEl) return;
  streamerListEl.querySelectorAll(".skeleton-card").forEach((el) => el.remove());
}

function getPlatformDefinition(platform) {
  const key = normalizePlatform(platform);
  return PLATFORM_DEFINITIONS[key] || PLATFORM_DEFINITIONS[DEFAULT_PLATFORM];
}

function getPlatformLabel(platform) {
  return t(getPlatformLabelKey(platform));
}

function updatePlatformPickerUI() {
  if (!platformPicker) return;
  platformPicker.querySelectorAll(".platform-button").forEach((button) => {
    const btnPlatform = normalizePlatform(button.dataset.platform);
    const isActive = btnPlatform === state.selectedPlatform;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.title = getPlatformLabel(btnPlatform);
  });
}

function updateAddStreamerTexts() {
  const platformLabel = getPlatformLabel(state.selectedPlatform);
  if (addStreamerLabel) {
    addStreamerLabel.textContent = t("popup.addStreamerTitlePlatform", {
      platform: platformLabel,
    });
  }
  if (helperTextEl) {
    helperTextEl.textContent = t("popup.addStreamerHelperPlatform", {
      platform: platformLabel,
    });
  }
  if (streamerInput) {
    if (state.selectedPlatform === "kishta") {
      streamerInput.value = "Teuf";
      streamerInput.readOnly = true;
      streamerInput.style.opacity = "0.7";
      streamerInput.style.pointerEvents = "none";
    } else {
      streamerInput.readOnly = false;
      streamerInput.style.opacity = "1";
      streamerInput.style.pointerEvents = "auto";
      streamerInput.value = "";

      const placeholderKey = getPlatformPlaceholderKey(
        state.selectedPlatform,
        "popup"
      );
      if (placeholderKey) {
        streamerInput.placeholder = t(placeholderKey);
      } else {
        streamerInput.placeholder = "";
      }
    }
  }
  if (handlePrefix) {
    const definition = getPlatformDefinition(state.selectedPlatform);
    const prefix = definition.inputPrefix || "";
    handlePrefix.textContent = prefix;
    handlePrefix.classList.toggle("is-hidden", !prefix);

    if (state.selectedPlatform === "kishta") {
      handlePrefix.classList.add("is-hidden");
    }
  }
}

function setSelectedPlatform(platform) {
  const normalized = normalizePlatform(platform);
  state.selectedPlatform = normalized;
  updatePlatformPickerUI();
  updateAddStreamerTexts();
}

function renderPlatformPicker() {
  if (!platformPicker) return;
  platformPicker.innerHTML = "";
  AVAILABLE_PLATFORMS.forEach((definition) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "platform-button";
    button.dataset.platform = definition.id;
    button.setAttribute("aria-pressed", "false");

    const icon = document.createElement("img");
    icon.src = `../${definition.icon}`;
    icon.alt = "";

    const label = document.createElement("span");
    label.className = "platform-button-label";
    label.textContent = t(getPlatformLabelKey(definition.id));

    button.append(icon, label);
    platformPicker.appendChild(button);
  });
  updatePlatformPickerUI();
}

async function sendMessage(payload) {
  try {
    return await chrome.runtime.sendMessage(payload);
  } catch (error) {
    console.error("Popup message error:", error);
    showFeedback(t("popup.errors.generic"), "error");
    return null;
  }
}

// --- Drag & drop in the "all channels" sheet (custom order only) ---
let dragSrcEl = null;

function clearDropMarkers() {
  sheetListEl?.querySelectorAll(".drop-before, .drop-after").forEach((row) => {
    row.classList.remove("drop-before", "drop-after");
  });
}

async function reorderStreamers(from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return false;
  if (from < 0 || to < 0 || from >= state.streamers.length || to >= state.streamers.length) return false;
  const reordered = [...state.streamers];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);
  state.streamers = reordered;
  await chrome.storage.local.set({ betaGeneralStreamers: reordered });
  renderStreamers();
  return true;
}

/** Échange deux emplacements de stockage : déplacement visuel adjacent dans le panneau. */
async function swapStreamers(indexA, indexB) {
  if (!Number.isInteger(indexA) || !Number.isInteger(indexB)) return false;
  if (indexA < 0 || indexB < 0 || indexA >= state.streamers.length || indexB >= state.streamers.length) return false;
  const reordered = [...state.streamers];
  [reordered[indexA], reordered[indexB]] = [reordered[indexB], reordered[indexA]];
  state.streamers = reordered;
  await chrome.storage.local.set({ betaGeneralStreamers: reordered });
  renderStreamers();
  return true;
}

function initDragAndDrop() {
  if (!sheetListEl || sheetListEl._dragInit) return;
  sheetListEl._dragInit = true;

  sheetListEl.addEventListener("dragstart", (event) => {
    const row = event.target.closest(".channel-row");
    if (!row) return;
    dragSrcEl = row;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", row.dataset.index);
    requestAnimationFrame(() => row.classList.add("dragging"));
  });

  sheetListEl.addEventListener("dragend", () => {
    dragSrcEl?.classList.remove("dragging");
    clearDropMarkers();
    dragSrcEl = null;
  });

  sheetListEl.addEventListener("dragover", (event) => {
    if (!dragSrcEl) return;
    event.preventDefault();
    clearDropMarkers();
    const row = event.target.closest(".channel-row");
    if (!row || row === dragSrcEl) return;
    const rect = row.getBoundingClientRect();
    row.classList.add(event.clientY > rect.top + rect.height / 2 ? "drop-after" : "drop-before");
  });

  sheetListEl.addEventListener("drop", async (event) => {
    event.preventDefault();
    const row = event.target.closest(".channel-row");
    if (!dragSrcEl || !row || row === dragSrcEl) return;
    const from = Number(dragSrcEl.dataset.index);
    let to = Number(row.dataset.index) + (row.classList.contains("drop-after") ? 1 : 0);
    if (to > from) to -= 1;
    clearDropMarkers();
    await reorderStreamers(from, to);
  });

  // Alternative clavier au glisser-déposer : Alt + flèches haut/bas sur une
  // ligne focusée (tri personnalisé uniquement, comme la souris). On raisonne
  // dans l'ordre VISUEL du panneau (lives d'abord) : on échange la ligne avec
  // sa voisine visuelle en échangeant leurs deux emplacements de stockage.
  // Échanger un live avec un hors-ligne n'a pas d'effet visuel (la partition
  // lives-d'abord est stable) : on ignore ce cas pour ne pas mentir.
  sheetListEl.addEventListener("keydown", async (event) => {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    const row = event.target.closest?.(".channel-row");
    if (!row || !row.querySelector(".row-grip")) return;
    const rows = [...sheetListEl.querySelectorAll(".channel-row")];
    const from = rows.indexOf(row);
    const to = from + (event.key === "ArrowUp" ? -1 : 1);
    const target = rows[to];
    if (!target) return;
    if (row.classList.contains("live") !== target.classList.contains("live")) return;
    event.preventDefault();

    const storageFrom = Number(row.dataset.index);
    const storageTo = Number(target.dataset.index);
    const streamer = state.streamers[storageFrom];
    const moved = await swapStreamers(storageFrom, storageTo);
    if (moved) {
      document.getElementById("sheet-live").textContent = t("popup.cplus.rowMoved", {
        name: nameFor(streamer.id),
        position: to + 1,
      });
      sheetListEl.querySelector(`.channel-row[data-index="${storageTo}"] button`)?.focus();
    }
  });
}

function sortStreamers(list, mode) {
  switch (mode) {
    case "live":
      return list.sort((a, b) => {
        const aLive = state.statuses[a.id]?.active?.isLive ? 1 : 0;
        const bLive = state.statuses[b.id]?.active?.isLive ? 1 : 0;
        if (bLive !== aLive) return bLive - aLive;
        // Secondary: alphabetical
        return (a.displayName || a.handle || "").localeCompare(b.displayName || b.handle || "");
      });
    case "name-asc":
      return list.sort((a, b) =>
        (a.displayName || a.handle || "").localeCompare(b.displayName || b.handle || "")
      );
    case "name-desc":
      return list.sort((a, b) =>
        (b.displayName || b.handle || "").localeCompare(a.displayName || a.handle || "")
      );
    case "custom":
    default:
      return list; // original order (drag & drop)
  }
}

const PINS_KEY = "betaPinnedIds";
const GROUPS_KEY = "betaChannelGroups";
const JUST_LIVE_MINUTES = 15;
const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

let liveOrder = [];
let justLiveIds = new Set();
let activityRequest = 0;

function getSortMode() {
  return document.getElementById("sort-order")?.value || "live";
}

function isLiveId(id) {
  return Boolean(state.statuses[id]?.active?.isLive);
}

function isPinned(id) {
  return state.pinnedIds.includes(id);
}

function nameFor(id) {
  const streamer = state.streamers.find((s) => s.id === id);
  if (!streamer) return "";
  const platformId = streamer.platform || DEFAULT_PLATFORM;
  return streamer.displayName || formatHandleForDisplay(platformId, streamer.handle || streamer.twitch);
}

function viewersOf(id) {
  const status = state.statuses[id];
  const viewers = status?.active?.viewers ?? status?.viewers;
  return Number.isFinite(viewers) ? viewers : 0;
}

function startedMinutesAgo(id) {
  const start = Date.parse(state.statuses[id]?.active?.startedAt);
  return Number.isFinite(start) ? (Date.now() - start) / 60000 : null;
}

async function toggleStreamerAlert(id, enabled, { type, key, onKey, offKey }) {
  const result = await sendMessage({ type, id, enabled });
  if (!result || result.error) {
    if (result?.error) showFeedback(result.error, "error");
    return false;
  }
  // Views re-render from state: keep the accepted flag there.
  state.streamers = state.streamers.map((s) => (s.id === id ? { ...s, [key]: enabled } : s));
  showFeedback(t(enabled ? onKey : offKey, { name: nameFor(id) }), "success");
  return true;
}

const streamerCallbacks = {
  onToggleNotify: (id, enabled) => toggleStreamerAlert(id, enabled, {
    type: "toggleNotifications",
    key: "notificationsEnabled",
    onKey: "popup.toast.notifyEnabled",
    offKey: "popup.toast.notifyDisabled",
  }),
  onToggleGameNotify: (id, enabled) => toggleStreamerAlert(id, enabled, {
    type: "toggleGameNotifications",
    key: "gameNotificationsEnabled",
    onKey: "popup.toast.gameNotifyEnabled",
    offKey: "popup.toast.gameNotifyDisabled",
  }),
  onToggleTitleNotify: (id, enabled) => toggleStreamerAlert(id, enabled, {
    type: "toggleTitleNotifications",
    key: "titleNotificationsEnabled",
    onKey: "popup.toast.titleNotifyEnabled",
    offKey: "popup.toast.titleNotifyDisabled",
  }),
  onOpen: (url) => {
    chrome.tabs.create({ url }, () => window.close());
  },
  onRemove: async (id, name) => {
    const result = await sendMessage({ type: "removeStreamer", id });
    if (result?.success) {
      showFeedback(t("popup.feedback.removeSuccess", { name }), "success");
      await loadStreamers();
    } else if (result?.error) {
      showFeedback(result.error, "error");
    }
  },
};

// --- Pins and groups: popup-only data, stored beside the streamer list ---
async function togglePin(id) {
  const pinned = !isPinned(id);
  state.pinnedIds = pinned ? [...state.pinnedIds, id] : state.pinnedIds.filter((x) => x !== id);
  await chrome.storage.local.set({ [PINS_KEY]: state.pinnedIds });
  showFeedback(t(pinned ? "popup.cplus.pinned" : "popup.cplus.unpinned", { name: nameFor(id) }), "success");
  renderStreamers();
}

async function saveGroups(groups) {
  state.groups = groups;
  await chrome.storage.local.set({ [GROUPS_KEY]: groups });
}

async function createGroup(name) {
  const clean = name.trim().slice(0, 24);
  if (!clean) return;
  const group = { id: `g_${Date.now().toString(36)}`, name: clean, memberIds: [] };
  await saveGroups([...state.groups, group]);
  // eslint-disable-next-line require-atomic-updates -- filtre posé par le geste qui vient de créer le groupe.
  state.groupFilter = group.id;
  renderSheet();
}

async function deleteGroup(id) {
  await saveGroups(state.groups.filter((group) => group.id !== id));
  if (state.groupFilter === id) state.groupFilter = "all";
  renderSheet();
}

async function setStreamerGroup(streamerId, groupId) {
  await saveGroups(state.groups.map((group) => {
    const members = group.memberIds.filter((member) => member !== streamerId);
    return { ...group, memberIds: group.id === groupId ? [...members, streamerId] : members };
  }));
  renderSheet();
}

function groupOf(id) {
  return state.groups.find((group) => group.memberIds.includes(id)) || null;
}

const miniCallbacks = {
  onSelect: (id) => {
    state.selectedId = id;
    renderStreamers();
  },
  onTogglePin: togglePin,
  onRemove: streamerCallbacks.onRemove,
};

const rowCallbacks = {
  ...streamerCallbacks,
  onTogglePin: togglePin,
  onSetGroup: setStreamerGroup,
  onFeature: (id) => {
    state.selectedId = id;
    closeSheet({ restoreFocus: false });
    renderStreamers();
  },
};

/** Sorted list with pinned channels first. */
function orderStreamers() {
  const sorted = sortStreamers([...state.streamers], getSortMode());
  return [...sorted.filter((s) => isPinned(s.id)), ...sorted.filter((s) => !isPinned(s.id))];
}

function passesPlatformFilter(streamer) {
  if (state.platformFilter === "all") return true;
  if (state.platformFilter === "pinned") return isPinned(streamer.id);
  return (streamer.platform || DEFAULT_PLATFORM) === state.platformFilter;
}

/** Returns the URL if it is https, otherwise an empty string. */
function safeAvatarUrl(raw) {
  if (typeof raw !== "string" || !raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}

function renderGreeting(live = state.streamers.filter((s) => isLiveId(s.id))) {
  const titleEl = document.getElementById("greeting-title");
  if (titleEl) {
    const name = state.userProfile?.displayName || state.userProfile?.handle || "";
    const hello = new Date().getHours() < 18 ? t("popup.greetingMorning") : t("popup.greetingEvening");
    const sub = document.createElement("span");
    sub.className = "greeting-sub";
    sub.textContent = t("popup.greetingSub");
    titleEl.replaceChildren(document.createTextNode(name ? `${hello} ${name}.` : `${hello}.`), document.createElement("br"), sub);
  }
  const hintEl = document.getElementById("greeting-live-count");
  if (hintEl) {
    const countKey = live.length > 1 ? "popup.greetingLiveCountPlural" : "popup.greetingLiveCountSingular";
    const parts = [t(countKey, { count: live.length })];
    const newest = live.find((s) => justLiveIds.has(s.id));
    if (newest) parts.push(t("popup.cplus.justStarted", { name: nameFor(newest.id) }));
    hintEl.textContent = parts.join(" · ");
  }
}

function renderFeatured() {
  if (!stageEl || !stageMediaEl || !stageFeatureEl) return;
  const index = liveOrder.indexOf(state.selectedId);
  if (stagePagerEl) stagePagerEl.hidden = liveOrder.length < 2;
  if (stageCountEl) stageCountEl.textContent = `${index + 1} / ${liveOrder.length}`;

  const streamer = state.streamers.find((s) => s.id === state.selectedId);
  if (!streamer) {
    renderStageEmpty(stageEl, stageMediaEl, stageFeatureEl, {
      kind: state.streamers.length ? "nobody" : "empty",
      offlineCount: state.streamers.length,
      avatarUrl: safeAvatarUrl(state.userProfile?.avatarUrl),
      onOpenSheet: openSheet,
      // Premier contact : le CTA place le curseur dans le champ d'ajout.
      onAddStreamer: () => {
        document.getElementById("tab-streamers")?.click();
        document.getElementById("streamer-input")?.focus();
      },
    });
    return;
  }
  renderStage(stageEl, stageMediaEl, stageFeatureEl, streamer, state.statuses[streamer.id], {
  }, streamerCallbacks);
}

function stepFeatured(delta) {
  if (liveOrder.length < 2) return;
  const index = liveOrder.indexOf(state.selectedId);
  state.selectedId = liveOrder[(index + delta + liveOrder.length) % liveOrder.length];
  renderStreamers();
}

function renderStreamers() {
  if (!streamerListEl) return;
  const ordered = orderStreamers();
  const live = ordered.filter((s) => isLiveId(s.id));
  const offline = ordered.filter((s) => !isLiveId(s.id));
  const shownLive = live.filter(passesPlatformFilter);

  justLiveIds = new Set(live.filter((s) => {
    const minutes = startedMinutesAgo(s.id);
    const appeared = previousLiveIds.size > 0 && !previousLiveIds.has(s.id);
    return appeared || (minutes !== null && minutes <= JUST_LIVE_MINUTES);
  }).map((s) => s.id));
  previousLiveIds = new Set(live.map((s) => s.id));

  if (lastAddedId) {
    const added = state.streamers.find((s) => getHandleComparisonKey(s.platform || DEFAULT_PLATFORM, s.handle || s.twitch) === lastAddedId);
    if (added && isLiveId(added.id)) state.selectedId = added.id;
    lastAddedId = null;
  }

  liveOrder = shownLive.map((s) => s.id);
  if (!liveOrder.includes(state.selectedId)) {
    const best = [...shownLive].sort((a, b) => (Number(isPinned(b.id)) - Number(isPinned(a.id))) || (viewersOf(b.id) - viewersOf(a.id)))[0];
    state.selectedId = best ? best.id : null;
  }

  const fragment = document.createDocumentFragment();
  shownLive.forEach((streamer) => {
    fragment.appendChild(createMiniCard(streamer, state.statuses[streamer.id], {
      selected: streamer.id === state.selectedId,
      pinned: isPinned(streamer.id),
    }, miniCallbacks));
  });
  if (state.streamers.length) {
    fragment.appendChild(createAllChannelsTile(offline.slice(0, 3), offline.length, openSheet));
  }
  streamerListEl.replaceChildren(fragment);

  // Garde la carte du streamer affiché sur la scène visible dans la bande,
  // sinon la carte sélectionnée reste coupée au bord du scroll.
  const selectedCard = streamerListEl.querySelector(".mini.is-selected");
  if (selectedCard) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    selectedCard.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
  }

  const liveCountEl = document.getElementById("live-count");
  if (liveCountEl) liveCountEl.textContent = t("popup.cplus.liveOf", { live: live.length, total: state.streamers.length });

  renderGreeting(live);
  renderFeatured();
  if (sheetEl && !sheetEl.hidden) renderSheet();
  renderActivity();
}

function setChip(id, visible, text) {
  const chip = document.getElementById(id);
  if (!chip) return;
  chip.hidden = !visible;
  const label = chip.querySelector(".chip-label");
  if (label) label.textContent = text;
}

/** Today's work, read from the event log the background already keeps. */
async function renderActivity() {
  document.getElementById("activity-auto")?.toggleAttribute("hidden", state.preferences.autoClaimChannelPoints === false);
  const request = ++activityRequest;
  let logs;
  try {
    logs = (await chrome.runtime.sendMessage({ type: "getEventLogs" }))?.logs || [];
  } catch {
    logs = [];
  }
  if (request !== activityRequest) return;
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const today = logs.filter((log) => log.timestamp >= midnight.getTime());
  const points = today.filter((log) => log.type === "points").reduce((sum, log) => sum + (Number(log.value) || 0), 0);
  setChip("activity-points", points > 0, t("popup.cplus.pointsToday", { count: formatNumber(points) }));
  // La puce « Drops du jour » est tenue par popup-drops.js, d'après l'historique des Drops.
}

// --- All channels sheet ---
const SHEET_FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function trapSheetFocus(event) {
  if (event.key !== "Tab") return;
  const focusable = [...sheetEl.querySelectorAll(SHEET_FOCUSABLE)].filter((el) => el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || !sheetEl.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openSheet() {
  if (!sheetEl) return;
  sheetEl.hidden = false;
  if (sheetScrimEl) sheetScrimEl.hidden = false;
  renderSheet();
  sheetEl.addEventListener("keydown", trapSheetFocus);
  sheetSearchEl?.focus();
}

function closeSheet({ restoreFocus = true } = {}) {
  if (!sheetEl || sheetEl.hidden) return;
  sheetEl.hidden = true;
  sheetEl.removeEventListener("keydown", trapSheetFocus);
  if (sheetScrimEl) sheetScrimEl.hidden = true;
  state.sheetQuery = "";
  if (sheetSearchEl) sheetSearchEl.value = "";
  if (restoreFocus) document.getElementById("open-all-channels")?.focus();
}

function renderGroupChips() {
  if (!sheetGroupsEl) return;
  const chips = [
    { id: "all", label: t("popup.osd.filterAll") },
    { id: "pinned", label: t("popup.cplus.pinnedFilter") },
    ...state.groups.map((group) => ({ id: group.id, label: group.name, removable: true })),
  ];
  const fragment = document.createDocumentFragment();
  chips.forEach((chip) => {
    const wrap = document.createElement("span");
    wrap.className = "group-chip-wrap";
    const chipButton = document.createElement("button");
    chipButton.type = "button";
    chipButton.className = "group-chip";
    chipButton.textContent = chip.label;
    chipButton.setAttribute("aria-pressed", String(state.groupFilter === chip.id));
    chipButton.addEventListener("click", () => {
      state.groupFilter = chip.id;
      renderSheet();
    });
    wrap.appendChild(chipButton);
    if (chip.removable && state.groupFilter === chip.id) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "group-chip-remove";
      remove.innerHTML = CLOSE_ICON;
      remove.setAttribute("aria-label", t("popup.cplus.deleteGroup", { name: chip.label }));
      remove.title = remove.getAttribute("aria-label");
      remove.addEventListener("click", () => deleteGroup(chip.id));
      wrap.appendChild(remove);
    }
    fragment.appendChild(wrap);
  });

  const add = document.createElement("button");
  add.type = "button";
  add.className = "group-chip group-chip-add";
  add.textContent = t("popup.cplus.newGroup");
  add.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "group-input";
    input.maxLength = 24;
    input.placeholder = t("popup.cplus.groupPlaceholder");
    input.setAttribute("aria-label", t("popup.cplus.groupPlaceholder"));
    let done = false;
    const commit = async () => {
      if (done) return;
      done = true;
      if (input.value.trim()) await createGroup(input.value);
      else renderSheet();
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        done = true;
        renderSheet();
      }
    });
    input.addEventListener("blur", commit);
    add.replaceWith(input);
    input.focus();
  });
  fragment.appendChild(add);
  sheetGroupsEl.replaceChildren(fragment);
}

function renderSheet() {
  if (!sheetListEl) return;
  const query = state.sheetQuery.trim().toLowerCase();
  const groupMembers = state.groups.find((group) => group.id === state.groupFilter)?.memberIds || [];
  const inFilter = (s) => {
    if (state.groupFilter === "all") return true;
    if (state.groupFilter === "pinned") return isPinned(s.id);
    return groupMembers.includes(s.id);
  };
  const matches = orderStreamers()
    .filter(inFilter)
    .filter((s) => !query || nameFor(s.id).toLowerCase().includes(query) || String(s.handle || "").toLowerCase().includes(query));
  const rows = [...matches.filter((s) => isLiveId(s.id)), ...matches.filter((s) => !isLiveId(s.id))];

  if (sheetTotalEl) sheetTotalEl.textContent = String(rows.length);
  renderGroupChips();

  const fragment = document.createDocumentFragment();
  if (rows.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = t(state.streamers.length ? "popup.cplus.noMatch" : "popup.emptyState");
    fragment.appendChild(empty);
  }
  rows.forEach((streamer) => {
    fragment.appendChild(createChannelRow(streamer, state.statuses[streamer.id], {
      query,
      pinned: isPinned(streamer.id),
      groups: state.groups,
      groupId: groupOf(streamer.id)?.id || "",
      index: state.streamers.findIndex((s) => s.id === streamer.id),
      draggable: getSortMode() === "custom" && !query,
    }, rowCallbacks));
  });
  sheetListEl.replaceChildren(fragment);
}

async function handleSavePseudo() {
  if (!pseudoInput || !pseudoSaveButton) return;
  const raw = pseudoInput.value.trim();
  if (!raw) {
    showFeedback(t("popup.settings.pseudoEmpty") || "Pseudo vide", "error");
    return;
  }
  const previous = state.userProfile || {};

  pseudoSaveButton.disabled = true;

  // L'avatar doit suivre le pseudo. Sans ce lookup, le spread de l'ancien
  // profil conservait la photo posee a l'onboarding : apres un changement de
  // pseudo, le filigrane des statistiques montrait encore l'ancien compte.
  const lookup = await sendMessage({ type: "lookupTwitchUser", handle: raw });
  const user = lookup?.user || null;
  const next = {
    ...previous,
    handle: raw,
    displayName: user?.display_name || raw,
    // Compte introuvable ou hors ligne : pas de photo vaut mieux que celle
    // de quelqu'un d'autre.
    avatarUrl: user?.profile_image_url || "",
  };

  const result = await sendMessage({ type: "updateUserProfile", profile: next });
  // eslint-disable-next-line require-atomic-updates -- reactivation du bouton apres le geste qui l'a desactive.
  pseudoSaveButton.disabled = false;

  if (result?.success) {
    // eslint-disable-next-line require-atomic-updates -- profil ecrit par une seule action utilisateur a la fois.
    state.userProfile = next;
    markButtonSuccess(pseudoSaveButton);
    showFeedback(t("popup.settings.pseudoSaved") || "Pseudo mis à jour", "success");
  } else {
    showFeedback(result?.error || t("popup.errors.generic"), "error");
  }
}

function renderPreferences() {
  const prefs = state.preferences || defaultPreferences;
  if (soundsToggle) {
    soundsToggle.checked = prefs.soundsEnabled !== false;
  }
  if (backgroundRaidAlertsToggle) {
    backgroundRaidAlertsToggle.checked = prefs.backgroundRaidAlerts === true;
  }
  if (autoClaimToggle) {
    autoClaimToggle.checked = prefs.autoClaimChannelPoints !== false;
  }
  if (autoClaimDropsToggle) {
    autoClaimDropsToggle.checked = prefs.autoClaimDrops !== false;
  }
  if (autoClaimMomentsToggle) {
    autoClaimMomentsToggle.checked = prefs.autoClaimMoments !== false;
  }
  if (autoOpenInventoryToggle) {
    autoOpenInventoryToggle.checked = Boolean(prefs.autoOpenInventory);
  }
  if (autoOpenInventoryIntervalSelect) {
    autoOpenInventoryIntervalSelect.value = String(prefs.autoOpenInventoryIntervalHours || 24);
  }
  if (hideTwitchExtensionsToggle) {
    hideTwitchExtensionsToggle.checked = Boolean(prefs.hideTwitchExtensions);
  }
  if (autoCancelRaidsToggle) {
    autoCancelRaidsToggle.checked = prefs.autoCancelRaids === true;
  }
  if (preventTabDiscardToggle) {
    preventTabDiscardToggle.checked = prefs.preventTabDiscard !== false;
  }
  if (streamerFaviconToggle) {
    streamerFaviconToggle.checked = prefs.enableStreamerFavicon !== false;
  }
  if (tabLiveIconToggle) {
    tabLiveIconToggle.checked = prefs.enableTabLiveIcon !== false;
  }
  if (keepQualityToggle) {
    keepQualityToggle.checked = prefs.keepQualityInBackground === true;
  }
  if (pipButtonToggle) {
    pipButtonToggle.checked = prefs.enablePipButton !== false;
  }
  if (autoRefreshToggle) {
    autoRefreshToggle.checked = prefs.autoRefreshPlayerErrors !== false;
  }
  if (clipDownloadToggle) {
    clipDownloadToggle.checked = prefs.enableClipDownload !== false;
  }
  if (playerQualitySelect) {
    playerQualitySelect.value = prefs.playerQuality || "auto";
  }
  if (fastForwardToggle) {
    fastForwardToggle.checked = prefs.enableFastForwardButton !== false;
  }
  if (watchTimeToggle) {
    watchTimeToggle.checked = prefs.watchTimeTracker !== false;
  }
  if (dropsTrackingToggle) {
    dropsTrackingToggle.checked = prefs.dropsTracking !== false;
  }
  if (pointsTrackingToggle) {
    pointsTrackingToggle.checked = prefs.pointsTracking !== false;
  }
  if (badgeColorMode) {
    // Une couleur hexadecimale stockee signifie le mode personnalise.
    const stored = prefs.communityBadgeColor || "author";
    const isCustom = stored !== "author" && stored !== "theme";
    badgeColorMode.value = isCustom ? "custom" : stored;
    if (badgeColorValue) {
      badgeColorValue.hidden = !isCustom;
      if (isCustom) badgeColorValue.value = stored;
    }
  }
  if (communityBadgeToggle) {
    communityBadgeToggle.checked = prefs.communityBadge === true;
  }
  if (previewsEnabledToggle) {
    previewsEnabledToggle.checked = prefs.previewsEnabled !== false;
  }
  if (previewsDirectoryToggle) {
    previewsDirectoryToggle.checked = prefs.previewsSurfaceDirectory !== false;
  }
  if (previewsSidebarToggle) {
    previewsSidebarToggle.checked = prefs.previewsSurfaceSidebar !== false;
  }
  if (previewsClipsToggle) {
    previewsClipsToggle.checked = prefs.previewsSurfaceClips !== false;
  }
  if (previewsSearchToggle) {
    previewsSearchToggle.checked = prefs.previewsSurfaceSearch !== false;
  }
  if (previewsAudioToggle) {
    previewsAudioToggle.checked = prefs.previewsAudio === true;
  }
  if (previewsAnimationsToggle) {
    previewsAnimationsToggle.checked = prefs.previewsAnimations !== false;
  }
  {
    const pvMode = prefs.previewsMode === "video" ? "video" : "image";
    previewsModeGroup?.querySelectorAll(".seg-btn").forEach((b) => {
      const isActive = b.dataset.previewsMode === pvMode;
      b.classList.toggle("active", isActive);
      b.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    const pvSize = ["s", "m", "l"].includes(prefs.previewsSize) ? prefs.previewsSize : "m";
    previewsSizeGroup?.querySelectorAll(".seg-btn").forEach((b) => {
      const isActive = b.dataset.previewsSize === pvSize;
      b.classList.toggle("active", isActive);
      b.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    if (previewsDelayInput) {
      const d = Number.isFinite(prefs.previewsShowDelayMs) ? prefs.previewsShowDelayMs : 200;
      previewsDelayInput.value = String(d);
      if (previewsDelayValue) previewsDelayValue.textContent = String(d);
    }
  }
  if (chatKeywordsInput) {
    chatKeywordsInput.value = prefs.chatKeywords || "";
  }
  if (blockedUsersInput) {
    blockedUsersInput.value = prefs.chatBlockedUsers || "";
  }
  const sortSelect = document.getElementById("sort-order");
  if (sortSelect && prefs.sortOrder) {
    sortSelect.value = prefs.sortOrder;
  }
  updateLanguageButtonsState();
}


let _watchTimeLoaded = false;
let currentLogFilter = "all";

const LOG_ICON_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const LOG_ICONS = {
  drop: `<svg ${LOG_ICON_ATTRS}><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>`,
  moment: `<svg ${LOG_ICON_ATTRS}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
  raid: `<svg ${LOG_ICON_ATTRS}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  points: `<svg ${LOG_ICON_ATTRS}><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20"/></svg>`,
  default: `<svg ${LOG_ICON_ATTRS}><circle cx="12" cy="12" r="4"/></svg>`,
};

async function renderEventLogs() {
  const container = document.getElementById("logs-container");
  if (!container) return;

  try {
    const resp = await chrome.runtime.sendMessage({ type: "getEventLogs" });
    const logs = resp?.logs || [];

    const filtered = logs.filter((log) => {
      if (currentLogFilter === "all") return true;
      return log.type === currentLogFilter;
    });

    if (filtered.length === 0) {
      container.innerHTML = `<p class="empty-state">${escapeHtml(t("popup.settings.logEmpty"))}</p>`;
      return;
    }

    container.innerHTML = filtered
      .map((log) => {
        const timeStr = new Date(log.timestamp).toLocaleTimeString(resolveLocale(getCurrentLanguage()), {
          hour: "2-digit",
          minute: "2-digit",
        });
        // log.text and log.channel originate from the Twitch DOM, so they must
        // be escaped before being interpolated into innerHTML.
        const label = escapeHtml(String(log.text || log.type || ""));
        const channel = log.channel ? escapeHtml(String(log.channel)) : "";
        const icon = LOG_ICONS[log.type] || LOG_ICONS.default;

        return `
          <div class="log-entry">
            ${icon}
            <span class="log-text">
              <span class="log-label">${label}</span>
              ${channel ? `<span class="log-channel">${channel}</span>` : ""}
            </span>
            <span class="log-time">${timeStr}</span>
          </div>
        `;
      })
      .join("");
  } catch (_) {
    container.innerHTML = `<p class="empty-state">${escapeHtml(t("popup.settings.logError"))}</p>`;
  }
}

function setActiveTab(tabName) {
  currentTab = tabName;
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
    button.tabIndex = isActive ? 0 : -1;
  });

  document.body.classList.toggle("is-settings", tabName !== "streamers");
  if (tabName !== "streamers") closeSheet({ restoreFocus: false });

  const streamersView = document.getElementById("streamers-view");
  const settingsSection = document.getElementById("settings-section");
  const historyView = document.getElementById("history-view");
  document.getElementById("plus-view")?.classList.add("hidden");
  historyView?.classList.toggle("hidden", tabName !== "history");

  if (tabName === "streamers") {
    streamersView?.classList.remove("hidden");
    settingsSection?.classList.add("hidden");
  } else if (tabName === "history") {
    streamersView?.classList.add("hidden");
    settingsSection?.classList.add("hidden");
    renderHistory().catch(() => {});
  } else {
    streamersView?.classList.add("hidden");
    settingsSection?.classList.remove("hidden");
    renderEventLogs().catch(() => {});
    if (!_watchTimeLoaded) {
      _watchTimeLoaded = true;
      renderWatchTimeSummary().catch(() => {});
    }
  }
}

async function loadStreamers() {
  try {
    const data = await chrome.storage.local.get([
      "betaGeneralStreamers",
      "betaGeneralStatuses",
      "betaGeneralPreferences",
      "betaPinnedIds",
      "betaChannelGroups",
    ]);

    state.streamers = data.betaGeneralStreamers || [];
    state.statuses = data.betaGeneralStatuses || {};
    if (Array.isArray(data.betaPinnedIds)) state.pinnedIds = data.betaPinnedIds;
    if (Array.isArray(data.betaChannelGroups)) state.groups = data.betaChannelGroups;
    state.preferences = {
      ...state.preferences,
      ...(data.betaGeneralPreferences || {}),
    };

    renderStreamers();
    renderPreferences();
    renderStats();
    renderWatchTimeSummary();
  } catch (error) {
    console.error("Fast load failed:", error);
  }
}

function animatePointsValue(el, newValue) {
  const formatted = formatNumber(newValue);
  if (lastPointsValue !== null && newValue !== lastPointsValue && el) {
    el.textContent = formatted;
    el.classList.add("points-bump");
    el.addEventListener("animationend", () => el.classList.remove("points-bump"), { once: true });
  } else if (el) {
    el.textContent = formatted;
  }
  lastPointsValue = newValue;
}

async function renderStats(preloadedStats = null) {
  try {
    const stats = preloadedStats !== null
      ? preloadedStats
      : (await chrome.storage.local.get("betaGeneralStats")).betaGeneralStats || {};
    const points = stats.channelPointsClaimed || 0;
    const formatted = points > 0 ? formatNumber(points) : "--";

    // Settings counter
    if (statPointsEl) statPointsEl.textContent = formatted;

    // Greeting bar points block: animated bump
    const headerPointsValue2 = document.getElementById("header-points-value2");
    if (headerPointsValue2) animatePointsValue(headerPointsValue2, points);
  } catch (err) {
    console.error("renderStats failed:", err);
    if (statPointsEl) statPointsEl.textContent = t("popup.stats.loadError") || "--";
  }
}

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? String(m).padStart(2, "0") : ""}`;
  return `${m}min`;
}

function resolveWatchTimeEntry(entry) {
  const key = entry.channel.toLowerCase();
  const platform = entry.platform;

  // Use avatar from watch time data (resolved by background)
  let avatarUrl = entry.avatarUrl || "";
  let displayName = entry.channel;

  // Cross-reference with followed streamers for display name
  for (const s of state.streamers) {
    const sp = s.platform || "twitch";
    if (sp !== platform) continue;
    const handle = (s.handle || s.twitch || s.id || "").toLowerCase();
    if (handle === key) {
      displayName = s.displayName || entry.channel;
      // Prefer fresh avatar from statuses
      if (!avatarUrl) {
        const statusData = state.statuses[s.id];
        avatarUrl = statusData?.avatarUrl || s.avatarUrl || "";
      }
      break;
    }
  }

  // Fallback: platform icon
  if (!avatarUrl) {
    try {
      const iconPath = platform === "kick" ? "images/social/Kick.png" : "images/social/twitch.png";
      avatarUrl = chrome.runtime.getURL(iconPath);
    } catch { /* ignore */ }
  }

  return { displayName, avatarUrl, platform };
}

function buildWtRankingItem(entry, valueHtml) {
  const { displayName, avatarUrl, platform } = resolveWatchTimeEntry(entry);
  const li = document.createElement("li");

  const avatarImg = document.createElement("img");
  avatarImg.className = "wt-avatar";
  avatarImg.src = avatarUrl;
  avatarImg.alt = "";
  avatarImg.loading = "lazy";
  avatarImg.onerror = function () {
    this.onerror = null;
    const icon = platform === "kick" ? "images/social/Kick.png" : "images/social/twitch.png";
    this.src = chrome.runtime.getURL(icon);
  };

  const info = document.createElement("div");
  info.className = "wt-entry-info";
  info.innerHTML = `
    <span class="wt-channel">${escapeHtml(displayName)}</span>
    <span class="wt-platform-badge">${escapeHtml(platform)}</span>
  `;

  const value = document.createElement("span");
  value.className = "wt-value";
  value.innerHTML = valueHtml;

  li.append(avatarImg, info, value);
  return li;
}

function _getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function renderWatchTimeSummary(month = null, preloadedData = null) {
  try {
    // Read directly from storage: bypasses the service worker (MV3 can be sleeping)
    const data = preloadedData !== null
      ? preloadedData
      : (await chrome.storage.local.get("betaWatchTimeData")).betaWatchTimeData || {};

    const monthKey = month || _getCurrentMonthKey();
    const monthData = data[monthKey] || {};
    const entries = Object.values(monthData).sort((a, b) => b.watchSeconds - a.watchSeconds);
    const totalSeconds = entries.reduce((s, e) => s + e.watchSeconds, 0);
    const availableMonths = Object.keys(data).sort().reverse();

    const summary = {
      month: monthKey,
      availableMonths,
      totalSeconds,
      channelCount: entries.length,
      topWatched: entries.slice(0, 10),
    };

    // Populate month selector
    if (watchTimeMonthSelect) {
      watchTimeMonthSelect.innerHTML = "";
      if (summary.availableMonths?.length > 0) {
        watchTimeMonthSelect.disabled = false;
        for (const m of summary.availableMonths) {
          const opt = document.createElement("option");
          opt.value = m;
          const [y, mo] = m.split("-");
          const date = new Date(Number(y), Number(mo) - 1);
          opt.textContent = date.toLocaleDateString(resolveLocale(state.preferences.language), {
            month: "long",
            year: "numeric",
          });
          if (m === summary.month) opt.selected = true;
          watchTimeMonthSelect.appendChild(opt);
        }
      } else {
        const now = new Date();
        const opt = document.createElement("option");
        opt.textContent = now.toLocaleDateString(resolveLocale(state.preferences.language), {
          month: "long",
          year: "numeric",
        });
        watchTimeMonthSelect.appendChild(opt);
        watchTimeMonthSelect.disabled = true;
      }
    }

    const hasData = summary.totalSeconds > 0;

    // Greeting bar watch time block
    const statWatchtimeEl = document.getElementById("stat-watchtime");
    if (statWatchtimeEl) statWatchtimeEl.textContent = hasData ? formatDuration(summary.totalSeconds) : "--";

    if (wtEmpty) wtEmpty.classList.toggle("hidden", hasData);
    if (wtTotalTime) wtTotalTime.textContent = hasData ? formatDuration(summary.totalSeconds) : "--";
    if (wtTotalChannels) wtTotalChannels.textContent = hasData ? String(summary.channelCount) : "--";

    // Top watched
    if (wtTopWatched) {
      wtTopWatched.innerHTML = "";
      if (hasData) {
        for (const entry of summary.topWatched.slice(0, 5)) {
          if (entry.watchSeconds <= 0) continue;
          wtTopWatched.appendChild(
            buildWtRankingItem(entry, formatDuration(entry.watchSeconds))
          );
        }
      }
    }
  } catch (err) {
    console.warn("renderWatchTimeSummary error:", err);
    showWatchTimeEmpty();
  }
}

function showWatchTimeEmpty() {
  if (wtEmpty) wtEmpty.classList.remove("hidden");
  if (wtTotalTime) wtTotalTime.textContent = "--";
  if (wtTotalChannels) wtTotalChannels.textContent = "--";
  if (wtTopWatched) wtTopWatched.innerHTML = "";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function handleExport() {
  try {
    const stored = await chrome.storage.local.get(BACKUP_KEYS);
    const backup = buildBackup(stored, { version: chrome.runtime.getManifest().version });
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Liberer l'URL tout de suite annulait parfois le telechargement : le
    // navigateur n'avait pas encore lu le blob.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    showFeedback(t("backup.exported"), "success");
  } catch (error) {
    console.error("Export error:", error);
    showFeedback(t("popup.osd.exportError"), "error");
  }
}

async function handleResetStats() {
  if (!confirm(t("popup.stats.confirmReset") || "Réinitialiser les statistiques ?")) return;

  if (btnResetStats) btnResetStats.disabled = true;
  try {
    await sendMessage({
      type: "resetStat",
      stat: "channelPointsClaimed",
    });
    await renderStats();
    showFeedback(t("popup.stats.resetSuccess") || "Statistiques remises à zéro", "success");
  } catch {
    showFeedback(t("popup.stats.resetError") || "Reset failed", "error");
  }
  if (btnResetStats) btnResetStats.disabled = false;
}

function handleImportClick() {
  // A file picker opened from the popup makes Chrome close the popup, which
  // dropped the chosen file without a word: restoring runs in its own tab.
  chrome.tabs.create({ url: chrome.runtime.getURL("html/restore.html") }, () => window.close());
}

function updateLanguageButtonsState() {
  if (!languageOptions) return;
  const active = getCurrentLanguage();
  languageOptions.querySelectorAll(".language-button").forEach((button) => {
    const isActive = button.dataset.lang === active;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function buildLanguageButtons() {
  if (!languageOptions) return;
  languageOptions.innerHTML = "";
  const languages = getAvailableLanguages();
  languages.forEach(({ code, label }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "language-button";
    button.dataset.lang = code;
    button.textContent = label;
    languageOptions.appendChild(button);
  });
  updateLanguageButtonsState();
}

function refreshTranslations() {
  applyTranslations(document);
  document.title = t("popup.title");
  syncDocumentLanguage("popup.htmlLang");
  state.preferences.language = getCurrentLanguage();
  renderStreamers();
  renderPreferences();
  renderStats();
  renderPlatformPicker();
  setSelectedPlatform(state.selectedPlatform);
}

async function handleLanguageClick(event) {
  const button = event.target.closest(".language-button");
  if (!button) return;
  const { lang } = button.dataset;
  if (!lang || lang === getCurrentLanguage()) return;
  await setLanguage(lang);
  showFeedback(t("popup.preferences.languageUpdated"), "success");
}

async function handleAddStreamer(event) {
  event.preventDefault();
  let rawValue = streamerInput?.value ?? "";

  if (state.selectedPlatform === "kishta") {
    rawValue = "Teuf";
  }

  const sanitized = sanitizeInput(rawValue);
  if (!sanitized) {
    showFeedback(
      t("popup.errors.invalidHandle", {
        platform: getPlatformLabel(state.selectedPlatform),
      }),
      "error"
    );
    return;
  }

  const submitButton = addStreamerForm.querySelector("button[type=submit]");
  if (submitButton) {
    submitButton.disabled = true;
  }
  showFeedback(t("popup.feedback.adding"), "success");

  const result = await sendMessage({
    type: "addStreamer",
    platform: state.selectedPlatform,
    handle: rawValue.trim(),
    displayName: rawValue.trim(),
  });

  if (submitButton) {
    submitButton.disabled = false;
  }

  if (result?.error) {
    showFeedback(result.error, "error");
    return;
  }

  // Track for slide-in animation
  lastAddedId = getHandleComparisonKey(state.selectedPlatform, sanitized);

  // eslint-disable-next-line require-atomic-updates -- vidage du champ apres l'ajout qui vient d'aboutir.
  streamerInput.value = "";
  showFeedback(
    t("popup.feedback.addSuccessPlatform", {
      handle: formatHandleForDisplay(state.selectedPlatform, sanitized),
      platform: getPlatformLabel(state.selectedPlatform),
    }),
    "success"
  );
  await loadStreamers();
}

async function updatePreferences(updates) {
  // Une valeur undefined disparait a la serialisation de sendMessage : la
  // charge utile arrivait vide au service worker, qui repondait « Aucune
  // preference a mettre a jour ». On filtre ici et on nomme la cle, pour que
  // le prochain cas soit lisible dans la console au lieu d'un bandeau muet.
  const dropped = Object.keys(updates).filter((k) => updates[k] === undefined);
  if (dropped.length) {
    console.warn("[SP] updatePreferences: valeur undefined ignoree pour", dropped);
  }
  const payload = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined)
  );
  if (Object.keys(payload).length === 0) return false;

  const result = await sendMessage({
    type: "updatePreferences",
    updates: payload,
  });

  if (result?.error) {
    showFeedback(result.error, "error");
    renderPreferences();
    return false;
  }

  state.preferences = {
    ...state.preferences,
    ...(result?.preferences || payload),
  };
  renderPreferences();

  // Un seul toast par reglage : le message specifique quand la cle en a un,
  // le « Reglage enregistre » generique sinon (avant, les deux s'empilaient).
  const SPECIFIC_TOASTS = {
    liveNotifications: ["popup.preferences.liveEnabled", "popup.preferences.liveDisabled"],
    gameNotifications: ["popup.preferences.gameEnabled", "popup.preferences.gameDisabled"],
    soundsEnabled: ["popup.preferences.soundsEnabled", "popup.preferences.soundsDisabled"],
    autoClaimChannelPoints: ["popup.preferences.autoClaimEnabled", "popup.preferences.autoClaimDisabled"],
    autoRefreshPlayerErrors: ["popup.preferences.autoRefreshEnabled", "popup.preferences.autoRefreshDisabled"],
    enablePipButton: ["popup.preferences.pipButtonEnabled", "popup.preferences.pipButtonDisabled"],
    enableClipDownload: ["popup.preferences.clipDownloadEnabled", "popup.preferences.clipDownloadDisabled"],
    keepQualityInBackground: ["popup.preferences.keepQualityEnabled", "popup.preferences.keepQualityDisabled"],
    enableFastForwardButton: ["popup.preferences.fastForwardEnabled", "popup.preferences.fastForwardDisabled"],
    watchTimeTracker: ["popup.preferences.watchTimeEnabled", "popup.preferences.watchTimeDisabled"],
  };
  const specificKey = Object.keys(SPECIFIC_TOASTS).find((key) => key in updates);
  const toastKey = specificKey
    ? SPECIFIC_TOASTS[specificKey][updates[specificKey] ? 0 : 1]
    : "popup.settings.saved";
  showFeedback(t(toastKey));

  return true;
}

function showMenuPanel(panelName, { focus = false } = {}) {
  document.querySelectorAll(".menu-tab").forEach((tab) => {
    const isActive = tab.dataset.panel === panelName;
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
    tab.tabIndex = isActive ? 0 : -1;
    if (isActive && focus) tab.focus();
  });
  document.querySelectorAll(".menu-panel").forEach((panel) => {
    panel.hidden = panel.id !== `menu-${panelName}`;
  });
  const panels = document.getElementById("menu-panels");
  if (panels) panels.scrollTop = 0;
}

function initMenuNav() {
  const nav = document.querySelector(".menu-nav");
  if (!nav) return;
  nav.addEventListener("click", (event) => {
    const tab = event.target.closest(".menu-tab");
    if (tab) showMenuPanel(tab.dataset.panel);
  });
  nav.addEventListener("keydown", (event) => {
    const list = Array.from(nav.querySelectorAll(".menu-tab")).filter((tab) => !tab.hidden);
    const index = list.indexOf(document.activeElement);
    if (index === -1) return;
    const targets = {
      ArrowDown: list[(index + 1) % list.length],
      ArrowUp: list[(index - 1 + list.length) % list.length],
      Home: list[0],
      End: list[list.length - 1],
    };
    const next = targets[event.key];
    if (!next) return;
    event.preventDefault();
    showMenuPanel(next.dataset.panel, { focus: true });
  });
}

/**
 * A vertical mouse wheel scrolls the live strip sideways, eased toward a target
 * so it glides instead of jumping 100px per notch. Trackpads keep their native
 * horizontal scrolling (deltaX), and reduced motion jumps straight there.
 */
function initStripWheel() {
  if (!streamerListEl) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let target = 0;
  let frame = 0;

  const glide = () => {
    const current = streamerListEl.scrollLeft;
    const distance = target - current;
    if (Math.abs(distance) < 1) {
      streamerListEl.scrollLeft = target;
      frame = 0;
      return;
    }
    streamerListEl.scrollLeft = current + distance * 0.2;
    frame = requestAnimationFrame(glide);
  };

  streamerListEl.addEventListener("wheel", (event) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    const max = streamerListEl.scrollWidth - streamerListEl.clientWidth;
    const step = event.deltaMode === 1 ? event.deltaY * 40 : event.deltaY;
    if (!frame) target = streamerListEl.scrollLeft;
    target = Math.round(Math.max(0, Math.min(max, target + step)));
    if (reduceMotion.matches) {
      streamerListEl.scrollLeft = target;
      return;
    }
    // Re-arm on every notch: a frame the browser dropped can never leave the
    // strip stuck.
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(glide);
  }, { passive: false });
}

function initHomeInteractions() {
  document.getElementById("stage-prev")?.addEventListener("click", () => stepFeatured(-1));
  document.getElementById("stage-next")?.addEventListener("click", () => stepFeatured(1));
  document.getElementById("open-all-channels")?.addEventListener("click", openSheet);
  document.getElementById("sheet-close")?.addEventListener("click", () => closeSheet());
  sheetScrimEl?.addEventListener("click", () => closeSheet());
  sheetEl?.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !event.defaultPrevented) closeSheet();
  });
  sheetSearchEl?.addEventListener("input", (event) => {
    state.sheetQuery = event.target.value;
    renderSheet();
  });
  initStripWheel();
  initDragAndDrop();
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Show skeleton placeholders immediately
    showSkeletons(3);

    // Storage round-trip: only the keys needed for first paint.
    // betaWatchTimeData can be large (months of records) and is only shown in the
    // Settings tab: load it lazily when that tab is opened.
    const _t0 = performance.now();
    const data = await chrome.storage.local.get([
      "betaGeneralStreamers",
      "betaGeneralStatuses",
      "betaGeneralPreferences",
      "betaGeneralStats",
      "userProfile",
      "betaPinnedIds",
      "betaChannelGroups",
    ]);
    const _storageMs = performance.now() - _t0;
    if (_storageMs > 200) {
      console.warn(`[SP] slow storage read: ${_storageMs.toFixed(0)}ms`, {
        streamers: (data.betaGeneralStreamers || []).length,
        statusesBytes: JSON.stringify(data.betaGeneralStatuses || {}).length,
        prefsBytes: JSON.stringify(data.betaGeneralPreferences || {}).length,
      });
    }

    // 1. Setup Language & I18n
    const prefs = data.betaGeneralPreferences || {};
    // Pass the raw stored value: initI18n normalizes it and falls back on its own.
    const lang = prefs.language;
    await initI18n(lang);
    applyTranslations(document);
    syncDocumentLanguage("popup.htmlLang");

    state.userProfile = data.userProfile || null;

    // Pre-fill pseudo input in settings
    if (pseudoInput) {
      pseudoInput.value = state.userProfile?.handle || state.userProfile?.displayName || "";
    }

    // 2. Setup State & Render UI Immediately
    state.streamers = data.betaGeneralStreamers || [];
    state.statuses = data.betaGeneralStatuses || {};
    if (Array.isArray(data.betaPinnedIds)) state.pinnedIds = data.betaPinnedIds;
    if (Array.isArray(data.betaChannelGroups)) state.groups = data.betaChannelGroups;
    state.preferences = { ...defaultPreferences, ...prefs };

    removeSkeletons();
    renderStreamers();
    renderPreferences();
    initTheme();
    renderPlatformPicker();
    setSelectedPlatform(state.selectedPlatform);

    // Render Stats (settings + header badge + V7 greeting bar): use pre-fetched data
    renderStats(data.betaGeneralStats || {}).catch(() => {});
    // Live-update stats when storage changes (points claimed while popup open)
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.betaGeneralStats) {
        renderStats();
      }
      // Statuses refreshed by the background while the popup is open.
      if (changes.betaGeneralStatuses) {
        state.statuses = changes.betaGeneralStatuses.newValue || {};
        renderStreamers();
      }
      // Only re-render watch time if the user is actually looking at it.
      // Otherwise we'd reload a potentially-large blob every 60s for nothing.
      if (changes.betaWatchTimeData && currentTab === "settings" && _watchTimeLoaded) {
        renderWatchTimeSummary().catch(() => {});
      }
    });

    // Le bloc « Temps » de la barre d'accueil vit dans l'onglet Streamers, pas
    // dans les reglages : le rendre uniquement a l'ouverture des reglages le
    // laissait bloque sur son « -- » de gabarit tant qu'on n'y etait pas passe.
    // On le rend donc apres la premiere peinture : la lecture du blob
    // betaWatchTimeData reste hors du chemin critique, et _watchTimeLoaded
    // evite un second rendu au premier passage dans les reglages.
    _watchTimeLoaded = true;
    renderWatchTimeSummary().catch(() => {});

    // 3. Setup UI Components
    const tabs = document.querySelectorAll(".tab-button");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const tabName = tab.dataset.tab;
        setActiveTab(tabName);
      });
    });
    // Motif ARIA tabs : flèches + Home/End avec tabindex itinérant (setActiveTab
    // gère déjà tabIndex), sur le modèle du menu latéral des réglages.
    document.querySelector(".tabs")?.addEventListener("keydown", (event) => {
      // Ordre et visibilité choisis dans « Disposition » : on relit le DOM.
      const list = Array.from(document.querySelectorAll(".tabs > .tab-button")).filter((tab) => !tab.hidden);
      const index = list.indexOf(document.activeElement);
      if (index === -1) return;
      const targets = {
        ArrowRight: list[(index + 1) % list.length],
        ArrowLeft: list[(index - 1 + list.length) % list.length],
        Home: list[0],
        End: list[list.length - 1],
      };
      const next = targets[event.key];
      if (!next) return;
      event.preventDefault();
      setActiveTab(next.dataset.tab);
      next.focus();
    });
    initMenuNav();
    initHomeInteractions();
    initFeatures().catch((error) => console.warn("[popup] features init failed:", error));

    if (streamerInput) {
      streamerInput.addEventListener("input", (e) => {
        const sanitized = sanitizeInput(e.target.value);
        if (sanitized) {
          const compKey = getHandleComparisonKey(state.selectedPlatform, sanitized);
          const exists = state.streamers.some(
            (s) =>
              getHandleComparisonKey(s.platform, s.handle || s.twitch) === compKey
          );
          if (exists) {
            e.target.classList.add("error");
          } else {
            e.target.classList.remove("error");
          }
        }
      });
    }

    platformPicker?.addEventListener("click", (e) => {
      const btn = e.target.closest(".platform-button");
      if (btn) {
        setSelectedPlatform(btn.dataset.platform);
      }
    });

    document.getElementById("sort-order")?.addEventListener("change", (e) => {
      updatePreferences({ sortOrder: e.target.value });
      renderStreamers();
    });

    // Platform filter buttons (EN DIRECT section)
    document.getElementById("platform-filter-group")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".pf-btn");
      if (!btn) return;
      document.querySelectorAll("#platform-filter-group .pf-btn").forEach((b) => {
        const isActive = b === btn;
        b.classList.toggle("active", isActive);
        b.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
      state.platformFilter = btn.dataset.filter || "all";
      renderStreamers();
    });

    // Log filter buttons
    document.getElementById("log-filter-group")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".pf-btn");
      if (!btn) return;
      document.querySelectorAll("#log-filter-group .pf-btn").forEach((b) => {
        const isActive = b === btn;
        b.classList.toggle("active", isActive);
        b.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
      currentLogFilter = btn.dataset.logFilter || "all";
      renderEventLogs().catch(() => {});
    });

    document.getElementById("btn-clear-logs")?.addEventListener("click", async () => {
      await chrome.runtime.sendMessage({ type: "clearEventLogs" });
      renderEventLogs().catch(() => {});
    });

    refreshButton?.addEventListener("click", async () => {
      refreshButton.disabled = true;
      const icon = refreshButton.querySelector("svg") || refreshButton;
      icon.classList.add("spin");
      await sendMessage({ type: "refreshStatuses" });
      await loadStreamers();
      icon.classList.remove("spin");
      // eslint-disable-next-line require-atomic-updates -- reactivation du bouton apres le rafraichissement qu'il a lance.
      refreshButton.disabled = false;
    });

    addStreamerForm?.addEventListener("submit", handleAddStreamer);
    soundsToggle?.addEventListener("change", (e) => {
      updatePreferences({ soundsEnabled: e.target.checked });
    });
    backgroundRaidAlertsToggle?.addEventListener("change", (e) => {
      // Suivre les raids rapporte des points : activer le détecteur coupe
      // l'annulation automatique, qui annulerait le raid avant qu'on le suive.
      const enableRaidAlerts = e.target.checked;
      updatePreferences({
        backgroundRaidAlerts: enableRaidAlerts,
        ...(enableRaidAlerts ? { autoCancelRaids: false } : {}),
      });
      if (enableRaidAlerts && autoCancelRaidsToggle) {
        autoCancelRaidsToggle.checked = false;
      }
    });
    autoClaimToggle?.addEventListener("change", (e) => {
      updatePreferences({ autoClaimChannelPoints: e.target.checked });
    });
    autoClaimDropsToggle?.addEventListener("change", (e) => {
      updatePreferences({ autoClaimDrops: e.target.checked });
    });
    autoClaimMomentsToggle?.addEventListener("change", (e) => {
      updatePreferences({ autoClaimMoments: e.target.checked });
    });
    autoOpenInventoryToggle?.addEventListener("change", (e) => {
      updatePreferences({ autoOpenInventory: e.target.checked });
    });
    autoOpenInventoryIntervalSelect?.addEventListener("change", (e) => {
      updatePreferences({ autoOpenInventoryIntervalHours: Number(e.target.value) });
    });
    hideTwitchExtensionsToggle?.addEventListener("change", (e) => {
      updatePreferences({ hideTwitchExtensions: e.target.checked });
    });
    autoCancelRaidsToggle?.addEventListener("change", (e) => {
      updatePreferences({ autoCancelRaids: e.target.checked });
    });
    preventTabDiscardToggle?.addEventListener("change", (e) => {
      updatePreferences({ preventTabDiscard: e.target.checked });
    });
    streamerFaviconToggle?.addEventListener("change", (e) => {
      updatePreferences({ enableStreamerFavicon: e.target.checked });
    });
    tabLiveIconToggle?.addEventListener("change", (e) => {
      updatePreferences({ enableTabLiveIcon: e.target.checked });
    });
    keepQualityToggle?.addEventListener("change", (e) => {
      updatePreferences({ keepQualityInBackground: e.target.checked });
    });
    pipButtonToggle?.addEventListener("change", (e) => {
      updatePreferences({ enablePipButton: e.target.checked });
    });
    autoRefreshToggle?.addEventListener("change", (e) => {
      updatePreferences({ autoRefreshPlayerErrors: e.target.checked });
    });
    clipDownloadToggle?.addEventListener("change", (e) => {
      updatePreferences({ enableClipDownload: e.target.checked });
    });
    playerQualitySelect?.addEventListener("change", (e) => {
      updatePreferences({ playerQuality: e.target.value });
    });
    previewsEnabledToggle?.addEventListener("change", (e) => {
      updatePreferences({ previewsEnabled: e.target.checked });
    });
    previewsDirectoryToggle?.addEventListener("change", (e) => {
      updatePreferences({ previewsSurfaceDirectory: e.target.checked });
    });
    previewsSidebarToggle?.addEventListener("change", (e) => {
      updatePreferences({ previewsSurfaceSidebar: e.target.checked });
    });
    previewsClipsToggle?.addEventListener("change", (e) => {
      updatePreferences({ previewsSurfaceClips: e.target.checked });
    });
    previewsSearchToggle?.addEventListener("change", (e) => {
      updatePreferences({ previewsSurfaceSearch: e.target.checked });
    });
    previewsAudioToggle?.addEventListener("change", (e) => {
      updatePreferences({ previewsAudio: e.target.checked });
    });
    previewsAnimationsToggle?.addEventListener("change", (e) => {
      updatePreferences({ previewsAnimations: e.target.checked });
    });
    previewsModeGroup?.querySelectorAll(".seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        previewsModeGroup.querySelectorAll(".seg-btn").forEach((b) => {
          b.classList.toggle("active", b === btn);
        });
        updatePreferences({ previewsMode: btn.dataset.previewsMode });
      });
    });
    previewsSizeGroup?.querySelectorAll(".seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        previewsSizeGroup.querySelectorAll(".seg-btn").forEach((b) => {
          b.classList.toggle("active", b === btn);
        });
        updatePreferences({ previewsSize: btn.dataset.previewsSize });
      });
    });
    if (previewsDelayInput) {
      previewsDelayInput.addEventListener("input", (e) => {
        if (previewsDelayValue) previewsDelayValue.textContent = String(e.target.value);
      });
      previewsDelayInput.addEventListener("change", (e) => {
        updatePreferences({ previewsShowDelayMs: Number(e.target.value) });
      });
    }

    if (fastForwardToggle) {
      fastForwardToggle.addEventListener("change", (e) => {
        updatePreferences({ enableFastForwardButton: e.target.checked });
      });
    }

    if (watchTimeToggle) {
      watchTimeToggle.addEventListener("change", (e) => {
        updatePreferences({ watchTimeTracker: e.target.checked });
      });
    }

    if (pointsTrackingToggle) {
      pointsTrackingToggle.addEventListener("change", (e) => {
        updatePreferences({ pointsTracking: e.target.checked });
      });
    }

    if (dropsTrackingToggle) {
      dropsTrackingToggle.addEventListener("change", (e) => {
        updatePreferences({ dropsTracking: e.target.checked });
      });
    }

    if (communityBadgeToggle) {
      badgeColorMode?.addEventListener("change", (e) => {
        const mode = e.target.value;
        const custom = mode === "custom";
        if (badgeColorValue) badgeColorValue.hidden = !custom;
        updatePreferences({
          communityBadgeColor: custom ? badgeColorValue?.value || "#9146ff" : mode,
        });
      });
      // "change" et non "input" : le selecteur de couleur emet en continu
      // pendant le glissement, ce qui declencherait un toast par pixel.
      badgeColorValue?.addEventListener("change", (e) => {
        updatePreferences({ communityBadgeColor: e.target.value });
      });

      communityBadgeToggle.addEventListener("change", (e) => {
        updatePreferences({ communityBadge: e.target.checked });
      });
    }

    if (watchTimeMonthSelect) {
      watchTimeMonthSelect.addEventListener("change", (e) => {
        renderWatchTimeSummary(e.target.value);
      });
    }

    if (chatKeywordsInput) {
      chatKeywordsInput.addEventListener("change", (e) => {
        updatePreferences({ chatKeywords: e.target.value });
      });
    }

    if (blockedUsersInput) {
      blockedUsersInput.addEventListener("change", (e) => {
        updatePreferences({ chatBlockedUsers: e.target.value });
      });
    }

    if (saveChatFilterButton) {
      saveChatFilterButton.addEventListener("click", async () => {
        const keywords = chatKeywordsInput?.value || "";
        const blocked = blockedUsersInput?.value || "";
        const ok = await updatePreferences({
          chatKeywords: keywords,
          chatBlockedUsers: blocked,
        });
        if (ok) {
          showFeedback(t("popup.feedback.chatFilterSaved"), "success");
          markButtonSuccess(saveChatFilterButton);
        }
      });
    }

    languageOptions?.addEventListener("click", handleLanguageClick);

    testNotificationButton?.addEventListener("click", async () => {
      const result = await sendMessage({ type: "testNotification" });
      if (result?.success) {
        showFeedback(t("popup.feedback.testSent"), "success");
        markButtonSuccess(testNotificationButton);
      }
    });

    btnExport?.addEventListener("click", handleExport);
    btnImport?.addEventListener("click", handleImportClick);
    btnResetStats?.addEventListener("click", handleResetStats);

    pseudoSaveButton?.addEventListener("click", handleSavePseudo);
    pseudoInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSavePseudo();
      }
    });

    buildLanguageButtons();
    setActiveTab("streamers");

    // Le popup est detruit a chaque fermeture, il n'y a pas de desabonnement
    // a conserver.
    onLanguageChange(() => {
      refreshTranslations();
    });

    // 4. Background Sync (Silent)
    sendMessage({ type: "getStreamers" }).catch(() => {});

    // Libère les connexions de l'embed Kick dès la fermeture de la popup pour
    // que la prochaine ouverture ne soit pas ralentie par des flux résiduels.
    window.addEventListener("pagehide", () => {
      document.querySelectorAll(".hover-player-wrap iframe").forEach((f) => {
        f.src = "about:blank";
      });
    }, { once: true });
  } catch (error) {
    console.error("Popup Init Error:", error);
    await initI18n();
    applyTranslations(document);
    loadStreamers();
  }
});

// Notes de version : elles ne s'ouvrent plus d'elles-memes a chaque mise a
// jour. Deux acces, l'un dans l'en-tete et l'autre dans les reglages, et une
// pastille sur les deux tant que la version n'a pas ete consultee.
{
  const headerButton = document.getElementById("header-patch-notes");
  const headerDot = document.getElementById("header-patch-dot");
  const dots = [patchNotesDot, headerDot].filter(Boolean);

  if (patchNotesButton || headerButton) {
    chrome.storage.local.get("patchNotesUnread", ({ patchNotesUnread }) => {
      dots.forEach((d) => (d.hidden = !patchNotesUnread));
    });

    const open = () => {
      dots.forEach((d) => (d.hidden = true));
      sendMessage({ type: "openPatchNotes" });
    };
    patchNotesButton?.addEventListener("click", open);
    headerButton?.addEventListener("click", open);
  }
}

// Recap : page dediee, ouverte dans un onglet (le popup se ferme au clic).
document.getElementById("open-recap")?.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("html/recap.html") }, () => window.close());
});
