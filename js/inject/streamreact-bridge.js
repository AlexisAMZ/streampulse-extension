// js/inject/streamreact-bridge.js
// Passerelle universelle StreamPulse React <-> Extension StreamPulse.
// Fonctionne sans nécessiter de connaître l'ID d'extension (en local comme en production).

(function () {
  "use strict";

  const EXTENSION_VERSION = chrome.runtime?.getManifest?.()?.version || "26.9.10";

  // Origine unique de dialogue : la page et le pont ne s'adressent qu'à
  // eux-mêmes, jamais aux iframes tierces éventuellement présentes.
  const ORIGIN = window.location.origin;

  // Les match patterns du manifest n'acceptent pas de port : `http://localhost/*`
  // couvre donc tout serveur local, quel que soit le projet. On restreint ici au
  // port de développement de StreamPulse React, comme le fait déjà
  // onMessageExternal côté service worker.
  const DEV_ORIGIN = "http://localhost:3000";
  const isLocal = window.location.hostname === "localhost";
  if (isLocal && ORIGIN !== DEV_ORIGIN) {
    return;
  }

  // Liste blanche stricte : le pont ne relaie que ces actions vers le service
  // worker. Sans elle, tout script tiers de la page pourrait déclencher une
  // demande de permission ou l'exfiltration des commentaires.
  const ALLOWED_ACTIONS = new Set([
    "PING",
    "GET_INSTAGRAM_SESSION",
    "GET_INSTAGRAM_COMMENTS",
    "CHECK_INSTAGRAM_PERMISSION",
    "REQUEST_INSTAGRAM_PERMISSION",
  ]);

  // Marqueur dans le DOM pour détection synchrone ultra-rapide
  try {
    document.documentElement.setAttribute("data-streampulse-extension", EXTENSION_VERSION);
  } catch (_) {}

  function reply(reqId, payload) {
    window.postMessage(
      {
        source: "streampulse-extension",
        replyTo: reqId,
        ...payload,
      },
      ORIGIN
    );
  }

  // Annonce la présence de l'extension dès l'injection
  window.postMessage(
    {
      source: "streampulse-extension",
      type: "STREAMPULSE_READY",
      version: EXTENSION_VERSION,
    },
    ORIGIN
  );

  // Écoute les requêtes de la page StreamPulse React
  window.addEventListener("message", (event) => {
    // Sécurité : n'accepter que les messages venant de cette fenêtre et de
    // cette origine (exclut les iframes et les frames tierces).
    if (
      event.source !== window ||
      event.origin !== ORIGIN ||
      !event.data ||
      event.data.source !== "streamreact"
    ) {
      return;
    }

    const { reqId, action, shortcode } = event.data;
    if (!reqId || typeof action !== "string") return;

    if (!ALLOWED_ACTIONS.has(action)) {
      reply(reqId, { success: false, error: "Action non autorisée." });
      return;
    }

    if (action === "PING") {
      reply(reqId, {
        success: true,
        name: "StreamPulse",
        version: EXTENSION_VERSION,
      });
      return;
    }

    // Relais vers le service worker background de l'extension. On ne transmet
    // que les champs attendus, jamais l'objet reçu tel quel.
    try {
      chrome.runtime.sendMessage(
        {
          action,
          shortcode: typeof shortcode === "string" ? shortcode : undefined,
        },
        (response) => {
          const err = chrome.runtime.lastError;
          if (err) {
            reply(reqId, {
              success: false,
              error: err.message || "Erreur de communication avec l'extension.",
            });
            return;
          }

          reply(
            reqId,
            response || { success: false, error: "Pas de réponse de l'extension." }
          );
        }
      );
    } catch (err) {
      reply(reqId, {
        success: false,
        error: err?.message || "Erreur interne de transmission.",
      });
    }
  });
})();
