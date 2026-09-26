import { CONFIG as LOCAL_CONFIG } from "../config.js";
import {
  translations,
  DEFAULT_LANGUAGE,
  formatTemplate,
  matchLanguage,
  resolveLocale,
} from "../i18n/translations.js";
import {
  DEFAULT_PLATFORM,
  buildProfileUrl,
  formatHandleForDisplay,
  getHandleComparisonKey,
  getPlatformIcon,
  getPlatformLabelKey,
  isYoutubeChannelId,
  normalizePlatform,
  platformSupportsLiveStatus,
  sanitizeHandle,
} from "./platforms.js";
import { HISTORY_KEY, addSession, emptyHistory, markSeen, patchSession, removeEntry } from "./history-data.js";
import { DEFAULT_PREFERENCES } from "./preferences-data.js";
import { thankPlusSubscriber } from "./plus-thanks.js";
import { SMART_ALERTS_KEY, normalizeRules, decideSmartAlert } from "./smart-alerts.js";
import { PLUS_KEY, getDeviceId, isPlusActive, needsRecheck, verifyLicense } from "./plus.js";
import { createPointsStore } from "./points-store.js";
import { createDropsStore } from "./drops-store.js";
import { BADGE_AUTO_KEY, CLAIM_OK_STATUSES, isPaidBadge } from "./drops-data.js";
import { createDropsClient } from "./drops-gql.js";
import { createBadgeAuto } from "./badge-auto-worker.js";
import { searchChannels } from "./channel-search.js";
import { syncEventSubRaid, stopEventSubRaid } from "./eventsubRaid.js";
import {
  RAID_WATCHER_ALARM,
  syncRaidWatcher,
  stopRaidWatcher,
} from "./raidWatcher.js";

/** Qualites proposees pour le lecteur Twitch. "auto" laisse Twitch decider. */
const PLAYER_QUALITIES = ["auto", "source", "1440", "1080", "720", "480", "360"];

const STORAGE_KEYS = {
  STREAMERS: "betaGeneralStreamers",
  STATUSES: "betaGeneralStatuses",
  STATS: "betaGeneralStats",
  WATCH_TIME: "betaWatchTimeData",
  // Meme forme que WATCH_TIME, mais par jour ("AAAA-MM-JJ") : alimente les
  // periodes glissantes de la page de recap (7 et 30 jours).
  WATCH_TIME_DAILY: "streamPulseWatchTimeDaily",
  // Dedicated key for live-state notification dedup. Separate from STATUSES
  // (which is the popup display data) so it survives even if statuses are
  // wiped/reset. This is critical for MV3: every SW restart wipes the
  // in-memory `streamerLiveState` Map, so we MUST restore from storage.
  LIVE_STATE: "streamPulseLiveState",
  EVENT_LOGS: "betaEventLogs",
};

// ─── Remote config (credentials hosted on Vercel, never in the zip) ──────────
const REMOTE_CONFIG_URL = "https://streampulse.fr/api/streampulse-config";
const REMOTE_CONFIG_CACHE_KEY = "streampulse:remoteConfig";
const REMOTE_CONFIG_TTL_MS = 30 * 60 * 1000; // 30 min — plafond avant re-check ;
// un token mort est de toute façon detecte au premier 401/403 (fetchTwitchJson
// recharge alors la config immédiatement), ce TTL ne borne que le pire cas.

let CONFIG = { ...LOCAL_CONFIG };
let _configReady = null;

