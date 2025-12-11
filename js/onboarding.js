import {
  initI18n,
  applyTranslations,
  setLanguage,
  onLanguageChange,
  getAvailableLanguages,
  getCurrentLanguage,
  t,
  syncDocumentLanguage,
} from "./i18n.js";
import {
  AVAILABLE_PLATFORMS,
  DEFAULT_PLATFORM,
  PLATFORM_DEFINITIONS,
  formatHandleForDisplay,
  getPlatformLabelKey,
  getPlatformPlaceholderKey,
  normalizePlatform,
  sanitizeHandle,
} from "./platforms.js";

const form = document.getElementById("onboarding-form");
const input = document.getElementById("streamer-input");
const platformPicker = document.getElementById("onboarding-platform-picker");
const handlePrefix = document.getElementById("onboarding-handle-prefix");
const submitButton = document.getElementById("submit-button");
const feedback = document.getElementById("feedback");
const nextSteps = document.getElementById("next-steps");
const currentStreamersSection = document.getElementById("current-streamers");
const streamerList = document.getElementById("streamer-list");
const finishButton = document.getElementById("finish-button");
const languageOptions = document.getElementById("language-options");
const helperText = form?.querySelector(".helper-text");
const formLabel = form?.querySelector("label[for='streamer-input']");
const preferenceToggleDefinitions = [
  {
    element: document.getElementById("onboarding-live-notifications"),
    key: "liveNotifications",
  },
  {
    element: document.getElementById("onboarding-game-alerts"),
    key: "gameNotifications",
  },
  {
    element: document.getElementById("onboarding-sounds"),
    key: "soundsEnabled",
  },
  {
    element: document.getElementById("onboarding-auto-refresh"),
    key: "autoRefreshPlayerErrors",
  },
  {
    element: document.getElementById("onboarding-fast-forward"),
    key: "enableFastForwardButton",
  },
  {
    element: document.getElementById("onboarding-auto-claim"),
    key: "autoClaimChannelPoints",
  },
];

let currentStreamers = [];
let unsubscribeLanguage = null;
let currentPreferences = null;
let selectedPlatform = DEFAULT_PLATFORM;

function sanitizeInput(value = "", platform = selectedPlatform) {
  return sanitizeHandle(platform, value);
}

function setLoading(isLoading) {
  if (submitButton) {
    submitButton.disabled = isLoading;
  }
}

function showFeedback(message = "", type = "success") {
  if (!feedback) return;
  feedback.hidden = !message;
  feedback.textContent = message || "";
  feedback.classList.remove("success", "error");
  if (message) {
    feedback.classList.add(type === "error" ? "error" : "success");
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
    const isActive = btnPlatform === selectedPlatform;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.title = getPlatformLabel(btnPlatform);
  });
}

