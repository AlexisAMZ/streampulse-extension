/**
 * StreamPulse — hover previews: SPA lifecycle helpers.
 *
 * `attachDelegation` wires ONE delegated mouseover/mouseout pair with hover-intent
 * debounce (survives Twitch's virtualized lists — no per-card listeners).
 * `observeRouteChanges` fires on SPA navigation so the entry can hide a stale card.
 * Attaches to `self.__SP_PREVIEWS__.observe`.
 */
(function () {
  "use strict";

  const NS = typeof self !== "undefined" ? self : globalThis;
  const store = NS.__SP_PREVIEWS__ || (NS.__SP_PREVIEWS__ = {});

  function debounce(fn, ms) {
    let t = null;
    return function () {
      if (t) clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  /**
   * @param {EventTarget} root
   * @param {{findAnchor:(t:any)=>any, onEnter:(a:any)=>void, onLeave:(a:any)=>void}} handlers
   * @param {{showDelayMs?:number, hideDelayMs?:number}} [opts]
   * @returns {() => void} detach
   */
  function attachDelegation(root, handlers, opts) {
    opts = opts || {};
    const showDelay = opts.showDelayMs == null ? 200 : opts.showDelayMs;
    const hideDelay = opts.hideDelayMs == null ? 120 : opts.hideDelayMs;
    let showTimer = null;
    let hideTimer = null;
    let currentAnchor = null;

    function clearShow() {
      if (showTimer) {
        clearTimeout(showTimer);
        showTimer = null;
      }
    }
    function clearHide() {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    }

    function onOver(e) {
      const anchor = handlers.findAnchor(e.target);
      if (!anchor) return;
      if (anchor === currentAnchor) {
        clearHide();
        return;
      }
      currentAnchor = anchor;
      clearHide();
      clearShow();
      showTimer = setTimeout(function () {
        showTimer = null;
        handlers.onEnter(anchor);
      }, showDelay);
    }

    function onOut(e) {
      if (!currentAnchor) return;
      const to = e.relatedTarget;
      if (to && currentAnchor.contains && currentAnchor.contains(to)) return; // moving within anchor
      clearShow();
      clearHide();
      const leaving = currentAnchor;
      hideTimer = setTimeout(function () {
        hideTimer = null;
        currentAnchor = null;
        handlers.onLeave(leaving);
      }, hideDelay);
    }

    root.addEventListener("mouseover", onOver, true);
    root.addEventListener("mouseout", onOut, true);

    return function detach() {
      clearShow();
      clearHide();
      currentAnchor = null;
      root.removeEventListener("mouseover", onOver, true);
      root.removeEventListener("mouseout", onOut, true);
    };
  }

  /**
   * @param {() => void} onRouteChange
   * @returns {() => void} disconnect
   */
  function observeRouteChanges(onRouteChange) {
    let last = typeof location !== "undefined" ? location.pathname : "";
    const fire = debounce(function () {
      const now = typeof location !== "undefined" ? location.pathname : "";
      if (now !== last) {
        last = now;
        onRouteChange();
      }
    }, 150);

    let obs = null;
    const titleEl = document.querySelector("title");
    if (titleEl && typeof MutationObserver !== "undefined") {
      obs = new MutationObserver(fire);
      obs.observe(titleEl, { childList: true });
    }
    window.addEventListener("popstate", fire);
    window.addEventListener("hashchange", fire);

    return function disconnect() {
      if (obs) obs.disconnect();
      window.removeEventListener("popstate", fire);
      window.removeEventListener("hashchange", fire);
    };
  }

  store.observe = { attachDelegation, observeRouteChanges };
})();
