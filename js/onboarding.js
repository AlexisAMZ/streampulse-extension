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
  DEFAULT_PLATFORM,
  PLATFORM_DEFINITIONS,
  formatHandleForDisplay,
  getOfferedPlatforms,
  getPlatformLabelKey,
  getPlatformPlaceholderKey,
  normalizePlatform,
  sanitizeHandle,
} from "./platforms.js";
import { requestChzzkAccess } from "./chzzk-permission.js";
import { DEFAULT_PREFERENCES } from "./preferences-data.js";
import { BADGE_FX, COSMETICS_KEY, NAME_FX, REFERRAL_FX, TENURE_STYLES, fxLock, normalizeCosmetics, visibleFx } from "./cosmetics-data.js";
import { PLUS_KEY, isPlusActive } from "./plus.js";

/* ── DOM refs ── */
const form = document.getElementById("onboarding-form");
const input = document.getElementById("streamer-input");
const platformPicker = document.getElementById("onboarding-platform-picker");
const handlePrefix = document.getElementById("onboarding-handle-prefix");
const feedback = document.getElementById("feedback");
const currentStreamersSection = document.getElementById("current-streamers");
const streamerList = document.getElementById("streamer-list");
const streamerCount = document.getElementById("streamer-count");
const finishButton = document.getElementById("finish-button");
const languageOptions = document.getElementById("language-options");
const stepCounterCurrent = document.getElementById("step-counter-current");

/* Profile (NEW) */
const profileInput = document.getElementById("profile-input");
const profileInputCount = document.getElementById("profile-input-count");
const profilePlatformPicker = document.getElementById("profile-platform-picker");
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
  { element: document.getElementById("onboarding-title-alerts"), key: "titleNotifications" },
  { element: document.getElementById("onboarding-sounds"), key: "soundsEnabled" },
  { element: document.getElementById("onboarding-fast-forward"), key: "enableFastForwardButton" },
  { element: document.getElementById("onboarding-hide-extensions"), key: "hideTwitchExtensions" },
  { element: document.getElementById("onboarding-auto-claim"), key: "autoClaimChannelPoints" },
  { element: document.getElementById("onboarding-auto-claim-drops"), key: "autoClaimDrops" },
  { element: document.getElementById("onboarding-auto-open-inventory"), key: "autoOpenInventory" },
  { element: document.getElementById("onboarding-auto-cancel-raids"), key: "autoCancelRaids" },
  { element: document.getElementById("onboarding-prevent-tab-discard"), key: "preventTabDiscard" },
  { element: document.getElementById("onboarding-streamer-favicon"), key: "enableStreamerFavicon" },
  { element: document.getElementById("onboarding-tab-live-icon"), key: "enableTabLiveIcon" },
  { element: document.getElementById("onboarding-community-badge"), key: "communityBadge" },
  { element: document.getElementById("onboarding-cross-device-sync"), key: "crossDeviceSync" },
  // Réglages dédiés StreamPulse+ (parcours ?mode=plus).
  { element: document.getElementById("onboarding-plus-auto-farm"), key: "autoFarmNewBadges" },
  { element: document.getElementById("onboarding-plus-auto-claim-drops"), key: "autoClaimDrops" },
  { element: document.getElementById("onboarding-plus-low-quality"), key: "badgeFarmLowQuality" },
  { element: document.getElementById("onboarding-plus-auto-open-inventory"), key: "autoOpenInventory" },
  { element: document.getElementById("onboarding-plus-game-alerts"), key: "gameNotifications" },
  { element: document.getElementById("onboarding-plus-title-alerts"), key: "titleNotifications" },
  { element: document.getElementById("onboarding-plus-community-badge"), key: "communityBadge" },
  { element: document.getElementById("onboarding-plus-clip-download"), key: "enableClipDownload" },
];

const PLUS_PREFERENCES = new Set(["autoClaimDrops", "autoOpenInventory", "autoFarmNewBadges", "badgeFarmLowQuality", "enableClipDownload"]);

/**
 * Réglages désactivés tant que l'utilisateur ne les active pas : une valeur
 * absente vaut « non ». Le badge communautaire envoie une empreinte du pseudo,
 * il demande donc un accord explicite ; suivre les raids rapporte des points.
 */
// Défauts réels du produit (js/preferences-data.js) : une clé à false dans
// DEFAULT_PREFERENCES est opt-in — sans réponse du service worker, les
// interrupteurs reflètent quand même la vérité.
const OFF_BY_DEFAULT = new Set(
  Object.keys(DEFAULT_PREFERENCES).filter((key) => DEFAULT_PREFERENCES[key] === false)
);
const isEnabled = (preferences, key) => (OFF_BY_DEFAULT.has(key) ? preferences?.[key] === true : preferences?.[key] !== false);

const LANGUAGE_FLAGS = { fr: "🇫🇷", en: "🇬🇧", es: "🇪🇸", "pt-BR": "🇧🇷", de: "🇩🇪", it: "🇮🇹", pl: "🇵🇱", tr: "🇹🇷", ru: "🇷🇺", ja: "🇯🇵", ko: "🇰🇷", ar: "🇸🇦" };

