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
       callbacks.onRemove(streamer.id, displayLabel);
    });
  }
}

/**
 * Creates and fills the streamer card DOM element
 * @param {Object} streamer - The streamer data object
 * @param {Object} status - The current status object (e.g. state.statuses[id])
 * @param {DocumentFragment} template - The HTML template for cards
 * @param {Object} callbacks - { onRemove, onToggleNotify, onOpen }
 */
export function createStreamerCard(streamer, status, template, callbacks) {
  // We clone from the template content
  const fragment = template.content.cloneNode(true);
  
  // Note: We assume applyTranslations is run on the parent or we run it here if needed.
  // Ideally, the template text content is already handled or we replace text content dynamically.
  // In popup.js 'applyTranslations(fragment)' was called. We can skip it if we set text manually, 
  // but for static labels in the template, we might rely on the caller or do it here.
  // Let's assume the caller handles general i18n or we rely on textContent updates below.

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
  avatar.onerror = () => {
    avatar.src = fallbackAvatar || "../images/photos/48px.png";
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

    // Special verification for Kick: Use live player embed
    if (platformId === "kick") {
        if (cardPreview && previewImage) {
            const slug = activeStatus.url ? activeStatus.url.split('/').pop() : formattedHandle;
            if (slug) {
                const existingIframe = cardPreview.querySelector('iframe');
                if (existingIframe) existingIframe.remove();
        
                const iframe = document.createElement('iframe');
                iframe.src = `https://player.kick.com/${slug}?autoplay=true&muted=true`;
                iframe.style.width = '100%';
                iframe.style.height = '100%';
                iframe.style.border = 'none';
                iframe.style.pointerEvents = 'none';
                iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
                iframe.setAttribute('scrolling', 'no');
                
                previewImage.hidden = true;
                cardPreview.appendChild(iframe);
                cardPreview.hidden = false;
                cardPreview.classList.remove("is-loading"); 
                if (livePreview) livePreview.hidden = false;
                
                // Manually update title/game since we bypass image loading
                liveTitle.textContent = activeStatus.title || t("popup.card.defaultLiveTitle");
                if (statusCategory) {
                  const category = activeStatus.game || "";
                  statusCategory.textContent = category;
                  statusCategory.hidden = !category.trim();
                }
                renderLastUpdate(lastUpdate, status?.updatedAt, activeStatus);
                // Return here to avoid image processing logic
                renderSocialLinks(streamer, socialLinksContainer);
                bindCardActions(notificationButton, openButton, removeButton, streamer, platformId, displayLabel, callbacks);
                return fragment; 
            }
        }
    }

    if (cardPreview && previewImage && candidates.length > 0) {
      cardPreview.hidden = false;
      if (livePreview) livePreview.hidden = false;
      previewImage.hidden = false;
      
      // Cleanup iframe if present
      const existingIframe = cardPreview.querySelector('iframe');
      if (existingIframe) existingIframe.remove();

      previewImage.alt = t("popup.labels.previewAltLive", {
        name: displayLabel,
      });
      previewImage.classList.remove("is-offline-preview");
      cardPreview.classList.add("is-loading");

      let candidateIdx = 0;
      const loadNext = () => {
        if (candidateIdx >= candidates.length) {
             cardPreview.classList.remove("is-loading");
             // cardPreview.hidden = true; // Optional: hide if all fail?
             return;
        }
        previewImage.src = candidates[candidateIdx++];
      };
      
      previewImage.onload = () => {
         cardPreview.classList.remove("is-loading");
         cardPreview.hidden = false;
         if (livePreview) livePreview.hidden = false;
      };

      previewImage.onerror = loadNext;
      loadNext();

    } else if (cardPreview) {
      cardPreview.hidden = true;
      if (livePreview) livePreview.hidden = true;
      if (previewImage) {
        previewImage.removeAttribute("src");
        previewImage.alt = "";
      }
    }
    liveTitle.textContent = activeStatus.title || t("popup.card.defaultLiveTitle");
    if (statusCategory) {
      const category = activeStatus.game || "";
      statusCategory.textContent = category;
      statusCategory.hidden = !category.trim();
    }
    renderLastUpdate(lastUpdate, status?.updatedAt, activeStatus);
  } else {
    statusPill.textContent = t("popup.card.offlinePlatform", {
      platform: platformLabel,
    });
    statusPill.classList.remove("online", "unsupported");
    statusPill.classList.add("offline");
    card.classList.add("offline");
    card.classList.remove("live", "unsupported");

    if (cardPreview) {
      cardPreview.hidden = false;
      if (livePreview) livePreview.hidden = false;
      if (previewImage) {
        previewImage.src = "../images/photos/offline.jpg";
        previewImage.alt = t("popup.labels.previewAltOffline", { name: displayLabel });
        previewImage.classList.add("is-offline-preview");
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

  // Bind Actions (Callbacks)
  bindCardActions(notificationButton, openButton, removeButton, streamer, platformId, displayLabel, callbacks);

  return fragment;
}
