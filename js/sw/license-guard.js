// Garde de la licence StreamPulse+ : toute écriture de chrome.storage (devtools,
// autre extension, script) est vérifiée ici. Un enregistrement dont la
// signature est fausse est supprimé ; un enregistrement d'avant la signature
// repasse par le serveur, qui le signe ou le refuse.

import { signatureState } from "../license-sign.js";
import { PLUS_KEY, getDeviceId, verifyLicense } from "../plus.js";

/**
 * Fin de la transition : les installations mises à jour avant cette date
 * gardent leur licence non signée (le temps de joindre le serveur) ; après, une
 * licence sans signature n'ouvre plus rien.
 */
export const PLUS_UNSIGNED_UNTIL = Date.parse("2026-12-15T00:00:00Z");

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
  // Serveur injoignable ou qui ne signe pas encore : on ne réécrit rien (pas de
  // boucle avec storage.onChanged), la clé reste pendant la transition.
  if (now < PLUS_UNSIGNED_UNTIL || record.status !== "active") return "kept";
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
