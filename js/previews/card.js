/**
 * StreamPulse — hover previews: the single floating preview card.
 *
 * Exposes a pure `computePosition` helper (unit-tested) plus a `createPreviewCard`
 * factory that owns ONE reused DOM node (mount / show / hide / destroy). Attaches
 * to `self.__SP_PREVIEWS__`. Depends on `__SP_PREVIEWS__.sources` at call time.
 */
(function () {
  "use strict";

  const NS = typeof self !== "undefined" ? self : globalThis;
  const store = NS.__SP_PREVIEWS__ || (NS.__SP_PREVIEWS__ = {});

  const IMAGE_REFRESH_MS = 3000;

  // Opt-in diagnostics: set `window.__SP_PREVIEWS_DEBUG__ = true` in the Twitch
  // tab console, then hover a live channel to trace the video pipeline.
  function dbg() {
    try {
      if (NS.__SP_PREVIEWS_DEBUG__ && typeof console !== "undefined") {
        console.debug.apply(console, ["[SP previews]"].concat([].slice.call(arguments)));
      }
    } catch (_e) {}
  }

  /**
   * Pure, viewport-aware placement. Prefers below the anchor, flips above when it
   * would overflow the bottom, centers horizontally, and clamps to the viewport.
   * @param {{top:number,left:number,right:number,bottom:number,width:number,height:number}} anchor
   * @param {{width:number,height:number}} card
   * @param {{width:number,height:number}} viewport
   * @param {number} [gap=8]
   * @returns {{top:number,left:number,placement:"below"|"above"|"clamped"}}
   */
  function computePosition(anchor, card, viewport, gap) {
    gap = gap == null ? 8 : gap;
    const vw = viewport.width;
    const vh = viewport.height;

    // Horizontal: prefer the right of the anchor, flip left if it would overflow.
    let placement = "right";
    let left = anchor.right + gap;
    if (left + card.width + gap > vw) {
      const leftSide = anchor.left - gap - card.width;
      if (leftSide >= gap) {
        left = leftSide;
        placement = "left";
      } else {
        left = Math.max(gap, Math.min(left, vw - card.width - gap));
        placement = "clamped";
      }
    }

    // Vertical: center on the anchor, clamped to the viewport.
    let top = anchor.top + anchor.height / 2 - card.height / 2;
    top = Math.max(gap, Math.min(top, vh - card.height - gap));

    return { top: Math.round(top), left: Math.round(left), placement };
  }

  function el(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  /**
   * Creates one reusable floating card. Instantiate a single card per page.
   * @returns {{mount:Function, show:Function, hide:Function, destroy:Function, isVisible:Function}}
   */
  function createPreviewCard() {
    let root = null;
    let mediaEl, imgEl, iframeEl, fallbackEl, fbAvatarEl, fbGameEl, titleEl, categoryEl;
    let refreshTimer = null;
    let playToken = 0;
    let visible = false;

    function mount() {
      if (root) return;
      root = el("div", "sp-preview");
      root.setAttribute("data-platform", "twitch");
      root.hidden = true;

      mediaEl = el("div", "sp-preview__media");

      imgEl = el("img", "sp-preview__img");
      imgEl.alt = "";

      iframeEl = el("iframe", "sp-preview__iframe");
      iframeEl.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
      iframeEl.setAttribute("scrolling", "no");
      iframeEl.hidden = true;

      fallbackEl = el("div", "sp-preview__fallback");
      fbAvatarEl = el("img", "sp-preview__fallback-avatar");
      fbAvatarEl.alt = "";
      fbGameEl = el("span", "sp-preview__fallback-game");
      fallbackEl.append(fbAvatarEl, fbGameEl);

      const overlay = el("div", "sp-preview__overlay");
      titleEl = el("p", "sp-preview__title");
      categoryEl = el("p", "sp-preview__category");
      overlay.append(titleEl, categoryEl);

      const badge = el("span", "sp-preview__badge");
      badge.textContent = "LIVE";

      mediaEl.append(imgEl, iframeEl, fallbackEl, overlay, badge);
      root.append(mediaEl);
      document.body.appendChild(root);
    }

    function stopRefresh() {
      if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }
    }

    function showFallback(descriptor) {
      fallbackEl.hidden = false;
      if (descriptor.avatarUrl) {
        fbAvatarEl.src = descriptor.avatarUrl;
        fbAvatarEl.hidden = false;
      } else {
        fbAvatarEl.hidden = true;
      }
      fbGameEl.textContent = descriptor.category || "";
    }

    function clearFallback() {
      fallbackEl.hidden = true;
    }

    function applyImageMode(descriptor, size) {
      playToken++;
      teardownPlayback();
      imgEl.hidden = false;
      const sources = store.sources;
      let firstLoad = true;
      const load = () => {
        // First paint reuses the browser/CDN cache (no cache-bust) → instant when
        // Twitch already loaded this thumbnail in the grid; refreshes bust cache.
        imgEl.src = sources.twitchPreviewImageUrl(
          descriptor.login,
          size.width,
          size.height,
          firstLoad ? undefined : Date.now()
        );
        firstLoad = false;
      };
      imgEl.onload = () => clearFallback();
      imgEl.onerror = () => showFallback(descriptor);
      load();
      stopRefresh();
      refreshTimer = setInterval(load, IMAGE_REFRESH_MS);
    }

    function teardownPlayback() {
      if (iframeEl) {
        iframeEl.src = "";
        iframeEl.hidden = true;
      }
    }

    function applyClipEmbed(descriptor, opts) {
      const parent = (typeof location !== "undefined" && location.hostname) || "twitch.tv";
      imgEl.hidden = true;
      imgEl.removeAttribute("src");
      iframeEl.hidden = false;
      iframeEl.src = store.sources.clipEmbedUrl(descriptor.slug, { parent, muted: !opts.audio });
    }

    function show(anchorEl, descriptor, opts) {
      if (!root) mount();
      opts = opts || {};
      const presets = store.sources.SIZE_PRESETS;
      const size = presets[opts.size] || presets.m;

      root.style.width = size.width + "px";
      mediaEl.style.height = size.height + "px";
      root.setAttribute("data-mode", "image");

      titleEl.textContent = descriptor.title || "";
      categoryEl.textContent = descriptor.category || "";
      titleEl.hidden = !descriptor.title;
      categoryEl.hidden = !descriptor.category;

      // Show fallback (avatar + game) until the real media loads.
      showFallback(descriptor);

      if (descriptor.kind === "clip" && descriptor.slug) {
        teardownPlayback();
        applyClipEmbed(descriptor, opts);
      } else {
        applyImageMode(descriptor, size);
      }

      root.hidden = false;
      const rect = anchorEl.getBoundingClientRect();
      const pos = computePosition(
        {
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        },
        size,
        { width: window.innerWidth, height: window.innerHeight }
      );
      root.style.top = pos.top + "px";
      root.style.left = pos.left + "px";
      root.setAttribute("data-placement", pos.placement);

      root.classList.toggle("sp-preview--animated", opts.animations !== false);
      void root.offsetWidth; // reflow so the transition runs
      root.classList.add("sp-preview--in");
      visible = true;
    }

    function hide() {
      if (!root) return;
      visible = false;
      playToken++;
      stopRefresh();
      teardownPlayback();
      root.classList.remove("sp-preview--in");
      root.hidden = true;
      imgEl.removeAttribute("src");
    }

    function destroy() {
      stopRefresh();
      teardownPlayback();
      if (root && root.parentNode) root.parentNode.removeChild(root);
      root = null;
    }

    return { mount, show, hide, destroy, isVisible: () => visible };
  }

  store.computePosition = computePosition;
  store.createPreviewCard = createPreviewCard;
})();
