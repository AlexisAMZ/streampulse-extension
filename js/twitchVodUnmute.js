(() => {
  "use strict";

  // StreamPulse+ : Restauration visuelle et démutage des segments VOD Twitch.

  if (window.__streampulseVodUnmute) return;
  window.__streampulseVodUnmute = true;

  const STYLE_ID = "streampulse-vod-unmute-styles";
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
        background: #00f59b;
        border-radius: 2px;
        box-shadow: 0 0 10px rgba(0, 245, 155, 0.85), 0 0 3px #00f59b;
        pointer-events: none;
        z-index: 10;
        transition: opacity 0.2s ease;
      }
      .streampulse-vod-unmute-tooltip {
        position: absolute;
        transform: translate(-50%, -100%);
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
      .streampulse-vod-unmute-tooltip .sp-pager-case {
        background: #11142f;
        border: 1px solid rgba(0, 245, 155, 0.45);
        border-radius: 8px;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.85), 0 0 14px rgba(0, 245, 155, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.18);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        padding: 5px 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: "SP Onest", Roobert, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .streampulse-vod-unmute-tooltip .sp-pager-tag {
        background: #1b1f4a;
        border: 1px solid rgba(0, 245, 155, 0.6);
        color: #00f59b;
        font-size: 10px;
        font-weight: 800;
        padding: 2px 6px;
        border-radius: 4px;
        letter-spacing: 0.4px;
        text-transform: uppercase;
      }
      .streampulse-vod-unmute-tooltip .sp-pager-text {
        color: #ffffff;
        font-size: 11px;
        font-weight: 600;
      }
      .streampulse-vod-unmute-tooltip .sp-pager-screen {
        background: #cdd9a5;
        color: #11142f;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: "DotGothic16", ui-monospace, "SF Mono", Menlo, monospace;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.5px;
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
      }
      .streampulse-vod-unmute-tooltip::after {
        content: "";
        position: absolute;
        bottom: -5px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 5px solid #11142f;
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

  async function resolveVod(vodId) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "vodUnmuteResolve", vodId }, (response) => {
        resolve(response || null);
      });
    });
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
        <div class="sp-pager-case">
          <span class="sp-pager-tag">StreamPulse+</span>
          <span class="sp-pager-text">${text}</span>
          <span class="sp-pager-screen">${startTc} · ${endTc}</span>
        </div>
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
      const data = await resolveVod(vodId);
      if (data?.ok && currentVodId === vodId) {
        vodResolved = true;
        totalVodDuration = data.totalDuration || 0;
        const validBatch = data.restoredRanges || [];
        if (validBatch.length > 0) {
          restoredRanges = validBatch;
          paintSeekbar();

          if (plusActive && data.isPlus) {
            const segmentIds = validBatch
              .map((v) => v.segmentId || extractSegmentId(v.sourceUrl))
              .filter(Boolean);

            if (segmentIds.length > 0) {
              chrome.runtime.sendMessage(
                {
                  type: "vodUnmuteInstallRules",
                  segmentIds,
                  redirects: validBatch.map((v) => ({
                    sourceUrl: v.sourceUrl,
                    targetUrl: v.targetUrl,
                  })),
                  append: false,
                },
                (response) => {
                  if (response?.ok && !indicatorShown) {
                    indicatorShown = true;
                    showIndicator();
                  }
                }
              );
            }
          } else if (!promoShown) {
            promoShown = true;
            showPromoIndicator();
          }
        }
      }
    } catch (err) {
      console.warn("[StreamPulse] Résolution VOD :", err?.message || err);
    } finally {
      isResolving = false;
    }
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
