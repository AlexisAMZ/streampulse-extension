/**
 * Heures calmes : plage horaire pendant laquelle StreamPulse n'affiche aucune
 * notification (alertes de live, de categorie, de titre, rattrapage).
 *
 * Format des bornes : "HH:MM" sur 24 h. La plage peut traverser minuit
 * (23:00 → 08:00). Repli strict : desactif, borne invalide ou debut egal a
 * la fin => jamais bloque. On prefere une notification de trop qu'un reglage
 * mal tape qui avale silencieusement toutes les alertes.
 */

/**
 * Analyse "HH:MM" (ou "H:MM") et renvoie { hours, minutes }, ou null si la
 * valeur n'est pas une heure valide du jour.
 */
export function parseHhMm(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

/**
 * Renvoie true si l'instant donne tombe dans la plage des heures calmes.
 * `when` : Date ou horodatage en millisecondes. `preferences` : objet portant
 * quietHoursEnabled / quietHoursStart / quietHoursEnd.
 */
export function isWithinQuietHours(when, preferences) {
  if (!preferences || preferences.quietHoursEnabled !== true) return false;
  const start = parseHhMm(preferences.quietHoursStart);
  const end = parseHhMm(preferences.quietHoursEnd);
  if (!start || !end) return false;
  if (start.hours === end.hours && start.minutes === end.minutes) return false;

  const date = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(date.getTime())) return false;
  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;

  if (startMinutes < endMinutes) {
    // Plage d'un meme jour, fin exclue : a 08:00 pile, on re-notifie.
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  // Plage traversant minuit : [23:00 → 00:00[ ou [00:00 → 08:00[.
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

/**
 * bornes par défaut de l'interface, partagées par le popup et l'onboarding.
 */
export const DEFAULT_QUIET_START = "23:00";
export const DEFAULT_QUIET_END = "08:00";

/** « 8:05 » → « 08:05 » ; toute entrée invalide retombe sur `fallback`. */
export function normalizeQuietTime(value, fallback) {
  const parsed = parseHhMm(value);
  return parsed ? `${String(parsed.hours).padStart(2, "0")}:${String(parsed.minutes).padStart(2, "0")}` : fallback;
}

/**
 * Variante à bornes séparées (popup) : mêmes règles que isWithinQuietHours,
 * sans l'objet de préférences. Début = fin : jamais.
 */
export function isQuietNow(now, start = DEFAULT_QUIET_START, end = DEFAULT_QUIET_END) {
  // Côté interface, une saisie sale retombe sur les défauts affichés ; le
  // service worker, lui, refuse une borne invalide (jamais silencieux).
  return isWithinQuietHours(now, {
    quietHoursEnabled: true,
    quietHoursStart: normalizeQuietTime(start, DEFAULT_QUIET_START),
    quietHoursEnd: normalizeQuietTime(end, DEFAULT_QUIET_END),
  });
}

/** La pause ne modifie aucune preference et expire par comparaison d'horodatage. */
export function normalizeNotificationPause(value) {
  if (!Number.isFinite(value?.until) || value.until <= 0 || Number.isNaN(new Date(value.until).getTime())) {
    return { until: 0, exceptPinned: false };
  }
  return { until: value.until, exceptPinned: value.exceptPinned === true };
}

export function notificationPauseUntil(duration, now = Date.now()) {
  const date = new Date(now);
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid pause date");
  if (duration === "hour") date.setTime(date.getTime() + 3_600_000);
  else if (duration === "tomorrow") {
    // Jour civil local, pas +24 h : respecte les changements d'heure.
    date.setDate(date.getDate() + 1);
    date.setHours(8, 0, 0, 0);
  } else throw new RangeError("Invalid pause duration");
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid pause date");
  return date.getTime();
}

/** Gate partage par les envois et le diagnostic. Les heures calmes restent prioritaires. */
export function getNotificationSilence({ now = Date.now(), pause, preferences, pinnedIds, streamerId } = {}) {
  const normalized = normalizeNotificationPause(pause);
  const until = now < normalized.until ? normalized.until : 0;
  const pinnedException = Boolean(until && normalized.exceptPinned && streamerId && Array.isArray(pinnedIds) && pinnedIds.includes(streamerId));
  const paused = Boolean(until && !pinnedException);
  const quiet = isWithinQuietHours(now, preferences);
  return { blocked: paused || quiet, paused, quiet, pinnedException, until };
}
