// Page de recap : lit le storage, dessine la carte dans le format choisi, propose l'export.

import { initI18n, applyTranslations, t, getCurrentLanguage, resolveLocale } from "./i18n.js";
import { listPeriods, collectEntries, buildRecap, buildTimeline, formatDuration, rollingDayKeys } from "./recap-data.js";
import { PLUS_KEY, isPlusActive, plusPageUrl } from "./plus.js";
import { drawRecapCard, CARD_WIDTH, CARD_HEIGHT } from "./recap-card.js";
import { drawRecapStory, STORY_WIDTH, STORY_HEIGHT } from "./recap-story.js";
import { POINTS_KEYS, REASON_LABEL_KEYS, channelName, dayKeysForPeriod, daySeries, pointsFromLogs, stateFrom, summarizeDays } from "./points-data.js";

const WATCH_TIME_KEY = "betaWatchTimeData";
const WATCH_TIME_DAILY_KEY = "streamPulseWatchTimeDaily";
const PREFERENCES_KEY = "betaGeneralPreferences";
const STATS_KEY = "betaGeneralStats";
const EVENT_LOGS_KEY = "betaEventLogs";
const TOP_LIMIT = 7;
const EXPORT_SCALE = 2;
const EXPORT_JPEG_QUALITY = 0.92;

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

let stored = { monthly: {}, daily: {}, pseudo: "", plus: false, points: stateFrom({}) };
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

const formatPoints = (value) => new Intl.NumberFormat(locale()).format(value);

/** Points gagnés sur la période du récap, ou `null` s'il n'y en a aucun. */
function pointsFor(period) {
  const summary = summarizeDays(stored.points, dayKeysForPeriod(period.id, stored.points, Date.now()));
  return summary.total > 0 ? summary : null;
}

/** Premier jour (AAAA-MM-JJ) d'une periode du recap. */
function periodStartKey(period) {
  if (period.kind === "rolling") return rollingDayKeys(period.days).at(-1);
  if (period.kind === "year") return `${period.year}-01-01`;
  return `${period.month}-01`;
}

/**
 * Points affiches sur l'image, pour de vrai sur la periode :
 *   - le suivi par jour (tous les gains, depuis sa mise en service) ;
 *   - avant lui, les coffres dates du journal d'evenements (ses 100 dernieres entrees).
 * Le Wrapped annuel reprend en plus le compteur tenu depuis l'installation
 * quand il est plus grand : un total sur l'annee ne repart pas de zero.
 * `since` : premier jour couvert, quand il tombe apres le debut de la periode.
 */
function cardPoints(period, points) {
  const startKey = periodStartKey(period);
  const firstTracked = Object.keys(stored.points?.daily || {}).sort()[0] || "";
  const backfill = pointsFromLogs(stored.eventLogs, { fromKey: startKey, beforeKey: firstTracked });
  const dated = (points?.total || 0) + backfill.points;
  const total = period.kind === "year" ? Math.max(dated, stored.lifetimePoints) : dated;
  if (total <= 0) return null;
  const covered = backfill.firstDay || firstTracked;
  return {
    total,
    label: `+${formatPoints(total)}`,
    lifetime: total > dated,
    since: covered && covered > startKey ? covered : "",
  };
}

