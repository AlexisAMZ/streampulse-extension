/**
 * StreamPulse — ad-blocker settings bridge (isolated world, document_start).
 *
 * The ad-blocker itself runs in the page MAIN world (`twitch-adblock.js`) and has
 * no `chrome.*` access, so it reads a kill-switch from page `localStorage`. This
 * bridge mirrors the `adblockEnabled` preference (chrome.storage) into that
 * localStorage key, so the popup toggle controls the blocker.
 *
 * The MAIN-world blocker reads the flag once at document_start, so a change
 * applies on the next full page load (reload). Disabling is a rare safety action,
 * so reload-to-apply is acceptable and keeps the hook install/teardown robust.
 */
(function () {
  "use strict";

  var PREFERENCES_KEY = "betaGeneralPreferences";
  var KILL_SWITCH_KEY = "sp-adblock-disabled";

  // Pure: map preferences → the kill-switch flag the blocker reads.
  // Enabled (default / missing) → "0"; explicitly disabled → "1".
  function disabledFlagFor(prefs) {
    var p = prefs && typeof prefs === "object" ? prefs : {};
    return p.adblockEnabled === false ? "1" : "0";
  }

  // Expose the pure helper for unit tests (harmless in the browser).
  try {
    var NS = typeof self !== "undefined" ? self : globalThis;
    NS.__SP_ADBLOCK_BRIDGE__ = { disabledFlagFor: disabledFlagFor };
  } catch (_e) {}

  function writeFlag(prefs) {
    try {
      localStorage.setItem(KILL_SWITCH_KEY, disabledFlagFor(prefs));
    } catch (_e) {}
  }

  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;

  try {
    chrome.storage.local.get([PREFERENCES_KEY], function (result) {
      writeFlag((result && result[PREFERENCES_KEY]) || {});
    });
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === "local" && changes[PREFERENCES_KEY]) {
        writeFlag(changes[PREFERENCES_KEY].newValue || {});
      }
    });
  } catch (_e) {}
})();
