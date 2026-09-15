(() => {
  "use strict";

  // Watch Time Tracker: tracks per-channel watch time.
  // Heartbeat every 60s; partial seconds captured on page close via pagehide.

  if (window.top !== window) return; // skip iframes

  const HEARTBEAT_INTERVAL = 60_000;
  const PREFERENCES_KEY = "betaGeneralPreferences";

  let enabled = true;
  let heartbeatId = null;
  let currentChannel = null;
  let currentPlatform = null;
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

  // ── Categorie du live (recap avance) ──

  const GAME_SELECTORS = {
    twitch: ['[data-a-target="stream-game-link"]', 'a[href^="/directory/category/"]'],
    kick: ['a[href^="/category/"]', 'a[href*="/categories/"]'],
  };

  /** Jeu affiche sous le lecteur ; chaine vide si la page ne l'indique pas. */
  function currentGame() {
    try {
      for (const selector of GAME_SELECTORS[currentPlatform] || []) {
        const text = document.querySelector(selector)?.textContent?.trim();
        if (text) return text.slice(0, 80);
      }
    } catch {
      // Le DOM de la plateforme change sans prevenir : le background prendra le relais.
    }
    return "";
  }

  // ── Messaging ──

  function safeSend(msg) {
    try {
      chrome.runtime.sendMessage(msg).catch(() => {});
    } catch (_) {
      // Extension context invalidated (reloaded): ignore
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
      game: currentGame(),
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

    lastHeartbeatTime = Date.now();

    // Presence ping: records channel start, no seconds
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
      lastHeartbeatTime = null;
    }
  }

  // ── Save partial time on page close ──

  // pagehide plutot que beforeunload : beforeunload peut empecher Chrome de garder
  // la page dans le cache precedent/suivant (retour arriere instantane).
  window.addEventListener("pagehide", () => {
    if (!currentChannel || !currentPlatform || !lastHeartbeatTime) return;
    // Seconds elapsed since the last heartbeat (partial interval)
    const elapsed = Math.round((Date.now() - lastHeartbeatTime) / 1000);
    if (elapsed >= 5) {
      safeSend({
        type: "trackWatchTime",
        channel: currentChannel,
        platform: currentPlatform,
        seconds: elapsed,
        game: currentGame(),
      });
    }
    // La page peut revenir depuis le cache : repartir de maintenant evite de
    // compter deux fois l'intervalle deja envoye.
    lastHeartbeatTime = Date.now();
  });

  // ── Settings ──

  function loadSettings() {
    try {
      if (!chrome.runtime?.id) return;
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
    } catch {
      // Extension context invalidated, ignore
    }
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
