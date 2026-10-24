// Activation StreamPulse+ depuis la page /plus/merci du site, sans copier-coller.
// La page appelle chrome.runtime.sendMessage(idExtension, { type: "activatePlus", key })
// (externally_connectable du manifeste, aucune permission d'hôte en plus).
// La clé reçue n'est jamais crue : elle repasse par le serveur de licences.

import { PLUS_KEY, getDeviceId, verifyLicense } from "../plus.js";

/** Seules origines autorisées à demander une activation. */
export const PLUS_SITE_ORIGINS = Object.freeze(["https://streampulse.tech", "https://www.streampulse.tech"]);

export function isTrustedPlusSender(sender) {
  const origin = sender?.origin || (() => {
    try {
      return new URL(sender?.url || "").origin;
    } catch {
      return "";
    }
  })();
  return PLUS_SITE_ORIGINS.includes(origin);
}

/**
 * Vérifie puis enregistre la clé. Module testable : stockage, fetch et
 * ouverture de l'onboarding sont injectés.
 * @returns {Promise<{ok: boolean, error?: string, plan?: string}>}
 */
export async function activatePlusFromSite(message, sender, deps) {
  if (!isTrustedPlusSender(sender)) return { ok: false, error: "origin" };
  if (message?.type === "ping") return { ok: true };
  if (message?.type !== "activatePlus") return { ok: false, error: "type" };
  const device = await getDeviceId(deps.storage);
  const result = await verifyLicense(message.key, deps.fetch, deps.now ?? Date.now(), device);
  if (!result.ok) return { ok: false, error: result.error };
  await deps.storage.set({ [PLUS_KEY]: result.record });
  await deps.onActivated?.(result.record);
  return { ok: true, plan: result.record.plan };
}

/** Listener chrome.runtime.onMessageExternal. */
export function createPlusExternalListener(deps) {
  return (message, sender, sendResponse) => {
    activatePlusFromSite(message, sender, deps)
      .then(sendResponse)
      .catch((error) => {
        console.warn("[StreamPulse+] activation depuis le site :", error?.message || error);
        sendResponse({ ok: false, error: "network" });
      });
    return true;
  };
}
