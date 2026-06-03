(() => {
  "use strict";

  if (window.top !== window) return;

  const CLAIM_CHECK_INTERVAL = 2000;
  const PREFERENCES_KEY = "betaGeneralPreferences";

  let intervalId = null;
  let isActive = false;
  let lastClaimTime = 0;

  function tryClaim() {
    if (Date.now() - lastClaimTime < 5000) return;

    let btn = document.querySelector('button[aria-label="Claim Bonus"], button[aria-label="Récupérer le bonus"]');
    
    if (!btn) {
      const icon = document.querySelector('.claimable-bonus__icon');
      if (icon) btn = icon.closest('button');
    }

    if (!btn) {
      // SVG path du coffre Twitch, indépendant de la langue et des classes
      const svgPath = document.querySelector('path[d="M13 12h-2v2h2v-2Z"]');
      if (svgPath) btn = svgPath.closest('button');
    }

    if (!btn) return;

    // Channel points bonus chest found — claim it
    lastClaimTime = Date.now();
    btn.click();

    let points = 50;
    const summary = btn.closest("[data-test-selector='community-points-summary']");
    if (summary) {
      const match = (summary.textContent || "").match(/\+\s*(\d+)/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val > 0 && val <= 10000) points = val;
      }
    }
    setTimeout(() => {
      try {
        chrome.runtime.sendMessage({
          type: "incrementStat",
          stat: "channelPointsClaimed",
          value: points,
        }).catch(() => {});
      } catch (_) {}
    }, 300);
  }

  function start() {
    if (intervalId) return;
    intervalId = setInterval(tryClaim, CLAIM_CHECK_INTERVAL);
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function applyPref(prefs = {}) {
    const enabled = prefs.autoClaimChannelPoints !== false;
    if (enabled === isActive) return;
    isActive = enabled;
    enabled ? start() : stop();
  }

  chrome.storage.local.get([PREFERENCES_KEY], (result) => {
    if (chrome.runtime.lastError) {
      start();
      return;
    }
    applyPref(result?.[PREFERENCES_KEY]);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[PREFERENCES_KEY]) {
      applyPref(changes[PREFERENCES_KEY].newValue);
    }
  });
})();
