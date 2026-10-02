/**
 * StreamPulse hover previews: media source URL builders.
 *
 * Pure functions only (no DOM). Loaded as a plain MV3 content script; attaches
 * its API to `self.__SP_PREVIEWS__.sources`. All endpoints are public and
 * unauthenticated (no Twitch API key required).
 */
(function () {
  "use strict";

  const NS = typeof self !== "undefined" ? self : globalThis;
  const store = NS.__SP_PREVIEWS__ || (NS.__SP_PREVIEWS__ = {});

  // 16:9 presets used by the floating card and the image-mode thumbnail URL.
  // Trois paliers nettement distincts : a 440px, le L se distinguait a peine
  // du M. Le 16/9 est conserve pour que la video ne soit jamais recadree.
  const SIZE_PRESETS = {
    s: { width: 368, height: 207 },
    m: { width: 464, height: 261 },
    l: { width: 560, height: 315 },
  };

  /** Twitch logins are [a-z0-9_]; normalize defensively. */
  function safeLogin(login) {
    return String(login || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
  }

  /**
   * Public live preview thumbnail (a periodically-updated still frame).
   * @param {string} login
   * @param {number} [width]
   * @param {number} [height]
   * @param {number|string} [cacheBust] appended as `?cb=` to force a refresh
   * @returns {string}
   */
  function twitchPreviewImageUrl(login, width, height, cacheBust) {
    const w = Math.round(width) || SIZE_PRESETS.m.width;
    const h = Math.round(height) || SIZE_PRESETS.m.height;
    const base =
      "https://static-cdn.jtvnw.net/previews-ttv/live_user_" +
      safeLogin(login) +
      "-" +
      w +
      "x" +
      h +
      ".jpg";
    return cacheBust != null ? base + "?cb=" + encodeURIComponent(cacheBust) : base;
  }

  /**
   * Live channel embed (real motion + optional audio).
   * @param {string} login
   * @param {{ muted?: boolean, autoplay?: boolean, parent?: string }} [opts]
   * @returns {string}
   */
  function twitchPlayerEmbedUrl(login, opts) {
    opts = opts || {};
    const params = new URLSearchParams({
      channel: safeLogin(login),
      parent: opts.parent || "twitch.tv",
      muted: opts.muted === false ? "false" : "true",
      autoplay: opts.autoplay === false ? "false" : "true",
    });
    return "https://player.twitch.tv/?" + params.toString();
  }

  /**
   * Clip embed.
   * @param {string} slug
   * @param {{ autoplay?: boolean, muted?: boolean, parent?: string }} [opts]
   * @returns {string}
   */
  function clipEmbedUrl(slug, opts) {
    opts = opts || {};
    const params = new URLSearchParams({
      clip: String(slug || "").trim(),
      parent: opts.parent || "twitch.tv",
      autoplay: opts.autoplay === false ? "false" : "true",
      muted: opts.muted === false ? "false" : "true",
    });
    return "https://clips.twitch.tv/embed?" + params.toString();
  }

  /**
   * Fetch live stream title from GQL.
   * @param {string} login
   * @returns {Promise<string|null>}
   */
  async function fetchStreamTitle(login) {
    try {
      const res = await fetch("https://gql.twitch.tv/gql", {
        method: "POST",
        headers: { "Client-ID": "kimne78kx3ncx6brgo4mv6wki5h1ko" },
        body: JSON.stringify({
          query: `query { user(login: "${safeLogin(login)}") { stream { title } } }`
        })
      });
      const data = await res.json();
      return (data && data.data && data.data.user && data.data.user.stream && data.data.user.stream.title) || null;
    } catch {
      return null;
    }
  }

  /**
   * Données de chaîne Kick (même origine depuis kick.com : cookies et
   * Cloudflare suivent la navigation). Retour : { isLive, title, game,
   * viewers, avatarUrl, thumbnailUrl } ou null (chaîne inexistante).
   */
  async function kickChannelData(slug) {
    try {
      const cleaned = String(slug || "").trim().toLowerCase();
      if (!cleaned) return null;
      const res = await fetch("https://kick.com/api/v2/channels/" + encodeURIComponent(cleaned));
      if (!res.ok) return null;
      const channel = await res.json();
      const stream = channel?.livestream || null;
      return {
        slug: channel.slug || cleaned,
        isLive: Boolean(stream),
        title: stream?.session_title || stream?.title || "",
        game: stream?.category?.name || "",
        viewers: stream?.viewer_count || 0,
        avatarUrl: (channel?.user && channel.user.profile_pic) || "",
        thumbnailUrl: (stream?.thumbnail && stream.thumbnail.url) || "",
      };
    } catch {
      return null;
    }
  }

  /**
   * Lecteur embed officiel de Kick (iframe), comme la scène du popup.
   * Le paramètre parent est obligatoire côté Kick.
   */
  function kickPlayerEmbedUrl(slug, opts) {
    opts = opts || {};
    const params = new URLSearchParams({
      parent: opts.parent || "kick.com",
      muted: opts.muted === false ? "false" : "true",
      autoplay: opts.autoplay === false ? "false" : "true",
    });
    return "https://player.kick.com/" + encodeURIComponent(String(slug || "").toLowerCase()) + "?" + params.toString();
  }

  store.sources = {
    SIZE_PRESETS,
    twitchPreviewImageUrl,
    twitchPlayerEmbedUrl,
    clipEmbedUrl,
    fetchStreamTitle,
    kickChannelData,
    kickPlayerEmbedUrl,
  };
})();
