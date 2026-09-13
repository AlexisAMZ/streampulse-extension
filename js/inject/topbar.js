/**
 * StreamPulse: Twitch top-bar button + control panel (isolated world).
 *
 * Injects a StreamPulse button into the Twitch top-nav icon row (next to bits /
 * whispers / notifications, the way 7TV does), re-injecting on SPA re-renders via a
 * MutationObserver. Clicking it opens a control panel: ads-blocked / points / watch
 * time stats, quick toggles (ad blocker, hover previews), a Bubble Tea donation
 * button, and a link to the full settings.
 *
 * The icon row is located by the lowest common ancestor of stable anchors
 * (data-a-target on bits/whispers), never by Twitch's hashed CSS classes.
 */
(function () {
  "use strict";

  // ---- pure helpers (exposed for unit tests) -------------------------------
  function fmtNum(n) {
    try {
      return Number(n || 0).toLocaleString();
    } catch (_e) {
      return String(n || 0);
    }
  }
  function fmtDur(totalSeconds) {
    var s = Number(totalSeconds) || 0;
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    if (h > 0) return h + "h" + (m > 0 ? String(m).padStart(2, "0") : "");
    return m + "min";
  }
  // Sum the current month's watchSeconds from betaWatchTimeData.
  function currentMonthWatch(data, now) {
    try {
      var d = now || new Date();
      var key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      var month = (data && data[key]) || {};
      var total = 0;
      for (var k in month) {
        if (month[k] && typeof month[k].watchSeconds === "number") total += month[k].watchSeconds;
      }
      return total;
    } catch (_e) {
      return 0;
    }
  }

  // Les chaînes vivent dans i18n/translations.js (clés inject.topbar.*) et sont
  // exposées ici par js/inject/i18n-inline.js, chargé avant ce script. Les
  // content scripts étant injectés en scripts classiques, ils ne peuvent pas
  // importer le module ES directement.
  function i18n() {
    return typeof window !== "undefined" ? window.__SP_I18N__ : null;
  }

  function langKey(l) {
    var api = i18n();
    return api ? api.resolve(l) : "en";
  }

  /**
   * Lit une clé inject.topbar.*, avec repli sur l'anglais puis sur la clé.
   * Nommée `tr` et non `t` : ce fichier utilise déjà `var t` pour des noeuds
   * DOM (onDocClick), et le var local masquerait la fonction.
   */
  function tr(lang, key) {
    var api = i18n();
    if (!api) return key;
    return api.get(api.resolve(lang), "topbar." + key);
  }

  try {
    var NS = typeof self !== "undefined" ? self : globalThis;
    NS.__SP_TOPBAR_API__ = { fmtNum: fmtNum, fmtDur: fmtDur, currentMonthWatch: currentMonthWatch, langKey: langKey };
  } catch (_e) {
    // globalThis peut etre fige selon le contexte d'injection : l'API reste alors locale au script.
  }

  // ---- browser-only from here ----------------------------------------------
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof chrome === "undefined" ||
    !chrome.runtime ||
    !chrome.runtime.getURL
  )
    return;
  if (window.top !== window) return;
  if (window.__SP_TOPBAR_INSTALLED__) return;
  window.__SP_TOPBAR_INSTALLED__ = true;

  var LOGO_URL = chrome.runtime.getURL("images/photos/logosp.png");
  // Memes destinations que la carte de soutien du popup.
  var TIP_LINKS = [
    { label: "Revolut", url: "https://revolut.me/alexisamz" },
    { label: "PayPal", url: "https://paypal.me/alexisamzdcrz" },
  ];
  var PREFERENCES_KEY = "betaGeneralPreferences";

  // Les segments de premier niveau qui ne sont pas des chaines.
  var NOT_CHANNELS = [
    "directory", "videos", "downloads", "prime", "turbo", "subscriptions",
    "inventory", "wallet", "settings", "friends", "messages", "search", "p", "u",
  ];

  /** Login de la chaine affichee, ou "" hors d'une page de chaine. */
  function currentChannel() {
    try {
      var parts = location.pathname.split("/").filter(Boolean);
      if (parts.length !== 1) return "";
      var login = parts[0].toLowerCase();
      if (NOT_CHANNELS.indexOf(login) !== -1) return "";
      return /^[a-z0-9_]{3,25}$/.test(login) ? login : "";
    } catch (_e) {
      return "";
    }
  }

  /** Secondes passees sur une chaine ce mois-ci. */
  function channelWatch(data, login) {
    try {
      var now = new Date();
      var key = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
      var month = (data && data[key]) || {};
      var entry = month["twitch:" + login];
      return (entry && entry.watchSeconds) || 0;
    } catch (_e) {
      return 0;
    }
  }

  // Inline SVG icons (Feather style, inherit color via currentColor).
  function svg(body) {
    return (
      '<svg class="sp-tb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + body + "</svg>"
    );
  }
  var ICON = {
    gem: svg('<polygon points="12 2 19 9 12 22 5 9"/><line x1="5" y1="9" x2="19" y2="9"/>'),
    clock: svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    coffee: svg(
      '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>' +
        '<line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>'
    ),
    gear: svg(
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
    ),
  };

  // ---- locate the top-nav icon row -----------------------------------------
  function lca(a, b) {
    if (!a || !b) return null;
    var set = new Set();
    var n = b;
    while (n) {
      set.add(n);
      n = n.parentElement;
    }
    n = a;
    while (n) {
      if (set.has(n)) return n;
      n = n.parentElement;
    }
    return null;
  }
  // direct child of `row` that contains `el` (or null)
  function directChildOf(row, el) {
    if (!row || !el) return null;
    var x = el;
    while (x && x.parentElement && x.parentElement !== row) x = x.parentElement;
    return x && x.parentElement === row ? x : null;
  }
  function findRow() {
    var bits = document.querySelector('[data-a-target="top-nav-get-bits-button"]');
    var whisp = document.querySelector('[data-a-target="threads-box-closed"]');
    var notif =
      document.querySelector('[data-a-target="top-nav-notifications-toggle"]') ||
      document.querySelector('[aria-label="Open Notifications"]');
    var profile = document.querySelector('[data-a-target="user-menu-toggle"]');
    var a = profile || notif || bits;
    var b = bits || notif || whisp;
    var row = a && b && a !== b ? lca(a, b) : null;
    if (!row) {
      var any = profile || notif || bits || whisp;
      if (any) {
        var w = any;
        // climb to a parent that holds several icon wrappers
        for (var i = 0; i < 6 && w && w.parentElement; i++) {
          if (w.parentElement.children.length >= 3) {
            row = w.parentElement;
            break;
          }
          w = w.parentElement;
        }
      }
    }
    // Anchor to the LEFT of the profile avatar: insert before the profile's
    // direct-child wrapper. Fall back to the notifications wrapper. We never
    // append at the end: that lands the button to the RIGHT of the profile
    // (the intermittent bug being fixed).
    var ref = directChildOf(row, profile) || directChildOf(row, notif);
    return { row: row, ref: ref };
  }

  // ---- state ---------------------------------------------------------------
  function loadState(cb) {
    var channel = currentChannel();
    try {
      chrome.storage.local.get(
        [PREFERENCES_KEY, "betaGeneralStats", "betaWatchTimeData"],
        function (r) {
          r = r || {};
          var prefs = r[PREFERENCES_KEY] || {};
          var watchData = r.betaWatchTimeData || {};
          var base = {
            points: stats(r).channelPointsClaimed || 0,
            watchSeconds: currentMonthWatch(watchData),
            prefs: prefs,
            previewsEnabled: prefs.previewsEnabled !== false,
            lang: langKey(prefs.language),
            channel: channel,
            channelWatchSeconds: channel ? channelWatch(watchData, channel) : 0,
            channelTracked: false,
            live: [],
          };

          // La liste des suivis vit cote service worker : sans reponse, on
          // affiche quand meme le panneau plutot que rien.
          try {
            chrome.runtime.sendMessage({ type: "getStreamers" }, function (resp) {
              if (chrome.runtime.lastError || !resp) return cb(base);
              cb(withStreamers(base, resp, channel));
            });
          } catch (_e) {
            cb(base);
          }
        }
      );
    } catch (_e) {
      cb(null);
    }
  }

  function stats(r) {
    return r.betaGeneralStats || {};
  }

  /** Complete l'etat avec le suivi de la chaine courante et les lives. */
  function withStreamers(base, resp, channel) {
    var streamers = resp.streamers || [];
    var statuses = resp.statuses || {};
    var live = [];

    for (var i = 0; i < streamers.length; i++) {
      var s = streamers[i];
      var handle = String(s.handle || s.login || "").toLowerCase();
      if (channel && handle === channel) base.channelTracked = true;

      var st = statuses[s.id] || statuses[handle] || {};
      if (!st.isLive) continue;
      live.push({
        login: handle,
        name: s.displayName || s.handle || handle,
        category: st.gameName || st.category || "",
        avatarUrl: s.avatarUrl || st.avatarUrl || "",
      });
    }

    base.live = live;
    return base;
  }

  function updatePref(key, val) {
    try {
      var u = {};
      u[key] = val;
      chrome.runtime.sendMessage({ type: "updatePreferences", updates: u });
    } catch (_e) {
      // Ecriture de preference opportuniste : son echec ne doit pas casser le panneau.
    }
  }

  // ---- panel ---------------------------------------------------------------
  var panelEl = null;

  function closePanel() {
    if (panelEl) {
      try {
        panelEl.remove();
      } catch (_e) {
        // Twitch reconstruit son DOM en permanence : le noeud peut disparaitre entre sa selection et son usage.
      }
      panelEl = null;
    }
    document.removeEventListener("click", onDocClick, true);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", closePanel);
  }
  function onDocClick(e) {
    if (!panelEl) return;
    var t = e.target;
    if (panelEl.contains(t)) return;
    if (t && t.closest && t.closest("#sp-topbar-btn")) return;
    closePanel();
  }
  function onKey(e) {
    if (e.key === "Escape") closePanel();
  }
  function positionPanel(p, btn) {
    var r = btn.getBoundingClientRect();
    p.style.top = r.bottom + 8 + "px";
    p.style.right = Math.max(8, window.innerWidth - r.right) + "px";
  }

  function buildPanel(st) {
    st = st || {};
    var lang = langKey(st.lang);
    var panel = NS_PANEL();
    if (!panel) return document.createElement("div");

    return panel.build(
      {
        points: st.points,
        watchSeconds: st.watchSeconds,
        prefs: st.prefs || {},
        channel: st.channel,
        channelTracked: st.channelTracked,
        channelWatchSeconds: st.channelWatchSeconds,
        live: st.live,
      },
      {
        tr: function (key) {
          return tr(lang, key);
        },
        fmtNum: fmtNum,
        fmtDur: fmtDur,
        logoUrl: LOGO_URL,
        tipLinks: TIP_LINKS,
        icon: ICON,
        onToggle: updatePref,
        addStreamer: function (login) {
          try {
            chrome.runtime.sendMessage({ type: "addStreamer", platform: "twitch", handle: login });
          } catch (_e) {
            // Service worker endormi, ou contexte d'extension invalide par une mise a jour : le message est perdu sans consequence ici.
          }
        },
        openChannel: function (login) {
          location.href = "https://www.twitch.tv/" + login;
        },
        openSettings: function () {
          try {
            chrome.runtime.sendMessage({ type: "openSettings" });
          } catch (_e) {
            // Service worker endormi, ou contexte d'extension invalide par une mise a jour : le message est perdu sans consequence ici.
          }
          closePanel();
        },
      }
    );
  }

  function NS_PANEL() {
    var ns = typeof self !== "undefined" ? self : globalThis;
    return ns.__SP_TOPBAR_PANEL__ || null;
  }

  function togglePanel(btn) {
    if (panelEl) {
      closePanel();
      return;
    }
    loadState(function (st) {
      panelEl = buildPanel(st);
      document.body.appendChild(panelEl);
      positionPanel(panelEl, btn);
      setTimeout(function () {
        document.addEventListener("click", onDocClick, true);
        document.addEventListener("keydown", onKey, true);
        window.addEventListener("resize", closePanel);
      }, 0);
    });
  }

  // ---- button injection ----------------------------------------------------
  function injectButton() {
    var f = findRow();
    // Require a valid left-of-profile anchor before inserting. If it's not in
    // the DOM yet (Twitch still rendering), bail and let the observer retry:
    // never insert without a ref, which would land the button at the far right.
    if (!f.row || !f.ref) return false;
    if (f.row.querySelector("#sp-topbar-btn")) return true;
    var wrap = document.createElement("div");
    wrap.className = "sp-topbar-wrap";
    var btn = document.createElement("button");
    btn.id = "sp-topbar-btn";
    btn.className = "sp-topbar-btn";
    btn.type = "button";
    btn.title = "StreamPulse";
    btn.setAttribute("aria-label", "StreamPulse");
    var img = document.createElement("img");
    img.className = "sp-topbar-logo";
    img.alt = "StreamPulse";
    img.src = LOGO_URL;
    btn.appendChild(img);
    wrap.appendChild(btn);
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      togglePanel(btn);
    });
    f.row.insertBefore(wrap, f.ref);
    return true;
  }

  function ensure() {
    try {
      if (!document.getElementById("sp-topbar-btn")) injectButton();
    } catch (_e) {
      // Twitch reconstruit son DOM en permanence : le noeud peut disparaitre entre sa selection et son usage.
    }
  }

  // Re-inject on Twitch's SPA re-renders (debounced).
  var moTimer = null;
  var mo = new MutationObserver(function () {
    if (moTimer) return;
    moTimer = setTimeout(function () {
      moTimer = null;
      if (!document.getElementById("sp-topbar-btn")) {
        if (panelEl) closePanel();
        ensure();
      }
    }, 500);
  });
  try {
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (_e) {
    // documentElement disparait pendant une navigation : l'observateur sera repose au passage suivant.
  }

  ensure();
})();
