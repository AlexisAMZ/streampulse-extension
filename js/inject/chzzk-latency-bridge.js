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

  setInterval(function () {
    var root = document.documentElement;
    var latency = readLatency();
    if (latency === null) root.removeAttribute(ATTRIBUTE);
    else root.setAttribute(ATTRIBUTE, String(latency));
  }, 1000);
})();