/* ── State ── */
let currentStreamers = [];
let unsubscribeLanguage = null;
let currentPreferences = null;
let selectedPlatform = DEFAULT_PLATFORM;
let currentStep = 0;
const PLUS_MODE = new URLSearchParams(window.location.search).get("mode") === "plus";
const FIRST_STEP = PLUS_MODE ? 5 : 0;
const LAST_STEP = FIRST_STEP + 4;
let navigating = false;
let saving = false;
let preferencesLoaded = false;
let pendingPreference = null;
let plusRecord = null;

/** Plateformes où le service worker sait retrouver la photo de l'utilisateur. */
const PROFILE_PLATFORMS = ["twitch", "kick", "youtube"];

let profilePlatform = "twitch";
let profilePlatformTouched = false;
let userProfile = { handle: "", displayName: "", avatarUrl: "", platform: profilePlatform };
let profileLookupTimer = null;
let profileLookupSeq = 0;

/* ════════════════════════════════
   WIZARD NAVIGATION
   ════════════════════════════════ */
function goToStep(targetStep, direction = "forward") {
  if (saving || navigating || !Number.isInteger(targetStep) || targetStep < FIRST_STEP || targetStep > LAST_STEP || targetStep === currentStep || targetStep > currentStep + 1) return;

  const currentEl = document.querySelector(`.wizard-step[data-step="${currentStep}"]`);
  const targetEl = document.querySelector(`.wizard-step[data-step="${targetStep}"]`);
  if (!currentEl || !targetEl) return;

  const outClass = direction === "forward" ? "slide-out-left" : "slide-out-right";
  navigating = true;
  syncControls();
  let timer;
  let finished = false;
  const complete = (event) => {
    // Child/entrance animations must not complete the outgoing step.
    if (event && (event.target !== currentEl || event.animationName !== outClass)) return;
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    currentEl.removeEventListener("animationend", complete);
    currentEl.removeEventListener("animationcancel", complete);
    currentEl.classList.remove(outClass);
    navigating = false;
    showFeedback();
    activateStep(targetStep);
  };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    complete();
    return;
  }
  currentEl.addEventListener("animationend", complete);
  currentEl.addEventListener("animationcancel", complete);
  // Also works when CSS animations are removed or their events are lost.
  timer = setTimeout(complete, 320);
  currentEl.classList.add(outClass);
}

function activateStep(step) {
  currentStep = step;
  document.querySelectorAll(".wizard-step").forEach((element) => element.classList.toggle("active", Number(element.dataset.step) === step));
  syncControls();
  if (step === 4) renderFinishPanel();
  const heading = document.querySelector(`.wizard-step[data-step="${step}"] h1, .wizard-step[data-step="${step}"] h2`);
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }
}

function updateStepper() {
  // Piloté par data-step : le wizard normal et le parcours Plus ont chacun
  // leur stepper, seul celui du mode actif est visible.
  const pills = document.querySelectorAll(".step-pill");
  pills.forEach((pill) => {
    const step = Number(pill.dataset.step);
    const active = step === currentStep;
    pill.classList.toggle("active", active);
    pill.classList.toggle("completed", step < currentStep);
    // Seules les étapes déjà traversées sont cliquables : les futures restent
    // dans le flux (le wizard est linéaire) mais jamais atteignables au clavier.
    pill.disabled = saving || navigating || step < FIRST_STEP || step > LAST_STEP || step > currentStep;
    if (active) pill.setAttribute("aria-current", "step");
    else pill.removeAttribute("aria-current");
  });
  if (stepCounterCurrent) {
    stepCounterCurrent.textContent = String(currentStep - FIRST_STEP + 1).padStart(2, "0");
  }
}

function syncControls() {
  const busy = saving || navigating;
  document.querySelectorAll(".wizard-step button").forEach((button) => {
    button.disabled = busy || Boolean(button.dataset.lock);
  });
  if (input) input.disabled = busy;
  if (profileInput) profileInput.disabled = busy;
  if (btnNext1) btnNext1.disabled = busy || !userProfile.handle;
  updateNextButton();
  updateStepper();
  renderPreferenceToggles(currentPreferences || {});
}

async function runSave(action) {
  if (saving || navigating) return false;
  saving = true;
  syncControls();
  showFeedback();
  try {
    await action();
    return true;
  } catch (error) {
    console.warn("[onboarding] save failed:", error);
    showFeedback(error?.message || t("popup.feedback.saveFailed"), "error");
    return false;
  } finally {
    saving = false;
    pendingPreference = null;
    syncControls();
  }
}

