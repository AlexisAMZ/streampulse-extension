export const DEFAULT_PLATFORM = "twitch";

const SIMPLE_HANDLE_CHARS = /[^a-z0-9_.-]/gi;

function trimValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeSimpleHandle(value) {
  const cleaned = trimValue(value).replace(/^@+/, "");
  return cleaned.replace(SIMPLE_HANDLE_CHARS, "").toLowerCase();
}

/* YouTube : handles @xxx mais aussi IDs de chaîne "UC…" (sensible à la casse
   pour l'ID, insensible pour le handle). Les deux passent par le même jeu de
   caractères ; la casse n'est repliée que si ce n'est pas un ID de chaîne. */
const YOUTUBE_CHANNEL_ID = /^UC[A-Za-z0-9_-]{10,32}$/;

function sanitizeYoutubeHandle(value) {
  const raw = trimValue(value);
  if (!raw) return "";
  // Une URL YouTube collée ? On en extrait le handle (@x) ou l'ID de chaîne
  // (youtube.com/channel/UC…, youtube.com/c/UC…). Sinon traitement simple.
  const fromUrl = raw.match(
    /youtube\.com\/(?:c\/|channel\/)?(@[A-Za-z0-9._-]{3,30}|UC[A-Za-z0-9_-]{10,32})/i
  );
  const token = fromUrl ? fromUrl[1] : raw;
  const cleaned = token.replace(/^@+/, "").replace(SIMPLE_HANDLE_CHARS, "");
  if (!cleaned) return "";
  return YOUTUBE_CHANNEL_ID.test(cleaned) ? cleaned : cleaned.toLowerCase();
}

export function isYoutubeChannelId(handle) {
  return YOUTUBE_CHANNEL_ID.test(trimValue(handle));
}

function sanitizeKickHandle(value) {
  return sanitizeSimpleHandle(value);
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
    icon: "images/social/twitch.png",
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
    color: "#53fc18",
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
  youtube: {
    id: "youtube",
    labelKey: "platforms.youtube",
    shortLabelKey: "platformsShort.youtube",
    icon: "images/social/youtube.png",
    color: "#FF0000",
    inputPrefix: "@",
    placeholderKey: {
      popup: "popup.placeholders.youtube",
      onboarding: "onboarding.placeholders.youtube",
    },
    supportsLiveStatus: true,
    sanitizeHandle: sanitizeYoutubeHandle,
    sanitizeForComparison: sanitizeSimpleForComparison,
    formatHandle(handle) {
      const cleaned = sanitizeYoutubeHandle(handle);
      if (!cleaned) return "";
      return isYoutubeChannelId(cleaned) ? cleaned : `@${cleaned}`;
    },
    buildUrl(handle) {
      const cleaned = sanitizeYoutubeHandle(handle);
      if (!cleaned) return "https://www.youtube.com/";
      return isYoutubeChannelId(cleaned)
        ? `https://www.youtube.com/channel/${cleaned}`
        : `https://www.youtube.com/@${cleaned}`;
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
