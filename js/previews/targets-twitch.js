/**
 * StreamPulse — hover previews: Twitch DOM adapter.
 *
 * All Twitch-specific selectors and descriptor extraction live here so UI drift
 * is contained to one file. Operates on passed-in nodes (no global document),
 * which keeps it pure enough to unit-test with jsdom fixtures. Attaches to
 * `self.__SP_PREVIEWS__.targets`.
 */
(function () {
  "use strict";

  const NS = typeof self !== "undefined" ? self : globalThis;
  const store = NS.__SP_PREVIEWS__ || (NS.__SP_PREVIEWS__ = {});

  // Hoverable anchors across directory grid, sidebar, clips and search.
  const ANCHOR_SELECTORS = [
    'a[data-a-target="preview-card-image-link"]',
    'a[data-test-selector="followed-channel"]',
    "a.side-nav-card__link",
    ".side-nav-card a[href]",
    'a[data-a-target="card-1-image-link"]',
  ];
  const ANCHOR_SELECTOR = ANCHOR_SELECTORS.join(",");

  const SIDEBAR_CONTAINER = '.side-nav,[data-a-target="side-nav"],#side-nav,[data-test-selector="side-nav"]';
  const SEARCH_CONTAINER = '[data-a-target="search-result-card"],.search-results,[data-target="search"]';

  const TITLE_SELECTORS = [
    '[data-a-target="preview-card-title-link"]',
    ".side-nav-card__title",
    '[data-a-target="side-nav-card-title"]',
    "h3[title]",
    ".tw-media-card-meta__title",
  ];
  const CATEGORY_SELECTORS = [
    '[data-a-target="preview-card-game-link"]',
    ".side-nav-card__metadata",
    '[data-a-target="side-nav-game-title"]',
  ];
  const VIEWERS_SELECTORS = [
    ".tw-media-card-stat",
    '[data-a-target="preview-card-channel-link"] + *',
    ".side-nav-card__live-status",
  ];
  const AVATAR_SELECTORS = [".tw-image-avatar", ".side-nav-card__avatar img", "img.tw-image"];

  // Path segments that are never channel logins.
  const RESERVED = new Set([
    "directory", "videos", "settings", "subscriptions", "wallet", "drops",
    "search", "u", "p", "team", "friends", "clips", "moderator", "popout",
    "downloads", "jobs", "turbo", "prime", "store",
  ]);

  function toUrl(href) {
    try {
      return new URL(href, "https://www.twitch.tv");
    } catch (_e) {
      return null;
    }
  }

  function loginFromHref(href) {
    const u = toUrl(href);
    if (!u) return "";
    const seg = u.pathname.replace(/^\/+/, "").split("/")[0].toLowerCase();
    if (!seg || RESERVED.has(seg)) return "";
    return seg.replace(/[^a-z0-9_]/g, "");
  }

  function clipSlugFromHref(href) {
    const u = toUrl(href);
    if (!u) return "";
    const q = u.searchParams.get("clip");
    if (q) return q;
    const parts = u.pathname.replace(/^\/+/, "").split("/");
    const ci = parts.indexOf("clip");
    if (ci >= 0 && parts[ci + 1]) return parts[ci + 1];
    if (u.hostname === "clips.twitch.tv" && parts[0]) return parts[0];
    return "";
  }

  function firstText(card, selectors) {
    if (!card) return "";
    for (const sel of selectors) {
      const node = card.querySelector(sel);
      const txt = node && (node.getAttribute("title") || node.textContent);
      if (txt && txt.trim()) return txt.trim();
    }
    return "";
  }

  function firstAttr(card, selectors, attr) {
    if (!card) return "";
    for (const sel of selectors) {
      const node = card.querySelector(sel);
      const val = node && node.getAttribute(attr);
      if (val) return val;
    }
    return "";
  }

  /** Nearest hoverable anchor to an event target, or null. */
  function findAnchor(target) {
    return (target && target.closest && target.closest(ANCHOR_SELECTOR)) || null;
  }

  /** Classify which surface an anchor belongs to. */
  function classify(anchorEl, loc) {
    if (anchorEl.closest && anchorEl.closest(SIDEBAR_CONTAINER)) return "sidebar";
    const href = anchorEl.getAttribute("href") || "";
    if (/\/clip\//.test(href) || /clips\.twitch\.tv/.test(href) || (loc && loc.hostname === "clips.twitch.tv")) {
      return "clips";
    }
    if ((loc && typeof loc.pathname === "string" && loc.pathname.indexOf("/search") === 0) ||
      (anchorEl.closest && anchorEl.closest(SEARCH_CONTAINER))) {
      return "search";
    }
    return "directory";
  }

  /**
   * Build a preview descriptor from a hovered anchor.
   * @param {Element} anchorEl
   * @param {{hostname?:string, pathname?:string}} [loc]
   * @returns {null | {kind:"channel"|"clip", surface:string, login?:string, slug?:string,
   *   title?:string, category?:string, viewers?:string, avatarUrl?:string}}
   */
  function extractFromAnchor(anchorEl, loc) {
    if (!anchorEl) return null;
    const surface = classify(anchorEl, loc);
    const href = anchorEl.getAttribute("href") || "";
    const card =
      (anchorEl.closest &&
        anchorEl.closest('article, .tw-media-card, .side-nav-card, [data-a-target="card"]')) ||
      anchorEl.parentElement ||
      anchorEl;

    const base = {
      surface,
      title: firstText(card, TITLE_SELECTORS),
      category: firstText(card, CATEGORY_SELECTORS),
      viewers: firstText(card, VIEWERS_SELECTORS),
      avatarUrl: firstAttr(card, AVATAR_SELECTORS, "src"),
    };

    if (surface === "clips") {
      const slug = clipSlugFromHref(href);
      if (!slug) return null;
      return Object.assign({ kind: "clip", slug }, base);
    }

    const login = loginFromHref(href);
    if (!login) return null;
    return Object.assign({ kind: "channel", login }, base);
  }

  store.targets = {
    ANCHOR_SELECTOR,
    SIDEBAR_CONTAINER,
    findAnchor,
    classify,
    extractFromAnchor,
    loginFromHref,
    clipSlugFromHref,
  };
})();
