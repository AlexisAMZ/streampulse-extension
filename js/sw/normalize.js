// Normalisation des streamers et des URL d'assets (Twitch, Kick, YouTube).

import { DEFAULT_PLATFORM, formatHandleForDisplay, normalizePlatform, sanitizeHandle } from "../platforms.js";
import { DEFAULT_PREFERENCES } from "../preferences-data.js";

export function sanitizeLogin(value = "") {
  return sanitizeHandle("twitch", value);
}

function normalizeSocialLinks(rawSocials) {
  if (!rawSocials || typeof rawSocials !== "object") {
    return {};
  }
  const socials = {};
  for (const [rawKey, value] of Object.entries(rawSocials)) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        const key = String(rawKey).toLowerCase();
        socials[key] = trimmed;
      }
    }
  }
  return socials;
}

export function normalizeStreamer(raw) {
  const platform = normalizePlatform(
    raw.platform ||
      (raw.twitch ? "twitch" : DEFAULT_PLATFORM)
  );
  const baseHandle =
    raw.handle ??
    raw.twitch ??
    raw.login ??
    raw.username ??
    raw.id ??
    "";
  const sanitizedHandle = sanitizeHandle(platform, baseHandle);
  const twitchLogin =
    platform === "twitch"
      ? sanitizeHandle("twitch", raw.twitch || sanitizedHandle)
      : "";
  const derivedId =
    raw.id ||
    (platform === "twitch" && twitchLogin
      ? twitchLogin
      : sanitizedHandle
      ? `${platform}:${sanitizedHandle}`
      : null);
  const id = derivedId || `streamer_${Date.now()}`;
  const displayName =
    raw.displayName ||
    raw.name ||
    raw.twitch ||
    (sanitizedHandle
      ? formatHandleForDisplay(platform, sanitizedHandle)
      : id);

  return {
    id,
    platform,
    handle: sanitizedHandle,
    twitch: twitchLogin,
    displayName,
    notificationsEnabled:
      typeof raw.notificationsEnabled === "boolean"
        ? raw.notificationsEnabled
        : true,
    // Defauts explicites (defauts globaux) : sans eux, un champ absent valait
    // « activé » via !== false — bruyant des qu'on ajoute un streamer.
    gameNotificationsEnabled:
      typeof raw.gameNotificationsEnabled === "boolean"
        ? raw.gameNotificationsEnabled
        : DEFAULT_PREFERENCES.gameNotifications,
    titleNotificationsEnabled:
      typeof raw.titleNotificationsEnabled === "boolean"
        ? raw.titleNotificationsEnabled
        : DEFAULT_PREFERENCES.titleNotifications,
    avatarUrl: raw.avatarUrl || "",
    twitchId: platform === "twitch" ? raw.twitchId || "" : "",
    createdAt: raw.createdAt || Date.now(),
    socials: normalizeSocialLinks(raw.socials),
  };
}

export function resolveExternalUrl(rawValue, defaultOrigin = "") {
  if (!rawValue) {
    return "";
  }
  if (typeof rawValue === "object") {
    const candidate = rawValue.url || rawValue.src || rawValue.path || rawValue.location;
    if (!candidate && typeof rawValue.toString === "function") {
      return resolveExternalUrl(rawValue.toString(), defaultOrigin);
    }
    return resolveExternalUrl(candidate, defaultOrigin);
  }

  const value = String(rawValue).trim();
  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  if (defaultOrigin) {
    const origin = String(defaultOrigin).trim().replace(/\/+$/g, "");
    const path = value.replace(/^\/+/g, "");
    if (origin) {
      return `${origin}/${path}`;
    }
  }

  return value;
}

function fillDimensions(url, width = 1280, height = 720) {
  if (!url || typeof url !== "string") return url;
  return url
    .replace("{width}", String(width))
    .replace("{height}", String(height))
    .replace("%{width}", String(width))
    .replace("%{height}", String(height));
}

export function resolveKickAsset(value, { prefix = "https://files.kick.com" } = {}) {
  if (!value) return "";

  let raw = "";
  if (typeof value === "string") {
    raw = value;
  } else if (typeof value === "object") {
    raw = value?.url || value?.src || value?.href || "";
    // Handle toString for some edge case objects if needed, but usually safe to skip
    if (!raw && typeof value.toString === "function") {
      const text = value.toString();
      if (text && text !== "[object Object]") raw = text;
    }
  }

  if (!raw) return "";

  let normalized = fillDimensions(raw);
  if (!normalized) return "";

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  if (normalized.startsWith("//")) {
    return `https:${normalized}`;
  }

  const cleanPrefix = prefix.replace(/\/$/, "");
  const cleanPath = normalized.replace(/^\//, "");
  return `${cleanPrefix}/${cleanPath}`;
}

export function sizeThumbnail(url) {
  return String(url || "")
    .replace(/%?\{width\}/g, "440")
    .replace(/%?\{height\}/g, "248");
}
