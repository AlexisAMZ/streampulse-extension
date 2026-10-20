/**
 * StreamPulse : bouton « Ajouter à StreamPulse » sur les pages de chaîne Kick (noyau : quickFollowCore.js).
 *
 * Même pill que sur Twitch et YouTube, à côté du bouton de suivi de Kick (data-testid="follow-button",
 * stable dans le rendu SSR comme côté client).
 *
 * Spécificités Kick :
 *  - la première route d'une page de chaîne est le nom d'utilisateur, sauf les routes réservées (mêmes
 *    exclusions que watchTimeTracker, plus « video ») ;
 *  - Kick est une SPA React : yt-navigate-finish n'existe pas ici, la combinaison MutationObserver +
 *    sondage borné couvre la navigation et les re-rendus.
 */
(function () {
  "use strict";

  if (window.top !== window || !window.__SP_QF__) return;

  var BTN_ID = "sp-qf-kick";
  // Routes Kick qui ne sont pas des chaînes : mêmes exclusions que le tracker, plus la page VOD « video »
  // et le catalogue « browse ».
  var IGNORED_ROUTES = {
    categories: true, following: true, search: true, dashboard: true,
    video: true, browse: true, community: true,
  };

  function currentChannel() {
    var first = (location.pathname.split("/").filter(Boolean)[0] || "").toLowerCase();
    return !first || IGNORED_ROUTES[first] ? "" : first;
  }

  // Même D.A. que le bouton de suivi de Kick : vert volt #53fc18, texte asphalt #090b0f, radius 4,
  // semibold — valeurs relevées dans le CSS de kick.com. Suivi : gris sombre du bouton « Followed ».
  var STYLE = [
    "#" + BTN_ID + " { display: inline-flex; align-items: center; gap: 7px;",
    "  padding: 8px 12px; margin-left: 8px; border-radius: 4px; vertical-align: middle;",
    "  border: 0; background: #53fc18; color: #090b0f; cursor: pointer;",
    "  font-family: inherit; font-size: 15px; font-weight: 600; white-space: nowrap; }",
    "#" + BTN_ID + ":hover { background: #47df15; }",
    "#" + BTN_ID + ":focus-visible { outline: 2px solid rgba(9, 11, 15, .8); outline-offset: 1px; }",
    "#" + BTN_ID + ".is-tracked { background: #1f1f26; border: 1px solid #3f3f3f; color: #fff; }",
    "#" + BTN_ID + ".is-tracked:hover { background: #26262f; }",
    "#" + BTN_ID + ".is-busy { opacity: .55; pointer-events: none; }",
    "#" + BTN_ID + " img { width: 18px; height: 18px; }",
    "#" + BTN_ID + "-toast { position: fixed; left: 16px; bottom: 16px; z-index: 9999;",
    "  padding: 10px 14px; border-radius: 8px; background: #1f1f26; color: #f1f1f1;",
    "  font-family: inherit; font-size: 13px; box-shadow: 0 4px 16px rgba(0,0,0,.5); }",
    "#" + BTN_ID + "-toast.is-error { background: #b3261e; color: #fff; }",
  ].join("\n");

  window.__SP_QF__
    .create({
      platform: "kick",
      id: BTN_ID,
      style: STYLE,
      currentChannel: currentChannel,
      // data-testid="follow-button" : absent hors page de chaîne.
      findAnchor: function () { return document.querySelector('[data-testid="follow-button"]'); },
    })
    .start();
})();
