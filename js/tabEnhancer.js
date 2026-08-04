(() => {
  "use strict";

  if (window.top !== window) return;

  const PREFERENCES_KEY = "betaGeneralPreferences";
  let isLiveIconActive = true;
  let isAvatarFaviconActive = true;
  let originalFavicon = null;

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

  function updateTabFavicon() {
    if (!isLiveIconActive && !isAvatarFaviconActive) {
      restoreFavicon();
      return;
    }

    const video = document.querySelector(".video-player video, video");
    const isLive = video && !video.paused && (video.duration === Infinity || !Number.isFinite(video.duration));

    const faviconEl = document.querySelector("link[rel*='icon']");
    if (!faviconEl) return;

    if (!originalFavicon) {
      originalFavicon = faviconEl.getAttribute("href");
    }

    const avatarUrl = isAvatarFaviconActive ? findStreamerAvatarUrl() : null;
    const sourceUrl = avatarUrl || originalFavicon;
    if (!sourceUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 32;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        if (avatarUrl) {
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
          ctx.closePath();
          ctx.clip();
        }

        ctx.drawImage(img, 0, 0, size, size);

        if (isLive && isLiveIconActive) {
          ctx.restore();
          ctx.fillStyle = "#FF0000";
          ctx.beginPath();
          ctx.arc(size - 6, size - 6, 5, 0, 2 * Math.PI);
          ctx.fill();
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        const dataUrl = canvas.toDataURL("image/png");
        faviconEl.setAttribute("href", dataUrl);
      } catch (_) {}
    };
    img.src = sourceUrl;
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
    if (!isLiveIconActive && !isAvatarFaviconActive) restoreFavicon();
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
