// Essai StreamPulse+ de 7 jours : demandé une fois par appareil, à la première
// installation, à la première mise à jour qui l'apporte (utilisateurs déjà
// installés), ou par le bouton « Essayer 7 jours gratuitement ». Le serveur
// tranche : il ne donne qu'un essai par appareil. Une panne réseau laisse la
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
 * @param {{ storage: object, fetch: Function, now?: number }} deps
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
  const result = await startTrial(deps.fetch, device, now);
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

/**
 * Installation ou mise à jour : l'essai est demandé une seule fois par
 * navigateur. Un état déjà noté (essai pris, refusé ou en attente) n'est
 * jamais redemandé ici, seulement repris s'il attendait le réseau.
 */
export async function beginTrialOnce(deps) {
  const stored = await deps.storage.get(TRIAL_STATE_KEY);
  if (stored[TRIAL_STATE_KEY] !== undefined) return requestPendingTrial(deps);
  await deps.storage.set({ [TRIAL_STATE_KEY]: { pending: true, used: false, at: deps.now ?? Date.now() } });
  return requestPendingTrial(deps);
}
