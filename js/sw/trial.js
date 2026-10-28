// Essai StreamPulse+ de 7 jours : demandé une fois, à la première installation.
// Une panne réseau laisse la demande en attente ; elle repart au prochain
// réveil du service worker. Le garde de la licence (license-guard.js) vérifie
// ensuite la signature comme pour une licence achetée.

import { PLUS_KEY, getDeviceId, startTrial } from "../plus.js";

/** État de l'essai : { pending: booléen, at: dernière tentative ou fin (ms) }. */
export const TRIAL_STATE_KEY = "streamPulseTrial";

/**
 * @param {{ storage: object, fetch: Function, now?: number }} deps
 * @returns {Promise<"none"|"licensed"|"started"|"refused"|"retry">}
 */
export async function requestPendingTrial(deps) {
  const now = deps.now ?? Date.now();
  const stored = await deps.storage.get([TRIAL_STATE_KEY, PLUS_KEY]);
  if (stored[TRIAL_STATE_KEY]?.pending !== true) return "none";
  // Une licence (achetée ou déjà d'essai) est là : rien à demander.
  if (stored[PLUS_KEY]) {
    await deps.storage.set({ [TRIAL_STATE_KEY]: { pending: false, at: now } });
    return "licensed";
  }
  const device = await getDeviceId(deps.storage);
  const result = await startTrial(deps.fetch, device, now);
  if (!result.ok && result.error === "network") return "retry";
  await deps.storage.set({
    [TRIAL_STATE_KEY]: { pending: false, at: now },
    ...(result.ok ? { [PLUS_KEY]: { ...result.record, checkedAt: now } } : {}),
  });
  return result.ok ? "started" : "refused";
}

/** Première installation : l'essai est noté en attente puis demandé. */
export async function beginTrialOnInstall(deps) {
  await deps.storage.set({ [TRIAL_STATE_KEY]: { pending: true, at: deps.now ?? Date.now() } });
  return requestPendingTrial(deps);
}
