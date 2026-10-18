import {
  PLATFORM_DEFINITIONS, buildProfileUrl, getHandleComparisonKey,
  isChannelPageUrl, isYoutubeChannelId, normalizePlatform, sanitizeHandle,
} from "./platforms.js";

export const MAX_BULK_SIZE = 50;

function platformOf(value) {
  const key = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalizePlatform(Object.hasOwn(PLATFORM_DEFINITIONS, key) ? key : "");
}

/** Same identity for input and persisted streamers, including legacy Twitch entries. */
export function getBulkKey(streamer) {
  if (!streamer || typeof streamer !== "object") return "";
  const platform = platformOf(streamer.platform);
  const raw = streamer.handle || streamer.twitch || (typeof streamer.id === "string" ? streamer.id.replace(`${platform}:`, "") : "");
  const handle = sanitizeHandle(platform, raw);
  if (!handle) return "";
  // platforms.js folds comparisons to lowercase, but YouTube channel IDs are case-sensitive.
  return platform === "youtube" && isYoutubeChannelId(handle)
    ? `${platform}:${handle}`
    : getHandleComparisonKey(platform, handle);
}

/** Parse only, never resolve accounts. Separators: newlines, commas, semicolons and tabs. */
export function parseBulkAdd(value, { defaultPlatform = "twitch", streamers = [] } = {}) {
  const tokens = typeof value === "string" ? value.split(/[\r\n,;\t]+/).map((token) => token.trim()).filter(Boolean) : [];
  const existing = new Set((Array.isArray(streamers) ? streamers : []).map(getBulkKey).filter(Boolean));
  const seen = new Set();
  const rows = tokens.slice(0, MAX_BULK_SIZE).map((raw) => {
    const row = { raw, platform: "", handle: "", status: "invalid", selected: false };
    let platform = platformOf(defaultPlatform);
    let token = raw;
    if (/[\s\\]/.test(raw)) return row;
    if (/[/:?#]/.test(raw) || /^(?:www\.|m\.|(?:twitch\.tv|kick\.com|youtube\.com|youtu\.be)$)/i.test(raw)) {
      try {
        const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : raw.startsWith("//") ? `https:${raw}` : `https://${raw}`);
        if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port) return row;
        const host = url.hostname.replace(/^(?:www|m)\./, "");
        platform = { "twitch.tv": "twitch", "kick.com": "kick", "youtube.com": "youtube" }[host];
        if (!platform) return row;
        const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
        if (platform === "youtube") {
          if (parts[0]?.startsWith("@")) token = parts.shift();
          else if (parts[0] === "channel" && isYoutubeChannelId(parts[1])) {
            parts.shift();
            token = parts.shift();
          } else return row;
          if (parts.length > 1 || (parts.length && !["featured", "videos", "shorts", "streams", "live", "playlists", "community", "about"].includes(parts[0]))) return row;
        } else {
          token = parts[0] || "";
          if (parts.length > 2 || (parts.length === 2 && !["about", "videos", "schedule", "clips"].includes(parts[1]))) return row;
        }
      } catch {
        return row;
      }
    }

    const bare = token.replace(/^@/, "");
    const pattern = platform === "youtube" ? /^[a-z0-9_.-]{3,30}$/i : platform === "kick" ? /^[a-z0-9_-]{1,25}$/i : /^[a-z0-9_]{1,25}$/i;
    if (!(platform === "youtube" && isYoutubeChannelId(bare)) && !pattern.test(bare)) return row;
    const handle = sanitizeHandle(platform, bare);
    if (platform !== "youtube") {
      // The shared route helper only accepts underscores; Kick also accepts hyphens.
      const kickHyphen = platform === "kick" && handle.includes("-") && !["account-settings", "help-center"].includes(handle);
      if (!kickHyphen && !isChannelPageUrl(buildProfileUrl(platform, handle))) return row;
    }
    const key = getBulkKey({ platform, handle });
    const status = seen.has(key) ? "duplicate" : existing.has(key) ? "existing" : "ready";
    seen.add(key);
    return { raw, platform, handle, status, selected: status === "ready" };
  });
  return { rows, total: tokens.length, overLimit: tokens.length > MAX_BULK_SIZE };
}
