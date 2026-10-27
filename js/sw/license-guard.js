// Garde de la licence StreamPulse+ : toute écriture de chrome.storage (devtools,
// autre extension, script) est vérifiée ici. Un enregistrement dont la
// signature est fausse est supprimé ; un enregistrement sans signature
// repasse par le serveur, qui le signe ou le refuse. Tant qu'il n'est pas
// signé, il garde sa clé mais n'ouvre rien (statut « unverified »).

import { signatureState } from "../license-sign.js";
import { PLUS_KEY, getDeviceId, verifyLicense } from "../plus.js";

const REFUSED = ["invalid", "format", "device_limit"];

/**
 * @param {{storage: object, fetch: Function, now?: number, crypto?: object}} deps
 * @returns {Promise<"ok"|"removed"|"upgraded"|"kept"|"unverified">}
 */
export async function guardPlusRecord(deps) {
  const now = deps.now ?? Date.now();
  const record = (await deps.storage.get(PLUS_KEY))[PLUS_KEY];
  if (!record) return "ok";

  const device = await getDeviceId(deps.storage);
  const state = await signatureState(record, device, deps.crypto);
  if (state === "valid") return "ok";
  if (state === "invalid" || !record.licenseKey) {
    await deps.storage.remove(PLUS_KEY);
    return "removed";
  }

  const result = await verifyLicense(record.licenseKey, deps.fetch, now, device);
  if (result.ok && result.record.sig) {
    await deps.storage.set({ [PLUS_KEY]: { ...result.record, checkedAt: now } });
    return "upgraded";
  }
  if (!result.ok && REFUSED.includes(result.error)) {
    await deps.storage.remove(PLUS_KEY);
    return "removed";
  }
  // Serveur injoignable, saturé (429) ou qui ne signe pas encore : jamais de
  // licence active sans signature, sinon couper le réseau suffirait à garder
  // une clé inventée. La clé reste ; la revérification la signera.
  if (result.ok || record.status !== "active") return "kept";
  await deps.storage.set({ [PLUS_KEY]: { ...record, status: "unverified" } });
  return "unverified";
}

let running = Promise.resolve();

/** Sérialise les contrôles : une écriture du garde ne doit pas en lancer un second en parallèle. */
export function runPlusGuard(deps) {
  running = running.then(() => guardPlusRecord(deps)).catch((error) => {
    console.warn("[StreamPulse+] contrôle de la licence :", error?.message || error);
    return "kept";
  });
  return running;
}

/** Listener chrome.storage.onChanged (posé au top-level par background.js). */
export function onPlusRecordChanged(changes, area, deps) {
  if (area === "local" && changes[PLUS_KEY]?.newValue) runPlusGuard(deps);
}
