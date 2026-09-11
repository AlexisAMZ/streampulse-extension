// js/inject/streamreact-bridge.js
// Passerelle universelle StreamPulse React <-> Extension StreamPulse.
// Fonctionne sans nécessiter de connaître l'ID d'extension (en local comme en production).

(function () {
  "use strict";

  const EXTENSION_VERSION = chrome.runtime?.getManifest?.()?.version || "26.9.10";

  // Marqueur dans le DOM pour détection synchrone ultra-rapide
  try {
    document.documentElement.setAttribute("data-streampulse-extension", EXTENSION_VERSION);
  } catch (_) {}

  // Annonce la présence de l'extension dès l'injection
  function broadcastReady() {
    window.postMessage(
      {
        source: "streampulse-extension",
        type: "STREAMPULSE_READY",
        version: EXTENSION_VERSION,
      },
      "*"
    );
  }

  broadcastReady();

  // Écoute les requêtes de la page StreamPulse React
  window.addEventListener("message", (event) => {
    // Sécurité : n'accepter que les messages venant de la même fenêtre
    if (event.source !== window || !event.data || event.data.source !== "streamreact") {
      return;
    }

    const { reqId, action, shortcode } = event.data;
    if (!reqId || !action) return;

    if (action === "PING") {
      window.postMessage(
        {
          source: "streampulse-extension",
          replyTo: reqId,
          success: true,
          name: "StreamPulse",
          version: EXTENSION_VERSION,
        },
        "*"
      );
      return;
    }

    // Relais vers le service worker background de l'extension
    try {
      chrome.runtime.sendMessage(
        {
          action,
          shortcode,
        },
        (response) => {
          const err = chrome.runtime.lastError;
          if (err) {
            window.postMessage(
              {
                source: "streampulse-extension",
                replyTo: reqId,
                success: false,
                error: err.message || "Erreur de communication avec l'extension.",
              },
              "*"
            );
            return;
          }

          window.postMessage(
            {
              source: "streampulse-extension",
              replyTo: reqId,
              ...(response || { success: false, error: "Pas de réponse de l'extension." }),
            },
            "*"
          );
        }
      );
    } catch (err) {
      window.postMessage(
        {
          source: "streampulse-extension",
          replyTo: reqId,
          success: false,
          error: err?.message || "Erreur interne de transmission.",
        },
        "*"
      );
    }
  });
})();