function updatePlatformTexts() {
  const platformLabel = getPlatformLabel(selectedPlatform);
  if (formLabel) {
    formLabel.textContent = t("onboarding.formLabelPlatform", {
      platform: platformLabel,
    });
  }
  if (helperText) {
    helperText.textContent = t("onboarding.helperTextPlatform", {
      platform: platformLabel,
    });
  }
  if (input) {
    const placeholderKey =
      getPlatformPlaceholderKey(selectedPlatform, "onboarding") ||
      getPlatformPlaceholderKey(selectedPlatform, "popup");
    input.placeholder = placeholderKey ? t(placeholderKey) : "";
  }
  if (handlePrefix) {
    const prefix = getPlatformDefinition(selectedPlatform).inputPrefix || "";
    handlePrefix.textContent = prefix;
    handlePrefix.classList.toggle("is-hidden", !prefix);
  }
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
    button.title = t(getPlatformLabelKey(definition.id));

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

function setSelectedPlatform(platform) {
  selectedPlatform = normalizePlatform(platform);
  updatePlatformPickerUI();
  updatePlatformTexts();
}

function handlePlatformPickerClick(event) {
  const button = event.target.closest(".platform-button");
  if (!button) return;
  const { platform } = button.dataset;
  if (!platform) return;
  setSelectedPlatform(platform);
}

async function addStreamer(rawValue, platform = selectedPlatform) {
  try {
    return await chrome.runtime.sendMessage({
      type: "addStreamer",
      platform,
      handle: rawValue,
      displayName: rawValue,
    });
  } catch (error) {
    console.error("Onboarding add streamer error:", error);
    return { error: t("onboarding.errors.extensionUnavailable") };
  }
}

async function removeStreamer(streamerId) {
  try {
    return await chrome.runtime.sendMessage({
      type: "removeStreamer",
      id: streamerId,
    });
  } catch (error) {
    console.error("Onboarding remove streamer error:", error);
    return { error: t("onboarding.errors.removeFailed") };
  }
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

function renderStreamers(streamers = []) {
  if (!currentStreamersSection || !streamerList) return;

  streamerList.innerHTML = "";

  if (!streamers.length) {
    currentStreamersSection.hidden = true;
    if (nextSteps) nextSteps.hidden = true;
    if (finishButton) finishButton.disabled = true;
    return;
  }

  currentStreamersSection.hidden = false;
  if (nextSteps) nextSteps.hidden = false;
  if (finishButton) finishButton.disabled = false;

  const runtime =
    (typeof chrome !== "undefined" && chrome.runtime) ||
    (typeof browser !== "undefined" && browser.runtime) ||
    null;
  const fallbackAvatar = runtime
    ? runtime.getURL("images/photos/avatars/default-48.png")
    : "../images/photos/avatars/default-48.png";

  streamers.forEach((streamer) => {
    const item = document.createElement("li");
    item.className = "streamer-item";

    const info = document.createElement("div");
    info.className = "streamer-info";

    const avatar = document.createElement("img");
    avatar.className = "streamer-avatar";
    const platformId = streamer.platform || DEFAULT_PLATFORM;
    const definition = getPlatformDefinition(platformId);
    const platformIcon = runtime
      ? runtime.getURL(definition.icon)
      : `../${definition.icon}`;
    avatar.src =
      streamer.avatarUrl || platformIcon || fallbackAvatar;
    const handleLabel = formatHandleForDisplay(
      platformId,
      streamer.handle || streamer.twitch
    );
    avatar.alt = streamer.displayName || handleLabel || "Streamer";
    avatar.referrerPolicy = "no-referrer";
    avatar.onerror = () => {
      avatar.src = platformIcon || fallbackAvatar;
    };

    const name = document.createElement("span");
    name.className = "streamer-name";
    const platformLabel = t(getPlatformLabelKey(platformId));
    if (streamer.displayName) {
      name.textContent = `${streamer.displayName} • ${platformLabel}`;
    } else {
      name.textContent = `${handleLabel} • ${platformLabel}`;
    }

    info.append(avatar, name);

    const removeButton = document.createElement("button");
    removeButton.className = "remove-streamer";
    removeButton.type = "button";
    removeButton.dataset.streamerId = streamer.id;
    removeButton.dataset.i18n = "onboarding.removeStreamer";

    item.append(info, removeButton);
    streamerList.appendChild(item);
    applyTranslations(item);
  });
}

function renderPreferenceToggles(preferences = {}) {
  preferenceToggleDefinitions.forEach(({ element, key }) => {
    if (!element) return;
    const enabled = preferences[key] !== false;
    element.checked = enabled;
  });
}

async function updatePreferenceToggle({ element, key }, enabled) {
  const previous = currentPreferences?.[key] !== false;
  try {
    const response = await chrome.runtime.sendMessage({
      type: "updatePreferences",
      updates: { [key]: enabled },
    });
    if (response?.error) {
      showFeedback(response.error, "error");
      if (element) {
        element.checked = previous;
      }
      return;
    }
    const nextPreferences =
      response?.preferences || {
        ...(currentPreferences || {}),
        [key]: enabled,
      };
    currentPreferences = nextPreferences;
    renderPreferenceToggles(currentPreferences);
  } catch (error) {
    console.error("Onboarding preference update error:", error);
    showFeedback(t("onboarding.errors.extensionUnavailable"), "error");
    if (element) {
      element.checked = previous;
    }
  }
}

async function loadStreamers() {
  let response = null;
  try {
    response = await chrome.runtime.sendMessage({
      type: "getStreamers",
    });
  } catch (error) {
    console.error("Onboarding load streamers error:", error);
  }
  currentStreamers = response?.streamers || [];
  currentPreferences = response?.preferences || currentPreferences || {};
  renderStreamers(currentStreamers);
  renderPreferenceToggles(currentPreferences);
}

function refreshTranslations() {
  applyTranslations(document);
  document.title = t("onboarding.documentTitle");
  syncDocumentLanguage("onboarding.htmlLang");
  updateLanguageButtonsState();
  renderStreamers(currentStreamers);
  renderPreferenceToggles(currentPreferences || {});
  renderPlatformPicker();
  setSelectedPlatform(selectedPlatform);
}

async function handleLanguageClick(event) {
  const button = event.target.closest(".language-button");
  if (!button) return;
  const { lang } = button.dataset;
  if (!lang) return;
  await setLanguage(lang);
}

function registerEventListeners() {
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const rawValue = input?.value ?? "";
    const sanitized = sanitizeInput(rawValue);
    if (!sanitized) {
      showFeedback(
        t("onboarding.feedback.invalidHandle", {
          platform: getPlatformLabel(selectedPlatform),
        }),
        "error"
      );
      return;
    }

    setLoading(true);
    showFeedback(t("onboarding.feedback.adding"), "success");

    const result = await addStreamer(rawValue.trim(), selectedPlatform);

    setLoading(false);

    if (result?.error) {
      showFeedback(result.error, "error");
      return;
    }

    showFeedback(
      t("onboarding.feedback.addSuccessPlatform", {
        handle: formatHandleForDisplay(selectedPlatform, sanitized),
        platform: getPlatformLabel(selectedPlatform),
      }),
      "success"
    );
    form.reset();
    updatePlatformTexts();
    await loadStreamers();
  });

  platformPicker?.addEventListener("click", handlePlatformPickerClick);

  streamerList?.addEventListener("click", async (event) => {
    const button = event.target.closest(".remove-streamer");
    if (!button) return;
    const streamerId = button.dataset.streamerId;
    if (!streamerId) return;

    button.disabled = true;
    const result = await removeStreamer(streamerId);
    button.disabled = false;

    if (result?.error) {
      showFeedback(result.error, "error");
      return;
    }

    showFeedback(t("onboarding.feedback.removeSuccess"), "success");
    await loadStreamers();
  });

  preferenceToggleDefinitions.forEach((definition) => {
    definition.element?.addEventListener("change", (event) => {
      updatePreferenceToggle(definition, event.target.checked);
    });
  });

  languageOptions?.addEventListener("click", handleLanguageClick);

  finishButton?.addEventListener("click", () => {
    window.close();
  });
}

async function initialize() {
  await initI18n();
  buildLanguageButtons();
  refreshTranslations();
  registerEventListeners();

  unsubscribeLanguage = onLanguageChange(() => {
    refreshTranslations();
  });

  await loadStreamers();
}

initialize().catch((error) => {
  console.error("Onboarding initialization error:", error);
});

window.addEventListener("unload", () => {
  if (typeof unsubscribeLanguage === "function") {
    unsubscribeLanguage();
  }
});
