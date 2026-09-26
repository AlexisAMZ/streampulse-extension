(() => {
  const PREFERENCES_KEY = "betaGeneralPreferences";
  const FAST_FORWARD_FIELD = "enableFastForwardButton";
  const AUTO_REFRESH_FIELD = "autoRefreshPlayerErrors";

  const FAST_FORWARD_BUTTON_ID = "streampulse-fast-forward-btn";
  const FAST_FORWARD_STYLE_ID = "streampulse-fast-forward-style";
  const SHARED_STYLE_ID = "streampulse-enhancer-styles";

  const isTopWindow = window.top === window;
  const storage = chrome?.storage?.local;

  const TWITCH_NON_STREAM_ROUTES = new Set([
    "", "directory", "settings", "subscriptions", "drops",
    "wallet", "u", "search", "videos", "moderator",
    "inventory", "friends", "following", "payments",
    "notifications", "privacy", "security", "squad",
  ]);

  function isStreamPage() {
    const path = window.location.pathname.split("/").filter(Boolean);
    if (path.length === 0) return false;
    return !TWITCH_NON_STREAM_ROUTES.has(path[0].toLowerCase());
  }

  const DEFAULT_FEATURE_CONFIG = {
    streamLatency: {
      enabled: true,
      autoRealignPlayer: true,
      // Position de l'indicateur : "viewers" (barre d'infos sous le lecteur,
      // defaut) ou "chat" (en-tete du tchat, a la place du titre). Surcharge
      // en dernier recours par la preference utilisateur latencyPlacement.
      placement: "viewers",
    },

  };

  // Seul `features` est consomme : ne pas demander (ni garder en memoire) les
  // identifiants Twitch du service worker, dont ce script n'a aucun usage.
  let extensionConfig = {
    features: DEFAULT_FEATURE_CONFIG,
  };

  let fastForwardEnabled = false;
  let fastForwardEnsureIntervalId = null;

  let sharedStylesInserted = false;
  let latencyFeature = null;


  function ensureSharedStyles() {
    if (sharedStylesInserted || document.getElementById(SHARED_STYLE_ID)) {
      sharedStylesInserted = true;
      return;
    }
    const style = document.createElement("style");
    style.id = SHARED_STYLE_ID;
    style.textContent = `
    .streampulse-latency-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 12px;
      color: #dedee3;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.2s ease;
      user-select: none;
      gap: 8px;
    }
    .streampulse-latency-button:hover {
      color: #ffffff;
      cursor: pointer;
      transform: translateY(-1px);
    }
    .streampulse-latency-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #888;
    }
    .streampulse-latency-button.is-live .streampulse-latency-dot {
      background-color: #ff4d4d;
    }
    .streampulse-latency-button.is-disabled {
      opacity: 0.4;
      cursor: default;
      transform: none;
      pointer-events: none;
    }
    .streampulse-latency-button.is-disabled:hover {
      color: #dedee3;
      transform: none;
    }
    .streampulse-latency-button.is-metadata {
      align-self: center;
      padding: 0 10px 0 0;
      font-size: 13px;
      gap: 6px;
    }
    .streampulse-latency-button.is-metadata:hover {
      transform: none;
    }
    .streampulse-latency-button.is-chat {
      padding: 0 6px;
      font-size: 12px;
      font-weight: 700;
      gap: 5px;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .streampulse-latency-button.is-chat:hover {
      transform: none;
    }
    .streampulse-chat-title-hidden {
      display: none !important;
    }
    .dPOHRS {
      padding-left: 40px !important;
    }

  `;
    document.head?.appendChild(style);
    sharedStylesInserted = true;
  }

  /**
   * Langue courante de l'extension.
   *
   * Lit la préférence utilisateur (stockée par le popup) plutôt que
   * document.documentElement.lang / navigator.language : ces derniers donnent la
   * langue de Twitch ou du navigateur, pas celle choisie dans StreamPulse. Le
   * cache évite un aller-retour storage à chaque rendu ; l'écouteur plus bas le
   * met à jour quand l'utilisateur change de langue.
   */
  var currentLang = "en";

  function i18nApi() {
    return typeof window !== "undefined" ? window.__SP_I18N__ : null;
  }

  function getLocaleKey() {
    return currentLang;
  }

  /** Lit une clé inject.player.*, avec repli sur l'anglais. */
  function tr(key, params) {
    var api = i18nApi();
    if (!api) return key;
    return api.get(currentLang, "player." + key, params);
  }

  try {
    chrome.storage.local.get("betaGeneralPreferences", function (res) {
      var api = i18nApi();
      var stored = res && res.betaGeneralPreferences && res.betaGeneralPreferences.language;
      currentLang = api ? api.resolve(stored) : "en";
    });
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== "local" || !changes.betaGeneralPreferences) return;
      var api = i18nApi();
      var next = (changes.betaGeneralPreferences.newValue || {}).language;
      currentLang = api ? api.resolve(next) : "en";
    });
  } catch (_e) {
    // Service worker endormi, ou contexte d'extension invalide par une mise a jour : le message est perdu sans consequence ici.
  }

  function getFastForwardTexts() {
    return {
      tooltip: tr("skipToLive"),
      holdHint: tr("holdToFastForward"),
    };
  }

  function findVideoElement() {
    return (
      document.querySelector(".video-player video") ||
      document.querySelector("video")
    );
  }

  function seekToBufferedEnd(video) {
    if (!video) return;
    try {
      const ranges = video?.buffered?.length ?? 0;
      if (ranges > 0) {
        const end = video.buffered.end(ranges - 1);
        if (Number.isFinite(end)) {
          video.currentTime = end - 0.05;
        }
      }
    } catch (error) {
      console.warn("StreamPulse fast-forward seek error:", error);
    }
  }

  function computeLatencySeconds(video) {
    if (!video) return null;
    const buffered = video.buffered;
    if (!buffered || buffered.length === 0) return null;
    try {
      const end = buffered.end(buffered.length - 1);
      const latency = end - video.currentTime;
      if (Number.isFinite(latency) && latency >= 0) {
        return latency;
      }
    } catch (error) {
      console.warn("StreamPulse latency computation error:", error);
    }
    return null;
  }

  // Relance du lecteur sur erreur (codes 1000-5000, dont le fameux #2000).
  //
  // On clique « Reessayer » a la place de l'utilisateur. Si l'overlay n'offre
  // aucun bouton, ou si le clic n'a pas suffi au tour precedent, on recharge —
  // mais jamais sur un onglet cache (on attend son retour), jamais deux fois
  // pour la meme page, et jamais moins de 45 s apres un rechargement.
  //
  // Reglable : autoRefreshPlayerErrors, active par defaut. Une extension ne
  // doit pas imposer un rechargement de page sans laisser couper la fonction.

  const ERROR_GATE_SELECTOR =
    '[data-a-target="player-overlay-content-gate"], .content-overlay-gate';
  const ERROR_CODES = ["1000", "2000", "3000", "4000", "5000"];
  const RETRY_GRACE_MS = 6000;
  const RETRY_POLL_MS = 4000;

  const RELOAD_STAMP_KEY = "streampulsePlayerReloadAt";
  const RELOAD_COOLDOWN_MS = 45000;

  let errorCheckTimeoutId = null;
  let observedVideo = null;
  let videoAbortHandler = null;
  let retryClickAttempted = false;
  // Faux au depart : c'est setAutoRefresh(), appele par applyPreferences au
  // chargement des reglages, qui demarre reellement la detection. Le mettre a
  // vrai ici ferait sortir setAutoRefresh par son garde d'egalite, et plus
  // rien n'aurait jamais lance le sondage.
  let autoRefreshEnabled = false;
  let reloadPendingUntilVisible = false;
  let reloadAttempted = false;

  function hasPlayerError() {
    const gate = document.querySelector(ERROR_GATE_SELECTOR);
    if (!gate) return false;
    const text = gate.textContent || "";
    return ERROR_CODES.some((code) => text.includes(code));
  }

  function clickRetryButton() {
    const button = document.querySelector(`${ERROR_GATE_SELECTOR} button`);
    if (button instanceof HTMLElement) {
      button.click();
      return true;
    }
    return false;
  }

  /** Dernier recours : recharger, sous trois garde-fous cumules. */
  function reloadPlayerPage() {
    if (document.hidden) {
      // Recharger un onglet que personne ne regarde couperait un stream
      // ecoute en fond : on attend son retour au premier plan.
      reloadPendingUntilVisible = true;
      return;
    }
    reloadPendingUntilVisible = false;
    if (reloadAttempted) return;
    reloadAttempted = true;
    try {
      // sessionStorage survit au rechargement : c'est lui qui empeche la boucle.
      const last = Number(sessionStorage.getItem(RELOAD_STAMP_KEY)) || 0;
      if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
      sessionStorage.setItem(RELOAD_STAMP_KEY, String(Date.now()));
    } catch (_error) {
      return; // Stockage bloque : pas de garde-fou, donc pas de rechargement.
    }
    window.location.reload();
  }

  function attemptRecovery() {
    // Un seul clic par erreur : si le lecteur re-affiche l'overlay, le tour
    // de sondage suivant passera au rechargement. Re-cliquer en boucle sur un
    // bouton qui ne repond pas ne sert a rien.
    if (!retryClickAttempted) {
      retryClickAttempted = clickRetryButton();
      if (!retryClickAttempted) {
        // Overlay sans bouton : le clic est impossible, on recharge.
        reloadPlayerPage();
        return;
      }
    } else {
      // Le clic du tour precedent n'a pas suffi.
      reloadPlayerPage();
      return;
    }

    window.setTimeout(() => {
      const video = findVideoElement();
      if (video?.paused) {
        video.play().catch(() => {});
      }
      window.setTimeout(() => seekToBufferedEnd(video), 120);
    }, RETRY_GRACE_MS);
  }

  function checkForPlayerErrors() {
    errorCheckTimeoutId = null;
    if (!autoRefreshEnabled) return;
    ensureVideoAbortListener();

    if (hasPlayerError()) {
      attemptRecovery();
      scheduleErrorCheck(RETRY_GRACE_MS + RETRY_POLL_MS);
      return;
    }

    retryClickAttempted = false;
    scheduleErrorCheck(RETRY_POLL_MS);
  }

  function scheduleErrorCheck(delay = 2000) {
    if (!autoRefreshEnabled) return;
    if (errorCheckTimeoutId != null) {
      clearTimeout(errorCheckTimeoutId);
    }
    errorCheckTimeoutId = window.setTimeout(checkForPlayerErrors, delay);
  }

  function detachVideoAbortListener() {
    if (observedVideo && videoAbortHandler) {
      observedVideo.removeEventListener("abort", videoAbortHandler);
    }
    observedVideo = null;
    videoAbortHandler = null;
  }

  function ensureVideoAbortListener() {
    const video = findVideoElement();
    if (!video || observedVideo === video) {
      return;
    }
    detachVideoAbortListener();
    observedVideo = video;
    videoAbortHandler = () => {
      scheduleErrorCheck(100);
    };
    video.addEventListener("abort", videoAbortHandler);
  }

  function insertFastForwardStyle() {
    if (document.getElementById(FAST_FORWARD_STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = FAST_FORWARD_STYLE_ID;
    style.textContent = `
      #${FAST_FORWARD_BUTTON_ID} {
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        border-radius: 9000px;
        color: #ffffff;
        cursor: pointer;
        display: inline-flex;
        width: 32px;
        height: 32px;
        padding: 0;
        margin: 0 4px 0 0;
        background-repeat: no-repeat;
        background-size: contain;
        transition: background-color 0.2s ease, color 0.2s ease;
      }
      #${FAST_FORWARD_BUTTON_ID}:hover {
        background-color: rgba(255, 255, 255, 0.2);
      }
      #${FAST_FORWARD_BUTTON_ID}:focus-visible {
        outline: 2px solid rgba(255, 255, 255, 0.8);
        outline-offset: 2px;
      }
      #${FAST_FORWARD_BUTTON_ID}:active {
        background-color: rgba(38, 38, 38, 1);
      }
      #${FAST_FORWARD_BUTTON_ID} svg {
        width: 20px;
        height: 20px;
        display: block;
        pointer-events: none;
        fill: currentColor;
      }
    `;
    document.head?.appendChild(style);
  }

  function createFastForwardButton() {
    insertFastForwardStyle();

    let button = document.getElementById(FAST_FORWARD_BUTTON_ID);
    const texts = getFastForwardTexts();
    const tooltip = `${texts.tooltip} (Z)\n${texts.holdHint}`;
    if (!(button instanceof HTMLButtonElement)) {
      button = document.createElement("button");
      button.id = FAST_FORWARD_BUTTON_ID;
      button.type = "button";
      button.className = "streampulse-fast-forward-button";
      button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 5.5v13l8-6.5-8-6.5Zm9 0v13l8-6.5-8-6.5Z"></path>
        <path d="M21 5h2v14h-2V5Z"></path>
      </svg>
    `;

      let holdTimeoutId = null;
      let pointerId = null;
      let isHolding = false;
      let acceleratedVideo = null;
      let skipHandledByPointer = false;

      const clearAcceleration = () => {
        if (acceleratedVideo) {
          acceleratedVideo.playbackRate = 1;
          acceleratedVideo = null;
        }
      };

      const performSkipToLive = () => {
        const video = findVideoElement();
        if (!video) return;
        seekToBufferedEnd(video);
        if (video.paused) {
          video.play().catch(() => {});
        }
      };

      const handlePointerDown = (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) {
          return;
        }
        pointerId = event.pointerId;
        isHolding = false;
        skipHandledByPointer = false;
        holdTimeoutId = window.setTimeout(() => {
          const video = findVideoElement();
          if (!video) {
            return;
          }
          acceleratedVideo = video;
          isHolding = true;
          video.play().catch(() => {});
          video.playbackRate = 2;
        }, 500);
        button.setPointerCapture?.(pointerId);
      };

      const handlePointerUp = (event) => {
        if (pointerId != null && event.pointerId !== pointerId) {
          return;
        }
        if (holdTimeoutId != null) {
          clearTimeout(holdTimeoutId);
          holdTimeoutId = null;
        }
        if (isHolding) {
          clearAcceleration();
        } else {
          performSkipToLive();
          skipHandledByPointer = true;
        }
        isHolding = false;
        pointerId = null;
        button.releasePointerCapture?.(event.pointerId);
      };

      const handlePointerCancel = () => {
        if (holdTimeoutId != null) {
          clearTimeout(holdTimeoutId);
          holdTimeoutId = null;
        }
        isHolding = false;
        clearAcceleration();
        if (pointerId != null) {
          button.releasePointerCapture?.(pointerId);
          pointerId = null;
        }
      };

      button.addEventListener("pointerdown", handlePointerDown);
      button.addEventListener("pointerup", handlePointerUp);
      button.addEventListener("pointerleave", handlePointerCancel);
      button.addEventListener("pointercancel", handlePointerCancel);

      button.addEventListener("click", (event) => {
        if (skipHandledByPointer) {
          skipHandledByPointer = false;
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        performSkipToLive();
      });
    }
    button.setAttribute("aria-label", texts.tooltip);
    button.dataset.spLabel = tooltip;
    window.__SP_TIP__?.attach(button, () => button.dataset.spLabel || "");
    return button;
  }

  function ensureFastForwardButton() {
    if (!fastForwardEnabled) return;
    const player = document.querySelector('div[data-a-target="video-player"]');
    const controls = player?.querySelector(
      ".player-controls__left-control-group"
    );
    if (!controls) {
      return;
    }
    const button = createFastForwardButton();
    if (button.parentElement && button.parentElement !== controls) {
      button.parentElement.removeChild(button);
    }
    const playPauseButton = controls.querySelector(
      '[data-a-target="player-play-pause-button"]'
    );
    const findDirectChild = (element, container) => {
      let current = element;
      while (current && current.parentElement && current.parentElement !== container) {
        current = current.parentElement;
      }
      return current && current.parentElement === container ? current : null;
    };

    let anchor = playPauseButton ? findDirectChild(playPauseButton, controls) : null;
    if (anchor && anchor !== button) {
      try {
        controls.insertBefore(button, anchor);
        return;
      } catch (_error) {
        // Twitch reconstruit son DOM en permanence : le noeud peut disparaitre entre sa selection et son usage.
      }
    }

    if (!controls.contains(button)) {
      const firstControl = controls.firstElementChild;
      if (firstControl && firstControl !== button) {
        try {
          controls.insertBefore(button, firstControl);
        } catch (_error) {
          controls.appendChild(button);
        }
      } else {
        controls.appendChild(button);
      }
    }
  }

  function enableFastForward() {
    if (fastForwardEnabled) return;
    fastForwardEnabled = true;
    ensureFastForwardButton();
    if (fastForwardEnsureIntervalId == null) {
      fastForwardEnsureIntervalId = window.setInterval(
        ensureFastForwardButton,
        4000
      );
    }
  }

  function disableFastForward() {
    fastForwardEnabled = false;
    if (fastForwardEnsureIntervalId != null) {
      clearInterval(fastForwardEnsureIntervalId);
      fastForwardEnsureIntervalId = null;
    }
    const button = document.getElementById(FAST_FORWARD_BUTTON_ID);
    if (button?.parentElement) {
      button.parentElement.removeChild(button);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     VOLUME BOOST
     Le slider natif s'arrête à 100 % ; la zone StreamPulse greffée
     à sa droite prolonge la course jusqu'à 200 % : le remplissage
     passe du vert LCD à l'orange puis au rouge. À la souris : glisser
     dans la zone ou molette. Au clavier : flèches / Début / Fin.
     L'amplification elle-même est un GainNode Web Audio branché sur
     le <video> ; le volume natif continue de s'appliquer en amont.
     ══════════════════════════════════════════════════════════════ */

  const VOLUME_BOOST_FIELD = "playerVolumeBoost";
  const BOOST_BUTTON_ID = "streampulse-volume-boost-btn";
  const BOOST_STYLE_ID = "streampulse-volume-boost-style";
  const BOOST_MAX = 2.0;

  let volumeBoostEnabled = false;
  let boostEnsureIntervalId = null;
  let boostLevel = 1.0;
  let lastBoostLevel = 1.5;

  let boostAudioCtx = null;
  let boostSourceNode = null;
  let boostGainNode = null;
  let boostWiredVideo = null;

  function insertBoostStyles() {
    if (document.getElementById(BOOST_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = BOOST_STYLE_ID;
    style.textContent = `
    /* Typo de marque StreamPulse (Onest), chargée depuis le paquet. */
    @font-face {
      font-family: "SP Onest";
      font-weight: 400 700;
      font-display: swap;
      src: url("${chrome.runtime.getURL("font/onest-latin-6.woff2")}") format("woff2");
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122;
    }
    @font-face {
      font-family: "SP Onest";
      font-weight: 400 700;
      font-display: swap;
      src: url("${chrome.runtime.getURL("font/onest-latin-ext-5.woff2")}") format("woff2");
      unicode-range: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
    }
    /* Bouton « Boost » StreamPulse : fantôme comme les boutons du player
       Twitch (transparent, halo au survol), le mot en typo Onest. */
    .sp-vboost-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      flex: 0 0 auto;
      align-self: center;
      height: 30px;
      margin-left: 8px;
      padding: 0 7px;
      border: 0;
      border-radius: 0.4rem;
      background: transparent;
      color: #c4a3ff;
      font-family: "SP Onest", "Roboto", "Helvetica Neue", Helvetica, Arial, sans-serif;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.02em;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      cursor: pointer;
      transition: background-color 0.1s ease, color 0.1s ease;
      vertical-align: middle;
    }
    .sp-vboost-btn:hover { background: rgba(255, 255, 255, 0.1); color: #d9c2ff; }
    .sp-vboost-btn:focus-visible { outline: 2px solid #c6d4a0; outline-offset: 1px; }
    /* Niveau de boost : LCD vers 115 %, orange vers 150 %, rouge au-delà. */
    .sp-vboost-btn.is-low { color: #c6d4a0; }
    .sp-vboost-btn.is-mid { color: #ffb020; }
    .sp-vboost-btn.is-high { color: #ff4d4d; }
    .sp-vboost-pct { display: none; }
    .sp-vboost-btn.is-low .sp-vboost-pct,
    .sp-vboost-btn.is-mid .sp-vboost-pct,
    .sp-vboost-btn.is-high .sp-vboost-pct { display: inline; }
    @media (prefers-reduced-motion: reduce) {
      .sp-vboost-btn { transition: none; }
    }
    `;
    document.head?.appendChild(style);
  }

  function findVolumeSlider() {
    return (
      document.querySelector('[data-a-target="player-volume-slider"]') ||
      document.querySelector(".video-slider__slider-container") ||
      document.querySelector(".video-slider")
    );
  }

  /**
   * Point d'insertion stable : le bouton Paramètres du player
   * ([data-a-target="player-settings-button"]) vit dans la même rangée que le
   * volume, sur tous les players. « Boost » s'insère juste avant lui, donc
   * entre le volume et les autres contrôles. Repli : remonter depuis le
   * slider jusqu'au premier conteneur flex horizontal.
   */
  function findBoostAnchor(slider) {
    const settingsButton = document.querySelector('[data-a-target="player-settings-button"]');
    if (settingsButton?.parentElement) {
      return { row: settingsButton.parentElement, volumeBlock: settingsButton, before: true };
    }
    let node = slider;
    for (let depth = 0; depth < 5 && node.parentElement; depth++) {
      const parent = node.parentElement;
      const display = getComputedStyle(parent).display || "";
      const direction = getComputedStyle(parent).flexDirection || "row";
      if (parent.children.length > 1 && display.includes("flex") && !display.includes("inline") && direction === "row") {
        return { row: parent, volumeBlock: node, before: false };
      }
      node = parent;
    }
    return { row: null, volumeBlock: slider.parentElement, before: false };
  }

  function boostAriaLabel() {
    return tr("volumeBoostLabel");
  }

  function boostHintText() {
    return tr("volumeBoostHint");
  }

  function ensureBoostAudio(video) {
    // Routé une seule fois par élément vidéo : le volume natif de Twitch
    // s'applique toujours en amont du graphe, le gain ne fait qu'amplifier.
    if (typeof AudioContext === "undefined") return false;
    if (!boostAudioCtx) boostAudioCtx = new AudioContext();
    if (boostAudioCtx.state === "suspended") {
      boostAudioCtx.resume().catch(() => {});
    }
    if (boostWiredVideo === video && boostGainNode) {
      boostGainNode.gain.value = boostLevel;
      return true;
    }
    try {
      boostSourceNode?.disconnect();
      boostGainNode?.disconnect();
      boostSourceNode = boostAudioCtx.createMediaElementSource(video);
      boostGainNode = boostAudioCtx.createGain();
      boostGainNode.gain.value = boostLevel;
      boostSourceNode.connect(boostGainNode);
      boostGainNode.connect(boostAudioCtx.destination);
      boostWiredVideo = video;
      return true;
    } catch (_error) {
      // MediaElementSource impossible (flux exotique) : le bouton reste
      // mais le son n'est pas amplifié.
      boostWiredVideo = null;
      boostGainNode = null;
      return false;
    }
  }

  function renderBoostButton(button) {
    const pct = Math.round(boostLevel * 100);
    // Libellés rafraîchis au rendu : ils suivent les changements de langue.
    button.setAttribute("aria-label", boostAriaLabel());
    button.title = boostHintText();
    button.setAttribute("aria-pressed", boostLevel > 1.001 ? "true" : "false");
    button.classList.toggle("is-low", boostLevel > 1.001 && boostLevel <= 1.15);
    button.classList.toggle("is-mid", boostLevel > 1.15 && boostLevel <= 1.5);
    button.classList.toggle("is-high", boostLevel > 1.5);
    const pctEl = button.querySelector(".sp-vboost-pct");
    pctEl.textContent = `+${pct - 100} %`;
  }

  function setBoostLevel(value) {
    boostLevel = Math.min(BOOST_MAX, Math.max(1, value));
    if (boostLevel > 1.001) lastBoostLevel = boostLevel;
    const video = findVideoElement();
    if (boostLevel > 1.001 && video) {
      ensureBoostAudio(video);
    } else if (boostGainNode) {
      boostGainNode.gain.value = 1;
    }
    const button = document.getElementById(BOOST_BUTTON_ID);
    if (button) renderBoostButton(button);
  }

  function toggleBoost() {
    setBoostLevel(boostLevel > 1.001 ? 1 : lastBoostLevel);
  }

  function wireBoostButton(button) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleBoost();
    });
    button.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        setBoostLevel(boostLevel + (event.deltaY < 0 ? 0.1 : -0.1));
      },
      { passive: false }
    );
    button.addEventListener("keydown", (event) => {
      const steps = { ArrowRight: 0.1, ArrowUp: 0.1, ArrowLeft: -0.1, ArrowDown: -0.1 };
      if (event.key in steps) {
        event.preventDefault();
        event.stopPropagation();
        setBoostLevel(boostLevel + steps[event.key]);
      } else if (event.key === "Home") {
        event.preventDefault();
        setBoostLevel(1);
      } else if (event.key === "End") {
        event.preventDefault();
        setBoostLevel(BOOST_MAX);
      }
    });
  }

  function ensureVolumeBoostButton() {
    if (!volumeBoostEnabled || !isStreamPage()) return;
    const slider = findVolumeSlider();
    if (!slider) return;
    let button = document.getElementById(BOOST_BUTTON_ID);
    if (!button) {
      insertBoostStyles();
      button = document.createElement("button");
      button.id = BOOST_BUTTON_ID;
      button.type = "button";
      button.className = "sp-vboost-btn";
      button.setAttribute("aria-pressed", "false");
      /* Le mot « Boost » dans la typo StreamPulse : reconnaissable de tous
         les players, compris dans toutes les langues. */
      button.innerHTML = '<span class="sp-vboost-word">Boost</span><span class="sp-vboost-pct"></span>';
      wireBoostButton(button);
    }
    const anchor = findBoostAnchor(slider);
    const targetParent = anchor.row || anchor.volumeBlock.parentElement;
    const inPlace =
      button.parentElement === targetParent &&
      (anchor.before
        ? button.nextElementSibling === anchor.volumeBlock
        : button.previousElementSibling === anchor.volumeBlock);
    if (!inPlace) {
      // Avant le bouton Paramètres (même rangée que le volume, jamais dans
      // le wrapper du slider), ou après le bloc volume en repli.
      if (anchor.before) anchor.volumeBlock.before(button);
      else anchor.volumeBlock.after(button);
    }
    // Twitch peut recréer aussi l'élément <video> (changement de chaîne) :
    // on rebranche le graphe si l'élément amplifié n'est plus le bon.
    if (boostLevel > 1.001) {
      const video = findVideoElement();
      if (video && video !== boostWiredVideo) ensureBoostAudio(video);
    }
    renderBoostButton(button);
  }

  function enableVolumeBoost() {
    if (volumeBoostEnabled) return;
    volumeBoostEnabled = true;
    ensureVolumeBoostButton();
    if (boostEnsureIntervalId == null) {
      boostEnsureIntervalId = window.setInterval(ensureVolumeBoostButton, 4000);
    }
  }

  function disableVolumeBoost() {
    volumeBoostEnabled = false;
    if (boostEnsureIntervalId != null) {
      clearInterval(boostEnsureIntervalId);
      boostEnsureIntervalId = null;
    }
    document.getElementById(BOOST_BUTTON_ID)?.remove();
    if (boostGainNode) boostGainNode.gain.value = 1;
    boostLevel = 1;
  }

  function setVolumeBoost(enabled) {
    if (enabled) enableVolumeBoost();
    else disableVolumeBoost();
  }

  function setAutoRefresh(enabled) {
    if (enabled === autoRefreshEnabled) return;
    autoRefreshEnabled = enabled;
    if (enabled) {
      ensureVideoAbortListener();
      scheduleErrorCheck(500);
      return;
    }
    if (errorCheckTimeoutId != null) {
      clearTimeout(errorCheckTimeoutId);
      errorCheckTimeoutId = null;
    }
    detachVideoAbortListener();
  }

  function applyPreferences(preferences = {}) {
    setAutoRefresh(preferences[AUTO_REFRESH_FIELD] !== false);

    const shouldFastForward = preferences[FAST_FORWARD_FIELD] !== false;
    if (shouldFastForward && !fastForwardEnabled) {
      enableFastForward();
    } else if (!shouldFastForward && fastForwardEnabled) {
      disableFastForward();
    }

    setHideTwitchExtensions(preferences.hideTwitchExtensions === true);
    setAutoCancelRaids(preferences.autoCancelRaids === true);
    syncKeepQualityFlag(preferences.keepQualityInBackground === true);
    syncPlayerQuality(preferences.playerQuality);
    setVolumeBoost(preferences[VOLUME_BOOST_FIELD] !== false);
    // Position de l'indicateur de latence, appliquée sans rechargement.
    latencyFeature?.setPlacement(preferences.latencyPlacement);
  }

  // preventPause.js runs in the MAIN world and cannot read chrome.storage,
  // so the opt-in is mirrored into page localStorage. Applies on next load.
  const PLAYER_QUALITY_KEY = "streampulse:playerQuality";
  const PLAYER_QUALITIES = ["auto", "source", "1440", "1080", "720", "480", "360"];

  // playerQuality.js tourne dans le monde MAIN et ne lit pas chrome.storage :
  // le reglage transite par le localStorage de la page, applique sans rechargement.
  function syncPlayerQuality(value) {
    const quality = PLAYER_QUALITIES.includes(value) ? value : "auto";
    try {
      window.localStorage.setItem(PLAYER_QUALITY_KEY, quality);
      window.dispatchEvent(new Event("streampulse:quality-changed"));
    } catch (_error) {
      // Stockage bloque : Twitch garde la main sur la qualite.
    }
  }

  const KEEP_QUALITY_FLAG_KEY = "streampulse:keepQualityInBackground";
  function syncKeepQualityFlag(enable) {
    try {
      if (enable) {
        window.localStorage.setItem(KEEP_QUALITY_FLAG_KEY, "1");
      } else {
        window.localStorage.removeItem(KEEP_QUALITY_FLAG_KEY);
      }
    } catch (_error) {
      // Storage can be blocked (privacy mode): the feature simply stays off.
    }
  }

  const HIDE_EXTENSIONS_STYLE_ID = "streampulse-hide-extensions-style";
  function setHideTwitchExtensions(enable) {
    let style = document.getElementById(HIDE_EXTENSIONS_STYLE_ID);
    if (enable) {
      if (!style) {
        style = document.createElement("style");
        style.id = HIDE_EXTENSIONS_STYLE_ID;
        // Strictly target Twitch extensions overlays on video player (compatible with 7TV)
        style.textContent = `
          .extension-container,
          .extensions-dock-card,
          iframe.extension-frame,
          div[data-a-target="extension-overlay"],
          .extensions-video-overlay-size-container {
            display: none !important;
            pointer-events: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
          }
        `;
        document.head?.appendChild(style);
      }
    } else {
      if (style?.parentElement) {
        style.parentElement.removeChild(style);
      }
    }
  }

  let raidCheckIntervalId = null;
  let raidObserver = null;


  function getCurrentChannel() {
    try {
      const segment = location.pathname.replace(/^\//, "").split("/")[0] || "";
      // Liste canonique + test de login partages (js/inject/dom.js, charge
      // avant ce script via le manifest) : l'ancien plancher {3,25} rejetait
      // des logins courts legitimes.
      return window.__SP_DOM__.isChannelLogin(segment) ? segment.toLowerCase() : "";
    } catch (_) {
      return "";
    }
  }

  // Twitch renomme régulièrement ses data-a-target. On liste large, et on garde
  // un repli textuel pour ne pas dépendre d'un seul attribut interne.
  const RAID_BANNER_SELECTORS = [
    '[data-test-selector="raid-banner"]',
    '[data-a-target="raid-banner"]',
    ".raid-banner",
    '[class*="raid-banner"]',
    '[data-a-target*="raid-banner"]',
  ].join(", ");

  const CANCEL_SELECTORS =
    'button[data-a-target="cancel-raid-button"], [data-test-selector="raid-banner-cancel-button"]';
  // « Partir » est le libellé français du bouton « Leave » de la bannière de raid.
  const CANCEL_WORDS = /annuler|cancel|quitter|partir|leave|refuser|decline|no thanks|cancelar|salir|sair|abbrechen|verlassen/i;
  const JOIN_WORDS = /rejoindre|join|participer|go now|regarder|unirse|entrar|mitmachen/i;

  /**
   * La bannière de raid, reconnue par ses seuls attributs.
   *
   * Une version précédente balayait en plus tous les conteneurs de la page en
   * lisant leur textContent. Couplé à l'observateur ci-dessous, ça relançait une
   * sérialisation complète du DOM des dizaines de fois par seconde et figeait
   * l'onglet Twitch. Un `querySelector` sur une liste d'attributs suffit et
   * coûte un parcours indexé.
   */
  function findRaidBanner() {
    const el = document.querySelector(RAID_BANNER_SELECTORS);
    return el instanceof HTMLElement ? el : null;
  }

  /**
   * Read the raid target login from the banner ("... is raiding <target>").
   * @returns {string} the raided channel, or "" when unknown.
   */
  function getRaidTarget() {
    try {
      const banner = findRaidBanner();
      if (!banner) return "";
      const link = banner.querySelector('a[href^="/"]');
      const target = link?.getAttribute("href")?.replace(/^\//, "").split("/")[0];
      return target ? target.toLowerCase() : "";
    } catch (_) {
      return "";
    }
  }

  /**
   * Locate the raid *cancel* control specifically.
   *
   * `.raid-banner button` is deliberately not used as a blanket selector: the
   * banner also contains the "Join raid" button, and on some layouts that one
   * comes first: clicking it would send the viewer to the raid instead of
   * cancelling it, the exact opposite of the preference.
   */
  function findRaidCancelButton() {
    const direct = document.querySelector(CANCEL_SELECTORS);
    if (direct instanceof HTMLElement) return direct;

    // Rien en dehors de la bannière n'est cliquable. Une version précédente
    // cherchait « annuler » dans toute la page dès qu'aucune bannière n'était
    // trouvée : elle cliquait des boutons sans aucun rapport, dont celui des
    // Drops, en boucle.
    const banner = findRaidBanner();
    if (!banner) return null;

    return (
      Array.from(banner.querySelectorAll("button")).find((btn) => {
        const label = `${btn.getAttribute("aria-label") || ""} ${btn.textContent || ""}`
          .trim()
          .toLowerCase();
        // Match cancel/leave wording; never match join/go wording.
        if (JOIN_WORDS.test(label)) return false;
        return CANCEL_WORDS.test(label);
      }) || null
    );
  }

  // Un clic suffit. Sans ce garde, le sondage reclique tant que la bannière
  // n'a pas disparu du DOM, ce qui gonfle la statistique de raids annulés.
  let lastCancelledRaidAt = 0;

  // Amortisseur de l'observateur : au plus une vérification toutes les 300 ms,
  // quel que soit le nombre de mutations. La vérification elle-même se réduit à
  // deux querySelector, donc ce plafond est largement suffisant.
  let raidCheckScheduled = false;
  function scheduleRaidCheck() {
    if (raidCheckScheduled) return;
    raidCheckScheduled = true;
    setTimeout(() => {
      raidCheckScheduled = false;
      checkAndCancelRaid();
    }, 300);
  }

  // L'annulation automatique des raids n'a jamais pu etre confirmee en
  // conditions reelles : il faut tomber sur une chaine au moment precis ou
  // elle raide. Ces deux traces sont la pour qu'un vrai raid laisse une preuve
  // exploitable dans la console de l'onglet, au lieu de ne rien laisser.
  // Une seule fois par banniere, la verification tournant toutes les 2 s et a
  // chaque salve de mutations.
  let unmatchedBannerReported = false;

  function reportUnmatchedBanner(banner) {
    if (unmatchedBannerReported) return;
    unmatchedBannerReported = true;
    const labels = Array.from(banner.querySelectorAll("button")).map((btn) =>
      `${btn.getAttribute("aria-label") || ""} ${btn.textContent || ""}`.trim()
    );
    console.warn(
      "[SP] Banniere de raid detectee, aucun bouton d'annulation reconnu.",
      "Libelles presents :", labels
    );
  }

  function checkAndCancelRaid() {
    if (Date.now() - lastCancelledRaidAt < 8000) return;

    const raidCancelBtn = findRaidCancelButton();
    if (raidCancelBtn instanceof HTMLElement) {
      const target = getRaidTarget();
      lastCancelledRaidAt = Date.now();
      unmatchedBannerReported = false;
      raidCancelBtn.click();
      console.info("[SP] Raid annule.", { cible: target, chaine: getCurrentChannel() });
      try {
        chrome.runtime.sendMessage({
          type: "incrementStat",
          stat: "raidsCancelled",
          value: 1,
          channel: getCurrentChannel(),
          raidTarget: target,
        }).catch(() => {});
      } catch (_) {
        // Service worker endormi, ou contexte d'extension invalide par une mise a jour : le message est perdu sans consequence ici.
      }
      return;
    }

    // Le cas qui nous interesse : la banniere est bien la, mais aucun libelle
    // ne correspond. C'est ce que les expressions CANCEL_WORDS doivent couvrir.
    const banner = findRaidBanner();
    if (banner) reportUnmatchedBanner(banner);
    else unmatchedBannerReported = false;
  }

  function setAutoCancelRaids(enable) {
    if (enable) {
      if (!raidCheckIntervalId) {
        raidCheckIntervalId = setInterval(checkAndCancelRaid, 2000);
      }
      // Le sondage seul laissait passer jusqu'à deux secondes entre l'apparition
      // de la bannière et le clic. L'observateur raccourcit ce délai, mais il
      // doit être amorti : le chat Twitch mute plusieurs fois par seconde, et
      // déclencher la vérification à chaque mutation figeait l'onglet.
      if (!raidObserver) {
        raidObserver = new MutationObserver(scheduleRaidCheck);
        raidObserver.observe(document.body, { childList: true, subtree: true });
      }
      checkAndCancelRaid();
    } else {
      if (raidCheckIntervalId) {
        clearInterval(raidCheckIntervalId);
        raidCheckIntervalId = null;
      }
      if (raidObserver) {
        raidObserver.disconnect();
        raidObserver = null;
      }
    }
  }

  // Le bouton "prediction" injecte dans l'en-tete du tchat a ete retire.
  // Ce nettoyage evite qu'il subsiste dans les onglets ouverts avant la
  // mise a jour, ou le content script precedent l'avait deja pose.
  try {
    var legacy = document.getElementById("streampulse-predictions-btn");
    if (legacy) legacy.remove();
  } catch (_e) {
    // Twitch reconstruit son DOM en permanence : le noeud peut disparaitre entre sa selection et son usage.
  }

  function handleStorageChange(changes, areaName) {
    if (areaName !== "local" || !changes || !(PREFERENCES_KEY in changes)) {
      return;
    }
    const { newValue } = changes[PREFERENCES_KEY] || {};
    if (newValue) {
      applyPreferences(newValue);
    }
  }

  function initPreferences() {
    if (!isTopWindow) {
      return;
    }

    if (!storage) {
      applyPreferences({});
      return;
    }

    storage.get(PREFERENCES_KEY, (result) => {
      if (chrome.runtime?.lastError) {
        console.warn(
          "Twitch player enhancer preferences error:",
          chrome.runtime.lastError.message
        );
        applyPreferences({});
        return;
      }
      applyPreferences(result?.[PREFERENCES_KEY] || {});
    });

    if (chrome?.storage?.onChanged?.addListener) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }
  }

  function mergeFeatureConfig(defaults, overrides = {}) {
    const merged = { ...defaults };
    for (const key of Object.keys(overrides)) {
      const defaultSection = defaults[key] ?? {};
      const overrideSection = overrides[key] ?? {};
      merged[key] = { ...defaultSection, ...overrideSection };
    }
    return merged;
  }

  async function loadExtensionConfig() {
    try {
      // Request the resolved config from the service worker. We no longer
      // import config.js directly: it was removed from web_accessible_resources
      // for CWS compliance, and the SW holds the live Vercel credentials.
      const loadedConfig =
        (await chrome.runtime.sendMessage({ type: "getConfig" })) || {};
      extensionConfig = {
        features: mergeFeatureConfig(
          DEFAULT_FEATURE_CONFIG,
          loadedConfig.features || {}
        ),
      };
    } catch (error) {
      console.warn(
        "StreamPulse: unable to load config, using defaults.",
        error
      );
      extensionConfig = {
        features: DEFAULT_FEATURE_CONFIG,
      };
    }
  }

  class LatencyFeature {
    constructor(config = {}) {
      this.config = { ...DEFAULT_FEATURE_CONFIG.streamLatency, ...config };
      this.placement = config.placement === "chat" ? "chat" : "viewers";
      this.button = null;
      this.dot = null;
      this.text = null;
      this.header = null;
      this.chatTitle = null;
      this.observer = null;
      this.updateIntervalId = null;
      this.headerCheckIntervalId = null;
      this.locale = getLocaleKey();
    }

    /** Le réglage change sans rechargement : on ré-accroche au bon endroit. */
    setPlacement(value) {
      const next = value === "chat" ? "chat" : "viewers";
      if (next === this.placement) return;
      this.placement = next;
      this.detach();
      this.ensureHeader();
    }

    start() {
      this.ensureHeader();
      // Check for header every 3s instead of MutationObserver on body (perf)
      if (this.headerCheckIntervalId == null) {
        this.headerCheckIntervalId = window.setInterval(() => this.ensureHeader(), 3000);
      }
      if (this.updateIntervalId == null) {
        this.updateIntervalId = window.setInterval(() => {
          // Inutile de mesurer la latence quand l'onglet est en arrière-plan ;
          // au retour, update() recalcule tout depuis la vidéo, et le listener
          // visibilitychange ci-dessous rafraîchit immédiatement.
          if (!document.hidden) this.update();
        }, 1000);
        if (!this._visibilityBound) {
          this._visibilityBound = true;
          document.addEventListener("visibilitychange", () => {
            if (!document.hidden) this.update(true);
          });
        }
      }
      this.update(true);
    }

    stop() {
      if (this.headerCheckIntervalId != null) {
        clearInterval(this.headerCheckIntervalId);
        this.headerCheckIntervalId = null;
      }
      if (this.updateIntervalId != null) {
        clearInterval(this.updateIntervalId);
        this.updateIntervalId = null;
      }
      this.detach();
    }

    /**
     * Barre d'infos sous le lecteur : le conteneur qui aligne le nombre de
     * spectateurs et la duree du live. Repere par ".live-time", la seule classe
     * stable du lot (les autres sont generees par Twitch a chaque build).
     */
    findMetadataBar() {
      const liveTime = document.querySelector(".live-time");
      const holder = liveTime?.parentElement?.parentElement;
      return holder instanceof HTMLElement ? holder : null;
    }

    findHeader() {
      if (this.placement === "chat") {
        const chatHeader = this.findChatHeader();
        if (chatHeader) {
          this.headerMode = "chat";
          return chatHeader;
        }
        return null;
      }
      const metadata = this.findMetadataBar();
      if (metadata) {
        this.headerMode = "metadata";
        return metadata;
      }
      // Pas de repli croisé : l'en-tête du tchat et la barre d'infos ne
      // s'affichent pas au même moment au chargement, et un repli ferait
      // « téléporter » le bouton quelques secondes après son apparition.
      // Le sondage de 3 s réessaie jusqu'à ce que l'ancre choisie existe.
      return null;
    }

    /** En-tête du tchat : classes stables relevées sur twitch.tv. */
    findChatHeader() {
      const selectors = [
        ".stream-chat-header",
        '[data-a-target="chat-room-header"]',
        '[data-test-selector="chat-room-header"]',
      ];
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) return element;
      }
      return null;
    }

    /**
     * Le libellé « Chat du stream » que le bouton vient remplacer : premier
     * élément texte de l'en-tête qui n'est pas dans un bouton. L'icône est un
     * SVG (sans texte) et les commandes de droite sont des boutons, donc ce
     * repère reste juste quelle que soit la langue de l'interface.
     */
    findChatTitle(header) {
      for (const element of header.querySelectorAll("*")) {
        if (element.closest('button, [role="button"]')) continue;
        const directText = Array.from(element.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => String(node.textContent || "").trim())
          .join("");
        if (directText) return element;
      }
      return null;
    }

    ensureHeader() {
      const header = this.findHeader();
      if (!header) {
        this.detach();
        return;
      }
      if (this.header !== header) {
        this.detach();
        this.header = header;
        this.buildButton();
      } else if (!this.button) {
        this.buildButton();
      }
    }

    detach() {
      if (this.button?.parentElement) {
        this.button.parentElement.removeChild(this.button);
      }
      this.button = null;
      this.dot = null;
      this.text = null;
      // En mode chat, le titre « Chat du stream » était masqué : le rendre.
      if (this.chatTitle) {
        this.chatTitle.classList.remove("streampulse-chat-title-hidden");
        this.chatTitle = null;
      }
      this.header = null;
    }

    buildButton() {
      if (!this.header) return;
      this.button = document.createElement("button");
      this.button.type = "button";
      this.button.className = "streampulse-latency-button";

      this.dot = document.createElement("span");
      this.dot.className = "streampulse-latency-dot";

      this.text = document.createElement("span");
      this.text.className = "streampulse-latency-text";
      this.text.textContent = tr("latencyEmpty");

      this.button.append(this.dot, this.text);
      this.button.addEventListener("click", () => this.handleClick());
      if (this.headerMode === "metadata") {
        this.button.classList.add("is-metadata");
        this.header.insertBefore(this.button, this.header.firstElementChild);
      } else if (this.headerMode === "chat") {
        this.button.classList.add("is-chat");
        const title = this.findChatTitle(this.header);
        if (title) {
          this.chatTitle = title;
          title.classList.add("streampulse-chat-title-hidden");
          title.insertAdjacentElement("beforebegin", this.button);
        } else {
          // Structure inconnue : le badge se glisse à droite du titre.
          this.header.appendChild(this.button);
        }
      } else {
        this.header.appendChild(this.button);
      }
    }

    handleClick() {
      if (!this.button || this.button.classList.contains("is-disabled")) return;
      if (!this.config.autoRealignPlayer) return;
      const video = findVideoElement();
      if (!video) return;
      const latency = computeLatencySeconds(video);
      if (latency != null && latency > 0.25) {
        seekToBufferedEnd(video);
      }
      if (video.paused) {
        video.play().catch(() => {});
      }
      this.update(true);
    }

    update(force = false) {
      if (!this.button) {
        if (force) this.ensureHeader();
        return;
      }
      const video = findVideoElement();
      const latency = video ? computeLatencySeconds(video) : null;
      const isLive = Boolean(
        video &&
          (video.duration === Infinity || !Number.isFinite(video.duration)) &&
          !video.ended
      );

      if (!isLive) {
        this.button.classList.remove("is-live");
        this.button.classList.add("is-disabled");
        this.text.textContent = tr("offline");
        return;
      }

      this.button.classList.add("is-live");
      const canRealign =
        this.config.autoRealignPlayer &&
        latency != null &&
        latency > 0.25 &&
        video &&
        !video.paused;
      if (canRealign) {
        this.button.classList.remove("is-disabled");
      } else {
        this.button.classList.add("is-disabled");
      }

      if (latency == null) {
        this.text.textContent = tr("latencyEmpty");
      } else {
        const formatted = latency < 0.1 ? "0.0" : latency.toFixed(2);
        this.text.textContent = tr("latencyValue", { value: formatted });
      }
    }
  }





  async function init() {
    // Defensive guard: only initialize in the top frame. Latency button targets
    // chat header / video player which live in the top frame on Twitch.
    if (!isTopWindow) return;

    if (window.__streampulseEnhancerInitialized) {
      return;
    }
    window.__streampulseEnhancerInitialized = true;

    await loadExtensionConfig();

    const needsStyles = extensionConfig.features.streamLatency.enabled;
    if (needsStyles) {
      ensureSharedStyles();
    }

    if (extensionConfig.features.streamLatency.enabled && isStreamPage()) {
      latencyFeature = new LatencyFeature(
        extensionConfig.features.streamLatency
      );
      latencyFeature.start();
    }

    if (isTopWindow) {
      // La detection demarre via applyPreferences, selon le reglage.
      initPreferences();
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;

    if (isTopWindow) {
      if (autoRefreshEnabled && reloadPendingUntilVisible && hasPlayerError()) {
        reloadPlayerPage();
        return;
      }
      scheduleErrorCheck(500);
      if (fastForwardEnabled) {
        ensureFastForwardButton();
      }
      if (volumeBoostEnabled) {
        ensureVolumeBoostButton();
      }
      latencyFeature?.update(true);

    }
  });

  init();
})();
