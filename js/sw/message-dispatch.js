// Aiguillage des messages runtime : contrôle de l'expéditeur puis une table
// { type: handler } à la place de l'ancien switch géant. Pur (les identités
// chrome sont injectées), testé par tests/message-dispatch.test.mjs.

// Actions qui écrivent des données ou pilotent l'extension : réservées aux
// pages de l'extension (popup, onboarding, réglages…). Les pages web ne les
// voient jamais, même via un content script.
export const SENSITIVE_MESSAGE_TYPES = new Set([
  "removeStreamer",
  "resetPoints",
  "resetStat",
  "clearEventLogs",
  "updateUserProfile",
  "badgeAutoStart",
  "updatePreferences",
  "resetPreferences",
  "reorderStreamers",
  "setPinnedStreamers",
]);

export function isExtensionPage(sender, extensionPrefix) {
  return Boolean(extensionPrefix && sender?.url && sender.url.startsWith(extensionPrefix));
}

/**
 * Refus éventuel d'un message : "unknown-sender" si l'expéditeur n'est pas
 * notre extension, "not-extension-page" pour une action sensible venue d'un
 * content script, null sinon.
 */
export function rejectReason(request, sender, { runtimeId, extensionPrefix }) {
  if (sender?.id !== runtimeId) return "unknown-sender";
  if (SENSITIVE_MESSAGE_TYPES.has(request?.type) && !isExtensionPage(sender, extensionPrefix)) {
    return "not-extension-page";
  }
  return null;
}

/**
 * Enveloppe commune des handlers : une réponse part toujours (succès ou
 * erreur explicite), et un rejet de promesse ne laisse jamais la popup
 * sans réponse ni le SW avec un « Uncaught (in promise) ».
 */
export function respond(promiseFactory, sendResponse, label = "") {
  Promise.resolve()
    .then(promiseFactory)
    .then((data) => sendResponse({ success: true, ...(data || {}) }))
    .catch((error) => {
      console.warn("[SP] message", label, ":", error?.message || error);
      sendResponse({ error: error?.message || String(error) });
    });
}

/**
 * Variante « réponse brute » : le handler renvoie lui-même l'objet de réponse
 * complet ; une exception devient { error }.
 */
export function reply(promiseFactory, sendResponse, label = "") {
  Promise.resolve()
    .then(promiseFactory)
    .then((payload) => sendResponse(payload))
    .catch((error) => {
      console.warn("[SP] message", label, ":", error?.message || error);
      sendResponse({ error: error?.message || String(error) });
    });
}

/**
 * Fabrique le listener onMessage. Chaque handler reçoit (request, sender,
 * sendResponse) et renvoie true s'il répond de façon asynchrone.
 * `getIdentity()` est appelé à chaque message (chrome.runtime.id peut ne pas
 * être prêt à l'import dans les tests).
 */
export function createMessageDispatcher(handlers, getIdentity) {
  return function dispatch(request, sender, sendResponse) {
    const reason = rejectReason(request, sender, getIdentity());
    if (reason) {
      console.warn("[SP] message refusé :", reason, request?.type, reason === "unknown-sender" ? sender?.id : sender?.url);
      sendResponse({ error: "forbidden" });
      return false;
    }
    const handler = Object.prototype.hasOwnProperty.call(handlers, request?.type) ? handlers[request.type] : null;
    if (!handler) return false;
    try {
      return handler(request, sender, sendResponse) === true;
    } catch (error) {
      // Filet uniforme : aucune exception synchrone ne doit laisser la popup sans réponse.
      console.warn("[SP] onMessage:", request?.type, error?.message || error);
      try {
        sendResponse({ error: error?.message || String(error) });
      } catch (sendError) {
        // Canal déjà fermé : la popup a été fermée entre-temps (attendu).
        console.warn("[SP] onMessage : réponse impossible", sendError?.message || sendError);
      }
      return false;
    }
  };
}
