import { CONFIG } from "../config.js";
import {
  translations,
  DEFAULT_LANGUAGE,
  formatTemplate,
} from "../i18n/translations.js";
import {
  DEFAULT_PLATFORM,
  buildProfileUrl,
  formatHandleForDisplay,
  getHandleComparisonKey,
  getPlatformIcon,
  getPlatformLabelKey,
  normalizePlatform,
  platformSupportsLiveStatus,
  sanitizeHandle,
} from "./platforms.js";

const STORAGE_KEYS = {
  STREAMERS: "betaGeneralStreamers",
  STATUSES: "betaGeneralStatuses",
  STATS: "betaGeneralStats",
  WATCH_TIME: "betaWatchTimeData",
};

const WATCHER_ALARM = "streampulseWatcher";
const KEEP_ALIVE_ALARM = "streampulseKeepAlive";

const streamerStates = new Map();
const streamerCache = new Map();
const streamerLiveState = new Map();
const NOTIFICATION_NAMESPACE = "streampulse";

const BADGE_COLOR_LIVE = "#f7f4e3";
const BADGE_COLOR_IDLE = "#6C5CE7";

const SUPPORTED_LANGUAGES = new Set(Object.keys(translations));
const PREFERENCES_KEY = "betaGeneralPreferences";
const DEFAULT_PREFERENCES = {
  liveNotifications: true,
  gameNotifications: false,
  soundsEnabled: true,
  autoClaimChannelPoints: true,
  autoRefreshPlayerErrors: true,
  enableFastForwardButton: true,
  watchTimeTracker: true,
  chatKeywords: "",
  chatBlockedUsers: "",
  language: DEFAULT_LANGUAGE,
  sortOrder: "live",
};

const DEFAULT_STATS = {
  channelPointsClaimed: 0,
};

const DEFAULT_POLL_INTERVAL =
  Number(CONFIG.pollIntervalMinutes) > 0 ? CONFIG.pollIntervalMinutes : 1;


function sanitizeLogin(value = "") {
  return sanitizeHandle("twitch", value);
}

// ─── Kick Official API — App Access Token ─────────────────────────────────────

const _kickToken = { value: null, expiresAt: 0 };

async function getKickCredentials() {
  const data = await chrome.storage.local.get("streampulse:kickCreds");
  return data["streampulse:kickCreds"] || null;
}

async function getKickAppToken() {
  const creds = await getKickCredentials();
  if (!creds?.clientId || !creds?.clientSecret) return null;

  // Use in-memory cache
  if (_kickToken.value && Date.now() < _kickToken.expiresAt - 120_000) {
    return _kickToken.value;
  }

  // Check persistent cache
  const stored = await chrome.storage.local.get("streampulse:kickToken");
  const cached = stored["streampulse:kickToken"];
  if (cached?.value && Date.now() < cached.expiresAt - 120_000) {
    _kickToken.value = cached.value;
    _kickToken.expiresAt = cached.expiresAt;
    return _kickToken.value;
  }

  // Fetch fresh token
  try {
    const resp = await fetch("https://id.kick.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }),
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    if (!json.access_token) return null;
    const expiresAt = Date.now() + (json.expires_in ?? 3600) * 1000;
    _kickToken.value = json.access_token;
    _kickToken.expiresAt = expiresAt;
    await chrome.storage.local.set({
      "streampulse:kickToken": { value: json.access_token, expiresAt },
    });
    return json.access_token;
  } catch {
    return null;
  }
}

async function fetchKickOfficial(slug, token) {
  const resp = await fetch(
    `https://api.kick.com/public/v1/channels?slug=${encodeURIComponent(slug)}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
  );
  if (!resp.ok) throw new Error(`${resp.status}`);
  const json = await resp.json();
  return json?.data?.[0] ?? null;
}

async function fetchJson(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
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

function normalizeStreamer(raw) {
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
    avatarUrl: raw.avatarUrl || "",
    twitchId: platform === "twitch" ? raw.twitchId || "" : "",
    createdAt: raw.createdAt || Date.now(),
    socials: normalizeSocialLinks(raw.socials),
  };
}

function normalizeLanguage(value) {
  if (typeof value === "string") {
    const candidate = value.toLowerCase();
    if (SUPPORTED_LANGUAGES.has(candidate)) {
      return candidate;
    }
  }
  return DEFAULT_LANGUAGE;
}

function resolveExternalUrl(rawValue, defaultOrigin = "") {
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

function resolveKickAsset(value, { prefix = "https://files.kick.com" } = {}) {
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

function resolveTranslationValue(lang, key) {
  if (!key) return null;
  const segments = key.split(".");
  let current = translations[lang] || translations[DEFAULT_LANGUAGE] || {};
  for (const segment of segments) {
    if (current && Object.prototype.hasOwnProperty.call(current, segment)) {
      current = current[segment];
    } else {
      current = null;
      break;
    }
  }
  if (current == null && lang !== DEFAULT_LANGUAGE) {
    return resolveTranslationValue(DEFAULT_LANGUAGE, key);
  }
  return current;
}

function translate(lang, key, params = {}) {
  const value = resolveTranslationValue(lang, key);
  if (typeof value === "string") {
    return formatTemplate(value, params);
  }
  if (typeof value === "function") {
    return value(params, { lang });
  }
  if (value == null) {
    return key;
  }
  return value;
}

function translateWithPrefs(preferences, key, params = {}) {
  const lang = normalizeLanguage(preferences?.language);
  return translate(lang, key, params);
}

function formatNumberForLanguage(lang, value) {
  try {
    const locale = lang === "fr" ? "fr-FR" : "en-US";
    return new Intl.NumberFormat(locale).format(value);
  } catch (error) {
    return String(value);
  }
}

class DataStore {
  static async getStreamers() {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.STREAMERS);
    const streamers = stored[STORAGE_KEYS.STREAMERS] || [];
    return streamers.map(normalizeStreamer);
  }

  static async saveStreamers(streamers) {
    const normalized = streamers.map(normalizeStreamer);
    await chrome.storage.local.set({
      [STORAGE_KEYS.STREAMERS]: normalized,
    });
    return normalized;
  }

  static async getStatuses() {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.STATUSES);
    return stored[STORAGE_KEYS.STATUSES] || {};
  }

  static async saveStatuses(statuses) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.STATUSES]: statuses,
    });
  }

  static async ensureDefaults() {
    const existing = await this.getStreamers();
    if (existing.length > 0) {
      return existing;
    }
    const defaults = (CONFIG.defaultStreamers || []).map(normalizeStreamer);
    await this.saveStreamers(defaults);
    return defaults;
  }

  static async updateStreamer(updatedStreamer) {
    const streamers = await this.getStreamers();
    const idx = streamers.findIndex((s) => s.id === updatedStreamer.id);
    if (idx === -1) {
      streamers.push(updatedStreamer);
    } else {
      streamers[idx] = normalizeStreamer({
        ...streamers[idx],
        ...updatedStreamer,
      });
    }
    await this.saveStreamers(streamers);
    return streamers[idx] || updatedStreamer;
  }
}

class PreferenceStore {
  static sanitize(preferences = {}) {
    const SORT_ORDER_VALUES = ["live", "name-asc", "name-desc", "custom"];
    return {
      liveNotifications: preferences.liveNotifications !== false,
      gameNotifications: Boolean(preferences.gameNotifications),
      soundsEnabled: preferences.soundsEnabled !== false,
      autoClaimChannelPoints: preferences.autoClaimChannelPoints !== false,
      autoRefreshPlayerErrors: preferences.autoRefreshPlayerErrors !== false,
      enableFastForwardButton: preferences.enableFastForwardButton !== false,
      watchTimeTracker: preferences.watchTimeTracker !== false,
      chatKeywords: typeof preferences.chatKeywords === "string" ? preferences.chatKeywords : "",
      chatBlockedUsers: typeof preferences.chatBlockedUsers === "string" ? preferences.chatBlockedUsers : "",
      language: normalizeLanguage(preferences.language),
      sortOrder: SORT_ORDER_VALUES.includes(preferences.sortOrder) ? preferences.sortOrder : "live",
    };
  }

  static async get() {
    try {
      const stored = await chrome.storage.local.get(PREFERENCES_KEY);
      return {
        ...DEFAULT_PREFERENCES,
        ...this.sanitize(stored[PREFERENCES_KEY] || {}),
      };
    } catch (error) {
      console.warn("Preference load error:", error.message);
      return { ...DEFAULT_PREFERENCES };
    }
  }

  static async set(preferences) {
    const sanitized = {
      ...DEFAULT_PREFERENCES,
      ...this.sanitize(preferences),
    };
    await chrome.storage.local.set({
      [PREFERENCES_KEY]: sanitized,
    });
    return sanitized;
  }

  static async update(updates) {
    const current = await this.get();
    const merged = { ...current, ...updates };
    return this.set(merged);
  }

  static async ensureDefaults() {
    const stored = await chrome.storage.local.get(PREFERENCES_KEY);
    if (!stored[PREFERENCES_KEY]) {
      await this.set(DEFAULT_PREFERENCES);
      return { ...DEFAULT_PREFERENCES };
    }
    return {
      ...DEFAULT_PREFERENCES,
      ...this.sanitize(stored[PREFERENCES_KEY]),
    };
  }
}

class StatsStore {
  static async get() {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEYS.STATS);
      return {
        ...DEFAULT_STATS,
        ...(stored[STORAGE_KEYS.STATS] || {}),
      };
    } catch (error) {
      console.warn("Stats load error:", error);
      return { ...DEFAULT_STATS };
    }
  }

  static async update(updates) {
    const current = await this.get();
    const merged = { ...current, ...updates };
    await chrome.storage.local.set({
      [STORAGE_KEYS.STATS]: merged,
    });
    return merged;
  }

  static async increment(stat, value = 1) {
    const current = await this.get();
    const newValue = (current[stat] || 0) + value;
    return this.update({ [stat]: newValue });
  }
}

// Avatar cache for watch time (avoids repeated API calls)
const wtAvatarCache = new Map();

async function resolveChannelAvatar(platform, channel) {
  const cacheKey = `${platform}:${channel}`;

  // 1. Memory cache
  if (wtAvatarCache.has(cacheKey)) return wtAvatarCache.get(cacheKey);

  // 2. Check followed streamers (streamerStates has statuses with avatarUrl)
  for (const [id, status] of streamerStates) {
    if (status?.handle === channel || id === channel) {
      const url = status?.avatarUrl || "";
      if (url) {
        wtAvatarCache.set(cacheKey, url);
        return url;
      }
    }
  }

  // 3. Check streamerCache
  for (const [, s] of streamerCache) {
    const sp = s.platform || "twitch";
    const handle = (s.handle || s.twitch || s.id || "").toLowerCase();
    if (sp === platform && handle === channel.toLowerCase()) {
      if (s.avatarUrl) {
        wtAvatarCache.set(cacheKey, s.avatarUrl);
        return s.avatarUrl;
      }
    }
  }

  // 4. API lookup (one-shot, cached)
  try {
    if (platform === "twitch") {
      const data = await fetchJson(
        `https://api.twitch.tv/helix/users?login=${encodeURIComponent(channel)}`,
        { headers: twitchHeaders() }
      );
      const url = data?.data?.[0]?.profile_image_url || "";
      wtAvatarCache.set(cacheKey, url);
      return url;
    }
    if (platform === "kick") {
      const data = await fetchJson(
        `https://kick.com/api/v2/channels/${encodeURIComponent(channel)}`
      );
      const url = data?.user?.profile_pic || "";
      wtAvatarCache.set(cacheKey, url);
      return url;
    }
  } catch {
    // API failed — cache empty string to avoid retrying every heartbeat
    wtAvatarCache.set(cacheKey, "");
  }

  return "";
}

