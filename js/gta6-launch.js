// Calendrier du thème événement GTA VI. Fonctions pures, sans DOM ni chrome.*.
//
// La plupart des stores débloquent le jeu à minuit, heure locale, le 19 novembre 2026
// (Nouvelle-Zélande en premier, côte ouest des États-Unis en dernier). Le constructeur
// local de Date donne précisément ce minuit dans le fuseau du navigateur : chacun voit
// son propre compte à rebours, sans géolocalisation ni requête.

/** Minuit du 19 novembre 2026, heure locale. */
export const GTA6_LAUNCH = new Date(2026, 10, 19, 0, 0, 0);

/** Fin de l'événement (le thème est offert jusqu'au 30 novembre inclus). */
export const GTA6_EVENT_END = new Date(2026, 11, 1, 0, 0, 0);

/**
 * @param {Date} now
 * @returns {{ phase: "soon", days: number, hours: number, minutes: number, seconds: number } | { phase: "out" } | { phase: "over" }}
 */
export function launchState(now) {
  const time = now instanceof Date ? now.getTime() : Number.NaN;
  if (!Number.isFinite(time) || time >= GTA6_EVENT_END.getTime()) return { phase: "over" };
  const left = Math.ceil((GTA6_LAUNCH.getTime() - time) / 1000);
  if (left <= 0) return { phase: "out" };
  return {
    phase: "soon",
    days: Math.floor(left / 86400),
    hours: Math.floor((left % 86400) / 3600),
    minutes: Math.floor((left % 3600) / 60),
    seconds: left % 60,
  };
}
