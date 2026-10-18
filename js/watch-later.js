// Pure data contract: no storage, clock, random IDs or DOM work here.
export const WATCH_LATER_KEY = "streamPulseWatchLater";
export const WATCH_LATER_LIMITS = Object.freeze({ entries: 200, url: 2048, title: 300, note: 2000 });

const HOSTS = new Map([
  ["twitch.tv", "twitch"], ["www.twitch.tv", "twitch"], ["clips.twitch.tv", "twitch"],
  ["kick.com", "kick"], ["youtube.com", "youtube"], ["www.youtube.com", "youtube"], ["youtu.be", "youtube"],
]);

function parseLink(value) {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (raw.length > WATCH_LATER_LIMITS.url || /[\s\\]/u.test(raw)
    || [...raw].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return null;
  // Check the literal authority too: URL() repairs backslashes, credentials
  // with an empty username, and other malformed or disguised authorities.
  const authority = /^https:\/\/([^/?#]+)/i.exec(raw)?.[1].toLowerCase();
  const host = authority?.replace(/:443$/, "");
  const platform = HOSTS.get(host);
  if (!platform) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" || parsed.hostname !== host || parsed.port
      || parsed.username || parsed.password || parsed.href.length > WATCH_LATER_LIMITS.url) return null;
    return { url: parsed.href, platform };
  } catch (_error) {
    return null;
  }
}

function timestamp(value) {
  const time = typeof value === "number" ? value : typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(time) && time >= 0 && time <= 8.64e15 ? Math.trunc(time) : 0;
}

/** First valid occurrence wins; unknown dates remain 0, never today's date. */
export function normalizeWatchLater(array) {
  const entries = [];
  const seen = new Set();
  for (const raw of Array.isArray(array) ? array : []) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const link = parseLink(raw.url);
    if (!link || seen.has(link.url)) continue;
    seen.add(link.url);
    entries.push({
      id: typeof raw.id === "string" && raw.id.trim() ? raw.id : link.url,
      url: link.url,
      title: (typeof raw.title === "string" && raw.title.trim() || link.url).slice(0, WATCH_LATER_LIMITS.title).trimEnd(),
      note: typeof raw.note === "string" ? raw.note.slice(0, WATCH_LATER_LIMITS.note) : "",
      createdAt: timestamp(raw.createdAt),
      platform: link.platform,
    });
    if (entries.length === WATCH_LATER_LIMITS.entries) break;
  }
  return entries;
}

/** Merge a user gesture, preserving identity, date and omitted fields. No eviction. */
export function mergeWatchLater(array, input, { id, createdAt } = {}) {
  const link = parseLink(input?.url);
  if (!link) throw Object.assign(new Error("invalidUrl"), { code: "invalidUrl" });
  for (const [field, code] of [["title", "invalidTitle"], ["note", "invalidNote"]]) {
    if (input[field] !== undefined && (typeof input[field] !== "string" || input[field].length > WATCH_LATER_LIMITS[field])) {
      throw Object.assign(new Error(code), { code });
    }
  }
  const entries = normalizeWatchLater(array);
  const index = entries.findIndex((entry) => entry.url === link.url);
  const previous = entries[index];
  if (!previous && entries.length === WATCH_LATER_LIMITS.entries) {
    throw Object.assign(new Error("full"), { code: "full" });
  }
  const entry = {
    id: previous?.id ?? (typeof id === "string" && id.trim() ? id : link.url),
    url: link.url,
    title: (input.title?.trim() || previous?.title || link.url).slice(0, WATCH_LATER_LIMITS.title),
    note: input.note ?? previous?.note ?? "",
    createdAt: previous?.createdAt ?? timestamp(createdAt),
    platform: link.platform,
  };
  if (previous) entries[index] = entry;
  else entries.unshift(entry);
  return { entries, entry };
}
