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
const HOVER_DELAY = 500;

function getEmbedUrl(platformId, streamer, status) {
  // Twitch blocks extension origins — no embed possible in MV3 popup
  switch (platformId) {
    case "kick":
    case "kishta": {
      let slug = status?.url?.includes("kick.com") ? status.url.split("/").pop() : null;
      if (!slug) slug = (streamer.handle || "").replace(/^@/, "");
      if (platformId === "kishta") slug = "teuf";
      return slug ? `https://player.kick.com/${slug}?autoplay=true&muted=false` : null;
    }
    default:
      return null;
  }
}

function setupHoverPreview(cardPreview, platformId, streamer, status) {
  const embedUrl = getEmbedUrl(platformId, streamer, status);
  if (!embedUrl) return;

  let hoverTimer = null;

  cardPreview.addEventListener("mouseenter", () => {
    hoverTimer = setTimeout(() => {
      if (cardPreview.querySelector(".hover-player-wrap")) return;
      const wrap = document.createElement("div");
      wrap.className = "hover-player-wrap";
      const iframe = document.createElement("iframe");
      iframe.src = embedUrl;
      iframe.allow = "autoplay; encrypted-media; picture-in-picture";
      iframe.setAttribute("scrolling", "no");
      wrap.appendChild(iframe);
      cardPreview.appendChild(wrap);
    }, HOVER_DELAY);
  });

  cardPreview.addEventListener("mouseleave", () => {
    clearTimeout(hoverTimer);
    hoverTimer = null;
    const wrap = cardPreview.querySelector(".hover-player-wrap");
    if (wrap) wrap.remove();
  });
}

// --- Thumbnail cache (survive popup close/reopen) ---
const thumbCache = {};
let thumbCacheLoaded = false;

async function loadThumbCache() {
  if (thumbCacheLoaded) return;
  try {
    const data = await chrome.storage.local.get("streampulse:thumbCache");
    Object.assign(thumbCache, data["streampulse:thumbCache"] || {});
  } catch (_) { /* ignore */ }
  thumbCacheLoaded = true;
}

let thumbSaveTimer = null;
function saveThumbCache() {
  clearTimeout(thumbSaveTimer);
  thumbSaveTimer = setTimeout(() => {
    chrome.storage.local.set({ "streampulse:thumbCache": thumbCache }).catch(() => {});
  }, 1000);
}

function getCachedThumb(streamerId) {
  return thumbCache[streamerId] || null;
}

