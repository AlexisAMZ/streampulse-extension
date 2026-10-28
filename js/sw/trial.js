// Essai StreamPulse+ de 7 jours : jamais automatique. Il démarre seulement quand
// l'utilisateur clique sur « Débloquer les 7 jours », car il envoie son compte
// Twitch au serveur (l'essai y est lié). Le serveur tranche : un essai par
// compte Twitch et par appareil. Une panne réseau laisse la
// demande en attente ; elle repart au prochain réveil du service worker. Le
// garde de la licence (license-guard.js) vérifie ensuite la signature.

import { PLUS_KEY, getDeviceId, startTrial } from "../plus.js";

/** État de l'essai : { pending, used, at }. `used` : essai déjà pris ou refusé par le serveur. */
export const TRIAL_STATE_KEY = "streamPulseTrial";

/** État lu du stockage, valeurs sûres par défaut. */
export function trialStateFrom(stored) {
  const value = stored && typeof stored === "object" ? stored : {};
  return { pending: value.pending === true, used: value.used === true, at: Math.max(0, Number(value.at) || 0) };
}

/**
 * @param {{ storage: object, fetch: Function, viewerId?: () => Promise<string>, now?: number }} deps
 *   `viewerId` : compte Twitch connecté, inscrit dans l'essai (absent : lié plus tard).
 * @returns {Promise<"none"|"licensed"|"started"|"refused"|"retry">}
 */
export async function requestPendingTrial(deps) {
  const now = deps.now ?? Date.now();
  const stored = await deps.storage.get([TRIAL_STATE_KEY, PLUS_KEY]);
  const state = trialStateFrom(stored[TRIAL_STATE_KEY]);
  if (!state.pending) return "none";
  // Une licence (achetée ou déjà d'essai) est là : rien à demander.
  if (stored[PLUS_KEY]) {
    await deps.storage.set({ [TRIAL_STATE_KEY]: { ...state, pending: false, at: now } });
    return "licensed";
  }
  const device = await getDeviceId(deps.storage);
  const twitch = deps.viewerId ? await deps.viewerId().catch(() => "") : "";
  const result = await startTrial(deps.fetch, device, now, twitch);
  if (!result.ok && result.error === "network") return "retry";
  await deps.storage.set({
    [TRIAL_STATE_KEY]: { pending: false, used: true, at: now },
    ...(result.ok ? { [PLUS_KEY]: { ...result.record, checkedAt: now } } : {}),
  });
  return result.ok ? "started" : "refused";
}

/** Demande l'essai maintenant (bouton), quel que soit l'état noté : le serveur décide. */
export async function requestTrial(deps) {
  const stored = await deps.storage.get(TRIAL_STATE_KEY);
  await deps.storage.set({ [TRIAL_STATE_KEY]: { ...trialStateFrom(stored[TRIAL_STATE_KEY]), pending: true } });
  return requestPendingTrial(deps);
}
