import { t, getCurrentLanguage } from "./i18n.js";
import {
  DEFAULT_PLATFORM,
  getPlatformDefinition,
  getPlatformLabelKey,
  platformSupportsLiveStatus,
  formatHandleForDisplay,
  buildProfileUrl
} from "./platforms.js";

// Helper to replace the missing getPlatformLabel export
function getPlatformLabel(platform) {
  return t(getPlatformLabelKey(platform));
}

// --- Hover-to-play live preview ---
// Static thumbnail by default; iframe player loads only on hover (500ms delay)
// and is destroyed on mouseleave to free RAM.

const HOVER_DELAY = 500;

function getEmbedUrl(platformId, streamer, status) {
  if (platformId === "kick" && status?.isLive) {
    const slug = streamer.handle;
    if (slug) return `https://player.kick.com/${encodeURIComponent(slug)}?muted=true`;
  }
  return null;
}

function setupHoverPreview(cardPreview, platformId, streamer, status, callbacks) {
  const openStream = () => {
    const url = buildProfileUrl(platformId, streamer.handle || streamer.twitch || streamer.id);
    callbacks?.onOpen?.(url);
  };

  // Always allow clicking the card preview to open the stream
  cardPreview.style.cursor = "pointer";
  cardPreview.addEventListener("click", openStream);

  const embedUrl = getEmbedUrl(platformId, streamer, status);
  if (!embedUrl) return; // No embed available — static thumbnail + click only

  let hoverTimer = null;

  const teardownIframe = () => {
    const wrap = cardPreview.querySelector(".hover-player-wrap");
    if (wrap) {
      const iframe = wrap.querySelector("iframe");
      if (iframe) iframe.src = "about:blank"; // stop streaming + free RAM
      wrap.remove();
    }
  };

  cardPreview.addEventListener("mouseenter", () => {
    if (cardPreview.querySelector(".hover-player-wrap")) return;
    hoverTimer = setTimeout(() => {
      const wrap = document.createElement("div");
      wrap.className = "hover-player-wrap";

      const iframe = document.createElement("iframe");
      iframe.allow = "autoplay; encrypted-media; picture-in-picture";
      iframe.setAttribute("scrolling", "no");
      iframe.setAttribute("muted", "");
      iframe.src = embedUrl;
      wrap.appendChild(iframe);

      // Transparent overlay above iframe captures clicks (iframes block bubbling)
      const clickOverlay = document.createElement("div");
      clickOverlay.className = "embed-click-overlay";
      clickOverlay.addEventListener("click", (e) => {
        e.stopPropagation();
        openStream();
      });
      wrap.appendChild(clickOverlay);

      cardPreview.appendChild(wrap);
    }, HOVER_DELAY);
  });

  cardPreview.addEventListener("mouseleave", () => {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    teardownIframe();
  });
}

// --- Thumbnail cache (survive popup close/reopen) ---
// LRU-bounded to keep memory under control on low-end machines.
const THUMB_CACHE_MAX = 50;
const thumbCache = new Map(); // insertion order = LRU order
let thumbCacheLoaded = false;

async function loadThumbCache() {
  if (thumbCacheLoaded) return;
  try {
    const data = await chrome.storage.local.get("streampulse:thumbCache");
    const stored = data["streampulse:thumbCache"] || {};
    for (const [k, v] of Object.entries(stored)) {
      thumbCache.set(k, v);
      if (thumbCache.size > THUMB_CACHE_MAX) {
        const oldestKey = thumbCache.keys().next().value;
        thumbCache.delete(oldestKey);
      }
    }
  } catch (_) { /* ignore */ }
  thumbCacheLoaded = true;
}

let thumbSaveTimer = null;
function saveThumbCache() {
  clearTimeout(thumbSaveTimer);
  thumbSaveTimer = setTimeout(() => {
    chrome.storage.local.set({
      "streampulse:thumbCache": Object.fromEntries(thumbCache),
    }).catch(() => {});
  }, 1000);
}

