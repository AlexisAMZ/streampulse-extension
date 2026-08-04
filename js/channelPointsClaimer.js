(() => {
  "use strict";

  if (window.top !== window) return;

  const CLAIM_CHECK_INTERVAL = 2500;
  const PREFERENCES_KEY = "betaGeneralPreferences";

  let intervalId = null;
  let isPointsActive = true;
  let isDropsActive = true;
  let isMomentsActive = true;
  let lastClaimTime = 0;

  function tryClaimChannelPoints() {
    let btn = document.querySelector(
      'button[aria-label="Claim Bonus"], button[aria-label="Récupérer le bonus"], button[aria-label*="Bonus"]'
    );

    if (!btn) {
      const icon = document.querySelector(".claimable-bonus__icon");
      if (icon) btn = icon.closest("button");
    }

    if (!btn) {
      // SVG path du coffre Twitch, indépendant de la langue et des classes
      const svgPath = document.querySelector('path[d="M13 12h-2v2h2v-2Z"]');
      if (svgPath) btn = svgPath.closest("button");
    }

    if (!btn) return false;

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

    return true;
  }

  function notifyDropClaimed() {
    setTimeout(() => {
      try {
        chrome.runtime.sendMessage({
          type: "incrementStat",
          stat: "dropsClaimed",
          value: 1,
        }).catch(() => {});
      } catch (_) {}
    }, 300);
  }

  function tryClaimDrops() {
    // Selectors for Twitch Drop claim buttons (in overlay, live or /drops/inventory)
    const selectors = [
      '[data-a-target="claim-drop-button"]',
      'button[data-test-selector="claim-drop-button"]',
      'button[aria-label*="Drop"]',
      'button[aria-label*="drop"]',
      'button[aria-label*="Réclamer"]',
      'button[aria-label*="Obtenir"]',
      'button[aria-label*="Claim"]',
      '.claim-drop-button button',
      'button.claim-button',
    ];

    for (const selector of selectors) {
      const btns = document.querySelectorAll(selector);
      for (const btn of btns) {
        if (
          btn &&
          btn instanceof HTMLElement &&
          btn.offsetParent !== null &&
          !btn.hasAttribute("disabled")
        ) {
          lastClaimTime = Date.now();
          btn.click();
          notifyDropClaimed();
          return true;
        }
      }
    }

    // Text content fallback scanner for inventory page (twitch.tv/drops/inventory or /inventory)
    const allButtons = document.querySelectorAll("button");
    for (const btn of allButtons) {
      if (
        btn &&
        btn instanceof HTMLElement &&
        btn.offsetParent !== null &&
        !btn.hasAttribute("disabled")
      ) {
        const txt = (btn.textContent || "").trim().toLowerCase();
        if (
          txt.includes("réclamer maintenant") ||
          txt.includes("claim now") ||
          txt.includes("réclamer le drop") ||
          txt.includes("claim drop") ||
          txt === "réclamer" ||
          txt === "claim" ||
          txt === "obtenir"
        ) {
          lastClaimTime = Date.now();
          btn.click();
          notifyDropClaimed();
          return true;
        }
      }
    }

    return false;
  }

  function tryClaimMoments() {
    // Selectors for Twitch Moment claim buttons
    const selectors = [
      '[data-a-target="claim-moment-button"]',
      'button[aria-label*="Moment"]',
      'button[aria-label*="Claim Moment"]',
      'button[aria-label*="Réclamer le moment"]',
    ];

    for (const selector of selectors) {
      const btn = document.querySelector(selector);
      if (btn && btn instanceof HTMLElement && btn.offsetParent !== null) {
        lastClaimTime = Date.now();
        btn.click();
        setTimeout(() => {
          try {
            chrome.runtime.sendMessage({
              type: "incrementStat",
              stat: "momentsClaimed",
              value: 1,
            }).catch(() => {});
          } catch (_) {}
        }, 300);
        return true;
      }
    }
    return false;
  }

  function tryClaim() {
    if (Date.now() - lastClaimTime < 4000) return;

    if (isPointsActive && tryClaimChannelPoints()) return;
    if (isDropsActive && tryClaimDrops()) return;
    if (isMomentsActive && tryClaimMoments()) return;
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
    isPointsActive = prefs.autoClaimChannelPoints !== false;
    isDropsActive = prefs.autoClaimDrops !== false;
    isMomentsActive = prefs.autoClaimMoments !== false;

    const anyActive = isPointsActive || isDropsActive || isMomentsActive;
    anyActive ? start() : stop();
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
