/**
 * StreamPulse hover previews entry pour Kick (content script).
 *
 * Miroir de twitchPreviews.js : observer → targets-kick → card, avec la
 * différence Kick — le descripteur est complété par l'API de chaîne
 * (même origine : titre, catégorie, viewers, avatar, vignette fraîche)
 * AVANT l'affichage, et une chaîne inexistante n'affiche rien du tout.
 * Préférences partagées avec Twitch (previewsEnabled, mode, taille…).
 */
(function () {
  "use strict";

  if (window.top !== window) return;

  const NS = typeof self !== "undefined" ? self : globalThis;
  const SP = NS.__SP_PREVIEWS__;
  if (!SP || !SP.targets || !SP.observe || !SP.createPreviewCard) return;

  const PREFERENCES_KEY = "betaGeneralPreferences";

  const DEFAULTS = {
    enabled: true,
    mode: "image",
    size: "m",
    audioInVideo: false,
    unmuteOnHover: false,
    showDelayMs: 200,
    animations: true,
  };

  function mergePrefs(p) {
    p = p && typeof p === "object" ? p : {};
    return {
      enabled: p.previewsEnabled !== false,
      mode: p.previewsMode === "video" ? "video" : "image",
      size: ["s", "m", "l"].indexOf(p.previewsSize) >= 0 ? p.previewsSize : "m",
      audioInVideo: p.previewsAudio === true,
      unmuteOnHover: p.previewsUnmuteOnHover === true,
      showDelayMs: Number.isFinite(p.previewsShowDelayMs) ? p.previewsShowDelayMs : 200,
      animations: p.previewsAnimations !== false,
    };
  }

  let prefs = DEFAULTS;
  let card = null;
  let detachDelegation = null;
  let disconnectRoutes = null;
  let running = false;
  let lastAnchor = null;
  // Une lecture API par handle et par fenêtre de 60 s : survols répétés gratuits.
  const dataCache = new Map();

  function showOpts() {
    return {
      mode: prefs.mode,
      size: prefs.size,
      audio: prefs.audioInVideo,
      unmuteOnHover: prefs.unmuteOnHover,
      animations: prefs.animations,
    };
  }

  function onEnter(anchor) {
    try {
      const descriptor = SP.targets.extractFromAnchor(anchor, location);
      if (!descriptor) return;
      lastAnchor = anchor;

      // Kick : données de chaîne AVANT l'affichage — si la chaîne n'existe
      // pas, rien ne s'affiche (pas de carte fantôme sur un lien quelconque).
      const cached = dataCache.get(descriptor.login);
      const pending = cached
        ? Promise.resolve(cached.data)
        : SP.sources.kickChannelData(descriptor.login).then(function (data) {
            dataCache.set(descriptor.login, { data, at: Date.now() });
            return data;
          });

      pending
        .then(function (data) {
          if (!data) return; // chaîne inexistante
          if (dataCache.get(descriptor.login)?.at && Date.now() - dataCache.get(descriptor.login).at > 60000) {
            dataCache.delete(descriptor.login);
          }
          if (!lastAnchor || lastAnchor !== anchor || !card) return;
          descriptor.title = data.title || descriptor.title;
          descriptor.category = data.game || descriptor.category;
          descriptor.viewers = data.viewers ? String(data.viewers) : "";
          descriptor.avatarUrl = data.avatarUrl || "";
          descriptor.thumbnailUrl = data.thumbnailUrl || descriptor.thumbnailUrl;
          card.show(anchor, descriptor, showOpts());
        })
        .catch(function () {
          /* never throw into the page */
        });
    } catch (_e) {
      /* never throw into the page */
    }
  }

  function onLeave() {
    lastAnchor = null;
    if (card) card.hide();
  }

  function start() {
    if (running) return;
    running = true;
    card = SP.createPreviewCard();
    card.mount();
    detachDelegation = SP.observe.attachDelegation(
      document.body,
      { findAnchor: SP.targets.findAnchor, onEnter, onLeave },
      { showDelayMs: prefs.showDelayMs }
    );
    disconnectRoutes = SP.observe.observeRouteChanges(onLeave);
  }

  function stop() {
    if (!running) return;
    running = false;
    if (detachDelegation) detachDelegation();
    if (disconnectRoutes) disconnectRoutes();
    if (card) card.destroy();
    detachDelegation = disconnectRoutes = card = null;
  }

  function apply(nextPrefs) {
    const wasRunning = running;
    const showDelayChanged = prefs.showDelayMs !== nextPrefs.showDelayMs;
    prefs = nextPrefs;
    if (!prefs.enabled) {
      stop();
      return;
    }
    if (!wasRunning) {
      start();
    } else if (showDelayChanged) {
      if (detachDelegation) detachDelegation();
      detachDelegation = SP.observe.attachDelegation(
        document.body,
        { findAnchor: SP.targets.findAnchor, onEnter, onLeave },
        { showDelayMs: prefs.showDelayMs }
      );
    }
  }

  function load() {
    chrome.storage.local.get([PREFERENCES_KEY], function (result) {
      apply(mergePrefs((result && result[PREFERENCES_KEY]) || {}));
    });
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === "local" && changes[PREFERENCES_KEY]) {
      apply(mergePrefs(changes[PREFERENCES_KEY].newValue || {}));
    }
  });

  load();
})();
