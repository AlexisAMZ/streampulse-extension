(() => {
  const CLAIM_BUTTON_SELECTOR = ".claimable-bonus__icon";
  const CLAIM_CHECK_INTERVAL_MS = 15200;
  const PREFERENCES_KEY = "betaGeneralPreferences";
  const AUTO_CLAIM_FIELD = "autoClaimChannelPoints";

  const storage = chrome?.storage?.local;

  let claimIntervalId = null;
  let pendingDomReadyListener = null;
  let isActive = false;

  function tryClaimChannelPoints() {

    const claimButton =
      document.querySelector(".claimable-bonus__icon") ||
      document.querySelector("[aria-label='Claim Bonus']") ||
      document.querySelector("[aria-label='Récupérer le bonus']") ||
      document.querySelector('button[aria-label="Claim Bonus"]') ||
      document.querySelector('button[aria-label="Récupérer le bonus"]');

    if (claimButton instanceof HTMLElement) {
      console.log("[StreamPulse] Bonus found, clicking...");
      claimButton.click();
      

      const incrementStatsDirectly = (pointsToAdd) => {
        if (!storage) {
             console.warn("[StreamPulse] Storage not available");
             return;
        }
        if (!chrome?.runtime?.id) {
             return;
        }
        storage.get(null, (result) => {
             const currentStats = result?.betaGeneralStats || {};
             const oldVal = currentStats.channelPointsClaimed || 0;
             const newVal = oldVal + pointsToAdd;
             
             storage.set({
                 betaGeneralStats: {
                     ...currentStats,
                     channelPointsClaimed: newVal
                 }
             }, () => {
                 if (chrome.runtime.lastError) {
                     console.warn("[StreamPulse] Storage write failed:", chrome.runtime.lastError);
                 } else {
                     console.log(`[StreamPulse] Stats updated directly: ${oldVal} -> ${newVal} (+${pointsToAdd})`);
                 }
             });
        });
      };


      setTimeout(() => {
        try {

          let points = 50;
          const text = claimButton.textContent || claimButton.ariaLabel || "";
          

          const match = text.match(/\+\s*([0-9]+)/);
          
          if (match && match[1]) {
             points = parseInt(match[1], 10);
          } else {
             const simpleMatch = text.match(/([0-9]+)/);
             if (simpleMatch && simpleMatch[1]) {
               const val = parseInt(simpleMatch[1], 10);
               if (val > 0 && val < 2000) points = val;
             }
          }
          
          if (points > 10000) points = 50;
          if (points < 1) points = 50;

          incrementStatsDirectly(points);
          
        } catch (e) {
          const msg = e?.message || String(e);
          if (msg.includes("Extension context invalidated")) {
             // Suppress this error as it is expected during updates/reloads
             return;
          }
          console.warn("[StreamPulse] Exception in stat logic:", e);
        }
      }, 500);
    }
  }

  function startInterval() {
    if (claimIntervalId != null) {
      return;
    }
    tryClaimChannelPoints();
    claimIntervalId = window.setInterval(tryClaimChannelPoints, CLAIM_CHECK_INTERVAL_MS);
  }

  function scheduleClaiming() {
    if (claimIntervalId != null || pendingDomReadyListener) {
      return;
    }

    if (document.readyState === "loading") {
      pendingDomReadyListener = () => {
        pendingDomReadyListener = null;
        startInterval();
      };
      document.addEventListener("DOMContentLoaded", pendingDomReadyListener, { once: true });
    } else {
      startInterval();
    }
  }

  function stopClaiming() {
    if (pendingDomReadyListener) {
      document.removeEventListener("DOMContentLoaded", pendingDomReadyListener);
      pendingDomReadyListener = null;
    }
    if (claimIntervalId != null) {
      clearInterval(claimIntervalId);
      claimIntervalId = null;
    }
  }

  function applyPreference(preferences = {}) {
    const shouldEnable = preferences?.[AUTO_CLAIM_FIELD] !== false;
    if (shouldEnable === isActive) {
      return;
    }

    isActive = shouldEnable;

    if (shouldEnable) {
      scheduleClaiming();
    } else {
      stopClaiming();
    }
  }

  function handleStorageChange(changes, areaName) {
    if (areaName !== "local" || !changes || !(PREFERENCES_KEY in changes)) {
      return;
    }
    const { newValue } = changes[PREFERENCES_KEY] || {};
    if (newValue) {
      applyPreference(newValue);
    }
  }

  function init() {
    if (!storage) {
      scheduleClaiming();
      return;
    }

    storage.get(PREFERENCES_KEY, (result) => {
      if (chrome.runtime?.lastError) {
        console.warn(
          "Channel points claimer preferences error:",
          chrome.runtime.lastError.message
        );
        scheduleClaiming();
        return;
      }
      applyPreference(result?.[PREFERENCES_KEY]);
    });

    if (chrome?.storage?.onChanged?.addListener) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }
  }

  init();
})();
