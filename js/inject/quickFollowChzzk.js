/**
 * StreamPulse : bouton « Ajouter à StreamPulse » sur les pages de chaîne CHZZK (noyau : quickFollowCore.js).
 *
 * Ce script n'existe que si l'utilisateur a accordé CHZZK : il est enregistré dynamiquement par
 * js/sw/chzzk-access.js, donc l'accès à l'API est déjà là quand on clique.
 *
 * Spécificités CHZZK :
 *  - une chaîne s'identifie par 32 caractères hexadécimaux : /<id>, /live/<id>, /<id>/community… ;
 *  - le bouton se place à côté du bouton « Suivre » du site (repéré par son texte, les classes de CHZZK
 *    sont générées) et, faute de le trouver, flotte en bas à gauche : il ne disparaît jamais ;
 *  - rendu limité à une fois par seconde : le tchat repeint des centaines de nœuds par seconde.
 */
(function () {
  "use strict";

  if (window.top !== window || !window.__SP_QF__) return;

  var BTN_ID = "sp-qf-chzzk";
  var CHANNEL_ID = /^[0-9a-f]{32}$/i;
  var FOLLOW_LABEL = /^(팔로우|팔로잉|follow(ing)?)$/i;
  var SECTIONS_BEFORE_ID = { live: true, video: true, channel: true };

  function currentChannel() {
    var parts = location.pathname.split("/").filter(Boolean);
    var candidate = SECTIONS_BEFORE_ID[(parts[0] || "").toLowerCase()] ? parts[1] : parts[0];
    return candidate && CHANNEL_ID.test(candidate) ? candidate.toLowerCase() : "";
  }

  /** Le bouton « Suivre » du site : un vrai bouton visible dont le texte est exactement ce mot. */
  function findAnchor() {
    var buttons = document.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      var button = buttons[i];
      if (button.id === BTN_ID || !FOLLOW_LABEL.test((button.textContent || "").trim())) continue;
      if (button.getBoundingClientRect().width > 0) return button;
    }
    return null;
  }

  // Vert CHZZK #00ffa3, texte sombre, pilule comme les boutons du site ; suivi : gris sombre à bordure.
  var STYLE = [
    "#" + BTN_ID + " { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px 6px 12px; margin-left: 8px;",
    "  border-radius: 999px; vertical-align: middle; border: 0; background: #00ffa3; color: #0b0d12;",
    "  cursor: pointer; font-family: inherit; font-size: 13px; line-height: 1.2; font-weight: 700; white-space: nowrap; }",
    "#" + BTN_ID + ":hover { background: #00e693; }",
    "#" + BTN_ID + ":focus-visible { outline: 2px solid rgba(11, 13, 18, .8); outline-offset: 1px; }",
    "#" + BTN_ID + ".is-tracked { background: #1f1f26; border: 1px solid #3f3f3f; color: #fff; }",
    "#" + BTN_ID + ".is-tracked:hover { background: #26262f; }",
    "#" + BTN_ID + ".is-busy { opacity: .55; pointer-events: none; }",
    "#" + BTN_ID + ".is-floating { position: fixed; left: 16px; bottom: 16px; z-index: 9998; margin: 0;",
    "  box-shadow: 0 4px 16px rgba(0,0,0,.5); }",
    "#" + BTN_ID + " img { width: 16px; height: 16px; border-radius: 50%; }",
    "#" + BTN_ID + "-toast { position: fixed; left: 16px; bottom: 64px; z-index: 9999; padding: 10px 14px;",
    "  border-radius: 8px; background: #1f1f26; color: #f1f1f1; font-family: inherit; font-size: 13px;",
    "  box-shadow: 0 4px 16px rgba(0,0,0,.5); }",
    "#" + BTN_ID + "-toast.is-error { background: #b3261e; color: #fff; }",
  ].join("\n");

  window.__SP_QF__
    .create({ platform: "chzzk", id: BTN_ID, style: STYLE, currentChannel: currentChannel, findAnchor: findAnchor, floating: true, minGapMs: 1000 })
    .start();
})();