class WatchTimeStore {
  static _getMonthKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  static async _getData() {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.WATCH_TIME);
    return stored[STORAGE_KEYS.WATCH_TIME] || {};
  }

  static async _saveData(data) {
    await chrome.storage.local.set({ [STORAGE_KEYS.WATCH_TIME]: data });
  }

  static async record(platform, channel, seconds, avatarUrl = "") {
    // Skip pure presence pings (no actual data to record)
    if (seconds <= 0) return;

    const month = this._getMonthKey();
    const data = await this._getData();

    if (!data[month]) data[month] = {};
    const key = `${platform}:${channel}`;
    if (!data[month][key]) {
      data[month][key] = { watchSeconds: 0, platform, channel, avatarUrl: "" };
    }

    data[month][key].watchSeconds += seconds;
    // Update avatar if we got a fresher one
    if (avatarUrl) data[month][key].avatarUrl = avatarUrl;

    // Prune months older than 3 months to save storage
    const months = Object.keys(data).sort();
    while (months.length > 3) {
      delete data[months.shift()];
    }

    await this._saveData(data);
  }

  static async getSummary(monthKey = null) {
    const data = await this._getData();
    const key = monthKey || this._getMonthKey();
    const monthData = data[key] || {};

    const entries = Object.values(monthData);
    entries.sort((a, b) => b.watchSeconds - a.watchSeconds);

    const topWatchedRaw = entries.slice(0, 10);

    // Resolve missing avatars before returning
    const topWatched = await Promise.all(
      topWatchedRaw.map(async (e) => {
        let avatarUrl = e.avatarUrl || "";
        if (!avatarUrl) {
          avatarUrl = await resolveChannelAvatar(e.platform, e.channel);
          // Persist resolved avatar for next time
          if (avatarUrl && monthData[`${e.platform}:${e.channel}`]) {
            monthData[`${e.platform}:${e.channel}`].avatarUrl = avatarUrl;
          }
        }
        return {
          platform: e.platform,
          channel: e.channel,
          watchSeconds: e.watchSeconds,
          avatarUrl,
        };
      })
    );

    // Save back any newly resolved avatars
    if (data[key]) {
      data[key] = monthData;
      await this._saveData(data);
    }

    const totalSeconds = entries.reduce((s, e) => s + e.watchSeconds, 0);
    const availableMonths = Object.keys(data).sort().reverse();

    return {
      month: key,
      availableMonths,
      totalSeconds,
      channelCount: entries.length,
      topWatched,
    };
  }
}

function twitchHeaders() {
  return {
    "Client-ID": CONFIG.clientId,
    Authorization: `Bearer ${CONFIG.accessToken}`,
    Accept: "application/json",
  };
}

class PlatformChecker {
  static async getTwitchUser(login) {
    const sanitized = sanitizeLogin(login);
    if (!sanitized) return null;
    try {
      const data = await fetchJson(
        `https://api.twitch.tv/helix/users?login=${sanitized}`,
        { headers: twitchHeaders() }
      );
      return data.data?.[0] || null;
    } catch (error) {
      console.warn("Twitch user fetch error:", error.message);
      return { _apiError: true, status: error.message };
    }
  }

  static async getTwitchStatus(login) {
    const sanitized = sanitizeLogin(login);
    if (!sanitized) return { isLive: false };
    try {
      const data = await fetchJson(
        `https://api.twitch.tv/helix/streams?user_login=${sanitized}`,
        { headers: twitchHeaders() }
      );
      const stream = data.data?.[0];
      if (!stream) {
        return { isLive: false };
      }
      return {
        isLive: true,
        platform: "twitch",
        game: stream.game_name || "",
        viewers: stream.viewer_count || 0,
        title: stream.title || "",
        startedAt: stream.started_at,
        sessionId: stream.id,
        thumbnailUrl: stream.thumbnail_url,
      };
    } catch (error) {
      console.warn("Twitch status error:", error.message);
      return { isLive: false, error: error.message };
    }
  }

