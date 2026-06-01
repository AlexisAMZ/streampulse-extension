/**
 * StreamPulse — hover previews: media source URL builders.
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
  const SIZE_PRESETS = {
    s: { width: 280, height: 157 },
    m: { width: 360, height: 202 },
    l: { width: 440, height: 247 },
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

  store.sources = {
    SIZE_PRESETS,
    twitchPreviewImageUrl,
    twitchPlayerEmbedUrl,
    clipEmbedUrl,
  };
})();
