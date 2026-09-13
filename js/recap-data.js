// Agregation du temps de visionnage pour la page de recap.
// Module pur : aucun acces a chrome.*, ni au DOM. Teste par tests/recap-data.test.mjs.
//
// Deux sources coexistent dans le storage :
// - `betaWatchTimeData`          { "AAAA-MM":    { "plateforme:chaine": entree } }
// - `streamPulseWatchTimeDaily`  { "AAAA-MM-JJ": { "plateforme:chaine": entree } }
// Les mois gardent l'historique d'avant le decoupage par jour ; les periodes
// glissantes (7 et 30 jours) ne peuvent venir que du stockage journalier.

const DEFAULT_LIMIT = 8;

export const ROLLING_PERIODS = [
  { id: "7d", days: 7 },
  { id: "30d", days: 30 },
];

const pad = (n) => String(n).padStart(2, "0");

/** Cle de jour en heure locale : "AAAA-MM-JJ". */
export function dayKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isValidEntry(entry) {
  return (
    !!entry &&
    typeof entry === "object" &&
    typeof entry.platform === "string" &&
    typeof entry.channel === "string" &&
    entry.channel.length > 0 &&
    typeof entry.watchSeconds === "number" &&
    Number.isFinite(entry.watchSeconds) &&
    entry.watchSeconds > 0
  );
}

/**
 * Periodes proposees : les deux glissantes d'abord, puis chaque mois present
 * dans le stockage mensuel, du plus recent au plus ancien.
 */
export function listPeriods(monthly, _daily, _now = new Date()) {
  const months = Object.keys(monthly || {})
    .filter((key) => /^\d{4}-\d{2}$/.test(key))
    .sort()
    .reverse();
  return [
    ...ROLLING_PERIODS.map((p) => ({ id: p.id, kind: "rolling", days: p.days })),
    ...months.map((month) => ({ id: `month:${month}`, kind: "month", month })),
  ];
}

/** Jours couverts par une periode glissante, aujourd'hui inclus. */
export function rollingDayKeys(days, now = new Date()) {
  const keys = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    keys.push(dayKey(d));
  }
  return keys;
}

function mergeBuckets(buckets) {
  const merged = new Map();
  for (const bucket of buckets) {
    for (const entry of Object.values(bucket || {})) {
      if (!isValidEntry(entry)) continue;
      const key = `${entry.platform}:${entry.channel}`;
      const current = merged.get(key);
      if (current) {
        merged.set(key, {
          ...current,
          watchSeconds: current.watchSeconds + entry.watchSeconds,
          avatarUrl: entry.avatarUrl || current.avatarUrl,
        });
      } else {
        merged.set(key, {
          platform: entry.platform,
          channel: entry.channel,
          watchSeconds: entry.watchSeconds,
          avatarUrl: entry.avatarUrl || "",
        });
      }
    }
  }
  return [...merged.values()];
}

/** Entrees agregees d'une periode ("7d", "30d" ou "month:AAAA-MM"). */
export function collectEntries(monthly, daily, periodId, now = new Date()) {
  const rolling = ROLLING_PERIODS.find((p) => p.id === periodId);
  if (rolling) {
    const days = rollingDayKeys(rolling.days, now);
    return mergeBuckets(days.map((key) => (daily || {})[key]));
  }
  const match = /^month:(\d{4}-\d{2})$/.exec(periodId || "");
  if (match) return mergeBuckets([(monthly || {})[match[1]]]);
  return [];
}

/**
 * Construit le modele du recap a partir des entrees d'une periode.
 *
 * @returns {{totalSeconds: number, streamerCount: number,
 *            top: Array<{channel, platform, watchSeconds, avatarUrl, share}>,
 *            platforms: Record<string, number>, isEmpty: boolean}}
 */
export function buildRecap(entries, options = {}) {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const valid = (entries || []).filter(isValidEntry);
  const totalSeconds = valid.reduce((sum, e) => sum + e.watchSeconds, 0);

  const platforms = valid.reduce(
    (acc, e) => ({ ...acc, [e.platform]: (acc[e.platform] || 0) + e.watchSeconds }),
    {}
  );

  const top = valid
    .slice()
    .sort((a, b) => b.watchSeconds - a.watchSeconds)
    .slice(0, limit)
    .map((e) => ({
      channel: e.channel,
      platform: e.platform,
      watchSeconds: e.watchSeconds,
      avatarUrl: e.avatarUrl || "",
      share: totalSeconds > 0 ? e.watchSeconds / totalSeconds : 0,
    }));

  return {
    totalSeconds,
    streamerCount: valid.length,
    top,
    platforms,
    isEmpty: valid.length === 0,
  };
}

/** Duree lisible : "12 h 35", "1 h", "45 min". */
export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  let hours = Math.floor(total / 3600);
  let minutes = Math.round((total % 3600) / 60);
  // 3599 s arrondit a 60 min : c'est une heure, pas "60 min".
  if (minutes === 60) {
    hours += 1;
    minutes = 0;
  }
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${pad(minutes)}`;
}
