// Plateformes prises en compte dans le récap : un réglage gratuit (avec ou sans StreamPulse+).
// YouTube est décoché par défaut, provisoirement : sa mesure du « direct seulement » est en cours de
// vérification et ne doit pas gonfler le récap de ce qu'on regarde en temps normal.

export const RECAP_PLATFORMS = ["twitch", "kick", "youtube", "chzzk"];
export const DEFAULT_RECAP_PLATFORMS = ["twitch", "kick", "chzzk"];

/** Liste de plateformes connues, sans doublon, dans l'ordre canonique ; valeur invalide : le défaut. */
export function normalizeRecapPlatforms(value) {
  if (!Array.isArray(value)) return [...DEFAULT_RECAP_PLATFORMS];
  return RECAP_PLATFORMS.filter((platform) => value.includes(platform));
}

/** Entrées du récap restreintes aux plateformes choisies ; sans choix (undefined), tout passe. */
export function filterByPlatforms(entries, platforms) {
  if (!Array.isArray(platforms)) return entries || [];
  const allowed = new Set(platforms);
  return (entries || []).filter((entry) => allowed.has(entry?.platform));
}
