(() => {
  // Kick Player Enhancer
  // Features: Fast Forward to Live, Latency Monitor (placement Twitch)

  // Top-frame guard: avoid duplicating intervals in sub-frames (perf).
  if (window.top !== window) return;

  const PREFERENCES_KEY = "betaGeneralPreferences";
  const FAST_FORWARD_ID = "streampulse-kick-fast-forward";
  const LATENCY_ID = "streampulse-kick-latency";

  let fastForwardEnabled = true;
  let intervalId = null;
  let latencyTimer = null;
  let headerTimer = null;

  // Même logique que chatFilter.js : on lit la langue choisie dans StreamPulse
  // plutôt que navigator.language, via le bundle inline injecté avant ce script.
  let currentLang = "en";
  const i18nApi = () => (typeof window !== "undefined" ? window.__SP_I18N__ : null);

  function jumpToLiveTitle() {
    const api = i18nApi();
    return api ? api.get(currentLang, "enhancer.jumpToLive") : "Jump to Live (StreamPulse)";
  }

  /**
   * Direct ? Infinity n'arrive que sur certains pipelines : le lecteur MSE de
   * Kick expose une durée = fin de fenêtre glissante. À plus de 8 s de cette
   * fin, on est sur un direct dont on a du retard (seul faux positif possible :
   * un VOD écouté dans ses 8 dernières secondes, transitoire).
   */
  function isLive(video) {
    if (!video) return false;
    if (video.duration === Infinity) return true;
    return Number.isFinite(video.duration) && video.duration - video.currentTime > 8;
  }

  /** Retard de la lecture sur l'arête de téléchargement, en secondes rondes. */
  function latencySeconds(video) {
    if (!video || !video.buffered.length) return 0;
    const delay = Math.round(video.buffered.end(video.buffered.length - 1) - video.currentTime);
    return delay > 0 ? delay : 0;
  }

  function latencyText(delay) {
    const api = i18nApi();
    return api
      ? api.get(currentLang, delay ? "player.latencyValue" : "player.latencyEmpty", { value: delay })
      : "";
  }

  // ─── Placement, comme sur Twitch ─────────────────────────────────────────────
  // « viewers » : badge fixé sur le lecteur. « chat » : le mot « Chat » de
  // l'en-tête du tchat est remplacé par la latence, texte repris à la fin.

  let latencyPlacement = "viewers";
  let chatTitleEl = null;
  let chatTitleText = "";

  function restoreChatTitle() {
    if (chatTitleEl && chatTitleEl.isConnected) chatTitleEl.textContent = chatTitleText;
    chatTitleEl = null;
    const badge = document.getElementById(LATENCY_ID);
    if (badge) badge.remove();
  }

  /**
   * Le titre « Chat » de l'en-tête du tchat : feuille de texte exacte, hors
   * boutons, dans la moitié droite de la page (le tchat est la colonne de
   * droite). Le scan complet reste borné : titres courts + feuilles seules.
   */
  function findChatTitle() {
    const candidates = [];
    for (const element of document.querySelectorAll("body *")) {
      if (element.closest("button, a, [role='button']")) continue;
      if (element.children.length) continue;
      const text = (element.textContent || "").trim();
      if (!/^(chat|tchat)$/i.test(text)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.left > window.innerWidth / 2) candidates.push(element);
    }
    return candidates.length ? candidates[candidates.length - 1] : null;
  }

  function updateLatency() {
    if (!(chrome.runtime && chrome.runtime.id)) return;
    const video = findVideo();
    const live = isLive(video);
    const delay = live ? latencySeconds(video) : 0;

    if (latencyPlacement === "chat") {
      hidePlayerBadge();
      if (!chatTitleEl || !chatTitleEl.isConnected) {
        chatTitleEl = findChatTitle();
        chatTitleText = chatTitleEl ? chatTitleEl.textContent : "";
      }
      if (!chatTitleEl) return;
      chatTitleEl.textContent = live ? latencyText(delay) : chatTitleText;
      return;
    }
    restoreChatTitle();
    ensurePlayerBadge(video, live, delay);
  }

  /** Badge « viewers » : fixé sur le conteneur du lecteur, coin haut-gauche. */
  function ensurePlayerBadge(video, live, delay) {
    if (!video || !video.parentElement) return;
    const container = video.parentElement;
    if (window.getComputedStyle(container).position === "static") container.style.position = "relative";
    let badge = document.getElementById(LATENCY_ID);
    if (!badge) {
      badge = document.createElement("div");
      badge.id = LATENCY_ID;
      badge.className = "streampulse-kick-latency";
      badge.style.cssText = [
        "position: absolute; top: 12px; left: 12px; z-index: 60;",
        "display: flex; align-items: center; padding: 4px 10px;",
        "border-radius: 6px; background: rgba(9, 11, 15, .72); color: #fff;",
        "font: 600 12px/1.4 Arial, sans-serif; pointer-events: none;",
      ].join(" ");
      container.appendChild(badge);
    }
    if (!container.contains(badge)) container.appendChild(badge);
    if (!live) {
      badge.style.display = "none";
      return;
    }
    badge.style.display = "flex";
    badge.textContent = latencyText(delay);
  }

  function hidePlayerBadge() {
    const badge = document.getElementById(LATENCY_ID);
    if (badge) badge.style.display = "none";
  }

  function loadSettings() {
    chrome.storage.local.get([PREFERENCES_KEY], (result) => {
      const prefs = result[PREFERENCES_KEY] || {};
      const api = i18nApi();
      if (api && prefs.language) currentLang = api.resolve(prefs.language);
      fastForwardEnabled = prefs.enableFastForwardButton !== false; // Default true
      latencyPlacement = prefs.latencyPlacement === "chat" ? "chat" : "viewers";
      // La boucle tourne toujours : elle porte aussi l'indicateur de latence,
      // qui ne dépend pas du bouton d'avance rapide.
      startLoop();
      if (!fastForwardEnabled) {
        removeButton();
      }
    });
  }

  function findVideo() {
    return document.querySelector("video");
  }

  function findControls() {
    // Kick uses various classes based on player version.
    // Common: .vjs-control-bar, or generic container checking.
    // We try to find the row of controls at the bottom.
    const vjs = document.querySelector(".vjs-control-bar");
    if (vjs) return vjs;

    // Fallback: look for play button parent
    const playBtn = document.querySelector("button[title='Play'], button[title='Pause']");
    if (playBtn && playBtn.parentElement) {
      // Traverse up to find the bar
      return playBtn.parentElement.parentElement || playBtn.parentElement;
    }

    return null;
  }

  function createButton() {
    if (document.getElementById(FAST_FORWARD_ID)) return document.getElementById(FAST_FORWARD_ID);

    const btn = document.createElement("button");
    btn.id = FAST_FORWARD_ID;
    btn.className = "streampulse-kick-btn";
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/>
      </svg>
    `;
    btn.style.cssText = `
      background: transparent;
      border: none;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 5px;
      margin-left: 5px;
      opacity: 0.8;
      transition: opacity 0.2s;
    `;
    btn.title = jumpToLiveTitle();

    btn.onmouseenter = () => btn.style.opacity = "1";
    btn.onmouseleave = () => btn.style.opacity = "0.8";

    btn.onclick = () => {
      const video = findVideo();
      if (video && video.buffered.length) {
        const end = video.buffered.end(video.buffered.length - 1);
        video.currentTime = end - 0.5; // Jump to end minus safety buffer
        video.play().catch(()=>{}); // Lecture refusée par le navigateur (autoplay) : attendu.
      }
    };

    return btn;
  }

  function ensureButton() {
    // Contexte mort (extension rechargee) : couper la boucle au lieu de
    // jeter dans le vide toutes les 2 s jusqu'a la fermeture de l'onglet.
    if (!(chrome.runtime && chrome.runtime.id)) {
      stopLoop();
      return;
    }
    if (!fastForwardEnabled) return;
    const controls = findControls();
    if (!controls) return;

    // Check if already inserted
    if (document.getElementById(FAST_FORWARD_ID)) {
      // Check if still in DOM
      if (!controls.contains(document.getElementById(FAST_FORWARD_ID))) {
        // Re-append if moved/removed
        controls.appendChild(createButton());
      }
      return;
    }

    // Append to controls
    // Kick controls usually have left/right sections. We assume appending works ok.
    controls.appendChild(createButton());
  }

  function startLoop() {
    if (intervalId) return;
    intervalId = setInterval(ensureButton, 2000);
    ensureButton();
    // Latence : mise à jour à la seconde, re-accroche de l'en-tête du tchat
    // toutes les 3 s (même cadence que la LatencyFeature de Twitch).
    if (latencyTimer == null) latencyTimer = setInterval(updateLatency, 1000);
    if (headerTimer == null) headerTimer = setInterval(updateLatency, 3000);
    updateLatency();
  }

  function stopLoop() {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    if (latencyTimer) clearInterval(latencyTimer);
    latencyTimer = null;
    if (headerTimer) clearInterval(headerTimer);
    headerTimer = null;
    restoreChatTitle();
  }

  function removeButton() {
    const btn = document.getElementById(FAST_FORWARD_ID);
    if (btn) btn.remove();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[PREFERENCES_KEY]) {
      loadSettings();
    }
  });

  loadSettings();

})();
