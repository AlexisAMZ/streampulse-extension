(() => {
  "use strict";

  // Watch Time Tracker — tracks per-channel watch time.
  // Heartbeat every 60s; partial seconds captured on page close via pagehide.

  if (window.top !== window) return; // skip iframes

  const HEARTBEAT_INTERVAL = 60_000;
  const PREFERENCES_KEY = "betaGeneralPreferences";

  let enabled = true;
  let heartbeatId = null;
  let currentChannel = null;
  let currentPlatform = null;
  let trackingStartTime = null;   // wall-clock time of last channel switch
  let lastHeartbeatTime = null;   // wall-clock time of last successful heartbeat

  // ── Platform & channel detection ──

  function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes("twitch.tv")) return "twitch";
    if (host.includes("kick.com")) return "kick";
    return null;
  }

  const IGNORED_ROUTES = {
    twitch: new Set([
      "directory", "settings", "subscriptions", "drops",
      "wallet", "u", "search", "videos", "moderator",
      "inventory", "friends",
    ]),
    kick: new Set([
      "categories", "following", "search", "dashboard",
    ]),
  };

  function extractChannel() {
    const platform = detectPlatform();
    if (!platform) return null;

    const path = window.location.pathname.split("/").filter(Boolean);
    if (path.length === 0) return null;

    const segment = path[0].toLowerCase();
    if (!segment || segment.length > 60) return null;

    if (IGNORED_ROUTES[platform]?.has(segment)) return null;

    return { platform, channel: segment };
  }

  // ── Messaging ──

  function safeSend(msg) {
    try {
      chrome.runtime.sendMessage(msg).catch(() => {});
    } catch (_) {
      // Extension context invalidated (reloaded) — ignore
    }
  }

  // ── Heartbeat ──

  function sendHeartbeat() {
    if (!currentChannel || !currentPlatform) return;
    lastHeartbeatTime = Date.now();
    safeSend({
      type: "trackWatchTime",
      channel: currentChannel,
      platform: currentPlatform,
      seconds: Math.round(HEARTBEAT_INTERVAL / 1000),
    });
  }

  // ── Tracking lifecycle ──

  function startTracking() {
    if (heartbeatId) return;

    const info = extractChannel();
    if (info) {
      currentChannel = info.channel;
      currentPlatform = info.platform;
    }

    trackingStartTime = Date.now();
    lastHeartbeatTime = Date.now();

    // Presence ping — records channel start, no seconds
    if (currentChannel && currentPlatform) {
      safeSend({
        type: "trackWatchTime",
        channel: currentChannel,
        platform: currentPlatform,
        seconds: 0,
      });
    }

    heartbeatId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
  }

  function stopTracking() {
    if (heartbeatId) {
      clearInterval(heartbeatId);
      heartbeatId = null;
    }
    currentChannel = null;
    currentPlatform = null;
    trackingStartTime = null;
    lastHeartbeatTime = null;
  }

  // ── URL change detection (SPA) ──

  let lastUrl = window.location.href;

  function checkUrlChange() {
    const url = window.location.href;
    if (url === lastUrl) return;
    lastUrl = url;

    const info = extractChannel();
    if (info) {
      if (info.channel !== currentChannel || info.platform !== currentPlatform) {
        currentChannel = info.channel;
        currentPlatform = info.platform;

        // Reset timestamps for the new channel
        trackingStartTime = Date.now();
        lastHeartbeatTime = Date.now();

        safeSend({
          type: "trackWatchTime",
          channel: currentChannel,
          platform: currentPlatform,
          seconds: 0,
        });
      }
    } else {
      currentChannel = null;
      currentPlatform = null;
      trackingStartTime = null;
      lastHeartbeatTime = null;
    }
  }

  // ── Save partial time on page close ──

  window.addEventListener("beforeunload", () => {
    if (!currentChannel || !currentPlatform || !lastHeartbeatTime) return;
    // Seconds elapsed since the last heartbeat (partial interval)
    const elapsed = Math.round((Date.now() - lastHeartbeatTime) / 1000);
    if (elapsed >= 5) {
      safeSend({
        type: "trackWatchTime",
        channel: currentChannel,
        platform: currentPlatform,
        seconds: elapsed,
      });
    }
  });

  // ── Settings ──

  function loadSettings() {
    chrome.storage.local.get([PREFERENCES_KEY], (result) => {
      if (chrome.runtime.lastError) return;
      const prefs = result[PREFERENCES_KEY] || {};
      enabled = prefs.watchTimeTracker !== false;
      if (enabled) {
        startTracking();
      } else {
        stopTracking();
      }
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[PREFERENCES_KEY]) {
      loadSettings();
    }
  });

  // ── Init ──
  setTimeout(() => {
    loadSettings();
    setInterval(checkUrlChange, 2000);
  }, 1500);
})();
