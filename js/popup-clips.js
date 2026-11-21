// Vue Clips : import direct, détection d'onglet actif, données du clip
// et passerelle directe vers le studio 9:16 de StreamPulse Clips.

import { t } from "./i18n.js";

const HISTORY_KEY = "spClipsHistory";
const HANDOFF = globalThis.StreamPulseClipsHandoff;

const $ = (id) => document.getElementById(id);

let initialized = false;

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseClip(input) {
  if (HANDOFF && typeof HANDOFF.parseClipUrl === "function") {
    return HANDOFF.parseClipUrl(input);
  }
  // Repli autonome
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  const twitchMatch = /(?:clips\.twitch\.tv\/|twitch\.tv\/[^/]+\/clip\/)([A-Za-z0-9_-]+)/i.exec(trimmed);
  if (twitchMatch) {
    return {
      platform: "twitch",
      slug: twitchMatch[1],
      channel: null,
      canonicalUrl: `https://clips.twitch.tv/${twitchMatch[1]}`,
    };
  }
  const kickMatch = /kick\.com\/([^?]+)\?clip=([A-Za-z0-9_-]+)/i.exec(trimmed);
  if (kickMatch) {
    return {
      platform: "kick",
      slug: kickMatch[2],
      channel: kickMatch[1],
      canonicalUrl: `https://kick.com/${kickMatch[1]}?clip=${kickMatch[2]}`,
    };
  }
  return null;
}

