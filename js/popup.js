import {
  initI18n,
  applyTranslations,
  setLanguage,
  onLanguageChange,
  getAvailableLanguages,
  getCurrentLanguage,
  t,
  syncDocumentLanguage,
  DEFAULT_LANGUAGE,
} from "./i18n.js";
import {
  AVAILABLE_PLATFORMS,
  DEFAULT_PLATFORM,
  PLATFORM_DEFINITIONS,
  buildProfileUrl,
  formatHandleForDisplay,
  getHandleComparisonKey,
  getPlatformLabelKey,
  getPlatformPlaceholderKey,
  normalizePlatform,
  platformSupportsLiveStatus,
  sanitizeHandle,
} from "./platforms.js";
import { createStreamerCard, formatNumber } from "./ui.js";

const PREFERENCES_STORAGE_KEY = "betaGeneralPreferences";

const defaultPreferences = {
  liveNotifications: true,
  gameNotifications: false,
  soundsEnabled: true,
  autoClaimChannelPoints: true,
  autoRefreshPlayerErrors: true,
  enableFastForwardButton: true,
  watchTimeTracker: true,
  language: DEFAULT_LANGUAGE,
  sortOrder: "live",
};

const state = {
  streamers: [],
  statuses: {},
  preferences: { ...defaultPreferences },
  selectedPlatform: DEFAULT_PLATFORM,
  userProfile: null,
};

const streamerListEl = document.getElementById("streamer-list");
const addStreamerForm = document.getElementById("add-streamer-form");
const streamerInput = document.getElementById("streamer-input");
const platformPicker = document.getElementById("platform-picker");
const handlePrefix = document.getElementById("handle-prefix");
const addStreamerLabel = addStreamerForm?.querySelector("label[for='streamer-input']");
const helperTextEl = addStreamerForm?.querySelector(".helper-text");
const refreshButton = document.getElementById("refresh-button");
const template = document.getElementById("streamer-item-template");
const feedbackMessage = document.getElementById("feedback-message");
const liveNotificationsToggle = document.getElementById("pref-live-notifications");
const gameAlertsToggle = document.getElementById("pref-game-alerts");
const soundsToggle = document.getElementById("pref-sounds");
const autoClaimToggle = document.getElementById("pref-auto-claim");
const autoRefreshToggle = document.getElementById("pref-auto-refresh");
const fastForwardToggle = document.getElementById("pref-fast-forward");
const chatKeywordsInput = document.getElementById("pref-chat-keywords");
const blockedUsersInput = document.getElementById("pref-blocked-users");
const saveChatFilterButton = document.getElementById("save-chat-filter");
const saveBlockedUsersButton = document.getElementById("save-blocked-users");
const testNotificationButton = document.getElementById("test-notification");
const tabButtons = Array.from(document.querySelectorAll(".tab-button"));
const addStreamerSection = document.querySelector(".add-streamer");
const settingsSection = document.getElementById("settings-section");
const languageOptions = document.getElementById("language-options-popup");

const statPointsEl = document.getElementById("stat-points");
const btnExport = document.getElementById("btn-export");
const btnImport = document.getElementById("btn-import");
const btnResetStats = document.getElementById("btn-reset-stats");
const fileImport = document.getElementById("file-import");
const headerPointsValue = document.getElementById("header-points-value");

const watchTimeMonthSelect = document.getElementById("watch-time-month");
const wtTotalTime = document.getElementById("wt-total-time");
const wtTotalChannels = document.getElementById("wt-total-channels");
const wtTopWatched = document.getElementById("wt-top-watched");
const wtEmpty = document.getElementById("wt-empty");
const watchTimeToggle = document.getElementById("pref-watch-time");

const pseudoInput = document.getElementById("pref-pseudo-input");
const pseudoSaveButton = document.getElementById("pref-pseudo-save");

const toastContainer = document.getElementById("toast-container");
const MAX_TOASTS = 5;
const TOAST_DURATION = 4000;