  static async getKickChannel(handle) {
    const sanitized = sanitizeHandle("kick", handle);
    if (!sanitized) return null;

    // Try official API first (needs credentials)
    try {
      const token = await getKickAppToken();
      if (token) {
        const official = await fetchKickOfficial(sanitized, token);
        if (official) return { _source: "official", ...official };
      }
    } catch { /* fall through to V2 */ }

    // Fallback: unofficial V2 API
    try {
      const data = await fetchJson(
        `https://kick.com/api/v2/channels/${encodeURIComponent(sanitized)}`
      );
      if (!data || data.error) return null;
      return data;
    } catch (error) {
      if (error?.message?.includes?.("404")) return null;
      console.warn("Kick channel fetch error:", error.message);
      return { _apiError: true, status: error.message };
    }
  }

  // Extract status from official api.kick.com/public/v1/channels response
  static extractKickStatusOfficial(channel, handle) {
    const stream = channel?.stream;
    const slug = channel?.slug || handle;
    const base = {
      platform: "kick",
      url: buildProfileUrl("kick", slug),
      displayName: slug,
      avatarUrl: channel?.banner_picture || "",
    };

    if (!stream?.is_live) return { isLive: false, ...base };

    const thumb = stream.thumbnail || "";
    return {
      isLive: true,
      ...base,
      title: channel.stream_title || "",
      game: channel.category?.name || "",
      viewers: stream.viewer_count || 0,
      startedAt: stream.start_time || null,
      thumbnailUrl: thumb,
      thumbnailCandidates: thumb ? [thumb] : [],
      supportsLiveStatus: true,
    };
  }

  static extractKickStatus(channel, handle) {
    if (!channel) {
      return {
        isLive: false,
        platform: "kick",
        url: buildProfileUrl("kick", handle),
      };
    }

    const stream = channel?.livestream;
    const base = {
      platform: "kick",
      url: buildProfileUrl("kick", channel.slug || handle),
      avatarUrl:
        resolveKickAsset(channel?.user?.profile_pic) ||
        resolveKickAsset(channel?.profile_pic) ||
        "",
      displayName:
        channel?.user?.display_name ||
        channel?.user?.username ||
        channel?.slug ||
        handle,
    };

    const streamStatus = String(stream?.status || "").toLowerCase();
    // Some API responses use is_live boolean, others context.
    const isLive =
      Boolean(stream) &&
      (stream?.is_live === true || stream?.is_live === undefined) && // If undefined, rely on status
      (!streamStatus || streamStatus === "live");

    if (!isLive) {
      return {
        isLive: false,
        ...base,
      };
    }

    const category =
      stream?.category?.name ||
      stream?.category?.slug ||
      stream?.category?.title ||
      "";

    const preferredSize = { width: 1280, height: 720 };
    const dimensionSuffix = `${preferredSize.width}x${preferredSize.height}`;
    // Optimize: Cache for 60 seconds to prevent flickering on every popup open
    const cb = Math.floor(Date.now() / 60000); // 1-minute cache bucket

    const slug = channel?.slug || channel?.user?.username || stream?.slug;
    const channelId = channel?.id || stream?.channel_id || stream?.id;

    // API-provided URLs first (most reliable), then constructed fallbacks
    const apiRaw = [
      stream?.thumbnail?.url,
      stream?.thumbnail?.src,
      stream?.thumbnail_url,
      stream?.thumbnail,
    ];

    const constructedRaw = [];
    if (channelId) {
      constructedRaw.push(
        `https://images.kick.com/v2/stream-thumbnails/${channelId}/live-${dimensionSuffix}.webp`,
        `https://images.kick.com/v2/stream-thumbnails/${channelId}/live-${dimensionSuffix}.jpg`,
        `https://files.kick.com/stream-thumbnails/${channelId}/livestream-${dimensionSuffix}.webp`,
        `https://files.kick.com/stream-thumbnails/${channelId}/livestream-${dimensionSuffix}.jpg`,
        `https://files.kick.com/stream-thumbnails/${channelId}/livestream.jpg`
      );
    }
    if (slug) {
      constructedRaw.push(
        `https://files.kick.com/stream-thumbnails/${slug}/livestream-${dimensionSuffix}.webp`,
        `https://files.kick.com/stream-thumbnails/${slug}/livestream-${dimensionSuffix}.jpg`,
        `https://files.kick.com/stream-thumbnails/${slug}/livestream.jpg`
      );
    }

    const distinctUrls = new Set();
    const allCandidates = [];
    for (const raw of [...apiRaw, ...constructedRaw]) {
      const resolved = resolveKickAsset(raw);
      if (resolved && !resolved.includes("null") && !resolved.includes("undefined")) {
        if (!distinctUrls.has(resolved)) {
          distinctUrls.add(resolved);
          allCandidates.push(resolved);
        }
      }
    }

    // Cache bust, keep top 5
    const thumbnailCandidates = allCandidates.slice(0, 5).map(url => {
      if (url.includes("cb=")) return url;
      const separator = url.includes("?") ? "&" : "?";
      return `${url}${separator}cb=${cb}`;
    });

    const thumbnail = thumbnailCandidates[0] || "";
    
    const viewerCount =
      Number(stream?.viewer_count ?? stream?.viewers ?? stream?.view_count) ||
      0;

    return {
      isLive: true,
      ...base,
      game: category,
      viewers: viewerCount,
      title: stream?.session_title || stream?.title || "",
      startedAt: stream?.start_time || stream?.created_at || null,
      sessionId: stream?.id || null,
      thumbnailUrl: thumbnail,
      thumbnailCandidates,
    };
  }

  static async getKickStatus(handle) {
    const channel = await this.getKickChannel(handle);
    if (channel?._source === "official") {
      return this.extractKickStatusOfficial(channel, handle);
    }
    return this.extractKickStatus(channel, handle);
  }

  static async getDliveUser(handle) {
    const sanitized = sanitizeHandle("dlive", handle);
    if (!sanitized) return null;
    
    // Try by username first (more reliable for livestream status)
    const userQuery = `
      query ($username: String!) {
        user(username: $username) {
          username
          displayname
          avatar
          livestream {
            id
            title
            thumbnailUrl
            createdAt
            watchingCount
            category {
              title
            }
          }
        }
      }
    `;

    // Fallback if username fails
    const displayQuery = `
      query ($displayname: String!) {
        userByDisplayName(displayname: $displayname) {
          username
          displayname
          avatar
          livestream {
            id
            title
            thumbnailUrl
            createdAt
            watchingCount
            category {
              title
            }
          }
        }
      }
    `;

    try {
      // Attempt 1: by username
      let data = await fetchJson("https://graphigo.prd.dlive.tv/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userQuery, variables: { username: sanitized } }),
      });
      
      if (data?.data?.user) {
        return data.data.user;
      }

      // Attempt 2: by displayname (legacy fallback)
      data = await fetchJson("https://graphigo.prd.dlive.tv/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: displayQuery, variables: { displayname: sanitized } }),
      });

      return data?.data?.userByDisplayName || null;

    } catch (error) {
      console.warn("DLive user fetch error:", error.message);
      return { _apiError: true, status: error.message };
    }
  }

  static extractDliveStatus(user, handle) {
    if (!user) {
      return {
        isLive: false,
        platform: "dlive",
        url: buildProfileUrl("dlive", handle),
      };
    }

    const base = {
      platform: "dlive",
      url: buildProfileUrl("dlive", user.username || handle),
      avatarUrl: resolveExternalUrl(user.avatar, "https://images.prd.dlivecdn.com"),
      displayName: user.displayname || user.username || handle,
    };

    const stream = user.livestream;
    if (!stream) {
      return {
        isLive: false,
        ...base,
      };
    }

    let thumbnail = resolveExternalUrl(
      stream.thumbnailUrl || stream.thumbnail || stream.cover,
      "https://images.prd.dlivecdn.com"
    );
    
    if (thumbnail) {
      const cb = Math.floor(Date.now() / 60000);
      const separator = thumbnail.includes("?") ? "&" : "?";
      thumbnail = `${thumbnail}${separator}cb=${cb}`;
    }
    const viewerCount = Number(stream.watchingCount) || 0;
    return {
      isLive: true,
      ...base,
      title: stream.title || "",
      game: stream.category?.title || "",
      viewers: viewerCount,
      startedAt: stream.createdAt || null,
      sessionId: stream.id || null,
      thumbnailUrl: thumbnail,
    };
  }

  static async getDliveStatus(handle) {
    const user = await this.getDliveUser(handle);
    return this.extractDliveStatus(user, handle);
  }

  static async getStatus(streamer) {
    const platform = normalizePlatform(streamer?.platform);
    const supportsLive = platformSupportsLiveStatus(platform);
    if (platform === "twitch") {
      const login = streamer.twitch || streamer.handle;
      const status = await this.getTwitchStatus(login);
      return {
        ...status,
        platform,
        supportsLiveStatus: supportsLive,
        url: buildProfileUrl(platform, login),
      };
    }
    if (platform === "kick") {
      const status = await this.getKickStatus(streamer.handle || streamer.id);
      return {
        ...status,
        platform,
        supportsLiveStatus: supportsLive,
      };
    }
    if (platform === "dlive") {
      const status = await this.getDliveStatus(streamer.handle || streamer.id);
      return {
        ...status,
        platform,
        supportsLiveStatus: supportsLive,
      };
    }
    return {
      isLive: false,
      platform,
      supportsLiveStatus: supportsLive,
      url: buildProfileUrl(platform, streamer?.handle || ""),
    };
  }

  static async refreshAll() {
    return pollStreamers({ forceNotification: false });
  }
}

