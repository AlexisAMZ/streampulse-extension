(() => {
  "use strict";

  // Keeps the Twitch player from pausing or dropping to low quality when the
  // tab is hidden. Runs in the MAIN world at document_start so it patches the
  // page's own Document before Twitch reads visibility.
  //
  // Opt-in: the "keepQualityInBackground" setting is mirrored into this
  // localStorage flag by twitchPlayerEnhancer.js (isolated world, which can
  // read chrome.storage). That script also fires STREAMPULSE_EVENT on every
  // change, so turning the setting on or off applies at once, without a reload.
  // Compatible with 7TV, BetterTTV, and FrankerFaceZ.

  const FLAG_KEY = "streampulse:keepQualityInBackground";
  const STREAMPULSE_EVENT = "streampulse:keep-playing-changed";
  if (window.__streampulsePreventPauseLoaded) return;
  window.__streampulsePreventPauseLoaded = true;

  const readFlag = () => {
    try {
      return window.localStorage.getItem(FLAG_KEY) === "1";
    } catch (_error) {
      // Storage blocked (privacy mode): leave Twitch's default behavior.
      return false;
    }
  };

  const FORCED = { hidden: false, webkitHidden: false, visibilityState: "visible", webkitVisibilityState: "visible" };
  let active = false;
  let originals = {};
  let originalHasFocus = null;

  const enable = () => {
    if (active) return;
    try {
      originals = {};
      const forced = {};
      for (const name of Object.keys(FORCED)) {
        originals[name] = Object.getOwnPropertyDescriptor(Document.prototype, name);
        forced[name] = { get: () => FORCED[name], configurable: true };
      }
      Object.defineProperties(Document.prototype, forced);
      originalHasFocus = Document.prototype.hasFocus;
      Document.prototype.hasFocus = () => true;
      active = true;
      window.__streampulsePreventPause = true;
    } catch (err) {
      console.warn("StreamPulse: visibility override failed", err);
    }
  };

  const disable = () => {
    if (!active) return;
    try {
      for (const [name, descriptor] of Object.entries(originals)) {
        if (descriptor) Object.defineProperty(Document.prototype, name, descriptor);
        else delete Document.prototype[name];
      }
      Document.prototype.hasFocus = originalHasFocus;
    } catch (err) {
      console.warn("StreamPulse: visibility restore failed", err);
    }
    active = false;
    window.__streampulsePreventPause = false;
  };

  const sync = () => (readFlag() ? enable() : disable());

  // Swallow visibility and blur signals before any page listener sees them,
  // only while the setting is on (the listeners stay installed either way).
  const swallow = (event) => {
    if (active) event.stopImmediatePropagation();
  };
  for (const type of ["visibilitychange", "webkitvisibilitychange"]) {
    document.addEventListener(type, swallow, true);
    window.addEventListener(type, swallow, true);
  }
  window.addEventListener(
    "blur",
    (event) => {
      if (active && event.target === window) event.stopImmediatePropagation();
    },
    true
  );

  window.addEventListener(STREAMPULSE_EVENT, sync);
  sync();
})();