let currentTab = "streamers";
let unsubscribeLanguage = null;
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
    btn.classList.toggle("active", btn.dataset.themeValue === theme);
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
    const skeleton = document.createElement("div");
    skeleton.className = "skeleton-card";
    skeleton.innerHTML = `
      <div class="skeleton-avatar"></div>
      <div class="skeleton-lines">
        <div class="skeleton-line" style="width:70%"></div>
        <div class="skeleton-line" style="width:50%"></div>
      </div>
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

let lazyObserver = null;

function observeLazyIframes() {
  if (lazyObserver) {
    lazyObserver.disconnect();
  }

  lazyObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const iframe = entry.target;
        if (iframe.dataset.src) {
          requestAnimationFrame(() => {
            iframe.src = iframe.dataset.src;
            iframe.removeAttribute("data-src");
            iframe.classList.remove("lazy-iframe");
            observer.unobserve(iframe);
          });
        }
      }
    });
  }, {
    root: streamerListEl ? streamerListEl.parentNode : null,
    rootMargin: "200px",
    threshold: 0,
  });

  const candidates = document.querySelectorAll(".lazy-iframe");
  candidates.forEach((iframe) => lazyObserver.observe(iframe));
}

// --- Drag & Drop with ghost card preview ---
let dragSrcEl = null;
let dragGhost = null;

function removeGhost() {
  if (dragGhost) {
    dragGhost.remove();
    dragGhost = null;
  }
}

function createGhostClone(card) {
  const clone = card.cloneNode(true);
  clone.classList.remove("dragging");
  clone.classList.add("drag-ghost");
  clone.removeAttribute("draggable");
  // Strip interactive elements from clone
  clone.querySelectorAll("button, input, a, iframe").forEach((el) => {
    el.removeAttribute("onclick");
    el.style.pointerEvents = "none";
  });
  return clone;
}

const REAL_CARDS = ".streamer-card:not(.dragging):not(.drag-ghost)";


function initDragAndDrop() {
  if (!streamerListEl || streamerListEl._dragInit) return;
  streamerListEl._dragInit = true;

  streamerListEl.addEventListener("dragstart", (e) => {
    const card = e.target.closest(".streamer-card");
    if (!card) return;
    dragSrcEl = card;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", card.dataset.index);
    // Slight delay so browser captures drag image first
    requestAnimationFrame(() => card.classList.add("dragging"));
  });

  streamerListEl.addEventListener("dragend", () => {
    if (dragSrcEl) dragSrcEl.classList.remove("dragging");
    removeGhost();
    dragSrcEl = null;
  });

  streamerListEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  });

  streamerListEl.addEventListener("dragenter", (e) => {
    if (!dragSrcEl) return;
    const card = e.target.closest(REAL_CARDS);
    if (!card || card === dragSrcEl) return;

    if (!dragGhost) dragGhost = createGhostClone(dragSrcEl);

    const rect = card.getBoundingClientRect();
    const insertAfter = e.clientY > rect.top + rect.height / 2;
    if (insertAfter) {
      card.after(dragGhost);
    } else {
      card.before(dragGhost);
    }
  });

  streamerListEl.addEventListener("dragleave", (e) => {
    if (e.relatedTarget && !streamerListEl.contains(e.relatedTarget)) {
      removeGhost();
    }
  });

  streamerListEl.addEventListener("drop", async (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (!dragSrcEl) return;
    const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (isNaN(fromIndex)) { removeGhost(); return; }

    // Determine target index from ghost position
    const allCards = [...streamerListEl.querySelectorAll(REAL_CARDS)];
    let toIndex = allCards.length;

    if (dragGhost) {
      // Walk forward from ghost to find the next real card
      let sibling = dragGhost.nextElementSibling;
      while (sibling && sibling.classList.contains("drag-ghost")) {
        sibling = sibling.nextElementSibling;
      }
      if (sibling && sibling.classList.contains("streamer-card") && !sibling.classList.contains("dragging")) {
        const nextIdx = parseInt(sibling.dataset.index, 10);
        if (!isNaN(nextIdx)) toIndex = nextIdx;
      }
    }

    removeGhost();

    const adjustedTo = toIndex > fromIndex ? toIndex - 1 : toIndex;
    if (adjustedTo === fromIndex) return;

    const movedItem = state.streamers[fromIndex];
    const newStreamers = [...state.streamers];
    newStreamers.splice(fromIndex, 1);
    newStreamers.splice(adjustedTo, 0, movedItem);
    state.streamers = newStreamers;

    await chrome.storage.local.set({ betaGeneralStreamers: newStreamers });
    renderStreamers();
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

function renderStreamers() {
  if (!streamerListEl) return;
  streamerListEl.innerHTML = "";

  if (!state.streamers.length) {
    streamerListEl.classList.add("empty");
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.dataset.i18n = "popup.emptyState";
    applyTranslations(emptyState);
    streamerListEl.appendChild(emptyState);
    return;
  }

  streamerListEl.classList.remove("empty");
  const fragment = document.createDocumentFragment();

  // Sort streamers based on selected order (live-first keeps live cards before offline)
  const sortSelect = document.getElementById("sort-order");
  const sortMode = sortSelect?.value || "live";
  const streamersToRender = sortStreamers([...state.streamers], sortMode);

  const callbacks = {
    onToggleNotify: async (id, enabled) => {
      const result = await sendMessage({
        type: "toggleNotifications",
        id,
        enabled,
      });

      if (result?.error) {
        showFeedback(result.error, "error");
        return false;
      } else {
        const s = state.streamers.find((x) => x.id === id);
        const messageKey = enabled ? "popup.toast.notifyEnabled" : "popup.toast.notifyDisabled";
        if (s) {
          const platformId = s.platform || DEFAULT_PLATFORM;
          const name = s.displayName || formatHandleForDisplay(platformId, s.handle || s.twitch);
          showFeedback(t(messageKey, { name }), "success");
        }
        return true;
      }
    },
    onToggleGameNotify: async (id, enabled) => {
      const result = await sendMessage({
        type: "toggleGameNotifications",
        id,
        enabled,
      });

      if (result?.error) {
        showFeedback(result.error, "error");
        return false;
      } else {
        const s = state.streamers.find((x) => x.id === id);
        const messageKey = enabled ? "popup.toast.gameNotifyEnabled" : "popup.toast.gameNotifyDisabled";
        if (s) {
          const platformId = s.platform || DEFAULT_PLATFORM;
          const name = s.displayName || formatHandleForDisplay(platformId, s.handle || s.twitch);
          showFeedback(t(messageKey, { name }), "success");
        }
        return true;
      }
    },
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

  const currentLiveIds = new Set();

  streamersToRender.forEach((streamer, index) => {
    const status = state.statuses[streamer.id] || {};
    const activeStatus = status?.active || {};
    const cardFragment = createStreamerCard(streamer, status, template, callbacks);
    const card = cardFragment.querySelector(".streamer-card");
    card.dataset.id = streamer.id;
    card.dataset.index = index;
    if (sortMode !== "custom") card.removeAttribute("draggable");

    if (activeStatus.isLive) currentLiveIds.add(streamer.id);

    if (activeStatus.isLive && previousLiveIds.size > 0 && !previousLiveIds.has(streamer.id)) {
      card.classList.add("just-went-live");
      card.addEventListener("animationend", () => card.classList.remove("just-went-live"), { once: true });
    }

    card.addEventListener("click", (e) => {
      if (e.target.closest("button, .card-actions, .confirm-overlay, input, .hover-player-wrap")) return;
      const platformId = streamer.platform || DEFAULT_PLATFORM;
      const url = buildProfileUrl(platformId, streamer.handle || streamer.twitch || streamer.id);
      chrome.tabs.create({ url }, () => window.close());
    });
    card.style.cursor = "pointer";

    if (lastAddedId) {
      const compKey = getHandleComparisonKey(
        streamer.platform || DEFAULT_PLATFORM,
        streamer.handle || streamer.twitch
      );
      if (compKey === lastAddedId) {
        card.classList.add("card-enter");
        card.addEventListener("animationend", () => card.classList.remove("card-enter"), { once: true });
        lastAddedId = null;
      }
    }

    fragment.appendChild(cardFragment);
  });

  previousLiveIds = currentLiveIds;

  streamerListEl.appendChild(fragment);
  initDragAndDrop();
  observeLazyIframes();
}

function renderGreeting() {
  const greetingTitleEl = document.getElementById("greeting-title");
  if (!greetingTitleEl) return;
  const greetingName = state.userProfile?.displayName || state.userProfile?.handle || "";
  const hour = new Date().getHours();
  const salut = hour < 18 ? t("popup.greetingMorning") : t("popup.greetingEvening");
  const greetingSub = t("popup.greetingSub");
  const line1 = document.createTextNode(greetingName ? `${salut} ${greetingName}.` : `${salut}.`);
  const br = document.createElement("br");
  const sub = document.createElement("span");
  sub.className = "greeting-sub";
  sub.textContent = greetingSub;
  greetingTitleEl.replaceChildren(line1, br, sub);
}

async function handleSavePseudo() {
  if (!pseudoInput || !pseudoSaveButton) return;
  const raw = pseudoInput.value.trim();
  if (!raw) {
    showFeedback(t("popup.settings.pseudoEmpty") || "Pseudo vide", "error");
    return;
  }
  const previous = state.userProfile || {};
  const next = { ...previous, handle: raw, displayName: raw };

  pseudoSaveButton.disabled = true;
  const result = await sendMessage({ type: "updateUserProfile", profile: next });
  pseudoSaveButton.disabled = false;

  if (result?.success) {
    state.userProfile = next;
    renderGreeting();
    markButtonSuccess(pseudoSaveButton);
    showFeedback(t("popup.settings.pseudoSaved") || "Pseudo mis à jour", "success");
  } else {
    showFeedback(result?.error || t("popup.errors.generic"), "error");
  }
}

function renderPreferences() {
  const prefs = state.preferences || defaultPreferences;
  if (liveNotificationsToggle) {
    liveNotificationsToggle.checked = prefs.liveNotifications !== false;
  }
  if (gameAlertsToggle) {
    gameAlertsToggle.checked = Boolean(prefs.gameNotifications);
  }
  if (soundsToggle) {
    soundsToggle.checked = prefs.soundsEnabled !== false;
  }
  if (autoClaimToggle) {
    autoClaimToggle.checked = prefs.autoClaimChannelPoints !== false;
  }
  if (autoRefreshToggle) {
    autoRefreshToggle.checked = prefs.autoRefreshPlayerErrors !== false;
  }
  if (fastForwardToggle) {
    fastForwardToggle.checked = prefs.enableFastForwardButton !== false;
  }
  if (watchTimeToggle) {
    watchTimeToggle.checked = prefs.watchTimeTracker !== false;
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
function setActiveTab(tabName) {
  currentTab = tabName;
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle("active", isActive);
  });

  const streamersView = document.getElementById("streamers-view");
  if (tabName === "streamers") {
    streamersView?.classList.remove("hidden");
    settingsSection?.classList.add("hidden");
  } else {
    streamersView?.classList.add("hidden");
    settingsSection?.classList.remove("hidden");
    // Lazy-load watch time summary the first time settings is opened
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
    ]);

    state.streamers = data.betaGeneralStreamers || [];
    state.statuses = data.betaGeneralStatuses || {};
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

    // Header badge — animated bump
    if (headerPointsValue) animatePointsValue(headerPointsValue, points);

    // Greeting bar points block
    const headerPointsValue2 = document.getElementById("header-points-value2");
    if (headerPointsValue2) headerPointsValue2.textContent = formatted;
  } catch (err) {
    console.error("renderStats failed:", err);
    if (statPointsEl) statPointsEl.textContent = t("popup.stats.loadError") || "--";
    if (headerPointsValue) headerPointsValue.textContent = "--";
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
      const iconPath = platform === "kick" ? "images/social/Kick.png" : "images/social/Twitch.png";
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
    const icon = platform === "kick" ? "images/social/Kick.png" : "images/social/Twitch.png";
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
    // Read directly from storage — bypasses the service worker (MV3 can be sleeping)
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
          opt.textContent = date.toLocaleDateString(
            state.preferences.language === "fr" ? "fr-FR" : "en-US",
            { month: "long", year: "numeric" }
          );
          if (m === summary.month) opt.selected = true;
          watchTimeMonthSelect.appendChild(opt);
        }
      } else {
        const now = new Date();
        const opt = document.createElement("option");
        opt.textContent = now.toLocaleDateString(
          state.preferences.language === "fr" ? "fr-FR" : "en-US",
          { month: "long", year: "numeric" }
        );
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
  const raw = await chrome.storage.local.get([...ALLOWED_STORAGE_KEYS]);
  const data = {};
  for (const key of ALLOWED_STORAGE_KEYS) {
    if (key in raw) data[key] = raw[key];
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `streampulse-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
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
  } catch (err) {
    showFeedback(t("popup.stats.resetError") || "Reset failed", "error");
  }
  if (btnResetStats) btnResetStats.disabled = false;
}

