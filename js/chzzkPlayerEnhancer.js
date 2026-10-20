(() => {
  // CHZZK Player Enhancer : indicateur de latence, même emplacement et même clic que sur Twitch et Kick.
  //
  // Source de la mesure : la latence réelle du lecteur (pont dans le monde de la page,
  // js/inject/chzzk-latency-bridge.js), à laquelle on ajoute le délai d'encodage estimé. Sans elle
  // (lecteur pas encore prêt), repli sur l'avance de la mémoire tampon, comme sur Kick.

  if (window.top !== window) return;

  const PREFERENCES_KEY = "betaGeneralPreferences";
  const LATENCY_ID = "streampulse-chzzk-latency";
  const STYLE_ID = "streampulse-chzzk-latency-style";
  const BRIDGE_ATTRIBUTE = "data-sp-chzzk-latency";
  // Délai d'encodage et de transmission que le lecteur ne compte pas (estimation).
  const ENCODING_SECONDS = 1.5;
  // Au-delà, le direct est en retard : l'indicateur passe au rouge.
  const LATE_SECONDS = 6;
  const SEEK_MARGIN_SECONDS = 0.5;
  const TITLE_SEARCH_GAP_MS = 3000;
  const UPDATE_MS = 2000;
  const CHAT_TITLE = /^(chat|tchat|채팅)$/i;

  let currentLang = "en";
  let chatTitleEl = null;
  let timer = null;
  let titleSearchedAt = 0;

  const i18nApi = () => window.__SP_I18N__ || null;

  function latencyText(seconds) {
    const api = i18nApi();
    if (!api) return "";
    return seconds == null
      ? api.get(currentLang, "player.latencyEmpty")
      : api.get(currentLang, "player.latencyValue", { value: seconds.toFixed(2) });
  }

  const findVideo = () => document.querySelector("video");

  function bufferDelay(video) {
    if (!video || !video.buffered.length) return null;
    const delay = video.buffered.end(video.buffered.length - 1) - video.currentTime;
    return delay > 0 ? delay : null;
  }

  /** Latence en secondes et sa source, ou null quand rien n'est mesurable. */
  function measure(video) {
    const raw = Number(document.documentElement.getAttribute(BRIDGE_ATTRIBUTE));
    if (document.documentElement.hasAttribute(BRIDGE_ATTRIBUTE) && Number.isFinite(raw)) {
      return { seconds: raw / 1000 + ENCODING_SECONDS, live: true };
    }
    const buffer = bufferDelay(video);
    return buffer == null ? null : { seconds: buffer, live: video.duration === Infinity };
  }

  // ─── Bouton ──────────────────────────────────────────────────────────────────

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    .streampulse-chzzk-latency { display: inline-flex; align-items: center; gap: 6px; height: 24px; min-width: 112px; margin: 0; padding: 0 6px; contain: layout paint style; font-variant-numeric: tabular-nums;
      border: 0; background: none; color: #dedee3; font-weight: 600; font-size: 13px; line-height: 1; white-space: nowrap;
      vertical-align: middle; user-select: none; transition: color .2s ease; }
    .streampulse-chzzk-latency:hover { color: #fff; cursor: pointer; }
    .streampulse-chzzk-latency .sp-dot { display: block; flex: none; width: 8px; height: 8px; border-radius: 50%; background: #888; }
    .streampulse-chzzk-latency .sp-text { display: block; line-height: 1; }
    .streampulse-chzzk-latency.is-live .sp-dot { background: #00ffa3; }
    .streampulse-chzzk-latency.is-late .sp-dot { background: #ff4d4d; }
    .streampulse-chzzk-latency.is-late { color: #ff8a8a; }
    .streampulse-chzzk-latency.is-disabled { opacity: .4; cursor: default; transform: none; pointer-events: none; }
    .streampulse-chzzk-latency.is-on-player { position: absolute; top: 12px; left: 12px; z-index: 60;
      background: rgba(9, 11, 15, .72); border-radius: 6px; padding: 4px 10px; font-size: 12px; }`;
    (document.head || document.documentElement).appendChild(style);
  }

  function catchUpToLive() {
    const video = findVideo();
    if (!video || !video.buffered.length) return;
    video.currentTime = video.buffered.end(video.buffered.length - 1) - SEEK_MARGIN_SECONDS;
    if (video.paused) video.play().catch(() => {}); // Lecture refusée (autoplay) : attendu.
  }

  function latencyButton() {
    let button = document.getElementById(LATENCY_ID);
    if (button) return button;
    button = document.createElement("button");
    button.type = "button";
    button.id = LATENCY_ID;
    button.className = "streampulse-chzzk-latency";
    const dot = document.createElement("span");
    dot.className = "sp-dot";
    const text = document.createElement("span");
    text.className = "sp-text";
    text.textContent = latencyText(null);
    button.append(dot, text);
    button.addEventListener("click", () => {
      catchUpToLive();
      update();
    });
    return button;
  }

  // ─── Placement : sur le lecteur, ou à la place du titre « Chat » ─────────────

  function findChatTitle() {
    const candidates = [];
    for (const element of document.querySelectorAll("body *")) {
      if (element.children.length || element.closest("button, a, [role='button']")) continue;
      if (!CHAT_TITLE.test((element.textContent || "").trim())) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.left > window.innerWidth / 2) candidates.push(element);
    }
    return candidates.length ? candidates[candidates.length - 1] : null;
  }

  function restoreChatTitle() {
    if (chatTitleEl && chatTitleEl.isConnected) chatTitleEl.style.display = "";
    chatTitleEl = null;
  }

  // Le titre est mémorisé : le chercher parcourt toute la page, ce qu'on ne refait que s'il a disparu,
  // et au plus toutes les 3 s.
  function cachedChatTitle() {
    if (chatTitleEl && chatTitleEl.isConnected) return chatTitleEl;
    if (Date.now() - titleSearchedAt < TITLE_SEARCH_GAP_MS) return null;
    titleSearchedAt = Date.now();
    return findChatTitle();
  }

  function attachToChat(button) {
    const title = cachedChatTitle();
    if (!title) return false;
    if (chatTitleEl !== title) restoreChatTitle();
    chatTitleEl = title;
    // Aucune écriture si rien ne change : CHZZK surveille son DOM, inutile de le réveiller chaque seconde.
    if (title.style.display !== "none") title.style.display = "none";
    button.classList.remove("is-on-player");
    if (button.nextElementSibling !== title) title.insertAdjacentElement("beforebegin", button);
    return true;
  }

  function attachToPlayer(button, video) {
    const container = video && video.parentElement;
    if (!container) return false;
    if (getComputedStyle(container).position === "static") container.style.position = "relative";
    button.classList.add("is-on-player");
    if (!container.contains(button)) container.appendChild(button);
    return true;
  }

  function update() {
    if (!(chrome.runtime && chrome.runtime.id)) return stop();
    ensureStyles();
    const video = findVideo();
    const button = latencyButton();
    // Sur CHZZK l'indicateur prend la place du mot « 채팅 » ; sans titre de tchat (tchat masqué ou
    // pas encore peint), il se pose sur le lecteur plutôt que de disparaître.
    if (!attachToChat(button)) {
      restoreChatTitle();
      if (!attachToPlayer(button, video)) {
        button.remove();
        return;
      }
    }
    const measured = video ? measure(video) : null;
    const text = button.querySelector(".sp-text");
    const label = latencyText(measured ? measured.seconds : null);
    if (text && text.textContent !== label) text.textContent = label;
    button.classList.toggle("is-live", Boolean(measured && measured.live));
    button.classList.toggle("is-late", Boolean(measured && measured.seconds >= LATE_SECONDS));
    button.classList.toggle("is-disabled", !measured || !measured.live || video.paused);
  }

  // ─── Cycle de vie ────────────────────────────────────────────────────────────

  function start() {
    if (timer == null) timer = setInterval(update, UPDATE_MS);
    update();
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    restoreChatTitle();
    const button = document.getElementById(LATENCY_ID);
    if (button) button.remove();
  }

  function loadSettings() {
    chrome.storage.local.get([PREFERENCES_KEY], (result) => {
      const prefs = result[PREFERENCES_KEY] || {};
      const api = i18nApi();
      if (api && prefs.language) currentLang = api.resolve(prefs.language);
      start();
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[PREFERENCES_KEY]) loadSettings();
  });

  loadSettings();
})();
