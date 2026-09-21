/**
 * Ordre des visuels sur les fiches des stores, partagé par les scripts de
 * publication : le tableau de bord d'abord, la compatibilité Twitch & Kick ensuite.
 */

export const SCREENSHOT_ORDER = [
  "01-dashboard.png",
  "06-compat.png",
  "02-automation.png",
  "03-features.png",
  "04-recap.png",
];

/**
 * Tuiles promo : le Chrome Web Store n'en stocke qu'un seul jeu pour toute la
 * fiche, quelle que soit la langue consultee. Elles sont donc uniques et en
 * anglais.
 */
export const PROMO = { marquee: "marquee_1400x560.png", small: "small_tile.png" };
