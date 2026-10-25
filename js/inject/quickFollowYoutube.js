/**
 * StreamPulse : bouton « Ajouter à StreamPulse » sur les pages de chaîne YouTube.
 *
 * Équivalent léger du quickFollow de Twitch (noyau commun : quickFollowCore.js) : un
 * pill logo + libellé inséré à côté du bouton d'abonnement de YouTube. États :
 * « Ajouter à StreamPulse » puis « Suivi » une fois la chaîne suivie ; cliquer
 * quand c'est suivi la retire. Le temps de visionnage YouTube est géré par
 * watchTimeTracker.js, pas ici.
 *
 * Spécificités YouTube vs Twitch :
 *  - aucune ancre documentée : on s'accroche à #subscribe-button, observé par
 *    MutationObserver + l'événement yt-navigate-finish de l'SPA, avec un
 *    sondage de secours pour les chargements où l'observateur dort ;
 *  - les libellés réutilisent les clés quickFollow.* partagées, exposées par
 *    js/inject/i18n-inline.js chargé avant ce script ; la langue vient des
 *    préférences (storage.local), comme sur Twitch.
 */
(function () {
  "use strict";

  if (window.top !== window || !window.__SP_QF__) return;

  var BTN_ID = "sp-qf-yt";

  /**
   * Chaîne de la page : @handle ou /channel/ID dans l'URL (pages de chaîne),
   * sinon le lien de la chaîne propriétaire dans le DOM (pages watch : le
   * bouton apparaît à côté de son bouton d'abonnement).
   */
  function currentChannel() {
    var parts = location.pathname.split("/").filter(Boolean).map(decodePart);
    if (parts.length) {
      var first = parts[0];
      if (first.charAt(0) === "@") return first.slice(1).toLowerCase();
      // L'ID de chaîne (UC…) est sensible à la casse : le mettre en minuscules
      // le rendait introuvable (« Action impossible »).
      if (first.toLowerCase() === "channel" && parts[1]) return parts[1];
    }
    var href = decodePart(
      document.querySelector("#owner #channel-name a[href], ytd-channel-name a[href], #channel-name a[href]")?.getAttribute("href") ||
      ""
    );
    var handle = /\/@([\w.-]{1,60})/.exec(href)?.[1];
    if (handle) return handle.toLowerCase();
    return /\/channel\/(UC[\w-]{1,60})/.exec(href)?.[1] || "";
  }

  /** Segment d'URL décodé (handles accentués : /@caf%C3%A9). */
  function decodePart(value) {
    try {
      return decodeURIComponent(value);
    } catch (_e) {
      return value;
    }
  }

  // La D.A. vient du bouton « S'abonner » lui-même : fond, texte, rayon,
  // hauteur, padding et police sont recopiés de son style calculé via des
  // variables CSS. Le pill colle donc au thème (clair/sombre) et aux refontes
  // de YouTube sans maintenance ; les valeurs en dur ne servent qu'au tout
  // premier rendu, avant qu'un vrai bouton soit mesurable.
  var STYLE = [
    "#" + BTN_ID + " { display: inline-flex; align-items: center; gap: 7px;",
    "  margin-left: 8px; vertical-align: middle; cursor: pointer; white-space: nowrap;",
    "  background: var(--sp-bg, #272727); color: var(--sp-color, #f1f1f1);",
    "  border-radius: var(--sp-radius, 18px); height: var(--sp-height, 36px);",
    "  padding: var(--sp-padding, 0 16px 0 13px); border: var(--sp-border, 0);",
    "  font-family: var(--sp-font, Roboto, Arial, sans-serif);",
    "  font-size: var(--sp-font-size, 14px); font-weight: var(--sp-weight, 500); }",
    "#" + BTN_ID + ":hover { filter: brightness(.94); }",
    // État suivi : le gris neutre du bouton « Abonné » de YouTube, comme lui
    // selon le thème — pas de violet StreamPulse, le pill reste chez YouTube.
    "#" + BTN_ID + ".is-tracked { background: #272727; color: #f1f1f1; }",
    "html:not([dark]) #" + BTN_ID + ".is-tracked { background: #f2f2f2; color: #0f0f0f; }",
    "#" + BTN_ID + ".is-busy { opacity: .55; pointer-events: none; }",
    "#" + BTN_ID + " img { width: 16px; height: 16px; }",
    "#" + BTN_ID + "-toast { position: fixed; left: 16px; bottom: 16px; z-index: 9999;",
    "  padding: 10px 14px; border-radius: 8px; background: #212121; color: #f1f1f1;",
    "  font-family: Roboto, Arial, sans-serif; font-size: 13px;",
    "  box-shadow: 0 4px 16px rgba(0,0,0,.4); }",
    "#" + BTN_ID + "-toast.is-error { background: #b3261e; color: #fff; }",
  ].join("\n");

  /**
   * Copie le style calculé du vrai bouton « S'abonner » dans les variables
   * CSS du pill. L'état suivi reste géré par la classe : sa règle, plus
   * spécifique, garde la priorité sur les variables.
   */
  function applyNativeStyle(btn, anchor) {
    var source = anchor.querySelector("button") || anchor;
    if (!source || source.tagName !== "BUTTON") return; // squelette de chargement : rien à mesurer.
    var style = window.getComputedStyle(source);
    if (style.backgroundColor === "rgba(0, 0, 0, 0)") return;
    btn.style.setProperty("--sp-bg", style.backgroundColor);
    btn.style.setProperty("--sp-color", style.color);
    btn.style.setProperty("--sp-radius", style.borderRadius);
    btn.style.setProperty("--sp-height", style.height);
    btn.style.setProperty("--sp-padding", style.padding);
    btn.style.setProperty("--sp-border", style.borderStyle === "none" ? "0" : style.border);
    btn.style.setProperty("--sp-font", style.fontFamily);
    btn.style.setProperty("--sp-font-size", style.fontSize);
    btn.style.setProperty("--sp-weight", style.fontWeight);
  }

  window.__SP_QF__
    .create({
      platform: "youtube",
      id: BTN_ID,
      style: STYLE,
      currentChannel: currentChannel,
      // Pages de chaîne comme pages watch : le conteneur #subscribe-button, ou le bouton d'abonnement
      // lui-même selon la génération du DOM YouTube.
      findAnchor: function () { return document.querySelector("#subscribe-button, ytd-subscribe-button-renderer"); },
      // Recopié à chaque rendu : le thème ou le bouton de YouTube peuvent changer sans navigation.
      afterRender: applyNativeStyle,
      // YouTube clone les conteneurs à chaque re-rendu : le clic est délégué au document.
      delegateClick: true,
      navigateEvents: ["yt-navigate-finish"],
      // Ajout d'une chaîne qui ne diffuse pas : le toast dit qu'on préviendra au prochain live.
      addedWaitingKey: "addedWaiting",
      isLive: function () {
        return Boolean(document.querySelector("ytd-watch-flexy[is-live-content] .ytp-live, .ytp-live-badge:not([disabled])"));
      },
    })
    .start();
})();
