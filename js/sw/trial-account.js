// Essai StreamPulse+ lié à un compte Twitch. À chaque passage de l'alarme des
// Drops, le service worker lit le compte connecté. Un autre compte que celui
// de l'essai : `otherAccount` est posé sur la licence, et tout StreamPulse+
// se met en pause (js/inject/plus-rule.js). Ce champ n'entre pas dans la
// signature : le retirer à la main revient à modifier l'extension elle-même.
// Un essai démarré sans compte Twitch se lie au premier compte connecté.

import { PLUS_KEY, getDeviceId, startTrial, trialOnOtherAccount } from "../plus.js";

/**
 * @param {{ storage: object, fetch: Function, viewerId: () => Promise<string>, now?: number }} deps
 * @returns {Promise<"none"|"same"|"other"|"bound">}
 */
export async function refreshTrialAccount(deps) {
  const now = deps.now ?? Date.now();
  const record = (await deps.storage.get(PLUS_KEY))[PLUS_KEY];
  if (record?.plan !== "trial") return "none";
  const twitch = await deps.viewerId();
  if (!record.twitch && twitch) {
    // Liaison : le serveur inscrit le compte dans une nouvelle licence signée.
    const result = await startTrial(deps.fetch, await getDeviceId(deps.storage), now, twitch);
    if (result.ok) {
      const bound = { ...result.record, checkedAt: now };
      await deps.storage.set({ [PLUS_KEY]: { ...bound, otherAccount: trialOnOtherAccount(bound, twitch) } });
      return "bound";
    }
  }
  const other = trialOnOtherAccount(record, twitch);
  if ((record.otherAccount === true) !== other) await deps.storage.set({ [PLUS_KEY]: { ...record, otherAccount: other } });
  return other ? "other" : "same";
}
