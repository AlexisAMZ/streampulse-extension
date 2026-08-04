/**
 * StreamPulse — hover previews entry (content script).
 *
 * Reads `preferences.previews`, wires the observer → targets → card pipeline,
 * gates by surface, and tears everything down when disabled. Loaded after
 * sources.js / card.js / targets-twitch.js / observer.js (manifest order), all of
 * which populate `self.__SP_PREVIEWS__`.
 */
(function () {
  "use strict";

  // Previews live in the top frame (directory grid + sidebar).
  if (window.top !== window) return;

  const NS = typeof self !== "undefined" ? self : globalThis;
  const SP = NS.__SP_PREVIEWS__;
  if (!SP || !SP.targets || !SP.observe || !SP.createPreviewCard) return;

  const PREFERENCES_KEY = "betaGeneralPreferences";

  const DEFAULTS = {
    enabled: true,
    mode: "image", // "image" | "video"
    surfaces: { directory: true, sidebar: true, clips: true, search: true },
    size: "m", // "s" | "m" | "l"
    audioInVideo: false,
    unmuteOnHover: false,
    showDelayMs: 200,
    animations: true,
  };

  // Preferences are flat keys inside `betaGeneralPreferences` (StreamPulse style).
  function mergePrefs(p) {
    p = p && typeof p === "object" ? p : {};
    return {
      enabled: p.previewsEnabled !== false,
      mode: p.previewsMode === "video" ? "video" : "image",
      surfaces: {
        directory: p.previewsSurfaceDirectory !== false,
        sidebar: p.previewsSurfaceSidebar !== false,
        clips: p.previewsSurfaceClips !== false,
        search: p.previewsSurfaceSearch !== false,
      },
      size: ["s", "m", "l"].indexOf(p.previewsSize) >= 0 ? p.previewsSize : "m",
      audioInVideo: p.previewsAudio === true,
      unmuteOnHover: p.previewsUnmuteOnHover === true,
      showDelayMs: Number.isFinite(p.previewsShowDelayMs) ? p.previewsShowDelayMs : 200,
      animations: p.previewsAnimations !== false,
    };
  }

  let prefs = DEFAULTS;
  let card = null;
  let detachDelegation = null;
  let disconnectRoutes = null;
  let running = false;
  let lastAnchor = null;

  function showOpts() {
    return {
      mode: prefs.mode,
      size: prefs.size,
      audio: prefs.audioInVideo,
      unmuteOnHover: prefs.unmuteOnHover,
      animations: prefs.animations,
    };
  }

  function onEnter(anchor) {
    try {
      const descriptor = SP.targets.extractFromAnchor(anchor, location);
      if (!descriptor) return;
      if (prefs.surfaces[descriptor.surface] === false) return;
      lastAnchor = anchor;
      card.show(anchor, descriptor, showOpts());

      if (descriptor.kind === "channel" && SP.sources && SP.sources.fetchStreamTitle) {
        if (!descriptor.title || descriptor.surface === "sidebar") {
          SP.sources.fetchStreamTitle(descriptor.login).then(function(title) {
            if (title && lastAnchor === anchor && card && card.isVisible()) {
              card.updateTitle(title);
            }
          });
        }
      }
    } catch (_e) {
      /* never throw into the page */
    }
  }

  function onLeave() {
    lastAnchor = null;
    if (card) card.hide();
  }

  function start() {
    if (running) return;
    running = true;
    card = SP.createPreviewCard();
    card.mount();
    detachDelegation = SP.observe.attachDelegation(
      document.body,
      { findAnchor: SP.targets.findAnchor, onEnter, onLeave },
      { showDelayMs: prefs.showDelayMs }
    );
    disconnectRoutes = SP.observe.observeRouteChanges(onLeave);
  }

  function stop() {
    if (!running) return;
    running = false;
    if (detachDelegation) detachDelegation();
    if (disconnectRoutes) disconnectRoutes();
    if (card) card.destroy();
    detachDelegation = disconnectRoutes = card = null;
  }

  function apply(nextPrefs) {
    const wasRunning = running;
    const showDelayChanged = prefs.showDelayMs !== nextPrefs.showDelayMs;
    prefs = nextPrefs;
    if (!prefs.enabled) {
      stop();
      return;
    }
    if (!wasRunning) {
      start();
    } else if (showDelayChanged) {
      // Re-attach delegation so the new hover-intent delay takes effect.
      if (detachDelegation) detachDelegation();
      detachDelegation = SP.observe.attachDelegation(
        document.body,
        { findAnchor: SP.targets.findAnchor, onEnter, onLeave },
        { showDelayMs: prefs.showDelayMs }
      );
    }
    // mode/size/surfaces/audio are read live in showOpts() on the next hover.
    // If a preview is already on screen, re-render it now so mode/size/surface
    // changes apply instantly — no re-hover or page reload needed.
    if (
      running &&
      card &&
      card.isVisible &&
      card.isVisible() &&
      lastAnchor &&
      document.body.contains(lastAnchor)
    ) {
      const anchor = lastAnchor;
      card.hide();
      onEnter(anchor);
    }
  }

  function load() {
    chrome.storage.local.get([PREFERENCES_KEY], function (result) {
      apply(mergePrefs((result && result[PREFERENCES_KEY]) || {}));
    });
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === "local" && changes[PREFERENCES_KEY]) {
      apply(mergePrefs(changes[PREFERENCES_KEY].newValue || {}));
    }
  });

  load();
})();
