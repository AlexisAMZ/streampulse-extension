// Page de recap : lit le storage, dessine la carte dans le format choisi, propose l'export.

import { initI18n, applyTranslations, t, getCurrentLanguage, resolveLocale } from "./i18n.js";
import { listPeriods, collectEntries, buildRecap, buildTimeline, formatDuration, rollingDayKeys } from "./recap-data.js";
import { PLUS_KEY, isPlusActive, plusPageUrl } from "./plus.js";
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
const insightsEl = document.getElementById("insights");
const insightsLockedEl = document.getElementById("insights-locked");

let stored = { monthly: {}, daily: {}, pseudo: "", plus: false };
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

/** Periodes proposees ; le Wrapped annuel est reserve a StreamPulse+. */
function periodsFor(data) {
  return listPeriods(data.monthly, data.daily, new Date(), { years: data.plus });
}

function periodTitle(period) {
  if (period.kind === "rolling") return t(`recap.period${period.days}d`);
  if (period.kind === "year") return t("recap.periodYear", { year: period.year });
  return monthLabel(period.month);
}

function periodSubtitle(period) {
  if (period.kind === "rolling") return `${t(`recap.period${period.days}d`)} · ${rangeLabel(period.days)}`;
  if (period.kind === "year") return t("recap.periodYear", { year: period.year });
  return monthLabel(period.month);
}

function findPeriod(id) {
  return periodsFor(stored).find((p) => p.id === id);
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
  const periods = periodsFor(stored);
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

  renderInsights(period, recap);
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

// ─── Recap avance (StreamPulse+) ───────────────────────────────────────────────

function pointLabel(key, style) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d || 1);
  const options = d ? { day: "numeric", month: style } : { month: style };
  return date.toLocaleDateString(locale(), options);
}

function renderCategories(categories) {
  const list = document.getElementById("cat-list");
  if (!categories.length) {
    const empty = document.createElement("li");
    empty.className = "cat-empty";
    empty.textContent = t("recap.plus.noCategories");
    list.replaceChildren(empty);
    return;
  }
  const max = categories[0].seconds || 1;
  list.replaceChildren(
    ...categories.map((category) => {
      const item = document.createElement("li");
      const name = document.createElement("span");
      name.className = "cat-name";
      name.textContent = category.name;
      name.title = category.name;
      const time = document.createElement("span");
      time.className = "cat-time";
      time.textContent = `${formatDuration(category.seconds)} · ${Math.round(category.share * 100)} %`;
      const bar = document.createElement("span");
      bar.className = "cat-bar";
      const fill = document.createElement("i");
      fill.style.width = `${Math.max(3, (category.seconds / max) * 100)}%`;
      bar.append(fill);
      item.append(name, time, bar);
      return item;
    }),
  );
}

function renderTimeline(points, period) {
  const host = document.getElementById("timeline");
  const axis = document.getElementById("timeline-axis");
  const peakEl = document.getElementById("timeline-peak");
  const max = Math.max(0, ...points.map((p) => p.seconds));
  host.replaceChildren(
    ...points.map((point) => {
      const bar = document.createElement("span");
      bar.className = point.seconds > 0 ? "tl-bar" : "tl-bar is-empty";
      bar.style.height = max > 0 && point.seconds > 0 ? `${Math.max(4, (point.seconds / max) * 100)}%` : "2px";
      bar.title = `${pointLabel(point.key, "long")} · ${formatDuration(point.seconds)}`;
      return bar;
    }),
  );
  const monthly = period.kind === "year";
  axis.replaceChildren(
    ...[points[0], points[points.length - 1]].map((point) => {
      const label = document.createElement("span");
      label.textContent = point ? pointLabel(point.key, "short") : "";
      return label;
    }),
  );
  const peak = points.reduce((best, point) => (point.seconds > (best?.seconds || 0) ? point : best), null);
  const summary = peak
    ? t(monthly ? "recap.plus.peakMonth" : "recap.plus.peakDay", { label: pointLabel(peak.key, "long"), time: formatDuration(peak.seconds) })
    : t("recap.plus.noActivity");
  peakEl.textContent = summary;
  host.setAttribute("aria-label", summary);
}

function renderInsights(period, recap) {
  show(insightsLockedEl, !stored.plus && !recap.isEmpty);
  show(insightsEl, stored.plus && !recap.isEmpty);
  if (!stored.plus || recap.isEmpty) return;
  renderCategories(recap.categories);
  renderTimeline(buildTimeline(stored.monthly, stored.daily, period.id), period);
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
  const data = await chrome.storage.local.get([WATCH_TIME_KEY, WATCH_TIME_DAILY_KEY, PREFERENCES_KEY, PLUS_KEY]);
  const prefs = data[PREFERENCES_KEY] || {};
  return {
    monthly: data[WATCH_TIME_KEY] || {},
    daily: data[WATCH_TIME_DAILY_KEY] || {},
    pseudo: typeof prefs.pseudo === "string" ? prefs.pseudo.trim().slice(0, 40) : "",
    plus: isPlusActive(data[PLUS_KEY]),
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
  const periods = periodsFor(stored);
  const hasDaily = Object.keys(stored.daily).length > 0;
  const firstMonth = periods.find((p) => p.kind === "month");
  currentPeriod = !hasDaily && firstMonth ? firstMonth.id : "7d";

  // The canvas only draws with fonts that are already loaded.
  await Promise.all([
    document.fonts.load('700 48px "Unbounded"'),
    document.fonts.load('600 24px "Onest"'),
  ]).catch(() => {});
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

  const unlock = document.getElementById("insights-unlock");
  if (unlock) unlock.href = plusPageUrl(getCurrentLanguage());
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
