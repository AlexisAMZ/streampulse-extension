// Configuration distante (jetons Twitch hébergés sur streampulse.tech, jamais
// dans le zip), requêtes JSON et pause après un 429 Helix.

import { CONFIG as LOCAL_CONFIG } from "../../config.js";
import { isRateLimitError, rateLimitResetAt } from "../twitch-rate-limit.js";
import { NETWORK_TIMEOUT_MS } from "./constants.js";

// ─── Remote config (credentials hosted on Vercel, never in the zip) ──────────
const REMOTE_CONFIG_URL = "https://streampulse.tech/api/streampulse-config";
export const REMOTE_CONFIG_CACHE_KEY = "streampulse:remoteConfig";
const REMOTE_CONFIG_TTL_MS = 30 * 60 * 1000; // 30 min — plafond avant re-check ;
// un token mort est de toute façon detecte au premier 401/403 (fetchTwitchJson
// recharge alors la config immédiatement), ce TTL ne borne que le pire cas.

export let CONFIG = { ...LOCAL_CONFIG };
let _configReady = null;

export async function fetchRemoteConfig() {
  try {
    const stored = await chrome.storage.local.get(REMOTE_CONFIG_CACHE_KEY);
    const cached = stored[REMOTE_CONFIG_CACHE_KEY];
    // Always hydrate from cache FIRST, even if stale, so credentials are
    // available immediately after an MV3 service-worker restart (which wipes
    // the in-memory CONFIG back to the token-less LOCAL_CONFIG). Without this,
    // an alarm-triggered poll fires before any network fetch and Twitch
    // rejects the token-less request with 401.
    if (cached?.data?.clientId) {
      CONFIG = { ...LOCAL_CONFIG, ...cached.data };
    }
    // Cache fresh → nothing more to do.
    if (cached && Date.now() - cached.fetchedAt < REMOTE_CONFIG_TTL_MS) return;
    // Cache missing or stale → refresh from the network. Le paramètre
    // aléatoire contourne le cache Edge (Vercel a deja servi des reponses
    // perimees contenant un token mort apres une rotation de credentials).
    const url = `${REMOTE_CONFIG_URL}?t=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS) });
    if (!res.ok) return;
    const data = await res.json();
    if (data?.clientId) {
      CONFIG = { ...LOCAL_CONFIG, ...data };
      await chrome.storage.local.set({
        [REMOTE_CONFIG_CACHE_KEY]: { data, fetchedAt: Date.now() },
      });
    }
  } catch (error) {
    // Erreur réseau : on garde ce qui vient du cache (ou le repli local).
    console.warn("[SP] config distante indisponible :", error?.message || error);
  }
}

// Gate every Twitch API call behind this. Returns instantly once credentials
// are loaded for this service-worker lifetime; otherwise re-hydrates from the
// storage cache (and refreshes from network). Deduped so a burst of callers
// triggers a single load.
export function ensureConfig() {
  if (CONFIG.accessToken) return Promise.resolve();
  if (!_configReady) {
    _configReady = fetchRemoteConfig().finally(() => {
      _configReady = null;
    });
  }
  return _configReady;
}

/**
 * Rotation de token : quand Twitch rejette le jeton en cache (401/403), on
 * re-fetch la config serveur en ignorant le cache de 6 h. Une rotation côté
 * streampulse.tech devient donc effective en quelques secondes chez tous les
 * utilisateurs, au lieu d'attendre l'expiration du TTL.
 */
async function refreshRemoteConfigForce() {
  try {
    const res = await fetch(`${REMOTE_CONFIG_URL}?t=${Date.now()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data?.clientId) return false;
    CONFIG = { ...LOCAL_CONFIG, ...data };
    await chrome.storage.local.set({
      [REMOTE_CONFIG_CACHE_KEY]: { data, fetchedAt: Date.now() },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * fetchJson pour l'API Twitch : rejoue la requête une fois si Twitch répond
 * 401/403 après avoir rechargé la config distante (token expiré ou révoqué
 * pendant que le cache local le croyait encore bon).
 */
export async function fetchTwitchJson(url, options = {}, timeoutMs = 15000) {
  await ensureConfig();
  try {
    return await fetchJson(url, options, timeoutMs);
  } catch (error) {
    if (isRateLimitError(error)) {
      // 429 : on note la pause (persistee) et on laisse l'erreur remonter ;
      // le sondage courant garde l'etat precedent pour chaque streamer.
      await recordTwitchRateLimit(error);
      throw error;
    }
    if (!/^(401|403) /.test(String(error?.message || ""))) throw error;
    const refreshed = await refreshRemoteConfigForce();
    if (!refreshed) throw error;
    return fetchJson(url, options, timeoutMs);
  }
}

// ─── Pause persistée après un 429 Helix ──────────────────────────────────────

const TWITCH_RATE_LIMIT_KEY = "streampulse:twitchRateLimitedUntil";

/** Persiste la pause imposée par un 429 (survit aux redémarrages du SW). */
async function recordTwitchRateLimit(error) {
  const until = rateLimitResetAt(error?.headers, Date.now());
  if (!until) return;
  console.warn(
    "[SP] quota Twitch atteint : sondage Twitch en pause jusqu'à",
    new Date(until).toISOString()
  );
  try {
    await chrome.storage.local.set({ [TWITCH_RATE_LIMIT_KEY]: until });
  } catch (storageError) {
    console.warn("[SP] pause Twitch non persistée", storageError);
  }
}

/** Renvoie l'instant (ms) jusqu'auquel le sondage Twitch est en pause, ou 0. */
export async function twitchRateLimitUntil() {
  try {
    const stored = await chrome.storage.local.get(TWITCH_RATE_LIMIT_KEY);
    const until = Number(stored[TWITCH_RATE_LIMIT_KEY]) || 0;
    return Date.now() < until ? until : 0;
  } catch (error) {
    console.warn("[SP] lecture de la pause Twitch impossible", error);
    return 0;
  }
}

/** Un cycle de sondage complet sans 429 : la pause eventuelle expire. */
export async function clearTwitchRateLimit() {
  try {
    await chrome.storage.local.remove(TWITCH_RATE_LIMIT_KEY);
  } catch (error) {
    console.warn("[SP] effacement de la pause Twitch impossible", error);
  }
}

export async function fetchJson(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    if (!response.ok) {
      // statusCode + headers portés par l'erreur : fetchTwitchJson s'en sert
      // pour reconnaitre un 429 et lire Ratelimit-Reset / Retry-After sans
      // avoir à refaire la requête.
      const error = new Error(`${response.status} ${response.statusText}`);
      error.statusCode = response.status;
      error.headers = response.headers;
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export function twitchHeaders() {
  const headers = {
    "Client-ID": CONFIG.clientId,
    Accept: "application/json",
  };
  if (CONFIG.accessToken) {
    headers.Authorization = `Bearer ${CONFIG.accessToken}`;
  }
  return headers;
}

// ─── Suivi des points de chaîne ───────────────────────────────────────────────
// Les gains arrivent de pointsRecorder.js ; points-store.js est le seul à les
// écrire. Les noms des chaînes viennent de Helix, par lots de 100 identifiants.

export async function resolveTwitchChannels(ids) {
  await ensureConfig();
  const query = ids.map((id) => `id=${encodeURIComponent(id)}`).join("&");
  const data = await fetchTwitchJson(`https://api.twitch.tv/helix/users?${query}`, { headers: twitchHeaders() });
  return (data?.data || []).map((user) => ({
    id: String(user.id),
    login: user.login,
    displayName: user.display_name || user.login,
    avatar: user.profile_image_url || "",
  }));
}

/**
 * Période du sondage en minutes, lue à chaque appel : la config distante
 * (pollIntervalMinutes) arrive après le démarrage du SW et doit être prise en compte.
 */
export function pollIntervalMinutes() {
  const minutes = Number(CONFIG.pollIntervalMinutes);
  return minutes > 0 ? minutes : 1;
}