function getCachedThumb(streamerId) {
  if (!thumbCache.has(streamerId)) return null;
  // Refresh LRU position
  const url = thumbCache.get(streamerId);
  thumbCache.delete(streamerId);
  thumbCache.set(streamerId, url);
  return url;
}

function setCachedThumb(streamerId, url) {
  if (url) {
    if (thumbCache.has(streamerId)) thumbCache.delete(streamerId);
    thumbCache.set(streamerId, url);
    if (thumbCache.size > THUMB_CACHE_MAX) {
      const oldestKey = thumbCache.keys().next().value;
      thumbCache.delete(oldestKey);
    }
  } else {
    thumbCache.delete(streamerId);
  }
  saveThumbCache();
}

// Load cache on module init
loadThumbCache();

function buildThumbnailUrl(rawUrl, width = 320, height = 180) {
  if (!rawUrl) return "";
  return rawUrl
    .replace("{width}", String(width))
    .replace("{height}", String(height));
}

// --- Thumbnail load queue ---
// Limits concurrent network fetches so the popup doesn't stall on
// users with many live streamers.
const MAX_THUMB_CONCURRENCY = 3;
let _activeThumbs = 0;
const _thumbQueue = [];

function _drainThumbQueue() {
  while (_activeThumbs < MAX_THUMB_CONCURRENCY && _thumbQueue.length > 0) {
    const fn = _thumbQueue.shift();
    _activeThumbs++;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      _activeThumbs--;
      _drainThumbQueue();
    };
    try { fn(release); } catch (_) { release(); }
  }
}

function scheduleThumbLoad(fn) {
  _thumbQueue.push(fn);
  _drainThumbQueue();
}

export function formatNumber(value) {
  try {
    const lang = getCurrentLanguage();
    const locale = lang === "fr" ? "fr-FR" : "en-US";
    return new Intl.NumberFormat(locale).format(value);
  } catch (error) {
    return String(value);
  }
}

function buildIdentityMeta(streamer, status) {
  const parts = [];
  const platformLabel = getPlatformLabel(streamer.platform || DEFAULT_PLATFORM);
  if (status?.supportsLiveStatus !== false && status?.game && !status.isLive) {
    parts.push(status.game);
  }
  if (platformLabel) {
    parts.push(platformLabel);
  }
  return parts.filter(Boolean).join(" • ");
}

