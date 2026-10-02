// Statut des chaînes par plateforme : Twitch (Helix, par lots), Kick, YouTube.

import { buildProfileUrl, isYoutubeChannelId, normalizePlatform, platformSupportsLiveStatus, sanitizeHandle } from "../platforms.js";
import { ensureConfig, fetchJson, fetchTwitchJson, twitchHeaders } from "./config.js";
import { NETWORK_TIMEOUT_MS } from "./constants.js";
import { fetchKickOfficial, getKickAppToken } from "./kick-token.js";
import { resolveKickAsset, sanitizeLogin } from "./normalize.js";
import { pollStreamers } from "./polling.js";

const TWITCH_STREAMS_BATCH_SIZE = 100;

export function twitchStreamToStatus(stream) {
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
export async function fetchTwitchStreamsBatch(logins) {
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


/**
 * Vignettes Kick : uniquement les URLs fournies par l'API (les URLs construites
 * en secours répondent 403 en réel), dédoublonnées, 5 au plus, avec un
 * cache-buster par minute.
 */
function kickThumbnailCandidates(stream, cacheBucket) {
  const apiRaw = [stream?.thumbnail?.url, stream?.thumbnail?.src, stream?.thumbnail_url, stream?.thumbnail];
  const resolved = apiRaw
    .map((raw) => resolveKickAsset(raw))
    .filter((url) => url && !url.includes("null") && !url.includes("undefined"));
  return [...new Set(resolved)].slice(0, 5).map((url) => {
    if (url.includes("cb=")) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}cb=${cacheBucket}`;
  });
}

export class PlatformChecker {
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

    // API officielle d'abord (si des credentials d'app sont configurés).
    try {
      const token = await getKickAppToken();
      if (token) {
        const official = await fetchKickOfficial(sanitized, token);
        if (official) return { _source: "official", ...official };
      }
    } catch (error) {
      // Repli sur l'API V2 non officielle.
      console.warn("[SP] Kick API officielle :", error?.message || error);
    }

    return this.getKickChannelV2(sanitized);
  }

  /**
   * Repli (et source de la photo de profil) : l'API v2 non officielle.
   * L'API officielle n'expose pas la photo — seulement la bannière.
   */
  static async getKickChannelV2(sanitized) {
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
      // La photo de profil n'existe pas dans l'API officielle (seulement la
      // bannière, qui n'a pas sa place dans un rond) : getKickStatus la
      // complète depuis le repli v2.
      avatarUrl: "",
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

    // Kick renvoie `thumbnail: null` quand il n'a pas d'image.
    const thumbnailCandidates = kickThumbnailCandidates(stream, cb);
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
      const status = this.extractKickStatusOfficial(channel, handle);
      // L'API officielle n'expose pas la photo de profil : elle vient du
      // repli v2, seule source de la vraie image du streamer.
      if (!status.avatarUrl) {
        const v2 = await this.getKickChannelV2(handle);
        const pic = resolveKickAsset(v2?.user?.profile_pic) || "";
        if (pic) status = { ...status, avatarUrl: pic };
      }
      return status;
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
    } catch (error) {
      // Cache perdu : on re-résoudra.
      console.warn("[SP] cache des chaînes YouTube illisible :", error?.message || error);
    }
  }

  static async saveYoutubeCache() {
    try {
      await chrome.storage.local.set({
        "streampulse:youtubeChannels": Object.fromEntries(this._youtubeCache),
      });
    } catch (error) {
      console.warn("[SP] cache des chaînes YouTube non écrit :", error?.message || error);
    }
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
    // Handle → ID : la page de la chaîne embarque le lien canonique et
    // "externalId". L'ordre compte : canonical d'abord (c'est LA chaîne de la
    // page), externalId ensuite ; un "channelId" nu peut appartenir à une
    // entité quelconque citée dans la page (mise en avant, commentaires).
    try {
      const resp = await fetch(
        `https://www.youtube.com/@${encodeURIComponent(sanitized)}`,
        { redirect: "follow", signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS) }
      );
      if (!resp.ok) return null;
      const html = await resp.text();
      const id =
        /<link rel="canonical" href="[^"]*\/(UC[A-Za-z0-9_-]{10,32})"/.exec(html)?.[1]
        || /"externalId"\s*:\s*"(UC[A-Za-z0-9_-]{10,32})"/.exec(html)?.[1]
        || /"channelId"\s*:\s*"(UC[A-Za-z0-9_-]{10,32})"/.exec(html)?.[1]
        || "";
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

  // État YouTube par chaîne : une page /live complète (plus oEmbed) à chaque
  // tour de sondage coûtait cher pour un statut qui change rarement. Cadence
  // propre de 5 minutes, en mémoire : un SW réveillé refait une mesure fraîche.
  static YOUTUBE_STATUS_TTL_MS = 5 * 60_000;
  static _youtubeStatusCache = new Map();

  static async getYoutubeStatus(handle) {
    const sanitized = sanitizeHandle("youtube", handle);
    const cached = this._youtubeStatusCache.get(sanitized);
    if (cached && Date.now() - cached.at < this.YOUTUBE_STATUS_TTL_MS) {
      return cached.result;
    }
    const result = await this._fetchYoutubeStatus(sanitized);
    this._youtubeStatusCache.set(sanitized, { at: Date.now(), result });
    if (this._youtubeStatusCache.size > 300) {
      const now = Date.now();
      for (const [key, entry] of this._youtubeStatusCache) {
        if (now - entry.at >= this.YOUTUBE_STATUS_TTL_MS) this._youtubeStatusCache.delete(key);
      }
    }
    return result;
  }

  static async _fetchYoutubeStatus(sanitized) {
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
      const res = await fetch(liveUrl, {
        redirect: "follow",
        signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
      });
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
        )}&format=json`,
        { signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS) }
      );
      if (res.ok) {
        const data = await res.json();
        title = data.title || "";
        displayName = data.author_name || displayName;
      }
    } catch (error) {
      // Titre optionnel : le live reste signalé sans lui.
      console.warn("[SP] oEmbed YouTube :", error?.message || error);
    }

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
