// Portée d'une alerte StreamPulse+ (badges ou campagnes Drops) : activée ou
// non, sur tous les jeux ou sur une liste de jeux choisis. Module pur, partagé
// par js/drop-alerts.js et js/badge-watch.js. Testé par tests/alert-scope.test.mjs.

import { sameGame } from "./badges-data.js";

export const SCOPE_ALL = "all";
export const SCOPE_GAMES = "games";
export const MAX_GAMES = 12;
const MAX_GAME_LENGTH = 60;

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Liste de jeux nettoyée : sans vide ni doublon (casse ignorée), plafonnée. */
export function cleanGames(raw) {
  const seen = new Set();
  const games = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const game = String(item ?? "").trim().slice(0, MAX_GAME_LENGTH);
    const key = game.toLowerCase();
    if (!game || seen.has(key)) continue;
    seen.add(key);
    games.push(game);
    if (games.length >= MAX_GAMES) break;
  }
  return games;
}

/**
 * Réglage lu du stockage : { enabled, mode, games, since }.
 * `since` note le moment où la portée a changé : ce qui avait déjà démarré
 * avant ne part pas en alerte (pas d'inondation en activant « tous les jeux »).
 */
export function normalizeScope(stored) {
  const value = isObject(stored) ? stored : {};
  return {
    enabled: value.enabled === true,
    mode: value.mode === SCOPE_ALL ? SCOPE_ALL : SCOPE_GAMES,
    games: cleanGames(value.games),
    since: Math.max(0, Math.floor(Number(value.since) || 0)),
  };
}

/** Nouvelle portée avec les changements, `since` remis à `now` (jamais de mutation). */
export function updateScope(scope, changes, now) {
  return normalizeScope({ ...normalizeScope(scope), ...changes, since: now });
}

/** La portée peut-elle prévenir ? Mode « jeux choisis » sans jeu : non. */
export function scopeActive(scope) {
  return scope.enabled && (scope.mode === SCOPE_ALL || scope.games.length > 0);
}

/** Le jeu entre dans la portée (mêmes règles de nom que les badges). */
export function scopeMatches(scope, game) {
  if (!scopeActive(scope)) return false;
  if (scope.mode === SCOPE_ALL) return true;
  const name = String(game || "");
  return Boolean(name) && scope.games.some((followed) => sameGame(name, followed));
}

/** Fusion d'une sauvegarde : `replace` prend l'autre côté, sinon on additionne les jeux. */
export function mergeScope(local, incoming, replace) {
  const before = normalizeScope(local);
  const after = normalizeScope(incoming);
  if (replace) return after;
  return normalizeScope({
    enabled: before.enabled || after.enabled,
    mode: before.mode === SCOPE_ALL || after.mode === SCOPE_ALL ? SCOPE_ALL : SCOPE_GAMES,
    games: [...before.games, ...after.games],
    since: Math.max(before.since, after.since),
  });
}
