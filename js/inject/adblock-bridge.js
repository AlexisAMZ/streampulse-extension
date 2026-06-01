/**
 * StreamPulse — ad-blocker settings bridge + blocked-ads counter (isolated world).
 *
 * The MAIN-world blocker (twitch-adblock.js) has no chrome.* access. This bridge,
 * running in the isolated world on the same page, does two things:
 *  1. Mirrors the `adblockEnabled` preference into the page-localStorage kill-switch
 *     the blocker reads (applies on the next page load).
 *  2. Counts blocked ad BREAKS — debounced, since one pre/mid-roll makes the player
 *     re-fetch the playlist every ~2s (many strip signals for a single break) — into
 *     a persistent chrome.storage counter, and feeds the running total back to the
 *     blocker so the on-player banner can show it.
 */
(function () {
  "use strict";

  var PREFERENCES_KEY = "betaGeneralPreferences";
  var KILL_SWITCH_KEY = "sp-adblock-disabled";
  var COUNT_KEY = "spAdblockBlockedTotal";
  // Collapse ad signals within this window into a single counted break.
  var COOLDOWN_MS = 45000;

  // Pure: map preferences → the kill-switch flag the blocker reads.
  // Enabled (default / missing) → "0"; explicitly disabled → "1".
  function disabledFlagFor(prefs) {
    var p = prefs && typeof prefs === "object" ? prefs : {};
    return p.adblockEnabled === false ? "1" : "0";
  }

  // Pure: should this ad signal open a new counted break? (time debounce)
  function shouldCount(now, lastCounted, cooldown) {
    return now - lastCounted >= cooldown;
  }

  // Expose pure helpers for unit tests (harmless in the browser).
  try {
    var NS = typeof self !== "undefined" ? self : globalThis;
    NS.__SP_ADBLOCK_BRIDGE__ = { disabledFlagFor: disabledFlagFor, shouldCount: shouldCount };
  } catch (_e) {}

  function writeFlag(prefs) {
    try {
      localStorage.setItem(KILL_SWITCH_KEY, disabledFlagFor(prefs));
    } catch (_e) {}
  }

  function postCount(n) {
    try {
      window.postMessage({ __sp_adblock_count: n }, "*");
    } catch (_e) {}
  }

  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;

  var lastCounted = 0;

  function bumpCount() {
    try {
      chrome.storage.local.get([COUNT_KEY], function (r) {
        var n = r && typeof r[COUNT_KEY] === "number" ? r[COUNT_KEY] : 0;
        n += 1;
        var obj = {};
        obj[COUNT_KEY] = n;
        try {
          chrome.storage.local.set(obj);
        } catch (_e) {}
        postCount(n);
      });
    } catch (_e) {}
  }

  try {
    // Initial sync: kill-switch flag + baseline counter → blocker banner.
    chrome.storage.local.get([PREFERENCES_KEY, COUNT_KEY], function (result) {
      writeFlag((result && result[PREFERENCES_KEY]) || {});
      var n = result && typeof result[COUNT_KEY] === "number" ? result[COUNT_KEY] : 0;
      postCount(n);
    });

    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === "local" && changes[PREFERENCES_KEY]) {
        writeFlag(changes[PREFERENCES_KEY].newValue || {});
      }
    });

    // Count blocked ad breaks signalled by the MAIN-world blocker.
    window.addEventListener("message", function (e) {
      if (!e || e.source !== window || !e.data) return;
      if (e.data.__sp_adblock === "ad") {
        var now = Date.now();
        if (shouldCount(now, lastCounted, COOLDOWN_MS)) {
          lastCounted = now;
          bumpCount();
        }
      }
    });
  } catch (_e) {}
})();
