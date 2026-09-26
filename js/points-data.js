// Suivi des points de chaîne Twitch. Module pur : normalisation des gains
// captés sur Twitch, agrégation par jour, par chaîne et par raison, résumés
// pour le panneau Points et pour le récap. Aucun accès à chrome.* ni au DOM.
// Testé par tests/points-data.test.mjs.

import { dayKey, rollingDayKeys } from "./recap-data.js";

export const POINTS_DAILY_KEY = "streamPulsePointsDaily";
export const POINTS_JOURNAL_KEY = "streamPulsePointsJournal";
export const POINTS_CHANNELS_KEY = "streamPulsePointsChannels";
export const POINTS_KEYS = [POINTS_DAILY_KEY, POINTS_JOURNAL_KEY, POINTS_CHANNELS_KEY];

export const DAILY_RETENTION_DAYS = 400;
export const JOURNAL_RETENTION_DAYS = 60;
export const JOURNAL_LIMIT = 1000;
const DAY_MS = 86_400_000;
const MAX_POINTS = 1_000_000;
const MAX_FACTOR = 5;
const DETAIL_JOURNAL = 20;
const ALL_SERIES_DAYS = 30;

/**
 * Raisons affichées, dans l'ordre. `rule` est le gain de base annoncé par
 * Twitch, `upTo` en fait un plafond (séries de visionnage). OTHER regroupe
 * PREDICTION, REFUND, PRIME_SUB et tout code que Twitch ajouterait.
 */
export const REASONS = Object.freeze([
  Object.freeze({ code: "CLAIM", rule: 50 }),
  Object.freeze({ code: "WATCH", rule: 10 }),
  Object.freeze({ code: "WATCH_STREAK", rule: 450, upTo: true }),
  Object.freeze({ code: "RAID", rule: 250 }),
  Object.freeze({ code: "FOLLOW", rule: 300 }),
  Object.freeze({ code: "CHEER", rule: 350, monthly: true }),
  Object.freeze({ code: "SUB_GIFT", rule: 500, monthly: true }),
  Object.freeze({ code: "OTHER", rule: null }),
]);
const KNOWN_CODES = new Set(REASONS.map((r) => r.code).filter((code) => code !== "OTHER"));

/** Clé de traduction du libellé de chaque raison, partagée par le popup et le récap. */
export const REASON_LABEL_KEYS = Object.freeze({
  CLAIM: "popup.points.reasonClaim",
  WATCH: "popup.points.reasonWatch",
  WATCH_STREAK: "popup.points.reasonStreak",
  RAID: "popup.points.reasonRaid",
  FOLLOW: "popup.points.reasonFollow",
  CHEER: "popup.points.reasonCheer",
  SUB_GIFT: "popup.points.reasonSubGift",
  OTHER: "popup.points.reasonOther",
});
/** Gains uniques (une fois, ou une fois par mois) dont on garde la date. */
const FIRSTS = ["FOLLOW", "CHEER", "SUB_GIFT"];
/** Seuls ces gains portent le multiplicateur d'abonnement de façon fiable. */
const FACTOR_SOURCES = new Set(["WATCH", "CLAIM"]);

export const PANEL_PERIODS = Object.freeze(["today", "7d", "30d", "all"]);
const ROLLING = { today: 1, "7d": 7, "30d": 30 };

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const pad = (n) => String(n).padStart(2, "0");
const round2 = (n) => Math.round(n * 100) / 100;

export function emptyState() {
  return { daily: {}, journal: [], channels: {} };
}

/** État lu du storage, sans faire confiance à sa forme. */
export function stateFrom(stored = {}) {
  const source = stored || {};
  return {
    daily: isPlainObject(source[POINTS_DAILY_KEY]) ? source[POINTS_DAILY_KEY] : {},
    journal: Array.isArray(source[POINTS_JOURNAL_KEY]) ? source[POINTS_JOURNAL_KEY] : [],
    channels: isPlainObject(source[POINTS_CHANNELS_KEY]) ? source[POINTS_CHANNELS_KEY] : {},
  };
}

export function toStorage(state) {
  return {
    [POINTS_DAILY_KEY]: state.daily,
    [POINTS_JOURNAL_KEY]: state.journal,
    [POINTS_CHANNELS_KEY]: state.channels,
  };
}

/**
 * Transforme la charge d'un message « points-earned » en gain, ou `null` si
 * elle est invalide. La page Twitch peut poster n'importe quoi : tout est
 * vérifié et borné.
 */
