// Alertes des badges à durée limitée : un badge dont l'événement ne dure que
// quelques dizaines de minutes se rate facilement. Deux déclencheurs :
// - automatique : tout événement court (≤ 2 h) prévient dès qu'il est en cours,
//   si les alertes de badges sont actives ;
// - cloche : un badge suivi prévient à son démarrage (s'il n'était pas encore
//   en cours quand on l'a suivi), puis avant sa fin.
// - portée StreamPulse+ : tous les badges, ou ceux des jeux choisis
//   (js/alert-scope.js), préviennent dès qu'ils deviennent disponibles.
// Module pur : aucun accès à chrome.* ni au DOM. Testé par tests/badge-watch.test.mjs.

import { SCOPE_ALL, normalizeScope, scopeMatches } from "./alert-scope.js";

/** Badges suivis avec la cloche : { [badgeId]: { at, live } }. */
export const BADGE_WATCH_KEY = "streamPulseBadgeWatch";
/** Alertes déjà envoyées : { "<badge>|<campagne>|<drop>|start|end": ms }. */
export const BADGE_ALERT_SEEN_KEY = "streamPulseBadgeAlertSeen";

/** Bouton « badges temporaires » de l'onglet Badges (StreamPulse+) : booléen. */
export const BADGE_LIMITED_KEY = "streamPulseBadgeLimited";

/** Alertes badges StreamPulse+ : { enabled, mode, games, since } (js/alert-scope.js). */
export const BADGE_SCOPE_KEY = "streamPulseBadgeAlertsScope";

/** Un événement de cette durée ou moins est « court » (alerte gratuite). */
export const SHORT_EVENT_MS = 2 * 3_600_000;
/** Un badge temporaire, pour StreamPulse+ : une journée ou moins. */
export const LIMITED_EVENT_MS = 24 * 3_600_000;
/** La cloche prévient quand il reste ce délai ou moins. */
export const ENDING_SOON_MS = 15 * 60_000;
/** Une alerte déjà envoyée est oubliée après ce délai. */
const SEEN_KEEP_MS = 7 * 86_400_000;
/** Alertes par passage : le reste attend le passage suivant. */
const MAX_ALERTS_PER_PASS = 3;

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const finite = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

/** Badges suivis lus dans le stockage, entrées illisibles écartées. */
export function watchFrom(stored = {}) {
  const value = (stored || {})[BADGE_WATCH_KEY];
  if (!isObject(value)) return {};
  const out = {};
  for (const [id, entry] of Object.entries(value)) {
    if (isObject(entry)) out[id] = { at: finite(entry.at), live: entry.live === true };
  }
  return out;
}

export function seenFrom(stored = {}) {
  const value = (stored || {})[BADGE_ALERT_SEEN_KEY];
  if (!isObject(value)) return {};
  const out = {};
  for (const [key, at] of Object.entries(value)) if (finite(at) > 0) out[key] = finite(at);
  return out;
}

/** Option « badges temporaires » de l'onglet Badges : activée par défaut, éteinte seulement par un choix explicite. */
export function limitedFrom(stored = {}) {
  return (stored || {})[BADGE_LIMITED_KEY] !== false;
}

/** Temps restant lisible dans toutes les langues : « 25 min », « 3 h », « 3 h 20 ». */
export function formatTimeLeft(ms) {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes <= 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${String(rest).padStart(2, "0")}` : `${hours} h`;
}

/** Suit ou ne suit plus un badge ; `live` note s'il était déjà en cours au clic. Renvoie une nouvelle table. */
export function toggleWatch(watch, id, { live, now }) {
  if (watch[id]) {
    const { [id]: _removed, ...rest } = watch;
    return rest;
  }
  return { ...watch, [id]: { at: now, live: live === true } };
}

/** Événement dont la durée connue tient dans `maxMs` (début et fin datés). */
export function isShortEvent(event, maxMs = SHORT_EVENT_MS) {
  return Boolean(event) && maxMs > 0 && event.startsAt > 0 && event.endsAt > 0 && event.endsAt - event.startsAt <= maxMs;
}

/**
 * @param {{ badges: object[], watch: object, seen: object, shortMs: number, now: number, baseline?: boolean, scope?: object }} input
 *   `scope` : portée StreamPulse+ (déjà vérifiée côté licence) ; un badge de la
 *   portée prévient à son démarrage, s'il a démarré après le réglage.
 *   `baseline` : premier passage, les départs déjà en cours sont notés comme vus sans prévenir.
 *   `shortMs` : durée en dessous de laquelle un badge prévient seul (0 = jamais).
 *   `badges` : sortie de catalogBadges (status, owned, event).
 * @returns {{ alerts: { badge: object, kind: "start" | "ending", endsAt: number }[], seen: object }}
 */
export function planBadgeAlerts({ badges, watch, seen, shortMs, now, baseline = false, scope = null }) {
  const plusScope = normalizeScope(scope);
  const next = {};
  for (const [key, at] of Object.entries(seen)) if (now - at < SEEN_KEEP_MS) next[key] = at;

  const alerts = [];
  for (const badge of badges) {
    const event = badge.event;
    if (badge.status !== "live" || badge.owned || !event) continue;
    const base = `${badge.id}|${event.campaignId}|${event.dropId}`;
    const followed = watch[badge.id];
    const inScope = scopeMatches(plusScope, event.game) && !(event.startsAt > 0 && event.startsAt < plusScope.since);
    const wantsStart = isShortEvent(event, shortMs) || (followed && !followed.live) || inScope;
    if (wantsStart && !next[`${base}|start`] && alerts.length < MAX_ALERTS_PER_PASS) {
      next[`${base}|start`] = now;
      if (!baseline) alerts.push({ badge, kind: "start", endsAt: event.endsAt });
    }

    const left = event.endsAt - now;
    if (followed && event.endsAt > 0 && left > 0 && left <= ENDING_SOON_MS && !next[`${base}|end`] && alerts.length < MAX_ALERTS_PER_PASS) {
      next[`${base}|end`] = now;
      alerts.push({ badge, kind: "ending", endsAt: event.endsAt });
    }
  }
  return { alerts, seen: next };
}

/**
 * Badges tout juste apparus au catalogue à annoncer. Avec la portée Plus
 * « tous les badges », chacun (payant compris) ; sinon, les gratuits si
 * l'alerte gratuite est active. Les badges d'un jeu choisi préviennent plus
 * tard, à leur démarrage (planBadgeAlerts), quand leur jeu est connu.
 * @param {object[]} added @param {{ scope?: object, freeAlerts: boolean, isPaid: (badge: object) => boolean }} options
 * @returns {object[]} trois au plus
 */
export function newBadgeAlerts(added, { scope = null, freeAlerts, isPaid }) {
  const plusScope = normalizeScope(scope);
  const all = plusScope.enabled && plusScope.mode === SCOPE_ALL;
  const list = Array.isArray(added) ? added : [];
  const wanted = all ? list : freeAlerts ? list.filter((badge) => !isPaid(badge)) : [];
  return wanted.slice(0, MAX_ALERTS_PER_PASS);
}
