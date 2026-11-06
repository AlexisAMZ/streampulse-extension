// Import des follows Twitch par connexion OAuth ponctuelle (jeton implicite,
// lecture seule). Module pur : aucune API Chrome, le réseau est injecté.
// Le jeton ne quitte jamais la page, n'est jamais stocké, et il est annulé
// auprès de Twitch dès que la liste est lue.

import { getBulkKey } from "./bulk-add.js";

export const FOLLOWS_SCOPE = "user:read:follows";

const AUTHORIZE_URL = "https://id.twitch.tv/oauth2/authorize";
const REVOKE_URL = "https://id.twitch.tv/oauth2/revoke";
const HELIX = "https://api.twitch.tv/helix";
const PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 50; // 5 000 follows : au-delà, Twitch lui-même plafonne
const TWITCH_LOGIN = /^[a-z0-9_]{1,25}$/;
const FETCH_TIMEOUT_MS = 10_000;
const AVATAR_HOST = "static-cdn.jtvnw.net";

/** Adresse de la page de connexion Twitch (consentement toujours reposé). */
export function buildAuthorizeUrl({ clientId, redirectUri, state }) {
  if (!clientId || !redirectUri || !state) throw new Error("twitch-follows: paramètre manquant");
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "token");
  url.searchParams.set("scope", FOLLOWS_SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("force_verify", "true");
  return url.toString();
}

/** Lit l'adresse de retour : { ok, token } ou { ok: false, reason: denied|state|invalid }. */
export function parseAuthRedirect(redirectUrl, expectedState) {
  let url;
  try {
    url = new URL(redirectUrl);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const params = new URLSearchParams(url.hash.replace(/^#/, ""));
  for (const [key, value] of url.searchParams) if (!params.has(key)) params.set(key, value);
  if (!expectedState || params.get("state") !== expectedState) return { ok: false, reason: "state" };
  if (params.get("error")) return { ok: false, reason: "denied" };
  const token = params.get("access_token");
  return token ? { ok: true, token } : { ok: false, reason: "invalid" };
}

/** Lignes de l'aperçu : aucune n'est cochée d'office, c'est l'utilisateur qui choisit. */
export function followsToRows(logins, streamers = [], profiles = new Map()) {
  const existing = new Set((Array.isArray(streamers) ? streamers : []).map(getBulkKey).filter(Boolean));
  const seen = new Set();
  const rows = [];
  for (const raw of Array.isArray(logins) ? logins : []) {
    const handle = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    if (!TWITCH_LOGIN.test(handle) || seen.has(handle)) continue;
    seen.add(handle);
    const status = existing.has(getBulkKey({ platform: "twitch", handle })) ? "existing" : "ready";
    rows.push({ raw: handle, platform: "twitch", handle, status, selected: false, ...profiles.get(handle) });
  }
  return rows;
}

function followsError(code, status) {
  return Object.assign(new Error(`twitch-follows: ${code} (${status})`), { code, status });
}

async function helixJson(url, { token, clientId, fetchImpl }) {
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}`, "Client-Id": clientId },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (response.status === 401 || response.status === 403) throw followsError("unauthorized", response.status);
  if (response.status === 429) throw followsError("rateLimited", response.status);
  if (!response.ok) throw followsError("http", response.status);
  return response.json();
}

/** Tous les pseudos suivis par le compte connecté (pages de 100, parcours borné). */
export async function fetchAllFollows({ token, clientId, fetchImpl = fetch, maxPages = DEFAULT_MAX_PAGES }) {
  const context = { token, clientId, fetchImpl };
  const me = await helixJson(`${HELIX}/users`, context);
  const userId = me?.data?.[0]?.id;
  if (!userId) throw followsError("noUser", 0);
  const logins = [];
  let cursor = "";
  for (let page = 0; page < maxPages; page += 1) {
    const query = new URLSearchParams({ user_id: userId, first: String(PAGE_SIZE) });
    if (cursor) query.set("after", cursor);
    const json = await helixJson(`${HELIX}/channels/followed?${query}`, context);
    for (const entry of Array.isArray(json?.data) ? json.data : []) {
      if (typeof entry?.broadcaster_login === "string") logins.push(entry.broadcaster_login);
    }
    cursor = json?.pagination?.cursor || "";
    if (!cursor) break;
  }
  return logins;
}

function safeAvatar(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === AVATAR_HOST ? parsed.href : "";
  } catch {
    return "";
  }
}

function chunks(items, size) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

async function fetchProfilePage(logins, context) {
  const query = new URLSearchParams(logins.map((login) => ["login", login]));
  try {
    const json = await helixJson(`${HELIX}/users?${query}`, context);
    return Array.isArray(json?.data) ? json.data : [];
  } catch {
    return []; // Sans photo, l'import reste possible : la grille affiche les initiales.
  }
}

/** Nom affiché et photo de chaque pseudo. Un lot en échec donne juste des lignes sans photo. */
export async function fetchFollowProfiles({ logins, token, clientId, fetchImpl = fetch }) {
  const context = { token, clientId, fetchImpl };
  const pages = await Promise.all(chunks(logins, PAGE_SIZE).map((page) => fetchProfilePage(page, context)));
  return new Map(pages.flat()
    .filter((entry) => typeof entry?.login === "string")
    .map((entry) => [entry.login.toLowerCase(), {
      displayName: typeof entry.display_name === "string" ? entry.display_name : entry.login,
      avatar: safeAvatar(entry.profile_image_url),
    }]));
}

/** Annule le jeton côté Twitch. Ne lève jamais : un échec ne doit pas casser l'import. */
export async function revokeToken({ token, clientId, fetchImpl = fetch }) {
  try {
    const response = await fetchImpl(REVOKE_URL, {
      method: "POST",
      body: new URLSearchParams({ client_id: clientId, token }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    return response.ok === true;
  } catch {
    return false;
  }
}

/** Lit les follows et leurs photos puis annule le jeton, que la lecture ait réussi ou non. */
export async function readFollowsThenRevoke({ token, clientId, fetchImpl = fetch, maxPages }) {
  try {
    const logins = await fetchAllFollows({ token, clientId, fetchImpl, maxPages });
    const profiles = await fetchFollowProfiles({ logins, token, clientId, fetchImpl });
    return { logins, profiles };
  } finally {
    await revokeToken({ token, clientId, fetchImpl });
  }
}
