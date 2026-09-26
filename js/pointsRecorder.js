// Relais du suivi des points : reçoit les gains repérés dans la page Twitch par
// inject/points-bridge.js et les transmet au service worker, qui les range.
// Rien n'est relayé si le suivi est désactivé dans les réglages.
(() => {
  "use strict";

  if (window.top !== window) return;

  const SOURCE = "streampulse:points";
  const READY = "streampulse:points:ready";
  const PREFERENCES_KEY = "betaGeneralPreferences";

  let enabled = true;

  const isEnabled = (prefs) => !prefs || prefs.pointsTracking !== false;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const message = event.data;
    if (!message || message.source !== SOURCE || message.v !== 1) return;
    if (!enabled || !message.data || typeof message.data !== "object") return;
    try {
      chrome.runtime.sendMessage({ type: "recordPointsGain", data: message.data }).catch(() => {});
    } catch {
      // Contexte d'extension invalidé par une mise à jour : ce gain est perdu.
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[PREFERENCES_KEY]) enabled = isEnabled(changes[PREFERENCES_KEY].newValue);
  });

  // Le pont garde les gains en attente jusqu'à ce signal : on ne l'envoie
  // qu'une fois la préférence connue, pour ne rien relayer à tort.
  chrome.storage.local.get([PREFERENCES_KEY], (result) => {
    enabled = chrome.runtime.lastError ? true : isEnabled(result?.[PREFERENCES_KEY]);
    window.postMessage({ source: READY }, location.origin);
  });
})();
