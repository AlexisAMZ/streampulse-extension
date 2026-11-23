(() => {
  "use strict";

  // Extra Twitch player buttons:
  //  - Picture-in-Picture (free)
  //  - StreamPulse Clips: direct clip & automatic 9:16 vertical editor
  //  - Clip download as MP4 (StreamPulse+), on /<channel>/clip/<slug> pages
  // The clip CDN answers with Access-Control-Allow-Origin: *, so the file is
  // fetched as a blob and saved without the "downloads" permission.

  if (window.top !== window || window.__streampulsePlayerButtons) return;
  window.__streampulsePlayerButtons = true;

  const PREFERENCES_KEY = "betaGeneralPreferences";
  const PLUS_RULE = window.StreamPulsePlusRule; // js/inject/plus-rule.js, chargé avant (manifest)
  const PLUS_KEY = PLUS_RULE.PLUS_KEY;
  const PIP_ID = "streampulse-pip-btn";
  const CLIP_ID = "streampulse-clip-dl-btn";
  const EDITOR_ID = "streampulse-clip-editor-btn";
  const CAPTURE_ID = "streampulse-stream-capture-btn";
  const HANDOFF = window.StreamPulseClipsHandoff; // js/inject/clips-handoff.js, chargé avant (manifest)
  const STYLE_ID = "streampulse-player-buttons-style";
  const ENSURE_INTERVAL_MS = 2000;
  const GQL_URL = "https://gql.twitch.tv/gql";
  const CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko"; // Twitch public web client id
  const CLIP_QUERY =
    "query VideoAccessToken_Clip($slug: ID!) { clip(slug: $slug) { slug title" +
    " broadcaster { login }" +
    " playbackAccessToken(params: {platform: \"web\", playerBackend: \"mediaplayer\", playerType: \"site\"}) { signature value }" +
    " videoQualities { quality sourceURL } } }";

  const SPCLIPS_LOGO_URL =
    typeof chrome !== "undefined" && chrome.runtime?.getURL
      ? chrome.runtime.getURL("images/photos/spclips-logo.png")
      : "";

  // Grille 24 et formes pleines, comme les icones natives du lecteur Twitch.
  const ICON_PIP =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 4h20v9h-2V6H4v10h6v2H2V4Z"></path><path d="M12 14h10v6H12v-6Z"></path></svg>';
  const ICON_EDITOR = SPCLIPS_LOGO_URL
    ? `<img src="${SPCLIPS_LOGO_URL}" alt="StreamPulse Clips" class="streampulse-player-spclips-icon" />`
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm0 2v16h8V4H8Z"></path><path d="m10.5 9.2 4 2.8-4 2.8V9.2Z"></path></svg>';
  const ICON_DOWNLOAD =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 3h2v9.17l3.59-3.59L18 10l-6 6-6-6 1.41-1.42L11 12.17V3Z"></path><path d="M5 18h14v2H5v-2Z"></path></svg>';
  const ICON_RECORD =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"></circle><circle cx="12" cy="12" r="4.2" fill="#ff4d4d"></circle></svg>';
  const ICON_RECORDING =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="#ff4d4d" stroke-width="2"></circle><rect x="8" y="8" width="8" height="8" rx="1.5" fill="#ff4d4d"></rect></svg>';
  const ICON_LINK =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.59 13.41c.41.39 1.02.59 1.63.59.62 0 1.23-.2 1.63-.59l3.59-3.59a2.3 2.3 0 0 0 0-3.26l-.74-.74a2.3 2.3 0 0 0-3.26 0L12 7.24a1 1 0 1 1-1.41-1.41l1.42-1.42a4.3 4.3 0 0 1 6.08 0l.74.74a4.3 4.3 0 0 1 0 6.08l-3.59 3.59a4.29 4.29 0 0 1-6.08 0 1 1 0 0 1 1.43-1.41Z"></path><path d="M13.41 10.59c-.41-.39-1.02-.59-1.63-.59-.62 0-1.23.2-1.63.59l-3.59 3.59a2.3 2.3 0 0 0 0 3.26l.74.74a2.3 2.3 0 0 0 3.26 0L12 16.76a1 1 0 0 1 1.41 1.41l-1.42 1.42a4.3 4.3 0 0 1-6.08 0l-.74-.74a4.3 4.3 0 0 1 0-6.08l3.59-3.59a4.29 4.29 0 0 1 6.08 0 1 1 0 0 1-1.43 1.41Z"></path></svg>';
  const ICON_VLC =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 19h16L12 2Zm0 3.8 4.8 10.2H7.2L12 5.8Z"></path></svg>';

  const state = { pip: true, clip: true, streamCapture: true, plus: false, downloading: false };
  const recordState = {
    recording: false,
    mediaRecorder: null,
    chunks: [],
    startTime: 0,
    timerId: null,
    targetName: "",
    badgeEl: null,
    mimeType: "",
  };
  let ensureTimer = null;

  function i18n(key) {
    const api = window.__SP_I18N__;
    if (!api || typeof api.get !== "function") return key;
    const lang = typeof api.resolve === "function" ? api.resolve(state.lang) : "en";
    return api.get(lang, "player." + key);
  }

  // Clés littérales déclarées pour le scanneur de scripts/verify.mjs :
  // "inject.player.streamRecordStart"
  // "inject.player.streamRecordStop"
  // "inject.player.streamCopyM3u8"
  // "inject.player.streamM3u8Copied"
  // "inject.player.streamRecordSaved"

  function plusActive(record) {
    return PLUS_RULE.isPlusActive(record);
  }

  function clipSlugFromLocation() {
    const match = /^\/[^/]+\/clip\/([A-Za-z0-9_-]+)/.exec(window.location.pathname);
    if (match) return match[1];
    if (window.location.hostname === "clips.twitch.tv") {
      const parts = window.location.pathname.replace(/^\//, "").split("/");
      if (parts[0] && parts[0] !== "create" && parts[0] !== "embed") return parts[0];
    }
    return null;
  }

  function insertStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .streampulse-player-btn {
        display: inline-flex; align-items: center; justify-content: center;
        width: 32px; height: 32px; margin: 0 4px 0 0; padding: 0;
        border: 0; border-radius: 9000px; background: transparent;
        color: #fff; cursor: pointer;
      }
      .streampulse-player-btn:hover { background: rgba(255, 255, 255, 0.2); }
      .streampulse-player-btn:focus-visible { outline: 2px solid #bf94ff; outline-offset: 2px; }
      .streampulse-player-btn svg { width: 20px; height: 20px; display: block; fill: currentColor; }
      .streampulse-player-btn .streampulse-player-spclips-icon {
        width: 18px; height: 18px; object-fit: contain; display: block;
        pointer-events: none; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
      }
      .streampulse-player-btn[aria-busy="true"] { opacity: 0.55; cursor: progress; }

      /* Bouton Enregistrement / Capture de flux */
      .streampulse-player-btn.is-recording {
        color: #ff4d4d !important;
        animation: spRecBtnPulse 1.5s infinite ease-in-out;
      }
      @keyframes spRecBtnPulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.08); opacity: 0.85; }
      }

      /* Badge flottant REC sur le lecteur vidéo */
      .streampulse-rec-indicator {
        position: absolute;
        top: 14px;
        left: 14px;
        z-index: 2000;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px;
        border-radius: 20px;
        background: rgba(14, 16, 24, 0.88);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 77, 77, 0.45);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6), 0 0 12px rgba(255, 77, 77, 0.25);
        color: #fff;
        font-family: inherit;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        user-select: none;
        transition: all 160ms ease;
      }
      .streampulse-rec-indicator:hover {
        background: rgba(255, 77, 77, 0.25);
        border-color: #ff4d4d;
        transform: scale(1.03);
      }
      .streampulse-rec-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #ff4d4d;
        box-shadow: 0 0 8px #ff4d4d;
        animation: spRecDotPulse 1.2s infinite ease-in-out;
      }
      @keyframes spRecDotPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.35; transform: scale(0.85); }
      }

      /* Menu contextuel StreamPulse Capture */
      .streampulse-capture-menu {
        position: absolute;
        bottom: 42px;
        right: 0;
        z-index: 10000;
        min-width: 250px;
        padding: 6px;
        border-radius: 12px;
        background: rgba(18, 18, 26, 0.96);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.7), 0 0 16px rgba(0, 245, 155, 0.1);
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-family: inherit;
        color: #fff;
        user-select: none;
      }
      .streampulse-capture-menu-item {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 8px 12px;
        border-radius: 8px;
        border: none;
        background: transparent;
        color: #efeff1;
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        text-align: left;
        transition: background 120ms ease, color 120ms ease;
      }
      .streampulse-capture-menu-item:hover {
        background: rgba(255, 255, 255, 0.12);
        color: #00f59b;
      }
      .streampulse-capture-menu-item svg {
        width: 16px;
        height: 16px;
        fill: currentColor;
        flex-shrink: 0;
      }

      /* Notification Toast */
      .streampulse-action-toast {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        z-index: 2147483647;
        padding: 10px 18px;
        border-radius: 12px;
        background: rgba(16, 18, 27, 0.96);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(0, 245, 155, 0.4);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.65), 0 0 16px rgba(0, 245, 155, 0.25);
        color: #fff;
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        opacity: 0;
        pointer-events: none;
        transition: all 220ms cubic-bezier(0.16, 1, 0.3, 1);
      }
      .streampulse-action-toast.is-visible {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      /* Bouton promotionnel SP Clips sur l'interface de création de clip Twitch */
      .streampulse-spclips-create-promo {
        display: inline-flex; align-items: center; gap: 8px;
        margin: 8px 0; padding: 8px 14px; border-radius: 10px;
        background: rgba(145, 70, 255, 0.18); border: 1px solid rgba(145, 70, 255, 0.45);
        color: #fff; font-family: inherit; font-size: 13px; font-weight: 700;
        text-decoration: none; cursor: pointer; transition: all 160ms ease;
      }
      .streampulse-spclips-create-promo:hover {
        background: rgba(145, 70, 255, 0.32); border-color: rgba(145, 70, 255, 0.7);
        transform: translateY(-1px);
      }
      .streampulse-spclips-create-promo img { width: 16px; height: 16px; object-fit: contain; }
    `;
    document.head?.appendChild(style);
  }

  function makeButton(id, icon, label, onClick) {
    const button = document.createElement("button");
    button.id = id;
    button.type = "button";
    button.className = "streampulse-player-btn";
    button.innerHTML = icon;
    button.setAttribute("aria-label", label);
    button.dataset.spLabel = label;
    window.__SP_TIP__?.attach(button, () => button.dataset.spLabel || "");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick(button);
    });
    return button;
  }

  function findVideo() {
    return (
      document.querySelector('div[data-a-target="video-player"] video') ||
      document.querySelector("video")
    );
  }

  async function togglePictureInPicture() {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
      }
      const video = findVideo();
      if (!video) return;
      video.disablePictureInPicture = false;
      await video.requestPictureInPicture();
    } catch (error) {
      console.warn("StreamPulse: Picture-in-Picture failed", error);
    }
  }

  async function fetchClip(slug) {
    const response = await fetch(GQL_URL, {
      method: "POST",
      headers: { "Client-ID": CLIENT_ID, "Content-Type": "application/json" },
      body: JSON.stringify({ operationName: "VideoAccessToken_Clip", query: CLIP_QUERY, variables: { slug } }),
    });
    if (!response.ok) throw new Error(`GQL ${response.status}`);
    const clip = (await response.json())?.data?.clip;
    const token = clip?.playbackAccessToken;
    const best = [...(clip?.videoQualities || [])].sort((a, b) => Number(b.quality) - Number(a.quality))[0];
    if (!token || !best?.sourceURL) throw new Error("clip unavailable");
    const url = `${best.sourceURL}?sig=${encodeURIComponent(token.signature)}&token=${encodeURIComponent(token.value)}`;
    return { url, clip };
  }

  const FORBIDDEN_FILENAME_CHARS = '\\/:*?"<>|';

  function fileNameFor(clip, slug) {
    const raw = [clip?.broadcaster?.login, clip?.title || slug].filter(Boolean).join(" - ");
    const cleaned = Array.from(raw, (char) =>
      char.charCodeAt(0) < 32 || FORBIDDEN_FILENAME_CHARS.includes(char) ? " " : char
    ).join("");
    const safe = cleaned.replace(/\s+/g, " ").trim().slice(0, 120);
    return `${safe || slug}.mp4`;
  }

  async function saveClip(slug) {
    const { url, clip } = await fetchClip(slug);
    const media = await fetch(url);
    if (!media.ok) throw new Error(`clip ${media.status}`);
    const blobUrl = URL.createObjectURL(await media.blob());
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileNameFor(clip, slug);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  }

  function downloadClip(button) {
    const slug = clipSlugFromLocation();
    if (!slug || state.downloading) return;
    state.downloading = true;
    button.setAttribute("aria-busy", "true");
    button.dataset.spLabel = i18n("clipDownloading");
    saveClip(slug)
      .then(() => i18n("clipDownload"))
      .catch((error) => {
        console.warn("StreamPulse: clip download failed", error);
        return i18n("clipDownloadFailed");
      })
      .then((title) => {
        state.downloading = false;
        button.removeAttribute("aria-busy");
        button.dataset.spLabel = title;
      });
  }

  function openInEditor(button) {
    const slug = clipSlugFromLocation();
    const url = HANDOFF?.editorUrlForClipPath(window.location.pathname) ||
      (slug ? HANDOFF?.editorUrlForClip(window.location.href, "twitch_player") : null);

    if (url) {
      // Enregistre le clip dans l'historique local pour l'onglet Clips
      const pageTitle = document.querySelector('h2[data-a-target="stream-title"]')?.textContent?.trim() ||
        document.title.replace(/\s*-\s*Twitch\s*$/i, "").trim() || "Clip";
      const channelMatch = /^\/([^/]+)/.exec(window.location.pathname);
      HANDOFF?.saveClipToHistory?.({
        id: slug,
        url: window.location.href,
        title: pageTitle,
        channel: channelMatch ? channelMatch[1] : "",
        platform: "twitch",
      });
      window.open(url, "_blank", "noopener");
    } else {
      // Sur un live : déclenche la création directe du clip
      triggerDirectClip(button);
    }
  }

  /**
   * Sur un direct ou live Twitch : automatise le clipage en déclenchant le bouton
   * natif de clip de Twitch (ou en ouvrant clips.twitch.tv/create).
   */
  function triggerDirectClip(button) {
    const nativeClipBtn =
      document.querySelector('button[data-a-target="player-clip-button"]') ||
      document.querySelector('.player-controls button[data-a-target="player-clip-button"]');

    if (nativeClipBtn) {
      nativeClipBtn.click();
      if (button) {
        const original = button.dataset.spLabel;
        button.dataset.spLabel = i18n("clipCreating");
        window.setTimeout(() => {
          button.dataset.spLabel = original;
        }, 3000);
      }
    } else {
      // Repli : tente d'ouvrir l'éditeur ou la création pour la chaîne active
      const channel = window.location.pathname.replace(/^\//, "").split("/")[0];
      if (channel && channel !== "directory" && channel !== "videos") {
        window.open(`https://clips.twitch.tv/create`, "_blank", "noopener");
      }
    }
  }

  function getSupportedMimeType() {
    const candidates = [
      'video/mp4;codecs="avc1,mp4a.40.2"',
      'video/mp4;codecs="avc1,opus"',
      "video/mp4;codecs=avc1",
      "video/mp4;codecs=h264",
      "video/mp4",
      "video/webm;codecs=h264,opus",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=h264",
      "video/webm;codecs=vp9",
      "video/webm",
    ];
    for (const type of candidates) {
      try {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
          return type;
        }
      } catch (_e) {}
    }
    return "video/mp4";
  }

  function getActiveChannel() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (!parts.length) return null;
    const nonStream = new Set([
      "directory", "settings", "subscriptions", "drops",
      "wallet", "u", "search", "videos", "moderator",
      "inventory", "friends", "following", "payments",
      "notifications", "privacy", "security", "squad"
    ]);
    if (nonStream.has(parts[0].toLowerCase())) return null;
    return parts[0];
  }

  function getActiveVodId() {
    const match = /\/videos?\/(\d+)/.exec(window.location.pathname);
    return match ? match[1] : null;
  }

  function showToast(message) {
    let toast = document.getElementById("streampulse-action-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "streampulse-action-toast";
      toast.className = "streampulse-action-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toast.__timer);
    toast.__timer = setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 3500);
  }

  async function getStreamOrVodM3u8() {
    const vodId = getActiveVodId();
    if (vodId) {
      try {
        const res = await fetch(GQL_URL, {
          method: "POST",
          headers: { "Client-ID": CLIENT_ID, "Content-Type": "application/json" },
          body: JSON.stringify([{
            operationName: "VideoPlayer_SeekPreviews",
            query: "query VideoPlayer_SeekPreviews($videoID: ID!) { video(id: $videoID) { id seekPreviewsURL } }",
            variables: { videoID: vodId },
          }]),
        });
        const data = await res.json();
        const seekPreviewsURL = data?.[0]?.data?.video?.seekPreviewsURL;
        if (seekPreviewsURL && seekPreviewsURL.includes("/storyboards/")) {
          return seekPreviewsURL.replace(/storyboards\/.*$/, "chunked/index-dvr.m3u8");
        }
      } catch (_e) {}

      try {
        const res = await fetch(GQL_URL, {
          method: "POST",
          headers: { "Client-ID": CLIENT_ID, "Content-Type": "application/json" },
          body: JSON.stringify({
            operationName: "PlaybackAccessToken_Template",
            query: "query PlaybackAccessToken_Template($login: String!, $isLive: Boolean!, $vodID: ID!, $isVod: Boolean!, $playerType: String!) { videoPlaybackAccessToken(id: $vodID, params: {platform: \"web\", playerBackend: \"mediaplayer\", playerType: $playerType}) @include(if: $isVod) { value signature } }",
            variables: { isLive: false, login: "", isVod: true, vodID: vodId, playerType: "site" },
          }),
        });
        const data = await res.json();
        const token = data?.data?.videoPlaybackAccessToken;
        if (token?.value && token?.signature) {
          return `https://usher.ttvnw.net/vod/${vodId}.m3u8?sig=${encodeURIComponent(token.signature)}&token=${encodeURIComponent(token.value)}&allow_source=true`;
        }
      } catch (_e) {}
    }

    const channel = getActiveChannel();
    if (channel) {
      try {
        const res = await fetch(GQL_URL, {
          method: "POST",
          headers: { "Client-ID": CLIENT_ID, "Content-Type": "application/json" },
          body: JSON.stringify({
            operationName: "PlaybackAccessToken_Template",
            query: "query PlaybackAccessToken_Template($login: String!, $isLive: Boolean!, $vodID: ID!, $isVod: Boolean!, $playerType: String!) { streamPlaybackAccessToken(channelName: $login, params: {platform: \"web\", playerBackend: \"mediaplayer\", playerType: $playerType}) @include(if: $isLive) { value signature } }",
            variables: { isLive: true, login: channel, isVod: false, vodID: "", playerType: "site" },
          }),
        });
        const data = await res.json();
        const token = data?.data?.streamPlaybackAccessToken;
        if (token?.value && token?.signature) {
          return `https://usher.ttvnw.net/api/channel/hls/${channel}.m3u8?sig=${encodeURIComponent(token.signature)}&token=${encodeURIComponent(token.value)}&allow_source=true`;
        }
      } catch (_e) {}
    }

    return null;
  }

  function startRecording() {
    if (recordState.recording) return;
    const video = findVideo();
    if (!video) {
      showToast("Lecteur vidéo introuvable.");
      return;
    }

    try {
      const stream = typeof video.captureStream === "function"
        ? video.captureStream(60)
        : typeof video.mozCaptureStream === "function"
        ? video.mozCaptureStream(60)
        : null;

      if (!stream) {
        showToast("Capture de flux non supportée sur ce navigateur.");
        return;
      }

      if (video.muted) {
        video.muted = false;
        setTimeout(() => { video.volume = 0.001; }, 250);
      }

      const mimeType = getSupportedMimeType();
      let recorder = null;
      const optionsToTry = [
        { mimeType, videoBitsPerSecond: 8000000, audioBitsPerSecond: 192000 },
        { mimeType },
        {}
      ];
      for (const opt of optionsToTry) {
        try {
          recorder = new MediaRecorder(stream, opt);
          break;
        } catch (_e) {}
      }
      if (!recorder) {
        recorder = new MediaRecorder(stream);
      }
      recordState.mediaRecorder = recorder;
      recordState.chunks = [];
      recordState.recording = true;
      recordState.startTime = Date.now();
      recordState.mimeType = recorder.mimeType || mimeType;

      const vodId = getActiveVodId();
      const channel = getActiveChannel();
      recordState.targetName = vodId ? `VOD_${vodId}` : (channel || "TwitchStream");

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordState.chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        finishRecording(mimeType);
      };

      recorder.start(1000);
      updateCaptureButtonUI(true);
      showRecordBadge();

      recordState.timerId = setInterval(() => {
        updateRecordBadgeTimer();
      }, 1000);

      video.addEventListener("abort", stopRecording, { once: true });
      window.addEventListener("beforeunload", stopRecording, { once: true });
    } catch (err) {
      console.warn("StreamPulse: échec démarrage capture", err);
      showToast("Impossible de démarrer l'enregistrement.");
      stopRecording();
    }
  }

  function stopRecording() {
    if (!recordState.recording) return;
    recordState.recording = false;
    if (recordState.timerId) {
      clearInterval(recordState.timerId);
      recordState.timerId = null;
    }

    if (recordState.mediaRecorder && recordState.mediaRecorder.state !== "inactive") {
      try {
        recordState.mediaRecorder.stop();
      } catch (_e) {}
    }

    updateCaptureButtonUI(false);
    hideRecordBadge();
  }

  function finishRecording(fallbackMime) {
    if (!recordState.chunks.length) {
      showToast("Enregistrement vide.");
      return;
    }

    const effectiveMime = recordState.mimeType || fallbackMime || "video/mp4";
    const blob = new Blob(recordState.chunks, { type: effectiveMime });
    recordState.chunks = [];

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 19).replace(/T/, "_").replace(/:/g, "-");
    const isMp4 = effectiveMime.toLowerCase().includes("mp4");
    const ext = isMp4 ? "mp4" : "webm";
    const fileName = `StreamPulse_${recordState.targetName}_${dateStr}.${ext}`;

    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

    showToast(i18n("streamRecordSaved") || "Enregistrement vidéo sauvegardé !");
  }

  function showRecordBadge() {
    hideRecordBadge();
    const container =
      document.querySelector('div[data-a-target="video-player"]') ||
      document.querySelector(".video-player") ||
      document.body;
    if (!container) return;

    const badge = document.createElement("div");
    badge.id = "streampulse-rec-indicator";
    badge.className = "streampulse-rec-indicator";
    badge.title = "Cliquer pour terminer et sauvegarder l'enregistrement";
    badge.innerHTML = `
      <span class="streampulse-rec-dot"></span>
      <span id="streampulse-rec-timer">REC 00:00</span>
      <span style="font-size: 11px; opacity: 0.8; margin-left: 4px;">· Terminer</span>
    `;
    badge.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      stopRecording();
    });
    container.appendChild(badge);
    recordState.badgeEl = badge;
  }

  function updateRecordBadgeTimer() {
    const timerEl = document.getElementById("streampulse-rec-timer");
    if (!timerEl) return;
    const elapsedSec = Math.floor((Date.now() - recordState.startTime) / 1000);
    const minutes = Math.floor(elapsedSec / 60);
    const seconds = elapsedSec % 60;
    const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    timerEl.textContent = `REC ${timeStr}`;
  }

  function hideRecordBadge() {
    if (recordState.badgeEl) {
      recordState.badgeEl.remove();
      recordState.badgeEl = null;
    }
    const existing = document.getElementById("streampulse-rec-indicator");
    if (existing) existing.remove();
  }

  function updateCaptureButtonUI(recording) {
    const btn = document.getElementById(CAPTURE_ID);
    if (!btn) return;
    btn.innerHTML = recording ? ICON_RECORDING : ICON_RECORD;
    btn.classList.toggle("is-recording", recording);
    const label = recording
      ? (i18n("streamRecordStop") || "Arrêter l'enregistrement")
      : (i18n("streamRecordStart") || "Enregistrer le flux (Clic) · Options (Clic droit)");
    btn.setAttribute("aria-label", label);
    btn.dataset.spLabel = label;
  }

  function closeCaptureMenu() {
    const existing = document.getElementById("streampulse-capture-menu");
    if (existing) existing.remove();
  }

  function openCaptureMenu(button) {
    closeCaptureMenu();
    insertStyle();

    const menu = document.createElement("div");
    menu.id = "streampulse-capture-menu";
    menu.className = "streampulse-capture-menu";

    const isRec = recordState.recording;
    const recLabel = isRec
      ? (i18n("streamRecordStop") || "Arrêter l'enregistrement")
      : (i18n("streamRecordStart") || "Enregistrer le flux (REC)");

    const isVod = Boolean(getActiveVodId());
    const m3u8Label = isVod
      ? "Copier le lien direct M3U8 de la VOD"
      : (i18n("streamCopyM3u8") || "Copier le flux direct (M3U8 / VLC)");

    menu.innerHTML = `
      <button type="button" class="streampulse-capture-menu-item" data-action="record">
        ${isRec ? ICON_RECORDING : ICON_RECORD}
        <span>${recLabel}</span>
      </button>
      <button type="button" class="streampulse-capture-menu-item" data-action="copy-m3u8">
        ${ICON_LINK}
        <span>${m3u8Label}</span>
      </button>
      <button type="button" class="streampulse-capture-menu-item" data-action="copy-vlc">
        ${ICON_VLC}
        <span>Copier la commande VLC</span>
      </button>
    `;

    menu.addEventListener("click", async (e) => {
      const item = e.target.closest(".streampulse-capture-menu-item");
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      const action = item.dataset.action;
      closeCaptureMenu();

      if (action === "record") {
        if (recordState.recording) {
          stopRecording();
        } else {
          startRecording();
        }
      } else if (action === "copy-m3u8") {
        const url = await getStreamOrVodM3u8();
        if (url) {
          await navigator.clipboard.writeText(url);
          showToast(i18n("streamM3u8Copied") || "Lien M3U8 copié dans le presse-papier !");
        } else {
          showToast("Impossible d'extraire l'URL du flux.");
        }
      } else if (action === "copy-vlc") {
        const url = await getStreamOrVodM3u8();
        if (url) {
          await navigator.clipboard.writeText(`vlc "${url}"`);
          showToast("Commande VLC copiée dans le presse-papier !");
        } else {
          showToast("Impossible d'extraire l'URL du flux.");
        }
      }
    });

    button.parentElement.style.position = "relative";
    button.parentElement.appendChild(menu);

    setTimeout(() => {
      function onDocClick(e) {
        if (!menu.contains(e.target) && e.target !== button) {
          closeCaptureMenu();
          document.removeEventListener("click", onDocClick);
        }
      }
      document.addEventListener("click", onDocClick);
    }, 50);
  }

  function makeCaptureButton() {
    const button = document.createElement("button");
    button.id = CAPTURE_ID;
    button.type = "button";
    button.className = "streampulse-player-btn";
    if (recordState.recording) button.classList.add("is-recording");
    button.innerHTML = recordState.recording ? ICON_RECORDING : ICON_RECORD;
    const label = recordState.recording
      ? (i18n("streamRecordStop") || "Arrêter l'enregistrement")
      : (i18n("streamRecordStart") || "Enregistrer le flux (Clic) · Options (Clic droit)");
    button.setAttribute("aria-label", label);
    button.dataset.spLabel = label;
    window.__SP_TIP__?.attach(button, () => button.dataset.spLabel || "");

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeCaptureMenu();
      if (recordState.recording) {
        stopRecording();
      } else {
        startRecording();
      }
    });

    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openCaptureMenu(button);
    });

    return button;
  }

  function placeButton(controls, id, wanted, create) {
    const existing = document.getElementById(id);
    if (!wanted) {
      existing?.remove();
      return;
    }
    const button = existing || create();
    if (button.parentElement !== controls) {
      controls.insertBefore(button, controls.firstElementChild);
    }
  }

  function ensureButtons() {
    const controls = document.querySelector(
      'div[data-a-target="video-player"] .player-controls__right-control-group'
    );
    if (!controls) return;
    insertStyle();
    const pipWanted = state.pip && document.pictureInPictureEnabled === true;
    const clipWanted = state.clip && state.plus && clipSlugFromLocation() !== null;
    placeButton(controls, PIP_ID, pipWanted, () =>
      makeButton(PIP_ID, ICON_PIP, i18n("pictureInPicture"), togglePictureInPicture)
    );

    // Le bouton SP Clips s'affiche sur les clips ET sur les lives pour le clipage direct
    const isClipPage = clipSlugFromLocation() !== null;
    const editorLabel = isClipPage ? i18n("clipOpenEditor") : i18n("clipDirect");
    const editorWanted = Boolean(HANDOFF);
    placeButton(controls, EDITOR_ID, editorWanted, () =>
      makeButton(EDITOR_ID, ICON_EDITOR, editorLabel, openInEditor)
    );

    // Met à jour le label si l'URL ou la page change
    const existingEditor = document.getElementById(EDITOR_ID);
    if (existingEditor) {
      existingEditor.setAttribute("aria-label", editorLabel);
      existingEditor.dataset.spLabel = editorLabel;
    }

    // Le bouton Capture / Enregistrement / Copie de flux s'affiche sur les lives et les VODs
    const captureWanted = state.streamCapture !== false && !isClipPage;
    placeButton(controls, CAPTURE_ID, captureWanted, () =>
      makeCaptureButton()
    );

    const existingCapture = document.getElementById(CAPTURE_ID);
    if (existingCapture) {
      const captureLabel = recordState.recording
        ? (i18n("streamRecordStop") || "Arrêter l'enregistrement")
        : (i18n("streamRecordStart") || "Enregistrer le flux (Clic) · Options (Clic droit)");
      existingCapture.setAttribute("aria-label", captureLabel);
      existingCapture.dataset.spLabel = captureLabel;
    }

    placeButton(controls, CLIP_ID, clipWanted, () =>
      makeButton(CLIP_ID, ICON_DOWNLOAD, i18n("clipDownload"), downloadClip)
    );

    ensureClipCreationPromo();
  }

  /**
   * Sur la page de création ou publication de clip Twitch (clips.twitch.tv/create ou modal),
   * injecte un bouton officiel pour monter immédiatement le clip en 9:16 dans StreamPulse Clips.
   */
  function ensureClipCreationPromo() {
    if (!window.location.hostname.includes("clips.twitch.tv") && !document.querySelector('div[data-a-target="clips-creation-container"]')) {
      return;
    }
    const PROMO_ID = "streampulse-spclips-create-promo-btn";
    if (document.getElementById(PROMO_ID)) return;

    // Cherche le conteneur des actions de publication
    const targetParent =
      document.querySelector('div[data-a-target="clips-creation-container"]') ||
      document.querySelector('.clips-creation__actions') ||
      document.querySelector('button[data-a-target="publish-clip-button"]')?.parentElement;

    if (!targetParent) return;

    const promo = document.createElement("a");
    promo.id = PROMO_ID;
    promo.className = "streampulse-spclips-create-promo";
    promo.href = "https://spclips.com/app?utm_source=streampulse&utm_medium=extension&utm_campaign=twitch_clip_create";
    promo.target = "_blank";
    promo.rel = "noopener";
    promo.innerHTML = `
      ${SPCLIPS_LOGO_URL ? `<img src="${SPCLIPS_LOGO_URL}" alt="" />` : ""}
      <span>${i18n("clipOpenEditor")} (9:16)</span>
    `;
    promo.addEventListener("click", () => {
      const clipLink = window.location.href;
      if (clipLink && !clipLink.includes("/create")) {
        promo.href = `https://spclips.com/app?clip=${encodeURIComponent(clipLink)}&utm_source=streampulse&utm_medium=extension&utm_campaign=twitch_clip_create`;
      }
    });

    targetParent.appendChild(promo);
  }

  function applyStorage(prefs, plusRecord) {
    state.pip = prefs?.enablePipButton !== false;
    state.clip = prefs?.enableClipDownload !== false;
    state.streamCapture = prefs?.enableStreamCapture !== false;
    state.lang = prefs?.language;
    state.plus = plusActive(plusRecord);
    ensureButtons();
    const wanted = state.pip || Boolean(HANDOFF) || (state.clip && state.plus) || state.streamCapture;
    if (wanted && ensureTimer == null) {
      ensureTimer = window.setInterval(ensureButtons, ENSURE_INTERVAL_MS);
    } else if (!wanted && ensureTimer != null) {
      window.clearInterval(ensureTimer);
      ensureTimer = null;
    }
  }

  function load() {
    chrome.storage.local.get([PREFERENCES_KEY, PLUS_KEY], (result) => {
      if (chrome.runtime?.lastError) {
        console.warn("StreamPulse player buttons:", chrome.runtime.lastError.message);
        return;
      }
      applyStorage(result?.[PREFERENCES_KEY], result?.[PLUS_KEY]);
    });
  }

  try {
    load();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && (changes[PREFERENCES_KEY] || changes[PLUS_KEY])) load();
    });
  } catch (error) {
    console.warn("StreamPulse player buttons init failed", error);
  }
})();