function formatUpdatedAt(timestamp) {
  const label = t("popup.card.lastUpdateLabel");
  if (!timestamp) {
    return { label, time: t("popup.labels.lastUpdateTimePlaceholder") };
  }
  const date = new Date(timestamp);
  const lang = getCurrentLanguage();
  const locale = lang === "fr" ? "fr-FR" : "en-US";
  return {
    label,
    time: date.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function renderLastUpdate(element, timestamp, status) {
  if (!element) return;
  const { label, time } = formatUpdatedAt(timestamp);
  element.innerHTML = "";

  const labelEl = document.createElement("span");
  labelEl.className = "last-update-label";
  labelEl.textContent = label;

  const timeEl = document.createElement("span");
  timeEl.className = "last-update-time";
  timeEl.textContent = time;

  if (Number.isFinite(status?.viewers)) {
    timeEl.appendChild(document.createElement("br"));
    const viewersEl = document.createElement("span");
    viewersEl.className = "last-update-viewers";
    viewersEl.textContent = t("popup.labels.viewers", {
      count: formatNumber(status.viewers),
    });
    timeEl.appendChild(viewersEl);
  }

  element.append(labelEl, timeEl);
}

const SOCIAL_ORDER = [
  "twitch",
  "youtube",
  "kick",
  "dlive",
  "instagram",
  "twitter",
  "tiktok",
  "discord",
  "spotify",
];

const SOCIAL_DEFINITIONS = {
  twitch: { label: "Twitch", icon: "../images/social/Twitch.png" },
  youtube: { label: "YouTube", icon: "../images/social/youtube.png" },
  kick: { label: "Kick", icon: "../images/social/Kick.png" },
  dlive: { label: "DLive", icon: "../images/social/dlive.svg" },
  instagram: { label: "Instagram", icon: "../images/social/instagram.png" },
  twitter: { label: "Twitter", icon: "../images/social/twitter.png" },
  tiktok: { label: "TikTok", icon: "../images/social/tiktok.png" },
  discord: { label: "Discord", icon: "../images/social/discord.png" },
  spotify: { label: "Spotify", icon: "../images/social/spotify.png" },
};

function renderSocialLinks(streamer, container) {
  if (!container) return;
  container.innerHTML = "";
  const socials = streamer.socials || {};

  const entries = SOCIAL_ORDER.filter((key) => {
    const url = socials[key];
    return typeof url === "string" && url;
  });

  if (entries.length === 0) {
    container.hidden = true;
    return;
  }

  container.hidden = false;

  entries.forEach((key) => {
    const url = socials[key];
    const definition = SOCIAL_DEFINITIONS[key];
    if (!definition) return;

    const link = document.createElement("a");
    link.className = "social-link";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = definition.label;

    const icon = document.createElement("img");
    icon.alt = definition.label;
    icon.src = definition.icon;

    link.appendChild(icon);
    container.appendChild(link);
  });
}


function bindCardActions(notificationButton, gameNotificationButton, openButton, removeButton, streamer, platformId, displayLabel, callbacks) {
  if (notificationButton) {
    notificationButton.addEventListener("click", async () => {
      const currentlyEnabled = notificationButton.classList.contains("active");
      const newState = !currentlyEnabled;

      const success = await callbacks.onToggleNotify(streamer.id, newState);
      if (success) {
         const bellIcon = notificationButton.querySelector(".bell-icon");
         const bellOffIcon = notificationButton.querySelector(".bell-off-icon");
         if (newState) {
           notificationButton.classList.add("active");
           if (bellIcon) bellIcon.style.display = "";
           if (bellOffIcon) bellOffIcon.style.display = "none";
         } else {
           notificationButton.classList.remove("active");
           if (bellIcon) bellIcon.style.display = "none";
           if (bellOffIcon) bellOffIcon.style.display = "";
         }
      }
    });
  }

  if (gameNotificationButton) {
    gameNotificationButton.addEventListener("click", async () => {
      const currentlyEnabled = gameNotificationButton.classList.contains("active");
      const newState = !currentlyEnabled;

      const success = await callbacks.onToggleGameNotify(streamer.id, newState);
      if (success) {
         const gamepadIcon = gameNotificationButton.querySelector(".gamepad-icon");
         const gamepadOffIcon = gameNotificationButton.querySelector(".gamepad-off-icon");
         if (newState) {
           gameNotificationButton.classList.add("active");
           if (gamepadIcon) gamepadIcon.style.display = "";
           if (gamepadOffIcon) gamepadOffIcon.style.display = "none";
         } else {
           gameNotificationButton.classList.remove("active");
           if (gamepadIcon) gamepadIcon.style.display = "none";
           if (gamepadOffIcon) gamepadOffIcon.style.display = "";
         }
      }
    });
  }

  if (openButton) {
    openButton.addEventListener("click", () => {
       const url = buildProfileUrl(platformId, streamer.handle || streamer.twitch || streamer.id);
       callbacks.onOpen(url);
    });
  }

  if (removeButton) {
    removeButton.addEventListener("click", () => {
      const card = removeButton.closest(".streamer-card");
      if (!card || card.querySelector(".confirm-overlay")) return;

      const overlay = document.createElement("div");
      overlay.className = "confirm-overlay";

      const text = document.createElement("span");
      text.className = "confirm-text";
      text.textContent = t("popup.card.confirmRemove") || "Supprimer ?";

      const btnYes = document.createElement("button");
      btnYes.className = "confirm-yes";
      btnYes.textContent = t("popup.card.confirmYes") || "Oui";

      const btnNo = document.createElement("button");
      btnNo.className = "confirm-no";
      btnNo.textContent = t("popup.card.confirmNo") || "Non";

      overlay.append(text, btnYes, btnNo);
      card.appendChild(overlay);

      // Auto-cancel after 3s
      const timer = setTimeout(() => overlay.remove(), 3000);

      btnYes.addEventListener("click", (e) => {
        e.stopPropagation();
        clearTimeout(timer);
        overlay.remove();
        callbacks.onRemove(streamer.id, displayLabel);
      });

      btnNo.addEventListener("click", (e) => {
        e.stopPropagation();
        clearTimeout(timer);
        overlay.remove();
      });
    });
  }
}

export function createStreamerCard(streamer, status, template, callbacks) {
  const fragment = template.content.cloneNode(true);

  const card = fragment.querySelector(".streamer-card");
  const avatar = fragment.querySelector(".avatar");
  const displayName = fragment.querySelector(".display-name");
  const statusPill = fragment.querySelector(".status-pill");
  const notificationButton = fragment.querySelector(".notification-button");
  const gameNotificationButton = fragment.querySelector(".game-notification-button");
  const openButton = fragment.querySelector(".open-button");
  const removeButton = fragment.querySelector(".remove-button");
  const cardPreview = fragment.querySelector(".card-preview");
  const livePreview = cardPreview?.querySelector(".live-preview");
  const previewImage = cardPreview?.querySelector(".preview-image");
  const liveTitle = fragment.querySelector(".live-title");
  const identityMeta = fragment.querySelector(".identity-meta");
  const lastUpdate = fragment.querySelector(".last-update");
  const socialLinksContainer = fragment.querySelector(".social-links");
  const statusCategory = fragment.querySelector(".status-category");

  const activeStatus = status?.active || { isLive: false };
  const platformId = streamer.platform || DEFAULT_PLATFORM;
  const platformLabel = getPlatformLabel(platformId);
  const supportsLiveStatus =
    platformSupportsLiveStatus(platformId) &&
    activeStatus.supportsLiveStatus !== false;
  const displayLabel =
    streamer.displayName ||
    formatHandleForDisplay(platformId, streamer.handle || streamer.twitch);

  // V7 — data-platform for CSS ring + glyph color
  if (card) card.dataset.platform = platformId;

  // Wrap name in span so it can be truncated independently of the platform glyph
  displayName.innerHTML = "";
  const nameText = document.createElement("span");
  nameText.className = "name-text";
  nameText.textContent = displayLabel;
  displayName.appendChild(nameText);

  const identityMetaText = buildIdentityMeta(streamer, activeStatus);
  identityMeta.textContent = identityMetaText;
  identityMeta.hidden = !identityMetaText;

  const fallbackAvatar = `../${
    getPlatformDefinition(platformId).icon || "images/photos/48px.png"
  }`;
  avatar.src = streamer.avatarUrl || fallbackAvatar || "../images/photos/48px.png";
  avatar.alt = t("popup.labels.avatarAlt", { name: displayLabel });
  avatar.onerror = function() {
    this.onerror = null; // prevent infinite loop & release closure
    this.src = fallbackAvatar || "../images/photos/48px.png";
  };

  const isNotifEnabled = streamer.notificationsEnabled !== false;
  if (notificationButton) {
    const bellIcon = notificationButton.querySelector(".bell-icon");
    const bellOffIcon = notificationButton.querySelector(".bell-off-icon");
    if (isNotifEnabled) {
      notificationButton.classList.add("active");
      if (bellIcon) bellIcon.style.display = "";
      if (bellOffIcon) bellOffIcon.style.display = "none";
    } else {
      notificationButton.classList.remove("active");
      if (bellIcon) bellIcon.style.display = "none";
      if (bellOffIcon) bellOffIcon.style.display = "";
    }
  }

  const isGameNotifEnabled = streamer.gameNotificationsEnabled !== false;
  if (gameNotificationButton) {
    const gamepadIcon = gameNotificationButton.querySelector(".gamepad-icon");
    const gamepadOffIcon = gameNotificationButton.querySelector(".gamepad-off-icon");
    if (isGameNotifEnabled) {
      gameNotificationButton.classList.add("active");
      if (gamepadIcon) gamepadIcon.style.display = "";
      if (gamepadOffIcon) gamepadOffIcon.style.display = "none";
    } else {
      gameNotificationButton.classList.remove("active");
      if (gamepadIcon) gamepadIcon.style.display = "none";
      if (gamepadOffIcon) gamepadOffIcon.style.display = "";
    }
  }

  if (!supportsLiveStatus) {
    statusPill.textContent = t("popup.card.statusUnsupported", {
      platform: platformLabel,
    });
    statusPill.classList.remove("online", "offline");
    statusPill.classList.add("unsupported");
    card.classList.remove("live", "offline");
    card.classList.add("unsupported");
    if (cardPreview) {
      cardPreview.hidden = true;
      if (livePreview) livePreview.hidden = true;
      if (previewImage) {
        previewImage.removeAttribute("src");
        previewImage.alt = "";
      }
    }
    liveTitle.textContent = "";
    if (statusCategory) {
      statusCategory.textContent = "";
      statusCategory.hidden = true;
    }
    renderLastUpdate(lastUpdate, status?.updatedAt, activeStatus);
  } else if (activeStatus.isLive) {
    statusPill.textContent = t("popup.card.statusLive", {
      platform: platformLabel,
    });
    statusPill.classList.remove("offline", "unsupported");
    statusPill.classList.add("online");
    card.classList.remove("offline", "unsupported");
    card.classList.add("live");

    const candidates = (activeStatus.thumbnailCandidates || [activeStatus.thumbnailUrl])
      .filter(Boolean)
      .map(url => buildThumbnailUrl(url, 480, 270));

    const showFallbackPreview = () => {
      if (!cardPreview || !livePreview) return;
      cardPreview.hidden = false;
      livePreview.hidden = false;
      cardPreview.classList.remove("is-loading");
      cardPreview.classList.add("is-fallback");
      if (previewImage) {
        previewImage.hidden = true;
        previewImage.removeAttribute("src");
      }
      if (livePreview.querySelector(".fallback-content")) return;
      const fallbackContent = document.createElement("div");
      fallbackContent.className = "fallback-content";
      const fbAvatar = document.createElement("img");
      fbAvatar.className = "fallback-avatar";
      fbAvatar.src = streamer.avatarUrl || `../${getPlatformDefinition(platformId).icon || "images/photos/48px.png"}`;
      fbAvatar.onerror = () => { fbAvatar.src = `../images/social/${platformId === "kick" ? "Kick" : platformId === "dlive" ? "dlive" : "twitch"}.png`; };
      fbAvatar.alt = displayLabel;
      fallbackContent.appendChild(fbAvatar);
      if (activeStatus.game) {
        const fbGame = document.createElement("span");
        fbGame.className = "fallback-game";
        fbGame.textContent = activeStatus.game;
        fallbackContent.appendChild(fbGame);
      }
      livePreview.appendChild(fallbackContent);
    };

    if (cardPreview) {
      cardPreview.hidden = false;
      if (livePreview) livePreview.hidden = false;
      previewImage.onerror = null;

      cardPreview.querySelector("iframe")?.remove();
      previewImage.alt = t("popup.labels.previewAltLive", { name: displayLabel });
      previewImage.classList.remove("is-offline-preview");

      // Always show fallback avatar immediately — replaced by thumbnail if one loads
      showFallbackPreview();

      if (previewImage && candidates.length > 0) {
        let candidateIdx = 0;

        const applyThumb = (url) => {
          livePreview?.querySelector(".fallback-content")?.remove();
          cardPreview.classList.remove("is-fallback", "is-loading");
          previewImage.src = url;
          previewImage.hidden = false;
        };

        const tryCandidate = () => {
          if (candidateIdx >= candidates.length) {
            setCachedThumb(streamer.id, null);
            return; // keep fallback avatar
          }
          const url = candidates[candidateIdx++];
          scheduleThumbLoad((release) => {
            const img = new Image();
            img.onload = () => {
              release();
              if (img.naturalWidth < 100) { tryCandidate(); return; }
              applyThumb(url);
              setCachedThumb(streamer.id, url);
            };
            img.onerror = () => { release(); tryCandidate(); };
            img.src = url;
          });
        };

        const cached = getCachedThumb(streamer.id);
        if (cached) {
          // Show cached thumb instantly (browser HTTP cache will likely hit).
          // Don't re-validate against the network — the next poll will refresh.
          scheduleThumbLoad((release) => {
            const img = new Image();
            img.onload = () => {
              release();
              if (img.naturalWidth < 100) { tryCandidate(); return; }
              applyThumb(cached);
            };
            img.onerror = () => {
              release();
              setCachedThumb(streamer.id, null);
              tryCandidate();
            };
            img.src = cached;
          });
        } else {
          tryCandidate();
        }
      }
    }
    liveTitle.textContent = activeStatus.title || t("popup.card.defaultLiveTitle");
    if (statusCategory) {
      const category = activeStatus.game || "";
      statusCategory.textContent = category;
      statusCategory.hidden = !category.trim();
    }

    // V7 — inject live badge + viewer badge + started-at into livePreview
    if (livePreview) {
      livePreview.querySelectorAll(".live-badge,.viewer-badge,.started-at").forEach(el => el.remove());
      const liveBadge = document.createElement("span");
      liveBadge.className = "live-badge";
      liveBadge.innerHTML = `<span class="live-dot"></span>LIVE`;
      livePreview.appendChild(liveBadge);
      if (activeStatus.viewers != null) {
        const viewerBadge = document.createElement("span");
        viewerBadge.className = "viewer-badge";
        viewerBadge.textContent = `👁 ${formatNumber ? formatNumber(activeStatus.viewers) : activeStatus.viewers}`;
        livePreview.appendChild(viewerBadge);
      }
    }

    renderLastUpdate(lastUpdate, status?.updatedAt, activeStatus);

    // Hover-to-play on live cards (iframe loads on hover, frees RAM on leave)
    if (cardPreview) {
      setupHoverPreview(cardPreview, platformId, streamer, activeStatus, callbacks);
    }
  } else {
    statusPill.textContent = t("popup.card.offlinePlatform", {
      platform: platformLabel,
    });
    statusPill.classList.remove("online", "unsupported");
    statusPill.classList.add("offline");
    card.classList.add("offline");
    card.classList.remove("live", "unsupported");

    if (cardPreview) {
      cardPreview.hidden = true;
      if (livePreview) livePreview.hidden = true;
      if (previewImage) {
        previewImage.removeAttribute("src");
        previewImage.alt = "";
        previewImage.classList.remove("is-offline-preview");
      }
    }

    liveTitle.textContent = t("popup.card.offline");
    if (statusCategory) {
      statusCategory.textContent = "";
      statusCategory.hidden = true;
    }
    renderLastUpdate(lastUpdate, status?.updatedAt, activeStatus);
  }

  renderSocialLinks(streamer, socialLinksContainer);
  bindCardActions(notificationButton, gameNotificationButton, openButton, removeButton, streamer, platformId, displayLabel, callbacks);

  return fragment;
}