function setCachedThumb(streamerId, url) {
  if (!url) return;
  thumbCache[streamerId] = url;
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


function bindCardActions(notificationButton, openButton, removeButton, streamer, platformId, displayLabel, callbacks) {
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

  displayName.textContent = displayLabel;
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
      // Enhanced fallback: avatar + game
      let fallbackContent = cardPreview.querySelector(".fallback-content");
      if (!fallbackContent) {
        fallbackContent = document.createElement("div");
        fallbackContent.className = "fallback-content";

        const fbAvatar = document.createElement("img");
        fbAvatar.className = "fallback-avatar";
        fbAvatar.src = streamer.avatarUrl || `../${getPlatformDefinition(platformId).icon || "images/photos/48px.png"}`;
        fbAvatar.alt = displayLabel;

        fallbackContent.appendChild(fbAvatar);

        if (activeStatus.game) {
          const fbGame = document.createElement("span");
          fbGame.className = "fallback-game";
          fbGame.textContent = activeStatus.game;
          fallbackContent.appendChild(fbGame);
        }

        cardPreview.appendChild(fallbackContent);
      }
    };

    if (platformId === "kick" || platformId === "kishta") {
        if (cardPreview && previewImage) {
            let iframeSrc = null;

            if (platformId === "kishta") {
               let slug = "teuf";
               iframeSrc = `https://player.kick.com/${slug}?autoplay=true&muted=true`;
            } else {
                let slug = activeStatus.url && activeStatus.url.includes("kick.com") ? activeStatus.url.split('/').pop() : null;
                if (!slug && streamer.handle === "teufteuf") slug = "teuf";
                if (!slug) slug = streamer.handle ? streamer.handle.replace(/^@/, '') : "";
                if (slug) iframeSrc = `https://player.kick.com/${slug}?autoplay=true&muted=true`;
            }

            if (iframeSrc) {
                const existingIframe = cardPreview.querySelector('iframe');
                if (existingIframe) existingIframe.remove();
                const existingOverlay = cardPreview.querySelector('.iframe-play-overlay');
                if (existingOverlay) existingOverlay.remove();

                previewImage.hidden = true;
                cardPreview.hidden = false;
                cardPreview.classList.remove("is-fallback");
                cardPreview.classList.remove("is-loading");
                if (livePreview) livePreview.hidden = false;

                if (platformId === "kishta") {
                  // Kishta auto-loads
                  const iframe = document.createElement('iframe');
                  iframe.dataset.src = iframeSrc;
                  iframe.className = 'lazy-iframe';
                  iframe.style.cssText = 'width:100%;height:100%;border:none;pointer-events:auto;';
                  iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
                  iframe.setAttribute('scrolling', 'yes');
                  cardPreview.appendChild(iframe);
                } else {
                  // Kick: click-to-play overlay
                  const overlay = document.createElement('div');
                  overlay.className = 'iframe-play-overlay';
                  const playIcon = document.createElement('div');
                  playIcon.className = 'play-icon';
                  overlay.appendChild(playIcon);
                  overlay.addEventListener('click', () => {
                    overlay.remove();
                    const iframe = document.createElement('iframe');
                    iframe.src = iframeSrc;
                    iframe.style.cssText = 'width:100%;height:100%;border:none;pointer-events:none;';
                    iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
                    iframe.setAttribute('scrolling', 'no');
                    cardPreview.appendChild(iframe);
                  });
                  cardPreview.appendChild(overlay);
                }

                liveTitle.textContent = activeStatus.title || t("popup.card.defaultLiveTitle");
                if (statusCategory) {
                  const category = activeStatus.game || "";
                  statusCategory.textContent = category;
                  statusCategory.hidden = !category.trim();
                }
                renderLastUpdate(lastUpdate, status?.updatedAt, activeStatus);
                renderSocialLinks(streamer, socialLinksContainer);
                bindCardActions(notificationButton, openButton, removeButton, streamer, platformId, displayLabel, callbacks);
                return fragment;
            }
        }
    }

    if (cardPreview && previewImage && candidates.length > 0) {
      cardPreview.hidden = false;
      cardPreview.classList.remove("is-fallback");
      if (livePreview) livePreview.hidden = false;
      previewImage.hidden = false;

      const existingIframe = cardPreview.querySelector("iframe");
      if (existingIframe) existingIframe.remove();

      previewImage.alt = t("popup.labels.previewAltLive", {
        name: displayLabel,
      });
      previewImage.classList.remove("is-offline-preview");

      // Show cached thumbnail instantly while loading fresh one
      const cached = getCachedThumb(streamer.id);
      if (cached) {
        previewImage.src = cached;
        cardPreview.classList.remove("is-loading");
      } else {
        cardPreview.classList.add("is-loading");
      }

      // Load fresh thumbnail in background
      let candidateIdx = 0;
      const freshImg = new Image();

      const loadNext = () => {
        if (candidateIdx >= candidates.length) {
          if (!cached) showFallbackPreview();
          return;
        }
        freshImg.src = candidates[candidateIdx++];
      };

      freshImg.onload = function () {
        freshImg.onload = null;
        freshImg.onerror = null;
        const freshUrl = freshImg.src;
        // Swap to fresh thumbnail
        previewImage.src = freshUrl;
        cardPreview.classList.remove("is-loading");
        cardPreview.hidden = false;
        if (livePreview) livePreview.hidden = false;
        // Update cache
        setCachedThumb(streamer.id, freshUrl);
      };

      freshImg.onerror = function () {
        loadNext();
      };
      loadNext();

    } else if (cardPreview) {
      showFallbackPreview();
    }
    liveTitle.textContent = activeStatus.title || t("popup.card.defaultLiveTitle");
    if (statusCategory) {
      const category = activeStatus.game || "";
      statusCategory.textContent = category;
      statusCategory.hidden = !category.trim();
    }
    renderLastUpdate(lastUpdate, status?.updatedAt, activeStatus);

    // Hover-to-play on live cards
    if (cardPreview) {
      setupHoverPreview(cardPreview, platformId, streamer, activeStatus);
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
  bindCardActions(notificationButton, openButton, removeButton, streamer, platformId, displayLabel, callbacks);

  return fragment;
}
