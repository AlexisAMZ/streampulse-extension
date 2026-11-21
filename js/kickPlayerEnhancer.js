(() => {
  // Kick Player Enhancer
  // Features: Fast Forward to Live, Latency Monitor (placement Twitch)

  // Top-frame guard: avoid duplicating intervals in sub-frames (perf).
  if (window.top !== window) return;

  const PREFERENCES_KEY = "betaGeneralPreferences";
  const FAST_FORWARD_ID = "streampulse-kick-fast-forward";
  const PIP_ID = "streampulse-kick-pip";
  const CLIP_DOWNLOAD_ID = "streampulse-kick-clip-download";
  const LATENCY_ID = "streampulse-kick-latency";
  const LATENCY_STYLE_ID = "streampulse-kick-latency-style";

  let fastForwardEnabled = true;
  let pipEnabled = true;
  let clipDownloadEnabled = true;
  let plusActive = false;
  let downloadingClip = false;
  let intervalId = null;
  let latencyTimer = null;
  let headerTimer = null;

  // Même logique que chatFilter.js : on lit la langue choisie dans StreamPulse
  // plutôt que navigator.language, via le bundle inline injecté avant ce script.
  let currentLang = "en";
  const i18nApi = () => (typeof window !== "undefined" ? window.__SP_I18N__ : null);

  function i18nLabel(key) {
    const api = i18nApi();
    return api ? api.get(currentLang, "player." + key) : key;
  }

  function kickClipSlugFromLocation() {
    const loc = typeof window !== "undefined" && window.location ? window.location : null;
    if (!loc || typeof loc.pathname !== "string") return null;
    const match = /(?:\/clips\/|^\/[^/]+\/clips\/)([A-Za-z0-9_-]+)/.exec(loc.pathname);
    return match ? match[1] : null;
  }

  function jumpToLiveTitle() {
    const api = i18nApi();
    return api ? api.get(currentLang, "enhancer.jumpToLive") : "Jump to Live (StreamPulse)";
  }

  /**
   * Direct ? Infinity n'arrive que sur certains pipelines. Pour le lecteur MSE
   * de Kick (durée = fin de fenêtre glissante, même en low-latency) : une
   * durée qui GRANDIT d'un passage à l'autre trahit le direct : un VOD a une
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

  function latencyParts(delay) {
    const raw = latencyText(delay);
    const match = /^(.+?)\s*[:：]\s*(.+)$/.exec(raw);
    if (!match) {
      return {
        label: "latence",
        value: delay == null ? "--" : `${delay.toFixed(2)}s`,
      };
    }
    const label = match[1].trim().toLowerCase();
    const value = match[2].trim();
    return { label, value };
  }

  // ─── Placement, comme sur Twitch ─────────────────────────────────────────────
  // « viewers » : bouton placé sous le lecteur (près du compteur de spectateurs
  // ou des métadonnées de chaîne, repli sur la barre de commandes basse).
  // « chat » : le mot « Chat » de l'en-tête du tchat est remplacé par le bouton
  // de latence, texte repris à la fin.

  let latencyPlacement = "viewers";
  let chatTitleEl = null;

  function restoreChatTitle() {
    if (chatTitleEl && chatTitleEl.isConnected) chatTitleEl.style.display = "";
    chatTitleEl = null;
    const badge = document.getElementById(LATENCY_ID);
    if (badge && badge.classList.contains("is-chat")) badge.remove();
  }

  function detachBadge() {
    const badge = document.getElementById(LATENCY_ID);
    if (badge && badge.isConnected) badge.remove();
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

  /**
   * Barre de commandes basse du lecteur vidéo (Kick moderne Tailwind .z-controls
   * ou Video.js .vjs-control-bar).
   */
  function findControls() {
    const modern = document.querySelector(".z-controls, [class*='z-controls']");
    if (modern) {
      const leftGroup = modern.querySelector(".flex.items-center") || modern;
      return leftGroup;
    }
    const vjs = document.querySelector(".vjs-control-bar");
    if (vjs) return vjs;

    const playBtn = document.querySelector("button[title*='Play' i], button[title*='Pause' i], button[aria-label*='Play' i], button[aria-label*='Pause' i]");
    if (playBtn && playBtn.parentElement) {
      return playBtn.parentElement.parentElement || playBtn.parentElement;
    }

    return null;
  }

  /**
   * Emplacement sous le lecteur vidéo (section métadonnées).
   * Priorité : devant le compteur de spectateurs, sinon rangée d'actions (follow),
   * sinon repli sur la barre de commandes basse (qui s'efface hors survol).
   */
  function findMetadataAnchor() {
    // 1. Conteneur des spectateurs sous le lecteur
    const spans = document.querySelectorAll("main span.text-surface-fg-subtle, main span.tabular-nums, main span");
    for (const span of spans) {
      const text = (span.textContent || "").trim();
      if (/\b(spectateur|viewer)s?\b/i.test(text)) {
        const holder = span.closest(".flex.items-center") || span.parentElement;
        if (holder) return { element: holder, mode: "before" };
      }
    }

    // 2. Rangée d'actions de chaîne (bouton suivre / follow)
    const followBtn = document.querySelector('[data-testid="follow-button"], main button[data-slot="button"]');
    if (followBtn && followBtn.parentElement) {
      return { element: followBtn.parentElement, mode: "append" };
    }

    // 3. Bloc catégorie
    const catLink = document.querySelector('main a[href^="/category/"]');
    if (catLink && catLink.parentElement) {
      return { element: catLink.parentElement, mode: "append" };
    }

    // 4. Repli : barre de commandes basse (qui s'efface hors survol)
    const controls = findControls();
    if (controls) {
      return { element: controls, mode: "append", isControlBar: true };
    }

    return null;
  }

  // ─── Bouton de latence (même D.A. et même clic que Twitch) ───────────────────

  /** Feuille de style partagée : D.A. calquée sur le compteur de spectateurs de Kick. */
  function ensureStyles() {
    if (document.getElementById(LATENCY_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = LATENCY_STYLE_ID;
    style.textContent = `
    .streampulse-latency-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      background: transparent;
      border: none;
      color: #dedee3;
      font-weight: 700;
      font-size: 14px;
      font-family: inherit;
      line-height: 1.25rem;
      transition: opacity 0.2s ease;
      user-select: none;
      gap: 4px;
    }
    .streampulse-latency-button:hover {
      color: #ffffff;
      cursor: pointer;
      opacity: 0.85;
    }
    .streampulse-latency-dot {
      display: none;
    }
    .streampulse-latency-value {
      color: #53fc18;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .streampulse-latency-label {
      color: var(--edge-color-surface-fg-subtle, #a8a8a8);
      font-weight: 700;
    }
    .streampulse-latency-button.is-disabled {
      opacity: 0.45;
      cursor: default;
      transform: none;
      pointer-events: none;
    }
    .streampulse-latency-button.is-disabled .streampulse-latency-value {
      color: var(--edge-color-surface-fg-subtle, #a8a8a8);
    }
    .streampulse-latency-button.is-disabled:hover {
      opacity: 0.45;
      transform: none;
    }
    .streampulse-latency-button.is-metadata {
      margin-right: 12px;
      align-self: center;
    }
    .streampulse-latency-button.is-in-controls {
      font-size: 12px;
      padding: 0 6px;
      align-self: center;
    }
    .streampulse-latency-button.is-in-controls .streampulse-latency-label {
      font-size: 12px;
      font-weight: 600;
    }
    .streampulse-latency-button.is-chat {
      font-size: 13px;
      padding: 0 4px;
      align-self: center;
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

      const val = document.createElement("span");
      val.className = "streampulse-latency-value";

      const lbl = document.createElement("span");
      lbl.className = "streampulse-latency-label";

      const parts = latencyParts(null);
      val.textContent = parts.value;
      lbl.textContent = parts.label;

      btn.append(val, lbl);
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
    } else if (!btn.querySelector(".streampulse-latency-value")) {
      btn.textContent = "";
      const val = document.createElement("span");
      val.className = "streampulse-latency-value";
      const lbl = document.createElement("span");
      lbl.className = "streampulse-latency-label";
      const parts = latencyParts(null);
      val.textContent = parts.value;
      lbl.textContent = parts.label;
      btn.append(val, lbl);
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
      btn.classList.remove("is-metadata", "is-in-controls", "is-on-player");
      btn.classList.add("is-chat");
      title.style.display = "none";
      if (btn.nextElementSibling !== title) {
        title.insertAdjacentElement("beforebegin", btn);
      }
      return true;
    }
    return false;
  }

  function attachMetadataButton(btn) {
    const anchor = findMetadataAnchor();
    if (!anchor) return false;

    if (anchor.isControlBar) {
      btn.classList.remove("is-metadata", "is-chat", "is-on-player");
      btn.classList.add("is-in-controls");
      if (!anchor.element.contains(btn)) {
        anchor.element.appendChild(btn);
      }
      return true;
    }

    btn.classList.remove("is-in-controls", "is-chat", "is-on-player");
    btn.classList.add("is-metadata");
    if (anchor.mode === "before") {
      if (btn.nextElementSibling !== anchor.element) {
        anchor.element.insertAdjacentElement("beforebegin", btn);
      }
    } else {
      if (!anchor.element.contains(btn)) {
        anchor.element.appendChild(btn);
      }
    }
    return true;
  }

  function updateLatency() {
    if (!(chrome.runtime && chrome.runtime.id)) return;
    ensureStyles();
    const video = findVideo();
    const btn = latencyButton();
    const isChat = latencyPlacement === "chat";

    if (isChat) {
      if (!attachChatButton(btn)) {
        // Pas d'en-tête de tchat (tchat masqué) : pas d'indicateur du tout.
        if (btn.isConnected) btn.remove();
        return;
      }
    } else {
      restoreChatTitle();
      if (!attachMetadataButton(btn)) return;
    }

    const live = isLive(video);
    const delay = live ? latencyDelay(video) : null;
    const parts = latencyParts(delay);
    const valEl = btn.querySelector(".streampulse-latency-value");
    const lblEl = btn.querySelector(".streampulse-latency-label");
    if (valEl) valEl.textContent = parts.value;
    if (lblEl) lblEl.textContent = parts.label;

    if (!live) {
      btn.classList.remove("is-live");
      btn.classList.add("is-disabled");
      btn.title = jumpToLiveTitle();
      return;
    }
    btn.classList.add("is-live");
    const canRealign = delay != null && delay > 0.25 && video && !video.paused;
    btn.classList.toggle("is-disabled", !canRealign);
    btn.title = delay != null ? `${jumpToLiveTitle()} (${latencyText(delay)})` : jumpToLiveTitle();
  }

  function loadSettings() {
    chrome.storage.local.get([PREFERENCES_KEY, "streamPulsePlus"], (result) => {
      const prefs = result[PREFERENCES_KEY] || {};
      const api = i18nApi();
      if (api && prefs.language) currentLang = api.resolve(prefs.language);
      fastForwardEnabled = prefs.enableFastForwardButton !== false; // Default true
      pipEnabled = prefs.enablePipButton !== false;
      clipDownloadEnabled = prefs.enableClipDownload !== false;
      const rule = globalThis.StreamPulsePlusRule;
      plusActive = Boolean(rule ? rule.isPlusActive(result.streamPulsePlus) : result.streamPulsePlus?.status === "active");
      latencyPlacement = prefs.latencyPlacement === "chat" ? "chat" : "viewers";
      startLoop();
      ensureButtons();
    });
  }

  function findVideo() {
    return document.querySelector("video");
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

  function createPipButton() {
    if (document.getElementById(PIP_ID)) return document.getElementById(PIP_ID);
    const btn = document.createElement("button");
    btn.id = PIP_ID;
    btn.className = "streampulse-kick-btn";
    btn.type = "button";
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M2 4h20v9h-2V6H4v10h6v2H2V4Z"></path>
        <path d="M12 14h10v6H12v-6Z"></path>
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
    btn.title = i18nLabel("pictureInPicture");
    btn.onmouseenter = () => btn.style.opacity = "1";
    btn.onmouseleave = () => btn.style.opacity = "0.8";
    btn.onclick = async () => {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
          return;
        }
        const video = findVideo();
        if (!video) return;
        video.disablePictureInPicture = false;
        await video.requestPictureInPicture();
      } catch (err) {
        console.warn("[StreamPulse] PIP failed:", err);
      }
    };
    return btn;
  }

  function createClipDownloadButton(slug) {
    if (document.getElementById(CLIP_DOWNLOAD_ID)) return document.getElementById(CLIP_DOWNLOAD_ID);
    const btn = document.createElement("button");
    btn.id = CLIP_DOWNLOAD_ID;
    btn.className = "streampulse-kick-btn";
    btn.type = "button";
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M11 3h2v9.17l3.59-3.59L18 10l-6 6-6-6 1.41-1.42L11 12.17V3Z"></path>
        <path d="M5 18h14v2H5v-2Z"></path>
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
    btn.title = i18nLabel("clipDownload");
    btn.onmouseenter = () => btn.style.opacity = "1";
    btn.onmouseleave = () => btn.style.opacity = "0.8";
    btn.onclick = () => downloadKickClip(btn, slug);
    return btn;
  }

  async function downloadKickClip(btn, slug) {
    if (downloadingClip) return;
    downloadingClip = true;
    btn.setAttribute("aria-busy", "true");
    const origTitle = btn.title;
    btn.title = i18nLabel("clipDownloading");

    try {
      let videoUrl = "";
      let title = slug;
      let channel = "";

      // 1. Essayer l'API Kick
      try {
        const res = await fetch(`https://kick.com/api/v2/clips/${encodeURIComponent(slug)}`);
        if (res.ok) {
          const json = await res.json();
          const clipData = json?.clip || json;
          videoUrl = clipData?.clip_url || clipData?.video_url || "";
          title = clipData?.title || slug;
          channel = clipData?.channel?.slug || clipData?.creator?.username || "";
        }
      } catch (_) {
        // repli sur le DOM
      }

      // 2. Si pas d'URL trouvée, chercher dans le DOM vidéo
      if (!videoUrl) {
        const video = findVideo();
        if (video?.currentSrc && !video.currentSrc.startsWith("blob:")) {
          videoUrl = video.currentSrc;
        } else if (video?.src && !video.src.startsWith("blob:")) {
          videoUrl = video.src;
        }
      }

      if (!videoUrl) throw new Error("Source introuvable");

      const media = await fetch(videoUrl);
      if (!media.ok) throw new Error(`HTTP ${media.status}`);
      const blob = await media.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      const safe = [channel, title].filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]/g, " ").trim();
      link.download = `${safe || slug}.mp4`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      btn.title = origTitle;
    } catch (err) {
      console.warn("[StreamPulse] Téléchargement clip Kick échoué :", err?.message || err);
      btn.title = i18nLabel("clipDownloadFailed");
    } finally {
      downloadingClip = false;
      btn.removeAttribute("aria-busy");
    }
  }

  function ensureButtons() {
    if (!(chrome.runtime && chrome.runtime.id)) {
      stopLoop();
      return;
    }
    const controls = findControls();
    if (!controls) return;

    // Fast Forward button (live only)
    if (fastForwardEnabled) {
      if (!document.getElementById(FAST_FORWARD_ID)) {
        controls.appendChild(createButton());
      } else if (!controls.contains(document.getElementById(FAST_FORWARD_ID))) {
        controls.appendChild(createButton());
      }
    } else {
      removeButton();
    }

    // PIP button
    if (pipEnabled && document.pictureInPictureEnabled) {
      if (!document.getElementById(PIP_ID)) {
        controls.appendChild(createPipButton());
      } else if (!controls.contains(document.getElementById(PIP_ID))) {
        controls.appendChild(createPipButton());
      }
    } else {
      document.getElementById(PIP_ID)?.remove();
    }

    // Clip download button (sur page de clip)
    const clipSlug = kickClipSlugFromLocation();
    if (clipSlug && clipDownloadEnabled && plusActive) {
      if (!document.getElementById(CLIP_DOWNLOAD_ID)) {
        controls.appendChild(createClipDownloadButton(clipSlug));
      } else if (!controls.contains(document.getElementById(CLIP_DOWNLOAD_ID))) {
        controls.appendChild(createClipDownloadButton(clipSlug));
      }
    } else {
      document.getElementById(CLIP_DOWNLOAD_ID)?.remove();
    }
  }

  function ensureButton() {
    ensureButtons();
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
    detachBadge();
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
