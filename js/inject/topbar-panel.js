/**
 * StreamPulse : contenu du panneau de la topbar Twitch (monde isolé).
 *
 * Ce fichier ne construit que le DOM du panneau : il ne connaît ni son
 * positionnement, ni son cycle de vie, qui restent dans topbar.js. Il ne lit
 * rien lui-même : tout arrive par `state`, ce qui le rend testable et évite
 * que topbar.js continue de grossir.
 *
 * Expose `self.__SP_TOPBAR_PANEL__.build(state, deps)`.
 */
(function () {
  "use strict";

  var NS = typeof self !== "undefined" ? self : globalThis;
  var store = NS.__SP_TOPBAR_PANEL__ || (NS.__SP_TOPBAR_PANEL__ = {});

  // Au-delà, le panneau dépasserait la hauteur utile du menu déroulant Twitch.
  var MAX_LIVE = 5;

  /** Les interrupteurs qui agissent sur la page où l'on se trouve. */
  var CHANNEL_TOGGLES = [
    { key: "previewsEnabled", label: "previews" },
    { key: "autoClaimChannelPoints", label: "autoClaim" },
    { key: "enableFastForwardButton", label: "fastForward" },
  ];

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function toggleRow(key, label, on) {
    var row = el("button", "sp-tb-row");
    row.type = "button";
    row.setAttribute("data-sp-toggle", key);
    row.appendChild(el("span", null, label));
    row.appendChild(el("span", "sp-tb-sw" + (on ? " on" : "")));
    return row;
  }

  var BADGE_MODES = [
    { value: "author", label: "badgeAuthor" },
    { value: "theme", label: "badgeTheme" },
    { value: "custom", label: "badgeCustom" },
  ];

  /**
   * Couleur du badge de tchat : les trois modes du réglage, en compact.
   * Une couleur hexadécimale stockée signifie le mode personnalisé.
   */
  function badgeColorRow(state, deps) {
    var stored = state.prefs.communityBadgeColor || "author";
    var custom = stored !== "author" && stored !== "theme";

    var row = el("div", "sp-tb-badge-row");
    row.appendChild(el("span", "sp-tb-badge-label", deps.tr("badgeColor")));

    var group = el("div", "sp-tb-badge-modes");
    var picker = document.createElement("input");
    picker.type = "color";
    picker.className = "sp-tb-badge-picker";
    picker.value = custom ? stored : "#9147ff";
    picker.hidden = !custom;

    BADGE_MODES.forEach(function (mode) {
      var b = el("button", "sp-tb-badge-mode", deps.tr(mode.label));
      b.type = "button";
      var active = mode.value === "custom" ? custom : stored === mode.value;
      if (active) b.classList.add("on");
      b.addEventListener("click", function () {
        group.querySelectorAll(".sp-tb-badge-mode").forEach(function (o) {
          o.classList.remove("on");
        });
        b.classList.add("on");
        picker.hidden = mode.value !== "custom";
        deps.onToggle(
          "communityBadgeColor",
          mode.value === "custom" ? picker.value : mode.value
        );
      });
      group.appendChild(b);
    });

    // "change" et non "input" : le sélecteur émet en continu pendant le
    // glissement, ce qui écrirait la préférence à chaque pixel.
    picker.addEventListener("change", function () {
      deps.onToggle("communityBadgeColor", picker.value);
    });

    group.appendChild(picker);
    row.appendChild(group);
    return row;
  }

  /**
   * Section « cette chaîne » : absente hors d'une page de chaîne, plutôt que
   * d'afficher un bloc vide sur l'accueil ou le répertoire.
   */
  function channelSection(state, deps) {
    if (!state.channel) return null;

    var wrap = el("div", "sp-tb-section");
    wrap.appendChild(el("div", "sp-tb-section-title", deps.tr("thisChannel")));

    var head = el("div", "sp-tb-channel");
    head.appendChild(el("span", "sp-tb-channel-name", state.channel));

    if (state.channelWatchSeconds > 0) {
      var watched = el("span", "sp-tb-channel-time");
      watched.textContent = deps.fmtDur(state.channelWatchSeconds);
      watched.title = deps.tr("watchedHere");
      head.appendChild(watched);
    }

    var follow = el("button", "sp-tb-follow" + (state.channelTracked ? " tracked" : ""));
    follow.type = "button";
    follow.textContent = deps.tr(state.channelTracked ? "followed" : "follow");
    follow.disabled = !!state.channelTracked;
    if (!state.channelTracked) {
      follow.addEventListener("click", function () {
        follow.disabled = true;
        follow.textContent = deps.tr("followed");
        follow.classList.add("tracked");
        deps.addStreamer(state.channel);
      });
    }
    head.appendChild(follow);
    wrap.appendChild(head);

    CHANNEL_TOGGLES.forEach(function (item) {
      wrap.appendChild(
        toggleRow(item.key, deps.tr(item.label), state.prefs[item.key] !== false)
      );
    });
    wrap.appendChild(badgeColorRow(state, deps));

    return wrap;
  }

  /** Section « en direct » : les suivis actuellement en live, cliquables. */
  function liveSection(state, deps) {
    var wrap = el("div", "sp-tb-section");
    wrap.appendChild(el("div", "sp-tb-section-title", deps.tr("liveNow")));

    var live = state.live || [];
    if (!live.length) {
      wrap.appendChild(el("div", "sp-tb-empty", deps.tr("noneLive")));
      return wrap;
    }

    live.slice(0, MAX_LIVE).forEach(function (entry) {
      var row = el("button", "sp-tb-live");
      row.type = "button";

      var avatar = el("span", "sp-tb-live-av");
      if (entry.avatarUrl) {
        var img = document.createElement("img");
        img.src = entry.avatarUrl;
        img.alt = "";
        avatar.appendChild(img);
      } else {
        avatar.textContent = (entry.name || "?").charAt(0).toUpperCase();
      }
      row.appendChild(avatar);

      var meta = el("span", "sp-tb-live-meta");
      meta.appendChild(el("span", "sp-tb-live-name", entry.name));
      if (entry.category) meta.appendChild(el("span", "sp-tb-live-cat", entry.category));
      row.appendChild(meta);

      row.addEventListener("click", function () {
        deps.openChannel(entry.login);
      });
      wrap.appendChild(row);
    });

    if (live.length > MAX_LIVE) {
      var more = el("button", "sp-tb-more");
      more.type = "button";
      more.textContent = deps.tr("more").replace("{{count}}", live.length - MAX_LIVE);
      more.addEventListener("click", deps.openSettings);
      wrap.appendChild(more);
    }

    return wrap;
  }

  /**
   * @param {object} state  { points, watchSeconds, prefs, channel, channelTracked,
   *                          channelWatchSeconds, live: [{login,name,category,avatarUrl}] }
   * @param {object} deps   { tr, fmtNum, fmtDur, logoUrl, tipUrl, icon,
   *                          addStreamer, openChannel, openSettings, onToggle }
   */
  function build(state, deps) {
    var p = el("div", "sp-topbar-panel");
    p.id = "sp-topbar-panel";

    var head = el("div", "sp-tb-head");
    var logo = document.createElement("img");
    logo.className = "sp-tb-logo";
    logo.alt = "";
    logo.src = deps.logoUrl;
    head.appendChild(logo);
    head.appendChild(el("span", null, "StreamPulse"));
    p.appendChild(head);

    var stats = el("div", "sp-tb-stats");
    stats.innerHTML =
      '<div class="sp-tb-stat">' + deps.icon.gem + "<b>" + deps.fmtNum(state.points) + "</b></div>" +
      '<div class="sp-tb-stat">' + deps.icon.clock + "<b>" + deps.fmtDur(state.watchSeconds) + "</b></div>";
    p.appendChild(stats);

    var channel = channelSection(state, deps);
    if (channel) p.appendChild(channel);
    p.appendChild(liveSection(state, deps));

    // Le panneau n'offrait que Revolut, la ou le popup laisse le choix.
    var tip = el("div", "sp-tb-tip-block");
    var tipLabel = el("div", "sp-tb-tip-label");
    tipLabel.innerHTML = deps.icon.coffee + "<span>" + deps.tr("tip") + "</span>";
    tip.appendChild(tipLabel);

    var tipLinks = el("div", "sp-tb-tip-links");
    deps.tipLinks.forEach(function (link) {
      var a = el("a", "sp-tb-tip-link", link.label);
      a.href = link.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      tipLinks.appendChild(a);
    });
    tip.appendChild(tipLinks);
    p.appendChild(tip);

    var settings = el("a", "sp-tb-settings");
    settings.href = "#";
    settings.innerHTML = deps.icon.gear + "<span>" + deps.tr("settings") + "</span>";
    settings.addEventListener("click", function (e) {
      e.preventDefault();
      deps.openSettings();
    });
    p.appendChild(settings);

    // Un seul écouteur pour tous les interrupteurs de la section chaîne.
    Array.prototype.forEach.call(p.querySelectorAll("[data-sp-toggle]"), function (row) {
      row.addEventListener("click", function () {
        var sw = row.querySelector(".sp-tb-sw");
        var next = !sw.classList.contains("on");
        sw.classList.toggle("on", next);
        deps.onToggle(row.getAttribute("data-sp-toggle"), next);
      });
    });

    return p;
  }

  store.build = build;
  store.MAX_LIVE = MAX_LIVE;
})();
