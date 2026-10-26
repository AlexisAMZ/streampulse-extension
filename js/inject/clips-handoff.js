// Passerelle vers StreamPulse Clips : construit le lien de l'éditeur pour la
// page de clip Twitch ouverte. Rien d'autre que l'URL publique du clip part vers
// le site (ni jeton, ni cookie, ni état de licence) ; le site revalide le lien.
// Pur, chargé avant twitchPlayerButtons.js (manifest), testé par
// tests/clips-handoff.test.mjs.
(function (root) {
  "use strict";

  const EDITOR_ORIGIN = "https://spclips.com";
  const EDITOR_PATH = "/app";
  const CLIP_PATH = /^\/([A-Za-z0-9_]+)\/clip\/([A-Za-z0-9_-]+)\/?$/;

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

  root.StreamPulseClipsHandoff = Object.freeze({ EDITOR_ORIGIN, editorUrlForClipPath });
})(globalThis);
