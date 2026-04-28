(() => {
  "use strict";

  if (window.top !== window) return;

  const PREFERENCES_KEY = "betaGeneralPreferences";
  const CHECK_INTERVAL = 3000;

  let enabled = true;
  let lastKnownBalance = null;
  let observerInterval = null;

  // Kick changes its DOM structure occasionally — try multiple selectors
  const BALANCE_SELECTORS = [
    "[data-testid='channel-points-balance']",
    ".channel-points-balance",
    ".points-balance",
    "[class*='ChannelPoints'] [class*='balance']",
    "[class*='channel-points'] [class*='balance']",
    "[class*='channelPoints'] span",
    ".chat-input-wrapper [class*='points'] span",
  ];

  function readBalance() {
    for (const sel of BALANCE_SELECTORS) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const raw = el.textContent.replace(/[^0-9]/g, "");
      const val = parseInt(raw, 10);
      if (!isNaN(val) && val >= 0) return val;
    }
    return null;
  }

  function safeSend(msg) {
    try {
      chrome.runtime.sendMessage(msg).catch(() => {});
    } catch (_) {}
  }

  function check() {
    if (!enabled) return;
    const balance = readBalance();
    if (balance === null) return;

    if (lastKnownBalance !== null && balance > lastKnownBalance) {
      const gained = balance - lastKnownBalance;
      safeSend({ type: "incrementStat", stat: "channelPointsClaimed", value: gained });
    }
    lastKnownBalance = balance;
  }

  function start() {
    if (observerInterval) return;
    observerInterval = setInterval(check, CHECK_INTERVAL);
  }

  function stop() {
    if (observerInterval) clearInterval(observerInterval);
    observerInterval = null;
  }

  function applyPref(prefs = {}) {
    enabled = prefs.autoClaimChannelPoints !== false;
    enabled ? start() : stop();
  }

  chrome.storage.local.get([PREFERENCES_KEY], (result) => {
    if (chrome.runtime.lastError) { start(); return; }
    applyPref(result?.[PREFERENCES_KEY]);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[PREFERENCES_KEY]) {
      applyPref(changes[PREFERENCES_KEY].newValue);
    }
  });
})();
