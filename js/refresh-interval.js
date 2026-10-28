// Délai d'actualisation des badges et des Drops (StreamPulse+) : certains ne
// restent que quelques minutes, l'abonné peut donc relire plus souvent. Sans
// licence, le délai par défaut s'applique. Module pur, testé par
// tests/refresh-interval.test.mjs.

/** Choix proposés, en minutes. */
export const REFRESH_CHOICES = Object.freeze([1, 2, 3, 5, 10, 15]);
export const DEFAULT_REFRESH_MINUTES = 5;
/** Marge pour qu'une alarme un peu en avance ne saute pas sa lecture. */
const SLACK_MS = 20_000;

/** Valeur stockée nettoyée : un des choix, sinon le défaut. */
export function normalizeRefreshMinutes(value) {
  const minutes = Number(value);
  return REFRESH_CHOICES.includes(minutes) ? minutes : DEFAULT_REFRESH_MINUTES;
}

/** Délai réellement appliqué : le choix de l'abonné, le défaut sans licence. */
export function effectiveRefreshMinutes(preferences, plus) {
  return plus ? normalizeRefreshMinutes(preferences?.dropsRefreshMinutes) : DEFAULT_REFRESH_MINUTES;
}

/** Âge à partir duquel une lecture est relancée, un peu sous la période de l'alarme. */
export function refreshGapMs(minutes) {
  return Math.max(30_000, minutes * 60_000 - SLACK_MS);
}
