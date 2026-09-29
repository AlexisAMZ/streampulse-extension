// Historique des lives terminés (et VOD Twitch associée).

import { HISTORY_KEY, addSession, emptyHistory, markSeen, patchSession, removeEntry } from "../history-data.js";
import { formatHandleForDisplay, normalizePlatform } from "../platforms.js";
import { fetchTwitchJson, twitchHeaders } from "./config.js";
import { sizeThumbnail } from "./normalize.js";
import { PlatformChecker } from "./platform-checker.js";

// ─── Historique des lives ─────────────────────────────────────────────────────
// Chaque fin de live d'un streamer suivi devient une entree d'historique. Une
// session est « regardee » si le tracker de temps de visionnage a vu la chaine
// ouverte pendant qu'elle etait en direct.
export const LAST_WATCHED_KEY = "streamPulseLastWatched";

export class HistoryStore {
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