async function sendSaveMessage(message) {
  let response;
  try {
    response = await chrome.runtime.sendMessage(message);
  } catch {
    throw new Error(t("onboarding.errors.extensionUnavailable"));
  }
  if (response?.success !== true || response.error) {
    throw new Error(response?.error || t("popup.feedback.saveFailed"));
  }
  return response;
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
  // L'aperçu du badge reflète le pseudo saisi en temps réel.
  const badgePreviewName = document.getElementById("badge-preview-name");
  if (badgePreviewName) badgePreviewName.textContent = display ? `@${display}` : "@toi";
  // Aperçu du style Plus (étape ?mode=plus) : le pseudo choisi porte les effets.
  document.querySelectorAll(".plus-style-name").forEach((el) => {
    el.textContent = display ? `@${display}` : "@toi";
  });

  if (profileInputCount) profileInputCount.textContent = String((profileInput?.value || "").length);

  if (btnNext1) btnNext1.disabled = saving || navigating || !handle;
}

async function lookupTwitchProfile(handle) {
  /* Ask the background to resolve the user: Twitch first, then Kick and
     YouTube ("lookupTwitchUser" keeps its historical name).  Falls back
     gracefully to initials-only if the runtime isn't available. */
  try {
    const response = await chrome.runtime.sendMessage({
      type: "lookupTwitchUser",
      handle,
      platform: profilePlatform,
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
  const seq = ++profileLookupSeq;
  const handle = (rawValue || "").trim().replace(/^@/, "");

  if (!handle) {
    userProfile = { handle: "", displayName: "", avatarUrl: "", platform: profilePlatform };
    setProfileAvatarImage("");
    setAvatarStatus("idle");
    setHintState("idle", t("onboarding.profileHintIdle"));
    if (profileAvatarSpinner) profileAvatarSpinner.hidden = true;
    renderProfileFromState();
    return;
  }

  /* Optimistic local state: show initials + enable Continue immediately */
  userProfile = { handle, displayName: handle, avatarUrl: "", platform: profilePlatform };
  setProfileAvatarImage("");
  renderProfileFromState();
  setAvatarStatus("searching");
  setHintState("searching", t("onboarding.profileHintSearching"));
  if (profileAvatarSpinner) profileAvatarSpinner.hidden = false;

  profileLookupTimer = setTimeout(async () => {
    const user = await lookupTwitchProfile(handle);
    if (seq !== profileLookupSeq) return; /* superseded */

    if (profileAvatarSpinner) profileAvatarSpinner.hidden = true;

    if (user) {
      userProfile = {
        handle,
        displayName: user.display_name || user.displayName || handle,
        avatarUrl: user.profile_image_url || user.avatarUrl || "",
        platform: profilePlatform,
      };
      setProfileAvatarImage(userProfile.avatarUrl);
      setAvatarStatus("found");
      setHintState("found", t("onboarding.profileHintFound", { handle: userProfile.displayName }));
    } else {
      userProfile = { handle, displayName: handle, avatarUrl: "", platform: profilePlatform };
      setProfileAvatarImage("");
      /* Pas de compte Twitch (ou pseudo inconnu) : ce n'est pas une erreur.
         On garde le pseudo saisi tel quel, en état neutre. */
      setAvatarStatus("idle");
      setHintState("idle", t("onboarding.profileHintKept"));
    }
    renderProfileFromState();
  }, 450);
}

/** Sélecteur Twitch / Kick / YouTube de l'étape pseudo. */
function renderProfilePlatformPicker() {
  if (!profilePlatformPicker) return;
  profilePlatformPicker.replaceChildren(...PROFILE_PLATFORMS.map((platform) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "platform-button";
    button.dataset.platform = platform;
    const isActive = platform === profilePlatform;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    const icon = document.createElement("img");
    icon.src = `../${getPlatformDefinition(platform).icon}`;
    icon.alt = "";
    const label = document.createElement("span");
    label.className = "platform-button-label";
    label.textContent = getPlatformLabel(platform);
    button.append(icon, label);
    return button;
  }));
}

function setProfilePlatform(platform) {
  if (!PROFILE_PLATFORMS.includes(platform) || platform === profilePlatform) return;
  profilePlatform = platform;
  renderProfilePlatformPicker();
  // Même pseudo, autre plateforme : la photo affichée n'est plus la bonne.
  scheduleProfileLookup(profileInput?.value || "");
}

async function saveUserProfile() {
  return runSave(() => sendSaveMessage({ type: "updateUserProfile", profile: userProfile }));
}

/**
 * Écran final : bandeau des streamers suivis et aperçu de notification.
 * Le titre traduit est réécrit par applyTranslations (innerHTML) : tout
 * élément inséré dedans serait détruit au prochain rafraîchissement i18n,
 * donc le nom n'est plus injecté dans le titre.
 */
function renderFinishPanel() {
  const watched = document.getElementById("finish-watched");
  const watchedRow = document.getElementById("finish-watched-row");
  const watchedCount = document.getElementById("finish-watched-count");
  const notifMock = document.getElementById("notif-mock");
  if (!watched || !watchedRow || !watchedCount || !notifMock) return;

  const runtime =
    (typeof chrome !== "undefined" && chrome.runtime) ||
    (typeof browser !== "undefined" && browser.runtime) ||
    null;
  const iconFor = (platformId) => {
    const definition = getPlatformDefinition(platformId);
    return runtime ? runtime.getURL(definition.icon) : `../${definition.icon}`;
  };

  const streamers = currentStreamers;
  watched.hidden = streamers.length === 0;
  notifMock.hidden = streamers.length === 0;
  if (streamers.length === 0) return;

  watchedCount.textContent = ` · ${streamers.length}`;

  const MAX_AVATARS = 6;
  watchedRow.replaceChildren();
  streamers.slice(0, MAX_AVATARS).forEach((streamer) => {
    const platformId = streamer.platform || DEFAULT_PLATFORM;
    const avatar = document.createElement("img");
    avatar.className = "finish-watched-avatar";
    const fallback = iconFor(platformId);
    avatar.src = streamer.avatarUrl || fallback;
    avatar.alt = streamer.displayName || formatHandleForDisplay(platformId, streamer.handle || streamer.twitch) || "Streamer";
    avatar.referrerPolicy = "no-referrer";
    avatar.onerror = function () { this.onerror = null; this.src = fallback; };
    watchedRow.append(avatar);
  });
  const extra = streamers.length - MAX_AVATARS;
  if (extra > 0) {
    const more = document.createElement("span");
    more.className = "finish-watched-more";
    more.textContent = `+${extra}`;
    watchedRow.append(more);
  }

  const first = streamers[0];
  const firstPlatform = first.platform || DEFAULT_PLATFORM;
  const mockAvatar = document.getElementById("notif-mock-avatar");
  const mockName = document.getElementById("notif-mock-name");
  const mockFallback = iconFor(firstPlatform);
  mockAvatar.src = first.avatarUrl || mockFallback;
  mockAvatar.onerror = function () { this.onerror = null; this.src = mockFallback; };
  mockName.textContent = first.displayName || formatHandleForDisplay(firstPlatform, first.handle || first.twitch) || first.handle;
}

/* ════════════════════════════════
   PLATFORM / INPUT HELPERS
   ════════════════════════════════ */
function sanitizeInput(value = "", platform = selectedPlatform) {
  return sanitizeHandle(platform, value);
}

function showFeedback(message = "", type = "success") {
  if (!feedback) return;
  if (message) {
    const active = document.querySelector(".wizard-step.active");
    const container = active?.querySelector("#finish-button")?.parentElement || active?.querySelector(".step-content") || active?.querySelector(".welcome-frame");
    container?.prepend(feedback);
  }
  feedback.hidden = !message;
  feedback.textContent = message || "";
  feedback.classList.remove("success", "error");
  feedback.setAttribute("role", type === "error" ? "alert" : "status");
  if (message) feedback.classList.add(type === "error" ? "error" : "success");
  if (message && type === "error") feedback.scrollIntoView({ block: "nearest", behavior: "instant" });
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
  const offered = getOfferedPlatforms(getCurrentLanguage(), [...new Set(currentStreamers.map((streamer) => streamer.platform || "twitch"))]);
  if (!offered.some((definition) => definition.id === selectedPlatform)) selectedPlatform = DEFAULT_PLATFORM;
  offered.forEach((definition) => {
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
  const hint = document.getElementById("chzzk-hint");
  if (hint) hint.hidden = selectedPlatform !== "chzzk";
}

/* ════════════════════════════════
   STREAMER CRUD
   ════════════════════════════════ */
function updateNextButton() {
  const btn = document.getElementById("btn-next-2");
  if (btn) btn.disabled = saving || navigating || currentStreamers.length === 0;
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
    avatar.src = streamer.avatarUrl || platformIcon;
    const handleLabel = formatHandleForDisplay(platformId, streamer.handle || streamer.twitch);
    avatar.alt = streamer.displayName || handleLabel || "Streamer";
    avatar.referrerPolicy = "no-referrer";
    avatar.onerror = function () { this.onerror = null; this.src = platformIcon; };

    const name = document.createElement("span");
    name.className = "streamer-name";
    name.textContent = streamer.displayName || handleLabel;

    info.append(avatar, name);

    const removeButton = document.createElement("button");
    removeButton.className = "remove-streamer";
    removeButton.type = "button";
    removeButton.dataset.streamerId = streamer.id;
    removeButton.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    removeButton.setAttribute("aria-label", t("onboarding.removeStreamerName", { name: handleLabel || avatar.alt }));

    item.append(info, removeButton);
    streamerList.appendChild(item);
  });
}

function renderPreferenceToggles(preferences = {}) {
  const plus = isPlusActive(plusRecord);
  preferenceToggleDefinitions.forEach(({ element, key }) => {
    if (!element) return;
    const locked = PLUS_PREFERENCES.has(key) && !plus;
    element.checked = !locked && (pendingPreference?.key === key ? pendingPreference.enabled : isEnabled(preferences, key));
    element.disabled = locked || !preferencesLoaded || saving || navigating;
    element.closest(".settings-toggle")?.classList.toggle("is-locked", locked);
    element.title = locked ? t("popup.plusMenu.statusInactive") : "";
  });
}

async function updatePreferenceToggle({ key }, enabled) {
  if (!preferencesLoaded || saving || navigating || (PLUS_PREFERENCES.has(key) && !isPlusActive(plusRecord))) {
    renderPreferenceToggles(currentPreferences || {});
    return;
  }
  pendingPreference = { key, enabled };
  await runSave(async () => {
    const response = await sendSaveMessage({
      type: "updatePreferences",
      updates: { [key]: enabled },
    });
    if (!response.preferences || typeof response.preferences[key] !== "boolean") {
      throw new Error(t("popup.feedback.saveFailed"));
    }
    currentPreferences = response.preferences;
  });
}

async function loadStreamers() {
  let response = null;
  try {
    response = await chrome.runtime.sendMessage({ type: "getStreamers" });
  } catch (error) {
    console.error("Onboarding load streamers error:", error);
  }
  if (response?.error || !Array.isArray(response?.streamers) || !response?.preferences || typeof response.preferences !== "object") {
    showFeedback(response?.error || t("onboarding.errors.extensionUnavailable"), "error");
    return;
  }
  currentStreamers = response.streamers;
  currentPreferences = response.preferences;
  preferencesLoaded = true;
  renderStreamers(currentStreamers);
  renderPreferenceToggles(currentPreferences);
  if (response.userProfile && !profileInput?.value) {
    userProfile = { ...userProfile, ...response.userProfile };
    if (PROFILE_PLATFORMS.includes(userProfile.platform)) profilePlatform = userProfile.platform;
    renderProfilePlatformPicker();
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
  document.title = PLUS_MODE ? t("onboarding.plusDocumentTitle") : t("onboarding.documentTitle");
  syncDocumentLanguage("onboarding.htmlLang");
  updateLanguageButtonsState();
  renderStreamers(currentStreamers);
  renderPreferenceToggles(currentPreferences || {});
  renderPlatformPicker();
  renderProfilePlatformPicker();
  setSelectedPlatform(selectedPlatform);
  if (!profileInput?.value) setHintState("idle", t("onboarding.profileHintIdle"));
  else if (profileHint?.dataset.state === "searching") setHintState("searching", t("onboarding.profileHintSearching"));
  else if (profileHint?.dataset.state === "found") setHintState("found", t("onboarding.profileHintFound", { handle: userProfile.displayName || userProfile.handle }));
  else setHintState("idle", t("onboarding.profileHintKept"));
  renderPlusAccess();
  syncControls();
}

/* ════════════════════════════════
   EVENT LISTENERS
   ════════════════════════════════ */
function registerEventListeners() {
  /* Wizard nav */
  document.getElementById("btn-next-0")?.addEventListener("click", () => goToStep(1, "forward"));
  document.getElementById("btn-next-1")?.addEventListener("click", async () => {
    if (currentStep !== 1 || !userProfile.handle) return;
    if (await saveUserProfile()) goToStep(2, "forward");
  });
  document.getElementById("btn-next-2")?.addEventListener("click", () => goToStep(3, "forward"));
  document.getElementById("btn-next-3")?.addEventListener("click", () => goToStep(4, "forward"));
  document.getElementById("btn-back-1")?.addEventListener("click", () => goToStep(0, "back"));
  document.getElementById("btn-back-2")?.addEventListener("click", () => goToStep(1, "back"));
  document.getElementById("btn-back-3")?.addEventListener("click", () => goToStep(2, "back"));
  document.getElementById("btn-skip-1")?.addEventListener("click", () => goToStep(2, "forward"));
  document.getElementById("btn-skip-2")?.addEventListener("click", () => goToStep(3, "forward"));

  /* Parcours StreamPulse+ (?mode=plus) : un domaine par étape. */
  document.getElementById("btn-next-5")?.addEventListener("click", () => goToStep(6, "forward"));
  document.getElementById("btn-next-6")?.addEventListener("click", () => goToStep(7, "forward"));
  document.getElementById("btn-next-7")?.addEventListener("click", () => goToStep(8, "forward"));
  document.getElementById("btn-next-8")?.addEventListener("click", () => goToStep(9, "forward"));
  document.getElementById("btn-back-6")?.addEventListener("click", () => goToStep(5, "back"));
  document.getElementById("btn-back-7")?.addEventListener("click", () => goToStep(6, "back"));
  document.getElementById("btn-back-8")?.addEventListener("click", () => goToStep(7, "back"));
  document.getElementById("btn-back-9")?.addEventListener("click", () => goToStep(8, "back"));

  /* Stepper pill clicks */
  document.querySelectorAll(".step-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const target = parseInt(pill.dataset.step, 10);
      if (target < currentStep) goToStep(target, "back");
    });
  });

  profilePlatformPicker?.addEventListener("click", (event) => {
    if (saving || navigating) return;
    const button = event.target.closest(".platform-button");
    if (button?.dataset.platform) {
      profilePlatformTouched = true;
      setProfilePlatform(button.dataset.platform);
    }
  });

  /* Profile input */
  profileInput?.addEventListener("input", (event) => {
    scheduleProfileLookup(event.target.value);
  });

  /* Streamer form */
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (saving || navigating || currentStep !== 2) return;
    const rawValue = input?.value ?? "";
    const sanitized = sanitizeInput(rawValue);
    if (!sanitized) {
      showFeedback(
        t("onboarding.feedback.invalidHandle", { platform: getPlatformLabel(selectedPlatform) }),
        "error"
      );
      return;
    }

    const platform = selectedPlatform;
    if (platform === "chzzk" && !(await requestChzzkAccess())) {
      showFeedback(t("popup.errors.chzzkPermission"), "error");
      return;
    }
    await runSave(async () => {
      showFeedback(t("onboarding.feedback.adding"));
      const result = await sendSaveMessage({ type: "addStreamer", platform, handle: rawValue.trim(), displayName: rawValue.trim() });
      if (!Array.isArray(result.streamers)) throw new Error(t("popup.feedback.saveFailed"));
      currentStreamers = result.streamers;
      renderStreamers(currentStreamers);
      showFeedback(t("onboarding.feedback.addSuccessPlatform", {
        handle: formatHandleForDisplay(platform, sanitized),
        platform: getPlatformLabel(platform),
      }));
      form.reset();
      updatePlatformTexts();
    });
  });

  platformPicker?.addEventListener("click", (event) => {
    if (saving || navigating) return;
    const button = event.target.closest(".platform-button");
    if (!button?.dataset.platform) return;
    setSelectedPlatform(button.dataset.platform);
  });

  streamerList?.addEventListener("click", async (event) => {
    const button = event.target.closest(".remove-streamer");
    if (!button?.dataset.streamerId) return;
    await runSave(async () => {
      const result = await sendSaveMessage({ type: "removeStreamer", id: button.dataset.streamerId });
      if (!Array.isArray(result.streamers)) throw new Error(t("onboarding.errors.removeFailed"));
      currentStreamers = result.streamers;
      renderStreamers(currentStreamers);
      showFeedback(t("onboarding.feedback.removeSuccess"));
    });
  });

  preferenceToggleDefinitions.forEach((definition) => {
    definition.element?.addEventListener("change", (event) => {
      updatePreferenceToggle(definition, event.target.checked);
    });
  });

  languageOptions?.addEventListener("click", async (event) => {
    const button = event.target.closest(".language-button");
    if (!button?.dataset.lang || saving || navigating) return;
    await setLanguage(button.dataset.lang);
  });

  finishButton?.addEventListener("click", async () => {
    // L'étape d'après a déjà dit quoi faire (épingler l'extension) : ce
    // bouton n'a plus qu'à sauver le profil et fermer l'onglet.
    if (currentStep === 4 && await saveUserProfile()) closeOnboardingTab();
  });
}

