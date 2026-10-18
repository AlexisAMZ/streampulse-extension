/*
 * Reconnaissance des boutons de récupération de Kick (Drops, récompense
 * quotidienne) et des gains de points de chaîne. Règles pures : elles reçoivent
 * des descriptions de boutons ou du texte, jamais le DOM, et n'appellent pas
 * chrome.*. Testé par tests/kick-claim-rules.test.mjs, utilisé par
 * js/kickChannelPoints.js.
 *
 * Script classique (ni import ni export) : Firefox refuse import() dans un
 * content script, ce fichier se charge donc avant kickChannelPoints.js par le
 * manifest, et comme module dans les tests.
 *
 * Kick n'a pas de coffre de points à cliquer : le solde monte tout seul (événement
 * PointsUpdated toutes les deux minutes de visionnage). Ce qui se réclame, c'est
 * la récompense quotidienne (60 min de visionnage) et les Drops terminés.
 */
(function (root) {
  "use strict";
  if (root.StreamPulseKickClaim) return;

  /** Animation de la barre du haut quand la récompense quotidienne est prête. */
  var DAILY_READY_SRC = "/rewards/reward-available-CTA";

  // Repli quand la page ne fournit pas ses traductions : verbes de réclamation
  // des langues de Kick les plus courantes. « Claimed » / « Réclamé » sont
  // exclus par la fin de mot obligatoire.
  var CLAIM_VERB = "(claim|réclamer|récupérer|reclamar|resgatar|abholen|einlösen|riscatta|odbierz|получить)";
  var FALLBACK_DAILY = new RegExp("^" + CLAIM_VERB + "$", "i");
  var FALLBACK_DROP = new RegExp("^" + CLAIM_VERB + "\\s+\\S", "i");

  /** Points gagnés d'un coup au-delà desquels « +N » n'est pas un gain de points. */
  var MAX_EARNED = 100000;

  /** Valeur d'une clé next-intl dans le payload de la page, guillemets échappés ou non. */
  function readMessage(source, key) {
    var re = new RegExp('\\\\?"' + key + '\\\\?"\\s*:\\s*\\\\?"((?:[^"\\\\]|\\\\u[0-9a-fA-F]{4})*)\\\\?"');
    var match = re.exec(source || "");
    if (!match) return "";
    return match[1].replace(/\\u([0-9a-fA-F]{4})/g, function (_, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    }).trim();
  }

  /**
   * Libellés des boutons dans la langue servie par Kick, lus dans les
   * traductions que la page embarque (Drops.Inventory.claim_reward_named,
   * Navbar.gamification.claim_cta).
   */
  function readLabels(source) {
    var named = readMessage(source, "claim_reward_named");
    var at = named.indexOf("{name}");
    return {
      dropNamed: at < 0 ? null : {
        prefix: named.slice(0, at).trim(),
        suffix: named.slice(at + "{name}".length).trim(),
      },
      dailyClaim: readMessage(source, "claim_cta"),
    };
  }

  function isClickable(button) {
    return Boolean(button) && !button.disabled && button.visible !== false;
  }

  /**
   * Bouton « Réclamer » d'un Drop terminé. Kick le nomme « Réclamer la
   * récompense <nom> » : l'aria-label nommé est le seul signal retenu, un
   * simple « Réclamer » ailleurs sur la page peut appartenir à autre chose.
   *
   * @param {{aria?: string, text?: string, disabled?: boolean, visible?: boolean}} button
   * @param {{dropNamed: {prefix: string, suffix: string} | null}} labels
   */
  function isDropClaimButton(button, labels) {
    if (!isClickable(button)) return false;
    var aria = (button.aria || "").trim();
    var named = labels && labels.dropNamed;
    if (!named) return FALLBACK_DROP.test(aria);
    if (!aria.startsWith(named.prefix) || !aria.endsWith(named.suffix)) return false;
    var name = aria.slice(named.prefix.length, aria.length - named.suffix.length).trim();
    return name.length > 0;
  }

  /** Bouton « Récupérer » de la fenêtre de récompense quotidienne. */
  function isDailyClaimButton(button, labels) {
    if (!isClickable(button)) return false;
    var text = (button.text || "").trim();
    var expected = labels && labels.dailyClaim;
    return expected ? text === expected : FALLBACK_DAILY.test(text);
  }

  /** Vrai si l'une des sources média de la barre est l'animation « récompense prête ». */
  function isDailyRewardReady(sources) {
    return (sources || []).some(function (src) {
      return typeof src === "string" && src.indexOf(DAILY_READY_SRC) >= 0;
    });
  }

  /**
   * Points gagnés lus sur l'animation « +N » que Kick affiche une seconde à
   * côté du compteur. Le compteur, lui, est abrégé (« 14,4 k ») et ne sert pas
   * à mesurer un gain. Rend 0 si le texte n'est pas un gain entier.
   */
  function parseEarnedPoints(text) {
    var match = /^\s*\+\s*(\d{1,3}(?:[\s\u00a0\u202f.,]\d{3})*|\d+)\s*$/.exec(text || "");
    if (!match) return 0;
    var value = parseInt(match[1].replace(/\D/g, ""), 10);
    return value > 0 && value <= MAX_EARNED ? value : 0;
  }

  root.StreamPulseKickClaim = Object.freeze({
    DAILY_READY_SRC: DAILY_READY_SRC,
    readLabels: readLabels,
    isDropClaimButton: isDropClaimButton,
    isDailyClaimButton: isDailyClaimButton,
    isDailyRewardReady: isDailyRewardReady,
    parseEarnedPoints: parseEarnedPoints,
  });
})(globalThis);
