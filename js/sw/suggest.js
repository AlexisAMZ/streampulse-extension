// Suggestions de chaînes (champ d'ajout du popup).

import { searchChannels } from "../channel-search.js";
import { fetchJson, fetchTwitchJson, twitchHeaders } from "./config.js";

// ─── Suggestions de chaînes (champ d'ajout du popup) ─────────────────────────
// Une frappe = une requête au plus toutes les 220 ms côté popup ; ce cache d'une
// minute évite de redemander la même saisie (retour arrière, retape).
const SUGGEST_TTL_MS = 60_000;
const suggestCache = new Map();

const channelSearchFetchers = {
  twitch: (query) =>
    fetchTwitchJson(`https://api.twitch.tv/helix/search/channels?query=${encodeURIComponent(query)}&first=10`, { headers: twitchHeaders() }, 8000),
  kick: (query) => fetchJson(`https://kick.com/api/search?searched_word=${encodeURIComponent(query)}`, {}, 8000),
};

export async function suggestChannels(platform, query) {
  const key = `${platform}:${String(query || "").toLowerCase()}`;
  const cached = suggestCache.get(key);
  if (cached && Date.now() - cached.at < SUGGEST_TTL_MS) return cached.items;
  const items = await searchChannels(platform, query, channelSearchFetchers);
  if (suggestCache.size > 100) suggestCache.clear();
  suggestCache.set(key, { at: Date.now(), items });
  return items;
}