// window.close() peut être ignoré pour un onglet ouvert par chrome.tabs.create :
// on ferme alors l'onglet par l'API tabs.
function closeOnboardingTab() {
  if (!chrome?.tabs?.getCurrent) {
    window.close();
    return;
  }
  chrome.tabs.getCurrent((tab) => {
    if (chrome.runtime.lastError || !tab?.id) {
      window.close();
      return;
    }
    chrome.tabs.remove(tab.id).catch((error) => {
      console.warn("[onboarding] fermeture de l'onglet", error);
      window.close();
    });
  });
}

function setupUpdateModeUI() {
  const urlParams = new URLSearchParams(window.location.search);
  const isUpdateMode = urlParams.get("mode") === "update";
  if (!isUpdateMode) return;

  const stepHeaderEyebrow = document.querySelector('.wizard-step[data-step="3"] .step-eyebrow');
  const stepHeaderTitle = document.querySelector('.wizard-step[data-step="3"] .step-title');
  const stepHeaderDesc = document.querySelector('.wizard-step[data-step="3"] .step-desc');

  // Le mode mise à jour réécrit l'en-tête de l'étape 4. On repose aussi les
  // data-i18n : sans eux, un changement de langue depuis cet écran restaurerait
  // le texte du mode première installation.
  if (stepHeaderEyebrow) {
    stepHeaderEyebrow.dataset.i18n = "onboarding.updateEyebrow";
    stepHeaderEyebrow.textContent = t("onboarding.updateEyebrow");
  }
  if (stepHeaderTitle) {
    stepHeaderTitle.dataset.i18n = "onboarding.updateTitle";
    stepHeaderTitle.dataset.i18nMode = "html";
    stepHeaderTitle.innerHTML = t("onboarding.updateTitle");
  }
  if (stepHeaderDesc) {
    stepHeaderDesc.dataset.i18n = "onboarding.updateDescription";
    stepHeaderDesc.textContent = t("onboarding.updateDescription");
  }

  const btnBack3 = document.getElementById("btn-back-3");
  if (btnBack3) btnBack3.style.display = "none";

  const newSettingElementIds = [
    "onboarding-auto-claim-drops",
    "onboarding-auto-cancel-raids",
    "onboarding-hide-extensions",
    "onboarding-streamer-favicon",
    "onboarding-tab-live-icon",
    "onboarding-prevent-tab-discard",
  ];

  newSettingElementIds.forEach((id) => {
    const el = document.getElementById(id);
    const titleEl = el?.closest(".settings-toggle")?.querySelector(".settings-title");
    if (titleEl && !titleEl.querySelector(".badge-new")) {
      const badge = document.createElement("span");
      badge.className = "badge-new";
      badge.textContent = t("onboarding.newBadge");
      titleEl.appendChild(badge);
    }
  });

  // Jump straight to Step 3 (Réglages)
  activateStep(3);
}

