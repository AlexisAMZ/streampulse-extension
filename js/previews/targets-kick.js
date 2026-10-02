/**
 * StreamPulse hover previews: Kick DOM adapter.
 *
 * Même contrat que targets-twitch.js (self.__SP_PREVIEWS__.targets) : le
 * domaine branche l'adaptateur de sa plateforme, un seul targets est injecté
 * par domaine. Opère sur les nœuds passés, sans document global.
 *
 * Spécificités Kick : les liens de chaîne sont des routes racine
 * (kick.com/bichouu) partagées avec tout un tas de routes non-chaîne — la
 * liste d'exclusions reprend celle du tracker (watchTimeTracker.js) plus les
 * pages légales. Le descripteur porte platform: "kick" : card.js bascule alors
 * sur le lecteur embed officiel (player.kick.com) et la vignette de l'API.
 */
(function () {
  "use strict";

  const NS = typeof self !== "undefined" ? self : globalThis;
  const store = NS.__SP_PREVIEWS__ || (NS.__SP_PREVIEWS__ = {});

  // Routes Kick qui ne sont pas des chaînes (mêmes exclusions que
  // watchTimeTracker.js, plus les pages légales et le catalogue).
  const RESERVED = new Set([
    "categories", "following", "search", "dashboard", "video", "browse",
    "community", "terms", "dmca", "jobs", "help", "legal", "brand",
    "privacy", "signup", "login", "merch", "support",
  ]);

  const ANCHOR_SELECTOR = 'a[href^="/"], a[href^="https://kick.com/"]';

  function toUrl(href) {
    try {
      return new URL(href, "https://kick.com");
    } catch (_e) {
      return null;
    }
  }

  function loginFromHref(href) {
    const u = toUrl(href);
    if (!u) return "";
    const seg = u.pathname.replace(/^\/+/, "").split("/")[0].toLowerCase();
    if (!seg || RESERVED.has(seg) || seg.length > 25) return "";
    return seg.replace(/[^a-z0-9_-]/g, "");
  }

  /** Ancre survolée la plus proche, hors en-tête et barre de navigation. */
  function findAnchor(target) {
    const anchor = target && target.closest && target.closest(ANCHOR_SELECTOR);
    if (anchor && anchor.closest("nav")) return null;
    return anchor;
  }

  function classify() {
    // Kick v1 : tout passe par la surface « directory » (le réglage des
    // surfaces du popup la gating globalement).
    return "directory";
  }

  /**
   * Descripteur de preview : plateforme + handle. Vignette du DOM si la carte
   * survolée en porte une ; le titre, la catégorie et les viewers arrivent de
   * l'API (kickPreviews.js complète le descripteur avant l'affichage).
   */
  function extractFromAnchor(anchorEl) {
    if (!anchorEl) return null;
    const login = loginFromHref(anchorEl.getAttribute("href") || "");
    if (!login) return null;
    const card = anchorEl.closest('article, li, div[class*="card"], div[class*="Card"]');
    const thumb = card ? card.querySelector('img[src*="stream.kick.com"], img[src*="thumbnail"]') : null;
    const title = card ? card.querySelector("h3, h2, [class*='title']") : null;
    return {
      kind: "channel",
      platform: "kick",
      surface: classify(),
      login,
      title: title ? (title.getAttribute("title") || title.textContent || "").trim() : "",
      category: "",
      viewers: "",
      avatarUrl: "",
      thumbnailUrl: thumb && thumb.src ? thumb.src : "",
    };
  }

  store.targets = {
    ANCHOR_SELECTOR,
    findAnchor,
    classify,
    extractFromAnchor,
    loginFromHref,
    clipSlugFromHref: function () {
      return "";
    },
  };
})();