function buildEditorUrl(canonicalUrl, campaign = "popup_clips_tab") {
  if (HANDOFF && typeof HANDOFF.editorUrlForClip === "function") {
    return HANDOFF.editorUrlForClip(canonicalUrl, campaign);
  }
  const url = new URL("https://spclips.com/app");
  url.searchParams.set("clip", canonicalUrl);
  url.searchParams.set("utm_source", "streampulse");
  url.searchParams.set("utm_medium", "extension");
  url.searchParams.set("utm_campaign", campaign);
  return url.toString();
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return "À l'instant";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} j`;
}

export async function renderClipsPanel() {
  const container = $("clips-recent-list");
  const emptyState = $("clips-recent-empty");
  const clearBtn = $("clips-btn-clear");
  if (!container) return;

  try {
    const data = await chrome.storage.local.get([HISTORY_KEY]);
    const list = Array.isArray(data?.[HISTORY_KEY]) ? data[HISTORY_KEY] : [];

    if (list.length === 0) {
      container.innerHTML = "";
      emptyState?.removeAttribute("hidden");
      clearBtn?.setAttribute("hidden", "true");
      return;
    }

    emptyState?.setAttribute("hidden", "true");
    clearBtn?.removeAttribute("hidden");

    container.innerHTML = list
      .map((clip) => {
        const title = escapeHtml(clip.title || clip.slug || "Clip");
        const channel = escapeHtml(clip.channel || "");
        const platform = escapeHtml(clip.platform || "twitch");
        const editorUrl = escapeHtml(buildEditorUrl(clip.url || clip.canonicalUrl || clip.id, "popup_clips_history"));
        const timeAgo = formatRelativeTime(clip.openedAt || clip.createdAt);

        return `
          <li class="clips-card" data-clip-id="${escapeHtml(clip.id)}">
            <div class="clips-card-body">
              <div class="clips-card-platform clips-card-platform-${platform}">
                ${platform.toUpperCase()}
              </div>
              <div class="clips-card-meta">
                <strong class="clips-card-title">${title}</strong>
                <span class="clips-card-sub">${channel ? `@${channel} · ` : ""}${timeAgo}</span>
              </div>
            </div>
            <div class="clips-card-actions">
              <a href="${editorUrl}" target="_blank" rel="noopener" class="button button-accent button-sm" data-i18n="popup.clips.openInSp">
                ${escapeHtml(t("popup.clips.openInSp") || "Monter en 9:16")}
              </a>
              <button type="button" class="icon-button clips-card-remove" data-clip-id="${escapeHtml(clip.id)}" title="Supprimer" aria-label="Supprimer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </li>
        `;
      })
      .join("");

    // Écouteurs de suppression
    container.querySelectorAll(".clips-card-remove").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const idToRemove = btn.dataset.clipId;
        const current = await chrome.storage.local.get([HISTORY_KEY]);
        const updated = (Array.isArray(current?.[HISTORY_KEY]) ? current[HISTORY_KEY] : []).filter(
          (c) => c.id !== idToRemove
        );
        await chrome.storage.local.set({ [HISTORY_KEY]: updated });
        renderClipsPanel();
      });
    });
  } catch (err) {
    console.warn("StreamPulse: Erreur rendu panel clips", err);
  }
}

export function initClipsTab() {
  if (initialized) return;
  initialized = true;

  const inputUrl = $("clips-input-url");
  const convertBtn = $("clips-btn-convert");
  const detectBtn = $("clips-btn-detect");
  const clearBtn = $("clips-btn-clear");
  const errorEl = $("clips-input-error");

  function showError(msg) {
    if (!errorEl) return;
    if (!msg) {
      errorEl.setAttribute("hidden", "true");
      errorEl.textContent = "";
    } else {
      errorEl.removeAttribute("hidden");
      errorEl.textContent = msg;
    }
  }

  async function processInputUrl() {
    const raw = inputUrl?.value?.trim();
    if (!raw) {
      showError(t("popup.clips.errorEmpty") || "Veuillez coller un lien de clip Twitch ou Kick.");
      return;
    }
    const parsed = parseClip(raw);
    if (!parsed) {
      showError(t("popup.clips.errorInvalid") || "Lien de clip non reconnu. Exemples : https://clips.twitch.tv/... ou https://kick.com/...clip=...");
      return;
    }
    showError("");

    // Sauvegarde dans l'historique
    const item = {
      id: parsed.slug,
      url: parsed.canonicalUrl,
      title: `Clip ${parsed.slug}`,
      channel: parsed.channel || "",
      platform: parsed.platform,
      createdAt: Date.now(),
    };
    if (HANDOFF && typeof HANDOFF.saveClipToHistory === "function") {
      await HANDOFF.saveClipToHistory(item);
    } else {
      const current = await chrome.storage.local.get([HISTORY_KEY]);
      const list = Array.isArray(current?.[HISTORY_KEY]) ? current[HISTORY_KEY] : [];
      const updated = [item, ...list.filter((c) => c.id !== item.id)].slice(0, 40);
      await chrome.storage.local.set({ [HISTORY_KEY]: updated });
    }

    renderClipsPanel();

    // Ouvre dans SP Clips
    const editorUrl = buildEditorUrl(parsed.canonicalUrl, "popup_clips_input");
    window.open(editorUrl, "_blank", "noopener");
  }

  convertBtn?.addEventListener("click", processInputUrl);
  inputUrl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      processInputUrl();
    }
  });

  // Détection de l'onglet actif
  detectBtn?.addEventListener("click", async () => {
    showError("");
    try {
      if (typeof chrome === "undefined" || !chrome.tabs?.query) {
        showError("Impossible d'accéder aux onglets du navigateur.");
        return;
      }
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab || !activeTab.url) {
        showError("Aucun onglet actif détecté.");
        return;
      }
      const parsed = parseClip(activeTab.url);
      if (parsed) {
        if (inputUrl) inputUrl.value = parsed.canonicalUrl;
        showError("");
      } else {
        showError("L'onglet actif n'est pas un clip Twitch ou Kick reconnu.");
      }
    } catch (err) {
      showError("Échec de la détection de l'onglet actif.");
    }
  });

  // Effacer tout l'historique
  clearBtn?.addEventListener("click", async () => {
    await chrome.storage.local.set({ [HISTORY_KEY]: [] });
    renderClipsPanel();
  });

  // Bouton retour vers l'extension
  const backBtn = $("clips-back-to-ext");
  backBtn?.addEventListener("click", () => {
    document.getElementById("tab-streamers")?.click();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const universe = $("clips-universe");
      if (universe && !universe.classList.contains("hidden")) {
        document.getElementById("tab-streamers")?.click();
      }
    }
  });

  renderClipsPanel();
}
