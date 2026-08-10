(() => {
  "use strict";

  if (window.top !== window) return;

  const PREFERENCES_KEY = "betaGeneralPreferences";
  let isLiveIconActive = true;
  let isAvatarFaviconActive = true;
  let originalFavicon = null;

  // Indicator colors: red = live, orange = this channel is raiding another one.
  const DOT_LIVE = "#FF0000";
  const DOT_RAID = "#FF8A00";
  // Épaisseur de l'anneau, en pixels du canvas 32×32. L'avatar est rétréci
  // d'autant pour que l'anneau borde le visage au lieu de le recouvrir.
  const RING_WIDTH = 3;
  // Demi-période du clignotement pendant un raid.
  const BLINK_MS = 600;

  let cachedImage = null;
  let cachedImageSrc = "";
  let blinkVisible = true;
  let blinkTimerId = null;

  const RAID_SELECTORS = [
    '[data-test-selector="raid-banner"]',
    '[data-a-target="raid-banner"]',
    'button[data-a-target="cancel-raid-button"]',
    '[data-test-selector="raid-banner-cancel-button"]',
    '.raid-banner',
    '[class*="raid-banner"]',
  ].join(", ");

  /**
   * True while Twitch shows the outgoing-raid banner on the current channel.
   * Lets the favicon signal a raid even when auto-follow is disabled, so the
   * viewer notices the channel is moving on.
   */
  function isRaiding() {
    try {
      return Boolean(document.querySelector(RAID_SELECTORS));
    } catch (_) {
      return false;
    }
  }

  function findStreamerAvatarUrl() {
    const streamerSelectors = [
      '[data-a-target="stream-channel-avatar"] img',
      '.channel-info-content .tw-avatar img',
      '.channel-header-user-avatar img',
      '[data-test-selector="channel-header"] img',
      '.channel-root-header-layout img',
      '.channel-header-avatar img',
      '.channel-header img[src*="user-assets"]',
      '[data-user-avatar="channel"] img',
    ];

    for (const selector of streamerSelectors) {
      const imgEl = document.querySelector(selector);
      if (imgEl && imgEl instanceof HTMLImageElement && imgEl.src) {
        if (!imgEl.closest(".top-nav, nav, [data-a-target='user-menu-toggle'], .navigation-link, header.top-nav")) {
          return imgEl.src;
        }
      }
    }
    return null;
  }

  /**
   * Dessine le favicon à partir d'une image déjà chargée.
   *
   * Séparé du chargement pour que le clignotement puisse repeindre plusieurs
   * fois par seconde sans relancer une requête réseau à chaque phase.
   */
  function paintFavicon(img, { withAvatar, indicatorColor }) {
    const faviconEl = document.querySelector("link[rel*='icon']");
    if (!faviconEl) return;

    try {
      const canvas = document.createElement("canvas");
      const size = 32;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // L'anneau n'a de sens qu'au-dessus de l'avatar : sur le favicon Twitch
      // d'origine, il masquerait le logo. Là on garde la pastille d'angle.
      const useRing = Boolean(withAvatar && indicatorColor);
      const inset = useRing ? RING_WIDTH : 0;

      if (withAvatar) {
        // save/restore encadrent le détourage. Sans eux, le clip circulaire
        // restait actif et rognait l'indicateur dessiné ensuite.
        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - inset, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, inset, inset, size - inset * 2, size - inset * 2);
        ctx.restore();
      } else {
        ctx.drawImage(img, 0, 0, size, size);
      }

      if (indicatorColor) {
        if (useRing) {
          // Un anneau complet reste lisible à 16 px, taille réelle d'un
          // favicon, là où une pastille d'angle se réduit à deux pixels.
          ctx.strokeStyle = indicatorColor;
          ctx.lineWidth = RING_WIDTH;
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, size / 2 - RING_WIDTH / 2, 0, 2 * Math.PI);
          ctx.stroke();
        } else {
          ctx.fillStyle = indicatorColor;
          ctx.beginPath();
          ctx.arc(size - 6, size - 6, 5, 0, 2 * Math.PI);
          ctx.fill();
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      faviconEl.setAttribute("href", canvas.toDataURL("image/png"));
    } catch (_) {}
  }

  /** Charge une image une seule fois par URL, puis la garde en mémoire. */
  function withImage(url, callback) {
    if (cachedImage && cachedImageSrc === url) {
      callback(cachedImage);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      cachedImage = img;
      cachedImageSrc = url;
      callback(img);
    };
    img.src = url;
  }

  function updateTabFavicon() {
    if (!isLiveIconActive && !isAvatarFaviconActive) {
      setBlinking(false);
      restoreFavicon();
      return;
    }

    const faviconEl = document.querySelector("link[rel*='icon']");
    if (!faviconEl) return;

    if (!originalFavicon) {
      originalFavicon = faviconEl.getAttribute("href");
    }

    // Un direct est un flux sans durée finie. On ne regarde surtout pas
    // video.paused : mettre le lecteur en pause n'interrompt pas le direct, et
    // l'indicateur disparaissait alors que la chaîne était toujours à l'antenne.
    // NaN est volontairement exclu : c'est l'état « métadonnées pas encore
    // chargées », pas une preuve de direct.
    const video = document.querySelector(".video-player video, video");
    const isLive = Boolean(video && video.duration === Infinity);

    const avatarUrl = isAvatarFaviconActive ? findStreamerAvatarUrl() : null;
    const sourceUrl = avatarUrl || originalFavicon;
    if (!sourceUrl) return;

    const showIndicator = Boolean(isLive && isLiveIconActive);
    const raiding = showIndicator && isRaiding();

    // Le raid est un événement bref : un anneau fixe se confond avec l'état
    // "en direct" au coin de l'œil. Le clignotement le distingue sans occuper
    // plus de place.
    setBlinking(raiding);

    let indicatorColor = null;
    if (showIndicator) {
      if (raiding) indicatorColor = blinkVisible ? DOT_RAID : null;
      else indicatorColor = DOT_LIVE;
    }

    withImage(sourceUrl, (img) =>
      paintFavicon(img, { withAvatar: Boolean(avatarUrl), indicatorColor })
    );
  }

  function setBlinking(active) {
    if (active && !blinkTimerId) {
      blinkTimerId = setInterval(() => {
        blinkVisible = !blinkVisible;
        updateTabFavicon();
      }, BLINK_MS);
    } else if (!active && blinkTimerId) {
      clearInterval(blinkTimerId);
      blinkTimerId = null;
      blinkVisible = true;
    }
  }

  function restoreFavicon() {
    if (originalFavicon) {
      const faviconEl = document.querySelector("link[rel*='icon']");
      if (faviconEl) {
        faviconEl.setAttribute("href", originalFavicon);
      }
    }
  }

  setInterval(updateTabFavicon, 4000);

  function loadPrefs(prefs = {}) {
    isLiveIconActive = prefs.enableTabLiveIcon !== false;
    isAvatarFaviconActive = prefs.enableStreamerFavicon !== false;
    if (!isLiveIconActive && !isAvatarFaviconActive) {
      setBlinking(false);
      restoreFavicon();
    }
  }

  chrome.storage.local.get([PREFERENCES_KEY], (res) => {
    loadPrefs(res?.[PREFERENCES_KEY] || {});
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[PREFERENCES_KEY]) {
      loadPrefs(changes[PREFERENCES_KEY].newValue || {});
    }
  });
})();