export function normalizeGain(raw, now = Date.now()) {
  if (!isPlainObject(raw) || !isPlainObject(raw.point_gain)) return null;
  const gain = raw.point_gain;
  const channelId = String(gain.channel_id ?? raw.channel_id ?? "");
  if (!/^\d{1,20}$/.test(channelId)) return null;

  const points = Number(gain.total_points);
  if (!Number.isInteger(points) || points < 1 || points > MAX_POINTS) return null;
  const baseValue = Number(gain.baseline_points);
  const base = Number.isInteger(baseValue) && baseValue >= 0 && baseValue <= points ? baseValue : points;

  const rawReason = typeof gain.reason_code === "string" ? gain.reason_code.slice(0, 40) : "";
  const reason = KNOWN_CODES.has(rawReason) ? rawReason : "OTHER";

  const factorSum = (Array.isArray(gain.multipliers) ? gain.multipliers : []).reduce((sum, multiplier) => {
    const value = Number(multiplier?.factor);
    return Number.isFinite(value) && value > 0 ? sum + value : sum;
  }, 0);
  const factor = round2(Math.min(MAX_FACTOR, factorSum));

  const parsed = Date.parse(raw.timestamp);
  const at = Number.isFinite(parsed) ? parsed : now;
  const balanceValue = Number(raw.balance?.balance);
  const balance = Number.isInteger(balanceValue) && balanceValue >= 0 ? balanceValue : null;

  return {
    key: `${channelId}|${at}|${rawReason || reason}|${points}`,
    at,
    day: dayKey(new Date(at)),
    channelId,
    reason,
    rawReason,
    points,
    base,
    factor,
    balance,
  };
}

function nextChannel(channel, gain) {
  const next = { ...channel, lastGainAt: Math.max(channel.lastGainAt || 0, gain.at) };
  if (gain.balance !== null && gain.at >= (channel.balanceAt || 0)) {
    next.balance = gain.balance;
    next.balanceAt = gain.at;
  }
  if (FACTOR_SOURCES.has(gain.reason) && gain.at >= (channel.factorAt || 0)) {
    next.factor = gain.factor;
    next.factorAt = gain.at;
  }
  if (FIRSTS.includes(gain.reason)) {
    const firsts = isPlainObject(channel.firsts) ? channel.firsts : {};
    next.firsts = { ...firsts, [gain.reason]: Math.max(firsts[gain.reason] || 0, gain.at) };
  }
  return next;
}

/** Ajoute un gain et renvoie un nouvel état ; renvoie l'état tel quel si le gain est déjà connu. */
export function addGain(state, gain) {
  const current = state || emptyState();
  if (!gain || current.journal.some((entry) => entry.key === gain.key)) return current;

  const dayBucket = current.daily[gain.day] || {};
  const channelBucket = dayBucket[gain.channelId] || {};
  const previous = channelBucket[gain.reason] || { count: 0, points: 0, base: 0 };
  const entry = {
    key: gain.key,
    at: gain.at,
    channelId: gain.channelId,
    reason: gain.reason,
    rawReason: gain.rawReason,
    points: gain.points,
    base: gain.base,
    factor: gain.factor,
  };

  return {
    daily: {
      ...current.daily,
      [gain.day]: {
        ...dayBucket,
        [gain.channelId]: {
          ...channelBucket,
          [gain.reason]: {
            count: previous.count + 1,
            points: previous.points + gain.points,
            base: previous.base + gain.base,
          },
        },
      },
    },
    journal: [entry, ...current.journal].sort((a, b) => b.at - a.at),
    channels: { ...current.channels, [gain.channelId]: nextChannel(current.channels[gain.channelId] || {}, gain) },
  };
}

/** Oublie les jours et les gains trop anciens. */
export function prune(state, now = Date.now()) {
  const oldestDay = dayKey(new Date(now - DAILY_RETENTION_DAYS * DAY_MS));
  const oldestGain = now - JOURNAL_RETENTION_DAYS * DAY_MS;
  return {
    ...state,
    daily: Object.fromEntries(Object.entries(state.daily).filter(([day]) => day >= oldestDay)),
    journal: state.journal.filter((entry) => entry.at >= oldestGain).slice(0, JOURNAL_LIMIT),
  };
}

/** Jours d'une période du panneau (today, 7d, 30d, all) ou du récap (month:, year:). */
export function dayKeysForPeriod(periodId, state, now = Date.now()) {
  if (ROLLING[periodId]) return rollingDayKeys(ROLLING[periodId], new Date(now));
  const days = Object.keys((state || emptyState()).daily).sort();
  if (periodId === "all") return days;
  const month = /^month:(\d{4}-\d{2})$/.exec(periodId || "");
  if (month) return days.filter((day) => day.startsWith(`${month[1]}-`));
  const year = /^year:(\d{4})$/.exec(periodId || "");
  if (year) return days.filter((day) => day.startsWith(`${year[1]}-`));
  return [];
}

const emptyTotals = () => ({ count: 0, points: 0, base: 0 });

function addTotals(target, values) {
  target.count += Number(values?.count) || 0;
  target.points += Number(values?.points) || 0;
  target.base += Number(values?.base) || 0;
}

