/**
 * StreamPulse : tiroir de réglages sur la page Twitch (monde isolé).
 *
 * Ouvert par « Tous les réglages » du panneau de la topbar, à la place du popup
 * dans un nouvel onglet. Il reprend les réglages utiles sur Twitch, dans le même
 * monde visuel que le panneau (css/topbar.css, css/inject/twitch-ui.css).
 *
 * Expose `self.__SP_DRAWER__` : open(tab), close(), buildCosmetics(opts), réutilisé
 * par chat-plus.js pour les effets dans les paramètres du tchat.
 */
(function () {
  "use strict";

  if (window.top !== window || window.__SP_DRAWER__) return;

  var PREFERENCES_KEY = "betaGeneralPreferences";
  var PLUS_KEY = "streamPulsePlus";
  var COSMETICS_KEY = "streamPulseCosmetics";
  var PLUS_GRACE_MS = 30 * 24 * 60 * 60 * 1000;
  var PLUS_URL = "https://streampulse.fr/plus";
  var BADGE_FX = ["pulse", "shine", "rainbow", "glow", "bounce", "spin", "flicker"];
  var NAME_FX = ["aurora", "sunset", "lcd", "gold", "neon", "rainbow"];
  var LOGO_URL = chrome.runtime.getURL("images/photos/logosp.png");
  var MARK_URL = chrome.runtime.getURL("images/photos/128px.png");

  // Réglages activés tant que l'utilisateur ne les a pas coupés.
  var DEFAULT_ON = [
    "autoClaimChannelPoints", "liveNotifications", "enableFastForwardButton",
    "previewsEnabled", "previewsSurfaceDirectory", "previewsSurfaceSidebar",
  ];

  var TABS = [
    {
      id: "general",
      label: "twitchUi.tabGeneral",
      groups: [
        { title: "shared.settings.groupAutomation", keys: [
          ["autoClaimChannelPoints", "autoClaimTitle"],
          ["autoClaimDrops", "autoClaimDropsTitle"],
          ["autoClaimMoments", "autoClaimMomentsTitle"],
          ["autoCancelRaids", "autoCancelRaidsTitle"],
        ] },
        { title: "shared.settings.groupChat", keys: [
          ["autoRefreshPlayerErrors", "autoRefreshTitle"],
          ["enableFastForwardButton", "fastForwardTitle"],
          ["hideTwitchExtensions", "hideTwitchExtensionsTitle"],
          ["communityBadge", "communityBadgeTitle"],
        ] },
      ],
    },
    {
      id: "previews",
      label: "twitchUi.tabPreviews",
      groups: [
        { title: "shared.settings.groupPreviews", mode: true, keys: [
          ["previewsEnabled", "previewsEnableTitle"],
          ["previewsSurfaceDirectory", "previewsSurfaceDirectory"],
          ["previewsSurfaceSidebar", "previewsSurfaceSidebar"],
          ["previewsAudio", "previewsAudioTitle"],
        ] },
      ],
    },
    {
      id: "alerts",
      label: "twitchUi.tabAlerts",
      groups: [
        { title: "shared.settings.groupNotifications", keys: [
          ["liveNotifications", "liveNotificationsTitle"],
          ["gameNotifications", "gameAlertsTitle"],
          ["titleNotifications", "titleAlertsTitle"],
          ["soundsEnabled", "soundsTitle"],
        ] },
      ],
    },
    { id: "plus", label: "Plus", plus: true },
  ];

  var ICON_CLOSE =
    '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  var ICON_EXTERNAL =
    '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M11 4h5v5M16 4l-7 7M8 5H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var ctx = { lang: "en", prefs: {}, plus: false, cosmetics: { badgeFx: "", nameFx: "" } };
  var drawer = null;
  var activeTab = "general";
  var editors = [];

  // ---- utilitaires -------------------------------------------------------------
  function tr(key) {
    if (key.indexOf(".") === -1) return key;
    var api = window.__SP_I18N__;
    return api ? api.get(ctx.lang, key) : key;
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function alive() {
    return !!(chrome.runtime && chrome.runtime.id);
  }

  /** Même règle que js/plus.js : à vie toujours active, mensuelle 30 jours après la dernière vérification. */
  function plusActive(record) {
    if (!record || record.status !== "active" || !record.licenseKey) return false;
    if (record.plan === "lifetime") return true;
    return Date.now() - (Number(record.verifiedAt) || 0) <= PLUS_GRACE_MS;
  }

  function normalizeCosmetics(value) {
    var input = value && typeof value === "object" ? value : {};
    return {
      badgeFx: BADGE_FX.indexOf(input.badgeFx) !== -1 ? input.badgeFx : "",
      nameFx: NAME_FX.indexOf(input.nameFx) !== -1 ? input.nameFx : "",
    };
  }

  function prefOn(key) {
    var value = ctx.prefs[key];
    return DEFAULT_ON.indexOf(key) !== -1 ? value !== false : value === true;
  }

  function sampleName() {
    var match = /(?:^|;\s*)login=([^;]+)/.exec(document.cookie || "");
    return match ? decodeURIComponent(match[1]) : tr("shared.cosmetics.sampleName");
  }

  function loadContext(done) {
    if (!alive()) return;
    chrome.storage.local.get([PREFERENCES_KEY, PLUS_KEY, COSMETICS_KEY], function (r) {
      r = r || {};
      var api = window.__SP_I18N__;
      ctx.prefs = r[PREFERENCES_KEY] || {};
      ctx.lang = api ? api.resolve(ctx.prefs.language || navigator.language) : "en";
      ctx.plus = plusActive(r[PLUS_KEY]);
      ctx.cosmetics = normalizeCosmetics(r[COSMETICS_KEY]);
      if (done) done();
    });
  }

  function savePref(key, value) {
    ctx.prefs[key] = value;
    try {
      var updates = {};
      updates[key] = value;
      chrome.runtime.sendMessage({ type: "updatePreferences", updates: updates });
    } catch (_e) {
      // Contexte d'extension invalidé par une mise à jour : le réglage sera repris depuis le popup.
    }
  }

  // ---- éditeur des effets (tiroir et paramètres du tchat) ----------------------
  function chipGroup(title, values, labelPrefix, field, editor) {
    var group = el("div", "sp-fx-group");
    group.appendChild(el("div", "sp-fx-group-title", tr(title)));
    var chips = el("div", "sp-fx-chips");
    chips.setAttribute("role", "radiogroup");
    chips.setAttribute("aria-label", tr(title));
    [""].concat(values).forEach(function (value) {
      var chip = el("button", "sp-fx-chip", tr(labelPrefix + (value || "none")));
      chip.type = "button";
      chip.setAttribute("role", "radio");
      chip.setAttribute("data-value", value);
      chip.addEventListener("click", function () {
        if (!ctx.plus) {
          window.open(PLUS_URL, "_blank", "noopener");
          return;
        }
        var next = {};
        next.badgeFx = ctx.cosmetics.badgeFx;
        next.nameFx = ctx.cosmetics.nameFx;
        next[field] = value;
        ctx.cosmetics = normalizeCosmetics(next);
        chrome.storage.local.set({ [COSMETICS_KEY]: ctx.cosmetics });
        refreshEditors();
      });
      chips.appendChild(chip);
    });
    group.appendChild(chips);
    editor.groups.push({ field: field, chips: chips });
    return group;
  }

  /**
   * @param {{ compact?: boolean }} [opts]
   * @returns {HTMLElement}
   */
  function buildCosmetics(opts) {
    opts = opts || {};
    var root = el("div", "sp-fx-editor" + (opts.compact ? " is-compact" : ""));
    var editor = { root: root, groups: [], badge: null, name: null, lock: null };

    var preview = el("div", "sp-fx-preview");
    var badge = el("span", "sp-chat-badge");
    var mark = el("span", "sp-chat-badge-img");
    var mask = "url(" + MARK_URL + ")";
    mark.style.setProperty("-webkit-mask-image", mask);
    mark.style.setProperty("mask-image", mask);
    mark.style.setProperty("--sp-badge-color", "#bf94ff");
    badge.appendChild(mark);
    var name = el("span", "sp-fx-name", sampleName());
    name.style.setProperty("--sp-paint-glow", "#9146ff");
    preview.appendChild(badge);
    preview.appendChild(name);
    preview.appendChild(el("span", "sp-fx-sample", ": gg !"));
    root.appendChild(preview);
    editor.badge = badge;
    editor.name = name;

    root.appendChild(chipGroup("shared.cosmetics.nameTitle", NAME_FX, "shared.cosmetics.", "nameFx", editor));
    root.appendChild(chipGroup("shared.cosmetics.badgeTitle", BADGE_FX, "shared.cosmetics.", "badgeFx", editor));

    var foot = el("div", "sp-fx-foot");
    root.appendChild(foot);
    editor.lock = foot;

    editors.push(editor);
    paintEditor(editor);
    return root;
  }

  function paintEditor(editor) {
    var shown = ctx.plus ? ctx.cosmetics : { badgeFx: "", nameFx: "" };
    editor.root.classList.toggle("is-locked", !ctx.plus);
    editor.badge.className = "sp-chat-badge" + (shown.badgeFx ? " sp-chat-badge--fx-" + shown.badgeFx : "");
    editor.name.className = "sp-fx-name" + (shown.nameFx ? " sp-paint sp-paint--" + shown.nameFx : "");
    editor.groups.forEach(function (group) {
      Array.prototype.forEach.call(group.chips.children, function (chip) {
        var on = chip.getAttribute("data-value") === shown[group.field];
        chip.classList.toggle("on", on);
        chip.setAttribute("aria-checked", String(on));
      });
    });

    editor.lock.textContent = "";
    if (ctx.plus) {
      editor.lock.appendChild(el("span", "sp-fx-note", tr("twitchUi.chatRowNote")));
    } else {
      editor.lock.appendChild(el("span", "sp-fx-note", tr("twitchUi.plusOnly")));
      var cta = el("a", "sp-fx-cta", tr("twitchUi.discoverPlus"));
      cta.href = PLUS_URL;
      cta.target = "_blank";
      cta.rel = "noopener noreferrer";
      editor.lock.appendChild(cta);
    }
  }

  function refreshEditors() {
    editors = editors.filter(function (editor) {
      return editor.root.isConnected;
    });
    editors.forEach(paintEditor);
  }

  // ---- tiroir ------------------------------------------------------------------
  function toggleRow(key, labelKey) {
    var row = el("button", "sp-tb-row");
    row.type = "button";
    row.setAttribute("role", "switch");
    row.setAttribute("data-sp-pref", key);
    row.appendChild(el("span", null, tr("shared.settings." + labelKey)));
    row.appendChild(el("span", "sp-tb-sw"));
    row.addEventListener("click", function () {
      savePref(key, !prefOn(key));
      paintSwitches();
    });
    return row;
  }

  function modeRow() {
    var row = el("div", "sp-tb-badge-row");
    row.appendChild(el("span", "sp-tb-badge-label", tr("shared.settings.previewsModeTitle")));
    var group = el("div", "sp-tb-badge-modes");
    [["image", "previewsModeImage"], ["video", "previewsModeVideo"]].forEach(function (mode) {
      var b = el("button", "sp-tb-badge-mode", tr("shared.settings." + mode[1]));
      b.type = "button";
      b.setAttribute("data-sp-mode", mode[0]);
      b.addEventListener("click", function () {
        savePref("previewsMode", mode[0]);
        paintSwitches();
      });
      group.appendChild(b);
    });
    row.appendChild(group);
    return row;
  }

  function paintSwitches() {
    if (!drawer) return;
    Array.prototype.forEach.call(drawer.querySelectorAll("[data-sp-pref]"), function (row) {
      var on = prefOn(row.getAttribute("data-sp-pref"));
      row.setAttribute("aria-checked", String(on));
      row.querySelector(".sp-tb-sw").classList.toggle("on", on);
    });
    var mode = ctx.prefs.previewsMode === "video" ? "video" : "image";
    Array.prototype.forEach.call(drawer.querySelectorAll("[data-sp-mode]"), function (b) {
      b.classList.toggle("on", b.getAttribute("data-sp-mode") === mode);
    });
  }

  function tabContent(tab) {
    var body = el("div", "sp-drawer-body");
    if (tab.plus) {
      var section = el("div", "sp-tb-section");
      section.appendChild(el("div", "sp-tb-section-title", tr("twitchUi.chatRow")));
      section.appendChild(buildCosmetics());
      body.appendChild(section);
      return body;
    }
    tab.groups.forEach(function (group) {
      var section = el("div", "sp-tb-section");
      section.appendChild(el("div", "sp-tb-section-title", tr(group.title)));
      group.keys.forEach(function (pair) {
        section.appendChild(toggleRow(pair[0], pair[1]));
      });
      if (group.mode) section.appendChild(modeRow());
      body.appendChild(section);
    });
    return body;
  }

  function renderBody() {
    if (!drawer) return;
    var tab = TABS.filter(function (t) { return t.id === activeTab; })[0] || TABS[0];
    var old = drawer.querySelector(".sp-drawer-body");
    var next = tabContent(tab);
    if (old) old.replaceWith(next);
    else drawer.querySelector(".sp-drawer-foot").before(next);
    Array.prototype.forEach.call(drawer.querySelectorAll(".sp-drawer-tab"), function (b) {
      var on = b.getAttribute("data-tab") === tab.id;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", String(on));
    });
    paintSwitches();
  }

  function build() {
    var root = el("aside", "sp-drawer");
    root.id = "sp-drawer";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "StreamPulse · " + tr("twitchUi.drawerTitle"));

    var head = el("div", "sp-drawer-head");
    var logo = document.createElement("img");
    logo.className = "sp-tb-logo";
    logo.alt = "";
    logo.src = LOGO_URL;
    head.appendChild(logo);
    var titles = el("div", "sp-drawer-titles");
    titles.appendChild(el("span", "sp-drawer-brand", "StreamPulse"));
    titles.appendChild(el("span", "sp-drawer-sub", tr("twitchUi.drawerTitle")));
    head.appendChild(titles);
    var close = el("button", "sp-drawer-close");
    close.type = "button";
    close.innerHTML = ICON_CLOSE;
    close.setAttribute("aria-label", tr("twitchUi.close"));
    close.addEventListener("click", closeDrawer);
    head.appendChild(close);
    root.appendChild(head);

    var tabs = el("div", "sp-drawer-tabs");
    tabs.setAttribute("role", "tablist");
    TABS.forEach(function (tab) {
      var b = el("button", "sp-drawer-tab" + (tab.plus ? " is-plus" : ""), tr(tab.label));
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("data-tab", tab.id);
      b.addEventListener("click", function () {
        activeTab = tab.id;
        renderBody();
      });
      tabs.appendChild(b);
    });
    root.appendChild(tabs);

    var foot = el("div", "sp-drawer-foot");
    var full = el("a", "sp-tb-settings");
    full.href = "#";
    full.innerHTML = ICON_EXTERNAL + "<span></span>";
    full.lastChild.textContent = tr("twitchUi.fullPage");
    full.addEventListener("click", function (e) {
      e.preventDefault();
      try {
        chrome.runtime.sendMessage({ type: "openSettings" });
      } catch (_e) {
        // Contexte d'extension invalidé : rien à ouvrir.
      }
    });
    foot.appendChild(full);
    root.appendChild(foot);
    return root;
  }

  function onKey(e) {
    if (e.key === "Escape") closeDrawer();
  }

  function openDrawer(tab) {
    if (tab) activeTab = tab;
    loadContext(function () {
      if (drawer) drawer.remove();
      drawer = build();
      document.body.appendChild(drawer);
      renderBody();
      // Lecture de mise en page forcée : la transition part même si l'onglet
      // est en arrière-plan, où requestAnimationFrame est suspendu.
      void drawer.offsetWidth;
      drawer.classList.add("is-open");
      document.addEventListener("keydown", onKey, true);
      var focusable = drawer.querySelector(".sp-drawer-tab.on");
      if (focusable) focusable.focus({ preventScroll: true });
    });
  }

  function closeDrawer() {
    if (!drawer) return;
    var node = drawer;
    drawer = null;
    document.removeEventListener("keydown", onKey, true);
    node.classList.remove("is-open");
    setTimeout(function () {
      node.remove();
    }, 220);
  }

  // Réglages modifiés ailleurs (popup, autre onglet) : l'affichage suit.
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local") return;
    if (!changes[PREFERENCES_KEY] && !changes[PLUS_KEY] && !changes[COSMETICS_KEY]) return;
    if (!drawer && !editors.length) return;
    loadContext(function () {
      paintSwitches();
      refreshEditors();
    });
  });

  loadContext();

  window.__SP_DRAWER__ = {
    open: openDrawer,
    close: closeDrawer,
    buildCosmetics: buildCosmetics,
    reload: function (done) {
      loadContext(function () {
        refreshEditors();
        if (done) done();
      });
    },
  };
})();
