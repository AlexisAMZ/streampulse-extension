/**
 * Fabrique une page HTML autonome qui rend le VRAI popup de l'extension.
 *
 * On repart de html/popup.html sans le toucher : on retire simplement le module
 * js/popup.js (qui exige les API chrome.*) et on injecte un script classique qui
 * rejoue la partie « rendu » — traductions, cartes streamer, préférences — avec
 * un jeu de données de démonstration.
 *
 * Les modules ES ne se chargent pas en file:// (CORS), d'où les tables de
 * traduction sérialisées directement dans la page plutôt qu'importées.
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./config.mjs";
import { DEMO_STREAMERS, DEMO_PROFILE, DEMO_STATS } from "./demo-data.mjs";

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
      return vars && Object.prototype.hasOwnProperty.call(vars, name)
        ? String(vars[name])
        : match;
    });
  }

  function camelToKebab(value) {
    return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase();
  }

  // ── Traductions (même logique que js/i18n.js applyTranslations) ──
  function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach(function (element) {
      var key = element.dataset.i18n;
      if (!key) return;
      if (element.dataset.i18nMode === "html") element.innerHTML = t(key);
      else element.textContent = t(key);
    });
    document
      .querySelectorAll("[data-i18n-attr-placeholder],[data-i18n-attr-title],[data-i18n-attr-ariaLabel]")
      .forEach(function (element) {
        Object.keys(element.dataset).forEach(function (dataKey) {
          if (dataKey.indexOf("i18nAttr") !== 0) return;
          var attr = camelToKebab(dataKey.slice("i18nAttr".length));
          if (attr) element.setAttribute(attr, t(element.dataset[dataKey]));
        });
      });
    document.documentElement.lang = t("popup.htmlLang") || CFG.lang;
    document.title = t("popup.title");
  }

  function formatNumber(value) {
    try {
      return new Intl.NumberFormat(CFG.locale).format(value);
    } catch (error) {
      return String(value);
    }
  }

  // ── En-tête, accueil, statistiques ──
  function renderHeader() {
    var points = formatNumber(CFG.stats.points);
    var pointsEl = document.getElementById("header-points-value");
    var pointsEl2 = document.getElementById("header-points-value2");
    var statPoints = document.getElementById("stat-points");
    if (pointsEl) pointsEl.textContent = points;
    if (pointsEl2) pointsEl2.textContent = points;
    if (statPoints) statPoints.textContent = points;

    var watch = CFG.stats.watchTimeHours + "h" + String(CFG.stats.watchTimeMinutes).padStart(2, "0");
    var watchEl = document.getElementById("stat-watchtime");
    if (watchEl) watchEl.textContent = watch;

    var liveLabel = document.getElementById("greeting-live-count");
    if (liveLabel) {
      liveLabel.textContent =
        CFG.stats.liveCount === 1
          ? t("popup.greetingLiveCountSingular", { count: CFG.stats.liveCount })
          : t("popup.greetingLiveCountPlural", { count: CFG.stats.liveCount });
    }

    var liveCount = document.getElementById("live-count");
    if (liveCount) liveCount.textContent = String(CFG.stats.liveCount).padStart(2, "0");

    var title = document.getElementById("greeting-title");
    if (title) {
      var salut = t("popup.greetingEvening");
      var sub = document.createElement("span");
      sub.className = "greeting-sub";
      sub.textContent = t("popup.greetingSub");
      title.replaceChildren(
        document.createTextNode(salut + " " + CFG.profile.displayName + "."),
        document.createElement("br"),
        sub
      );
    }
  }

  // ── Sélecteur de plateforme (rendu par popup.js en temps normal) ──
  function renderPlatformPicker() {
    var picker = document.getElementById("platform-picker");
    if (!picker) return;
    picker.innerHTML = "";
    CFG.platforms.forEach(function (platform, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "platform-button" + (index === 0 ? " active" : "");
      button.dataset.platform = platform.id;
      button.setAttribute("aria-pressed", index === 0 ? "true" : "false");

      var icon = document.createElement("img");
      icon.src = "../" + platform.icon;
      icon.alt = "";

      var label = document.createElement("span");
      label.className = "platform-button-label";
      label.textContent = t("platforms." + platform.id);

      button.append(icon, label);
      picker.appendChild(button);
    });
  }

  function renderLanguageButtons() {
    var host = document.getElementById("language-options-popup");
    if (!host) return;
    host.innerHTML = "";
    CFG.languages.forEach(function (language) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "language-button" + (language.code === CFG.lang ? " is-active" : "");
      button.dataset.lang = language.code;
      button.setAttribute("aria-pressed", language.code === CFG.lang ? "true" : "false");
      button.textContent = language.label;
      host.appendChild(button);
    });
  }

  // ── Cartes streamer (miroir de createStreamerCard dans js/ui.js) ──
  function buildCard(streamer) {
    var template = document.getElementById("streamer-item-template");
    var fragment = template.content.cloneNode(true);
    var card = fragment.querySelector(".streamer-card");
    var platformLabel = t("platforms." + streamer.platform);
    card.dataset.platform = streamer.platform;

    var displayName = fragment.querySelector(".display-name");
    displayName.innerHTML = "";
    var nameText = document.createElement("span");
    nameText.className = "name-text";
    nameText.textContent = streamer.handle;
    displayName.appendChild(nameText);

    var avatar = fragment.querySelector(".avatar");
    avatar.src = streamer.avatar;
    avatar.alt = "";

    var identityMeta = fragment.querySelector(".identity-meta");
    identityMeta.textContent = platformLabel;

    var statusPill = fragment.querySelector(".status-pill");
    var cardPreview = fragment.querySelector(".card-preview");
    var livePreview = cardPreview.querySelector(".live-preview");
    var previewImage = cardPreview.querySelector(".preview-image");
    var liveTitle = fragment.querySelector(".live-title");
    var statusCategory = fragment.querySelector(".status-category");

    if (streamer.isLive) {
      card.classList.add("live");
      statusPill.classList.remove("offline");
      statusPill.classList.add("online");
      statusPill.textContent = t("popup.card.statusLive", { platform: platformLabel });

      cardPreview.hidden = false;
      livePreview.hidden = false;
      previewImage.src = streamer.thumbnail;
      previewImage.alt = "";
      liveTitle.textContent = t("popup.card.defaultLiveTitle");
      statusCategory.textContent = streamer.category;
      statusCategory.hidden = false;
    } else {
      card.classList.add("offline");
      statusPill.classList.remove("online");
      statusPill.classList.add("offline");
      statusPill.textContent = t("popup.card.offlinePlatform", { platform: platformLabel });
      cardPreview.hidden = true;
      livePreview.hidden = true;
      previewImage.removeAttribute("src");
      liveTitle.textContent = t("popup.card.offline");
      statusCategory.hidden = true;
    }

    fragment.querySelector(".notification-button").classList.add("active");
    fragment.querySelector(".game-notification-button").classList.add("active");
    fragment.querySelector(".last-update").hidden = true;
    return fragment;
  }

  function renderStreamers() {
    var list = document.getElementById("streamer-list");
    if (!list) return;
    list.innerHTML = "";
    CFG.streamers.forEach(function (streamer) {
      list.appendChild(buildCard(streamer));
    });
  }

  // ── Préférences : tout coché, c'est l'état « configuré » que l'on montre ──
  function renderPreferences() {
    document
      .querySelectorAll('#settings-section input[type="checkbox"]')
      .forEach(function (input) {
        input.checked = true;
      });
    document.querySelectorAll("#previews-mode-group .seg-btn").forEach(function (button) {
      button.classList.toggle("active", button.dataset.previewsMode === "video");
    });
    document.querySelectorAll("#previews-size-group .seg-btn").forEach(function (button) {
      button.classList.toggle("active", button.dataset.previewsSize === "m");
    });
    var pseudo = document.getElementById("pref-pseudo-input");
    if (pseudo) pseudo.value = CFG.profile.displayName;
    var month = document.getElementById("watch-time-month");
    if (month) month.innerHTML = "";
  }

  function setVariant() {
    var streamersView = document.getElementById("streamers-view");
    var settingsSection = document.getElementById("settings-section");
    var isSettings = CFG.variant === "settings";

    document.querySelectorAll(".tab-button").forEach(function (button) {
      button.classList.toggle("active", button.dataset.tab === (isSettings ? "settings" : "streamers"));
    });
    streamersView.classList.toggle("hidden", isSettings);
    settingsSection.classList.toggle("hidden", !isSettings);

    if (isSettings && CFG.scrollToSelector) {
      var anchor = document.querySelector(CFG.scrollToSelector);
      if (anchor) settingsSection.scrollTop = anchor.offsetTop - 14;
    }
  }

  applyTranslations();
  renderHeader();
  renderPlatformPicker();
  renderLanguageButtons();
  renderStreamers();
  renderPreferences();
  setVariant();
  document.documentElement.dataset.shotReady = "1";
})();
`;

/**
 * @param {object} options
 * @param {string} options.lang            code de langue interne (ex. "pt-BR")
 * @param {string} options.locale          locale BCP-47 pour Intl
 * @param {object} options.strings         bloc de traduction de la langue
 * @param {object} options.fallback        bloc de traduction anglais (repli)
 * @param {object[]} options.platforms     définitions plateforme (id + icon)
 * @param {object[]} options.languages     langues proposées dans les réglages
 * @param {"dashboard"|"settings"} options.variant
 * @param {string} [options.scrollToSelector]
 * @returns {string} HTML complet, à écrire à la racine du dépôt (profondeur 1)
 */
export function buildPopupPage(options) {
  const source = fs.readFileSync(POPUP_SRC, "utf8");
  if (!source.includes(MODULE_TAG)) {
    throw new Error(
      "html/popup.html ne contient plus la balise script attendue — adapter MODULE_TAG.",
    );
  }

  const config = {
    lang: options.lang,
    locale: options.locale,
    variant: options.variant,
    scrollToSelector: options.scrollToSelector || null,
    strings: options.strings,
    fallback: options.fallback,
    platforms: options.platforms,
    languages: options.languages,
    streamers: DEMO_STREAMERS,
    profile: DEMO_PROFILE,
    stats: DEMO_STATS,
  };

  const injected = [
    `<script>window.__STORE_SHOT__ = ${toJsonLiteral(config)};</script>`,
    `<script>${RUNTIME}</script>`,
  ].join("\n");

  return source.replace(MODULE_TAG, injected);
}
