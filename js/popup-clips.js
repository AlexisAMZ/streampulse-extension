// Onglet Clips : liste des clips ouverts récemment (depuis le bouton du lecteur Twitch)
// et lien de chacun vers le studio 9:16 de StreamPulse Clips.

import { t } from "./i18n.js";

const HISTORY_KEY = "spClipsHistory";
const HANDOFF = globalThis.StreamPulseClipsHandoff;
const UNDO_DELAY_MS = 6000;

const $ = (id) => document.getElementById(id);

let initialized = false;
/** Dernier clip retiré, gardé quelques secondes pour pouvoir l'annuler. */
let pendingUndo = null;

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

/** « il y a 12 min », « il y a 3 h », « il y a 2 j » : mêmes clés que l'onglet Historique. */
function agoLabel(timestamp, now = Date.now()) {
  if (!timestamp) return "";
  const minutes = Math.max(1, Math.round((now - timestamp) / 60000));
  if (minutes < 60) return t("popup.history.agoMinutes", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("popup.history.agoHours", { count: hours });
  return t("popup.history.agoDays", { count: Math.round(hours / 24) });
}

/** Ce qui identifie le clip dans la liste : son titre s'il en a un vrai, sinon la chaîne, sinon son identifiant. */
function clipLabel(clip) {
  const title = typeof clip.title === "string" ? clip.title.trim() : "";
  if (title && title !== "Clip" && !/^Clip\s/.test(title)) return title;
  return clip.channel ? `@${clip.channel}` : String(clip.slug || clip.id || "");
}

async function readHistory() {
  const data = await chrome.storage.local.get([HISTORY_KEY]);
  return Array.isArray(data?.[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
}

function writeHistory(list) {
  return chrome.storage.local.set({ [HISTORY_KEY]: list });
}

/** Logo de la plateforme : le vrai, en pastille. */
function platformChipHtml(platform) {
  const name = platform === "kick" ? "Kick" : "Twitch";
  return `<span class="clips-card-platform clips-card-platform-${platform}" role="img" aria-label="${name}"><img src="../images/platforms/${platform}.svg" alt="" width="18" height="18" /></span>`;
}

/** Vignette du clip si l'historique en a gardé une (https seulement), avec le logo de la plateforme en coin. */
function leadingVisualHtml(clip, platform) {
  const thumb = typeof clip.thumbnailUrl === "string" && /^https:\/\//i.test(clip.thumbnailUrl) ? clip.thumbnailUrl : "";
  if (!thumb) return platformChipHtml(platform);
  return `<span class="clips-card-thumb"><img class="clips-card-thumb-img" src="${escapeHtml(thumb)}" alt="" loading="lazy" />${platformChipHtml(platform)}</span>`;
}

function clipRowHtml(clip) {
  const platform = clip.platform === "kick" ? "kick" : "twitch";
  const label = clipLabel(clip);
  const editorUrl = buildEditorUrl(clip.url || clip.canonicalUrl || clip.id, "popup_clips_history");
  const slug = String(clip.slug || clip.id || "");
  const sub = [
    clip.channel && label !== `@${clip.channel}` ? `@${clip.channel}` : "",
    agoLabel(clip.openedAt || clip.createdAt),
    slug && slug !== label ? slug : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const removeLabel = escapeHtml(t("popup.clips.remove"));
  const openLabel = escapeHtml(t("popup.clips.openInSpLabel", { name: label }));
  return `
    <li class="clips-card" data-clip-id="${escapeHtml(String(clip.id))}">
      ${leadingVisualHtml(clip, platform)}
      <div class="clips-card-meta">
        <strong class="clips-card-title">${escapeHtml(label)}</strong>
        ${sub ? `<span class="clips-card-sub">${escapeHtml(sub)}</span>` : ""}
      </div>
      <div class="clips-card-actions">
        <a href="${escapeHtml(editorUrl)}" target="_blank" rel="noopener" class="clips-card-open" aria-label="${openLabel}">${escapeHtml(t("popup.clips.openInSp"))}</a>
        <button type="button" class="clips-card-remove" data-clip-id="${escapeHtml(String(clip.id))}" title="${removeLabel}" aria-label="${removeLabel}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </li>`;
}

export async function renderClipsPanel() {
  const container = $("clips-recent-list");
  const section = $("clips-recent-section");
  const hint = $("clips-empty-hint");
  if (!container) return;

  try {
    const list = await readHistory();
    if (section) section.hidden = list.length === 0;
    if (hint) hint.hidden = list.length > 0 || pendingUndo !== null;
    container.innerHTML = list.map(clipRowHtml).join("");
    // Les vignettes qui ne chargent pas laissent la place au logo seul.
    for (const img of container.querySelectorAll(".clips-card-thumb-img")) {
      img.addEventListener("error", () => img.remove(), { once: true });
    }
  } catch (err) {
    console.warn("StreamPulse: impossible d'afficher les clips récents", err);
  }
}

export function initClipsTab() {
  if (initialized) return;
  initialized = true;

  const clearBtn = $("clips-btn-clear");
  const confirmBox = $("clips-clear-confirm");
  const container = $("clips-recent-list");
  const undoBar = $("clips-undo");

  function setClearConfirm(open) {
    if (confirmBox) confirmBox.hidden = !open;
    if (clearBtn) clearBtn.hidden = open;
    if (open) $("clips-clear-no")?.focus();
    else clearBtn?.focus();
  }

  function hideUndo() {
    if (pendingUndo) clearTimeout(pendingUndo.timer);
    pendingUndo = null;
    if (undoBar) undoBar.hidden = true;
  }

  clearBtn?.addEventListener("click", () => setClearConfirm(true));
  $("clips-clear-no")?.addEventListener("click", () => setClearConfirm(false));
  $("clips-clear-yes")?.addEventListener("click", async () => {
    hideUndo();
    await writeHistory([]);
    setClearConfirm(false);
    renderClipsPanel();
  });
  confirmBox?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setClearConfirm(false);
    }
  });

  // Retrait d'un clip : immédiat, avec quelques secondes pour revenir en arrière.
  container?.addEventListener("click", async (e) => {
    const btn = e.target instanceof Element ? e.target.closest(".clips-card-remove") : null;
    if (!btn) return;
    const idToRemove = btn.dataset.clipId;
    const list = await readHistory();
    const index = list.findIndex((c) => String(c.id) === idToRemove);
    if (index < 0) return;
    hideUndo();
    pendingUndo = { clip: list[index], index, timer: setTimeout(() => { hideUndo(); renderClipsPanel(); }, UNDO_DELAY_MS) };
    await writeHistory(list.filter((_, i) => i !== index));
    if (undoBar) undoBar.hidden = false;
    renderClipsPanel();
  });

  $("clips-undo-btn")?.addEventListener("click", async () => {
    const undo = pendingUndo;
    hideUndo();
    if (!undo) return;
    const list = await readHistory();
    if (list.some((c) => String(c.id) === String(undo.clip.id))) return;
    const next = [...list.slice(0, undo.index), undo.clip, ...list.slice(undo.index)];
    await writeHistory(next);
    renderClipsPanel();
  });

  renderClipsPanel();
}
