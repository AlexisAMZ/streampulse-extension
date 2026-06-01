/**
 * StreamPulse — hover previews: Twitch live HLS resolver.
 *
 * Resolves a channel's raw HLS playlist so video mode can play clean live video
 * in a native <video> (via hls.js) with NO Twitch player chrome:
 *   GQL PlaybackAccessToken  →  usher .m3u8 master  →  pick a light quality.
 *
 * Uses Twitch's public web Client-ID (unauthenticated). This relies on Twitch's
 * internal endpoints (gray-area vs ToS); callers must fall back to the image
 * thumbnail on any failure so the preview never breaks.
 *
 * Pure helpers are unit-tested; `fetchPlaylist` performs the network calls.
 * Attaches to `self.__SP_PREVIEWS__.stream`.
 */
(function () {
  "use strict";

  const NS = typeof self !== "undefined" ? self : globalThis;
  const store = NS.__SP_PREVIEWS__ || (NS.__SP_PREVIEWS__ = {});

  const CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko"; // Twitch public web client id
  const GQL_URL = "https://gql.twitch.tv/gql";
  const PERSISTED_HASH =
    "0828119ded1c13477966434e15800ff57ddacf13ba1911c129dc2200705b0712";

  function safeLogin(login) {
    return String(login || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  }

  function accessTokenRequest(login) {
    return {
      operationName: "PlaybackAccessToken",
      extensions: {
        persistedQuery: { version: 1, sha256Hash: PERSISTED_HASH },
      },
      variables: {
        isLive: true,
        login: safeLogin(login),
        isVod: false,
        vodID: "",
        playerType: "site",
      },
    };
  }

  function usherUrl(login, token, sig, opts) {
    opts = opts || {};
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      token: token,
      sig: sig,
      allow_source: "true",
      allow_audio_only: "true",
      fast_bread: "true",
      player: "twitchweb",
      type: "any",
      p: String(opts.p != null ? opts.p : 1),
    });
    return (
      "https://usher.ttvnw.net/api/channel/hls/" +
      safeLogin(login) +
      ".m3u8?" +
      params.toString()
    );
  }

  /**
   * Parse a master playlist; return the highest variant <= maxHeight, else the
   * lowest available, else null.
   * @param {string} masterText
   * @param {number} [maxHeight=480]
   * @returns {string|null} variant URL
   */
  function pickVariant(masterText, maxHeight) {
    maxHeight = maxHeight || 480;
    const lines = String(masterText || "").split(/\r?\n/);
    const variants = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].indexOf("#EXT-X-STREAM-INF") === 0) {
        const m = /RESOLUTION=(\d+)x(\d+)/.exec(lines[i]);
        const url = (lines[i + 1] || "").trim();
        if (url && url[0] !== "#") {
          variants.push({ height: m ? Number(m[2]) : 0, url });
        }
      }
    }
    if (!variants.length) return null;
    const within = variants.filter((v) => v.height && v.height <= maxHeight);
    if (within.length) {
      within.sort((a, b) => b.height - a.height);
      return within[0].url;
    }
    const withHeight = variants.filter((v) => v.height).sort((a, b) => a.height - b.height);
    return (withHeight[0] && withHeight[0].url) || variants[0].url;
  }

  /**
   * Resolve a playable variant (.m3u8) URL for a live channel.
   * @param {string} login
   * @param {{ maxHeight?: number, p?: number }} [opts]
   * @returns {Promise<string>}
   * @throws on any failure (caller falls back to the image thumbnail)
   */
  async function fetchPlaylist(login, opts) {
    opts = opts || {};
    const tokenRes = await fetch(GQL_URL, {
      method: "POST",
      headers: { "Client-ID": CLIENT_ID, "Content-Type": "application/json" },
      body: JSON.stringify(accessTokenRequest(login)),
    });
    if (!tokenRes.ok) throw new Error("gql " + tokenRes.status);
    const data = await tokenRes.json();
    const tok = data && data.data && data.data.streamPlaybackAccessToken;
    if (!tok || !tok.value || !tok.signature) throw new Error("no-token");
    const p = opts.p != null ? opts.p : Math.floor(Math.random() * 1e7);
    const url = usherUrl(login, tok.value, tok.signature, { p });
    const masterRes = await fetch(url);
    if (!masterRes.ok) throw new Error("usher " + masterRes.status);
    const master = await masterRes.text();
    return pickVariant(master, opts.maxHeight) || url;
  }

  // TTV-LOL-style ad-block proxies. These return an ad-free master playlist for a
  // channel (the proxy fetches from a no-ad region; segments still load directly
  // from Twitch's CDN). Community proxies change often — edit this list if video
  // previews stop working. Falls back to the image thumbnail when none respond.
  const PROXY_BASES = [
    "https://lb-eu.cdn-perfprod.com/live",
    "https://lb-eu2.cdn-perfprod.com/live",
    "https://lb-na.cdn-perfprod.com/live",
    "https://lb-as.cdn-perfprod.com/live",
  ];

  function proxyMasterUrl(base, login) {
    return base.replace(/\/+$/, "") + "/" + safeLogin(login);
  }

  /**
   * Resolve an ad-free master playlist URL via the first reachable proxy.
   * @param {string} login
   * @param {string[]} [bases]
   * @returns {Promise<string>} proxied master .m3u8 URL
   * @throws when no proxy responds (caller falls back to the image thumbnail)
   */
  async function resolveProxyMaster(login, bases) {
    bases = bases && bases.length ? bases : PROXY_BASES;
    for (let i = 0; i < bases.length; i++) {
      try {
        const url = proxyMasterUrl(bases[i], login);
        // Plain GET only — any custom header would trigger a CORS preflight that
        // these proxies reject (Access-Control-Allow-Headers).
        const res = await fetch(url);
        if (!res.ok) continue;
        const text = await res.text();
        if (text && text.indexOf("#EXTM3U") === 0) return url;
      } catch (_e) {
        /* try the next proxy */
      }
    }
    throw new Error("no-proxy");
  }

  // True when a media playlist contains a Twitch stitched-ad break.
  function hasAd(text) {
    const s = String(text || "");
    return s.indexOf("twitch-stitched-ad") !== -1 || s.indexOf("X-TV-TWITCH-AD") !== -1;
  }

  store.stream = {
    accessTokenRequest,
    usherUrl,
    pickVariant,
    fetchPlaylist,
    proxyMasterUrl,
    resolveProxyMaster,
    hasAd,
    PROXY_BASES,
    CLIENT_ID,
  };
})();