/**
 * Mode StreamPulse+ (?mode=plus, ouvert à l'activation de la licence) : le
 * wizard normal laisse place à un parcours dédié — un domaine par étape
 * (badges, Drops, alertes, badge & clips), avec son propre stepper.
 */
function setupPlusModeUI() {
  if (!PLUS_MODE) return;
  document.body.classList.add("plus-mode");
  document.getElementById("plus-finish")?.addEventListener("click", async () => {
    if (currentStep === 9 && await saveUserProfile()) closeOnboardingTab();
  });
  // Le style de pseudo et de badge se choisit ici, pas dans le popup :
  // mêmes listes, même clé de stockage que le volet Badge du popup.
  initPlusStyle();
  activateStep(5);
}

/* ════════════════════════════════
   STREAMPULSE+ : NUANCIER DU STYLE (étape Badge)
   ════════════════════════════════ */

let plusCosmetics = { badgeFx: "", nameFx: "" };

function plusAccess() {
  return {
    plus: isPlusActive(plusRecord),
    referrals: Math.max(0, Number(plusRecord?.referrals) || 0),
    role: ["admin", "bughunter"].includes(plusRecord?.role) ? plusRecord.role : "",
  };
}

function renderPlusAccess() {
  const plus = isPlusActive(plusRecord);
  const welcome = document.getElementById("plus-welcome-desc");
  if (welcome) {
    welcome.dataset.i18n = plus ? "onboarding.plusWelcomeDesc" : "popup.plusMenu.statusInactive";
    welcome.textContent = t(welcome.dataset.i18n);
  }
  const finish = document.getElementById("plus-finish");
  if (finish) {
    finish.dataset.i18n = plus ? "onboarding.plusFinish" : "onboarding.finish";
    finish.textContent = t(finish.dataset.i18n);
  }
  renderPreferenceToggles(currentPreferences || {});
  if (PLUS_MODE) renderPlusStyle();
}

