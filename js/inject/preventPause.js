(() => {
  "use strict";

  // Prevent Twitch video player from pausing or degrading quality when the tab is inactive/hidden.
  // Compatible with 7TV, BetterTTV, and FrankerFaceZ.

  try {
    // Override Document visibility properties so Twitch thinks the page is always active
    Object.defineProperties(Document.prototype, {
      hidden: {
        get: function () {
          return false;
        },
        configurable: true,
      },
      visibilityState: {
        get: function () {
          return "visible";
        },
        configurable: true,
      },
    });

    // Block visibilitychange event dispatching to Twitch's internal listeners
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (type === "visibilitychange") {
        const wrappedListener = function (event) {
          // Suppress visibilitychange if it tries to signal 'hidden'
          if (document.hidden === false) {
            // Prevent event execution for video pause logic
            return;
          }
          if (typeof listener === "function") {
            return listener.call(this, event);
          } else if (listener && typeof listener.handleEvent === "function") {
            return listener.handleEvent(event);
          }
        };
        return originalAddEventListener.call(this, type, wrappedListener, options);
      }
      return originalAddEventListener.call(this, type, listener, options);
    };

    // Auto-resume video player if Twitch attempts to pause it when hidden
    document.addEventListener(
      "pause",
      (e) => {
        if (e.target && e.target.tagName === "VIDEO") {
          const video = e.target;
          // Only auto-play if video was paused while page is not actually focused/visible
          if (document.realHidden || document.webkitHidden) {
            setTimeout(() => {
              if (video.paused) {
                video.play().catch(() => {});
              }
            }, 100);
          }
        }
      },
      true
    );
  } catch (err) {
    console.warn("StreamPulse: preventPause injection failed", err);
  }
})();