async function fetchRemoteConfig() {
  try {
    const stored = await chrome.storage.local.get(REMOTE_CONFIG_CACHE_KEY);
    const cached = stored[REMOTE_CONFIG_CACHE_KEY];
    // Always hydrate from cache FIRST, even if stale, so credentials are
    // available immediately after an MV3 service-worker restart (which wipes
    // the in-memory CONFIG back to the token-less LOCAL_CONFIG). Without this,
    // an alarm-triggered poll fires before any network fetch and Twitch
    // rejects the token-less request with 401.
    if (cached?.data?.clientId) {
      CONFIG = { ...LOCAL_CONFIG, ...cached.data };
    }
    // Cache fresh → nothing more to do.
    if (cached && Date.now() - cached.fetchedAt < REMOTE_CONFIG_TTL_MS) return;
    // Cache missing or stale → refresh from the network. Le paramètre
    // aléatoire contourne le cache Edge (Vercel a deja servi des reponses
    // perimees contenant un token mort apres une rotation de credentials).
    const url = `${REMOTE_CONFIG_URL}?t=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (data?.clientId) {
      CONFIG = { ...LOCAL_CONFIG, ...data };
      await chrome.storage.local.set({
        [REMOTE_CONFIG_CACHE_KEY]: { data, fetchedAt: Date.now() },
      });
    }
  } catch {
    // Network error: keep whatever we hydrated from cache (or local fallback)
  }
}

// Gate every Twitch API call behind this. Returns instantly once credentials
// are loaded for this service-worker lifetime; otherwise re-hydrates from the
// storage cache (and refreshes from network). Deduped so a burst of callers
// triggers a single load.
function ensureConfig() {
  if (CONFIG.accessToken) return Promise.resolve();
  if (!_configReady) {
    _configReady = fetchRemoteConfig().finally(() => {
      _configReady = null;
    });
  }
  return _configReady;
}

/**
 * Rotation de token : quand Twitch rejette le jeton en cache (401/403), on
 * re-fetch la config serveur en ignorant le cache de 6 h. Une rotation côté
 * streampulse.fr devient donc effective en quelques secondes chez tous les
 * utilisateurs, au lieu d'attendre l'expiration du TTL.
 */
async function refreshRemoteConfigForce() {
  try {
    const res = await fetch(`${REMOTE_CONFIG_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data?.clientId) return false;
    CONFIG = { ...LOCAL_CONFIG, ...data };
    await chrome.storage.local.set({
      [REMOTE_CONFIG_CACHE_KEY]: { data, fetchedAt: Date.now() },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * fetchJson pour l'API Twitch : rejoue la requête une fois si Twitch répond
 * 401/403 après avoir rechargé la config distante (token expiré ou révoqué
 * pendant que le cache local le croyait encore bon).
 */
async function fetchTwitchJson(url, options = {}, timeoutMs = 15000) {
  await ensureConfig();
  try {
    return await fetchJson(url, options, timeoutMs);
  } catch (error) {
    if (!/^(401|403) /.test(String(error?.message || ""))) throw error;
    const refreshed = await refreshRemoteConfigForce();
    if (!refreshed) throw error;
    return fetchJson(url, options, timeoutMs);
  }
}

const WATCHER_ALARM = "streampulseWatcher";
const KEEP_ALIVE_ALARM = "streampulseKeepAlive";
const AUTO_OPEN_INVENTORY_ALARM = "streamPulseAutoOpenInventoryAlarm";

async function setupAutoOpenInventoryAlarm(prefs = {}) {
  if (prefs.autoOpenInventory && Number(prefs.autoOpenInventoryIntervalHours) > 0) {
    const minutes = Number(prefs.autoOpenInventoryIntervalHours) * 60;
    chrome.alarms.create(AUTO_OPEN_INVENTORY_ALARM, {
      periodInMinutes: minutes,
    });
  } else {
    chrome.alarms.clear(AUTO_OPEN_INVENTORY_ALARM);
  }
}

const streamerStates = new Map();
const streamerCache = new Map();
const streamerLiveState = new Map();
const NOTIFICATION_NAMESPACE = "streampulse";

const BADGE_COLOR_LIVE = "#f7f4e3";
const BADGE_COLOR_IDLE = "#6C5CE7";

const PREFERENCES_KEY = "betaGeneralPreferences";

const DEFAULT_STATS = {
  channelPointsClaimed: 0,
  dropsClaimed: 0,
  momentsClaimed: 0,
  raidsCancelled: 0,
};

const DEFAULT_POLL_INTERVAL =
  Number(CONFIG.pollIntervalMinutes) > 0 ? CONFIG.pollIntervalMinutes : 1;


// ─── Diagnostic : expose tot, meme si une erreur survient plus bas ───────────
// Console du service worker (chrome://extensions → inspect du worker).
self.__SP_DEBUG__ = {
  async fakeTitleChange(handle) {
    return this._fake(handle, "title", " [test StreamPulse]");
  },
  async fakeGameChange(handle) {
    return this._fake(handle, "game", "Tests & Démos");
  },
  async fakeRaid(handle) {
    const streamers = await DataStore.getStreamers();
    const login = String(handle || "").toLowerCase();
    const streamer = streamers.find(
      (item) => String(item.handle || item.twitch || "").toLowerCase() === login
    );
    if (!streamer) return "StreamPulse: streamer introuvable";
    await notifyIncomingRaid({
      channel: streamer.handle || streamer.twitch,
      raider: streamer.displayName || "TestRaid",
      viewers: 42,
    });
    return "StreamPulse: notification de raid envoyee (chemin d'affichage)";
  },
  async _fake(handle, field, value) {
    const streamers = await DataStore.getStreamers();
    const login = String(handle || "").toLowerCase();
    const streamer = streamers.find(
      (item) =>
        String(item.handle || item.twitch || "").toLowerCase() === login ||
        (login === "" && streamerLiveState.get(item.id)?.isLive)
    );
    if (!streamer) return "StreamPulse: streamer introuvable (essaie sans handle pour cibler n'importe quel streamer en direct)";
    const state = streamerLiveState.get(streamer.id);
    if (!state || !state.isLive) {
      return `StreamPulse: ${streamer.handle} n'est pas en direct — la simulation n'a de sens qu'en direct`;
    }
    state[field] = value;
    await pollStreamers();
    return `StreamPulse: changement de ${field} simule pour ${streamer.handle} — une alerte doit partir si l'alerte correspondante est active`;
  },
};

function sanitizeLogin(value = "") {
  return sanitizeHandle("twitch", value);
}

// ─── Kick Official API: App Access Token ─────────────────────────────────────

const _kickToken = { value: null, expiresAt: 0 };

async function getKickCredentials() {
  const data = await chrome.storage.local.get("streampulse:kickCreds");
  const stored = data["streampulse:kickCreds"];
  if (stored?.clientId && stored?.clientSecret) return stored;
  // Repli : identifiants servis par la config distante streampulse.fr
  // (variables Vercel STREAMPULSE_KICK_CLIENT_ID / _CLIENT_SECRET), hydratées
  // dans CONFIG par fetchRemoteConfig().
  if (CONFIG.kickClientId && CONFIG.kickClientSecret) {
    return { clientId: CONFIG.kickClientId, clientSecret: CONFIG.kickClientSecret };
  }
  return null;
}

// Vol unique : sans lui, deux sondages concurrents demandent chacun un jeton
// a id.kick.com et le second ecrase le premier, pour rien.
let _kickTokenInFlight = null;

function getKickAppToken() {
  _kickTokenInFlight ||= fetchKickAppToken().finally(() => {
    _kickTokenInFlight = null;
  });
  return _kickTokenInFlight;
}

async function fetchKickAppToken() {
  // Les identifiants Kick peuvent venir de la config distante : garantit qu'elle
  // est hydratee (cache d'abord) avant de conclure a une absence de creds.
  await ensureConfig();

  // 1) Voie privilégiée : le proxy streampulse.fr fabrique le jeton — le client
  // secret ne quitte jamais le serveur. Échec silencieux si l'endpoint est
  // indisponible (ancien déploiement) : on retombe sur les credentials locaux.
  try {
    const resp = await fetch(`https://streampulse.fr/api/kick-token?t=${Date.now()}`, { cache: "no-store" });
    if (resp.ok) {
      const json = await resp.json();
      const expiresAt = json.expires_at ?? Date.now() + (json.expires_in ?? 3600) * 1000;
      if (json.access_token && Date.now() < expiresAt - 120_000) {
        _kickToken.value = json.access_token;
        _kickToken.expiresAt = expiresAt;
        await chrome.storage.local.set({
          "streampulse:kickToken": { value: json.access_token, expiresAt },
        });
        return json.access_token;
      }
    }
  } catch { /* repli ci-dessous */ }

  // 2) Repli : credentials locaux (saveKickCreds / config distante transitoire)
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
    /* eslint-disable require-atomic-updates -- getKickAppToken() serialise les
       appels concurrents par une promesse partagee, aucun entrelacement
       possible ici. La regle ne voit pas ce garde, place dans l'appelant. */
    _kickToken.value = cached.value;
    _kickToken.expiresAt = cached.expiresAt;
    /* eslint-enable require-atomic-updates */
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
    /* eslint-disable require-atomic-updates -- meme raison : appel serialise. */
    _kickToken.value = json.access_token;
    _kickToken.expiresAt = expiresAt;
    /* eslint-enable require-atomic-updates */
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

function normalizeLanguage(value) {
  return matchLanguage(value) || DEFAULT_LANGUAGE;
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
    return new Intl.NumberFormat(resolveLocale(lang)).format(value);
  } catch {
    return String(value);
  }
}

// Bornes 1-24 h : une seule source de coercion, shared par sanitize() et le
// handler updatePreferences (prealablement dupliquees avec des regles differentes).
function clampInventoryIntervalHours(value) {
  const hours = Number(value);
  return Number.isFinite(hours)
    ? Math.min(24, Math.max(1, Math.round(hours)))
    : 24;
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

  // Live-state dedicated key: persistent across SW restarts. Used ONLY for
  // notification dedup (was-live / session-id tracking). Never wiped by the
  // poll loop, even if streamers list is transiently empty.
  static async getLiveState() {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.LIVE_STATE);
    return stored[STORAGE_KEYS.LIVE_STATE] || {};
  }

  static async saveLiveState(stateObject) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.LIVE_STATE]: stateObject,
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

/**
 * Couleur du badge communautaire : un mode connu, ou une couleur hexadecimale.
 * Toute autre valeur retombe sur le defaut plutot que d'etre ecrite telle quelle.
 */
function sanitizeBadgeColor(value) {
  if (value === "theme" || value === "author") return value;
  if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    return value.trim().toLowerCase();
  }
  return DEFAULT_PREFERENCES.communityBadgeColor;
}

class PreferenceStore {
  static sanitize(preferences = {}) {
    const SORT_ORDER_VALUES = ["live", "name-asc", "name-desc", "custom"];
    const PREVIEWS_SIZES = ["s", "m", "l"];
    const previewsDelay = Number(preferences.previewsShowDelayMs);
    return {
      liveNotifications: preferences.liveNotifications !== false,
      gameNotifications: Boolean(preferences.gameNotifications),
      titleNotifications: Boolean(preferences.titleNotifications),
      // Ces trois cles etaient absentes de sanitize() : elles etaient acceptees
      // par le handler updatePreferences puis perdues a l'ecriture, et le spread
      // de DEFAULT_PREFERENCES dans set() les remettait a true. Impossible de les
      // desactiver. La parite DEFAULT_PREFERENCES / sanitize() est desormais
      // verifiee par scripts/verify.mjs.
      dropAlerts: preferences.dropAlerts !== false,
      predictionAlerts: preferences.predictionAlerts !== false,
      raidAlerts: preferences.raidAlerts !== false,
      backgroundRaidAlerts: preferences.backgroundRaidAlerts === true,
      updateNotifications: preferences.updateNotifications !== false,
      soundsEnabled: preferences.soundsEnabled !== false,
      autoClaimChannelPoints: preferences.autoClaimChannelPoints !== false,
      autoClaimDrops: preferences.autoClaimDrops !== false,
      autoClaimMoments: preferences.autoClaimMoments !== false,
      autoOpenInventory: Boolean(preferences.autoOpenInventory),
      autoOpenInventoryIntervalHours: clampInventoryIntervalHours(preferences.autoOpenInventoryIntervalHours),
      hideTwitchExtensions: Boolean(preferences.hideTwitchExtensions),
      keepQualityInBackground: preferences.keepQualityInBackground === true,
      enablePipButton: preferences.enablePipButton !== false,
      autoRefreshPlayerErrors: preferences.autoRefreshPlayerErrors !== false,
      enableClipDownload: preferences.enableClipDownload !== false,
      playerQuality: PLAYER_QUALITIES.includes(preferences.playerQuality) ? preferences.playerQuality : "auto",
      // Les alertes de raid rapportent des points en suivant le raid : garder
      // l'annulation automatique active rendrait les deux fonctionnalités
      // contradictoires (le raid est annulé avant qu'on puisse le suivre).
      // Tant que le détecteur de raids est actif, l'annulation est forcée off.
      autoCancelRaids:
        preferences.autoCancelRaids === true && preferences.backgroundRaidAlerts !== true,
      preventTabDiscard: preferences.preventTabDiscard !== false,
      enablePredictionsPopup: preferences.enablePredictionsPopup !== false,
      enableTabLiveIcon: preferences.enableTabLiveIcon !== false,
      enableStreamerFavicon: preferences.enableStreamerFavicon !== false,
      enableFastForwardButton: preferences.enableFastForwardButton !== false,
      watchTimeTracker: preferences.watchTimeTracker !== false,
      pointsTracking: preferences.pointsTracking !== false,
      dropsTracking: preferences.dropsTracking !== false,
      chatKeywords: typeof preferences.chatKeywords === "string" ? preferences.chatKeywords : "",
      chatBlockedUsers: typeof preferences.chatBlockedUsers === "string" ? preferences.chatBlockedUsers : "",
      language: normalizeLanguage(preferences.language),
      sortOrder: SORT_ORDER_VALUES.includes(preferences.sortOrder) ? preferences.sortOrder : "live",
      previewsEnabled: preferences.previewsEnabled !== false,
      previewsMode: preferences.previewsMode === "video" ? "video" : "image",
      previewsSurfaceDirectory: preferences.previewsSurfaceDirectory !== false,
      previewsSurfaceSidebar: preferences.previewsSurfaceSidebar !== false,
      previewsSurfaceClips: preferences.previewsSurfaceClips !== false,
      previewsSurfaceSearch: preferences.previewsSurfaceSearch !== false,
      previewsSize: PREVIEWS_SIZES.includes(preferences.previewsSize) ? preferences.previewsSize : "m",
      previewsAudio: preferences.previewsAudio === true,
      previewsShowDelayMs: Number.isFinite(previewsDelay)
        ? Math.min(2000, Math.max(0, previewsDelay))
        : 200,
      previewsAnimations: preferences.previewsAnimations !== false,
      communityBadge: preferences.communityBadge === true,
      communityBadgeColor: sanitizeBadgeColor(preferences.communityBadgeColor),
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
    setupAutoOpenInventoryAlarm(sanitized);
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

  // Read-modify-write sequencé : deux increments quasi simultanes (points +
  // drop dans la meme seconde) s'ecrasaient sinon — meme pattern que HistoryStore.
  static _queue = Promise.resolve();

  static _enqueue(task) {
    const run = this._queue.then(task, task);
    this._queue = run.catch(() => {});
    return run;
  }

  static increment(stat, value = 1) {
    return this._enqueue(async () => {
      const current = await this.get();
      const newValue = (current[stat] || 0) + value;
      return this.update({ [stat]: newValue });
    });
  }
}

class EventLogStore {
  // Before the EVENT_LOGS key existed, getLogs() read the whole storage and
  // addLog() wrote under the literal "undefined" key. Recover those logs once.
  static LEGACY_KEY = "undefined";

  static async getLogs() {
    try {
      const stored = await chrome.storage.local.get([
        STORAGE_KEYS.EVENT_LOGS,
        this.LEGACY_KEY,
      ]);
      const current = stored[STORAGE_KEYS.EVENT_LOGS];
      if (current) {
        return current;
      }
      const legacy = stored[this.LEGACY_KEY];
      if (Array.isArray(legacy) && legacy.length > 0) {
        await chrome.storage.local.set({ [STORAGE_KEYS.EVENT_LOGS]: legacy });
        await chrome.storage.local.remove(this.LEGACY_KEY);
        return legacy;
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  static async addLog(entry = {}) {
    try {
      const logs = await this.getLogs();
      const newLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        type: entry.type || "info", // "drop", "moment", "raid", "prediction", "points"
        channel: entry.channel || "",
        text: entry.text || "",
        value: entry.value || 0,
      };
      logs.unshift(newLog);
      if (logs.length > 100) logs.pop();
      await chrome.storage.local.set({ [STORAGE_KEYS.EVENT_LOGS]: logs });
      return newLog;
    } catch (_) {
      return null;
    }
  }

  static async clearLogs() {
    await chrome.storage.local.set({ [STORAGE_KEYS.EVENT_LOGS]: [] });
    return [];
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
      await ensureConfig();
      const data = await fetchTwitchJson(
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
    // API failed: cache empty string to avoid retrying every heartbeat
    wtAvatarCache.set(cacheKey, "");
  }

  return "";
}

// ─── Suggestions de chaînes (champ d'ajout du popup) ─────────────────────────
// Une frappe = une requête au plus toutes les 220 ms côté popup ; ce cache d'une
// minute évite de redemander la même saisie (retour arrière, retape).
const SUGGEST_TTL_MS = 60_000;
const suggestCache = new Map();

const channelSearchFetchers = {
  twitch: (query) =>
    fetchTwitchJson(`https://api.twitch.tv/helix/search/channels?query=${encodeURIComponent(query)}&first=10`, { headers: twitchHeaders() }, 8000),
  kick: (query) => fetchJson(`https://kick.com/api/search?searched_word=${encodeURIComponent(query)}`, {}, 8000),
};

async function suggestChannels(platform, query) {
  const key = `${platform}:${String(query || "").toLowerCase()}`;
  const cached = suggestCache.get(key);
  if (cached && Date.now() - cached.at < SUGGEST_TTL_MS) return cached.items;
  const items = await searchChannels(platform, query, channelSearchFetchers);
  if (suggestCache.size > 100) suggestCache.clear();
  suggestCache.set(key, { at: Date.now(), items });
  return items;
}

// ─── Suivi des points de chaîne ───────────────────────────────────────────────
// Les gains arrivent de pointsRecorder.js ; points-store.js est le seul à les
// écrire. Les noms des chaînes viennent de Helix, par lots de 100 identifiants.

async function resolveTwitchChannels(ids) {
  await ensureConfig();
  const query = ids.map((id) => `id=${encodeURIComponent(id)}`).join("&");
  const data = await fetchTwitchJson(`https://api.twitch.tv/helix/users?${query}`, { headers: twitchHeaders() });
  return (data?.data || []).map((user) => ({
    id: String(user.id),
    login: user.login,
    displayName: user.display_name || user.login,
    avatar: user.profile_image_url || "",
  }));
}

const pointsStore = createPointsStore({ storage: chrome.storage.local, resolveChannels: resolveTwitchChannels });

// ─── Suivi des Drops ──────────────────────────────────────────────────────────
// dropsRecorder.js relaie l'inventaire, les événements et les campagnes lus
// dans la page Twitch ; drops-store.js est le seul à les écrire. Les requêtes
// vers Twitch partent toujours de la page : ici, on ne fait que ranger,
// prévenir, et confier les récupérations à un onglet Twitch.

const dropsStore = createDropsStore({ storage: chrome.storage.local, resolveChannels: resolveTwitchChannels });
/** Un Drop gagné hors de la vue (lecture tardive) ne déclenche pas d'alerte. */
const DROP_ALERT_MAX_AGE_MS = 60 * 60_000;
const DROP_ALERTS_PER_READ = 3;
/** Le popup ouvert ne relance pas une lecture plus récente que ce délai. */
const DROPS_POPUP_REFRESH_MS = 2 * 60_000;

/** Journal d'événements, compteur et alerte pour chaque Drop obtenu. */
async function announceDrops(entries) {
  if (!entries?.length) return;
  const prefs = await PreferenceStore.get();
  const now = Date.now();
  let alerts = 0;
  for (const entry of entries) {
    const label = [entry.name, entry.game].filter(Boolean).join(" · ");
    await StatsStore.increment("dropsClaimed", 1);
    await EventLogStore.addLog({ type: "drop", channel: entry.channel || "", text: label || translateWithPrefs(prefs, "background.notifications.dropMessage"), value: 1 });
    if (!prefs.dropAlerts || now - entry.at > DROP_ALERT_MAX_AGE_MS || alerts >= DROP_ALERTS_PER_READ) continue;
    alerts += 1;
    await NotificationCenter.show({
      title: translateWithPrefs(prefs, "background.notifications.dropTitle"),
      message: label
        ? translateWithPrefs(prefs, "background.notifications.dropClaimedMessage", { reward: label })
        : translateWithPrefs(prefs, "background.notifications.dropMessage"),
    });
  }
}

/** Onglets Twitch, celui qui a parlé d'abord, puis l'onglet actif. */
async function twitchTabs(preferredId) {
  const tabs = await chrome.tabs.query({ url: "https://www.twitch.tv/*" });
  return tabs
    .filter((tab) => tab.id !== undefined && tab.discarded !== true)
    .sort((a, b) => Number(b.id === preferredId) - Number(a.id === preferredId) || Number(b.active) - Number(a.active));
}

const dropsClient = createDropsClient({ fetch: (...args) => fetch(...args), cookies: chrome.cookies });
const DROPS_ALARM = "streampulse-drops";
const DROPS_ALARM_MINUTES = 10;
/** Un onglet Twitch qui vient de relire l'inventaire dispense le service worker de le faire. */
const DROPS_WORKER_MIN_GAP_MS = 4 * 60_000;

function scheduleDropsAlarm() {
  chrome.alarms.get(DROPS_ALARM, (existing) => {
    if (!existing) chrome.alarms.create(DROPS_ALARM, { periodInMinutes: DROPS_ALARM_MINUTES, delayInMinutes: 1 });
  });
}

/**
 * Relit l'inventaire des Drops sans onglet Twitch ouvert (session lue dans le
 * cookie), puis récupère les Drops prêts si la récupération auto est active.
 * Utile quand on regarde sur un autre appareil, et pour un popup à jour.
 */
async function refreshDropsFromWorker({ minGapMs = DROPS_WORKER_MIN_GAP_MS } = {}) {
  const prefs = await PreferenceStore.get();
  if (prefs.dropsTracking === false) return { read: false, reason: "disabled" };
  refreshRewardsFromWorker().catch((error) => {
    if (error.code !== "signed-out") console.warn("[StreamPulse] badges :", error.code || error.message);
  });
  const stored = await chrome.storage.local.get("streamPulseDropsProgress");
  if (Date.now() - (Number(stored.streamPulseDropsProgress?.updatedAt) || 0) < minGapMs) return { read: false, reason: "fresh" };
  let inventory;
  try {
    inventory = await dropsClient.readInventory();
  } catch (error) {
    // Déconnecté de Twitch : rien à lire, ce n'est pas une panne.
    if (error.code !== "signed-out") console.warn("[StreamPulse] lecture des Drops impossible :", error.code || error.message, error.detail || "");
    return { read: false, reason: error.code || "error" };
  }
  const autoClaim = prefs.autoClaimDrops !== false;
  const result = await dropsStore.recordInventory(inventory, { autoClaim });
  announceDrops(result.added).catch(() => {});
  for (const instanceId of result.claim) await claimDropFromWorker(instanceId, true);
  return { read: true };
}

const REWARDS_EVERY_MS = 30 * 60_000;

/** Campagnes de badges et récompenses, relues au plus toutes les 30 minutes. */
async function refreshRewardsFromWorker() {
  const stored = await chrome.storage.local.get(["streamPulseDropsRewards", "streamPulseDropsBadges", BADGE_AUTO_KEY]);
  const now = Date.now();
  // Deux délais séparés : une lecture réussie de l'un ne doit jamais bloquer l'autre.
  const warn = (what) => (error) => {
    if (error.code !== "signed-out") console.warn(`[StreamPulse] ${what} :`, error.code || error.message, error.detail || "");
  };
  if (now - (Number(stored.streamPulseDropsRewards?.updatedAt) || 0) >= REWARDS_EVERY_MS) {
    await dropsClient.readRewards().then((list) => dropsStore.recordRewards(list), warn("campagnes de badges"));
  }
  // En mode auto, les badges obtenus se relisent à chaque passage pour fermer l'onglet au plus vite.
  if (stored[BADGE_AUTO_KEY] || now - (Number(stored.streamPulseDropsBadges?.updatedAt) || 0) >= REWARDS_EVERY_MS) {
    await dropsClient.readBadges()
      .then((raw) => dropsStore.recordBadges(raw))
      .then(({ added }) => announceBadges(added), warn("badges globaux"));
  }
  await checkBadgeAuto();
}

// ─── Mode auto des badges ─────────────────────────────────────────────────────
// File de badges regardée par un onglet épinglé et muet, un jeu à la fois :
// voir js/badge-auto-worker.js et js/badge-auto.js.

/**
 * Exécuté dans la page Twitch (monde MAIN) : lecteur en qualité minimale et
 * volume à 1 %. Le lecteur n'a pas d'API publique : on le trouve dans l'arbre
 * React, comme le font les autres extensions. Il réessaie tant qu'il n'est pas prêt.
 */
function lowPowerPlayer() {
  let tries = 0;
  const apply = () => {
    tries += 1;
    const root = document.querySelector(".video-player, [data-a-target='video-player']");
    const fiberKey = root && Object.keys(root).find((key) => key.startsWith("__reactFiber$"));
    let node = fiberKey ? root[fiberKey] : null;
    let player = null;
    for (let depth = 0; node && depth < 60 && !player; depth += 1, node = node.return) {
      const props = node.memoizedProps || {};
      player = props.mediaPlayerInstance?.core || props.mediaPlayerInstance || null;
    }
    const qualities = player?.getQualities?.() || [];
    if (!player || !qualities.length) {
      if (tries < 30) setTimeout(apply, 2000);
      return;
    }
    const lowest = [...qualities].sort((a, b) => (a.bitrate || a.height || 0) - (b.bitrate || b.height || 0))[0];
    player.setAutoSwitchQuality?.(false);
    player.setQuality?.(lowest);
    player.setVolume?.(0.01);
    player.setMuted?.(false);
  };
  apply();
}

/** Jeu du live d'une chaîne : "" hors ligne, null si Helix ne répond pas. */
async function streamGameOf(login) {
  try {
    await ensureConfig();
    const data = await fetchTwitchJson(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}&type=live`, { headers: twitchHeaders() });
    return String(data?.data?.[0]?.game_id || "");
  } catch (error) {
    console.warn("[StreamPulse] mode auto badges :", error?.message || error);
    return null;
  }
}

const badgeAuto = createBadgeAuto({
  streamUrl: dropsStreamUrl,
  streamGameOf,
  lowPowerPlayer,
  translate: async (key, params) => translateWithPrefs(await PreferenceStore.get(), key, params),
  notify: async (titleKey, messageKey, params = {}) => {
    const prefs = await PreferenceStore.get();
    await NotificationCenter.show({ title: translateWithPrefs(prefs, titleKey), message: translateWithPrefs(prefs, messageKey, params) });
  },
  // Les Drops du live doivent être suivis pour que la récupération auto passe.
  onStart: () => scheduleDropsAlarm(),
});

function checkBadgeAuto() {
  return badgeAuto.check();
}

function checkBadgeAfterClaim() {
  badgeAuto.isActive()
    .then((active) => (active ? refreshRewardsFromWorker() : null))
    .catch((error) => console.warn("[StreamPulse] mode auto badges :", error?.code || error?.message || error));
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => badgeAuto.onTabUpdated(tabId, changeInfo));
chrome.tabs.onRemoved.addListener((tabId) => badgeAuto.onTabRemoved(tabId));

/** Alerte pour les nouveaux badges gratuits (3 au plus d'un coup). */
async function announceBadges(badges) {
  const free = badges.filter((badge) => !isPaidBadge(badge)).slice(0, 3);
  if (!free.length) return;
  const prefs = await PreferenceStore.get();
  if (!prefs.dropAlerts) return;
  for (const badge of free) {
    await NotificationCenter.show({
      title: translateWithPrefs(prefs, "background.notifications.badgeTitle", { name: badge.title }),
      message: badge.description || badge.title,
    });
  }
}

async function claimDropFromWorker(instanceId, auto) {
  let status = "";
  let ok = false;
  try {
    ({ status } = await dropsClient.claim(instanceId));
    ok = true;
  } catch (error) {
    console.warn("[StreamPulse] récupération du Drop impossible :", error.code || error.message);
  }
  const result = await dropsStore.recordClaim({ instanceId, ok, status, auto });
  if (result.entry) announceDrops([result.entry]).catch(() => {});
  const claimed = ok && CLAIM_OK_STATUSES.includes(status);
  if (ok && !claimed) console.warn("[StreamPulse] récupération du Drop refusée :", status || "sans statut");
  // Récupéré mais absent de la progression locale : on relit pour remettre la liste à jour.
  if (claimed && !result.entry) refreshDropsFromWorker({ minGapMs: 0 }).catch(() => {});
  // Un Drop récupéré peut être le badge attendu : relecture immédiate en mode auto.
  if (claimed) checkBadgeAfterClaim();
  return claimed;
}

/**
 * Live où gagner une campagne : le stream le plus regardé du jeu (Helix), sinon
 * la catégorie filtrée sur les Drops. Les badges de « Twitch Gaming » se gagnent
 * sur n'importe quelle chaîne du jeu qui a les Drops activés.
 */
async function dropsStreamUrl({ gameId, game }) {
  const directory = `https://www.twitch.tv/directory/game/${encodeURIComponent(game || "")}?filter=drops`;
  if (!/^\d{1,20}$/.test(String(gameId || ""))) return directory;
  try {
    await ensureConfig();
    const data = await fetchTwitchJson(`https://api.twitch.tv/helix/streams?game_id=${gameId}&type=live&first=20`, { headers: twitchHeaders() });
    // Un live avec le tag Drops fait progresser la campagne ; à défaut, le premier live du jeu.
    const live = (data?.data || []).filter((item) => item.user_login);
    const stream = live.find((item) => (item.tags || []).some((tag) => /drops/i.test(String(tag)))) || live[0];
    return stream ? `https://www.twitch.tv/${encodeURIComponent(stream.user_login)}` : directory;
  } catch (error) {
    console.warn("[StreamPulse] recherche d'un live pour la campagne :", error?.message || error);
    return directory;
  }
}

/** Confie une commande au premier onglet Twitch qui a le relais des Drops. */
async function sendDropsCommand(command, preferredId) {
  for (const tab of await twitchTabs(preferredId)) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: "dropsCommand", ...command });
      if (response?.ok) return true;
    } catch (_) {
      // Onglet ouvert avant l'installation : pas de relais, on essaie le suivant.
    }
  }
  return false;
}

// ─── Historique des lives ─────────────────────────────────────────────────────
// Chaque fin de live d'un streamer suivi devient une entree d'historique. Une
// session est « regardee » si le tracker de temps de visionnage a vu la chaine
// ouverte pendant qu'elle etait en direct.
const LAST_WATCHED_KEY = "streamPulseLastWatched";

class HistoryStore {
  static _queue = Promise.resolve();

  /** Serialise les ecritures : plusieurs lives peuvent finir dans le meme sondage. */
  static _enqueue(task) {
    const run = this._queue.then(task, task);
    this._queue = run.catch(() => {});
    return run;
  }

  static async get() {
    const stored = await chrome.storage.local.get(HISTORY_KEY);
    return stored[HISTORY_KEY] || emptyHistory();
  }

  static async save(history) {
    await chrome.storage.local.set({ [HISTORY_KEY]: history });
  }

  static watchKey(platform, channel) {
    return `${normalizePlatform(platform)}:${String(channel || "").toLowerCase()}`;
  }

  static markWatched(platform, channel) {
    if (!platform || !channel) return Promise.resolve();
    return this._enqueue(async () => {
      const stored = await chrome.storage.local.get(LAST_WATCHED_KEY);
      const map = stored[LAST_WATCHED_KEY] || {};
      map[this.watchKey(platform, channel)] = Date.now();
      await chrome.storage.local.set({ [LAST_WATCHED_KEY]: map });
    });
  }

  static markSeen(id) {
    return this._enqueue(async () => this.save(markSeen(await this.get(), id)));
  }

  static removeEntry(id) {
    return this._enqueue(async () => this.save(removeEntry(await this.get(), id)));
  }

  static recordEnded(streamer, liveState) {
    return this._enqueue(async () => {
      const platform = normalizePlatform(streamer.platform);
      const handle = streamer.handle || streamer.twitch || "";
      const endedAt = Date.now();
      const startedAtTime = Date.parse(liveState.startedAt || "") || null;
      const stored = await chrome.storage.local.get(LAST_WATCHED_KEY);
      const lastWatched = (stored[LAST_WATCHED_KEY] || {})[this.watchKey(platform, handle)] || 0;
      const watched = startedAtTime ? lastWatched >= startedAtTime : false;

      const session = {
        streamerId: streamer.id,
        platform,
        handle,
        displayName: streamer.displayName || formatHandleForDisplay(platform, handle),
        avatarUrl: liveState.avatarUrl || streamer.avatarUrl || "",
        title: liveState.title || liveState.lastTitle || "",
        game: liveState.game || liveState.lastGame || "",
        startedAt: liveState.startedAt || null,
        endedAt,
        thumbnailUrl: sizeThumbnail(liveState.thumbnailUrl || ""),
        vodUrl: platform === "twitch"
          ? `https://www.twitch.tv/${encodeURIComponent(handle)}/videos?filter=archives`
          : `https://kick.com/${encodeURIComponent(handle)}/videos`,
        hasVod: false,
        watched,
      };
      const history = addSession(await this.get(), session, endedAt);
      await this.save(history);
      const saved = history.entries.find((entry) => entry.streamerId === streamer.id && entry.endedAt === endedAt);
      return saved || null;
    }).then((saved) => {
      if (saved && saved.platform === "twitch" && !saved.watched) {
        this.attachTwitchVod(saved).catch((error) => console.warn("VOD lookup failed:", error?.message || error));
      }
    });
  }

  /** La rediffusion Twitch n'existe qu'apres coup : on la cherche une fois le live fini. */
  static async attachTwitchVod(entry) {
    const user = await PlatformChecker.getTwitchUser(entry.handle);
    if (!user?.id) return;
    const data = await fetchTwitchJson(
      `https://api.twitch.tv/helix/videos?user_id=${encodeURIComponent(user.id)}&type=archive&first=1`,
      { headers: twitchHeaders() }
    );
    const video = data?.data?.[0];
    if (!video?.url) return;
    const startedAt = Date.parse(entry.startedAt || "");
    const createdAt = Date.parse(video.created_at || "");
    // Une VOD plus ancienne que ce live appartient a une autre session.
    if (Number.isFinite(startedAt) && Number.isFinite(createdAt) && Math.abs(createdAt - startedAt) > 2 * 60 * 60 * 1000) return;
    const thumbnailUrl = sizeThumbnail(video.thumbnail_url || "");
    await this._enqueue(async () =>
      this.save(
        patchSession(await this.get(), entry.id, {
          vodUrl: video.url,
          hasVod: true,
          ...(thumbnailUrl ? { thumbnailUrl } : {}),
        })
      )
    );
  }
}

/**
 * Revérifie la licence StreamPulse+ une fois par jour. Clé refusée (abonnement
 * résilié, remboursement) : la licence est retirée. Erreur réseau : on garde
 * la licence, isPlusActive applique alors le délai de grâce hors ligne.
 */
async function recheckPlusLicense(record) {
  if (!needsRecheck(record)) return;
  const now = Date.now();
  const device = await getDeviceId(chrome.storage.local);
  const result = await verifyLicense(record.licenseKey, fetch, now, device);
  if (result.ok) {
    await chrome.storage.local.set({ [PLUS_KEY]: { ...result.record, checkedAt: now } });
  } else if (["invalid", "format", "device_limit"].includes(result.error)) {
    await chrome.storage.local.remove(PLUS_KEY);
  } else {
    await chrome.storage.local.set({ [PLUS_KEY]: { ...record, checkedAt: now } });
  }
}

/** Les vignettes Twitch portent un gabarit de taille ({width}x{height} ou %{width}x%{height}). */
function sizeThumbnail(url) {
  return String(url || "")
    .replace(/%?\{width\}/g, "440")
    .replace(/%?\{height\}/g, "248");
}

/**
 * Categorie en cours d'une chaine suivie, d'apres le dernier etat live connu.
 * Repli quand la page n'a pas pu lire le jeu elle-meme.
 */
async function currentGameOf(platform, channel) {
  try {
    const [streamers, liveState] = await Promise.all([DataStore.getStreamers(), DataStore.getLiveState()]);
    const handle = String(channel).toLowerCase();
    const streamer = streamers.find(
      (item) => normalizePlatform(item.platform) === platform && String(item.handle || item.twitch || "").toLowerCase() === handle,
    );
    const state = streamer && liveState[streamer.id];
    return state ? String(state.game || state.lastGame || "") : "";
  } catch {
    return "";
  }
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

  static _getDayKey() {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${m}-${d}`;
  }

  /** Ajoute la duree au jour courant et ne garde que les DAILY_RETENTION derniers jours. */
  /** Secondes par categorie (recap avance) : { "Just Chatting": 1200 }. */
  static _addGame(games, game, seconds) {
    const name = String(game || "").trim().slice(0, 80);
    if (!name) return games || {};
    return { ...(games || {}), [name]: ((games || {})[name] || 0) + seconds };
  }

  static async _recordDaily(platform, channel, seconds, avatarUrl, game = "") {
    const DAILY_RETENTION = 400;
    const stored = await chrome.storage.local.get(STORAGE_KEYS.WATCH_TIME_DAILY);
    const daily = stored[STORAGE_KEYS.WATCH_TIME_DAILY] || {};
    const day = this._getDayKey();
    const key = `${platform}:${channel}`;
    const bucket = daily[day] || {};
    const previous = bucket[key] || { watchSeconds: 0, platform, channel, avatarUrl: "" };
    const next = {
      ...daily,
      [day]: {
        ...bucket,
        [key]: {
          ...previous,
          watchSeconds: previous.watchSeconds + seconds,
          avatarUrl: avatarUrl || previous.avatarUrl,
          games: this._addGame(previous.games, game, seconds),
        },
      },
    };
    const days = Object.keys(next).sort();
    for (const old of days.slice(0, Math.max(0, days.length - DAILY_RETENTION))) {
      delete next[old];
    }
    await chrome.storage.local.set({ [STORAGE_KEYS.WATCH_TIME_DAILY]: next });
  }

  // record() et getSummary() font du read-modify-write sur la meme cle :
  // ils passent par une file pour ne jamais s'ecarter (meme pattern que HistoryStore).
  static _queue = Promise.resolve();

  static _enqueue(task) {
    const run = this._queue.then(task, task);
    this._queue = run.catch(() => {});
    return run;
  }

  static record(platform, channel, seconds, avatarUrl = "", game = "") {
    // Skip pure presence pings (no actual data to record)
    if (seconds <= 0) return Promise.resolve();
    return this._enqueue(() => this._record(platform, channel, seconds, avatarUrl, game));
  }

  static async _record(platform, channel, seconds, avatarUrl = "", game = "") {
    const month = this._getMonthKey();
    const data = await this._getData();

    if (!data[month]) data[month] = {};
    const key = `${platform}:${channel}`;
    if (!data[month][key]) {
      data[month][key] = { watchSeconds: 0, platform, channel, avatarUrl: "" };
    }

    data[month][key].watchSeconds += seconds;
    data[month][key].games = this._addGame(data[month][key].games, game, seconds);
    // Update avatar if we got a fresher one
    if (avatarUrl) data[month][key].avatarUrl = avatarUrl;

    // Prune months older than 3 months to save storage
    const months = Object.keys(data).sort();
    while (months.length > 3) {
      delete data[months.shift()];
    }

    await this._saveData(data);
    try {
      await this._recordDaily(platform, channel, seconds, avatarUrl, game);
    } catch (error) {
      // Le suivi mensuel est deja enregistre : un echec ici ne prive que les periodes glissantes du recap.
      console.warn("[WatchTime] daily record failed:", error);
    }
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

    // Persister les avatars resolus ICI ferait un RMW concurrent avec record() :
    // on laisse record() en être responsable (il met deja avatarUrl a jour).

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

/** Les requetes /helix/streams acceptent jusqu'a 100 user_login par appel. */
const TWITCH_STREAMS_BATCH_SIZE = 100;

function twitchStreamToStatus(stream) {
  if (!stream) return { isLive: false };
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
}

/**
 * Sonde tous les logins Twitch suivis en un minimum de requetes Helix
 * (1 appel par tranche de 100, au lieu d'1 appel par streamer) : c'est ce qui
 * evite de saturer le quota 800 req/min du client ID quand la base d'utilisateurs
 * grandit. Renvoie une Map login -> stream Helix (les chaines hors ligne y
 * figurent simplement pas).
 */
async function fetchTwitchStreamsBatch(logins) {
  const streams = new Map();
  for (let i = 0; i < logins.length; i += TWITCH_STREAMS_BATCH_SIZE) {
    const chunk = logins.slice(i, i + TWITCH_STREAMS_BATCH_SIZE);
    const query = chunk
      .map((login) => `user_login=${encodeURIComponent(login)}`)
      .join("&");
    const data = await fetchTwitchJson(
      `https://api.twitch.tv/helix/streams?${query}`,
      { headers: twitchHeaders() }
    );
    for (const stream of data?.data || []) {
      const login = String(stream.user_login || "").toLowerCase();
      if (login) streams.set(login, stream);
    }
  }
  return streams;
}

function twitchHeaders() {
  const headers = {
    "Client-ID": CONFIG.clientId,
    Accept: "application/json",
  };
  if (CONFIG.accessToken) {
    headers.Authorization = `Bearer ${CONFIG.accessToken}`;
  }
  return headers;
}

class PlatformChecker {
  static async getTwitchUser(login) {
    const sanitized = sanitizeLogin(login);
    if (!sanitized) return null;
    await ensureConfig();
    try {
      const data = await fetchTwitchJson(
        `https://api.twitch.tv/helix/users?login=${sanitized}`,
        { headers: twitchHeaders() }
      );
      return data.data?.[0] || null;
    } catch (error) {
      console.warn("Twitch user fetch error:", error.message);
      return { _apiError: true, status: error.message, isError: true };
    }
  }

  static async getTwitchStatus(login) {
    const sanitized = sanitizeLogin(login);
    if (!sanitized) return { isLive: false };
    await ensureConfig();
    try {
      const data = await fetchTwitchJson(
        `https://api.twitch.tv/helix/streams?user_login=${sanitized}`,
        { headers: twitchHeaders() }
      );
      return twitchStreamToStatus(data.data?.[0]);
    } catch (error) {
      console.warn("Twitch status error:", error.message);
      return { isLive: false, error: error.message, isError: true };
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
      return { _apiError: true, status: error.message, isError: true };
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

    // Optimize: Cache for 60 seconds to prevent flickering on every popup open
    const cb = Math.floor(Date.now() / 60000); // 1-minute cache bucket

    // Uniquement les URLs fournies par l'API. Kick renvoie `thumbnail: null`
    // quand il n'a pas d'image ; les URLs construites qui étaient sondées en
    // secours (images.kick.com/v2/stream-thumbnails/..., files.kick.com/
    // stream-thumbnails/...) répondent 403 en réel : elles ne donnaient jamais
    // d'image et rajoutaient des probes mortes qui retardaient le chargement.
    const apiRaw = [
      stream?.thumbnail?.url,
      stream?.thumbnail?.src,
      stream?.thumbnail_url,
      stream?.thumbnail,
    ];

    const distinctUrls = new Set();
    const allCandidates = [];
    for (const raw of apiRaw) {
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
    if (channel?._apiError) {
      return { isLive: false, platform: "kick", error: channel.status, isError: true };
    }
    if (channel?._source === "official") {
      return this.extractKickStatusOfficial(channel, handle);
    }
    return this.extractKickStatus(channel, handle);
  }

  /* ─── YouTube v1 : alertes de live, sans clé API ────────────────────────
     Détection : la page youtube.com/@handle/live (ou /channel/ID/live) a une
     URL canonique qui pointe vers watch?v=… quand la chaîne diffuse, vers la
     chaîne sinon. Le titre et la vignette viennent ensuite de oEmbed (public,
     sans clé). Non officiel : si YouTube change ce comportement, la
     plateforme retombe proprement en « hors ligne » sans casser le reste. */

  static _youtubeCache = new Map(); // handle → { id, avatar, name }
  static _youtubeCacheLoaded = false;

  static async loadYoutubeCache() {
    if (this._youtubeCacheLoaded) return;
    this._youtubeCacheLoaded = true;
    try {
      const stored = (await chrome.storage.local.get("streampulse:youtubeChannels"))[
        "streampulse:youtubeChannels"
      ];
      Object.entries(stored || {}).forEach(([handle, entry]) => {
        if (entry?.id) this._youtubeCache.set(handle, entry);
      });
    } catch { /* cache perdu : on re-résoudra */ }
  }

  static async saveYoutubeCache() {
    try {
      await chrome.storage.local.set({
        "streampulse:youtubeChannels": Object.fromEntries(this._youtubeCache),
      });
    } catch { /* best effort */ }
  }

  static async resolveYoutubeChannel(handle) {
    const sanitized = sanitizeHandle("youtube", handle);
    if (!sanitized) return null;
    await this.loadYoutubeCache();
    const cached = this._youtubeCache.get(sanitized);
    if (cached?.id) return cached;
    if (isYoutubeChannelId(sanitized)) {
      const entry = { id: sanitized, avatar: "", name: sanitized };
      this._youtubeCache.set(sanitized, entry);
      this.saveYoutubeCache();
      return entry;
    }
    // Handle → ID : la page de la chaîne embarque "channelId"/"externalId".
    try {
      const resp = await fetch(
        `https://www.youtube.com/@${encodeURIComponent(sanitized)}`,
        { redirect: "follow" }
      );
      if (!resp.ok) return null;
      const html = await resp.text();
      const id =
        /"?(?:channelId|externalId)"?\s*:\s*"(UC[A-Za-z0-9_-]{10,32})"/.exec(html)?.[1] || "";
      const name =
        /<meta property="og:title" content="([^"]+)"/.exec(html)?.[1] || sanitized;
      const avatar =
        /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1] || "";
      if (!id) return null;
      const entry = { id, avatar, name };
      this._youtubeCache.set(sanitized, entry);
      this.saveYoutubeCache();
      return entry;
    } catch {
      return null;
    }
  }

  static async getYoutubeStatus(handle) {
    const sanitized = sanitizeHandle("youtube", handle);
    const base = {
      platform: "youtube",
      url: buildProfileUrl("youtube", sanitized),
    };
    const channel = await this.resolveYoutubeChannel(sanitized);
    if (!channel?.id) return { isLive: false, ...base };

    let videoId;
    let viewers = 0;
    try {
      /* Ancienne astuce embed/live_stream morte : YouTube sert désormais un
         shell JS sans l'ID. Le signal fiable gratuit est la page /live : sa
         URL canonique pointe vers watch?v=… si la chaîne diffuse, vers la
         chaîne sinon (404 si le handle n'existe pas). La même page porte le
         compteur de viewers simultanés ("viewCount" du videoDetails). */
      const liveUrl = isYoutubeChannelId(sanitized)
        ? `https://www.youtube.com/channel/${encodeURIComponent(channel.id)}/live`
        : `https://www.youtube.com/@${encodeURIComponent(sanitized)}/live`;
      const res = await fetch(liveUrl, { redirect: "follow" });
      if (res.ok) {
        const html = await res.text();
        videoId =
          /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,20})"/.exec(
            html
          )?.[1] || "";
        if (videoId) {
          // Sur un live, viewCount du lecteur = viewers simultanés.
          viewers = Number(/"viewCount":"(\d+)"/.exec(html)?.[1]) || 0;
        }
      }
    } catch (error) {
      return { isLive: false, platform: "youtube", error: error?.message, isError: true };
    }
    if (!videoId) return { isLive: false, ...base };

    // En direct : oEmbed donne titre et nom affiché, sans clé. La vignette
    // est celle du lecteur live (i.ytimg.com) : YouTube la rafraîchit côté
    // serveur pendant le stream, le cache-buster par minute la rend quasi
    // live dans la popup.
    let title = "";
    let displayName = channel.name && channel.name !== sanitized ? channel.name : "";
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(
          `https://www.youtube.com/watch?v=${videoId}`
        )}&format=json`
      );
      if (res.ok) {
        const data = await res.json();
        title = data.title || "";
        displayName = data.author_name || displayName;
      }
    } catch { /* titre optionnel */ }

    const cb = Math.floor(Date.now() / 60000); // 1-minute cache bucket
    const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    return {
      isLive: true,
      ...base,
      displayName: displayName || sanitized,
      avatarUrl: channel.avatar || "",
      title,
      game: "",
      viewers,
      startedAt: null,
      // L'ID de vidéo fait office de session : un nouveau live = un nouvel id,
      // la logique sessionChanged des notifications fonctionne telle quelle.
      sessionId: videoId,
      thumbnailUrl,
      thumbnailCandidates: [`${thumbnailUrl}?cb=${cb}`],
      supportsLiveStatus: true,
    };
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
    if (platform === "youtube") {
      const status = await this.getYoutubeStatus(streamer.handle || streamer.id);
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

  /**
   * Create a notification, retrying with the bundled icon if the remote one
   * cannot be fetched.
   *
   * Chrome rejects the WHOLE notification with "Unable to download all
   * specified images" when `iconUrl` points at a remote avatar it can't load
   * (CDN hiccup, offline, or a content blocker intercepting the request). The
   * notification is the actual feature here and the avatar is decorative, so a
   * failed image must never cost the user the alert.
   */
  static async createWithIconFallback(id, notificationOptions) {
    const create = (options) =>
      new Promise((resolve, reject) => {
        try {
          chrome.notifications.create(id, options, () => {
            const err = chrome.runtime.lastError;
            if (err) reject(new Error(err.message));
            else resolve(true);
          });
        } catch (e) {
          reject(e);
        }
      });

    try {
      return await create(notificationOptions);
    } catch (_e) {
      const fallback = this.getDefaultIcon();
      if (notificationOptions.iconUrl === fallback) return false;
      try {
        return await create({ ...notificationOptions, iconUrl: fallback });
      } catch (_e2) {
        // Never let a cosmetic image failure reject into an unhandled promise.
        return false;
      }
    }
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
    await this.createWithIconFallback(id, {
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
  // Avatar du streamer si connu, icone de plateforme sinon — logique partagée
  // par les trois notifications (avant : copie-collé trois fois).
  static resolveNotificationIcon(streamer, platformKey) {
    const streamerStatus = streamerStates.get(streamer.id);
    const fallbackIcon =
      (chrome?.runtime && getPlatformIcon(platformKey)
        ? chrome.runtime.getURL(getPlatformIcon(platformKey))
        : null) || NotificationCenter.getDefaultIcon();
    return NotificationCenter.resolveIcon(
      streamerStatus?.avatarUrl || streamer.avatarUrl || fallbackIcon
    );
  }

  static async notifyLive(streamer, status, preferences = DEFAULT_PREFERENCES) {
    // Le verrou par streamer est dejà verifie par l'appelant : ici on ne
    // re-verifie pas la preference globale (modele « par streamer d'abord »).
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

    await NotificationCenter.show({
      title,
      message,
      streamerId: streamer.id,
      platform: status.platform,
      url: status.url || targetUrl,
      iconUrl: this.resolveNotificationIcon(streamer, platform),
      requireInteraction: true,
      priority: 2,
      playSound: preferences?.soundsEnabled !== false,
    });
  }

  // Changement de catégorie ou de titre : mêmes garde-fous, même structure,
  // seuls les textes et les paramètres de traduction varient.
  static async notifyChangeEvent(
    streamer,
    preferences,
    { alertKey: _alertKey, titleKey, messageKey, messageParams, platform }
  ) {
    const lang = normalizeLanguage(preferences?.language);
    const platformKey = platform || streamer.platform || "twitch";
    if (!platformSupportsLiveStatus(platformKey)) {
      return;
    }
    const name =
      streamer.displayName ||
      formatHandleForDisplay(platformKey, streamer.handle || streamer.twitch);

    await NotificationCenter.show({
      title: translate(lang, titleKey, { name }),
      message: translate(lang, messageKey, messageParams(lang)),
      streamerId: streamer.id,
      platform: platformKey,
      url: buildProfileUrl(
        platformKey,
        streamer.handle || streamer.twitch || streamer.id
      ),
      iconUrl: this.resolveNotificationIcon(streamer, platformKey),
      requireInteraction: false,
      priority: 1,
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
    await this.notifyChangeEvent(streamer, preferences, {
      alertKey: "gameNotifications",
      titleKey: "background.notifications.categoryChangeTitle",
      messageKey: "background.notifications.categoryChangeMessage",
      messageParams: (lang) => ({
        from:
          fromGame ||
          translate(lang, "background.notifications.unknownCategory"),
        to: toGame || translate(lang, "background.notifications.newCategory"),
      }),
      platform,
    });
  }

  static async notifyTitleChange(
    streamer,
    fromTitle,
    toTitle,
    preferences = DEFAULT_PREFERENCES,
    platform = null
  ) {
    await this.notifyChangeEvent(streamer, preferences, {
      alertKey: "titleNotifications",
      titleKey: "background.notifications.titleChangeTitle",
      // Le corps ne montre que le nouveau titre : un flux Twitch en fait souvent
      // plusieurs par session et le « avant apres » deborde de la notification.
      messageKey: "background.notifications.titleChangeMessage",
      messageParams: (lang) => ({
        to:
          toTitle ||
          translate(lang, "background.notifications.unknownTitle"),
      }),
      platform,
    });
  }

  // Chaque clic sur « Tester une notification » fait tourner un compteur :
  // 1er clic = live, 2e = changement de categorie, 3e = changement de titre.
  // Permet de verifier le pipeline complet des trois alertes sans attendre
  // qu'un streamer change reellement de jeu ou de titre.
  static _testStep = 0;

  static async sendTest(preferences = DEFAULT_PREFERENCES) {
    const lang = normalizeLanguage(preferences?.language);
    const step = this._testStep % 3;
    this._testStep += 1;

    if (step === 0) {
      await NotificationCenter.show({
        title: translate(lang, "common.appName"),
        message: translate(lang, "background.notifications.testSimpleMessage"),
        requireInteraction: true,
        priority: 2,
        playSound: preferences?.soundsEnabled !== false,
      });
      return;
    }

    // Bypass volontaire des preferences : l'objectif du bouton est de montrer
    // a quoi ressemble chaque type d'alerte, meme si elle est desactivee.
    const forcedPrefs = {
      ...preferences,
      liveNotifications: true,
      gameNotifications: true,
      titleNotifications: true,
    };
    const fakeStreamer = {
      id: "test",
      platform: "twitch",
      handle: "test",
      displayName: translate(lang, "common.appName"),
      notificationsEnabled: true,
      gameNotificationsEnabled: true,
      titleNotificationsEnabled: true,
    };
    if (step === 1) {
      await this.notifyGameChange(
        fakeStreamer,
        translate(lang, "background.notifications.unknownCategory"),
        translate(lang, "background.notifications.newCategory"),
        forcedPrefs
      );
    } else {
      await this.notifyTitleChange(
        fakeStreamer,
        "",
        translate(lang, "background.notifications.testTitleMessage"),
        forcedPrefs
      );
    }
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

// ─── Bêta : détection des raids entrants en arrière-plan ────────────────────
//
// Le watcher IRC est opt-in (backgroundRaidAlerts) : une fois activé, il
// maintient une connexion anonyme vers les chaînes Twitch favorites. Voir
// js/raidWatcher.js pour le détail du protocole et les limites de coût.

async function refreshRaidWatcher() {
  try {
    const preferences = await PreferenceStore.get();
    if (preferences.backgroundRaidAlerts !== true) {
      stopEventSubRaid();
      stopRaidWatcher();
      return;
    }
    // EventSub d'abord : l'evenement channel.raid part au DEBUT du compte a
    // rebours (~90 s avant l'arrivee), la ou l'IRC n'entend le raid qu'a son
    // atterrissage. L'IRC reste le repli si l'Helix token n'est pas disponible.
    await ensureConfig();
    if (CONFIG.accessToken && CONFIG.clientId) {
      const active = await syncEventSubRaid(notifyIncomingRaid, twitchHeaders);
      if (active) {
        // Les deux en meme temps notifieraient chaque raid deux fois.
        stopRaidWatcher();
        return;
      }
    }
    await syncRaidWatcher(notifyIncomingRaid);
  } catch (error) {
    console.warn("Raid watcher sync failed:", error.message);
  }
}

async function notifyIncomingRaid({ channel, raider, viewers }) {
  const preferences = await PreferenceStore.get();
  const lang = normalizeLanguage(preferences?.language);

  const displayName = await resolveChannelDisplayName(channel);
  const viewersText = formatNumberForLanguage(lang, viewers || 0);

  let iconUrl = null;
  try {
    iconUrl = await resolveChannelAvatar("twitch", channel);
  } catch (_) {
    // L'avatar est décoratif : la notification part sans icône dédiée.
  }

  await NotificationCenter.show({
    title: translate(lang, "background.notifications.raidIncomingTitle", {
      name: displayName,
    }),
    message: translate(lang, "background.notifications.raidIncomingMessage", {
      raider: raider || translate(lang, "common.unknown"),
      viewers: viewersText,
    }),
    platform: "twitch",
    // Les points de raid se gagnent en arrivant DEPUIS le stream du raid
    // partant : on ouvre chez {{raider}}, pas sur la chaîne raidée.
    url: buildProfileUrl("twitch", raider),
    iconUrl,
    requireInteraction: false,
    priority: 1,
    playSound: preferences?.soundsEnabled !== false,
  });
}

// Le handle IRC est en minuscules ; on récupère le nom d'affichage connu des
// données de l'extension avant de retomber sur le handle brut.
async function resolveChannelDisplayName(channel) {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.STREAMERS);
    const streamers = Array.isArray(stored[STORAGE_KEYS.STREAMERS])
      ? stored[STORAGE_KEYS.STREAMERS]
      : [];
    const match = streamers.find(
      (s) =>
        (s.platform || "twitch") === "twitch" &&
        getHandleComparisonKey("twitch", s.handle || s.twitch || s.id || "") ===
          getHandleComparisonKey("twitch", channel)
    );
    if (match?.displayName || match?.name) {
      return match.displayName || match.name;
    }
  } catch (_) {
    // Lecture de storage échouée : on retombe sur le handle.
  }
  return formatHandleForDisplay("twitch", channel);
}

/** Cle du dernier nombre de streamers en direct, relu apres un redemarrage. */
const BADGE_LIVE_COUNT_KEY = "streampulse:badgeLiveCount";
/** Violet Twitch, comme la pastille inline des notes dans la popup. */
const BADGE_COLOR_UPDATE = "#9146ff";

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
    // Le compteur survit aux redemarrages du service worker : sans lui, le
    // rendu declenche par une autre source (notes de version, demarrage)
    // n'aurait aucun moyen de savoir combien de streamers sont en direct et
    // effacerait le badge.
    try {
      await chrome.storage.local.set({ [BADGE_LIVE_COUNT_KEY]: liveCount });
    } catch { /* le rendu retombera sur 0 */ }
    await this.render(preferences);
  }

  /**
   * Unique ecrivain du badge. Deux sources veulent l'ecrire : le nombre de
   * streamers en direct et la pastille « notes de version non lues ». Elles
   * s'ecrasaient mutuellement, et syncUpdateBadge() tournant a chaque
   * demarrage du service worker, le compteur disparaissait a des moments
   * arbitraires. Le direct l'emporte, puisque c'est la question a laquelle le
   * badge repond ; la pastille des notes n'apparait que quand personne n'est
   * en direct.
   */
  static async render(preferences = null) {
    const prefs = preferences || (await PreferenceStore.get());
    let stored = {};
    try {
      stored = await chrome.storage.local.get([BADGE_LIVE_COUNT_KEY, "patchNotesUnread"]);
    } catch { /* valeurs par defaut ci-dessous */ }
    const liveCount = Number(stored[BADGE_LIVE_COUNT_KEY]) || 0;
    if (liveCount > 0) {
      await this.setLive(liveCount, prefs);
      return;
    }
    if (stored.patchNotesUnread) {
      try {
        await chrome.action.setBadgeText({ text: "1" });
        await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_UPDATE });
        await chrome.action.setTitle({
          title: translateWithPrefs(prefs, "background.badge.idle"),
        });
      } catch (error) {
        console.warn("Badge update marker failed:", error.message);
      }
      return;
    }
    await this.clear(prefs);
  }
}

/**
 * Dernier titre et derniere categorie vus en direct pour ce streamer.
 * Se lit avant que le sondage en cours n'ecrase l'etat, donc renvoie bien
 * l'avant-dernier passage en direct et non celui d'aujourd'hui.
 */
function lastSeenOf(streamerId) {
  const previous = streamerLiveState.get(streamerId);
  if (!previous) return {};
  const lastTitle = previous.title || previous.lastTitle || "";
  const lastGame = previous.game || previous.lastGame || "";
  return {
    ...(lastTitle ? { lastTitle } : {}),
    ...(lastGame ? { lastGame } : {}),
  };
}

/**
 * Construit le statut d'un streamer. `twitchBatch` est le résultat de la
 * sonde groupée (voir pollStreamers) : { streams: Map|null, error } — quand
 * il est fourni, aucune requête Helix individuelle n'est émise pour ce
 * streamer. Un échec du batch marque tous les streamers Twitch en erreur
 * (la boucle de sondage préserve alors leur état live précédent).
 */
async function buildStreamerStatus(streamer, twitchBatch = null) {
  const platform = streamer.platform || "twitch";
  let status;
  if (twitchBatch && platform === "twitch") {
    const login = sanitizeLogin(streamer.twitch || streamer.handle);
    if (!login) {
      status = { isLive: false };
    } else if (twitchBatch.error) {
      status = { isLive: false, error: twitchBatch.error, isError: true };
    } else {
      status = twitchStreamToStatus(twitchBatch.streams.get(login));
    }
  } else {
    status = await PlatformChecker.getStatus(streamer);
  }
  const activeStatus = status.isLive
    ? { ...status, platform, supportsLiveStatus: status.supportsLiveStatus }
    : {
        isLive: false,
        platform,
        supportsLiveStatus: status.supportsLiveStatus,
        url: status.url || buildProfileUrl(platform, streamer.handle),
        avatarUrl: status.avatarUrl || "",
        error: status.error,
        isError: status.isError,
        // L'API Twitch ne renvoie rien pour une chaine hors ligne : ni titre,
        // ni categorie. On ressert donc ce qui a ete vu au dernier passage en
        // direct, conserve dans l'etat live, lui-meme restaure du stockage
        // juste au-dessus de la boucle de sondage.
        ...lastSeenOf(streamer.id),
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

// Rattrapage : un stream détecté en direct alors qu'il a démarré depuis plus
// de 10 minutes n'est pas un événement « vient de partir » (navigateur fermé,
// SW endormi, extension rechargée). Ces streamers ne déclenchent pas 1
// notification chacun : ils alimentent une seule notification groupée.
const CATCHUP_THRESHOLD_MS = 10 * 60 * 1000;

async function _pollStreamersImpl({ forceNotification = false } = {}) {
  await ensureConfig(); // hydrate credentials before any Twitch API call (MV3 SW restart safety)
  const streamers = await DataStore.getStreamers();
  const preferences = await PreferenceStore.get();
  if (streamers.length === 0) {
    // Don't wipe statuses/live-state here. A transient empty read from
    // chrome.storage (or a single-poll race) shouldn't destroy the dedup state
    // for genuinely-followed streamers: it would cause every previously-live
    // streamer to re-fire its "now live" notification on the next poll.
    await ActionBadge.update(0, preferences);
    return [];
  }

  // ALWAYS restore from the dedicated LIVE_STATE storage key (not just when
  // size === 0). MV3 service workers can be terminated between any two polls,
  // and this Map is module-level (lost on every restart). Without restoring
  // from storage, every poll on a fresh SW would see `wasLive = false` and
  // re-fire the "live" notification: i.e. one notification per poll interval.
  // Using a dedicated key (vs. piggybacking on STATUSES) means notification
  // dedup survives even if the statuses object is transiently wiped.
  try {
    const savedLiveState = await DataStore.getLiveState();
    Object.entries(savedLiveState || {}).forEach(([id, entry]) => {
      if (!streamerLiveState.has(id) && entry && typeof entry === "object") {
        streamerLiveState.set(id, {
          isLive: Boolean(entry.isLive),
          platform: entry.platform || null,
          game: entry.game || "",
          sessionId: entry.sessionId || null,
          title: entry.title || "",
          lastTitle: entry.lastTitle || "",
          lastGame: entry.lastGame || "",
          avatarUrl: entry.avatarUrl || "",
          startedAt: entry.startedAt || null,
          thumbnailUrl: entry.thumbnailUrl || "",
          matchedRuleIds: Array.isArray(entry.matchedRuleIds) ? entry.matchedRuleIds : [],
          supportsLiveStatus: entry.supportsLiveStatus !== false,
          updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : undefined,
        });
      }
    });
  } catch (err) {
    console.warn("Failed to restore live state:", err?.message || err);
  }

  // Alertes intelligentes : actives seulement avec StreamPulse+.
  const plusStored = await chrome.storage.local.get([PLUS_KEY, SMART_ALERTS_KEY]);
  await recheckPlusLicense(plusStored[PLUS_KEY]);
  const plusActive = isPlusActive((await chrome.storage.local.get(PLUS_KEY))[PLUS_KEY]);
  const smartRules = plusActive ? normalizeRules(plusStored[SMART_ALERTS_KEY]) : {};

  const streamerById = new Map();
  streamers.forEach((streamer) => {
    streamerCache.set(streamer.id, streamer);
    streamerById.set(streamer.id, streamer);
  });

  // Sonde groupée Twitch : 1 requête Helix par tranche de 100 streamers au
  // lieu d'1 requête par streamer. Un échec du batch est propagé tel quel
  // (chaque streamer Twitch repart en isError, l'état live précédent est
  // conservé par la boucle ci-dessous).
  const twitchBatch = { streams: new Map(), error: "" };
  const twitchLogins = streamers
    .filter((streamer) => normalizePlatform(streamer.platform || "twitch") === "twitch")
    .map((streamer) => sanitizeLogin(streamer.twitch || streamer.handle))
    .filter(Boolean);
  if (twitchLogins.length > 0) {
    try {
      twitchBatch.streams = await fetchTwitchStreamsBatch(twitchLogins);
    } catch (error) {
      twitchBatch.error = error?.message || "batch_failed";
      console.warn("Twitch batched status error:", twitchBatch.error);
    }
  }

  // Kick reste sondé par chaine (pas d'API batch) : on borne la concurrence.
  const statuses = [];
  const CONCURRENCY = 3;
  for (let i = 0; i < streamers.length; i += CONCURRENCY) {
    const batch = streamers.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((streamer) => buildStreamerStatus(streamer, twitchBatch)));
    statuses.push(...results);
  }

  // Streamers déjà en direct au premier sondage (rattrapage) : une seule
  // notification groupée sera envoyée après la boucle, pas 1 par streamer.
  const catchUpLive = [];

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
      // Persistes pour survivre aux sondages hors ligne successifs : `title`
      // et `game` repassent a vide des que la chaine n'est plus en direct.
      lastTitle: status.active?.title || status.active?.lastTitle || "",
      lastGame: status.active?.game || status.active?.lastGame || "",
      avatarUrl: status.avatarUrl || streamer.avatarUrl || null,
      startedAt: status.active?.isLive ? status.active?.startedAt || previousLiveState.startedAt || null : null,
      thumbnailUrl: status.active?.isLive ? status.active?.thumbnailUrl || previousLiveState.thumbnailUrl || "" : "",
      matchedRuleIds: [],
      supportsLiveStatus: status.active?.supportsLiveStatus !== false,
      // Horodaté pour la détection de rattrapage : si notre dernière
      // observation remonte à trop longtemps, un live détecté n'est pas
      // un événement « vient de partir » (navigateur fermé, SW endormi).
      updatedAt: Date.now(),
      isError: Boolean(status.active?.isError),
    };

    // If there was an API error, preserve the previous live state to prevent offline/online flapping
    if (nextLiveState.isError) {
      nextLiveState.isLive = previousLiveState.isLive;
      nextLiveState.sessionId = previousLiveState.sessionId;
      nextLiveState.game = previousLiveState.game;
      nextLiveState.title = previousLiveState.title;
      nextLiveState.startedAt = previousLiveState.startedAt || null;
      nextLiveState.thumbnailUrl = previousLiveState.thumbnailUrl || "";
      nextLiveState.matchedRuleIds = previousLiveState.matchedRuleIds || [];
    }

    // Fin de live : entree d'historique (la VOD Twitch est cherchee ensuite).
    if (previousLiveState.isLive && !nextLiveState.isLive && !nextLiveState.isError) {
      HistoryStore.recordEnded(streamer, previousLiveState).catch((error) =>
        console.warn("History record failed:", error?.message || error)
      );
    }

    // Mode « par streamer d'abord » : le toggle du streamer est la seule
    // source de vérite (les toggles globaux des reglages sont des actions en
    // masse, plus des verrous — sinon deux interrupteurs doivent etre actifs
    // pour qu'une alerte parte, et personne ne comprend pourquoi elle ne part pas).
    const notificationsEnabled = streamer.notificationsEnabled !== false;

    // Regles d'alerte du streamer : elles remplacent l'alerte classique.
    const smartDecision = nextLiveState.isError
      ? null
      : decideSmartAlert(
          smartRules[streamer.id],
          status.active,
          previousLiveState.isLive ? previousLiveState.matchedRuleIds || [] : []
        );
    if (smartDecision) nextLiveState.matchedRuleIds = smartDecision.matchedIds;

    if (smartDecision) {
      if (notificationsEnabled && smartDecision.notifyRule) {
        await NotificationSystem.notifyLive(streamer, status.active, preferences);
      }
    } else if (forceNotification && notificationsEnabled && nextLiveState.isLive) {
      await NotificationSystem.notifyLive(streamer, status.active, preferences);
    } else if (notificationsEnabled && nextLiveState.isLive) {
      const wasLive = previousLiveState.isLive;
      const sessionChanged =
        previousLiveState.sessionId &&
        nextLiveState.sessionId &&
        previousLiveState.sessionId !== nextLiveState.sessionId;

      if (!wasLive || sessionChanged) {
        // Rattrapage : pas d'alerte individuelle mensongère (« X est en
        // direct ! » pour un stream de 3 h) ni de rafale au démarrage.
        // Deux signaux, l'un couvre l'autre : l'âge de notre dernière
        // observation persistée (fonctionne pour toutes les plateformes,
        // YouTube n'expose pas de startedAt), et le startedAt de l'API
        // quand il existe.
        const stateAge =
          typeof previousLiveState.updatedAt === "number"
            ? Date.now() - previousLiveState.updatedAt
            : Number.POSITIVE_INFINITY;
        const startedAtMs = nextLiveState.startedAt ? Date.parse(nextLiveState.startedAt) : NaN;
        const isCatchUp =
          stateAge > CATCHUP_THRESHOLD_MS ||
          (Number.isFinite(startedAtMs) && Date.now() - startedAtMs > CATCHUP_THRESHOLD_MS);
        if (isCatchUp) {
          const platform = status.platform || streamer.platform || "twitch";
          catchUpLive.push(
            streamer.displayName ||
              formatHandleForDisplay(platform, streamer.handle || streamer.twitch)
          );
        } else {
          await NotificationSystem.notifyLive(
            streamer,
            status.active,
            preferences
          );
        }
      } else {
        const gameNotificationsEnabled = streamer.gameNotificationsEnabled !== false;
        // Journal de diagnostic : un changement de jeu/titre sans alerte est
        // invisible pour l'utilisateur. Le SW console (chrome://extensions →
        // inspect) dit alors exactement quel garde a bloque l'envoi.
        if (previousLiveState.isLive && nextLiveState.isLive && previousLiveState.game !== nextLiveState.game) {
          console.info("[SP] changement de categorie detecte:", streamer.handle, {
            prefGame: preferences.gameNotifications,
            prefLive: preferences.liveNotifications,
            streamerToggle: streamer.gameNotificationsEnabled,
          });
        }
        if (previousLiveState.isLive && nextLiveState.isLive && previousLiveState.title !== nextLiveState.title) {
          console.info("[SP] changement de titre detecte:", streamer.handle, {
            prefTitle: preferences.titleNotifications,
            prefLive: preferences.liveNotifications,
            streamerToggle: streamer.titleNotificationsEnabled,
            sessionIdentique:
              !previousLiveState.sessionId || !nextLiveState.sessionId ||
              previousLiveState.sessionId === nextLiveState.sessionId,
          });
        }
        const shouldNotifyGame =
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

        const titleNotificationsEnabled = streamer.titleNotificationsEnabled !== false;
        const shouldNotifyTitle =
          titleNotificationsEnabled &&
          preferences.liveNotifications !== false &&
          previousLiveState.isLive &&
          previousLiveState.title &&
          nextLiveState.title &&
          previousLiveState.title !== nextLiveState.title &&
          (!previousLiveState.sessionId ||
            !nextLiveState.sessionId ||
            previousLiveState.sessionId === nextLiveState.sessionId);

        if (shouldNotifyTitle) {
          await NotificationSystem.notifyTitleChange(
            streamer,
            previousLiveState.title,
            nextLiveState.title,
            preferences,
            nextLiveState.platform
          );
        }
      }
    }

    streamerStates.set(status.id, status);
    streamerLiveState.set(streamer.id, nextLiveState);
  }

  // Rattrapage au démarrage : une seule notification récapitulative, quel que
  // soit le nombre de streamers trouvés déjà en direct.
  if (catchUpLive.length > 0) {
    const lang = normalizeLanguage(preferences?.language);
    const shown = catchUpLive.slice(0, 3).join(", ");
    const rest = catchUpLive.length - 3;
    const names = rest > 0 ? `${shown} +${rest}` : shown;
    await NotificationCenter.show({
      title: translate(lang, "background.notifications.startupBatchTitle"),
      message: translate(lang, "background.notifications.startupBatchBody", { names }),
      iconUrl: NotificationCenter.getDefaultIcon(),
      requireInteraction: false,
      priority: 1,
      playSound: preferences?.soundsEnabled !== false,
    });
  }

  const statusesObject = {};
  statuses.forEach((status) => {
    statusesObject[status.id] = status;
  });
  await DataStore.saveStatuses(statusesObject);

  // Persist live-state separately so notification dedup survives SW restarts.
  // Storing as a plain object (Map serialization) keyed by streamer.id.
  try {
    const liveStateObject = {};
    streamerLiveState.forEach((value, key) => {
      liveStateObject[key] = value;
    });
    await DataStore.saveLiveState(liveStateObject);
  } catch (err) {
    console.warn("Failed to persist live state:", err?.message || err);
  }

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

    // Pick the best thumbnail URL (no fetch: CORS blocks HEAD from SW)
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

// Idempotent: only create the alarm if it doesn't already exist. Otherwise
// every SW restart would call chrome.alarms.create() with the same name,
// CANCELLING the existing periodic alarm and replacing it with a fresh one
// using delayInMinutes: 0.1 (clamped to 1 min in production). This means the
// alarm phase keeps shifting forward by 1 min on every wake-up: the period
// is no longer the configured 10 min, polls bunch up, and notifications can
// re-fire on every wake if state restoration lags.
function scheduleWatcherAlarm() {
  chrome.alarms.get(WATCHER_ALARM, (existing) => {
    if (existing) return;
    chrome.alarms.create(WATCHER_ALARM, {
      periodInMinutes: DEFAULT_POLL_INTERVAL,
      delayInMinutes: 0.1,
    });
  });
}

function scheduleKeepAliveAlarm() {
  chrome.alarms.get(KEEP_ALIVE_ALARM, (existing) => {
    if (existing) return;
    chrome.alarms.create(KEEP_ALIVE_ALARM, {
      periodInMinutes: Math.max(DEFAULT_POLL_INTERVAL / 2, 0.5),
      delayInMinutes: 0.1,
    });
  });
}

// Keep-alive heartbeat removed: the KEEP_ALIVE_ALARM is sufficient in MV3.
// setInterval doesn't persist across SW termination anyway.

let initDone = false;

// Badge "nouveau" sur l'icone de l'extension : visible avant meme d'ouvrir la
// popup, pose a chaque mise a jour, retire quand les notes de version sont
// ouvertes. Violet Twitch, comme la pastille inline des notes dans la popup.
async function syncUpdateBadge() {
  await ActionBadge.render();
}

async function openOnboarding(mode = "") {
  const query = mode ? `?mode=${encodeURIComponent(mode)}` : "";
  const url = chrome.runtime.getURL(`html/onboarding.html${query}`);
  try {
    await chrome.tabs.create({ url });
  } catch (error) {
    console.warn("Failed to open onboarding:", error.message);
  }
}

async function openPatchNotes() {
  const url = chrome.runtime.getURL("html/changelog.html");
  try {
    await chrome.tabs.create({ url });
  } catch (error) {
    console.warn("Failed to open patch notes:", error.message);
  }
}

// Le defaut de la frequence d'ouverture de l'inventaire est passe de 4h a 24h.
// sanitize() ecrit toujours l'objet complet : les installations existantes ont
// donc deja 4h en storage et ne verraient jamais le nouveau defaut. On les
// bascule une seule fois, marquee par un drapeau, pour qu'un retour manuel a 4h
// ne soit pas ecrase a la mise a jour suivante.
const INVENTORY_INTERVAL_MIGRATION_KEY = "autoOpenInventoryIntervalMigratedTo24h";
const LEGACY_AUTO_OPEN_INVENTORY_INTERVAL_HOURS = 4;

async function migrateAutoOpenInventoryInterval() {
  try {
    const stored = await chrome.storage.local.get(INVENTORY_INTERVAL_MIGRATION_KEY);
    if (stored[INVENTORY_INTERVAL_MIGRATION_KEY]) return;

    const preferences = await PreferenceStore.get();
    if (
      Number(preferences.autoOpenInventoryIntervalHours) ===
      LEGACY_AUTO_OPEN_INVENTORY_INTERVAL_HOURS
    ) {
      await PreferenceStore.update({
        autoOpenInventoryIntervalHours:
          DEFAULT_PREFERENCES.autoOpenInventoryIntervalHours,
      });
    }
    await chrome.storage.local.set({ [INVENTORY_INTERVAL_MIGRATION_KEY]: true });
  } catch (error) {
    console.warn("Inventory interval migration failed:", error.message);
  }
}

// 26.9.18 : suivre un raid rapporte des points de chaine, donc l'annulation
// automatique passe a desactivee par defaut. L'ancien defaut (active) etait deja
// ecrit en storage chez tout le monde : on bascule une seule fois, marque par un
// drapeau, pour qu'un utilisateur qui la reactive ne soit pas ecrase ensuite.
const RAID_CANCEL_MIGRATION_KEY = "autoCancelRaidsMigratedToOff";

async function migrateAutoCancelRaidsOff() {
  try {
    const stored = await chrome.storage.local.get(RAID_CANCEL_MIGRATION_KEY);
    if (stored[RAID_CANCEL_MIGRATION_KEY]) return;
    await PreferenceStore.update({ autoCancelRaids: false });
    await chrome.storage.local.set({ [RAID_CANCEL_MIGRATION_KEY]: true });
  } catch (error) {
    console.warn("Raid cancel migration failed:", error.message);
  }
}

// Notification « StreamPulse a été mis à jour » : une seule fois par version.
// Le drapeau dédié survit à un éventuel double déclenchement de onInstalled,
// qui ne remet pas seenPatchNotesVersion à jour. Clic : ouvre la page des
// nouveautés. Désactivable dans les Réglages, onglet Alertes.
const UPDATE_NOTICE_VERSION_KEY = "updateNoticeShownVersion";

async function notifyUpdateOnce(version) {
  try {
    const preferences = await PreferenceStore.get();
    if (preferences.updateNotifications === false) return;
    const stored = await chrome.storage.local.get(UPDATE_NOTICE_VERSION_KEY);
    if (stored[UPDATE_NOTICE_VERSION_KEY] === version) return;
    await chrome.storage.local.set({ [UPDATE_NOTICE_VERSION_KEY]: version });
    await NotificationCenter.show({
      title: translateWithPrefs(preferences, "background.notifications.updateTitle"),
      message: translateWithPrefs(preferences, "background.notifications.updateMessage"),
      url: chrome.runtime.getURL("html/changelog.html"),
    });
  } catch (error) {
    console.warn("Update notice failed:", error?.message || error);
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  initDone = true;
  await fetchRemoteConfig(); // load credentials before first poll
  const streamers = await DataStore.ensureDefaults();
  await PreferenceStore.ensureDefaults();
  await migrateAutoOpenInventoryInterval();
  await migrateAutoCancelRaidsOff();
  await NotificationCenter.init();
  scheduleWatcherAlarm();
  scheduleKeepAliveAlarm();
  scheduleDropsAlarm();

  await pollStreamers({ forceNotification: false });
  const installReason = details?.reason || "install";
  const currentVersion = chrome.runtime.getManifest().version;

  const { onboardingShown, seenPatchNotesVersion } = await chrome.storage.local.get([
    "onboardingShown",
    "seenPatchNotesVersion",
  ]);

  if (
    installReason === chrome.runtime.OnInstalledReason?.INSTALL ||
    installReason === "install"
  ) {
    // Fresh install: onboarding covers the feature tour, so patch notes would be
    // redundant. Mark this version seen to avoid showing them on the next update.
    if (!onboardingShown && !streamers.length) {
      await chrome.storage.local.set({
        onboardingShown: true,
        seenPatchNotesVersion: currentVersion,
      });
      await openOnboarding();
    } else {
      await chrome.storage.local.set({ seenPatchNotesVersion: currentVersion });
    }
  } else if (
    installReason === chrome.runtime.OnInstalledReason?.UPDATE ||
    installReason === "update"
  ) {
    // Les notes ne s'ouvrent plus d'elles-memes : ouvrir un onglet sans que
    // l'utilisateur l'ait demande est intrusif. On memorise seulement la
    // version vue, pour signaler la nouveaute sur le bouton du popup, et la
    // notification de mise a jour (si active) prend le relais.
    if (seenPatchNotesVersion !== currentVersion) {
      await chrome.storage.local.set({ patchNotesUnread: true });
      await notifyUpdateOnce(currentVersion);
    }
  }
  await syncUpdateBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  initDone = true;
  await fetchRemoteConfig(); // refresh credentials on browser startup
  scheduleWatcherAlarm();
  scheduleKeepAliveAlarm();
  scheduleDropsAlarm();

  const prefs = await PreferenceStore.ensureDefaults();
  setupAutoOpenInventoryAlarm(prefs);
  await NotificationCenter.init();
  await pollStreamers({ forceNotification: false });
  // Le texte de badge peut survivre a un redemarrage du navigateur avec une
  // valeur perimee : on le resynchronise avec l'etat reel du stockage.
  await syncUpdateBadge();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RAID_WATCHER_ALARM) {
    refreshRaidWatcher();
  } else if (alarm.name === WATCHER_ALARM) {
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
  } else if (alarm.name === DROPS_ALARM) {
    refreshDropsFromWorker().catch((error) => console.warn("[StreamPulse] Drops :", error?.message || error));
  } else if (alarm.name === AUTO_OPEN_INVENTORY_ALARM) {
    chrome.tabs.query({ url: "*://www.twitch.tv/drops/inventory*" }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.reload(tabs[0].id);
      } else {
        chrome.tabs.create({
          url: "https://www.twitch.tv/drops/inventory",
          active: false,
        });
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

function handleMessage(request, sender, sendResponse) {
  switch (request?.type) {
    case "notify":
      (async () => {
        try {
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
        } catch (error) {
          sendResponse({ error: error?.message || String(error) });
        }
      })();
      return true;

    case "schedule":
      (async () => {
        try {
          await NotificationCenter.schedule(request);
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ error: error?.message || String(error) });
        }
      })();
      return true;

    case "openPatchNotes":
      (async () => {
        try {
          await chrome.storage.local.set({
            patchNotesUnread: false,
            seenPatchNotesVersion: chrome.runtime.getManifest().version,
          });
          await syncUpdateBadge();
          await openPatchNotes();
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ error: error?.message || String(error) });
        }
      })();
      return true;

    case "openSettings":
      try {
        chrome.tabs.create({ url: chrome.runtime.getURL("html/popup.html") });
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: e?.message });
      }
      return true;

    case "getConfig":
      // Content scripts can no longer import config.js directly (it was removed
      // from web_accessible_resources for CWS compliance). They request the
      // resolved config here instead: which also gives them the live Vercel
      // credentials rather than the empty local fallback.
      (async () => {
        try {
          await ensureConfig();
          sendResponse({
            clientId: CONFIG.clientId || "",
            accessToken: CONFIG.accessToken || "",
            features: CONFIG.features || {},
          });
        } catch {
          sendResponse({ clientId: "", accessToken: "", features: {} });
        }
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
        try {
          const [streamers, statuses, preferences, profileData] = await Promise.all([
            DataStore.getStreamers(),
            DataStore.getStatuses(),
            PreferenceStore.get(),
            chrome.storage.local.get("userProfile")
          ]);
          sendResponse({ streamers, statuses, preferences, userProfile: profileData.userProfile || null });
        } catch (error) {
          sendResponse({ error: error?.message || String(error) });
        }
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

    case "searchChannels":
      suggestChannels(String(request.platform || ""), String(request.query || ""))
        .then((items) => sendResponse({ items }))
        .catch((error) => {
          console.warn("[StreamPulse] suggestions de chaînes :", error?.message || error);
          sendResponse({ items: [], error: "unavailable" });
        });
      return true;

    case "updateUserProfile": {
      const profile = request.profile || {};
      chrome.storage.local.set({ userProfile: profile })
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ error: err.message }));
      return true;
    }


    case "addStreamer":
      (async () => {
        try {
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
          } else if (platform === "youtube") {
            // La chaîne doit exister : on résout handle → channelId (et on
            // garde l'avatar et le nom au passage). Échec = chaîne inconnue.
            const channel = await PlatformChecker.resolveYoutubeChannel(handle);
            if (!channel?.id) {
              sendResponse({
                error: translateWithPrefs(
                  preferences,
                  "background.errors.streamerNotFound",
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
              displayName: channel.name || formatHandleForDisplay(platform, handle),
              avatarUrl: channel.avatar || "",
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
        } catch (error) {
          sendResponse({ error: error?.message || String(error) });
        }
      })();
      return true;

    case "removeStreamer":
      (async () => {
        try {
          const targetId = request.id;
          const streamers = await DataStore.getStreamers();
          const filtered = streamers.filter((s) => s.id !== targetId);
          await DataStore.saveStreamers(filtered);
          streamerStates.delete(targetId);
          streamerCache.delete(targetId);
          streamerLiveState.delete(targetId);
          await pollStreamers({ forceNotification: false });
          sendResponse({ success: true, streamers: filtered });
        } catch (error) {
          sendResponse({ error: error?.message || String(error) });
        }
      })();
      return true;

    case "toggleNotifications":
    case "toggleGameNotifications":
    case "toggleTitleNotifications": {
      // Trois messages jumeaux : le nom du flag decoule du type de message.
      const flagByType = {
        toggleNotifications: "notificationsEnabled",
        toggleGameNotifications: "gameNotificationsEnabled",
        toggleTitleNotifications: "titleNotificationsEnabled",
      };
      (async () => {
        const preferences = await PreferenceStore.get();
        const streamers = await DataStore.getStreamers();
        const idx = streamers.findIndex((s) => s.id === request.id);
        if (idx === -1) {
          sendResponse({ error: translateWithPrefs(preferences, "background.errors.streamerNotFound", { platform: "" }) });
          return;
        }
        streamers[idx][flagByType[request.type]] = Boolean(request.enabled);
        await DataStore.saveStreamers(streamers);
        sendResponse({ success: true });
      })();
      return true;
    }

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
            const game = secs > 0 ? String(request.game || "") || (await currentGameOf(platform, channel)) : "";
            // Record immediately: never block on avatar resolution
            await WatchTimeStore.record(platform, channel, secs, "", game);
            HistoryStore.markWatched(platform, channel).catch(() => {});
            // Best-effort avatar update (fire-and-forget, doesn't block response)
            if (secs > 0) {
              resolveChannelAvatar(platform, channel)
                .then(async (avatar) => {
                  if (avatar) {
                    // RMW passe par la file du store, comme record().
                    await WatchTimeStore._enqueue(async () => {
                      const data = await WatchTimeStore._getData();
                      const month = WatchTimeStore._getMonthKey();
                      const key = `${platform}:${channel}`;
                      if (data[month]?.[key] && !data[month][key].avatarUrl) {
                        data[month][key].avatarUrl = avatar;
                        await WatchTimeStore._saveData(data);
                      }
                    });
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

    case "markHistorySeen":
      HistoryStore.markSeen(String(request.id || ""))
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ error: error.message }));
      return true;

    case "removeHistoryEntry":
      HistoryStore.removeEntry(String(request.id || ""))
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ error: error.message }));
      return true;

    case "activatePlus":
      (async () => {
        try {
          const result = await verifyLicense(request.key, fetch, Date.now(), await getDeviceId(chrome.storage.local));
          if (result.ok) await chrome.storage.local.set({ [PLUS_KEY]: result.record });
          sendResponse(result);
          if (result.ok) {
            const prefs = await PreferenceStore.get();
            const lang = normalizeLanguage(prefs?.language);
            thankPlusSubscriber(result.record.licenseKey, (key) => translate(lang, key)).catch(() => {});
          }
          if (result.ok) pollStreamers().catch(() => {});
        } catch (error) {
          sendResponse({ error: error?.message || String(error) });
        }
      })();
      return true;

    case "deactivatePlus":
      chrome.storage.local.remove(PLUS_KEY).then(() => sendResponse({ success: true }));
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

    case "recordPointsGain":
      (async () => {
        try {
          const prefs = await PreferenceStore.get();
          if (prefs.pointsTracking === false) {
            sendResponse({ success: true, recorded: false });
            return;
          }
          const result = await pointsStore.record(request.data);
          sendResponse({ success: true, ...result });
          if (result.recorded) pointsStore.resolveNames().catch(() => {});
        } catch (error) {
          sendResponse({ error: error?.message || String(error) });
        }
      })();
      return true;

    case "resetPoints":
      pointsStore.reset().then(
        () => sendResponse({ success: true }),
        (error) => sendResponse({ error: error?.message || String(error) }),
      );
      return true;

    case "recordDropsInventory":
      (async () => {
        try {
          const prefs = await PreferenceStore.get();
          if (prefs.dropsTracking === false || request.ok !== true) {
            sendResponse({ success: true, recorded: false, claim: [] });
            return;
          }
          const result = await dropsStore.recordInventory(request.data, { autoClaim: prefs.autoClaimDrops !== false });
          sendResponse({ success: true, recorded: result.recorded, claim: result.claim });
          announceDrops(result.added).catch(() => {});
        } catch (error) {
          sendResponse({ error: error?.message || String(error) });
        }
      })();
      return true;

    case "recordDropsEvent":
      (async () => {
        try {
          const prefs = await PreferenceStore.get();
          if (prefs.dropsTracking === false) {
            sendResponse({ success: true, recorded: false, refresh: false, claim: [] });
            return;
          }
          const result = await dropsStore.recordEvent(request.data, { autoClaim: prefs.autoClaimDrops !== false });
          sendResponse({ success: true, ...result });
          if (result.channelId) dropsStore.resolveNames().catch(() => {});
        } catch (error) {
          sendResponse({ error: error?.message || String(error) });
        }
      })();
      return true;

    case "recordDropsCampaigns":
      (async () => {
        try {
          const prefs = await PreferenceStore.get();
          const result = prefs.dropsTracking === false
            ? { recorded: false }
            : await dropsStore.recordCampaigns(request.data, request.source);
          sendResponse({ success: true, ...result });
        } catch (error) {
          sendResponse({ error: error?.message || String(error) });
        }
      })();
      return true;

    case "recordDropClaim":
      (async () => {
        try {
          const result = await dropsStore.recordClaim({
            instanceId: String(request.instanceId || ""),
            ok: request.ok === true,
            status: String(request.status || ""),
            auto: request.auto !== false,
          });
          sendResponse({ success: true, recorded: result.recorded });
          if (result.entry) announceDrops([result.entry]).catch(() => {});
          else if (request.ok !== true || !CLAIM_OK_STATUSES.includes(request.status)) {
            console.warn("[StreamPulse] récupération du Drop refusée :", request.error || request.status || "sans statut");
          }
        } catch (error) {
          sendResponse({ error: error?.message || String(error) });
        }
      })();
      return true;

    // Popup ouvert : relit l'inventaire (et les campagnes périmées) par un onglet Twitch.
    case "dropsRefresh":
      (async () => {
        try {
          const prefs = await PreferenceStore.get();
          if (prefs.dropsTracking === false) {
            sendResponse({ success: true, sent: false });
            return;
          }
          const stored = await chrome.storage.local.get(["streamPulseDropsProgress", "streamPulseDropsCampaigns"]);
          const now = Date.now();
          const readAt = Number(stored.streamPulseDropsProgress?.updatedAt) || 0;
          const campaignsAt = Number(stored.streamPulseDropsCampaigns?.updatedAt) || 0;
          const sent = request.force || now - readAt >= DROPS_POPUP_REFRESH_MS
            ? (await refreshDropsFromWorker({ minGapMs: 0 })).read || (await sendDropsCommand({ action: "inventory" }))
            : false;
          if (now - campaignsAt >= 30 * 60_000) sendDropsCommand({ action: "campaigns" }).catch(() => {});
          sendResponse({ success: true, sent });
        } catch (error) {
          sendResponse({ error: error?.message || String(error) });
        }
      })();
      return true;

    case "badgeAutoStart": {
      // { badge } : un badge de plus dans la file ; { all: true } : tous les badges gratuits possibles.
      const raw = request.badge || {};
      const job = raw.badgeId ? {
        badgeId: String(raw.badgeId),
        title: String(raw.title || "").slice(0, 120),
        image: String(raw.image || ""),
        game: String(raw.game || "").slice(0, 120),
        gameId: String(raw.gameId || ""),
        campaignId: String(raw.campaignId || ""),
        endsAt: Number(raw.endsAt) || 0,
        addedAt: Date.now(),
      } : null;
      badgeAuto.start({ job, all: request.all === true })
        .then((result) => sendResponse({ success: true, ...result }))
        .catch((error) => sendResponse({ error: error?.message || String(error) }));
      return true;
    }

    case "badgeAutoStop":
      badgeAuto.stop(String(request.badgeId || ""))
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ error: error?.message || String(error) }));
      return true;

    case "openDropsStream":
      dropsStreamUrl({ gameId: request.gameId, game: request.game })
        .then((url) => chrome.tabs.create({ url }))
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ error: error?.message || String(error) }));
      return true;

    // Bouton « Récupérer » du popup : récupération auto coupée, ou refusée par Twitch.
    case "claimDrop":
      claimDropFromWorker(String(request.instanceId || ""), false)
        .then(async (claimed) => {
          if (claimed) return { sent: true };
          if (await sendDropsCommand({ action: "claim", instanceId: String(request.instanceId || "") })) return { sent: true };
          // Twitch refuse la récupération hors de sa page : on ouvre l'inventaire,
          // où le Drop se récupère d'un clic.
          await chrome.tabs.create({ url: "https://www.twitch.tv/drops/inventory", active: true });
          return { sent: true, opened: true };
        })
        .then((result) => sendResponse({ success: true, ...result }))
        .catch((error) => sendResponse({ error: error?.message || String(error) }));
      return true;

    // channelPointsClaimer.js a cliqué un bouton « Réclamer » sur la page. Avec
    // le suivi des Drops, on relit l'inventaire de cet onglet : le Drop y sera
    // compté avec son nom, une seule fois. Sans le suivi, on garde l'ancien
    // compteur fondé sur le clic.
    case "dropClaimedByClick":
      (async () => {
        try {
          const prefs = await PreferenceStore.get();
          if (prefs.dropsTracking !== false) {
            setTimeout(() => sendDropsCommand({ action: "inventory" }, sender.tab?.id).catch(() => {}), 3000);
            setTimeout(checkBadgeAfterClaim, 5000);
          } else {
            await announceDrops([{ name: "", game: "", channel: String(request.channel || ""), at: Date.now() }]);
          }
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ error: error?.message || String(error) });
        }
      })();
      return true;

    case "incrementStat":
      (async () => {
        try {
          const { stat, value, channel, text, raidTarget } = request;
          if (stat) {
            await StatsStore.increment(stat, Number(value) || 1);
            let type = "info";
            if (stat === "dropsClaimed") type = "drop";
            else if (stat === "momentsClaimed") type = "moment";
            else if (stat === "raidsCancelled") type = "raid";
            else if (stat === "channelPointsClaimed") type = "points";

            let logText = text || `${stat} (+${value || 1})`;
            if (!text && type === "raid" && raidTarget) {
              logText = `Raid → ${raidTarget} (annulé)`;
            }

            await EventLogStore.addLog({
              type,
              channel: channel || "",
              text: logText,
              value: value || 1,
            });

            // Alertes d'evenement. On passe par NotificationCenter comme partout
            // ailleurs : il resout l'icone en URL absolue, retombe sur l'icone
            // embarquee si le telechargement echoue, et attrape le rejet.
            //
            // Les deux appels directs qui vivaient ici passaient un chemin
            // relatif ("images/photos/128px.png"). Un service worker resout le
            // relatif contre sa propre URL, soit js/images/photos/128px.png, qui
            // n'existe pas : Chrome refusait la notification entiere avec
            // « Unable to download all specified images », et faute de callback
            // la promesse rejetee remontait en Uncaught (in promise).
            const prefs = await PreferenceStore.get();
            if (type === "drop" && prefs.dropAlerts) {
              await NotificationCenter.show({
                title: translateWithPrefs(prefs, "background.notifications.dropTitle"),
                message: text || translateWithPrefs(prefs, "background.notifications.dropMessage"),
              });
            } else if (type === "raid" && prefs.raidAlerts) {
              await NotificationCenter.show({
                title: translateWithPrefs(prefs, "background.notifications.raidTitle"),
                message: text || translateWithPrefs(prefs, "background.notifications.raidMessage"),
              });
            }
          }
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ error: error?.message || String(error) });
        }
      })();
      return true;

    case "getEventLogs":
      EventLogStore.getLogs().then((logs) => {
        sendResponse({ success: true, logs });
      });
      return true;

    case "clearEventLogs":
      EventLogStore.clearLogs().then((logs) => {
        sendResponse({ success: true, logs });
      });
      return true;
    
    case "resetStat":
      (async () => {
        try {
          const { stat } = request;
          if (stat) {

            const current = await StatsStore.get();
            current[stat] = 0;
            await chrome.storage.local.set({ [STORAGE_KEYS.STATS]: current });
          }
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ error: error?.message || String(error) });
        }
      })();
      return true;

    case "updatePreferences":
      (async () => {
        try {
          const incomingUpdates = request.updates || {};
          // Coercion unique : PreferenceStore.sanitize() est la seule source de
          // verite (le bloc duplique qui vivait ici a fini par perdre des cles,
          // cf. le commentaire de sanitize()). On ne garde que les cles que
          // l'appelant a envoyees et que sanitize reconnait.
          const sanitized = PreferenceStore.sanitize(incomingUpdates);
          const updates = Object.fromEntries(
            Object.keys(incomingUpdates)
              .filter((key) => key in sanitized)
              .map((key) => [key, sanitized[key]])
          );
          if (Object.keys(updates).length === 0) {
            const preferences = await PreferenceStore.get();
            const incomingKeys = Object.keys(incomingUpdates);

            // Charge utile vide : il n'y a rien a faire, ce n'est pas une erreur.
            // Le bandeau rouge sortait ici, sans qu'aucun reglage n'ait echoue.
            // La serialisation de sendMessage supprime les proprietes valant
            // undefined, donc un appelant peut envoyer un objet qui arrive vide.
            if (incomingKeys.length === 0) {
              sendResponse({ success: true, preferences });
              return;
            }

            // Des cles sont bien arrivees mais aucune n'est reconnue : la, c'est
            // un vrai defaut. On les nomme dans la console du service worker,
            // faute de quoi le bandeau ne dit pas laquelle est en cause.
            console.warn(
              "[SP] updatePreferences: aucune cle reconnue parmi",
              incomingKeys
            );
            sendResponse({
              error: translateWithPrefs(
                preferences,
                "background.errors.noPreferencesUpdate"
              ),
            });
            return;
          }

          const preferences = await PreferenceStore.update(updates);
          if ("backgroundRaidAlerts" in updates) {
            refreshRaidWatcher();
          }
          sendResponse({ success: true, preferences });
        } catch (error) {
          sendResponse({ error: error?.message || String(error) });
        }
      })();
      return true;

    case "testNotification":
      (async () => {
        try {
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
        } catch (error) {
          sendResponse({ error: error?.message || String(error) });
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
}

// Filet uniforme : aucune exception (sync) ne doit laisser la popup sans
// reponse, et chaque IIFE async dispose desormais de son propre try/catch.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    return handleMessage(request, sender, sendResponse);
  } catch (error) {
    console.warn("[SP] onMessage:", error?.message || error);
    try {
      sendResponse({ error: error?.message || String(error) });
    } catch (_) {
      // Canal deja ferme : la popup a ete fermee entre-temps.
    }
    return false;
  }
});

scheduleWatcherAlarm();
scheduleKeepAliveAlarm();
scheduleDropsAlarm();

(async () => {
  if (initDone) return;
  initDone = true;
  await PreferenceStore.ensureDefaults();
  await NotificationCenter.init();
  refreshRaidWatcher();

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

if (chrome.tabs?.onUpdated?.addListener) {
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (
      tab?.url &&
      (tab.url.includes("twitch.tv") || tab.url.includes("kick.com") || tab.url.includes("youtube.com"))
    ) {
      try {
        const prefs = await PreferenceStore.get();
        if (prefs.preventTabDiscard && tab.autoDiscardable !== false) {
          await chrome.tabs.update(tabId, { autoDiscardable: false });
        }
      } catch (_) {
        // L'onglet peut avoir ete ferme entre la lecture des preferences et l'ecriture.
      }
    }
  });
}
