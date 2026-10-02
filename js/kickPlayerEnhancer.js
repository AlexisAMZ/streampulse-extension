(() => {
  // Kick Player Enhancer
  // Features: Fast Forward to Live, Latency Monitor (placement Twitch)

  // Top-frame guard: avoid duplicating intervals in sub-frames (perf).
  if (window.top !== window) return;

  const PREFERENCES_KEY = "betaGeneralPreferences";
  const FAST_FORWARD_ID = "streampulse-kick-fast-forward";
  const LATENCY_ID = "streampulse-kick-latency";
  const LATENCY_STYLE_ID = "streampulse-kick-latency-style";

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
   * Direct ? Infinity n'arrive que sur certains pipelines. Pour le lecteur MSE
   * de Kick (durée = fin de fenêtre glissante, même en low-latency) : une
   * durée qui GRANDIT d'un passage à l'autre trahit le direct — un VOD a une
   * durée constante. Au premier passage, repli : fenêtre à plus de 8 s de la
   * fin de la fenêtre.
   */
  var durationSample = NaN;
  function isLive(video) {
    if (!video) return false;
    if (video.duration === Infinity) return true;
    if (!Number.isFinite(video.duration)) return false;
    var grew = Number.isFinite(durationSample) && video.duration > durationSample + 0.01;
    durationSample = video.duration;
    return grew || video.duration - video.currentTime > 8;
  }

  /** Retard de la lecture sur l'arête de téléchargement (float, ou null). */
  function latencyDelay(video) {
    if (!video || !video.buffered.length) return null;
    const delay = video.buffered.end(video.buffered.length - 1) - video.currentTime;
    return delay > 0 ? delay : null;
  }

  function latencyText(delay) {
    const api = i18nApi();
    if (!api) return "";
    return delay == null
      ? api.get(currentLang, "player.latencyEmpty")
      : api.get(currentLang, "player.latencyValue", { value: delay.toFixed(2) });
  }

  // ─── Placement, comme sur Twitch ─────────────────────────────────────────────
  // « viewers » : bouton fixé sur le lecteur. « chat » : le mot « Chat » de
  // l'en-tête du tchat est remplacé par le bouton de latence, texte repris à
  // la fin.

  let latencyPlacement = "viewers";
  let chatTitleEl = null;

  function restoreChatTitle() {
    if (chatTitleEl && chatTitleEl.isConnected) chatTitleEl.style.display = "";
    chatTitleEl = null;
    const badge = document.getElementById(LATENCY_ID);
    if (badge) badge.remove();
  }

  function hidePlayerBadge() {
    const badge = document.getElementById(LATENCY_ID);
    if (badge) badge.style.display = "none";
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

  // ─── Bouton de latence (même D.A. et même clic que Twitch) ───────────────────

  /** Feuille de style partagée : reprise du CSS du bouton Twitch. */
  function ensureStyles() {
    if (document.getElementById(LATENCY_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = LATENCY_STYLE_ID;
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
    .streampulse-latency-button.is-on-player {
      position: absolute;
      top: 12px;
      left: 12px;
      z-index: 60;
      background: rgba(9, 11, 15, .72);
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 12px;
    }
    `;
    document.head.appendChild(style);
  }

  function latencyButton() {
    let btn = document.getElementById(LATENCY_ID);
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.id = LATENCY_ID;
      btn.className = "streampulse-latency-button";

      const dot = document.createElement("span");
      dot.className = "streampulse-latency-dot";

      const text = document.createElement("span");
      text.className = "streampulse-latency-text";
      text.textContent = latencyText(null);

      btn.append(dot, text);
      // Cliquer = rattraper le direct, même comportement que sur Twitch.
      btn.addEventListener("click", () => {
        const video = findVideo();
        if (!video) return;
        const delay = latencyDelay(video);
        if (delay != null && delay > 0.25) {
          if (video.buffered.length) {
            video.currentTime = video.buffered.end(video.buffered.length - 1) - 0.5;
          }
        }
        if (video.paused) video.play().catch(() => {});
        updateLatency();
      });
    }
    return btn;
  }

  function attachChatButton(btn) {
    const title = findChatTitle();
    if (title) {
      if (chatTitleEl !== title) {
        if (chatTitleEl && chatTitleEl.isConnected) chatTitleEl.style.display = "";
        chatTitleEl = title;
      }
      title.style.display = "none";
      title.insertAdjacentElement("beforebegin", btn);
      return true;
    }
    return false;
  }

  function attachPlayerButton(btn, video) {
    if (!video || !video.parentElement) return false;
    const container = video.parentElement;
    if (window.getComputedStyle(container).position === "static") container.style.position = "relative";
    btn.classList.add("is-on-player");
    if (!container.contains(btn)) container.appendChild(btn);
    return true;
  }

  function updateLatency() {
    if (!(chrome.runtime && chrome.runtime.id)) return;
    ensureStyles();
    const video = findVideo();
    const btn = latencyButton();
    const isChat = latencyPlacement === "chat";

    if (isChat) {
      btn.classList.remove("is-on-player");
      hidePlayerBadge();
      if (!attachChatButton(btn)) {
        // Pas d'en-tête de tchat (tchat masqué) : pas d'indicateur du tout.
        if (btn.isConnected) btn.remove();
        return;
      }
    } else {
      restoreChatTitle();
      if (!attachPlayerButton(btn, video)) return;
    }

    if (!isLive(video)) {
      btn.classList.remove("is-live");
      btn.classList.add("is-disabled");
      const text = btn.querySelector(".streampulse-latency-text");
      if (text) text.textContent = latencyText(null);
      return;
    }
    btn.classList.add("is-live");
    const delay = latencyDelay(video);
    const canRealign = delay != null && delay > 0.25 && video && !video.paused;
    btn.classList.toggle("is-disabled", !canRealign);
    const text = btn.querySelector(".streampulse-latency-text");
    if (text) text.textContent = latencyText(delay == null ? null : delay);
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
