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

/* ── DOM refs ── */
const form = document.getElementById("onboarding-form");
const input = document.getElementById("streamer-input");
const platformPicker = document.getElementById("onboarding-platform-picker");
const handlePrefix = document.getElementById("onboarding-handle-prefix");
const submitButton = document.getElementById("submit-button");
const feedback = document.getElementById("feedback");
const currentStreamersSection = document.getElementById("current-streamers");
const streamerList = document.getElementById("streamer-list");
const streamerCount = document.getElementById("streamer-count");
const finishButton = document.getElementById("finish-button");
const finishNameSuffix = document.getElementById("finish-name-suffix");
const languageOptions = document.getElementById("language-options");
const stepperEl = document.getElementById("stepper");
const stepCounterCurrent = document.getElementById("step-counter-current");

/* Profile (NEW) */
const profileInput = document.getElementById("profile-input");
const profileInputCount = document.getElementById("profile-input-count");
const profileAvatar = document.getElementById("profile-avatar");
const profileAvatarInitials = document.getElementById("profile-avatar-initials");
const profileAvatarImg = document.getElementById("profile-avatar-img");
const profileAvatarSpinner = document.getElementById("profile-avatar-spinner");
const profileAvatarStatus = document.getElementById("profile-avatar-status");
const profileHint = document.getElementById("profile-hint");
const profilePreviewName = document.getElementById("profile-preview-name");
const btnNext1 = document.getElementById("btn-next-1");

const preferenceToggleDefinitions = [
  { element: document.getElementById("onboarding-live-notifications"), key: "liveNotifications" },
  { element: document.getElementById("onboarding-game-alerts"), key: "gameNotifications" },
  { element: document.getElementById("onboarding-sounds"), key: "soundsEnabled" },
  { element: document.getElementById("onboarding-auto-refresh"), key: "autoRefreshPlayerErrors" },
  { element: document.getElementById("onboarding-fast-forward"), key: "enableFastForwardButton" },
  { element: document.getElementById("onboarding-auto-claim"), key: "autoClaimChannelPoints" },
];

const LANGUAGE_FLAGS = { fr: "🇫🇷", en: "🇬🇧", es: "🇪🇸", de: "🇩🇪", it: "🇮🇹", pt: "🇵🇹" };

/* ── State ── */
let currentStreamers = [];
let unsubscribeLanguage = null;
let currentPreferences = null;
let selectedPlatform = DEFAULT_PLATFORM;
let currentStep = 0;
const TOTAL_STEPS = 5;

let userProfile = { handle: "", displayName: "", avatarUrl: "" };
let profileLookupTimer = null;
let profileLookupSeq = 0;

/* ════════════════════════════════
   WIZARD NAVIGATION
   ════════════════════════════════ */
function goToStep(targetStep, direction = "forward") {
  if (targetStep < 0 || targetStep >= TOTAL_STEPS || targetStep === currentStep) return;

  const currentEl = document.querySelector(`.wizard-step[data-step="${currentStep}"]`);
  const targetEl = document.querySelector(`.wizard-step[data-step="${targetStep}"]`);
  if (!currentEl || !targetEl) return;

  const outClass = direction === "forward" ? "slide-out-left" : "slide-out-right";
  currentEl.classList.add(outClass);

  currentEl.addEventListener("animationend", () => {
    currentEl.classList.remove("active", outClass);
    targetEl.classList.add("active");
    currentStep = targetStep;
    updateStepper();
    if (targetStep === 4) renderFinishName();
  }, { once: true });
}

function updateStepper() {
  const pills = document.querySelectorAll(".step-pill");
  pills.forEach((pill, i) => {
    pill.classList.toggle("active", i === currentStep);
    pill.classList.toggle("completed", i < currentStep);
  });
  if (stepCounterCurrent) {
    stepCounterCurrent.textContent = String(currentStep + 1).padStart(2, "0");
  }
}

/* ════════════════════════════════
   PROFILE STEP
   ════════════════════════════════ */
function setAvatarStatus(state) {
  if (!profileAvatarStatus) return;
  profileAvatarStatus.dataset.state = state;
  if (state === "found") profileAvatarStatus.textContent = "";
  else if (state === "searching") profileAvatarStatus.textContent = "…";
  else if (state === "error") profileAvatarStatus.textContent = "!";
  else profileAvatarStatus.textContent = "·";
}

