// Recherche de catégories (jeux) pour les alertes intelligentes : la règle ne
// compare que des noms exacts, donc on propose les noms officiels de la
// plateforme au lieu de laisser deviner l'orthographe. Module pur : les
// requêtes passent par les fonctions reçues (service worker pour Helix).

const MIN_CHARS = 2;
const LIMIT = 8;
const MAX_QUERY = 60;

const text = (value) => (typeof value === "string" ? value.trim() : "");

export function cleanCategoryQuery(value) {
  const query = String(value || "").replace(/[<>]/g, "").trim().slice(0, MAX_QUERY);
  return query.length >= MIN_CHARS ? query : "";
}

/** Réponse de GET helix/search/categories. */
export function normalizeTwitchCategories(payload) {
  return (Array.isArray(payload?.data) ? payload.data : [])
    .filter((item) => text(item?.name))
    .map((item) => ({
      platform: "twitch",
      name: text(item.name),
      image: text(item.box_art_url).replace("{width}", "52").replace("{height}", "72"),
    }));
}

const firstUrl = (srcset) => text(srcset).split(/\s+/)[0];

/** Réponse de GET kick.com/api/search?searched_word=… (clé `categories`). */
export function normalizeKickCategories(payload) {
  return (Array.isArray(payload?.categories) ? payload.categories : [])
    .filter((item) => text(item?.name))
    .map((item) => ({
      platform: "kick",
      name: text(item.name),
      image: text(item.banner?.src) || firstUrl(item.banner?.srcset) || firstUrl(item.banner?.responsive),
    }));
}

const fold = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Le nom exact d'abord, puis ceux qui commencent par la saisie, puis le reste. */
export function rankCategories(items, query, limit = LIMIT) {
  const needle = fold(query);
  const seen = new Set();
  const score = (item) => {
    const name = fold(item.name);
    if (name === needle) return 0;
    return name.startsWith(needle) ? 1 : 2;
  };
  return items
    .filter((item) => {
      const key = fold(item.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item, index) => ({ item, index, rank: score(item) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map(({ item }) => item);
}

/**
 * @param {"twitch"|"kick"|string} platform
 * @param {Record<string, (query: string) => Promise<object>>} fetchers
 */
export async function searchCategories(platform, rawQuery, fetchers) {
  const query = cleanCategoryQuery(rawQuery);
  const fetcher = fetchers?.[platform];
  if (!query || typeof fetcher !== "function") return [];
  const payload = await fetcher(query);
  const normalize = platform === "kick" ? normalizeKickCategories : normalizeTwitchCategories;
  return rankCategories(normalize(payload), query);
}
