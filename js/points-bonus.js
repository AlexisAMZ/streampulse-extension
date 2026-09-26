// Reconnaissance de la caisse de bonus de points de chaîne Twitch. Module pur :
// il reçoit la description d'un bouton, jamais le DOM, et n'appelle pas chrome.*.
// Testé par tests/points-bonus.test.mjs, chargé par channelPointsClaimer.js.

/** Tracé SVG du coffre Twitch, indépendant de la langue. */
export const CHEST_PATH = "M13 12h-2v2h2v-2Z";

/** Boutons de chaîne qui ne sont jamais la caisse, quel que soit leur libellé. */
const NEVER_THE_CHEST = /gift|subscribe|follow|bits/i;

/**
 * Vrai si le bouton décrit est la caisse de bonus.
 *
 * La caisse vit dans la zone des points, sous le chat : un bouton hors de
 * cette zone n'est jamais elle. Pendant le SUBtember, le bouton cadeau de la
 * chaîne s'appelle « Gift Bonus Subs » (« Cadeau : abonnements bonus ») ; un
 * sélecteur aria-label*="Bonus" sur toute la page le trouvait avant la caisse
 * et ouvrait la fenêtre d'abonnements offerts.
 *
 * @param {{label?: string, className?: string, dataTarget?: string,
 *   disabled?: boolean, hasBonusIcon?: boolean, hasChestPath?: boolean,
 *   inPointsSummary?: boolean}} button
 */
export function isBonusChest(button) {
  if (!button || button.disabled || !button.inPointsSummary) return false;
  if (NEVER_THE_CHEST.test(button.dataTarget || "")) return false;
  if (/claimable-bonus/.test(button.className || "")) return true;
  if (button.hasBonusIcon || button.hasChestPath) return true;
  return /bonus/i.test(button.label || "");
}

/** Index de la première caisse parmi les boutons décrits, ou -1. */
export function pickBonusChest(buttons) {
  return (buttons || []).findIndex(isBonusChest);
}