/** Totaux d'une liste de jours : par raison, par chaîne, et au global. */
export function summarizeDays(state, dayKeys) {
  const source = state || emptyState();
  const byReason = new Map(REASONS.map((reason) => [reason.code, { code: reason.code, ...emptyTotals() }]));
  const byChannel = new Map();
  const totals = emptyTotals();

  for (const day of dayKeys || []) {
    for (const [channelId, reasons] of Object.entries(source.daily[day] || {})) {
      if (!byChannel.has(channelId)) byChannel.set(channelId, { channelId, ...emptyTotals(), reasons: {} });
      const channel = byChannel.get(channelId);
      for (const [code, values] of Object.entries(reasons || {})) {
        const reasonCode = byReason.has(code) ? code : "OTHER";
        addTotals(byReason.get(reasonCode), values);
        addTotals(channel, values);
        channel.reasons[reasonCode] = channel.reasons[reasonCode] || emptyTotals();
        addTotals(channel.reasons[reasonCode], values);
        addTotals(totals, values);
      }
    }
  }

  const channels = [...byChannel.values()]
    .map((channel) => ({ ...channel, share: totals.points > 0 ? channel.points / totals.points : 0 }))
    .sort((a, b) => b.points - a.points);

  return {
    total: totals.points,
    base: totals.base,
    subBonus: totals.points - totals.base,
    count: totals.count,
    byReason: REASONS.map((reason) => byReason.get(reason.code)),
    byChannel: channels,
    channelCount: channels.length,
  };
}

export function summarize(state, periodId, now = Date.now()) {
  return summarizeDays(state, dayKeysForPeriod(periodId, state, now));
}

function dayPoints(state, day, channelId) {
  const bucket = state.daily[day] || {};
  const channels = channelId ? [bucket[channelId] || {}] : Object.values(bucket);
  let points = 0;
  for (const reasons of channels) {
    for (const values of Object.values(reasons || {})) points += Number(values?.points) || 0;
  }
  return points;
}

/** Courbe d'une période : un point par jour, ou par mois pour une année. */
export function daySeries(state, periodId, now = Date.now(), channelId = null) {
  const source = state || emptyState();
  const rollingDays = ROLLING[periodId] || (periodId === "all" ? ALL_SERIES_DAYS : 0);
  if (rollingDays) {
    return rollingDayKeys(rollingDays, new Date(now))
      .reverse()
      .map((key) => ({ key, points: dayPoints(source, key, channelId) }));
  }
  const month = /^month:(\d{4})-(\d{2})$/.exec(periodId || "");
  if (month) {
    const count = new Date(Number(month[1]), Number(month[2]), 0).getDate();
    return Array.from({ length: count }, (_, i) => {
      const key = `${month[1]}-${month[2]}-${pad(i + 1)}`;
      return { key, points: dayPoints(source, key, channelId) };
    });
  }
  const year = /^year:(\d{4})$/.exec(periodId || "");
  if (year) {
    return Array.from({ length: 12 }, (_, i) => {
      const key = `${year[1]}-${pad(i + 1)}`;
      const points = Object.keys(source.daily)
        .filter((day) => day.startsWith(`${key}-`))
        .reduce((sum, day) => sum + dayPoints(source, day, channelId), 0);
      return { key, points };
    });
  }
  return [];
}

/** Fiche d'une chaîne pour une période du panneau. */
export function channelDetail(state, channelId, periodId, now = Date.now()) {
  const source = state || emptyState();
  const summary = summarize(source, periodId, now);
  const row = summary.byChannel.find((channel) => channel.channelId === channelId)
    || { channelId, ...emptyTotals(), reasons: {} };
  const channel = source.channels[channelId] || {};
  const firsts = isPlainObject(channel.firsts) ? channel.firsts : {};
  const month = dayKey(new Date(now)).slice(0, 7);
  const monthly = (code) => {
    const at = firsts[code];
    return at && dayKey(new Date(at)).startsWith(month) ? { done: true, at } : { done: false };
  };

  return {
    channelId,
    name: channelName(source, channelId),
    login: channel.login || "",
    avatar: channel.avatar || "",
    total: row.points,
    subBonus: row.points - row.base,
    count: row.count,
    reasons: REASONS.map((reason) => ({ ...reason, ...(row.reasons[reason.code] || emptyTotals()) })),
    status: {
      CHEER: monthly("CHEER"),
      SUB_GIFT: monthly("SUB_GIFT"),
      FOLLOW: firsts.FOLLOW ? { done: true, at: firsts.FOLLOW } : { done: false },
    },
    days: daySeries(source, periodId, now, channelId),
    journal: source.journal.filter((entry) => entry.channelId === channelId).slice(0, DETAIL_JOURNAL),
    factor: Number(channel.factor) || 0,
    balance: Number.isInteger(channel.balance) ? channel.balance : null,
  };
}

/** Date du dernier gain capté, toutes chaînes confondues (0 si aucun). */
export function lastGainAt(state) {
  return Object.values((state || emptyState()).channels)
    .reduce((latest, channel) => Math.max(latest, Number(channel?.lastGainAt) || 0), 0);
}

/** Palier d'abonnement déduit du facteur (T1 : 0,2, T2 : 0,4, T3 : 1). */
export function tierFromFactor(factor) {
  const value = Number(factor) || 0;
  if (value >= 0.95) return 3;
  if (value >= 0.35) return 2;
  if (value >= 0.15) return 1;
  return 0;
}

/** Nom affichable : nom Twitch s'il est connu, sinon l'identifiant. */
export function channelName(state, channelId) {
  const channel = (state || emptyState()).channels[channelId] || {};
  return channel.displayName || channel.login || `#${channelId}`;
}