/** Libelle de la tuile des points : total depuis l'installation, ou « depuis le … » si la periode n'est couverte qu'en partie. */
function pointsLabel(points) {
  if (points?.lifetime) return t("recap.card.statPointsTotal");
  if (!points?.since) return t("recap.card.statPoints");
  const [y, m, d] = points.since.split("-").map(Number);
  const date = new Date(y, m - 1, d).toLocaleDateString(locale(), { day: "numeric", month: "short" });
  return t("recap.card.statPointsSince", { date });
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

function buildLabels(period, points) {
  return {
    eyebrow: t("recap.card.eyebrow"),
    heading: stored.pseudo ? t("recap.card.heading", { name: stored.pseudo }) : t("recap.card.headingAnon"),
    period: periodSubtitle(period),
    statTime: t("recap.card.statTime"),
    statChannels: t("recap.card.statChannels"),
    statTop: t("recap.card.statTop"),
    statPlatforms: t("recap.card.statPlatforms"),
    topTitle: t("recap.card.topTitle"),
    statPoints: pointsLabel(points),
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
  // Dessin au double de la taille : l'image exportee reste nette une fois
  // agrandie (X, Discord, story). L'ecran la reduit a sa place avec le CSS.
  canvas.width = format.width * EXPORT_SCALE;
  canvas.height = format.height * EXPORT_SCALE;
  canvas.dataset.format = currentFormat;
  const ctx = canvas.getContext("2d");
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
  format.draw(ctx, currentRecap, currentAssets);
  // Équivalent textuel du canvas pour les lecteurs d'écran (role="img").
  const topChannel = currentRecap.top?.[0]?.channel;
  canvas.setAttribute(
    "aria-label",
    t("recap.canvasSummary", {
      time: formatDuration(currentRecap.totalSeconds),
      top: topChannel || t("recap.emptyTitle"),
    })
  );
}

async function renderPeriod() {
  const token = ++renderToken;
  const period = findPeriod(currentPeriod) || findPeriod("7d");
  const entries = collectEntries(stored.monthly, stored.daily, period.id);
  const recap = buildRecap(entries, { limit: TOP_LIMIT });

  show(stateEl, false);
  // Les periodes glissantes dependent du suivi par jour, plus recent que le suivi mensuel.
  show(dailyHintEl, period.kind === "rolling");

  const points = pointsFor(period);
  renderInsights(period, recap, points);
  if (recap.isEmpty) {
    currentRecap = null;
    show(stageEl, false);
    show(actionsEl, false);
    show(emptyEl, true);
    return;
  }

  const shownPoints = cardPoints(period, points);
  const avatars = await loadAvatars(recap.top);
  if (token !== renderToken) return; // une autre periode a ete choisie entre-temps

  currentRecap = {
    ...recap,
    points: shownPoints,
    labels: buildLabels(period, shownPoints),
    periodTitle: periodTitle(period),
  };
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

function barItem(nameText, valueText, ratio) {
  const item = document.createElement("li");
  const name = document.createElement("span");
  name.className = "cat-name";
  name.textContent = nameText;
  name.title = nameText;
  const value = document.createElement("span");
  value.className = "cat-time";
  value.textContent = valueText;
  const bar = document.createElement("span");
  bar.className = "cat-bar";
  const fill = document.createElement("i");
  fill.style.width = `${Math.max(3, ratio * 100)}%`;
  bar.append(fill);
  item.append(name, value, bar);
  return item;
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
    ...categories.map((category) =>
      barItem(category.name, `${formatDuration(category.seconds)} · ${Math.round(category.share * 100)} %`, category.seconds / max),
    ),
  );
}

/** Barres d'une période : une par jour, ou une par mois pour une année. */
function renderBars({ hostId, axisId, peakId }, series, period, { valueOf, format, peakParams, peakKeys, emptyKey }) {
  const host = document.getElementById(hostId);
  const axis = document.getElementById(axisId);
  const peakEl = document.getElementById(peakId);
  const max = Math.max(0, ...series.map(valueOf));
  host.replaceChildren(
    ...series.map((point) => {
      const value = valueOf(point);
      const bar = document.createElement("span");
      bar.className = value > 0 ? "tl-bar" : "tl-bar is-empty";
      bar.style.height = max > 0 && value > 0 ? `${Math.max(4, (value / max) * 100)}%` : "2px";
      bar.title = `${pointLabel(point.key, "long")} · ${format(value)}`;
      return bar;
    }),
  );
  axis.replaceChildren(
    ...[series[0], series[series.length - 1]].map((point) => {
      const label = document.createElement("span");
      label.textContent = point ? pointLabel(point.key, "short") : "";
      return label;
    }),
  );
  const peak = series.reduce((best, point) => (valueOf(point) > (best ? valueOf(best) : 0) ? point : best), null);
  const summary = peak
    ? t(period.kind === "year" ? peakKeys.month : peakKeys.day, { label: pointLabel(peak.key, "long"), ...peakParams(valueOf(peak)) })
    : t(emptyKey);
  peakEl.textContent = summary;
  host.setAttribute("aria-label", summary);
}

function renderTimeline(points, period) {
  renderBars({ hostId: "timeline", axisId: "timeline-axis", peakId: "timeline-peak" }, points, period, {
    valueOf: (point) => point.seconds,
    format: formatDuration,
    peakParams: (seconds) => ({ time: formatDuration(seconds) }),
    peakKeys: { day: "recap.plus.peakDay", month: "recap.plus.peakMonth" },
    emptyKey: "recap.plus.noActivity",
  });
}

function renderPointsInsights(period, points) {
  const host = document.getElementById("points-insights");
  if (!host) return;
  show(host, Boolean(points));
  if (!points) return;
  const reasons = points.byReason.filter((reason) => reason.points > 0).sort((a, b) => b.points - a.points);
  const max = reasons[0]?.points || 1;
  document.getElementById("points-reason-list").replaceChildren(
    ...reasons.map((reason) =>
      barItem(
        t(REASON_LABEL_KEYS[reason.code]),
        `${formatPoints(reason.points)} · ${Math.round((reason.points / points.total) * 100)} %`,
        reason.points / max,
      ),
    ),
  );
  renderBars({ hostId: "points-timeline", axisId: "points-timeline-axis", peakId: "points-peak" }, daySeries(stored.points, period.id), period, {
    valueOf: (point) => point.points,
    format: formatPoints,
    peakParams: (value) => ({ points: formatPoints(value) }),
    peakKeys: { day: "recap.plus.pointsPeakDay", month: "recap.plus.pointsPeakMonth" },
    emptyKey: "recap.plus.noActivity",
  });
  const best = points.byChannel[0];
  const extra = [t("recap.plus.pointsBest", { name: channelName(stored.points, best.channelId), points: formatPoints(best.points) })];
  if (points.subBonus > 0) extra.push(t("recap.plus.pointsSubBonus", { points: formatPoints(points.subBonus) }));
  document.getElementById("points-extra").textContent = extra.join(" · ");
}

function renderInsights(period, recap, points) {
  show(insightsLockedEl, !stored.plus && !recap.isEmpty);
  show(insightsEl, stored.plus && !recap.isEmpty);
  if (!stored.plus || recap.isEmpty) return;
  renderCategories(recap.categories);
  renderTimeline(buildTimeline(stored.monthly, stored.daily, period.id), period);
  renderPointsInsights(period, points);
}

function fileName() {
  const slug = currentPeriod.replace(/[^a-z0-9-]/gi, "-");
  return `streampulse-recap-${slug}-${currentFormat}.jpg`;
}

/**
 * JPEG haute qualité : le fond en dégradé pèse 3 à 4 Mo en PNG (X refuse
 * au-delà de 5 Mo) contre moins de 1 Mo ici, sans perte visible sur le texte.
 */
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
  }, "image/jpeg", EXPORT_JPEG_QUALITY);
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
  const data = await chrome.storage.local.get([WATCH_TIME_KEY, WATCH_TIME_DAILY_KEY, PREFERENCES_KEY, PLUS_KEY, STATS_KEY, EVENT_LOGS_KEY, ...POINTS_KEYS]);
  const prefs = data[PREFERENCES_KEY] || {};
  return {
    monthly: data[WATCH_TIME_KEY] || {},
    daily: data[WATCH_TIME_DAILY_KEY] || {},
    pseudo: typeof prefs.pseudo === "string" ? prefs.pseudo.trim().slice(0, 40) : "",
    plus: isPlusActive(data[PLUS_KEY]),
    points: stateFrom(data),
    // Compteur historique des points recuperes, depuis l'installation (sans date).
    lifetimePoints: Math.max(0, Number(data[STATS_KEY]?.channelPointsClaimed) || 0),
    eventLogs: Array.isArray(data[EVENT_LOGS_KEY]) ? data[EVENT_LOGS_KEY] : [],
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

  show(document.getElementById("brand-plus"), stored.plus);
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
