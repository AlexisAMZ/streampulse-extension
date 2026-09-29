/*
 * Règle unique « StreamPulse+ actif », partagée par :
 *  - les content scripts classiques (chargé avant eux par le manifest),
 *  - js/plus.js (module ES : `import "./inject/plus-rule.js"`), donc la popup,
 *    les pages et le service worker.
 * Ce fichier ne doit contenir ni import ni export : il se charge à la fois
 * comme script classique et comme module.
 */
(function (root) {
  "use strict";
  if (root.StreamPulsePlusRule) return;

  var PLUS_KEY = "streamPulsePlus";
  // Délai de grâce hors ligne : une licence mensuelle reste active 30 jours
  // après sa dernière vérification réussie ; la licence à vie n'expire pas.
  var PLUS_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

  function isPlusActive(record, now) {
    if (!record || record.status !== "active" || !record.licenseKey) return false;
    if (record.plan === "lifetime") return true;
    var at = typeof now === "number" ? now : Date.now();
    return at - (Number(record.verifiedAt) || 0) <= PLUS_GRACE_MS;
  }

  root.StreamPulsePlusRule = Object.freeze({
    PLUS_KEY: PLUS_KEY,
    PLUS_GRACE_MS: PLUS_GRACE_MS,
    isPlusActive: isPlusActive,
  });
})(globalThis);
