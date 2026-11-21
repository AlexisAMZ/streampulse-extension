(() => {
  "use strict";

  // StreamPulse+ : Démutage automatique des rediffusions (VODs) Twitch coupées par le copyright.
  // Détecte les flux M3U8 de VOD hébergés sur CloudFront, sonde la présence des segments originaux
  // sans filtre DMCA (*.ts), installe les règles de redirection et met en valeur les zones
  // restaurées sur la barre de progression avec un halo vert émeraude signature StreamPulse
  // et une infobulle interactive au survol.

  if (window.__streampulseVodUnmute) return;
  window.__streampulseVodUnmute = true;

  const MUTED_MARKER = /-(?:muted|unmuted)(?=\.[^.]*(?:\?|$))/;
  const STYLE_ID = "streampulse-vod-unmute-styles";
  const processedPlaylists = new Set();
  let currentVodId = null;
  let vodResolved = false;
  let isResolving = false;
  let plusActive = false;
  let restoredRanges = [];
  let totalVodDuration = 0;
  let indicatorShown = false;
  let promoShown = false;

  const TOOLTIP_TEXTS = {
    fr: "Récupéré grâce à StreamPulse+",
    en: "Restored with StreamPulse+",
    es: "Recuperado con StreamPulse+",
    "pt-BR": "Recuperado com StreamPulse+",
    de: "Wiederhergestellt mit StreamPulse+",
    it: "Recuperato con StreamPulse+",
    pl: "Przywrócono dzięki StreamPulse+",
    tr: "StreamPulse+ ile geri yüklendi",
    ru: "Восстановлено с StreamPulse+",
    ja: "StreamPulse+で復元済み",
    ko: "StreamPulse+로 복원됨",
    ar: "تمت الاستعادة عبر StreamPulse+",
    uk: "Відновлено за допомогою StreamPulse+",
  };

  function isVodPage() {
    return /\/videos?\/(\d+)/.test(window.location.pathname);
  }

  function getVodId() {
    const match = /\/videos?\/(\d+)/.exec(window.location.pathname);
    return match ? match[1] : null;
  }

  function getTooltipText() {
    let lang = "fr";
    if (typeof window !== "undefined" && window.__SP_I18N__?.resolve) {
      lang = window.__SP_I18N__.resolve(navigator.language || "fr");
    } else if (navigator.language) {
      lang = navigator.language.split("-")[0];
    }
    return TOOLTIP_TEXTS[lang] || TOOLTIP_TEXTS.fr;
  }

  function extractSegmentId(url) {
    if (!url || typeof url !== "string") return null;
    const match = /\/([^/?#]+)-(?:muted|unmuted)(?=\.[^.]*(?:\?|$))/.exec(url);
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
        if (restoredRanges.length > 0) {
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
        background: linear-gradient(90deg, #00f59b, #10b981, #00f59b);
        background-size: 200% 100%;
        animation: streampulse-emerald-glow 2.8s ease-in-out infinite;
        border-radius: 2px;
        box-shadow: 0 0 8px rgba(0, 245, 155, 0.75), 0 0 2px rgba(255, 255, 255, 0.85);
        pointer-events: none;
        z-index: 10;
        transition: opacity 0.2s ease;
      }
      @keyframes streampulse-emerald-glow {
        0% {
          background-position: 0% 50%;
          box-shadow: 0 0 6px rgba(0, 245, 155, 0.65), 0 0 2px rgba(255, 255, 255, 0.7);
        }
        50% {
          background-position: 100% 50%;
          box-shadow: 0 0 14px rgba(0, 245, 155, 0.95), 0 0 3px rgba(255, 255, 255, 1);
        }
        100% {
          background-position: 0% 50%;
          box-shadow: 0 0 6px rgba(0, 245, 155, 0.65), 0 0 2px rgba(255, 255, 255, 0.7);
        }
      }
      .streampulse-vod-unmute-tooltip {
        position: absolute;
        transform: translate(-50%, -100%);
        background: rgba(11, 12, 34, 0.94);
        border: 1px solid rgba(0, 245, 155, 0.5);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.8), 0 0 12px rgba(0, 245, 155, 0.35);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: #f4f2f7;
        padding: 5px 10px;
        border-radius: 6px;
        font-family: "SP Onest", Roobert, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 11px;
        font-weight: 500;
        line-height: 1.3;
        display: flex;
        align-items: center;
        gap: 6px;
        pointer-events: none;
        z-index: 99999;
        white-space: nowrap;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease;
      }
      .streampulse-vod-unmute-tooltip.is-visible {
        opacity: 1;
        visibility: visible;
      }
      .streampulse-vod-unmute-tooltip .sp-tip-pill {
        background: linear-gradient(135deg, #00f59b, #10b981);
        color: #0b0c22;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        letter-spacing: 0.3px;
        text-transform: uppercase;
      }
      .streampulse-vod-unmute-tooltip .sp-tip-text {
        color: #ffffff;
        font-weight: 600;
      }
      .streampulse-vod-unmute-tooltip .sp-tip-time {
        color: rgba(244, 242, 247, 0.65);
        font-size: 10px;
        font-weight: 400;
      }
      .streampulse-unmuted-indicator {
        position: absolute;
        bottom: 48px;
        right: 16px;
        background: rgba(14, 14, 16, 0.88);
        border: 1px solid rgba(255, 255, 255, 0.3);
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

  function extractFirstMediaPlaylist(masterText, baseUrl) {
    const lines = masterText.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("#EXT-X-STREAM-INF") && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine && !nextLine.startsWith("#")) {
          try {
            return new URL(nextLine, baseUrl).href;
          } catch (_e) {
            return nextLine;
          }
        }
      }
    }
    return null;
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
        // url relative
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
      const timeoutId = setTimeout(() => controller.abort(), 2500);
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

  async function fetchVodPlaylistFromGql(vodId) {
    try {
      const res = await fetch("https://gql.twitch.tv/gql", {
        method: "POST",
        headers: {
          "Client-ID": "kimne78kx3ncx6brgo4mv6wki5h1ko",
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            operationName: "VideoPlayer_SeekPreviews",
            query: "query VideoPlayer_SeekPreviews($videoID: ID!) { video(id: $videoID) { id seekPreviewsURL } }",
            variables: { videoID: vodId },
          },
        ]),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const seekPreviewsURL = data?.[0]?.data?.video?.seekPreviewsURL;
      if (!seekPreviewsURL || !seekPreviewsURL.includes("/storyboards/")) return null;

      // Déduit l'URL de la playlist chunked à partir de l'URL du storyboard
      const playlistUrl = seekPreviewsURL.replace(/storyboards\/.*$/, "chunked/index-dvr.m3u8");
      return playlistUrl;
    } catch (_e) {
      return null;
    }
  }

  async function processPlaylist(playlistUrl) {
    if (processedPlaylists.has(playlistUrl)) return;
    processedPlaylists.add(playlistUrl);

    try {
      const res = await fetch(playlistUrl);
      if (!res.ok) return;
      const text = await res.text();

      // Prise en charge des master playlists (Usher / multi-variantes)
      if (!text.includes("#EXTINF:") && text.includes("#EXT-X-STREAM-INF")) {
        const variantUrl = extractFirstMediaPlaylist(text, playlistUrl);
        if (variantUrl) {
          return processPlaylist(variantUrl);
        }
      }

      const parsed = parseM3u8(text, playlistUrl);
      if (!parsed || parsed.entries.length === 0) return;

      totalVodDuration = parsed.totalDuration;
      const mutedEntries = parsed.entries.filter((e) => e.isMuted);
      if (mutedEntries.length === 0) return;

      // Sondage en parallèle par lots de 20 avec installation progressive
      const batchSize = 20;

      for (let i = 0; i < mutedEntries.length; i += batchSize) {
        const batch = mutedEntries.slice(i, i + batchSize);
        const validBatch = [];

        await Promise.all(
          batch.map(async (item) => {
            const unmutedUrl = item.url.replace(MUTED_MARKER, "");
            const exists = await probeSegment(unmutedUrl);
            if (exists) {
              validBatch.push({
                sourceUrl: item.url,
                targetUrl: unmutedUrl,
                startTime: item.startTime,
                duration: item.duration,
              });
            }
          })
        );

        if (validBatch.length > 0) {
          restoredRanges = restoredRanges.concat(validBatch);
          paintSeekbar();

          if (plusActive) {
            const segmentIds = validBatch
              .map((v) => extractSegmentId(v.sourceUrl))
              .filter(Boolean);

            chrome.runtime.sendMessage(
              {
                type: "vodUnmuteInstallRules",
                segmentIds,
                redirects: validBatch.map((v) => ({
                  sourceUrl: v.sourceUrl,
                  targetUrl: v.targetUrl,
                })),
                append: true,
              },
              (response) => {
                if (response?.ok && !indicatorShown) {
                  indicatorShown = true;
                  showIndicator();
                }
              }
            );
          } else if (!promoShown) {
            promoShown = true;
            showPromoIndicator();
          }
        }
      }
    } catch (error) {
      console.warn("[StreamPulse] Traitement playlist VOD :", error?.message || error);
    }
  }

  function mergeContinuousRanges(ranges) {
    if (!ranges || ranges.length === 0) return [];
    const sorted = [...ranges].sort((a, b) => a.startTime - b.startTime);
    const merged = [];
    let cur = { ...sorted[0] };

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];
      if (Math.abs(cur.startTime + cur.duration - next.startTime) < 0.5) {
        cur.duration += next.duration;
      } else {
        merged.push(cur);
        cur = { ...next };
      }
    }
    merged.push(cur);
    return merged;
  }

  function formatTimecode(seconds) {
    const s = Math.floor(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  function getOrCreateTooltip(container) {
    let tip = document.getElementById("streampulse-vod-tooltip");
    if (!tip) {
      tip = document.createElement("div");
      tip.id = "streampulse-vod-tooltip";
      tip.className = "streampulse-vod-unmute-tooltip";
      container.appendChild(tip);
    } else if (tip.parentElement !== container) {
      container.appendChild(tip);
    }
    return tip;
  }

  function hideTooltip() {
    const tip = document.getElementById("streampulse-vod-tooltip");
    if (tip) {
      tip.classList.remove("is-visible");
    }
  }

  function setupSeekbarHover(seekbar) {
    const hitArea = seekbar.closest('[data-a-target="player-seekbar"]') || seekbar.parentElement || seekbar;
    if (hitArea.__spHoverAttached) return;
    hitArea.__spHoverAttached = true;

    hitArea.addEventListener("mousemove", (e) => {
      if (restoredRanges.length === 0 || totalVodDuration <= 0) {
        hideTooltip();
        return;
      }

      const rect = seekbar.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      if (ratio < 0 || ratio > 1) {
        hideTooltip();
        return;
      }

      const hoverTime = ratio * totalVodDuration;
      const merged = mergeContinuousRanges(restoredRanges);
      const matched = merged.find(
        (r) => hoverTime >= r.startTime && hoverTime <= r.startTime + r.duration
      );

      if (!matched) {
        hideTooltip();
        return;
      }

      const player = document.querySelector('div[data-a-target="video-player"]') || document.body;
      const tip = getOrCreateTooltip(player);
      const startTc = formatTimecode(matched.startTime);
      const endTc = formatTimecode(matched.startTime + matched.duration);
      const text = getTooltipText();

      tip.innerHTML = `
        <span class="sp-tip-pill">StreamPulse+</span>
        <span class="sp-tip-text">${text}</span>
        <span class="sp-tip-time">(${startTc} · ${endTc})</span>
      `;

      if (player !== document.body) {
        const pRect = player.getBoundingClientRect();
        const clampedX = Math.max(100, Math.min(pRect.width - 100, e.clientX - pRect.left));
        const topOffset = rect.top - pRect.top - 12;
        tip.style.left = `${clampedX}px`;
        tip.style.top = `${topOffset}px`;
        tip.style.bottom = "auto";
        tip.style.position = "absolute";
      } else {
        tip.style.left = `${e.clientX}px`;
        tip.style.top = `${rect.top - 12}px`;
        tip.style.bottom = "auto";
        tip.style.position = "fixed";
      }

      tip.classList.add("is-visible");
    });

    hitArea.addEventListener("mouseleave", () => {
      hideTooltip();
    });
  }

  function paintSeekbar() {
    ensureStyles();
    const seekbar = document.querySelector("div.seekbar-bar");
    if (!seekbar || totalVodDuration <= 0) return;

    setupSeekbarHover(seekbar);

    // Supprime les anciens marqueurs StreamPulse
    seekbar.querySelectorAll(".streampulse-unmuted-segment").forEach((el) => el.remove());

    const merged = mergeContinuousRanges(restoredRanges);

    for (const range of merged) {
      const segEl = document.createElement("div");
      segEl.className = "streampulse-unmuted-segment";
      const leftPercent = (range.startTime / totalVodDuration) * 100;
      const widthPercent = (range.duration / totalVodDuration) * 100;

      const startTc = formatTimecode(range.startTime);
      const endTc = formatTimecode(range.startTime + range.duration);

      segEl.style.left = `${leftPercent.toFixed(3)}%`;
      segEl.style.width = `${Math.max(0.25, widthPercent).toFixed(3)}%`;
      segEl.title = `StreamPulse+ : Récupéré grâce à StreamPulse+ (${startTc} · ${endTc})`;
      seekbar.appendChild(segEl);
    }
  }

  function showIndicator() {
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
      <span>StreamPulse+ : segments audio restaurés</span>
    `;

    playerContainer.appendChild(badge);
    setTimeout(() => badge.remove(), 6000);
  }

  function showPromoIndicator() {
    ensureStyles();
    const existing = document.getElementById("streampulse-unmute-promo");
    if (existing) return;

    const playerContainer = document.querySelector('div[data-a-target="video-player"]');
    if (!playerContainer) return;

    const promo = document.createElement("div");
    promo.id = "streampulse-unmute-promo";
    promo.className = "streampulse-unmuted-indicator";
    promo.style.cursor = "pointer";
    promo.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
      <span>Audio disponible avec StreamPulse+</span>
    `;
    promo.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "openSettings", panel: "plus" });
    });

    playerContainer.appendChild(promo);
    setTimeout(() => promo.remove(), 8000);
  }

  function resetVodState() {
    currentVodId = null;
    vodResolved = false;
    isResolving = false;
    processedPlaylists.clear();
    restoredRanges = [];
    totalVodDuration = 0;
    indicatorShown = false;
    promoShown = false;
    hideTooltip();
    document.querySelectorAll(".streampulse-unmuted-segment").forEach((el) => el.remove());
    chrome.runtime.sendMessage({ type: "vodUnmuteClearRules" }).catch(() => {});
  }

  async function checkCurrentVod() {
    if (!isVodPage()) {
      if (currentVodId) resetVodState();
      return;
    }
    const vodId = getVodId();
    if (!vodId) return;

    if (vodId !== currentVodId) {
      resetVodState();
      currentVodId = vodId;
    }

    if (vodResolved || isResolving) return;

    isResolving = true;
    try {
      const gqlPlaylistUrl = await fetchVodPlaylistFromGql(vodId);
      if (gqlPlaylistUrl && currentVodId === vodId) {
        vodResolved = true;
        await processPlaylist(gqlPlaylistUrl);
      }
    } catch (err) {
      console.warn("[StreamPulse] Résolution VOD :", err?.message || err);
    } finally {
      isResolving = false;
    }
  }

  // Observer de requêtes réseau pour intercepter les flux HLS alternatifs
  try {
    const perfObserver = new PerformanceObserver((list) => {
      if (!isVodPage()) return;
      for (const entry of list.getEntries()) {
        if (entry.name.includes(".m3u8") && (entry.name.includes("cloudfront.net") || entry.name.includes("ttvnw.net"))) {
          processPlaylist(entry.name);
        }
      }
    });
    perfObserver.observe({ entryTypes: ["resource"] });
  } catch (_e) {
    // PerformanceObserver indisponible
  }

  // Détection instantanée des navigations SPA
  function notifyNavigation() {
    requestAnimationFrame(() => {
      checkCurrentVod();
    });
  }

  window.addEventListener("popstate", notifyNavigation);
  try {
    const origPushState = history.pushState;
    if (typeof origPushState === "function") {
      history.pushState = function (...args) {
        origPushState.apply(this, args);
        notifyNavigation();
      };
    }
    const origReplaceState = history.replaceState;
    if (typeof origReplaceState === "function") {
      history.replaceState = function (...args) {
        origReplaceState.apply(this, args);
        notifyNavigation();
      };
    }
  } catch (_e) {
    // Fallback sans hook d'historique
  }

  // Boucle de surveillance SPA et maintien de la seekbar
  setInterval(() => {
    if (isVodPage()) {
      checkCurrentVod();
      const seekbar = document.querySelector("div.seekbar-bar");
      if (seekbar && restoredRanges.length > 0 && !seekbar.querySelector(".streampulse-unmuted-segment")) {
        paintSeekbar();
      }
    } else if (currentVodId) {
      resetVodState();
    }
  }, 1200);

  // Lancement immédiat
  checkCurrentVod();
})();
