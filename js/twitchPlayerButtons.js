(() => {
  "use strict";

  // Extra Twitch player buttons:
  //  - Picture-in-Picture (free)
  //  - Clip download as MP4 (StreamPulse+), on /<channel>/clip/<slug> pages
  // The clip CDN answers with Access-Control-Allow-Origin: *, so the file is
  // fetched as a blob and saved without the "downloads" permission.

  if (window.top !== window || window.__streampulsePlayerButtons) return;
  window.__streampulsePlayerButtons = true;

  const PREFERENCES_KEY = "betaGeneralPreferences";
  const PLUS_KEY = "streamPulsePlus";
  const PLUS_GRACE_MS = 30 * 24 * 60 * 60 * 1000;
  const PIP_ID = "streampulse-pip-btn";
  const CLIP_ID = "streampulse-clip-dl-btn";
  const STYLE_ID = "streampulse-player-buttons-style";
  const ENSURE_INTERVAL_MS = 2000;
  const GQL_URL = "https://gql.twitch.tv/gql";
  const CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko"; // Twitch public web client id
  const CLIP_QUERY =
    "query VideoAccessToken_Clip($slug: ID!) { clip(slug: $slug) { slug title" +
    " broadcaster { login }" +
    " playbackAccessToken(params: {platform: \"web\", playerBackend: \"mediaplayer\", playerType: \"site\"}) { signature value }" +
    " videoQualities { quality sourceURL } } }";

  // Grille 24 et formes pleines, comme les icones natives du lecteur Twitch.
  const ICON_PIP =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 4h20v9h-2V6H4v10h6v2H2V4Z"></path><path d="M12 14h10v6H12v-6Z"></path></svg>';
  const ICON_DOWNLOAD =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 3h2v9.17l3.59-3.59L18 10l-6 6-6-6 1.41-1.42L11 12.17V3Z"></path><path d="M5 18h14v2H5v-2Z"></path></svg>';

  const state = { pip: true, clip: true, plus: false, downloading: false };
  let ensureTimer = null;

  function i18n(key) {
    const api = window.__SP_I18N__;
    if (!api || typeof api.get !== "function") return key;
    const lang = typeof api.resolve === "function" ? api.resolve(state.lang) : "en";
    return api.get(lang, "player." + key);
  }

  // Une extension chargee non empaquetee n'a pas d'update_url : c'est une
  // installation de developpement, jamais celle des utilisateurs du store.
  // Les avantages StreamPulse+ y sont ouverts pour pouvoir les tester.
  function isDevInstall() {
    try {
      return !chrome.runtime.getManifest().update_url;
    } catch (_error) {
      return false;
    }
  }

  function plusActive(record) {
    if (isDevInstall()) return true;
    if (!record || record.status !== "active" || !record.licenseKey) return false;
    if (record.plan === "lifetime") return true;
    return Date.now() - (Number(record.verifiedAt) || 0) <= PLUS_GRACE_MS;
  }

  function clipSlugFromLocation() {
    const match = /^\/[^/]+\/clip\/([A-Za-z0-9_-]+)/.exec(window.location.pathname);
    return match ? match[1] : null;
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
      .streampulse-player-btn[aria-busy="true"] { opacity: 0.55; cursor: progress; }
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
    placeButton(controls, CLIP_ID, clipWanted, () =>
      makeButton(CLIP_ID, ICON_DOWNLOAD, i18n("clipDownload"), downloadClip)
    );
  }

  function applyStorage(prefs, plusRecord) {
    state.pip = prefs?.enablePipButton !== false;
    state.clip = prefs?.enableClipDownload !== false;
    state.lang = prefs?.language;
    state.plus = plusActive(plusRecord);
    ensureButtons();
    const wanted = state.pip || (state.clip && state.plus);
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