function handleImportClick() {
  fileImport?.click();
}

const ALLOWED_STORAGE_KEYS = new Set([
  "betaGeneralStreamers",
  "betaGeneralStatuses",
  "betaGeneralStats",
  "betaGeneralPreferences",
  "betaWatchTimeData",
  "streampulse:scheduled",
  "streampulse:thumbCache",
]);

function sanitizeImportData(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const cleaned = {};
  for (const [key, value] of Object.entries(raw)) {
    if (ALLOWED_STORAGE_KEYS.has(key)) {
      cleaned[key] = value;
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

function handleFileImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const json = JSON.parse(e.target.result);
      const sanitized = sanitizeImportData(json);
      if (!sanitized) {
        throw new Error("Invalid or empty backup file");
      }
      const { onboardingShown } = await chrome.storage.local.get("onboardingShown");
      await chrome.storage.local.clear();
      if (onboardingShown) sanitized.onboardingShown = true;
      await chrome.storage.local.set(sanitized);
      showFeedback(t("popup.feedback.importSuccess"), "success");
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Import error:", error);
      showFeedback(t("popup.feedback.importError"), "error");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function updateLanguageButtonsState() {
  if (!languageOptions) return;
  const active = getCurrentLanguage();
  languageOptions.querySelectorAll(".language-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.lang === active);
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
  renderGreeting();
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

function handlePlatformPickerClick(event) {
  const button = event.target.closest(".platform-button");
  if (!button) return;
  const { platform } = button.dataset;
  if (!platform) return;
  setSelectedPlatform(platform);
}

async function updatePreferences(updates) {
  const result = await sendMessage({
    type: "updatePreferences",
    updates,
  });

  if (result?.error) {
    showFeedback(result.error, "error");
    renderPreferences();
    return false;
  }

  state.preferences = {
    ...state.preferences,
    ...(result?.preferences || updates),
  };
  renderPreferences();

  if ("liveNotifications" in updates) {
    const messageKey = updates.liveNotifications
      ? "popup.preferences.liveEnabled"
      : "popup.preferences.liveDisabled";
    showFeedback(t(messageKey), "success");
  }

  if ("gameNotifications" in updates) {
    const messageKey = updates.gameNotifications
      ? "popup.preferences.gameEnabled"
      : "popup.preferences.gameDisabled";
    showFeedback(t(messageKey), "success");
  }

  if ("soundsEnabled" in updates) {
    const messageKey = updates.soundsEnabled
      ? "popup.preferences.soundsEnabled"
      : "popup.preferences.soundsDisabled";
    showFeedback(t(messageKey), "success");
  }

  if ("autoClaimChannelPoints" in updates) {
    const messageKey = updates.autoClaimChannelPoints
      ? "popup.preferences.autoClaimEnabled"
      : "popup.preferences.autoClaimDisabled";
    showFeedback(t(messageKey), "success");
  }

  if ("autoRefreshPlayerErrors" in updates) {
    const messageKey = updates.autoRefreshPlayerErrors
      ? "popup.preferences.autoRefreshEnabled"
      : "popup.preferences.autoRefreshDisabled";
    showFeedback(t(messageKey), "success");
  }

  if ("enableFastForwardButton" in updates) {
    const messageKey = updates.enableFastForwardButton
      ? "popup.preferences.fastForwardEnabled"
      : "popup.preferences.fastForwardDisabled";
    showFeedback(t(messageKey), "success");
  }

  if ("watchTimeTracker" in updates) {
    const messageKey = updates.watchTimeTracker
      ? "popup.preferences.watchTimeEnabled"
      : "popup.preferences.watchTimeDisabled";
    showFeedback(t(messageKey), "success");
  }

  return true;
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Show skeleton placeholders immediately
    showSkeletons(3);

    // Storage round-trip — only the keys needed for first paint.
    // betaWatchTimeData can be large (months of records) and is only shown in the
    // Settings tab — load it lazily when that tab is opened.
    const _t0 = performance.now();
    const data = await chrome.storage.local.get([
      "betaGeneralStreamers",
      "betaGeneralStatuses",
      "betaGeneralPreferences",
      "betaGeneralStats",
      "userProfile",
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
    const lang = prefs.language || DEFAULT_LANGUAGE;
    await initI18n(lang);
    applyTranslations(document);
    syncDocumentLanguage("popup.htmlLang");

    // Setup Greeting V7 — #greeting-title + old header fallback
    state.userProfile = data.userProfile || null;
    renderGreeting();

    // Pre-fill pseudo input in settings
    if (pseudoInput) {
      pseudoInput.value = state.userProfile?.handle || state.userProfile?.displayName || "";
    }

    // 2. Setup State & Render UI Immediately
    state.streamers = data.betaGeneralStreamers || [];
    state.statuses = data.betaGeneralStatuses || {};
    state.preferences = { ...defaultPreferences, ...prefs };

    removeSkeletons();
    renderStreamers();
    renderPreferences();
    initTheme();
    renderPlatformPicker();
    setSelectedPlatform(state.selectedPlatform);

    // Render Stats (settings + header badge + V7 greeting bar) — use pre-fetched data
    renderStats(data.betaGeneralStats || {}).catch(() => {});
    // V7 live viewers total
    const updateV7Stats = () => {
      const liveStreamers = state.streamers.filter(s => state.statuses[s.id]?.active?.isLive);
      const totalViewers = liveStreamers.reduce((acc, s) => acc + (state.statuses[s.id]?.viewers || 0), 0);
      const statViewersEl = document.getElementById("stat-viewers");
      if (statViewersEl) statViewersEl.textContent = totalViewers > 0 ? formatNumber(totalViewers) : "--";
      const liveCountEl = document.getElementById("live-count");
      if (liveCountEl) liveCountEl.textContent = String(liveStreamers.length).padStart(2, "0");
      const offlineCountEl = document.getElementById("offline-count");
      if (offlineCountEl) offlineCountEl.textContent = String(state.streamers.length - liveStreamers.length).padStart(2, "0");
      const greetingLiveCountEl = document.getElementById("greeting-live-count");
      if (greetingLiveCountEl) greetingLiveCountEl.textContent = `${liveStreamers.length} streamer${liveStreamers.length > 1 ? "s" : ""} en live`;
    };
    updateV7Stats();

    // Live-update stats when storage changes (points claimed while popup open)
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.betaGeneralStats) {
        renderStats();
      }
      // Only re-render watch time if the user is actually looking at it.
      // Otherwise we'd reload a potentially-large blob every 60s for nothing.
      if (changes.betaWatchTimeData && currentTab === "settings" && _watchTimeLoaded) {
        renderWatchTimeSummary().catch(() => {});
      }
    });

    // Watch time summary is rendered lazily when the Settings tab opens
    // (see setActiveTab) — keeps initial popup paint fast even when the
    // betaWatchTimeData blob is large.

    // 3. Setup UI Components
    const tabs = document.querySelectorAll(".tab-button");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const tabName = tab.dataset.tab;
        setActiveTab(tabName);
      });
    });

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
      document.querySelectorAll(".pf-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const filter = btn.dataset.filter;
      document.querySelectorAll("#streamer-list .streamer-card").forEach(card => {
        if (filter === "all") {
          card.hidden = false;
        } else {
          card.hidden = card.dataset.platform !== filter;
        }
      });
    });

    refreshButton?.addEventListener("click", async () => {
      refreshButton.disabled = true;
      const icon = refreshButton.querySelector("svg") || refreshButton;
      icon.classList.add("spin");
      await sendMessage({ type: "refreshStatuses" });
      await loadStreamers();
      icon.classList.remove("spin");
      refreshButton.disabled = false;
    });

    addStreamerForm?.addEventListener("submit", handleAddStreamer);
    liveNotificationsToggle?.addEventListener("change", (e) => {
      updatePreferences({ liveNotifications: e.target.checked });
    });
    gameAlertsToggle?.addEventListener("change", (e) => {
      updatePreferences({ gameNotifications: e.target.checked });
    });
    soundsToggle?.addEventListener("change", (e) => {
      updatePreferences({ soundsEnabled: e.target.checked });
    });
    autoClaimToggle?.addEventListener("change", (e) => {
      updatePreferences({ autoClaimChannelPoints: e.target.checked });
    });
    autoRefreshToggle?.addEventListener("change", (e) => {
      updatePreferences({ autoRefreshPlayerErrors: e.target.checked });
    });

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

    if (saveBlockedUsersButton) {
      saveBlockedUsersButton.addEventListener("click", async () => {
        const blocked = blockedUsersInput?.value || "";
        const ok = await updatePreferences({
          chatBlockedUsers: blocked,
        });
        if (ok) {
          showFeedback(t("popup.feedback.blockedUsersSaved"), "success");
          markButtonSuccess(saveBlockedUsersButton);
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
    fileImport?.addEventListener("change", handleFileImport);

    pseudoSaveButton?.addEventListener("click", handleSavePseudo);
    pseudoInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSavePseudo();
      }
    });

    buildLanguageButtons();
    setActiveTab("streamers");

    unsubscribeLanguage = onLanguageChange(() => {
      refreshTranslations();
    });

    // 4. Background Sync (Silent)
    sendMessage({ type: "getStreamers" }).catch(() => {});

    // Free Kick embed connections immediately on popup close so the next
    // open isn't delayed by lingering network streams.
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
