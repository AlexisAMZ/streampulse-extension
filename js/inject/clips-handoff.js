// Passerelle vers StreamPulse Clips : construit le lien de l'éditeur pour la
// page de clip Twitch ou Kick ouverte. Rien d'autre que l'URL publique du clip part vers
// le site (ni jeton, ni cookie, ni état de licence) ; le site revalide le lien.
// Pur, chargé avant twitchPlayerButtons.js (manifest), testé par
// tests/clips-handoff.test.mjs.
(function (root) {
  "use strict";

  const EDITOR_ORIGIN = "https://spclips.com";
  const EDITOR_PATH = "/app";
  const CLIP_PATH = /^\/([A-Za-z0-9_]+)\/clip\/([A-Za-z0-9_-]+)\/?$/;
  const CLIPS_TWITCH_TV_PATH = /^\/([A-Za-z0-9_-]+)(?:\/edit)?\/?$/;
  const HISTORY_KEY = "spClipsHistory";
  const MAX_HISTORY = 40;

  /** Lien de l'éditeur pour un chemin /<chaîne>/clip/<slug> de www.twitch.tv, sinon null. */
  function editorUrlForClipPath(pathname) {
    if (typeof pathname !== "string") return null;
    const match = CLIP_PATH.exec(pathname);
    if (!match) return null;
    const url = new URL(EDITOR_PATH, EDITOR_ORIGIN);
    url.searchParams.set("clip", `https://www.twitch.tv/${match[1]}/clip/${match[2]}`);
    url.searchParams.set("utm_source", "streampulse");
    url.searchParams.set("utm_medium", "extension");
    url.searchParams.set("utm_campaign", "clip_button");
    return url.toString();
  }

  /** Analyse une URL ou texte de clip (Twitch ou Kick) et renvoie { platform, slug, canonicalUrl } ou null. */
  function parseClipUrl(input) {
    if (typeof input !== "string") return null;
    const trimmed = input.trim();
    if (!trimmed) return null;

    // 1. Chemin relatif Twitch /gotaga/clip/Abc-1_x
    const pathMatch = CLIP_PATH.exec(trimmed);
    if (pathMatch) {
      return {
        platform: "twitch",
        slug: pathMatch[2],
        channel: pathMatch[1],
        canonicalUrl: `https://www.twitch.tv/${pathMatch[1]}/clip/${pathMatch[2]}`,
      };
    }

    try {
      const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      const host = url.hostname.toLowerCase();

      // Twitch : clips.twitch.tv/<slug>
      if (host === "clips.twitch.tv") {
        if (/^\/embed\/?$/.test(url.pathname)) {
          const embedded = url.searchParams.get("clip");
          if (embedded && /^[A-Za-z0-9_-]+$/.test(embedded)) {
            return {
              platform: "twitch",
              slug: embedded,
              channel: null,
              canonicalUrl: `https://clips.twitch.tv/${embedded}`,
            };
          }
        }
        const m = CLIPS_TWITCH_TV_PATH.exec(url.pathname);
        if (m && m[1] && m[1] !== "create") {
          return {
            platform: "twitch",
            slug: m[1],
            channel: null,
            canonicalUrl: `https://clips.twitch.tv/${m[1]}`,
          };
        }
      }

      // Twitch : www.twitch.tv/<channel>/clip/<slug>
      if (host === "www.twitch.tv" || host === "twitch.tv" || host === "m.twitch.tv") {
        const m = CLIP_PATH.exec(url.pathname);
        if (m) {
          return {
            platform: "twitch",
            slug: m[2],
            channel: m[1],
            canonicalUrl: `https://www.twitch.tv/${m[1]}/clip/${m[2]}`,
          };
        }
      }

      // Kick : kick.com/<channel>?clip=<id>
      if (host === "kick.com" || host === "www.kick.com") {
        const clipParam = url.searchParams.get("clip");
        if (clipParam && /^[A-Za-z0-9_-]+$/.test(clipParam)) {
          const channel = url.pathname.replace(/^\//, "").split("/")[0] || null;
          return {
            platform: "kick",
            slug: clipParam,
            channel,
            canonicalUrl: `https://kick.com/${channel ? channel : ""}?clip=${clipParam}`,
          };
        }
      }
    } catch (_) {}

    return null;
  }

  /** Lien de l'éditeur SP Clips pour toute entrée valide (chemin ou URL complète), avec campagne UTM optionnelle. */
  function editorUrlForClip(input, campaign) {
    const parsed = parseClipUrl(input);
    if (!parsed) return null;
    const url = new URL(EDITOR_PATH, EDITOR_ORIGIN);
    url.searchParams.set("clip", parsed.canonicalUrl);
    url.searchParams.set("utm_source", "streampulse");
    url.searchParams.set("utm_medium", "extension");
    url.searchParams.set("utm_campaign", campaign || "clip_button");
    return url.toString();
  }

  /** Enregistre un clip dans l'historique local chrome.storage.local (dédupliqué, max 40). */
  async function saveClipToHistory(clip) {
    if (!clip || !clip.url) return;
    try {
      if (typeof chrome === "undefined" || !chrome.storage?.local) return;
      const data = await chrome.storage.local.get([HISTORY_KEY]);
      const list = Array.isArray(data?.[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
      const now = Date.now();

      const item = {
        id: clip.id || clip.slug || clip.url,
        url: clip.url,
        editorUrl: editorUrlForClip(clip.url, "history_reopen") || clip.url,
        title: (clip.title || "").trim().slice(0, 150) || "Clip",
        channel: (clip.channel || "").trim().slice(0, 50),
        platform: clip.platform || "twitch",
        thumbnailUrl: typeof clip.thumbnailUrl === "string" ? clip.thumbnailUrl : null,
        duration: typeof clip.duration === "number" ? clip.duration : null,
        createdAt: clip.createdAt || now,
        openedAt: now,
      };

      const filtered = list.filter((it) => it.url !== item.url && it.id !== item.id);
      const next = [item, ...filtered].slice(0, MAX_HISTORY);
      await chrome.storage.local.set({ [HISTORY_KEY]: next });
    } catch (_) {}
  }

  /** Lit l'historique des clips récents. */
  async function getClipsHistory() {
    try {
      if (typeof chrome === "undefined" || !chrome.storage?.local) return [];
      const data = await chrome.storage.local.get([HISTORY_KEY]);
      return Array.isArray(data?.[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
    } catch (_) {
      return [];
    }
  }

  root.StreamPulseClipsHandoff = Object.freeze({
    EDITOR_ORIGIN,
    EDITOR_PATH,
    editorUrlForClipPath,
    parseClipUrl,
    editorUrlForClip,
    saveClipToHistory,
    getClipsHistory,
  });
})(globalThis);
