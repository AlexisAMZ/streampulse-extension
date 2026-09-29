// Temps de visionnage : cumul, avatars des chaînes regardées, un onglet par chaîne.

import { normalizePlatform } from "../platforms.js";
import { ensureConfig, fetchJson, fetchTwitchJson, twitchHeaders } from "./config.js";
import { STORAGE_KEYS } from "./constants.js";
import { streamerCache, streamerStates } from "./state.js";
import { DataStore } from "./stores.js";

// Avatar cache for watch time (avoids repeated API calls)
const wtAvatarCache = new Map();

export async function resolveChannelAvatar(platform, channel) {
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

/**
 * Categorie en cours d'une chaine suivie, d'apres le dernier etat live connu.
 * Repli quand la page n'a pas pu lire le jeu elle-meme.
 */
export async function currentGameOf(platform, channel) {
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

export class WatchTimeStore {
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

  /** Fusionne un jeu simple ou un cumul multi-jeux dans les categories existantes. */
  static _mergeGames(existing, game, seconds) {
    if (game && typeof game === "object") {
      let merged = existing || {};
      for (const [name, secs] of Object.entries(game)) merged = this._addGame(merged, name, secs);
      return merged;
    }
    return this._addGame(existing, game, seconds);
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
          games: this._mergeGames(previous.games, game, seconds),
        },
      },
    };
    const days = Object.keys(next).sort();
    for (const old of days.slice(0, Math.max(0, days.length - DAILY_RETENTION))) {
      delete next[old];
    }
    await chrome.storage.local.set({ [STORAGE_KEYS.WATCH_TIME_DAILY]: next });
  }

  // record() et flush() font du read-modify-write sur la meme cle :
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
    return this._enqueue(() => this._stage(platform, channel, seconds, avatarUrl, game));
  }

  // ── Cumul en attente ──
  // Chaque battement réécrivait deux gros objets toutes les 60 s (le mois sur
  // 3 fenêtres, le quotidien sur 400 jours). On cumule en mémoire, on garde
  // une copie en storage.session (survit à un redémarrage du service worker)
  // et on n'écrit le stockage durable qu'au plus toutes les 5 minutes, à
  // l'alarme dédiée et à la suspension du SW.

  static PENDING_KEY = "watchTimePending";
  static FLUSH_INTERVAL_MS = 5 * 60_000;
  static _pending = null;
  static _lastFlushAt = 0;
  static _flushing = false;

  static async _stage(platform, channel, seconds, avatarUrl = "", game = "") {
    const key = `${platform}:${channel}`;
    const pending = this._pending || {};
    const entry = pending[key] || { platform, channel, seconds: 0, avatarUrl: "", games: {} };
    entry.seconds += seconds;
    if (avatarUrl && !entry.avatarUrl) entry.avatarUrl = avatarUrl;
    entry.games = this._mergeGames(entry.games, game, seconds);
    pending[key] = entry;
    this._pending = pending;
    await this._persistPending();
    if (Date.now() - this._lastFlushAt >= this.FLUSH_INTERVAL_MS) await this.flush();
  }

  static async _persistPending() {
    try {
      await chrome.storage.session.set({ [this.PENDING_KEY]: this._pending });
    } catch (error) {
      // storage.session peut être indisponible (tests, quota) : le cumul en
      // mémoire suffit tant que le SW vit, seule la copie est perdue.
      console.warn("[WatchTime] copie du cumul en session impossible :", error?.message || error);
    }
  }

  /** Redmarre le cumul après un réveil du SW (copie storage.session). */
  static async restorePending() {
    if (this._pending) return;
    try {
      const stored = await chrome.storage.session.get(this.PENDING_KEY);
      const pending = stored[this.PENDING_KEY];
      if (pending && typeof pending === "object" && Object.keys(pending).length) {
        this._pending = pending;
      }
    } catch (error) {
      console.warn("[WatchTime] reprise du cumul impossible :", error?.message || error);
    }
  }

  /** Écrit le cumul dans le stockage durable (au plus toutes les 5 minutes). */
  static async flush() {
    if (this._flushing) return;
    const pending = this._pending;
    if (!pending || !Object.keys(pending).length) return;
    this._flushing = true;
    this._pending = null;
    try {
      await chrome.storage.session.remove(this.PENDING_KEY);
    } catch {
      // La copie de session est retirée au mieux : la source est écrite après.
    }
    try {
      for (const entry of Object.values(pending)) {
        await this._record(entry.platform, entry.channel, entry.seconds, entry.avatarUrl, entry.games || {});
      }
      this._lastFlushAt = Date.now();
    } catch (error) {
      // Échec d'écriture : on remet le cumul en attente plutôt que de perdre
      // le temps de visionnage, la prochaine alarme refera le travail.
      console.warn("[WatchTime] écriture du cumul impossible :", error?.message || error);
      const back = this._pending || {};
      for (const [key, entry] of Object.entries(pending)) {
        if (!back[key]) back[key] = entry;
      }
      this._pending = back;
      await this._persistPending();
    } finally {
      this._flushing = false;
    }
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
    data[month][key].games = this._mergeGames(data[month][key].games, game, seconds);
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
}


/**
 * Un seul onglet compte par chaîne et par minute : le premier battement gagne,
 * les autres ne créditent que la présence. Sans onglet (popup, tests), compter.
 * La carte est petite (une entrée par chaîne regardée) mais purgée quand elle
 * grossit, pour ne rien garder au-delà de la minute utile.
 */
const watchTimeClaims = new Map();

export function watchTimeTabClaims(platform, channel, tabId) {
  if (!platform || !channel) return true;
  const key = `${platform}:${channel}`;
  const now = Date.now();
  const previous = watchTimeClaims.get(key);
  if (previous && now - previous.at < 60_000 && previous.tabId !== tabId) return false;
  watchTimeClaims.set(key, { tabId, at: now });
  if (watchTimeClaims.size > 500) {
    for (const [claimKey, claim] of watchTimeClaims) {
      if (now - claim.at > 5 * 60_000) watchTimeClaims.delete(claimKey);
    }
  }
  return true;
}
