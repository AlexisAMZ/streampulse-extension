export const DEFAULT_PLATFORM = "twitch";

const SIMPLE_HANDLE_CHARS = /[^a-z0-9_.-]/gi;

function trimValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeSimpleHandle(value) {
  const cleaned = trimValue(value).replace(/^@+/, "");
  return cleaned.replace(SIMPLE_HANDLE_CHARS, "").toLowerCase();
}

function sanitizeCasePreservingHandle(value) {
  const cleaned = trimValue(value).replace(/^@+/, "");
  return cleaned.replace(SIMPLE_HANDLE_CHARS, "");
}

function sanitizeKickHandle(value) {
  return sanitizeSimpleHandle(value);
}

function sanitizeDliveHandle(value) {
  return sanitizeCasePreservingHandle(value);
}

function sanitizeTwitchHandle(value) {
  return sanitizeSimpleHandle(value);
}

function sanitizeSimpleForComparison(handle) {
  return sanitizeSimpleHandle(handle);
}

export const PLATFORM_DEFINITIONS = {
  twitch: {
    id: "twitch",
    labelKey: "platforms.twitch",
    shortLabelKey: "platformsShort.twitch",
    icon: "images/social/Twitch.png",
    color: "#9146FF",
    inputPrefix: "@",
    placeholderKey: {
      popup: "popup.placeholders.twitch",
      onboarding: "onboarding.placeholders.twitch",
    },
    supportsLiveStatus: true,
    sanitizeHandle: sanitizeTwitchHandle,
    sanitizeForComparison: sanitizeSimpleForComparison,
    formatHandle(handle) {
      const cleaned = sanitizeTwitchHandle(handle);
      return cleaned ? `@${cleaned}` : "";
    },
    buildUrl(handle) {
      const cleaned = sanitizeTwitchHandle(handle);
      return cleaned ? `https://www.twitch.tv/${cleaned}` : "https://www.twitch.tv/";
    },
  },
  kick: {
    id: "kick",
    labelKey: "platforms.kick",
    shortLabelKey: "platformsShort.kick",
    icon: "images/social/Kick.png",
    color: "#52FF3A",
    inputPrefix: "@",
    placeholderKey: {
      popup: "popup.placeholders.kick",
      onboarding: "onboarding.placeholders.kick",
    },
    supportsLiveStatus: true,
    sanitizeHandle: sanitizeKickHandle,
    sanitizeForComparison: sanitizeSimpleForComparison,
    formatHandle(handle) {
      const cleaned = sanitizeKickHandle(handle);
      return cleaned ? `@${cleaned}` : "";
    },
    buildUrl(handle) {
      const cleaned = sanitizeKickHandle(handle);
      return cleaned ? `https://kick.com/${cleaned}` : "https://kick.com/";
    },
  },
  dlive: {
    id: "dlive",
    labelKey: "platforms.dlive",
    shortLabelKey: "platformsShort.dlive",
    icon: "images/social/dlive.svg",
    color: "#F9C400",
    inputPrefix: "@",
    placeholderKey: {
      popup: "popup.placeholders.dlive",
      onboarding: "onboarding.placeholders.dlive",
    },
    supportsLiveStatus: true,
    sanitizeHandle: sanitizeDliveHandle,
    sanitizeForComparison: sanitizeSimpleForComparison,
    formatHandle(handle) {
      const cleaned = sanitizeDliveHandle(handle);
      return cleaned ? `@${cleaned}` : "";
    },
    buildUrl(handle) {
      const cleaned = sanitizeDliveHandle(handle);
      return cleaned ? `https://dlive.tv/${cleaned}` : "https://dlive.tv/";
    },
  },
};

export const AVAILABLE_PLATFORMS = Object.values(PLATFORM_DEFINITIONS);

export function normalizePlatform(platform) {
  const key = trimValue(platform).toLowerCase();
  if (PLATFORM_DEFINITIONS[key]) {
    return key;
  }
  return DEFAULT_PLATFORM;
}

export function sanitizeHandle(platform, value) {
  const key = normalizePlatform(platform);
  const definition = PLATFORM_DEFINITIONS[key];
  return definition.sanitizeHandle(value);
}

export function formatHandleForDisplay(platform, handle) {
  const key = normalizePlatform(platform);
  const definition = PLATFORM_DEFINITIONS[key];
  return definition.formatHandle(handle);
}

export function buildProfileUrl(platform, handle) {
  const key = normalizePlatform(platform);
  const definition = PLATFORM_DEFINITIONS[key];
  return definition.buildUrl(handle);
}

export function getPlatformLabelKey(platform) {
  const key = normalizePlatform(platform);
  return (
    PLATFORM_DEFINITIONS[key]?.labelKey ||
    PLATFORM_DEFINITIONS[DEFAULT_PLATFORM].labelKey
  );
}

export function getPlatformIcon(platform) {
  const key = normalizePlatform(platform);
  return (
    PLATFORM_DEFINITIONS[key]?.icon ||
    PLATFORM_DEFINITIONS[DEFAULT_PLATFORM].icon
  );
}

export function getPlatformPlaceholderKey(platform, context = "popup") {
  const key = normalizePlatform(platform);
  const definition = PLATFORM_DEFINITIONS[key];
  return definition.placeholderKey?.[context] || null;
}

export function platformSupportsLiveStatus(platform) {
  const key = normalizePlatform(platform);
  return PLATFORM_DEFINITIONS[key]?.supportsLiveStatus === true;
}

export function getHandleComparisonKey(platform, handle) {
  const key = normalizePlatform(platform);
  const definition = PLATFORM_DEFINITIONS[key];
  return `${key}:${definition.sanitizeForComparison(handle)}`;
}
export function getPlatformDefinition(platform) {
  const key = normalizePlatform(platform);
  return PLATFORM_DEFINITIONS[key] || PLATFORM_DEFINITIONS[DEFAULT_PLATFORM];
}

// Note: To avoid circular dependency with i18n, we export the Label Key getter
// and let the consumer translate it. But for compatibility with existing code expectation:
// If we want a simple getPlatformLabel(platform) that returns the translated string,
// we need 't'.
// For now, I will add getPlatformDefinition.
// And I will refactor UI.js to use getPlatformLabelKey and t().
