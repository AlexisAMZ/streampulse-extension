// Alertes de campagnes Drops (StreamPulse+) : prévenir quand une campagne
// démarre sur un jeu suivi. Module pur : aucun accès à chrome.* ni au DOM.
// Testé par tests/drop-alerts.test.mjs. Les campagnes viennent de la liste
// relue par les onglets Twitch (Twitch refuse la liste au service worker, qui
// n'a pas l'en-tête Client-Integrity) : l'alerte part à chaque nouvelle liste,
// et une seule fois par campagne.

import { isActiveCampaign, isPlainObject, list } from "./drops-data.js";
import { sameGame } from "./badges-data.js";

export const DROP_ALERTS_KEY = "streamPulseDropAlerts";
export const DROP_ALERTS_SEEN_KEY = "streamPulseDropAlertsSeen";

export const MAX_GAMES = 12;
export const MAX_SEEN = 400;
/** Une campagne démarrée depuis plus longtemps n'est plus une actu : pas d'alerte. */
export const FRESH_CAMPAIGN_MS = 7 * 86_400_000;

/** Réglages lus du storage : { enabled, games } nettoyé, dédupliqué. */
export function normalizeDropAlerts(stored) {
  const value = isPlainObject(stored) ? stored : {};
  const seen = new Set();
  const games = [];
  for (const raw of list(value.games)) {
    const game = String(raw ?? "").trim().slice(0, 60);
    const key = game.toLowerCase();
    if (!game || seen.has(key)) continue;
    seen.add(key);
    games.push(game);
    if (games.length >= MAX_GAMES) break;
  }
  return { enabled: value.enabled === true, games };
}

/** Campagnes déjà signalées : { at, ids }. `at` vaut 0 tant que rien n'est noté. */
export function seenFrom(stored) {
  const value = isPlainObject(stored) ? stored : {};
  return {
    at: Math.max(0, Math.floor(Number(value.at) || 0)),
    ids: list(value.ids).filter((id) => typeof id === "string" && id),
  };
}

/** Le jeu d'une campagne correspond à un jeu suivi : même nom, ou l'un englobe l'autre (mêmes règles que les badges). */
export function gameMatches(campaignGame, followed) {
  const game = String(campaignGame || "");
  return followed.some((name) => sameGame(game, name));
}

/**
 * Compare une liste de campagnes aux réglages.
 *
 * Au tout premier passage (`at` à 0), les campagnes déjà en course sont
 * notées sans alerte : on prévient de l'arrivée d'une campagne, pas de tout
 * le catalogue du moment. Ensuite, chaque campagne suivie jamais vue part en
 * alerte, si elle a démarré récemment.
 *
 * @returns {{ alerts: object[], seen: { at: number, ids: string[] } }}
 */
export function campaignAlerts(campaigns, settings, seen, now) {
  const known = new Set(seen.ids);
  const alerts = [];
  const ids = [...seen.ids];
  const inList = new Set();
  for (const campaign of list(campaigns)) {
    if (!isPlainObject(campaign) || typeof campaign.id !== "string" || !campaign.id) continue;
    inList.add(campaign.id);
    if (!settings.enabled || !gameMatches(campaign.game, settings.games)) continue;
    if (!isActiveCampaign(campaign, now) || known.has(campaign.id)) continue;
    known.add(campaign.id);
    ids.push(campaign.id);
    if (seen.at && campaign.startsAt && now - campaign.startsAt <= FRESH_CAMPAIGN_MS) alerts.push(campaign);
  }
  // Les campagnes sorties de la liste (terminées depuis une semaine) quittent
  // les déjà-vues, pour ne pas gonfler ; la liste reste plafonnée en dernier
  // recours. Liste jamais lue : rien n'est purgé.
  const kept = inList.size ? ids.filter((id) => inList.has(id)) : ids;
  return {
    alerts,
    seen: { at: seen.at || now, ids: kept.slice(-MAX_SEEN) },
  };
}
