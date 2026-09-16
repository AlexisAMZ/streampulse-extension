(() => {
  "use strict";

  // Keeps the Twitch player from pausing or dropping to low quality when the
  // tab is hidden. Runs in the MAIN world at document_start so it patches the
  // page's own Document before Twitch reads visibility.
  //
  // Opt-in: the "keepQualityInBackground" setting is mirrored into this
  // localStorage flag by twitchPlayerEnhancer.js (isolated world, which can
  // read chrome.storage). Changes apply on the next page load.
  // Compatible with 7TV, BetterTTV, and FrankerFaceZ.

  const FLAG_KEY = "streampulse:keepQualityInBackground";

  const readFlag = () => {
    try {
      return window.localStorage.getItem(FLAG_KEY) === "1";
    } catch (_error) {
      // Storage blocked (privacy mode): leave Twitch's default behavior.
      return false;
    }
  };
  if (!readFlag() || window.__streampulsePreventPause) return;
  window.__streampulsePreventPause = true;

  const alwaysVisible = (value) => ({ get: () => value, configurable: true });

  try {
    Object.defineProperties(Document.prototype, {
      hidden: alwaysVisible(false),
      webkitHidden: alwaysVisible(false),
      visibilityState: alwaysVisible("visible"),
      webkitVisibilityState: alwaysVisible("visible"),
    });
    Document.prototype.hasFocus = () => true;
  } catch (err) {
    console.warn("StreamPulse: visibility override failed", err);
  }

  // Swallow visibility and blur signals before any page listener sees them.
  const swallow = (event) => event.stopImmediatePropagation();
  for (const type of ["visibilitychange", "webkitvisibilitychange"]) {
    document.addEventListener(type, swallow, true);
    window.addEventListener(type, swallow, true);
  }
  window.addEventListener(
    "blur",
    (event) => {
      if (event.target === window) event.stopImmediatePropagation();
    },
    true
  );
})();
