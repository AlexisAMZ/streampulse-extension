// Essai StreamPulse+ lié à un compte Twitch. À chaque passage de l'alarme des
// Drops, le service worker lit le compte connecté et note s'il est celui de
// l'essai (clé TRIAL_ACCOUNT_KEY, lue aussi par les content scripts). Un essai
// démarré sans compte Twitch se lie au premier compte connecté.

import { PLUS_KEY, TRIAL_ACCOUNT_KEY, getDeviceId, startTrial, trialAccountAllows } from "../plus.js";

/**
 * @param {{ storage: object, fetch: Function, viewerId: () => Promise<string>, now?: number }} deps
 * @returns {Promise<"none"|"allowed"|"other"|"bound">}
 */
export async function refreshTrialAccount(deps) {
  const now = deps.now ?? Date.now();
  const stored = await deps.storage.get([PLUS_KEY, TRIAL_ACCOUNT_KEY]);
  const record = stored[PLUS_KEY];
  if (record?.plan !== "trial") {
    if (stored[TRIAL_ACCOUNT_KEY]) await deps.storage.remove(TRIAL_ACCOUNT_KEY);
    return "none";
  }
  const twitch = await deps.viewerId();
  if (!record.twitch && twitch) {
    // Liaison : le serveur inscrit le compte dans une nouvelle licence signée.
    const result = await startTrial(deps.fetch, await getDeviceId(deps.storage), now, twitch);
    if (result.ok) {
      await deps.storage.set({
        [PLUS_KEY]: { ...result.record, checkedAt: now },
        [TRIAL_ACCOUNT_KEY]: { allowed: trialAccountAllows(result.record, twitch), at: now },
      });
      return "bound";
    }
  }
  const allowed = trialAccountAllows(record, twitch);
  if (stored[TRIAL_ACCOUNT_KEY]?.allowed !== allowed) await deps.storage.set({ [TRIAL_ACCOUNT_KEY]: { allowed, at: now } });
  return allowed ? "allowed" : "other";
}
