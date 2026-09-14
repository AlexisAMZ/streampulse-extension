/**
 * Fabrique une page HTML autonome qui rend le VRAI popup de l'extension.
 *
 * On repart de html/popup.html sans le toucher : on retire simplement le module
 * js/popup.js (qui exige les API chrome.*) et on injecte un script classique qui
 * rejoue la partie « rendu » des réglages (traductions, en-tête, interrupteurs).
 * La vue d'accueil vient d'une vraie capture : source-dashboard.png.
 *
 * Les modules ES ne se chargent pas en file:// (CORS), d'où les tables de
 * traduction sérialisées directement dans la page plutôt qu'importées.
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./config.mjs";
import { DEMO_STATS } from "./demo-data.mjs";

const POPUP_SRC = path.join(ROOT, "html", "popup.html");
const MODULE_TAG = '<script type="module" src="../js/popup.js"></script>';

/** Neutralise `</script>` à l'intérieur d'un littéral JSON injecté en page. */
function toJsonLiteral(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

const RUNTIME = String.raw`
(function () {
  var CFG = window.__STORE_SHOT__;

  function resolve(key, table) {
    var current = table;
    var parts = key.split(".");
    for (var i = 0; i < parts.length; i += 1) {
      if (!current || typeof current !== "object") return null;
      current = current[parts[i]];
    }
    return typeof current === "string" ? current : null;
  }

  function t(key, vars) {
    var value = resolve(key, CFG.strings);
    if (value == null) value = resolve(key, CFG.fallback);
    if (value == null) return key;
    return value.replace(/\{\{(\w+)\}\}/g, function (match, name) {
      return vars && Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match;
    });
  }

  function camelToKebab(value) {
    return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase();
  }

  // Même logique que js/i18n.js applyTranslations.
  document.querySelectorAll("[data-i18n]").forEach(function (element) {
    var key = element.dataset.i18n;
    if (!key) return;
    if (element.dataset.i18nMode === "html") element.innerHTML = t(key);
    else element.textContent = t(key);
  });
  document.querySelectorAll("*").forEach(function (element) {
    Object.keys(element.dataset).forEach(function (dataKey) {
      if (dataKey.indexOf("i18nAttr") !== 0) return;
      var attr = camelToKebab(dataKey.slice("i18nAttr".length));
      if (attr) element.setAttribute(attr, t(element.dataset[dataKey]));
    });
  });
  document.documentElement.lang = CFG.lang;

  var points = new Intl.NumberFormat(CFG.locale).format(CFG.stats.points);
  var pointsEl = document.getElementById("header-points-value2");
  if (pointsEl) pointsEl.textContent = points;
  var watchEl = document.getElementById("stat-watchtime");
  if (watchEl) watchEl.textContent = CFG.stats.watchTimeHours + "h" + String(CFG.stats.watchTimeMinutes).padStart(2, "0");

  // Vue Réglages, panneau demandé, tout activé : l'état « configuré ».
  document.getElementById("streamers-view").classList.add("hidden");
  document.getElementById("settings-section").classList.remove("hidden");
  document.querySelectorAll(".tab-button").forEach(function (button) {
    button.setAttribute("aria-selected", String(button.dataset.tab === "settings"));
    button.classList.toggle("active", button.dataset.tab === "settings");
  });
  document.querySelectorAll(".menu-tab").forEach(function (tab) {
    var active = tab.dataset.panel === CFG.panel;
    tab.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".menu-panel").forEach(function (panel) {
    panel.hidden = panel.id !== "menu-" + CFG.panel;
  });
  document.querySelectorAll('#settings-section input[type="checkbox"]').forEach(function (input) {
    input.checked = true;
  });
  document.documentElement.dataset.shotReady = "1";
})();
`;

/**
 * @param {object} options
 * @param {string} options.lang            code de langue interne (ex. "pt-BR")
 * @param {string} options.locale          locale BCP-47 pour Intl
 * @param {object} options.strings         bloc de traduction de la langue
 * @param {object} options.fallback        bloc de traduction anglais (repli)
 * @param {string} [options.panel]         panneau de réglages affiché
 * @returns {string} HTML complet, à écrire à la racine du dépôt (profondeur 1)
 */
export function buildPopupPage(options) {
  const source = fs.readFileSync(POPUP_SRC, "utf8");
  if (!source.includes(MODULE_TAG)) {
    throw new Error(
      "html/popup.html ne contient plus la balise script attendue : adapter MODULE_TAG.",
    );
  }

  const config = {
    lang: options.lang,
    locale: options.locale,
    panel: options.panel || "automation",
    strings: options.strings,
    fallback: options.fallback,
    stats: DEMO_STATS,
  };

  const injected = [
    `<script>window.__STORE_SHOT__ = ${toJsonLiteral(config)};</script>`,
    `<script>${RUNTIME}</script>`,
  ].join("\n");

  return source.replace(MODULE_TAG, injected);
}
