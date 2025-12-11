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

const defaultPreferences = {
  liveNotifications: true,
  gameNotifications: false,
  soundsEnabled: true,
  autoClaimChannelPoints: true,
  autoRefreshPlayerErrors: true,
  enableFastForwardButton: true,
  language: DEFAULT_LANGUAGE,
};

const state = {
  streamers: [],
  statuses: {},
  preferences: { ...defaultPreferences },
  selectedPlatform: DEFAULT_PLATFORM,
};

const SOCIAL_ORDER = [
  "twitch",
  "youtube",
  "kick",
  "dlive",
  "instagram",
  "twitter",
  "tiktok",
  "discord",
  "spotify",
];

const SOCIAL_DEFINITIONS = {
  twitch: { label: "Twitch", icon: "../images/social/Twitch.png" },
  youtube: { label: "YouTube", icon: "../images/social/youtube.png" },
  kick: { label: "Kick", icon: "../images/social/Kick.png" },
  dlive: { label: "DLive", icon: "../images/social/dlive.svg" },
  instagram: { label: "Instagram", icon: "../images/social/instagram.png" },
  twitter: { label: "Twitter", icon: "../images/social/twitter.png" },
  tiktok: { label: "TikTok", icon: "../images/social/tiktok.png" },
  discord: { label: "Discord", icon: "../images/social/discord.png" },
  spotify: { label: "Spotify", icon: "../images/social/spotify.png" },
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

let feedbackTimer = null;
let currentTab = "streamers";
let unsubscribeLanguage = null;

function sanitizeInput(value = "", platform = state.selectedPlatform) {
  return sanitizeHandle(platform, value);
}

function showFeedback(message, type = "success") {
  if (!feedbackMessage) return;
  feedbackMessage.hidden = !message;
  feedbackMessage.textContent = message || "";
  feedbackMessage.classList.remove("success", "error");
  if (message) {
    feedbackMessage.classList.add(type === "error" ? "error" : "success");
  }

  if (feedbackTimer) {
    clearTimeout(feedbackTimer);
  }

  if (message) {
    feedbackTimer = setTimeout(() => {
      feedbackMessage.hidden = true;
      feedbackMessage.textContent = "";
    }, 4000);
  }
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
    button.classList.toggle("is-active", isActive);
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
  if (handlePrefix) {
    const definition = getPlatformDefinition(state.selectedPlatform);
    const prefix = definition.inputPrefix || "";
    handlePrefix.textContent = prefix;
    handlePrefix.classList.toggle("is-hidden", !prefix);
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

import { createStreamerCard, formatNumber } from "./ui.js";

// ... existing imports ...

// Removed duplicative functions moved to ui.js:
// buildThumbnailUrl, formatNumber, buildIdentityMeta, formatUpdatedAt, renderLastUpdate, renderSocialLinks, createStreamerCard

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

  const sortedStreamers = [...state.streamers].sort((a, b) => {
    const aStatus = state.statuses[a.id]?.active || {};
    const bStatus = state.statuses[b.id]?.active || {};
    const aLive = Boolean(aStatus.isLive);
    const bLive = Boolean(bStatus.isLive);
    
    if (aLive !== bLive) {
      return aLive ? -1 : 1;
    }
    return (a.displayName || "").localeCompare(b.displayName || "");
  });

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
         // Assuming success
         // We can show feedback here if needed, but the button state toggles visually in UI.js
         // Actually, UI.js toggles it *if* we return true.
         
         // Find streamer for message
         const s = state.streamers.find(x => x.id === id);
         const messageKey = enabled ? "popup.toast.notifyEnabled" : "popup.toast.notifyDisabled";
         // We might need to simplify feedback logic or import helper, 
         // but showFeedback is available in this scope.
         
         // Let's rely on generic success feedback or just mute it if it's too spammy.
         // Keeping original behavior:
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
    }
  };

  sortedStreamers.forEach((streamer) => {
    const status = state.statuses[streamer.id] || {};
    fragment.appendChild(createStreamerCard(streamer, status, template, callbacks));
  });

  streamerListEl.appendChild(fragment);
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
  if (chatKeywordsInput) {
    chatKeywordsInput.value = prefs.chatKeywords || "";
  }
  updateLanguageButtonsState();
}

function setActiveTab(tabName) {
  currentTab = tabName;
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle("active", isActive);
  });

  if (tabName === "streamers") {
    addStreamerSection?.classList.remove("hidden");
    streamerListEl?.classList.remove("hidden");
    settingsSection?.classList.add("hidden");
  } else {
    addStreamerSection?.classList.add("hidden");
    streamerListEl?.classList.add("hidden");
    settingsSection?.classList.remove("hidden");
  }
}

