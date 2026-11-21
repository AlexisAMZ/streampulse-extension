(() => {
  "use strict";

  // StreamPulse+ : Démutage automatique des rediffusions (VODs) Twitch coupées par le copyright.
  // Détecte les flux M3U8 de VOD hébergés sur CloudFront, sonde la présence des segments originaux
  // sans filtre DMCA (*.ts), installe les règles de redirection et met en valeur les zones
  // restaurées sur la barre de progression.

  if (window.__streampulseVodUnmute) return;
  window.__streampulseVodUnmute = true;

  const MUTED_MARKER = /-muted(?=\.[^.]*$|$)/;
  const STYLE_ID = "streampulse-vod-unmute-styles";
  const processedPlaylists = new Set();
  let currentVodId = null;
  let plusActive = false;
  let restoredRanges = [];
  let totalVodDuration = 0;

  function isVodPage() {
    return /^\/videos\/(\d+)/.test(window.location.pathname);
  }

  function getVodId() {
    const match = /^\/videos\/(\d+)/.exec(window.location.pathname);
    return match ? match[1] : null;
  }

  function updatePlusStatus(record) {
    if (typeof StreamPulsePlusRule !== "undefined" && typeof StreamPulsePlusRule.isPlusActive === "function") {
      plusActive = StreamPulsePlusRule.isPlusActive(record);
    } else {
      plusActive = Boolean(record && record.status === "active");
    }
  }

  // Initialisation du statut StreamPulse+
  if (chrome.storage?.local) {
    chrome.storage.local.get("streamPulsePlus", (res) => {
      updatePlusStatus(res?.streamPulsePlus);
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.streamPulsePlus) {
        updatePlusStatus(changes.streamPulsePlus.newValue);
        if (plusActive && restoredRanges.length > 0) {
          paintSeekbar();
        }
      }
    });
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .streampulse-unmuted-segment {
        position: absolute;
        top: 0;
        bottom: 0;
        background: rgba(0, 245, 155, 0.75);
        border-radius: 2px;
        pointer-events: none;
        z-index: 10;
        transition: opacity 0.2s ease;
      }
      .streampulse-unmuted-indicator {
        position: absolute;
        bottom: 48px;
        right: 16px;
        background: rgba(14, 14, 16, 0.88);
        border: 1px solid rgba(0, 245, 155, 0.4);
        color: #efeff1;
        font-size: 12px;
        font-weight: 500;
        padding: 6px 10px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        gap: 6px;
        pointer-events: auto;
        backdrop-filter: blur(8px);
        z-index: 20;
        animation: spFadeIn 0.3s ease;
      }
      .streampulse-unmuted-indicator svg {
        width: 14px;
        height: 14px;
        fill: #00f59b;
        flex-shrink: 0;
      }
      @keyframes spFadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head?.appendChild(style);
  }

  function parseM3u8(text, playlistUrl) {
    const lines = text.split(/\r?\n/);
    const entries = [];
    let currentTime = 0;
    let pendingDuration = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith("#EXTINF:")) {
        const d = Number.parseFloat(line.slice(8).split(",")[0]);
        pendingDuration = Number.isFinite(d) && d >= 0 ? d : 10;
        continue;
      }
      if (line.startsWith("#")) continue;
      if (pendingDuration === null) continue;

      let absoluteUrl = line;
      try {
        absoluteUrl = new URL(line, playlistUrl).href;
      } catch (_e) {
        // url relative non resolue
      }

      entries.push({
        url: absoluteUrl,
        startTime: currentTime,
        duration: pendingDuration,
        isMuted: MUTED_MARKER.test(line),
      });

      currentTime += pendingDuration;
      pendingDuration = null;
    }

    return { entries, totalDuration: currentTime };
  }

  async function probeSegment(url) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res.status === 200 || res.status === 206;
    } catch (_err) {
      return false;
    }
  }

  async function processPlaylist(playlistUrl) {
    if (processedPlaylists.has(playlistUrl)) return;
    processedPlaylists.add(playlistUrl);

    try {
      const res = await fetch(playlistUrl);
      if (!res.ok) return;
      const text = await res.text();
      const parsed = parseM3u8(text, playlistUrl);
      if (!parsed || parsed.entries.length === 0) return;

      totalVodDuration = parsed.totalDuration;
      const mutedEntries = parsed.entries.filter((e) => e.isMuted);
      if (mutedEntries.length === 0) return;

      // Sonde les segments en parallèle par petits lots
      const validRedirects = [];
      const batchSize = 6;

      for (let i = 0; i < mutedEntries.length; i += batchSize) {
        const batch = mutedEntries.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (item) => {
            const unmutedUrl = item.url.replace(MUTED_MARKER, "");
            const exists = await probeSegment(unmutedUrl);
            if (exists) {
              validRedirects.push({
                sourceUrl: item.url,
                targetUrl: unmutedUrl,
                startTime: item.startTime,
                duration: item.duration,
              });
            }
          })
        );
      }

      if (validRedirects.length === 0) return;

      restoredRanges = validRedirects;

      // Si l'utilisateur a StreamPulse+, on installe les règles de redirection
      if (plusActive) {
        chrome.runtime.sendMessage(
          {
            type: "vodUnmuteInstallRules",
            redirects: validRedirects.map((v) => ({
              sourceUrl: v.sourceUrl,
              targetUrl: v.targetUrl,
            })),
          },
          (response) => {
            if (response?.ok) {
              paintSeekbar();
              showIndicator(validRedirects.length);
            }
          }
        );
      } else {
        // Notification informative pour non-abonnés
        showPromoIndicator(validRedirects.length);
      }
    } catch (error) {
      console.warn("[StreamPulse] Traitement playlist VOD :", error?.message || error);
    }
  }

  function paintSeekbar() {
    ensureStyles();
    const seekbar = document.querySelector("div.seekbar-bar");
    if (!seekbar || totalVodDuration <= 0) return;

    // Supprime les anciens marqueurs StreamPulse
    seekbar.querySelectorAll(".streampulse-unmuted-segment").forEach((el) => el.remove());

    for (const range of restoredRanges) {
      const segEl = document.createElement("div");
      segEl.className = "streampulse-unmuted-segment";
      const leftPercent = (range.startTime / totalVodDuration) * 100;
      const widthPercent = (range.duration / totalVodDuration) * 100;

      segEl.style.left = `${leftPercent.toFixed(3)}%`;
      segEl.style.width = `${Math.max(0.2, widthPercent).toFixed(3)}%`;
      segEl.title = "Audio restauré (StreamPulse+)";
      seekbar.appendChild(segEl);
    }
  }

  function showIndicator(count) {
    ensureStyles();
    const existing = document.getElementById("streampulse-unmute-badge");
    if (existing) existing.remove();

    const playerContainer = document.querySelector('div[data-a-target="video-player"]');
    if (!playerContainer) return;

    const badge = document.createElement("div");
    badge.id = "streampulse-unmute-badge";
    badge.className = "streampulse-unmuted-indicator";
    badge.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
      <span>StreamPulse+ : ${count} segments audio restaurés</span>
    `;

    playerContainer.appendChild(badge);
    setTimeout(() => badge.remove(), 6000);
  }

  function showPromoIndicator(count) {
    ensureStyles();
    const existing = document.getElementById("streampulse-unmute-badge");
    if (existing) return;

    const playerContainer = document.querySelector('div[data-a-target="video-player"]');
    if (!playerContainer) return;

    const badge = document.createElement("div");
    badge.id = "streampulse-unmute-badge";
    badge.className = "streampulse-unmuted-indicator";
    badge.style.borderColor = "rgba(145, 70, 255, 0.5)";
    badge.innerHTML = `
      <svg viewBox="0 0 24 24" style="fill: #9146ff;"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
      <span>${count} segments audio restaurables avec StreamPulse+</span>
    `;

    playerContainer.appendChild(badge);
    setTimeout(() => badge.remove(), 8000);
  }

  function scanExistingResources() {
    if (!isVodPage()) return;
    const entries = performance.getEntriesByType("resource");
    for (const e of entries) {
      if (e.name.includes("cloudfront.net") && e.name.includes(".m3u8")) {
        processPlaylist(e.name);
      }
    }
  }

  // Observer de requêtes réseau pour intercepter les flux HLS
  try {
    const perfObserver = new PerformanceObserver((list) => {
      if (!isVodPage()) return;
      for (const entry of list.getEntries()) {
        if (entry.name.includes("cloudfront.net") && entry.name.includes(".m3u8")) {
          processPlaylist(entry.name);
        }
      }
    });
    perfObserver.observe({ entryTypes: ["resource"] });
  } catch (_e) {
    // PerformanceObserver non disponible ou limite
  }

  // Vérification de changement de page SPA
  setInterval(() => {
    const newVodId = getVodId();
    if (newVodId !== currentVodId) {
      currentVodId = newVodId;
      processedPlaylists.clear();
      restoredRanges = [];
      totalVodDuration = 0;
      if (newVodId) {
        scanExistingResources();
      } else {
        chrome.runtime.sendMessage({ type: "vodUnmuteClearRules" }).catch(() => {});
      }
    } else if (isVodPage() && restoredRanges.length > 0) {
      // S'assure que la seekbar garde son affichage lors des re-rendus React
      const seekbar = document.querySelector("div.seekbar-bar");
      if (seekbar && !seekbar.querySelector(".streampulse-unmuted-segment")) {
        paintSeekbar();
      }
    }
  }, 1500);

  // Scan initial
  scanExistingResources();
})();
