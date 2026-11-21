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

  const state = { pip: true, clip: true, plus: false, downloading: false };
  let ensureTimer = null;

  function i18n(key) {
    const api = window.__SP_I18N__;
    if (!api || typeof api.get !== "function") return key;
    const lang = typeof api.resolve === "function" ? api.resolve(state.lang) : "en";
    return api.get(lang, "player." + key);
  }

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

  function isLiveOrVod() {
    // Si ce n'est pas une page de clip, c'est un live ou une vidéo
    return clipSlugFromLocation() === null;
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
    state.lang = prefs?.language;
    state.plus = plusActive(plusRecord);
    ensureButtons();
    const wanted = state.pip || Boolean(HANDOFF) || (state.clip && state.plus);
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
