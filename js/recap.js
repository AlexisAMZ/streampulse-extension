// Page de recap : lit le storage, dessine la carte dans le format choisi, propose l'export.

import { initI18n, applyTranslations, t, getCurrentLanguage, resolveLocale } from "./i18n.js";
import { listPeriods, collectEntries, buildRecap, formatDuration, rollingDayKeys } from "./recap-data.js";
import { drawRecapCard, CARD_WIDTH, CARD_HEIGHT } from "./recap-card.js";
import { drawRecapStory, STORY_WIDTH, STORY_HEIGHT } from "./recap-story.js";

const WATCH_TIME_KEY = "betaWatchTimeData";
const WATCH_TIME_DAILY_KEY = "streamPulseWatchTimeDaily";
const PREFERENCES_KEY = "betaGeneralPreferences";
const TOP_LIMIT = 7;

// Les deux formats partagent le meme modele : seule la mise en page change.
const FORMATS = {
  desktop: { width: CARD_WIDTH, height: CARD_HEIGHT, draw: drawRecapCard },
  mobile: { width: STORY_WIDTH, height: STORY_HEIGHT, draw: drawRecapStory },
};

const canvas = document.getElementById("recap-canvas");
const stageEl = document.getElementById("stage");
const stateEl = document.getElementById("state");
const emptyEl = document.getElementById("empty");
const actionsEl = document.getElementById("actions");
const periodSelect = document.getElementById("period");
const formatsEl = document.getElementById("formats");
const dailyHintEl = document.getElementById("daily-hint");

let stored = { monthly: {}, daily: {}, pseudo: "" };
let currentFormat = "desktop";
let currentPeriod = "7d";
let currentRecap = null;
let currentAssets = { avatars: new Map(), logo: null };
let renderToken = 0;

function show(el, visible) {
  if (el) el.hidden = !visible;
}

/**
 * Charge une image pour le canvas. Si le CDN n'autorise pas le partage
 * cross-origin, dessiner l'image contaminerait le canvas et ferait echouer
 * toBlob() : on resout `null` et la carte retombe sur les initiales.
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

/** Avatar connu pour chaque chaine, tous mois confondus (le plus recent gagne). */
function knownAvatars(monthly) {
  const known = new Map();
  for (const month of Object.keys(monthly || {}).sort()) {
    for (const entry of Object.values(monthly[month] || {})) {
      if (entry?.avatarUrl && entry.platform && entry.channel) {
        known.set(`${entry.platform}:${entry.channel}`, entry.avatarUrl);
      }
    }
  }
  return known;
}

async function loadAvatars(entries) {
  const known = knownAvatars(stored.monthly);
  const pairs = await Promise.all(
    entries.map(async (e) => {
      const key = `${e.platform}:${e.channel}`;
      return [key, await loadImage(e.avatarUrl || known.get(key), { crossOrigin: true })];
    })
  );
  return new Map(pairs.filter(([, image]) => image !== null));
}

function locale() {
  return resolveLocale(getCurrentLanguage());
}