function setHintState(state, text) {
  if (!profileHint) return;
  profileHint.dataset.state = state;
  profileHint.textContent = text;
}

function setProfileAvatarImage(url) {
  if (!profileAvatar || !profileAvatarImg) return;
  if (url) {
    profileAvatarImg.src = url;
    profileAvatarImg.hidden = false;
    profileAvatar.classList.add("has-image");
  } else {
    profileAvatarImg.hidden = true;
    profileAvatarImg.removeAttribute("src");
    profileAvatar.classList.remove("has-image");
  }
}

function renderProfileFromState() {
  const handle = userProfile.handle || "";
  const display = userProfile.displayName || handle;
  const initials = (display || "?").slice(0, 2).toUpperCase();

  if (profileAvatarInitials) profileAvatarInitials.textContent = handle ? initials : "?";
  if (profileAvatar) profileAvatar.classList.toggle("has-value", Boolean(handle));

  if (profilePreviewName) {
    profilePreviewName.textContent = display || "—";
  }

  if (profileInputCount) profileInputCount.textContent = String((profileInput?.value || "").length);

  if (btnNext1) btnNext1.disabled = !handle;
}

async function lookupTwitchProfile(handle) {
  /* Ask the background to resolve the Twitch user. background.js exposes a
     "lookupTwitchUser" handler (added alongside this redesign).  Falls back
     gracefully to initials-only if the runtime isn't available. */
  try {
    const response = await chrome.runtime.sendMessage({
      type: "lookupTwitchUser",
      handle,
    });
    if (response?.error) return null;
    return response?.user || null;
  } catch (err) {
    console.warn("Twitch profile lookup failed:", err);
    return null;
  }
}

function scheduleProfileLookup(rawValue) {
  if (profileLookupTimer) clearTimeout(profileLookupTimer);
  const handle = (rawValue || "").trim().replace(/^@/, "");

  if (!handle) {
    userProfile = { handle: "", displayName: "", avatarUrl: "" };
    setProfileAvatarImage("");
    setAvatarStatus("idle");
    setHintState("idle", t("onboarding.profileHintIdle"));
    if (profileAvatarSpinner) profileAvatarSpinner.hidden = true;
    renderProfileFromState();
    return;
  }

  /* Optimistic local state — show initials + enable Continue immediately */
  userProfile = { handle, displayName: handle, avatarUrl: "" };
  setProfileAvatarImage("");
  renderProfileFromState();
  setAvatarStatus("searching");
  setHintState("searching", t("onboarding.profileHintSearching"));
  if (profileAvatarSpinner) profileAvatarSpinner.hidden = false;

  const seq = ++profileLookupSeq;
  profileLookupTimer = setTimeout(async () => {
    const user = await lookupTwitchProfile(handle);
    if (seq !== profileLookupSeq) return; /* superseded */

    if (profileAvatarSpinner) profileAvatarSpinner.hidden = true;

    if (user) {
      userProfile = {
        handle,
        displayName: user.display_name || user.displayName || handle,
        avatarUrl: user.profile_image_url || user.avatarUrl || "",
      };
      setProfileAvatarImage(userProfile.avatarUrl);
      setAvatarStatus("found");
      setHintState("found", t("onboarding.profileHintFound", { handle: userProfile.displayName }));
    } else {
      userProfile = { handle, displayName: handle, avatarUrl: "" };
      setProfileAvatarImage("");
      setAvatarStatus("error");
      setHintState("error", t("onboarding.profileHintNotFound"));
    }
    renderProfileFromState();
  }, 450);
}

async function saveUserProfile() {
  try {
    await chrome.runtime.sendMessage({
      type: "updateUserProfile",
      profile: userProfile,
    });
  } catch (err) {
    console.warn("Save profile failed:", err);
  }
}

function renderFinishName() {
  if (!finishNameSuffix) return;
  const name = userProfile.displayName || userProfile.handle;
  finishNameSuffix.textContent = name ? `, ${name}` : "";
}

/* ════════════════════════════════
   PLATFORM / INPUT HELPERS
   ════════════════════════════════ */
function sanitizeInput(value = "", platform = selectedPlatform) {
  return sanitizeHandle(platform, value);
}

