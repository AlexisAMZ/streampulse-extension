// Jeton d'application Kick (proxy streampulse.tech) et API officielle Kick.

import { NETWORK_TIMEOUT_MS } from "./constants.js";

// ─── Kick Official API: App Access Token ─────────────────────────────────────

const _kickToken = { value: null, expiresAt: 0 };

// Vol unique : sans lui, deux sondages concurrents demandent chacun un jeton
// au proxy et le second ecrase le premier, pour rien.
let _kickTokenInFlight = null;

const KICK_TOKEN_STORAGE_KEY = "streampulse:kickToken";
const KICK_TOKEN_MARGIN_MS = 120_000;


export function getKickAppToken() {
  _kickTokenInFlight ||= fetchKickAppToken().finally(() => {
    _kickTokenInFlight = null;
  });
  return _kickTokenInFlight;
}

function isKickTokenFresh(token) {
  return Boolean(token?.value) && Date.now() < Number(token.expiresAt || 0) - KICK_TOKEN_MARGIN_MS;
}

async function readCachedKickToken() {
  if (isKickTokenFresh(_kickToken)) return _kickToken.value;
  const stored = await chrome.storage.local.get(KICK_TOKEN_STORAGE_KEY);
  const cached = stored[KICK_TOKEN_STORAGE_KEY];
  if (!isKickTokenFresh(cached)) return null;
  /* eslint-disable require-atomic-updates -- getKickAppToken() serialise les appels. */
  _kickToken.value = cached.value;
  _kickToken.expiresAt = cached.expiresAt;
  /* eslint-enable require-atomic-updates */
  return cached.value;
}

// Jeton d'application Kick : memoire, puis stockage, puis le proxy
// streampulse.tech (le secret client ne quitte jamais le serveur).
async function fetchKickAppToken() {
  const cached = await readCachedKickToken();
  if (cached) return cached;
  try {
    const resp = await fetch(`https://streampulse.tech/api/kick-token?t=${Date.now()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    const expiresAt = json.expires_at ?? Date.now() + (json.expires_in ?? 3600) * 1000;
    const token = { value: json.access_token, expiresAt };
    if (!isKickTokenFresh(token)) return null;
    _kickToken.value = token.value;
    _kickToken.expiresAt = expiresAt;
    await chrome.storage.local.set({ [KICK_TOKEN_STORAGE_KEY]: token });
    return token.value;
  } catch (error) {
    console.warn("[kick] jeton indisponible", error);
    return null;
  }
}

/** Canaux officiels par slugs groupés (jusqu'à 50 par appel). */
export async function fetchKickChannelsOfficial(slugs, token) {
  const params = new URLSearchParams();
  for (const slug of slugs) params.append("slug", slug);
  const resp = await fetch(
    `https://api.kick.com/public/v1/channels?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
    }
  );
  if (!resp.ok) throw new Error(`${resp.status}`);
  const json = await resp.json();
  return Array.isArray(json?.data) ? json.data : [];
}

/** Lives actifs par broadcaster user IDs groupés (jusqu'à 100 par appel). */
export async function fetchKickLivestreamsOfficial(userIds, token) {
  const params = new URLSearchParams();
  for (const id of userIds) params.append("user_id", id);
  const resp = await fetch(
    `https://api.kick.com/public/v1/users/livestreams?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
    }
  );
  if (!resp.ok) throw new Error(`${resp.status}`);
  const json = await resp.json();
  return Array.isArray(json?.data) ? json.data : [];
}

export async function fetchKickOfficial(slug, token) {
  const resp = await fetch(
    `https://api.kick.com/public/v1/channels?slug=${encodeURIComponent(slug)}`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
    }
  );
  if (!resp.ok) throw new Error(`${resp.status}`);
  const json = await resp.json();
  return json?.data?.[0] ?? null;
}