class NotificationCenter {
  static storageKey = `${NOTIFICATION_NAMESPACE}:scheduled`;
  static alarmPrefix = `${NOTIFICATION_NAMESPACE}:alarm:`;
  static clickMap = new Map();
  static initialized = false;

  static getDefaultIcon() {
    return chrome.runtime.getURL("images/photos/logo.png");
  }

  static resolveIcon(icon) {
    if (typeof icon === "string") {
      const trimmed = icon.trim();
      if (!trimmed) {
        return this.getDefaultIcon();
      }
      if (trimmed.startsWith("http://")) {
        return `https://${trimmed.slice(7)}`;
      }
      return trimmed;
    }
    return this.getDefaultIcon();
  }

  static async init() {
    if (this.initialized) return;
    this.initialized = true;

    chrome.notifications.onClicked.addListener((notificationId) => {
      const info = this.clickMap.get(notificationId);
      if (!info) return;
      this.clickMap.delete(notificationId);
      chrome.notifications.clear(notificationId);
      if (info.streamerId) {
        openStreamerFromNotification(info.streamerId);
      } else if (info.url) {
        chrome.tabs.create({ url: info.url });
      }
    });

    chrome.notifications.onClosed.addListener((notificationId) => {
      if (this.clickMap.has(notificationId)) {
        this.clickMap.delete(notificationId);
      }
    });

    const entries = await this.getScheduled();
    entries.forEach((entry) => {
      chrome.alarms.create(entry.alarmName, {
        delayInMinutes: 0.1,
        periodInMinutes: entry.intervalMinutes,
      });
    });
  }