function setLoading(isLoading) {
  if (submitButton) submitButton.disabled = isLoading;
}

function showFeedback(message = "", type = "success") {
  if (!feedback) return;
  feedback.hidden = !message;
  feedback.textContent = message || "";
  feedback.classList.remove("success", "error");
  if (message) feedback.classList.add(type === "error" ? "error" : "success");
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
  const stepTitle = document.querySelector('.wizard-step[data-step="2"] .step-title');
  const stepDesc = document.querySelector('.wizard-step[data-step="2"] .step-desc');
  if (stepTitle) {
    stepTitle.textContent = t("onboarding.formLabelPlatform", { platform: platformLabel });
  }
  if (stepDesc) {
    stepDesc.textContent = t("onboarding.helperTextPlatform", { platform: platformLabel });
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

/* ════════════════════════════════
   STREAMER CRUD
   ════════════════════════════════ */
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
    return await chrome.runtime.sendMessage({ type: "removeStreamer", id: streamerId });
  } catch (error) {
    console.error("Onboarding remove streamer error:", error);
    return { error: t("onboarding.errors.removeFailed") };
  }
}

function updateNextButton() {
  const btn = document.getElementById("btn-next-2");
  if (btn) btn.disabled = currentStreamers.length === 0;
  if (streamerCount) {
    streamerCount.textContent = String(currentStreamers.length).padStart(2, "0");
  }
}

/* ════════════════════════════════
   LANGUAGE
   ════════════════════════════════ */
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

    const flag = document.createElement("span");
    flag.className = "language-button-flag";
    flag.textContent = LANGUAGE_FLAGS[code] || "🌐";

    const meta = document.createElement("span");
    meta.className = "language-button-meta";

    const lbl = document.createElement("span");
    lbl.className = "language-button-label";
    lbl.textContent = label;

    const codeEl = document.createElement("span");
    codeEl.className = "language-button-code";
    codeEl.textContent = code.toUpperCase();

    meta.append(lbl, codeEl);

    const check = document.createElement("span");
    check.className = "language-button-check";
    check.textContent = "✓";

    button.append(flag, meta, check);
    languageOptions.appendChild(button);
  });
  updateLanguageButtonsState();
}

/* ════════════════════════════════
   RENDERERS
   ════════════════════════════════ */
function renderStreamers(streamers = []) {
  if (!currentStreamersSection || !streamerList) return;
  streamerList.innerHTML = "";

  if (!streamers.length) {
    currentStreamersSection.hidden = true;
    updateNextButton();
    return;
  }

  currentStreamersSection.hidden = false;
  updateNextButton();

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
    const platformIcon = runtime ? runtime.getURL(definition.icon) : `../${definition.icon}`;
    avatar.src = streamer.avatarUrl || platformIcon || fallbackAvatar;
    const handleLabel = formatHandleForDisplay(platformId, streamer.handle || streamer.twitch);
    avatar.alt = streamer.displayName || handleLabel || "Streamer";
    avatar.referrerPolicy = "no-referrer";
    avatar.onerror = function () { this.onerror = null; this.src = platformIcon || fallbackAvatar; };

    const name = document.createElement("span");
    name.className = "streamer-name";
    name.textContent = streamer.displayName || handleLabel;

    info.append(avatar, name);

    const removeButton = document.createElement("button");
    removeButton.className = "remove-streamer";
    removeButton.type = "button";
    removeButton.dataset.streamerId = streamer.id;
    removeButton.setAttribute("aria-label", t("onboarding.removeStreamer"));

    item.append(info, removeButton);
    streamerList.appendChild(item);
  });
}

function renderPreferenceToggles(preferences = {}) {
  preferenceToggleDefinitions.forEach(({ element, key }) => {
    if (!element) return;
    element.checked = preferences[key] !== false;
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
      if (element) element.checked = previous;
      return;
    }
    currentPreferences = response?.preferences || { ...(currentPreferences || {}), [key]: enabled };
    renderPreferenceToggles(currentPreferences);
  } catch (error) {
    console.error("Onboarding preference update error:", error);
    showFeedback(t("onboarding.errors.extensionUnavailable"), "error");
    if (element) element.checked = previous;
  }
}

