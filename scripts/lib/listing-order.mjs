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

/** Tuiles promo : nom du fichier source par langue de fiche (FR = sans suffixe). */
export const PROMO_FILES = {
  FR: { marquee: "marquee_1400x560.png", small: "small_tile.png" },
  EN: { marquee: "marquee_1400x560_en.png", small: "small_tile_en.png" },
};