  static async show(options = {}) {
    await this.init();
    const id = `${NOTIFICATION_NAMESPACE}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    // Cap clickMap to prevent unbounded growth
    if (this.clickMap.size > 50) {
      const oldest = this.clickMap.keys().next().value;
      this.clickMap.delete(oldest);
    }
    this.clickMap.set(id, {
      url: options.url || null,
      streamerId: options.streamerId || null,
      platform: options.platform || null,
    });
    await chrome.notifications.create(id, {
      type: "basic",
      iconUrl: this.resolveIcon(options.iconUrl),
      title: options.title || translate(DEFAULT_LANGUAGE, "common.appName"),
      message: options.message || "",
      requireInteraction: Boolean(options.requireInteraction),
      priority:
        typeof options.priority === "number"
          ? options.priority
          : options.requireInteraction
          ? 2
          : 0,
    });
    if (options.playSound) {
      await SoundManager.play(CONFIG.notifications?.soundFile);
    }
    return id;
  }

  static async schedule(options = {}) {
    await this.init();
    const entries = await this.getScheduled();
    const alarmName = options.name
      ? `${this.alarmPrefix}${options.name}`
      : `${this.alarmPrefix}${Date.now()}`;
    const interval = Math.max(
      Number(options.intervalMinutes) || DEFAULT_POLL_INTERVAL,
      0.1
    );
    const updated = entries.filter((entry) => entry.alarmName !== alarmName);
    updated.push({
      alarmName,
      title: options.title || translate(DEFAULT_LANGUAGE, "common.appName"),
      message: options.message || "",
      url: options.url || null,
      streamerId: options.streamerId || null,
      platform: options.platform || null,
      intervalMinutes: interval,
      requireInteraction: Boolean(options.requireInteraction),
      priority:
        typeof options.priority === "number"
          ? options.priority
          : options.requireInteraction
          ? 2
          : 0,
      playSound: options.playSound !== false,
      iconUrl: this.resolveIcon(options.iconUrl),
    });
    await this.saveScheduled(updated);
    chrome.alarms.create(alarmName, {
      delayInMinutes: 0.1,
      periodInMinutes: interval,
    });
    return alarmName;
  }

  static async cancel(name) {
    const entries = await this.getScheduled();
    const alarmName = `${this.alarmPrefix}${name}`;
    const filtered = entries.filter((entry) => entry.alarmName !== alarmName);
    await this.saveScheduled(filtered);
    chrome.alarms.clear(alarmName);
  }

  static async handleAlarm(alarmName) {
    await this.init();
    if (!alarmName.startsWith(this.alarmPrefix)) return false;
    const entries = await this.getScheduled();
    const entry = entries.find((item) => item.alarmName === alarmName);
    if (!entry) return false;
    await this.show(entry);
    return true;
  }

  static async getScheduled() {
    const stored = await chrome.storage.local.get(this.storageKey);
    return stored[this.storageKey] || [];
  }

  static async saveScheduled(entries) {
    await chrome.storage.local.set({ [this.storageKey]: entries });
  }
}

class NotificationSystem {
  static async notifyLive(streamer, status, preferences = DEFAULT_PREFERENCES) {
    if (preferences.liveNotifications === false) {
      return;
    }

    const lang = normalizeLanguage(preferences?.language);
    const platform = status.platform || streamer.platform || "twitch";
    const name =
      streamer.displayName ||
      formatHandleForDisplay(platform, streamer.handle || streamer.twitch);
    const title = translate(lang, "background.notifications.liveTitle", {
      name,
    });

    const detailParts = [];
    if (status.title) {
      detailParts.push(status.title);
    }
    if (status.game && Number.isFinite(status.viewers)) {
      detailParts.push(
        translate(lang, "background.notifications.liveMessage", {
          game: status.game,
          viewers: formatNumberForLanguage(lang, status.viewers),
        })
      );
    } else if (status.game) {
      detailParts.push(
        translate(lang, "background.notifications.liveMessageNoViewers", {
          game: status.game,
        })
      );
    } else if (Number.isFinite(status.viewers)) {
      detailParts.push(
        translate(lang, "background.notifications.liveMessageNoGame", {
          viewers: formatNumberForLanguage(lang, status.viewers),
        })
      );
    }

    const platformLabel = translate(lang, getPlatformLabelKey(platform));
    detailParts.push(platformLabel);
    const message = detailParts.filter(Boolean).join(" • ");

    const targetUrl = buildProfileUrl(
      platform,
      streamer.handle || streamer.twitch || streamer.id
    );
    const streamerStatus = streamerStates.get(streamer.id);
    const fallbackIcon =
      (chrome?.runtime && getPlatformIcon(platform)
        ? chrome.runtime.getURL(getPlatformIcon(platform))
        : null) || NotificationCenter.getDefaultIcon();
    const iconCandidate =
      streamerStatus?.avatarUrl || streamer.avatarUrl || fallbackIcon;
    const iconUrl = NotificationCenter.resolveIcon(iconCandidate);

    await NotificationCenter.show({
      title,
      message,
      streamerId: streamer.id,
      platform: status.platform,
      url: status.url || targetUrl,
      iconUrl,
      requireInteraction: true,
      priority: 2,
      playSound: preferences?.soundsEnabled !== false,
    });
  }

  static async notifyGameChange(
    streamer,
    fromGame,
    toGame,
    preferences = DEFAULT_PREFERENCES,
    platform = null
  ) {
    if (
      preferences.liveNotifications === false ||
      !preferences.gameNotifications
    ) {
      return;
    }

    const lang = normalizeLanguage(preferences?.language);
    const platformKey = platform || streamer.platform || "twitch";
    if (!platformSupportsLiveStatus(platformKey)) {
      return;
    }
    const title = translate(
      lang,
      "background.notifications.categoryChangeTitle",
      {
        name:
          streamer.displayName ||
          formatHandleForDisplay(
            platformKey,
            streamer.handle || streamer.twitch
          ),
      }
    );
    const message = translate(
      lang,
      "background.notifications.categoryChangeMessage",
      {
        from:
          fromGame ||
          translate(lang, "background.notifications.unknownCategory"),
        to: toGame || translate(lang, "background.notifications.newCategory"),
      }
    );

    const targetUrl = buildProfileUrl(
      platformKey,
      streamer.handle || streamer.twitch || streamer.id
    );
    const streamerStatus = streamerStates.get(streamer.id);
    const fallbackIcon =
      (chrome?.runtime && getPlatformIcon(platformKey)
        ? chrome.runtime.getURL(getPlatformIcon(platformKey))
        : null) || NotificationCenter.getDefaultIcon();
    const iconCandidate =
      streamerStatus?.avatarUrl || streamer.avatarUrl || fallbackIcon;
    const iconUrl = NotificationCenter.resolveIcon(iconCandidate);

    await NotificationCenter.show({
      title,
      message,
      streamerId: streamer.id,
      platform: platformKey,
      url: targetUrl,
      iconUrl,
      requireInteraction: false,
      priority: 1,
      playSound: preferences?.soundsEnabled !== false,
    });
  }

  static async sendTest(preferences = DEFAULT_PREFERENCES) {
    if (preferences.liveNotifications === false) {
      throw new Error(
        translateWithPrefs(
          preferences,
          "background.errors.notificationsDisabled"
        )
      );
    }

    const lang = normalizeLanguage(preferences?.language);

    await NotificationCenter.show({
      title: translate(lang, "common.appName"),
      message: translate(lang, "background.notifications.testSimpleMessage"),
      requireInteraction: true,
      priority: 2,
      playSound: preferences?.soundsEnabled !== false,
    });
  }
}

class SoundManager {
  static async play(filePath = "sons/notification.mp3") {
    if (!filePath) return;
    try {
      await chrome.offscreen.createDocument({
        url: "html/audio-handler.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Lecture d'une notification audio",
      });
    } catch (creationError) {
      if (
        !creationError?.message?.includes("Only a single offscreen") &&
        !creationError?.message?.includes("already created")
      ) {
        console.warn("Offscreen creation error:", creationError.message);
      }
    }

    try {
      await chrome.runtime.sendMessage({
        audioCommand: {
          action: "play",
          file: filePath,
          volume: 1.0,
        },
      });
    } catch (error) {
      console.warn("Audio playback error:", error.message);
    }
  }
}

class ActionBadge {
  static formatBadgeCount(count) {
    if (!Number.isFinite(count) || count <= 0) {
      return "";
    }
    if (count >= 100) {
      return "99+";
    }
    return String(count);
  }

  static async setLive(count, preferences = null) {
    const prefs = preferences || (await PreferenceStore.get());
    try {
      await chrome.action.setBadgeText({ text: this.formatBadgeCount(count) });
      await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_LIVE });
      await chrome.action.setTitle({
        title: translateWithPrefs(prefs, "background.badge.live", {
          count,
        }),
      });
    } catch (error) {
      console.warn("Badge live update failed:", error.message);
    }
  }

  static async clear(preferences = null) {
    const prefs = preferences || (await PreferenceStore.get());
    try {
      await chrome.action.setBadgeText({ text: "" });
      await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_IDLE });
      await chrome.action.setTitle({
        title: translateWithPrefs(prefs, "background.badge.idle"),
      });
    } catch (error) {
      console.warn("Badge clear failed:", error.message);
    }
  }

  static async update(liveCount, preferences = null) {
    const prefs = preferences || (await PreferenceStore.get());
    if (liveCount > 0) {
      await this.setLive(liveCount, prefs);
    } else {
      await this.clear(prefs);
    }
  }
}

async function buildStreamerStatus(streamer) {
  const platform = streamer.platform || "twitch";
  const status = await PlatformChecker.getStatus(streamer);
  const activeStatus = status.isLive
    ? { ...status, platform, supportsLiveStatus: status.supportsLiveStatus }
    : {
        isLive: false,
        platform,
        supportsLiveStatus: status.supportsLiveStatus,
        url: status.url || buildProfileUrl(platform, streamer.handle),
        avatarUrl: status.avatarUrl || "",
      };

  let avatarUrl = streamer.avatarUrl || status.avatarUrl || "";
  if (!avatarUrl && platform === "twitch") {
    const login = streamer.twitch || streamer.handle;
    if (status?.login) {
      avatarUrl = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${status.login}-128x128.jpg`;
    } else if (login) {
      avatarUrl = `https://static-cdn.jtvnw.net/jtv_user_pictures/${login}-profile_image-70x70.png`;
    }
  }
  if (!avatarUrl) {
    const fallbackIcon =
      (chrome?.runtime
        ? chrome.runtime.getURL(getPlatformIcon(platform))
        : null) || null;
    avatarUrl = fallbackIcon || "";
  }

  const displayName =
    streamer.displayName ||
    status.displayName ||
    formatHandleForDisplay(platform, streamer.handle || streamer.twitch);

  return {
    id: streamer.id,
    platform,
    handle: streamer.handle,
    displayName,
    avatarUrl,
    active: activeStatus,
    updatedAt: Date.now(),
  };
}

let _pollInFlight = null;
let _lastPollAt = 0;

async function pollStreamers({ forceNotification = false } = {}) {
  // Re-entrancy guard: dedupe concurrent calls
  if (_pollInFlight) return _pollInFlight;

  _pollInFlight = (async () => {
    try {
      return await _pollStreamersImpl({ forceNotification });
    } finally {
      _lastPollAt = Date.now();
      _pollInFlight = null;
    }
  })();
  return _pollInFlight;
}

