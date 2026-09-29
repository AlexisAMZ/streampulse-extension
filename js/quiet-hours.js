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