async function loadStreamers() {
  let response = null;
  try {
    response = await chrome.runtime.sendMessage({ type: "getStreamers" });
  } catch (error) {
    console.error("Onboarding load streamers error:", error);
  }
  currentStreamers = response?.streamers || [];
  currentPreferences = response?.preferences || currentPreferences || {};
  renderStreamers(currentStreamers);
  renderPreferenceToggles(currentPreferences);
  if (response?.userProfile) {
    userProfile = { ...userProfile, ...response.userProfile };
    if (profileInput && userProfile.handle) profileInput.value = userProfile.handle;
    setProfileAvatarImage(userProfile.avatarUrl);
    if (userProfile.handle) {
      setAvatarStatus("found");
      setHintState("found", t("onboarding.profileHintFound", { handle: userProfile.displayName || userProfile.handle }));
    }
    renderProfileFromState();
  }
}

/* ════════════════════════════════
   i18n
   ════════════════════════════════ */
function refreshTranslations() {
  applyTranslations(document);
  document.title = t("onboarding.documentTitle");
  syncDocumentLanguage("onboarding.htmlLang");
  updateLanguageButtonsState();
  renderStreamers(currentStreamers);
  renderPreferenceToggles(currentPreferences || {});
  renderPlatformPicker();
  setSelectedPlatform(selectedPlatform);
  if (!profileInput?.value) setHintState("idle", t("onboarding.profileHintIdle"));
}

/* ════════════════════════════════
   EVENT LISTENERS
   ════════════════════════════════ */
function registerEventListeners() {
  /* Wizard nav */
  document.getElementById("btn-next-0")?.addEventListener("click", () => goToStep(1, "forward"));
  document.getElementById("btn-next-1")?.addEventListener("click", async () => {
    await saveUserProfile();
    goToStep(2, "forward");
  });
  document.getElementById("btn-next-2")?.addEventListener("click", () => goToStep(3, "forward"));
  document.getElementById("btn-next-3")?.addEventListener("click", () => goToStep(4, "forward"));
  document.getElementById("btn-back-1")?.addEventListener("click", () => goToStep(0, "back"));
  document.getElementById("btn-back-2")?.addEventListener("click", () => goToStep(1, "back"));
  document.getElementById("btn-back-3")?.addEventListener("click", () => goToStep(2, "back"));

  /* Stepper pill clicks */
  document.querySelectorAll(".step-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const target = parseInt(pill.dataset.step, 10);
      if (target < currentStep) goToStep(target, "back");
    });
  });

  /* Profile input */
  profileInput?.addEventListener("input", (event) => {
    scheduleProfileLookup(event.target.value);
  });

  /* Streamer form */
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const rawValue = input?.value ?? "";
    const sanitized = sanitizeInput(rawValue);
    if (!sanitized) {
      showFeedback(
        t("onboarding.feedback.invalidHandle", { platform: getPlatformLabel(selectedPlatform) }),
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

  platformPicker?.addEventListener("click", (event) => {
    const button = event.target.closest(".platform-button");
    if (!button?.dataset.platform) return;
    setSelectedPlatform(button.dataset.platform);
  });

  streamerList?.addEventListener("click", async (event) => {
    const button = event.target.closest(".remove-streamer");
    if (!button?.dataset.streamerId) return;
    button.disabled = true;
    const result = await removeStreamer(button.dataset.streamerId);
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

  languageOptions?.addEventListener("click", async (event) => {
    const button = event.target.closest(".language-button");
    if (!button?.dataset.lang) return;
    await setLanguage(button.dataset.lang);
  });

  finishButton?.addEventListener("click", () => {
    saveUserProfile().finally(() => window.close());
  });
}

/* ════════════════════════════════
   INIT
   ════════════════════════════════ */
async function initialize() {
  await initI18n();
  buildLanguageButtons();
  refreshTranslations();
  registerEventListeners();
  updateStepper();
  setHintState("idle", t("onboarding.profileHintIdle"));
  renderProfileFromState();

  unsubscribeLanguage = onLanguageChange(() => refreshTranslations());

  await loadStreamers();
}

initialize().catch((error) => {
  console.error("Onboarding initialization error:", error);
});

window.addEventListener("unload", () => {
  if (typeof unsubscribeLanguage === "function") unsubscribeLanguage();
});