function onStorageChange(changes, area) {
  if (area !== "local") return;
  if (changes[PLUS_KEY]) plusRecord = changes[PLUS_KEY].newValue || null;
  if (changes[COSMETICS_KEY]) plusCosmetics = normalizeCosmetics(changes[COSMETICS_KEY].newValue);
  if (changes[PLUS_KEY] || changes[COSMETICS_KEY]) renderPlusAccess();
}

async function loadPlusAccess() {
  try {
    const stored = await chrome.storage.local.get([PLUS_KEY, COSMETICS_KEY]);
    if (!stored || typeof stored !== "object") throw new Error("Missing local state");
    plusRecord = stored[PLUS_KEY] || null;
    plusCosmetics = normalizeCosmetics(stored[COSMETICS_KEY]);
    renderPlusAccess();
  } catch (error) {
    console.warn("[onboarding] Plus state unavailable:", error);
    showFeedback(t("onboarding.errors.extensionUnavailable"), "error");
  }
}

/** L'étiquette d'un effet, écrite avec l'effet lui-même (pseudo) ou portée par le logo (badge). */
function plusFxChip(kind, value) {
  const access = plusAccess();
  const lock = fxLock(value, access);
  const selected = (access.plus ? (kind === "name" ? plusCosmetics.nameFx : plusCosmetics.badgeFx) : "") === value;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "fx-option";
  button.dataset.kind = kind;
  button.dataset.value = value;
  button.dataset.lock = lock;
  button.disabled = saving || navigating || Boolean(lock);
  button.setAttribute("role", "radio");
  button.setAttribute("aria-checked", String(selected));
  if (lock) button.setAttribute("aria-disabled", "true");
  const label = t(`popup.cosmetics.${value || "none"}`);
  // Effet d'ambassadeur verrouillé : l'infobulle dit combien de filleuls il manque.
  button.title = lock === "referrals" ? t("popup.referral.needed", { count: REFERRAL_FX[value] || 1 }) : label;
  button.append(Object.assign(document.createElement("span"), { className: "fx-radio" }));
  if (kind === "name") {
    button.append(Object.assign(document.createElement("b"), {
      className: `fx-sample-name${value ? " sp-paint sp-paint--" + value : ""}`,
      textContent: label,
    }));
  } else {
    button.append(Object.assign(document.createElement("span"), {
      className: `cosmetic-badge${value ? " sp-fx-" + value : ""}`,
    }));
    button.append(Object.assign(document.createElement("span"), { className: "fx-label", textContent: label }));
  }
  if (lock) {
    button.append(Object.assign(document.createElement("span"), { className: "fx-lock", textContent: "★" }));
  }
  return button;
}

