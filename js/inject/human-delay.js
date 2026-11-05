/*
 * Délais « naturels » des récupérations automatiques (Drops). Un clic à la seconde près après l'apparition du
 * bouton ne ressemble à aucun viewer : on attend un temps variable, comme
 * quelqu'un qui remarque le Drop puis clique. Aucun gain n'est perdu : un Drop
 * reste récupérable bien plus longtemps que ces quelques secondes.
 *
 * Chargé avant les content scripts par le manifest, et importé comme module
 * (`import "./inject/human-delay.js"`) par le service worker. Ni import ni
 * export : le fichier se charge à la fois comme script classique et module.
 */
(function (root) {
  "use strict";
  if (root.StreamPulseHumanDelay) return;

  /** Fourchettes en ms. Toutes sous 25 s : un service worker MV3 s'endort à 30 s d'inactivité. */
  var DELAYS = Object.freeze({
    dropClick: Object.freeze({ min: 4000, max: 20000 }),
    dropWorker: Object.freeze({ min: 3000, max: 15000 }),
  });

  /** Entier tiré dans [min, max), bornes ramenées à des entiers positifs. */
  function between(min, max, random) {
    var rand = typeof random === "function" ? random : Math.random;
    var a = Math.max(0, Math.floor(Number(min) || 0));
    var b = Math.max(0, Math.floor(Number(max) || 0));
    var low = Math.min(a, b);
    var high = Math.max(a, b);
    if (high === low) return low;
    return low + Math.floor(rand() * (high - low));
  }

  /** Délai tiré dans une fourchette nommée de DELAYS. */
  function pick(name) {
    var range = DELAYS[name];
    return range ? between(range.min, range.max) : 0;
  }

  root.StreamPulseHumanDelay = Object.freeze({ DELAYS: DELAYS, between: between, pick: pick });
})(globalThis);