async function _pollStreamersImpl({ forceNotification = false } = {}) {
  const streamers = await DataStore.getStreamers();
  const preferences = await PreferenceStore.get();
  if (streamers.length === 0) {
    await DataStore.saveStatuses({});
    await ActionBadge.update(0, preferences);
    return [];
  }

  if (streamerLiveState.size === 0) {
    const savedStatuses = await DataStore.getStatuses();
    Object.values(savedStatuses || {}).forEach((status) => {
      if (status && status.id) {
        streamerLiveState.set(status.id, {
          isLive: Boolean(status.active?.isLive),
          platform: status.active?.platform || null,
          game: status.active?.game || "",
          sessionId: status.active?.sessionId || null,
          title: status.active?.title || "",
          avatarUrl: status.avatarUrl || "",
          supportsLiveStatus:
            status.active?.supportsLiveStatus !== false,
        });
      }
    });
  }

  const streamerById = new Map();
  streamers.forEach((streamer) => {
    streamerCache.set(streamer.id, streamer);
    streamerById.set(streamer.id, streamer);
  });

  // Cap concurrency to 3 parallel fetches — lighter on RAM & network
  const statuses = [];
  const CONCURRENCY = 3;
  for (let i = 0; i < streamers.length; i += CONCURRENCY) {
    const batch = streamers.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(buildStreamerStatus));
    statuses.push(...results);
  }

  for (const status of statuses) {
    const streamer = streamerById.get(status.id);
    const previousLiveState = streamerLiveState.get(streamer.id) || {
      isLive: false,
      platform: null,
      game: "",
      sessionId: null,
      title: "",
      supportsLiveStatus: false,
    };

    const nextLiveState = {
      isLive: Boolean(status.active?.isLive),
      platform: status.active?.platform || null,
      game: status.active?.game || "",
      sessionId: status.active?.sessionId || null,
      title: status.active?.title || "",
      avatarUrl: status.avatarUrl || streamer.avatarUrl || null,
      supportsLiveStatus: status.active?.supportsLiveStatus !== false,
    };

    const notificationsEnabled =
      preferences.liveNotifications !== false &&
      streamer.notificationsEnabled !== false;

    if (forceNotification && notificationsEnabled && nextLiveState.isLive) {
      await NotificationSystem.notifyLive(streamer, status.active, preferences);
    } else if (notificationsEnabled && nextLiveState.isLive) {
      const wasLive = previousLiveState.isLive;
      const sessionChanged =
        previousLiveState.sessionId &&
        nextLiveState.sessionId &&
        previousLiveState.sessionId !== nextLiveState.sessionId;

      if (!wasLive || sessionChanged) {
        await NotificationSystem.notifyLive(
          streamer,
          status.active,
          preferences
        );
      } else {
        const gameNotificationsEnabled = streamer.gameNotificationsEnabled !== false;
        const shouldNotifyGame =
          preferences.gameNotifications &&
          gameNotificationsEnabled &&
          preferences.liveNotifications !== false &&
          previousLiveState.isLive &&
          previousLiveState.game &&
          nextLiveState.game &&
          previousLiveState.game !== nextLiveState.game &&
          (!previousLiveState.sessionId ||
            !nextLiveState.sessionId ||
            previousLiveState.sessionId === nextLiveState.sessionId);

        if (shouldNotifyGame) {
          await NotificationSystem.notifyGameChange(
            streamer,
            previousLiveState.game,
            nextLiveState.game,
            preferences,
            nextLiveState.platform
          );
        }
      }
    }

    streamerStates.set(status.id, status);
    streamerLiveState.set(streamer.id, nextLiveState);
  }

  const statusesObject = {};
  statuses.forEach((status) => {
    statusesObject[status.id] = status;
  });
  await DataStore.saveStatuses(statusesObject);

  const liveCount = statuses.reduce((total, status) => {
    return total + (status.active?.isLive ? 1 : 0);
  }, 0);
  await ActionBadge.update(liveCount, preferences);

  // Pre-cache thumbnails for live streamers (background)
  precacheThumbnails(statuses).catch(() => {});

  return statuses;
}

async function precacheThumbnails(statuses) {
  const CACHE_KEY = "streampulse:thumbCache";
  let cache = {};
  try {
    const stored = await chrome.storage.local.get(CACHE_KEY);
    cache = stored[CACHE_KEY] || {};
  } catch { /* ignore */ }

  let changed = false;

  for (const status of statuses) {
    if (!status.active?.isLive) continue;

    // Pick the best thumbnail URL (no fetch — CORS blocks HEAD from SW)
    const candidates = status.active.thumbnailCandidates || [];
    const mainThumb = status.active.thumbnailUrl;
    const url = candidates[0] || mainThumb;
    if (!url) continue;

    if (cache[status.id] !== url) {
      cache[status.id] = url;
      changed = true;
    }
  }

  // Clean cache: remove entries for streamers no longer followed
  const statusIds = new Set(statuses.map((s) => s.id));
  for (const id of Object.keys(cache)) {
    if (!statusIds.has(id)) {
      delete cache[id];
      changed = true;
    }
  }

  if (changed) {
    await chrome.storage.local.set({ [CACHE_KEY]: cache }).catch(() => {});
  }
}

function scheduleWatcherAlarm() {
  chrome.alarms.create(WATCHER_ALARM, {
    periodInMinutes: DEFAULT_POLL_INTERVAL,
    delayInMinutes: 0.1,
  });
}

function scheduleKeepAliveAlarm() {
  chrome.alarms.create(KEEP_ALIVE_ALARM, {
    periodInMinutes: Math.max(DEFAULT_POLL_INTERVAL / 2, 0.5),
    delayInMinutes: 0.1,
  });
}

// Keep-alive heartbeat removed: the KEEP_ALIVE_ALARM is sufficient in MV3.
// setInterval doesn't persist across SW termination anyway.

let initDone = false;

async function openOnboarding() {
  const url = chrome.runtime.getURL("html/onboarding.html");
  try {
    await chrome.tabs.create({ url });
  } catch (error) {
    console.warn("Failed to open onboarding:", error.message);
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  initDone = true;
  const streamers = await DataStore.ensureDefaults();
  await PreferenceStore.ensureDefaults();
  await NotificationCenter.init();
  scheduleWatcherAlarm();
  scheduleKeepAliveAlarm();

  await pollStreamers({ forceNotification: false });
  const installReason = details?.reason || "install";

  // Onboarding is shown only on fresh install. Existing users updating to a new
  // version keep their data and can edit their pseudo from the Settings tab.
  if (
    installReason === chrome.runtime.OnInstalledReason?.INSTALL ||
    installReason === "install"
  ) {
    const { onboardingShown } = await chrome.storage.local.get("onboardingShown");
    if (!onboardingShown && !streamers.length) {
      await chrome.storage.local.set({ onboardingShown: true });
      await openOnboarding();
    }
  }
});

chrome.runtime.onStartup.addListener(async () => {
  initDone = true;
  scheduleWatcherAlarm();
  scheduleKeepAliveAlarm();

  await PreferenceStore.ensureDefaults();
  await NotificationCenter.init();
  await pollStreamers({ forceNotification: false });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === WATCHER_ALARM) {
    pollStreamers({ forceNotification: false }).catch((error) => {
      console.warn("Polling error:", error.message);
    });
  } else if (alarm.name === KEEP_ALIVE_ALARM) {
    chrome.runtime.getPlatformInfo(() => {
      if (chrome.runtime.lastError) {
        console.debug(
          "KeepAlive alarm ping error:",
          chrome.runtime.lastError.message
        );
      }
    });
  } else if (alarm.name.startsWith(NotificationCenter.alarmPrefix)) {
    NotificationCenter.handleAlarm(alarm.name).catch((error) => {
      console.warn("Scheduled alarm error:", error?.message || error);
    });
  }
});

