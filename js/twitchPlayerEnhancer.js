(() => {
  const PREFERENCES_KEY = "betaGeneralPreferences";
  const AUTO_REFRESH_FIELD = "autoRefreshPlayerErrors";
  const FAST_FORWARD_FIELD = "enableFastForwardButton";

  const ERROR_CODES = ["1000", "2000", "3000", "4000", "5000"];
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
      renderInChatHeader: true,
    },

  };

  let extensionConfig = {
    clientId: "",
    accessToken: "",
    features: DEFAULT_FEATURE_CONFIG,
  };

  let autoRefreshEnabled = false;
  let errorCheckTimeoutId = null;
  let observedVideo = null;
  let videoAbortHandler = null;

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
  } catch (_e) {}

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

  function attemptRecovery() {
    const button = document.querySelector(
      ".content-overlay-gate__allow-pointers button"
    );
    if (button instanceof HTMLElement) {
      button.click();
    }

    window.setTimeout(() => {
      const video = findVideoElement();
      if (!video) return;
      if (video.paused) {
        video.play().catch(() => {});
      }
      window.setTimeout(() => {
        seekToBufferedEnd(video);
      }, 120);
    }, 2000);
  }

  function checkForPlayerErrors() {
    errorCheckTimeoutId = null;
    if (!autoRefreshEnabled) {
      return;
    }

    ensureVideoAbortListener();

    const gate = document.querySelector(
      'div[data-a-target="player-overlay-content-gate"]'
    );
    if (gate) {
      const text = (gate.textContent || "").toLowerCase();
      if (ERROR_CODES.some((code) => text.includes(code))) {
        attemptRecovery();
        scheduleErrorCheck(10000);
        return;
      }
    }

    scheduleErrorCheck(8000);
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
      if (autoRefreshEnabled) {
        scheduleErrorCheck(100);
      }
    };
    video.addEventListener("abort", videoAbortHandler);
  }

  function enableAutoRefresh() {
    if (autoRefreshEnabled) return;
    autoRefreshEnabled = true;
    ensureVideoAbortListener();
    scheduleErrorCheck(500);
  }

  function disableAutoRefresh() {
    autoRefreshEnabled = false;
    if (errorCheckTimeoutId != null) {
      clearTimeout(errorCheckTimeoutId);
      errorCheckTimeoutId = null;
    }
    detachVideoAbortListener();
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
        border-radius: 4px;
        color: #ffffff;
        cursor: pointer;
        display: inline-flex;
        width: 3rem;
        height: 3rem;
        padding: 0;
        margin: 0 6px 0 0;
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
        width: 100%;
        height: 100%;
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
      <svg viewBox="0 0 1024 1024" aria-hidden="true">
        <path d="M825.8 498 538.4 249.9c-10.7-9.2-26.4-.9-26.4 14v496.3c0 14.9 15.7 23.2 26.4 14L825.8 526c8.3-7.2 8.3-20.8 0-28zm-320 0L218.4 249.9c-10.7-9.2-26.4-.9-26.4 14v496.3c0 14.9 15.7 23.2 26.4 14L505.8 526c4.1-3.6 6.2-8.8 6.2-14 0-5.2-2.1-10.4-6.2-14z"></path>
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
    button.title = tooltip;
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
      } catch (_error) {}
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

  function applyPreferences(preferences = {}) {
    const shouldAutoRefresh = preferences[AUTO_REFRESH_FIELD] !== false;
    if (shouldAutoRefresh && !autoRefreshEnabled) {
      enableAutoRefresh();
    } else if (!shouldAutoRefresh && autoRefreshEnabled) {
      disableAutoRefresh();
    }

    const shouldFastForward = preferences[FAST_FORWARD_FIELD] !== false;
    if (shouldFastForward && !fastForwardEnabled) {
      enableFastForward();
    } else if (!shouldFastForward && fastForwardEnabled) {
      disableFastForward();
    }

    setHideTwitchExtensions(preferences.hideTwitchExtensions === true);
    setAutoCancelRaids(preferences.autoCancelRaids !== false);
    if (preferences.enablePredictionsPopup !== false) {
      ensurePredictionsButton();
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

  // Twitch routes whose first path segment is a feature name, not a login.
  const NON_CHANNEL_ROUTES = new Set([
    "directory", "settings", "drops", "downloads", "subscriptions", "wallet",
    "inventory", "friends", "u", "videos", "search", "prime", "turbo", "store",
    "jobs", "p",
  ]);

  function getCurrentChannel() {
    try {
      const segment = location.pathname.replace(/^\//, "").split("/")[0] || "";
      const candidate = segment.toLowerCase();
      if (!candidate || NON_CHANNEL_ROUTES.has(candidate)) return "";
      if (!/^[a-z0-9_]{3,25}$/.test(candidate)) return "";
      return candidate;
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
  const CANCEL_WORDS = /annuler|cancel|quitter|leave|refuser|decline|no thanks|cancelar|abbrechen/i;
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
   * comes first — clicking it would send the viewer to the raid instead of
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

  function checkAndCancelRaid() {
    if (Date.now() - lastCancelledRaidAt < 8000) return;

    const raidCancelBtn = findRaidCancelButton();
    if (raidCancelBtn instanceof HTMLElement) {
      const target = getRaidTarget();
      lastCancelledRaidAt = Date.now();
      raidCancelBtn.click();
      try {
        chrome.runtime.sendMessage({
          type: "incrementStat",
          stat: "raidsCancelled",
          value: 1,
          channel: getCurrentChannel(),
          raidTarget: target,
        }).catch(() => {});
      } catch (_) {}
    }
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

  const PREDICTIONS_BUTTON_ID = "streampulse-predictions-btn";
  function ensurePredictionsButton() {
    const header = document.querySelector('[data-a-target="chat-room-header"], .stream-chat-header');
    if (!header) return;
    let btn = document.getElementById(PREDICTIONS_BUTTON_ID);
    if (!btn) {
      btn = document.createElement("button");
      btn.id = PREDICTIONS_BUTTON_ID;
      btn.type = "button";
      btn.title = "Prédictions / Predictions";
      btn.style.cssText = "background:transparent;border:none;color:#dedee3;cursor:pointer;font-size:14px;padding:4px 8px;margin-right:4px;";
      btn.innerHTML = "🔮";
      btn.addEventListener("click", () => {
        const predWidget = document.querySelector('.community-prediction-highlight-header, [data-test-selector="prediction-widget"]');
        if (predWidget) {
          predWidget.scrollIntoView({ behavior: 'smooth' });
          predWidget.click();
        }
      });
      header.prepend(btn);
    }
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
      // import config.js directly — it was removed from web_accessible_resources
      // for CWS compliance, and the SW holds the live Vercel credentials.
      const loadedConfig =
        (await chrome.runtime.sendMessage({ type: "getConfig" })) || {};
      extensionConfig = {
        clientId: loadedConfig.clientId || "",
        accessToken: loadedConfig.accessToken || "",
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
        clientId: "",
        accessToken: "",
        features: DEFAULT_FEATURE_CONFIG,
      };
    }
  }

  class LatencyFeature {
    constructor(config = {}) {
      this.config = { ...DEFAULT_FEATURE_CONFIG.streamLatency, ...config };
      this.button = null;
      this.dot = null;
      this.text = null;
      this.header = null;
      this.observer = null;
      this.updateIntervalId = null;
      this.headerCheckIntervalId = null;
      this.locale = getLocaleKey();
    }

    start() {
      this.ensureHeader();
      // Check for header every 3s instead of MutationObserver on body (perf)
      if (this.headerCheckIntervalId == null) {
        this.headerCheckIntervalId = window.setInterval(() => this.ensureHeader(), 3000);
      }
      if (this.updateIntervalId == null) {
        this.updateIntervalId = window.setInterval(() => this.update(), 1000);
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

    findHeader() {
      const selectors = [
        ".stream-chat-header__left",
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
      this.header.appendChild(this.button);
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
      initPreferences();
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;

    if (isTopWindow) {
      if (autoRefreshEnabled) {
        scheduleErrorCheck(500);
      }
      if (fastForwardEnabled) {
        ensureFastForwardButton();
      }
      latencyFeature?.update(true);

    }
  });

  init();
})();
