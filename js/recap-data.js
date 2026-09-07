// Agregation du temps de visionnage en un recapitulatif ZEvent.
// Module pur : aucun acces a chrome.*, ni au DOM. Teste par tests/recap-data.test.mjs.

import { ZEVENT_PARTICIPANTS } from "./zevent-participants.js";

const DEFAULT_LIMIT = 8;

/**
 * Le ZEvent se joue sur Twitch : une entree Kick portant le meme login
 * n'est pas le meme flux et ne doit pas compter.
 */
function isZEventEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  if (entry.platform !== "twitch") return false;
  if (typeof entry.watchSeconds !== "number" || !Number.isFinite(entry.watchSeconds)) return false;
  if (entry.watchSeconds <= 0) return false;
  if (typeof entry.channel !== "string" || !entry.channel) return false;
  return ZEVENT_PARTICIPANTS.has(entry.channel.toLowerCase().trim());
}

/**
 * Construit le recap d'un mois donne.
 *
 * @param {object|null} watchTimeData contenu de `betaWatchTimeData`
 * @param {string} monthKey cle "AAAA-MM"
 * @param {{limit?: number}} [options] taille du classement rendu
 * @returns {{month: string, totalSeconds: number, streamerCount: number,
 *            top: Array<{channel: string, platform: string, watchSeconds: number,
 *                        avatarUrl: string, share: number}>, isEmpty: boolean}}
 */
export function buildRecap(watchTimeData, monthKey, options = {}) {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const monthData = (watchTimeData && watchTimeData[monthKey]) || {};

  const entries = Object.values(monthData).filter(isZEventEntry);
  const totalSeconds = entries.reduce((sum, e) => sum + e.watchSeconds, 0);

  const top = entries
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
    month: monthKey,
    totalSeconds,
    streamerCount: entries.length,
    top,
    isEmpty: entries.length === 0,
  };
}

/** Duree lisible : "12 h 35", "1 h", "45 min". */
export function formatHours(seconds) {
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
  return `${hours} h ${String(minutes).padStart(2, "0")}`;
}
