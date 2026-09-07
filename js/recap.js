// Page de recapitulatif ZEvent : lit le storage, dessine la carte, propose l'export.

import { buildRecap, formatHours } from "./recap-data.js";
import { drawRecapCard, CARD_WIDTH, CARD_HEIGHT } from "./recap-card.js";
import { drawRecapStory, STORY_WIDTH, STORY_HEIGHT } from "./recap-story.js";

const WATCH_TIME_KEY = "betaWatchTimeData";
const PREFERENCES_KEY = "betaGeneralPreferences";
const RECAP_MONTH = "2026-09";

// Cagnotte finale annoncee a la cloture du ZEvent 2026.
const DONATION_TOTAL_LABEL = "32 891 874 €";

// Les deux formats partagent le meme modele : seule la mise en page change.
const FORMATS = {
  twitter: { width: CARD_WIDTH, height: CARD_HEIGHT, draw: drawRecapCard, suffix: "twitter" },
  story: { width: STORY_WIDTH, height: STORY_HEIGHT, draw: drawRecapStory, suffix: "story" },
};

let currentFormat = "twitter";
let renderModel = null;
let renderAssets = null;

const canvas = document.getElementById("recap-canvas");
const stageEl = document.getElementById("stage");
const stateEl = document.getElementById("state");
const emptyEl = document.getElementById("empty");
const actionsEl = document.getElementById("actions");
const downloadBtn = document.getElementById("download");
const tweetBtn = document.getElementById("tweet");
const formatsEl = document.getElementById("formats");

/**
 * Charge une image pour le canvas.
 *
 * Les avatars viennent du CDN Twitch : si la reponse n'autorise pas le partage
 * cross-origin, dessiner l'image contaminerait le canvas et ferait echouer
 * toBlob(). On resout alors `null`, et la carte retombe sur les initiales.
 */
function loadImage(src, { crossOrigin = false } = {}) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadAvatars(entries) {
  const pairs = await Promise.all(
    entries.map(async (entry) => [
      entry.channel,
      await loadImage(entry.avatarUrl, { crossOrigin: true }),
    ])
  );
  return new Map(pairs.filter(([, image]) => image !== null));
}

function show(el, visible) {
  if (el) el.hidden = !visible;
}

/** Nom de fichier sans espace ni accent, sur lequel les OS ne butent pas. */
function downloadFileName() {
  return `zevent-2026-streampulse-${FORMATS[currentFormat].suffix}.png`;
}

/** (Re)dessine la carte dans le format courant. */
function render() {
  if (!renderModel) return;
  const format = FORMATS[currentFormat];
  canvas.width = format.width;
  canvas.height = format.height;
  canvas.dataset.format = currentFormat;
  format.draw(canvas.getContext("2d"), renderModel, renderAssets);
}

function exportCard() {
  canvas.toBlob((blob) => {
    if (!blob) {
      stateEl.textContent =
        "L'image n'a pas pu être générée. Recharge la page et réessaie.";
      show(stateEl, true);
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = downloadFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Laisser au navigateur le temps de lire le blob avant de le liberer.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }, "image/png");
}

function openTweetComposer(recap) {
  const top = recap.top[0];
  const lines = [
    `Mon ZEvent 2026 : ${formatHours(recap.totalSeconds)} de stream chez ${recap.streamerCount} streamers.`,
    top ? `Le plus regardé : ${top.channel} (${formatHours(top.watchSeconds)}).` : "",
    `Cagnotte finale : ${DONATION_TOTAL_LABEL} 💚`,
    "",
    "Récap généré avec StreamPulse.",
  ].filter(Boolean);

  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(lines.join("\n"))}`;
  window.open(url, "_blank", "noopener");
}

async function init() {
  let stored;
  let prefs;
  try {
    const data = await chrome.storage.local.get([WATCH_TIME_KEY, PREFERENCES_KEY]);
    stored = data[WATCH_TIME_KEY] || {};
    prefs = data[PREFERENCES_KEY] || {};
  } catch (_e) {
    stateEl.textContent = "Impossible de lire tes statistiques locales.";
    return;
  }

  const recap = buildRecap(stored, RECAP_MONTH);

  if (recap.isEmpty) {
    show(stateEl, false);
    show(emptyEl, true);
    return;
  }

  const [avatars, logo, zeventLogo] = await Promise.all([
    loadAvatars(recap.top),
    loadImage("../images/photos/128px.png"),
    loadImage("../images/zevent26.png"),
  ]);

  renderModel = {
    ...recap,
    pseudo: (prefs.pseudo || "").trim(),
    donationLabel: DONATION_TOTAL_LABEL,
  };
  renderAssets = { avatars, logo, zeventLogo };
  render();

  show(stateEl, false);
  show(stageEl, true);
  show(actionsEl, true);
  show(formatsEl, true);

  formatsEl?.addEventListener("click", (event) => {
    const button = event.target.closest(".format-btn");
    if (!button || button.dataset.format === currentFormat) return;
    currentFormat = button.dataset.format;
    formatsEl.querySelectorAll(".format-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.format === currentFormat);
    });
    render();
  });

  downloadBtn.addEventListener("click", exportCard);
  tweetBtn.addEventListener("click", () => openTweetComposer(recap));
}

init().catch(() => {
  stateEl.textContent = "Une erreur est survenue pendant la génération du récap.";
});
