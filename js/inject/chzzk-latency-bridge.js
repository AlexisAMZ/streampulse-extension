/**
 * StreamPulse : pont de latence CHZZK, dans le monde de la page.
 *
 * Le lecteur de CHZZK expose window.__getLiveInfo() (latence réelle entre l'émission et l'écran, en
 * ms). Un script isolé ne voit pas cette fonction : on la lit ici et on publie la valeur dans un
 * attribut de <html>, que chzzkPlayerEnhancer.js lit sans rien partager d'autre. La valeur ne sert
 * qu'à un affichage : l'attribut peut être falsifié sans conséquence.
 */
(function () {
  "use strict";

  if (window.__SP_CHZZK_BRIDGE__) return;
  window.__SP_CHZZK_BRIDGE__ = true;

  var ATTRIBUTE = "data-sp-chzzk-latency";

  function readLatency() {
    try {
      var info = typeof window.__getLiveInfo === "function" ? window.__getLiveInfo() : null;
      var latency = info ? info.latency : NaN;
      return Number.isFinite(latency) && latency >= 0 ? latency : null;
    } catch (_e) {
      // Le lecteur lève tant qu'aucun direct n'est chargé : pas de valeur, pas d'affichage.
      return null;
    }
  }

  // Une lecture toutes les 2 s, et l'attribut n'est réécrit que si la valeur (au dixième de seconde) a
  // changé : une écriture identique réveillerait quand même les observateurs de la page.
  var POLL_MS = 2000;
  var last = "";

  setInterval(function () {
    var root = document.documentElement;
    var latency = readLatency();
    var next = latency === null ? "" : String(Math.round(latency / 100) * 100);
    if (next === last) return;
    last = next;
    if (next === "") root.removeAttribute(ATTRIBUTE);
    else root.setAttribute(ATTRIBUTE, next);
  }, POLL_MS);
})();
