/*
 * Règles StreamPulse+ partagées (licence active, paliers d'ancienneté), par :
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

  var MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;

  // Tuiles d'ancienneté (fond du logo, façon 7TV), du plus ancien palier au
  // plus récent : mois d'abonnement requis → clé de la tuile. L'API du site
  // (api/streampulse-badges.mjs) en garde une copie.
  var TENURE_TIERS = Object.freeze([
    [48, "y4"], [36, "y3"], [24, "y2"], [18, "y1h"], [12, "y1"], [9, "m9"], [6, "m6"], [3, "m3"], [0, "m1"],
  ].map(Object.freeze));

  /** Styles du badge d'ancienneté : effet choisi → classe CSS (sp-tier--<style>). */
  var TENURE_STYLES = Object.freeze({ tenure: "gauge", pager: "pager" });

  /**
   * Tuile d'un abonné : « founder » pour le fondateur, « life » pour la licence
   * à vie, sinon selon les mois écoulés depuis `since`.
   */
  function tenureTier(plan, since, now, rank) {
    if (rank === "founder" && plan) return "founder";
    if (plan === "lifetime") return "life";
    if (plan !== "monthly") return "";
    var at = typeof now === "number" ? now : Date.now();
    var months = Number(since) > 0 ? Math.max(0, Math.floor((at - Number(since)) / MONTH_MS)) : 0;
    for (var i = 0; i < TENURE_TIERS.length; i++) if (months >= TENURE_TIERS[i][0]) return TENURE_TIERS[i][1];
    return "m1";
  }

  root.StreamPulsePlusRule = Object.freeze({
    PLUS_KEY: PLUS_KEY,
    PLUS_GRACE_MS: PLUS_GRACE_MS,
    MONTH_MS: MONTH_MS,
    TENURE_TIERS: TENURE_TIERS,
    TENURE_STYLES: TENURE_STYLES,
    isPlusActive: isPlusActive,
    tenureTier: tenureTier,
  });
})(globalThis);
