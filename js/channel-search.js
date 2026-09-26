// Suggestions de chaînes pendant la saisie d'un pseudo, comme la recherche de
// Twitch. Module pur : les requêtes passent par les fonctions reçues
// (background.js fournit Helix pour Twitch et l'API publique de Kick).
// YouTube n'a pas de recherche publique sans clé : pas de suggestions.

export const SUGGEST_MIN_CHARS = 2;
export const SUGGEST_LIMIT = 6;
const MAX_QUERY = 25;

/**
 * Texte cherchable : sans @ ni lien, sans caractère qu'un pseudo ne peut pas
 * contenir. Un lien collé ou une saisie trop courte ne déclenche rien ("").
 */
export function cleanQuery(value) {
  const raw = String(value || "").trim();
  if (!raw || /[/:]/.test(raw)) return "";
  const query = raw.replace(/^@+/, "").replace(/[^\p{L}\p{N}_ .-]/gu, "").trim().slice(0, MAX_QUERY);
  return query.length >= SUGGEST_MIN_CHARS ? query : "";
}

const text = (value) => (typeof value === "string" ? value : "");

/** Réponse de GET helix/search/channels. */
export function normalizeTwitch(payload) {
  return (Array.isArray(payload?.data) ? payload.data : [])
    .filter((item) => /^[a-z0-9_]{2,25}$/i.test(text(item?.broadcaster_login)))
    .map((item) => ({
      platform: "twitch",
      login: item.broadcaster_login.toLowerCase(),
      displayName: text(item.display_name) || item.broadcaster_login,
      avatar: text(item.thumbnail_url),
      live: item.is_live === true,
      game: text(item.game_name),
      followers: 0,
    }));
}

/** Réponse de GET kick.com/api/search?searched_word=… */
export function normalizeKick(payload) {
  return (Array.isArray(payload?.channels) ? payload.channels : [])
    .filter((item) => /^[a-z0-9_-]{2,25}$/i.test(text(item?.slug)) && item.is_banned !== true)
    .map((item) => ({
      platform: "kick",
      login: item.slug.toLowerCase(),
      displayName: text(item.user?.username) || item.slug,
      avatar: text(item.user?.profilePic || item.user?.profile_pic),
      live: item.isLive === true || item.is_live === true,
      game: "",
      followers: Math.max(0, Number(item.followersCount ?? item.followers_count) || 0),
    }));
}

/**
 * Classement : le pseudo exact d'abord, puis ceux qui commencent par la
 * saisie, les lives avant les autres, et l'ordre de la plateforme sinon.
 */
export function rankSuggestions(items, query, limit = SUGGEST_LIMIT) {
  const needle = String(query || "").toLowerCase().replace(/\s+/g, "");
  const score = (item) => {
    const login = item.login;
    const name = item.displayName.toLowerCase();
    if (login === needle || name === needle) return 0;
    if (login.startsWith(needle) || name.startsWith(needle)) return item.live ? 1 : 2;
    return item.live ? 3 : 4;
  };
  const seen = new Set();
  return items
    .map((item, index) => ({ item, index, score: score(item) }))
    .sort((a, b) => a.score - b.score || b.item.followers - a.item.followers || a.index - b.index)
    .map(({ item }) => item)
    .filter((item) => !seen.has(item.login) && seen.add(item.login))
    .slice(0, limit);
}

/**
 * @param {"twitch"|"kick"|string} platform
 * @param {string} rawQuery
 * @param {{ twitch?: (query: string) => Promise<unknown>, kick?: (query: string) => Promise<unknown> }} fetchers
 */
export async function searchChannels(platform, rawQuery, fetchers) {
  const query = cleanQuery(rawQuery);
  if (!query) return [];
  if (platform === "twitch" && fetchers.twitch) return rankSuggestions(normalizeTwitch(await fetchers.twitch(query)), query);
  if (platform === "kick" && fetchers.kick) return rankSuggestions(normalizeKick(await fetchers.kick(query)), query);
  return [];
}
