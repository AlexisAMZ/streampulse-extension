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
    if (host.endsWith("youtube.com")) return "youtube";
    return null;
  }

  // Routes système de Kick. Sur Twitch, la liste partagée de js/inject/dom.js
  // fait foi (popout compris) ; Kick garde sa propre liste, plus courte : un
  // login légitime homonyme d'une route Twitch ne doit pas être filtré.
  // « video » : les pages de VOD (/video/<id>), qui ne sont pas des lives.
  const KICK_IGNORED_ROUTES = new Set(["categories", "following", "search", "dashboard", "video"]);

  function extractChannel() {
    const platform = detectPlatform();
    if (!platform) return null;

    const path = window.location.pathname.split("/").filter(Boolean);
    if (path.length === 0) return null;

    if (platform === "youtube") return youtubeChannel(path);

    const segment = path[0].toLowerCase();
    if (!segment || segment.length > 60) return null;

    if (platform === "kick" && KICK_IGNORED_ROUTES.has(segment)) return null;
    // dom.js n'est injecté que sur Twitch (accès optionnel : ce script tourne aussi sur Kick).
    if (platform === "twitch" && window.__SP_DOM__?.isChannelLogin(segment) === false) return null;

    return { platform, channel: segment };
  }

  /**
   * La lecture en cours est-elle un direct YouTube ? Le lecteur porte la
   * classe ytp-live tant qu'il joue un direct (DVR compris) et jamais sur une
   * vidéo normale ni un VOD. Les autres pistes sont des pièges : le badge « En
   * direct » existe, caché, dans toutes les pages watch, la durée d'un direct
   * avec DVR vaut sa fenêtre (pas Infinity), et le chat peut être absent
   * (commentaires coupés, rendu tardif).
   */
  function youtubeIsLive() {
    if (!document.querySelector(".ytp-live")) return false;
    // Garde-fou : le badge « En direct » reste dans le DOM mais masqué sur une vidéo normale. S'il existe
    // et n'est pas affiché, ce n'est pas un direct.
    const badge = document.querySelector(".ytp-live-badge");
    return !badge || badge.offsetParent !== null;
  }

  /**
   * Chaîne YouTube : @handle ou /channel/ID dans l'URL ; sinon (page watch d'un
   * direct) le lien de la chaîne dans le DOM. Seuls les directs comptent : une
   * vidéo normale ou un VOD ne doit rien ajouter au temps de visionnage.
   */
  function youtubeChannel(path) {
    if (!youtubeIsLive()) return null;
    const first = (path[0] || "").toLowerCase();
    const fromUrl = first.startsWith("@")
      ? first.slice(1)
      : first === "channel"
        ? (path[1] || "").toLowerCase()
        : "";
    if (fromUrl) return { platform: "youtube", channel: fromUrl };
    const href = document.querySelector("#channel-name a[href], ytd-channel-name a[href]")?.getAttribute("href") || "";
    const handle = /\/@([\w.-]{1,60})/.exec(href)?.[1] || /\/channel\/(UC[\w-]{1,60})/.exec(href)?.[1] || "";
    return handle ? { platform: "youtube", channel: handle.toLowerCase() } : null;
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
      chrome.runtime.sendMessage(msg).catch(() => {}); // SW endormi ou contexte invalidé : échec attendu.
    } catch (_) {
      // Extension context invalidated (reloaded): ignore
    }
  }

  // ── Heartbeat ──

  /**
   * Vrai seulement si l'utilisateur regarde réellement : onglet visible et
   * une vidéo en lecture. Sans cela, un onglet en arrière-plan ou un live en
   * pause comptait 60 secondes par minute, même sans rien regarder.
   */
  function isActuallyWatching() {
    if (document.visibilityState !== "visible") return false;
    for (const video of document.querySelectorAll("video")) {
      if (!video.paused && !video.ended && video.readyState >= 2) return true;
    }
    return false;
  }

  function sendHeartbeat() {
    if (!currentChannel || !currentPlatform) return;
    // Temps mort (onglet masqué, vidéo en pause) : la fenêtre partielle
    // repart de maintenant, pour ne rien compter rétroactivement.
    if (!isActuallyWatching()) {
      lastHeartbeatTime = Date.now();
      return;
    }
    // YouTube : seul un direct compte, revérifié à chaque pulsation — la
    // navigation interne passe du direct à la vidéo sous le même onglet.
    if (currentPlatform === "youtube" && !youtubeIsLive()) {
      lastHeartbeatTime = Date.now();
      return;
    }
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
    if (url === lastUrl) {
      // Même page : on ne refait la détection que si rien n'est suivi. Le
      // lecteur YouTube apparaît après l'URL : sans cette relance, un direct
      // ouvert directement resterait jamais compté.
      if (currentChannel) return;
    } else {
      lastUrl = url;
    }

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
    // YouTube : ne jamais solder la fenêtre partielle sur une vidéo ou un VOD,
    // même si le direct était suivi un instant plus tôt.
    if (currentPlatform === "youtube" && !youtubeIsLive()) return;
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