function monthLabel(month) {
  const [y, m] = month.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString(locale(), { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function rangeLabel(days) {
  const keys = rollingDayKeys(days);
  const toDate = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const start = toDate(keys[keys.length - 1]);
  const end = toDate(keys[0]);
  const fmt = new Intl.DateTimeFormat(locale(), { day: "numeric", month: "short", year: "numeric" });
  return typeof fmt.formatRange === "function" ? fmt.formatRange(start, end) : `${fmt.format(start)} – ${fmt.format(end)}`;
}

function periodTitle(period) {
  if (period.kind === "rolling") return t(`recap.period${period.days}d`);
  return monthLabel(period.month);
}

function periodSubtitle(period) {
  if (period.kind === "rolling") return `${t(`recap.period${period.days}d`)} · ${rangeLabel(period.days)}`;
  return monthLabel(period.month);
}

function findPeriod(id) {
  return listPeriods(stored.monthly, stored.daily).find((p) => p.id === id);
}

function buildLabels(period) {
  return {
    eyebrow: t("recap.card.eyebrow"),
    heading: stored.pseudo ? t("recap.card.heading", { name: stored.pseudo }) : t("recap.card.headingAnon"),
    period: periodSubtitle(period),
    statTime: t("recap.card.statTime"),
    statChannels: t("recap.card.statChannels"),
    statTop: t("recap.card.statTop"),
    statPlatforms: t("recap.card.statPlatforms"),
    topTitle: t("recap.card.topTitle"),
  };
}

function populatePeriods() {
  const periods = listPeriods(stored.monthly, stored.daily);
  periodSelect.replaceChildren(
    ...periods.map((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = periodTitle(p);
      opt.selected = p.id === currentPeriod;
      return opt;
    })
  );
}

function draw() {
  if (!currentRecap) return;
  const format = FORMATS[currentFormat];
  canvas.width = format.width;
  canvas.height = format.height;
  canvas.dataset.format = currentFormat;
  format.draw(canvas.getContext("2d"), currentRecap, currentAssets);
}

async function renderPeriod() {
  const token = ++renderToken;
  const period = findPeriod(currentPeriod) || findPeriod("7d");
  const entries = collectEntries(stored.monthly, stored.daily, period.id);
  const recap = buildRecap(entries, { limit: TOP_LIMIT });

  show(stateEl, false);
  // Les periodes glissantes dependent du suivi par jour, plus recent que le suivi mensuel.
  show(dailyHintEl, period.kind === "rolling");

  if (recap.isEmpty) {
    currentRecap = null;
    show(stageEl, false);
    show(actionsEl, false);
    show(emptyEl, true);
    return;
  }

  const avatars = await loadAvatars(recap.top);
  if (token !== renderToken) return; // une autre periode a ete choisie entre-temps

  currentRecap = { ...recap, labels: buildLabels(period), periodTitle: periodTitle(period) };
  currentAssets = { ...currentAssets, avatars };
  draw();
  show(emptyEl, false);
  show(stageEl, true);
  show(actionsEl, true);
}

function fileName() {
  const slug = currentPeriod.replace(/[^a-z0-9-]/gi, "-");
  return `streampulse-recap-${slug}-${currentFormat}.png`;
}

function exportImage() {
  canvas.toBlob((blob) => {
    if (!blob) {
      stateEl.textContent = t("recap.error");
      show(stateEl, true);
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Laisser au navigateur le temps de lire le blob avant de le liberer.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }, "image/png");
}

function openShareComposer() {
  if (!currentRecap) return;
  const text = t("recap.shareText", {
    period: currentRecap.periodTitle,
    time: formatDuration(currentRecap.totalSeconds),
    count: currentRecap.streamerCount,
    top: currentRecap.top[0]?.channel || "—",
  });
  const url = `https://x.com/intent/post?text=${encodeURIComponent(`${text}\nstreampulse.fr`)}`;
  window.open(url, "_blank", "noopener");
}

async function readStorage() {
  const data = await chrome.storage.local.get([WATCH_TIME_KEY, WATCH_TIME_DAILY_KEY, PREFERENCES_KEY]);
  const prefs = data[PREFERENCES_KEY] || {};
  return {
    monthly: data[WATCH_TIME_KEY] || {},
    daily: data[WATCH_TIME_DAILY_KEY] || {},
    pseudo: typeof prefs.pseudo === "string" ? prefs.pseudo.trim().slice(0, 40) : "",
  };
}

async function init() {
  await initI18n();
  applyTranslations(document);
  document.documentElement.lang = getCurrentLanguage();

  try {
    stored = await readStorage();
  } catch (_e) {
    stateEl.textContent = t("recap.error");
    return;
  }

  // Sans aucune donnee journaliere, ouvrir sur le mois en cours plutot que sur un 7 jours vide.
  const periods = listPeriods(stored.monthly, stored.daily);
  const hasDaily = Object.keys(stored.daily).length > 0;
  const firstMonth = periods.find((p) => p.kind === "month");
  currentPeriod = !hasDaily && firstMonth ? firstMonth.id : "7d";

  currentAssets = { avatars: new Map(), logo: await loadImage("../images/photos/logosp.png") };
  populatePeriods();

  periodSelect.addEventListener("change", () => {
    currentPeriod = periodSelect.value;
    renderPeriod().catch(onError);
  });

  formatsEl.addEventListener("click", (event) => {
    const button = event.target.closest(".seg-btn");
    if (!button || button.dataset.format === currentFormat) return;
    currentFormat = button.dataset.format;
    formatsEl.querySelectorAll(".seg-btn").forEach((b) => {
      const active = b.dataset.format === currentFormat;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    draw();
  });

  document.getElementById("download").addEventListener("click", exportImage);
  document.getElementById("share").addEventListener("click", openShareComposer);

  await renderPeriod();
}

function onError(error) {
  console.error("[recap] render failed:", error);
  stateEl.textContent = t("recap.error");
  show(stateEl, true);
}

init().catch(onError);