async function loadStreamers() {
  // Optimization: Read from storage directly to avoid waiting for Service Worker wakeup
  try {
    const data = await chrome.storage.local.get([
      "betaGeneralStreamers",
      "betaGeneralStatuses",
      "betaGeneralPreferences"
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

    // Optionally trigger a background refresh if needed, usually the alarm handles it.
    // We can fire a 'checking' message without waiting for it.
    sendMessage({ type: "getStreamers" }).catch(() => {});

  } catch (error) {
    console.error("Fast load failed:", error);
    // Fallback? usually storage failure is fatal anyway
  }
}

async function renderStats() {
  if (!statPointsEl) {
    console.warn("Stats element not found");
    return;
  }
  try {
    // Optimization: Read storage directly
    const data = await chrome.storage.local.get("betaGeneralStats");
    const stats = data.betaGeneralStats || {};
    const points = stats.channelPointsClaimed || 0;
    statPointsEl.textContent = formatNumber(points);
  } catch (err) {
    console.error("renderStats failed:", err);
    statPointsEl.textContent = "Err";
  }
}

async function handleExport() {
  const data = await chrome.storage.local.get(null);
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
    showFeedback("Erreur lors de la réinitialisation", "error");
  }
  if (btnResetStats) btnResetStats.disabled = false;
}

function handleImportClick() {
  fileImport?.click();
}

function handleFileImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const json = JSON.parse(e.target.result);
      if (typeof json === "object" && json !== null) {
        await chrome.storage.local.clear();
        await chrome.storage.local.set(json);
        showFeedback(t("popup.feedback.importSuccess"), "success");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        throw new Error("Invalid JSON");
      }
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
  const rawValue = streamerInput?.value ?? "";
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

async function handleRefresh() {
  refreshButton.disabled = true;
  showFeedback(t("popup.feedback.refreshing"), "success");
  await sendMessage({ type: "refreshStatuses" });
  await loadStreamers();
  refreshButton.disabled = false;
  showFeedback(t("popup.feedback.refreshDone"), "success");
}

async function updatePreferences(updates) {
  const result = await sendMessage({
    type: "updatePreferences",
    updates,
  });

  if (result?.error) {
    showFeedback(result.error, "error");
    renderPreferences();
    return;
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

}

async function handleTestNotification() {
  testNotificationButton.disabled = true;
  const result = await sendMessage({ type: "testNotification" });
  testNotificationButton.disabled = false;

  if (result?.error) {
    showFeedback(result.error, "error");
    return;
  }

  showFeedback(t("popup.feedback.testSent"), "success");
}


document.addEventListener("DOMContentLoaded", async () => {
  // Optimization: Fetch ALL data in one single async call to minimize latency
  try {
    const data = await chrome.storage.local.get([
      "betaGeneralStreamers",
      "betaGeneralStatuses",
      "betaGeneralPreferences",
      "betaGeneralStats"
    ]);

    // 1. Setup Language & I18n
    const prefs = data.betaGeneralPreferences || {};
    const lang = prefs.language || DEFAULT_LANGUAGE;
    await initI18n(lang);
    applyTranslations(document);
    syncDocumentLanguage("popup.htmlLang");

    // 2. Setup State & Render UI Immediately
    state.streamers = data.betaGeneralStreamers || [];
    state.statuses = data.betaGeneralStatuses || {};
    state.preferences = { ...defaultPreferences, ...prefs };
    
    // Render everything
    renderStreamers();
    renderPreferences();
    renderPlatformPicker();
    setSelectedPlatform(state.selectedPlatform);
    
    // Render Stats
    const stats = data.betaGeneralStats || {};
    if (statPointsEl) {
        statPointsEl.textContent = formatNumber(stats.channelPointsClaimed || 0);
    }
    
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

    refreshButton?.addEventListener("click", async () => {
      const icon = refreshButton.querySelector("svg") || refreshButton;
      icon.classList.add("spin");
      await loadStreamers();
      icon.classList.remove("spin");
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

    if (chatKeywordsInput) {
        chatKeywordsInput.addEventListener("change", (e) => {
        updatePreferences({ chatKeywords: e.target.value });
        });
    }

    languageOptions?.addEventListener("click", handleLanguageClick);

    testNotificationButton?.addEventListener("click", async () => {
      const result = await sendMessage({ type: "testNotification" });
      if (result?.success) {
        showFeedback(t("popup.toast.testNotificationSent"), "success");
      }
    });
    
    btnExport?.addEventListener("click", handleExport);
    btnImport?.addEventListener("click", handleImportClick);
    btnResetStats?.addEventListener("click", handleResetStats);
    fileImport?.addEventListener("change", handleFileImport);

    buildLanguageButtons();
    setActiveTab("streamers");
    
    unsubscribeLanguage = onLanguageChange(() => {
        refreshTranslations();
    });

    // 4. Background Sync (Optional, Silent)
    // Trigger background to check statuses if it hasn't lately
    sendMessage({ type: "getStreamers" }).catch(() => {});

  } catch (error) {
    console.error("Popup Init Error:", error);
    // Fallback safe init
    await initI18n();
    applyTranslations(document);
    loadStreamers();
  }
});