function renderPlusStyle() {
  const nameFx = document.getElementById("plus-name-fx");
  const badgeFx = document.getElementById("plus-badge-fx");
  if (!nameFx || !badgeFx) return;
  // L'ancienneté (Jauge, Pager) dépend des mois d'abonnement : elle reste au
  // popup, volet Badge, qui sait calculer le palier.
  const access = plusAccess();
  const shown = access.plus ? plusCosmetics : { badgeFx: "", nameFx: "" };
  const badgeList = visibleFx(BADGE_FX, access).filter((value) => !TENURE_STYLES[value]);
  nameFx.replaceChildren(...["", ...visibleFx(NAME_FX, access)].map((value) => plusFxChip("name", value)));
  badgeFx.replaceChildren(...["", ...badgeList].map((value) => plusFxChip("badge", value)));
  const badge = document.getElementById("plus-style-badge");
  const name = document.getElementById("plus-style-name");
  if (badge) badge.className = `cosmetic-badge${shown.badgeFx ? ` sp-fx-${shown.badgeFx}` : ""}`;
  if (name) name.className = `cosmetic-name plus-style-name${shown.nameFx ? ` sp-paint sp-paint--${shown.nameFx}` : ""}`;
}

function initPlusStyle() {
  renderPlusStyle();
  const previewName = document.getElementById("plus-style-name");
  if (previewName) previewName.textContent = userProfile.displayName || userProfile.handle ? `@${userProfile.displayName || userProfile.handle}` : "@toi";
  for (const id of ["plus-name-fx", "plus-badge-fx"]) {
    document.getElementById(id)?.addEventListener("click", async (event) => {
      const button = event.target.closest(".fx-option");
      if (!button || fxLock(button.dataset.value, plusAccess())) return;
      const next = normalizeCosmetics({
        ...plusCosmetics,
        [button.dataset.kind === "name" ? "nameFx" : "badgeFx"]: button.dataset.value,
      });
      await runSave(async () => {
        await chrome.storage.local.set({ [COSMETICS_KEY]: next }).catch(() => { throw new Error(t("popup.feedback.saveFailed")); });
        plusCosmetics = next;
        renderPlusStyle();
      });
    });
  }
}