async function openStreamerFromNotification(streamerId) {
  if (!streamerId) return;
  const streamer = streamerCache.get(streamerId);
  const states = streamerStates.get(streamerId);

  const platform = normalizePlatform(
    streamer?.platform || states?.active?.platform || DEFAULT_PLATFORM
  );
  const handle =
    streamer?.handle ||
    streamer?.twitch ||
    states?.active?.login ||
    (platform === "twitch"
      ? sanitizeHandle("twitch", streamerId)
      : streamerId);
  const targetUrl = buildProfileUrl(platform, handle);

  try {
    await chrome.tabs.create({
      url: targetUrl,
    });
  } catch (error) {
    console.warn("Failed to open streamer page:", error?.message || error);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request?.type) {
    case "notify":
      (async () => {
        await NotificationCenter.show({
          title: request.title,
          message: request.message,
          url: request.url || null,
          streamerId: request.streamerId || null,
          platform: request.platform || null,
          requireInteraction: Boolean(request.requireInteraction),
          priority:
            typeof request.priority === "number"
              ? request.priority
              : request.requireInteraction
              ? 2
              : 0,
          playSound: request.playSound !== false,
        });
        sendResponse({ success: true });
      })();
      return true;

    case "schedule":
      (async () => {
        await NotificationCenter.schedule(request);
        sendResponse({ success: true });
      })();
      return true;

    case "diagnosticTests":
      (async () => {
        const preferences = await PreferenceStore.get();
        const lang = normalizeLanguage(preferences.language);
        await NotificationCenter.show({
          title: translate(lang, "background.notifications.test1Title"),
          message: translate(lang, "background.notifications.test1Message"),
          url: "https://www.twitch.tv/",
          playSound: true,
        });
        await delay(400);
        await NotificationCenter.show({
          title: translate(lang, "background.notifications.test2Title"),
          message: translate(lang, "background.notifications.test2Message"),
          url: "https://www.youtube.com/",
          requireInteraction: true,
          priority: 2,
          playSound: true,
        });
        await NotificationCenter.schedule({
          name: translate(lang, "background.diagnostics.scheduleName", {
            id: 3,
          }),
          title: translate(lang, "background.notifications.test3Title"),
          message: translate(lang, "background.notifications.test3Message"),
          url: "https://www.twitch.tv/directory/following/live",
          intervalMinutes: 1,
          requireInteraction: false,
          playSound: true,
        });
        await NotificationCenter.schedule({
          name: translate(lang, "background.diagnostics.scheduleName", {
            id: 4,
          }),
          title: translate(lang, "background.notifications.test4Title"),
          message: translate(lang, "background.notifications.test4Message"),
          url: "https://www.twitch.tv/directory",
          intervalMinutes: 0.5,
          requireInteraction: true,
          priority: 2,
          playSound: true,
        });
        await delay(400);
        await NotificationCenter.show({
          title: translate(lang, "background.notifications.test5Title"),
          message: translate(lang, "background.notifications.test5Message"),
          playSound: false,
        });
        sendResponse({ success: true });
      })();
      return true;

    case "streampulse:saveKickCreds":
      (async () => {
        const { clientId, clientSecret } = request;
        if (!clientId || !clientSecret) {
          // Clear credentials
          await chrome.storage.local.remove(["streampulse:kickCreds", "streampulse:kickToken"]);
          _kickToken.value = null;
          _kickToken.expiresAt = 0;
          sendResponse({ success: true });
          return;
        }
        await chrome.storage.local.set({
          "streampulse:kickCreds": { clientId, clientSecret },
        });
        // Invalidate cached token
        _kickToken.value = null;
        _kickToken.expiresAt = 0;
        await chrome.storage.local.remove("streampulse:kickToken");
        // Test token immediately
        const token = await getKickAppToken();
        sendResponse({ success: !!token });
      })();
      return true;

    case "streampulse:getKickCreds":
      (async () => {
        const creds = await getKickCredentials();
        const stored = await chrome.storage.local.get("streampulse:kickToken");
        const hasToken = !!(stored["streampulse:kickToken"]?.value);
        sendResponse({ clientId: creds?.clientId || "", hasToken });
      })();
      return true;

    case "streampulse:fetchJson":
      (async () => {
        try {
          const data = await fetchJson(
            request.url,
            request.options || {},
            request.timeoutMs || 15000
          );
          sendResponse({ success: true, data });
        } catch (error) {
          sendResponse({
            success: false,
            error: error?.message || String(error),
          });
        }
      })();
      return true;

    case "streampulse:fetchImage":
      // Fetch an image URL via the background (has proper credentials/cookies)
      // and return it as a base64 data URL so the popup can display it.
      (async () => {
        const { url } = request;
        if (!url) { sendResponse({ success: false }); return; }
        try {
          const response = await fetch(url, {
            credentials: "include",
            headers: {
              "Referer": "https://kick.com/",
              "Accept": "image/webp,image/avif,image/*,*/*",
            },
          });
          if (!response.ok) { sendResponse({ success: false, status: response.status }); return; }
          const mimeType = response.headers.get("content-type")?.split(";")[0] || "image/webp";
          const buffer = await response.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = "";
          const CHUNK = 8192;
          for (let i = 0; i < bytes.length; i += CHUNK) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
          }
          const dataUrl = `data:${mimeType};base64,${btoa(binary)}`;
          sendResponse({ success: true, dataUrl });
        } catch (e) {
          sendResponse({ success: false, error: e?.message });
        }
      })();
      return true;

    case "getStreamers":
      (async () => {
        const [streamers, statuses, preferences, profileData] = await Promise.all([
          DataStore.getStreamers(),
          DataStore.getStatuses(),
          PreferenceStore.get(),
          chrome.storage.local.get("userProfile")
        ]);
        sendResponse({ streamers, statuses, preferences, userProfile: profileData.userProfile || null });
      })();
      return true;

    case "lookupTwitchUser": {
      const handle = sanitizeHandle("twitch", request.handle || "");
      if (!handle) { sendResponse({ error: "invalid" }); return true; }
      PlatformChecker.getTwitchUser(handle)
        .then(user => {
          if (!user || user._apiError) {
            sendResponse({ user: null });
          } else {
            sendResponse({ user: { display_name: user.display_name, profile_image_url: user.profile_image_url, id: user.id } });
          }
        })
        .catch(() => sendResponse({ user: null }));
      return true;
    }

    case "updateUserProfile": {
      const profile = request.profile || {};
      chrome.storage.local.set({ userProfile: profile })
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ error: err.message }));
      return true;
    }

    case "addStreamer":
      (async () => {
        const preferences = await PreferenceStore.get();
        const requestedPlatform = request.platform || "twitch";
        const platform = normalizePlatform(
          requestedPlatform || DEFAULT_PLATFORM
        );
        const rawHandle =
          request.handle ??
          request.twitch ??
          request.login ??
          request.url ??
          "";
        const handle = sanitizeHandle(platform, rawHandle);

        if (!handle) {
          const platformLabel = translateWithPrefs(
            preferences,
            getPlatformLabelKey(platform)
          );
          sendResponse({
            error: translateWithPrefs(
              preferences,
              "background.errors.invalidHandle",
              { platform: platformLabel }
            ),
          });
          return;
        }

        const streamers = await DataStore.getStreamers();
        const incomingKey = getHandleComparisonKey(platform, handle);
        const alreadyExists = streamers.some((streamer) => {
          const existingKey = getHandleComparisonKey(
            streamer.platform || "twitch",
            streamer.handle || streamer.twitch || streamer.id
          );
          return existingKey === incomingKey;
        });

        if (alreadyExists) {
          const platformLabel = translateWithPrefs(
            preferences,
            getPlatformLabelKey(platform)
          );
          sendResponse({
            error: translateWithPrefs(
              preferences,
              "background.errors.streamerExistsPlatform",
              { platform: platformLabel }
            ),
          });
          return;
        }

        let sourceData = {
          id: `${platform}:${handle}`,
          platform,
          handle,
          notificationsEnabled: true,
          socials: {},
        };

        if (platform === "twitch") {
          const user = await PlatformChecker.getTwitchUser(handle);
          if (!user || user._apiError) {
            const errorKey = user?._apiError
              ? "background.errors.apiError"
              : "background.errors.streamerNotFound";
            sendResponse({
              error: translateWithPrefs(
                preferences,
                errorKey,
                {
                  platform: translateWithPrefs(
                    preferences,
                    getPlatformLabelKey(platform)
                  ),
                }
              ),
            });
            return;
          }

          sourceData = {
            ...sourceData,
            id: handle,
            twitch: handle,
            displayName: user.display_name || handle,
            avatarUrl: user.profile_image_url || "",
            twitchId: user.id,
          };
        } else if (platform === "kick") {
          const channel = await PlatformChecker.getKickChannel(handle);
          if (!channel || channel._apiError) {
            const errorKey = channel?._apiError
              ? "background.errors.apiError"
              : "background.errors.streamerNotFound";
            sendResponse({
              error: translateWithPrefs(
                preferences,
                errorKey,
                {
                  platform: translateWithPrefs(
                    preferences,
                    getPlatformLabelKey(platform)
                  ),
                }
              ),
            });
            return;
          }

          sourceData = {
            ...sourceData,
            displayName:
              channel?.user?.display_name ||
              channel?.user?.username ||
              channel?.slug ||
              formatHandleForDisplay(platform, handle),
            avatarUrl: resolveExternalUrl(
              channel?.user?.profile_pic,
              "https://files.kick.com"
            ),
            handle: channel?.slug || handle,
          };
        } else if (platform === "dlive") {
          const user = await PlatformChecker.getDliveUser(handle);
          if (!user || user._apiError) {
            const errorKey = user?._apiError
              ? "background.errors.apiError"
              : "background.errors.streamerNotFound";
            sendResponse({
              error: translateWithPrefs(
                preferences,
                errorKey,
                {
                  platform: translateWithPrefs(
                    preferences,
                    getPlatformLabelKey(platform)
                  ),
                }
              ),
            });
            return;
          }

          sourceData = {
            ...sourceData,
            displayName:
              user.displayname ||
              user.username ||
              formatHandleForDisplay(platform, handle),
            avatarUrl: resolveExternalUrl(
              user.avatar,
              "https://images.prd.dlivecdn.com"
            ),
            handle: user.username || handle,
          };
        } else {
          sourceData = {
            ...sourceData,
            displayName:
              request.displayName ||
              formatHandleForDisplay(platform, handle),
            avatarUrl: request.avatarUrl || "",
          };
        }

        if (platform === "twitch") {
          sourceData.id = sourceData.twitch;
        } else {
          sourceData.id = `${platform}:${sanitizeHandle(
            platform,
            sourceData.handle
          )}`;
        }

        const newStreamer = normalizeStreamer(sourceData);

        const updated = await DataStore.saveStreamers([
          ...streamers,
          newStreamer,
        ]);

        await pollStreamers({ forceNotification: false });

        sendResponse({
          success: true,
          streamers: updated,
        });
      })();
      return true;

    case "removeStreamer":
      (async () => {
        const targetId = request.id;
        const streamers = await DataStore.getStreamers();
        const filtered = streamers.filter((s) => s.id !== targetId);
        await DataStore.saveStreamers(filtered);
        streamerStates.delete(targetId);
        streamerCache.delete(targetId);
        streamerLiveState.delete(targetId);
        await pollStreamers({ forceNotification: false });
        sendResponse({ success: true, streamers: filtered });
      })();
      return true;

    case "toggleNotifications":
      (async () => {
        const preferences = await PreferenceStore.get();
        const streamers = await DataStore.getStreamers();
        const idx = streamers.findIndex((s) => s.id === request.id);
        if (idx === -1) {
          sendResponse({ error: translateWithPrefs(preferences, "background.errors.streamerNotFound", { platform: "" }) });
          return;
        }
        streamers[idx].notificationsEnabled = Boolean(request.enabled);
        await DataStore.saveStreamers(streamers);
        sendResponse({ success: true });
      })();
      return true;

    case "toggleGameNotifications":
      (async () => {
        const preferences = await PreferenceStore.get();
        const streamers = await DataStore.getStreamers();
        const idx = streamers.findIndex((s) => s.id === request.id);
        if (idx === -1) {
          sendResponse({ error: translateWithPrefs(preferences, "background.errors.streamerNotFound", { platform: "" }) });
          return;
        }
        streamers[idx].gameNotificationsEnabled = Boolean(request.enabled);
        await DataStore.saveStreamers(streamers);
        sendResponse({ success: true });
      })();
      return true;

    case "refreshStatuses":
      PlatformChecker.refreshAll().then(() => {
        sendResponse({ success: true });
      });
      return true;


    case "trackWatchTime":
      (async () => {
        try {
          const { channel, platform, seconds } = request;
          if (channel && platform) {
            const secs = Number(seconds) || 0;
            // Record immediately — never block on avatar resolution
            await WatchTimeStore.record(platform, channel, secs, "");
            // Best-effort avatar update (fire-and-forget, doesn't block response)
            if (secs > 0) {
              resolveChannelAvatar(platform, channel)
                .then(async (avatar) => {
                  if (avatar) {
                    const data = await WatchTimeStore._getData();
                    const month = WatchTimeStore._getMonthKey();
                    const key = `${platform}:${channel}`;
                    if (data[month]?.[key] && !data[month][key].avatarUrl) {
                      data[month][key].avatarUrl = avatar;
                      await WatchTimeStore._saveData(data);
                    }
                  }
                })
                .catch(() => {});
            }
          }
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ error: error.message });
        }
      })();
      return true;

    case "getWatchTimeSummary":
      (async () => {
        try {
          const summary = await WatchTimeStore.getSummary(request.month || null);
          sendResponse({ success: true, summary });
        } catch (error) {
          sendResponse({ error: error.message });
        }
      })();
      return true;

    case "getStats":
      StatsStore.get().then((stats) => {
        sendResponse({ success: true, stats });
      });
      return true;

    case "incrementStat":
      (async () => {
        const { stat, value } = request;
        if (stat) {
          await StatsStore.increment(stat, Number(value) || 1);
        }
        sendResponse({ success: true });
      })();
      return true;
    
    case "resetStat":
      (async () => {
        const { stat } = request;
        if (stat) {

          const current = await StatsStore.get();
          current[stat] = 0;
          await chrome.storage.local.set({ [STORAGE_KEYS.STATS]: current });
        }
        sendResponse({ success: true });
      })();
      return true;

    case "updatePreferences":
      (async () => {
        const incomingUpdates = request.updates || {};
        const updates = {};
        if ("liveNotifications" in incomingUpdates) {
          updates.liveNotifications =
            incomingUpdates.liveNotifications !== false;
        }
        if ("gameNotifications" in incomingUpdates) {
          updates.gameNotifications =
            incomingUpdates.gameNotifications === true;
        }
        if ("soundsEnabled" in incomingUpdates) {
          updates.soundsEnabled = incomingUpdates.soundsEnabled !== false;
        }
        if ("autoClaimChannelPoints" in incomingUpdates) {
          updates.autoClaimChannelPoints =
            incomingUpdates.autoClaimChannelPoints !== false;
        }
        if ("autoRefreshPlayerErrors" in incomingUpdates) {
          updates.autoRefreshPlayerErrors =
            incomingUpdates.autoRefreshPlayerErrors !== false;
        }
        if ("enableFastForwardButton" in incomingUpdates) {
          updates.enableFastForwardButton =
            incomingUpdates.enableFastForwardButton !== false;
        }
        if ("chatKeywords" in incomingUpdates) {
          updates.chatKeywords =
            typeof incomingUpdates.chatKeywords === "string"
              ? incomingUpdates.chatKeywords
              : "";
        }
        if ("chatBlockedUsers" in incomingUpdates) {
          updates.chatBlockedUsers =
            typeof incomingUpdates.chatBlockedUsers === "string"
              ? incomingUpdates.chatBlockedUsers
              : "";
        }
        if ("watchTimeTracker" in incomingUpdates) {
          updates.watchTimeTracker =
            incomingUpdates.watchTimeTracker !== false;
        }
        if ("language" in incomingUpdates) {
          updates.language = normalizeLanguage(incomingUpdates.language);
        }
        if ("sortOrder" in incomingUpdates) {
          const allowed = ["live", "name-asc", "name-desc", "custom"];
          const val = incomingUpdates.sortOrder;
          updates.sortOrder = allowed.includes(val) ? val : "live";
        }

        if (Object.keys(updates).length === 0) {
          const preferences = await PreferenceStore.get();
          sendResponse({
            error: translateWithPrefs(
              preferences,
              "background.errors.noPreferencesUpdate"
            ),
          });
          return;
        }

        const preferences = await PreferenceStore.update(updates);
        sendResponse({ success: true, preferences });
      })();
      return true;

    case "testNotification":
      (async () => {
        const preferences = await PreferenceStore.get();
        try {
          await NotificationSystem.sendTest(preferences);
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({
            error:
              error?.message ||
              translateWithPrefs(
                preferences,
                "background.errors.testNotificationFailed"
              ),
          });
        }
      })();
      return true;

    default:
      if (request?.audioCommand) {
        return false;
      }
      break;
  }

  return false;
});

scheduleWatcherAlarm();
scheduleKeepAliveAlarm();

(async () => {
  if (initDone) return;
  initDone = true;
  await PreferenceStore.ensureDefaults();
  await NotificationCenter.init();

  // Only poll on SW wake if cached statuses are stale (>60s old).
  // Avoids triggering a full poll every time the popup is reopened.
  try {
    const statuses = await DataStore.getStatuses();
    const updatedAts = Object.values(statuses || {})
      .map((s) => s?.updatedAt || 0)
      .filter(Boolean);
    const newest = updatedAts.length ? Math.max(...updatedAts) : 0;
    const staleness = Date.now() - newest;
    if (newest === 0 || staleness > 60_000) {
      pollStreamers({ forceNotification: false }).catch((err) => {
        console.warn("Initial poll failed:", err?.message || err);
      });
    }
  } catch (err) {
    console.warn("Init staleness check failed:", err?.message || err);
  }
})();