/* ════════════════════════════════
   INIT
   ════════════════════════════════ */
/**
 * Repère « SYS / STREAMPULSE / Vx.y.z » en haut à droite.
 *
 * Il était écrit V1.0 en dur dans le HTML : tous les utilisateurs voyaient cette
 * valeur quelle que soit leur version installée.
 */
const PROFILE_PREFILL_ORDER = ["twitch", "kick", "youtube"];

/**
 * Pseudo du compte connecté, écrit d'office si le champ est encore vide :
 * Twitch d'abord, sinon Kick, sinon YouTube. La plateforme choisie à la main
 * n'est jamais écrasée ; sinon on bascule sur celle où une session est ouverte.
 */
async function prefillProfileFromAccounts() {
  if (!profileInput || profileInput.value.trim()) return;
  const response = await chrome.runtime.sendMessage({ type: "getAccountLogins" }).catch(() => null);
  const logins = response?.logins || {};
  if (profileInput.value.trim()) return;
  const platform = PROFILE_PREFILL_ORDER.find((id) => typeof logins[id] === "string" && logins[id]);
  if (!platform) return;
  if (platform !== profilePlatform) {
    if (profilePlatformTouched) return;
    setProfilePlatform(platform);
  }
  profileInput.value = logins[platform];
  scheduleProfileLookup(logins[platform]);
}

async function initialize() {
  await initI18n();
  buildLanguageButtons();
  refreshTranslations();
  registerEventListeners();
  syncControls();
  setHintState("idle", t("onboarding.profileHintIdle"));
  renderProfileFromState();
  renderProfilePlatformPicker();
  prefillProfileFromAccounts();

  unsubscribeLanguage = onLanguageChange(() => refreshTranslations());

  setupUpdateModeUI();
  setupPlusModeUI();
  chrome.storage.onChanged.addListener(onStorageChange);
  await Promise.all([loadStreamers(), loadPlusAccess()]);
}

initialize().catch((error) => {
  console.error("Onboarding initialization error:", error);
});

window.addEventListener("pagehide", () => {
  if (typeof unsubscribeLanguage === "function") unsubscribeLanguage();
  chrome.storage.onChanged.removeListener(onStorageChange);
  clearTimeout(profileLookupTimer);
  profileLookupSeq += 1;
});
