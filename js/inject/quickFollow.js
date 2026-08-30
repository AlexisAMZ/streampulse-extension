/**
 * StreamPulse — "Add to StreamPulse" button on Twitch channel pages.
 *
 * Renders a standalone, branded pill (logo + label) in the channel action row,
 * next to Twitch's own Follow / Subscribe controls, so a streamer can be tracked
 * without opening the popup. The button also doubles as an indicator: when the
 * channel is already tracked it switches to a filled "tracked" state.
 *
 * Design notes:
 *  - Deliberately NOT glued to Twitch's Follow button. We anchor to the action
 *    row and append at the end, so a Twitch re-order of its own controls can
 *    never leave our button orphaned mid-row.
 *  - Label text is driven by the extension language preference, mirroring
 *    topbar.js (same 4 locales, same base-subtag fallback).
 *  - Isolated world, plain script (no modules): strings are inlined rather than
 *    imported from i18n/translations.js, which is an ES module.
 */
(function () {
  "use strict";

  // Opt-in tracing, read BEFORE the early-return guards below. Enable with
  // `localStorage.SP_DEBUG = "1"` on twitch.tv, then reload the page (the flag
  // is only read at script start). Declared first on purpose: if a guard bails,
  // we still need to know which one, otherwise a silent exit is impossible to
  // tell apart from the script never running.
  var DEBUG = false;
  try {
    DEBUG = localStorage.getItem("SP_DEBUG") === "1";
  } catch (_e) {}

  function log() {
    if (!DEBUG) return;
    try {
      var args = ["[SP-QF]"].concat(Array.prototype.slice.call(arguments));
      console.log.apply(console, args);
    } catch (_e) {}
  }

  log("boot", location.pathname);

  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.getURL) {
    log("bail: chrome.runtime unavailable");
    return;
  }
  if (window.top !== window) {
    log("bail: not top frame");
    return;
  }
  if (window.__SP_QUICKFOLLOW_INSTALLED__) {
    log("bail: already installed (double injection)");
    return;
  }
  window.__SP_QUICKFOLLOW_INSTALLED__ = true;

  var BTN_ID = "sp-channel-add-btn";
  var STREAMERS_KEY = "betaGeneralStreamers";
  var PREFERENCES_KEY = "betaGeneralPreferences";
  var LOGO_URL = chrome.runtime.getURL("images/photos/logosp.png");

  // Twitch routes whose first path segment is a feature, not a channel login.
  var NON_CHANNEL_ROUTES = [
    "directory", "settings", "drops", "downloads", "subscriptions", "wallet",
    "inventory", "friends", "u", "videos", "search", "prime", "turbo", "store",
    "jobs", "p", "moderator", "popout", "team", "communities", "payments",
    "following", "dashboard", "activate", "collections", "products", "broadcast",
    "creatorcamp", "bits", "login", "signup", "logout",
  ];

  var currentLang = "en";
  var trackedSet = new Set();
  var busy = false;
  // Tant que la liste suivie n'a pas été lue, l'état du bouton est INCONNU.
  // Peindre « Ajouter » dans cet intervalle affiche un mensonge sur une chaîne
  // déjà suivie, puis bascule en gris : c'est le clignotement d'état.
  var trackedReady = false;

  /**
   * Résout la préférence stockée ("pt_BR", "EN", "de-DE") vers une langue
   * disponible. Délègue au helper partagé, qui gère l'étiquette complète puis
   * la sous-étiquette de base — l'ancienne version tronquait d'office sur le
   * tiret et confondait donc pt-BR avec pt.
   */
  function langKey(value) {
    var api = typeof window !== "undefined" ? window.__SP_I18N__ : null;
    return api ? api.resolve(value) : "en";
  }

  /**
   * Lit une clé inject.quickFollow.*.
   * Les chaînes vivent dans i18n/translations.js et sont exposées par
   * js/inject/i18n-inline.js, chargé avant ce script.
   */
  function t(key, params) {
    var api = typeof window !== "undefined" ? window.__SP_I18N__ : null;
    if (!api) return key;
    return api.get(currentLang, "quickFollow." + key, params);
  }

  function getCurrentChannel() {
    try {
      var segment = (location.pathname.replace(/^\//, "").split("/")[0] || "").toLowerCase();
      if (!segment) return "";
      if (NON_CHANNEL_ROUTES.indexOf(segment) !== -1) return "";
      // Twitch logins are 1-25 chars; the old 3-char floor rejected short ones.
      if (!/^[a-z0-9_]{1,25}$/.test(segment)) return "";
      return segment;
    } catch (_e) {
      return "";
    }
  }

  function isTracked(handle) {
    return Boolean(handle) && trackedSet.has(handle.toLowerCase());
  }

  /**
   * Login Twitch d'une entrée stockée, ou "" si elle vise une autre plateforme.
   *
   * Reprend les mêmes replis que normalizeStreamer() côté background : une
   * entrée écrite par une ancienne version n'a ni `platform` ni `handle`, juste
   * `twitch`. L'ancien test `s.platform === "twitch" && s.handle` la rejetait,
   * et le bouton repassait en « Ajouter » sur une chaîne pourtant suivie.
   */
  function entryHandle(entry) {
    if (!entry) return "";
    // Le background applique DEFAULT_PLATFORM = "twitch" quand le champ manque.
    var platform = entry.platform || "twitch";
    if (platform !== "twitch") return "";
    var handle = entry.handle || entry.twitch || entry.login || entry.username || "";
    return String(handle).toLowerCase();
  }

  function setTrackedFromList(streamers) {
    var next = new Set();
    (streamers || []).forEach(function (s) {
      var handle = entryHandle(s);
      if (handle) next.add(handle);
    });
    trackedSet = next;
  }

  // ---- messaging -----------------------------------------------------------
  function send(message) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(message, function (res) {
          if (chrome.runtime.lastError) resolve(null);
          else resolve(res || null);
        });
      } catch (_e) {
        resolve(null);
      }
    });
  }

  /**
   * Liste suivie, lue directement dans chrome.storage.local.
   *
   * L'ancienne version passait par un message « getStreamers » au service
   * worker. En MV3 ce worker s'endort : le message échoue alors avec
   * chrome.runtime.lastError, send() résout null, et le null devenait une liste
   * VIDE — donc « aucune chaîne suivie », donc le bouton violet « Ajouter » sur
   * une chaîne déjà suivie, sans jamais retenter. Le stockage répond toujours,
   * worker endormi ou non, et c'est déjà la source unique de getStreamers().
   */
  function fetchTrackedStreamers() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get([STREAMERS_KEY], function (res) {
          if (chrome.runtime.lastError) resolve(null);
          else resolve((res && res[STREAMERS_KEY]) || []);
        });
      } catch (_e) {
        resolve(null);
      }
    });
  }

  function addStreamer(handle) {
    return send({ type: "addStreamer", platform: "twitch", handle }).then(function (res) {
      return Boolean(res && !res.error);
    });
  }

  function removeStreamer(handle) {
    // The background removes by `id`, so resolve the entry first.
    return fetchTrackedStreamers().then(function (streamers) {
      // null = lecture impossible. Traiter ce cas comme « liste vide » faisait
      // répondre « introuvable » et affichait un toast d'erreur sur un bouton
      // pourtant légitime.
      if (!streamers) return false;
      var wanted = handle.toLowerCase();
      var match = null;
      for (var i = 0; i < streamers.length; i++) {
        if (entryHandle(streamers[i]) === wanted) {
          match = streamers[i];
          break;
        }
      }
      if (!match || !match.id) return false;
      return send({ type: "removeStreamer", id: match.id }).then(function (res) {
        return Boolean(res && !res.error);
      });
    });
  }

  // ---- toast ---------------------------------------------------------------
  var toastTimer = null;
  function showToast(message) {
    try {
      var existing = document.getElementById("sp-qf-toast");
      if (existing) existing.remove();
      if (toastTimer) clearTimeout(toastTimer);

      var toast = document.createElement("div");
      toast.id = "sp-qf-toast";
      toast.className = "sp-qf-toast";

      var logo = document.createElement("img");
      logo.className = "sp-qf-toast-logo";
      logo.alt = "";
      logo.src = LOGO_URL;

      var label = document.createElement("span");
      label.textContent = message;

      toast.appendChild(logo);
      toast.appendChild(label);
      document.body.appendChild(toast);

      requestAnimationFrame(function () {
        toast.classList.add("show");
      });

      toastTimer = setTimeout(function () {
        toast.classList.remove("show");
        setTimeout(function () {
          if (toast.parentNode) toast.remove();
        }, 220);
      }, 2400);
    } catch (_e) {}
  }

  // ---- button --------------------------------------------------------------
  function renderState(btn, handle) {
    var tracked = isTracked(handle);
    var labelEl = btn.querySelector(".sp-qf-label");

    btn.classList.toggle("is-tracked", tracked);
    btn.setAttribute("aria-pressed", tracked ? "true" : "false");
    // Visible label stays short; the accessible/tooltip text states the action.
    if (labelEl) labelEl.textContent = tracked ? t("tracked") : t("add");
    btn.title = tracked ? t("remove") : t("add");
    btn.setAttribute("aria-label", tracked ? t("remove") : t("add"));
  }

  function onClick(e, btn, handle) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    busy = true;
    btn.disabled = true;
    btn.classList.add("is-busy");

    var wasTracked = isTracked(handle);
    var action = wasTracked ? removeStreamer(handle) : addStreamer(handle);

    action
      .then(function (ok) {
        if (!ok) {
          showToast(t("error"));
          return;
        }
        // Optimistic local update; the storage listener reconciles the truth.
        if (wasTracked) trackedSet.delete(handle.toLowerCase());
        else trackedSet.add(handle.toLowerCase());
        showToast(t(wasTracked ? "removed" : "added", { name: handle }));
      })
      .catch(function () {
        showToast(t("error"));
      })
      .then(function () {
        busy = false;
        btn.disabled = false;
        btn.classList.remove("is-busy");
        renderState(btn, handle);
      });
  }

  // 7TV injects its own controls into the same channel action row. We must not
  // land inside its subtree, nor react to its mutations, or the two extensions
  // fight over the same container.
  // NOTE: the previous version also matched [class*="ffz"], which is unsafe.
  // Twitch's styled-components emit generated atom classes, and a bare "ffz"
  // substring can appear inside one, causing us to reject legitimate Twitch
  // nodes and abort injection. Match FFZ only on its real, prefixed hooks.
  var THIRD_PARTY_SELECTOR = [
    '[class*="seventv"]',
    '[id*="seventv"]',
    ".seventv-container",
    "#seventv-message-container",
    '[class^="ffz-"]',
    '[class*=" ffz-"]',
    '[id^="ffz-"]',
  ].join(", ");

  /**
   * Is this node owned by 7TV / FFZ?
   *
   * Deliberately a BOUNDED upward walk, not `closest()`. 7TV tags a high-level
   * container near <body>, so `closest()` (which climbs to the document root)
   * reported every node on the page as third-party and made us refuse to inject
   * anywhere. We only care about a third-party wrapper sitting immediately
   * around the control, so a few levels are enough.
   */
  var THIRD_PARTY_MAX_DEPTH = 5;

  function isThirdParty(node) {
    try {
      if (!node || !node.matches) return false;
      var n = node;
      for (var i = 0; i <= THIRD_PARTY_MAX_DEPTH; i++) {
        if (!n || n === document.body || n === document.documentElement) return false;
        if (n.matches(THIRD_PARTY_SELECTOR)) {
          log("third-party node:", n.tagName, n.className);
          return true;
        }
        n = n.parentElement;
      }
      return false;
    } catch (_e) {
      return false;
    }
  }

  /** Lowest common ancestor of two nodes, or null. Mirrors topbar.js. */
  function lca(a, b) {
    if (!a || !b) return null;
    var n = a;
    while (n) {
      if (n.contains && n.contains(b)) return n;
      n = n.parentElement;
    }
    return null;
  }

  /** Direct child of `row` that contains `el` (or null). Mirrors topbar.js. */
  function directChildOf(row, el) {
    if (!row || !el) return null;
    var x = el;
    while (x && x.parentElement && x.parentElement !== row) x = x.parentElement;
    return x && x.parentElement === row ? x : null;
  }

  /**
   * Resolve where to insert: to the LEFT of Twitch's Follow / Unfollow control.
   *
   * Twitch swaps `follow-button` for `unfollow-button` once you follow a
   * channel, so both must be matched or the button vanishes for every channel
   * the user already follows.
   *
   * The label carries a styled-components class like
   * "ScCoreButtonLabel-sc-s7h2b7-0 bfhate". Only the "ScCoreButtonLabel" prefix
   * is stable — the `sc-*` hash and the atom class are regenerated on every
   * Twitch build — and even that is scoped to the channel header here, so we
   * never grab an unrelated button from the top nav.
   *
   * @returns {{row: Element, ref: Element}|null} ref is the node to insert before.
   */
  function findAnchor() {
    var follow =
      document.querySelector('[data-a-target="follow-button"]') ||
      document.querySelector('[data-a-target="unfollow-button"]');
    var sub =
      document.querySelector('[data-a-target="subscribe-button"]') ||
      document.querySelector('[data-a-target="prime-offer-button"]');

    log("anchors", { follow: !!follow, sub: !!sub });

    // Preferred path: two independent controls in the same action row give us
    // their real container via LCA, with no blind parent climbing.
    var row = null;
    var ref = null;

    if (follow && sub && follow !== sub) {
      row = lca(follow, sub);
      ref = directChildOf(row, follow) || directChildOf(row, sub);
    }

    // Single control present: climb only until the parent has siblings, which
    // is by definition the action row.
    if (!row || !ref) {
      var solo = follow || sub;
      if (solo) {
        var x = solo;
        for (var i = 0; i < 8 && x && x.parentElement; i++) {
          if (x.parentElement.children.length > 1) {
            row = x.parentElement;
            ref = x;
            break;
          }
          x = x.parentElement;
        }
      }
    }

    if (!row || !ref) {
      log("no anchor resolved");
      return null;
    }
    if (isThirdParty(row) || isThirdParty(ref)) {
      log("anchor rejected as third-party", {
        row: isThirdParty(row),
        ref: isThirdParty(ref),
      });
      return null;
    }
    if (row === document.body || row === document.documentElement) {
      log("anchor escalated to body, rejected");
      return null;
    }

    log("anchor ok", { row: row.className, ref: ref.className });
    return { row: row, ref: ref };
  }

  function buildButton(handle) {
    var btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.className = "sp-qf-btn";
    btn.type = "button";

    var logo = document.createElement("img");
    logo.className = "sp-qf-logo";
    logo.alt = "";
    logo.src = LOGO_URL;

    var label = document.createElement("span");
    label.className = "sp-qf-label";

    btn.appendChild(logo);
    btn.appendChild(label);

    btn.addEventListener("click", function (e) {
      onClick(e, btn, handle);
    });

    renderState(btn, handle);
    return btn;
  }

  // ---- adaptation a la largeur disponible -----------------------------------
  // Mesuré sur twitch.tv : à 960 px de viewport, le bouton complet (187 px +
  // 8 px de marge) fait déborder le bloc d'actions de 51 px hors de sa colonne
  // et « S'abonner » passe sous le rail de droite ; à 900 px le débordement
  // atteint 111 px. Aucun flex-shrink ne corrige ça : la ligne de Twitch est en
  // `min-width: auto`, donc elle ne se comprime pas, elle déborde. Il faut
  // retirer de la largeur, pas en redistribuer.
  var FIT_MAX_DEPTH = 6;

  /** Un ancêtre proche du bouton dépasse-t-il hors de son parent ? */
  function overflowsAncestor(node) {
    var n = node;
    for (var i = 0; i < FIT_MAX_DEPTH && n && n.parentElement; i++) {
      var self = n.getBoundingClientRect();
      var parent = n.parentElement.getBoundingClientRect();
      // 1 px de tolérance : les rects Twitch sont fractionnaires.
      if (self.right > parent.right + 1) return true;
      n = n.parentElement;
    }
    return false;
  }

  /**
   * Replie le bouton sur son logo seul quand le libellé ne tient plus.
   *
   * Le repli n'est conservé que s'il résout effectivement le débordement :
   * si la ligne déborde aussi sans notre libellé, la cause n'est pas la nôtre
   * et masquer le texte ne ferait que dégrader le bouton pour rien.
   */
  function fitButton(btn) {
    try {
      // On lit AVANT de toucher aux classes. Le MutationObserver rappelle
      // ensure() toutes les 400 ms : muter d'abord forcerait un reflow à chaque
      // passage, y compris sur un écran large où il n'y a rien à décider.
      if (btn.classList.contains("is-compact")) btn.classList.remove("is-compact");
      if (!overflowsAncestor(btn)) return;
      btn.classList.add("is-compact");
      if (overflowsAncestor(btn)) btn.classList.remove("is-compact");
    } catch (_e) {}
  }

  var lastChannel = null;

  /** Remove the button along with its .sp-qf-wrap parent, so SPA navigation
   *  doesn't leave orphaned empty wrappers behind in Twitch's action row. */
  function removeButton(btn) {
    if (!btn) return;
    var wrap = btn.parentElement;
    if (wrap && wrap.classList && wrap.classList.contains("sp-qf-wrap")) wrap.remove();
    else btn.remove();
  }

  function ensure() {
    try {
      var handle = getCurrentChannel();

      // SPA navigation: reset the retry budget so a new channel gets a full
      // window to render, instead of inheriting an exhausted counter.
      if (handle !== lastChannel) {
        log("channel changed", lastChannel, "->", handle);
        lastChannel = handle;
        clearRetry();
      }

      var existing = document.getElementById(BTN_ID);

      // Left a channel page (directory, settings, ...): remove the button.
      if (!handle) {
        removeButton(existing);
        return;
      }

      // ensure() est appelé dès la fin du script et par le MutationObserver,
      // donc potentiellement avant la lecture du stockage. Sans cette garde le
      // bouton naissait en « Ajouter » puis basculait en gris une fois la liste
      // arrivée. Mieux vaut l'afficher 20 ms plus tard que faux.
      if (!trackedReady) return;

      // SPA navigation to another channel: rebind to the new login.
      if (existing && existing.dataset.spChannel !== handle) {
        removeButton(existing);
        existing = null;
      }

      if (existing) {
        // Le libellé change de largeur entre « Ajouter… » et « Suivi », donc le
        // calcul de place doit être refait à chaque rendu, pas seulement à
        // l'insertion.
        renderState(existing, handle);
        fitButton(existing);
        return;
      }

      var anchor = findAnchor();
      if (!anchor) {
        // Twitch is still rendering the channel header. The MutationObserver
        // catches most cases, but it goes quiet once the SPA settles, so a
        // bounded poll guarantees we land even if we missed the last mutation.
        scheduleRetry();
        return;
      }
      clearRetry();

      var btn = buildButton(handle);
      btn.dataset.spChannel = handle;

      var wrap = document.createElement("div");
      wrap.className = "sp-qf-wrap";
      wrap.appendChild(btn);
      // Sit to the LEFT of Twitch's Follow / Subscribe control.
      anchor.row.insertBefore(wrap, anchor.ref);
      fitButton(btn);
      log("button injected for", handle);
    } catch (e) {
      log("ensure() threw", e);
    }
  }

  // ---- bounded retry -------------------------------------------------------
  var retryTimer = null;
  var retryCount = 0;
  var MAX_RETRIES = 40; // ~20s at 500ms, then we stop burning cycles.

  function clearRetry() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    retryCount = 0;
  }

  function scheduleRetry() {
    if (retryTimer || retryCount >= MAX_RETRIES) return;
    retryCount++;
    retryTimer = setTimeout(function () {
      retryTimer = null;
      ensure();
    }, 500);
  }

  // ---- state wiring --------------------------------------------------------
  chrome.storage.local.get([PREFERENCES_KEY, STREAMERS_KEY], function (res) {
    var data = res || {};
    currentLang = langKey((data[PREFERENCES_KEY] || {}).language);
    setTrackedFromList(data[STREAMERS_KEY]);
    // Même si la lecture échoue, on débloque : un bouton figé indéfiniment
    // serait un symptôme pire que l'état qu'on cherche à corriger.
    trackedReady = true;
    ensure();
  });

  // Language and the tracked list both live in storage, so one listener keeps
  // this button in sync with the popup without any custom messaging.
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local") return;
    var dirty = false;

    if (changes[PREFERENCES_KEY]) {
      currentLang = langKey((changes[PREFERENCES_KEY].newValue || {}).language);
      dirty = true;
    }
    if (changes[STREAMERS_KEY]) {
      setTrackedFromList(changes[STREAMERS_KEY].newValue);
      // Une écriture arrivée avant la lecture initiale est une source de vérité
      // au moins aussi fraîche : inutile de rester bloqué sur trackedReady.
      trackedReady = true;
      dirty = true;
    }
    if (dirty) ensure();
  });

  // Re-inject across Twitch's SPA re-renders (debounced). Mutations made by 7TV
  // inside the channel row are ignored so we don't thrash or react to their
  // subtree; only Twitch re-renders can invalidate our anchor.
  var moTimer = null;
  var mo = new MutationObserver(function (records) {
    // Bail only when the whole batch came from a third-party extension; a mixed
    // batch still contains Twitch changes we must react to.
    var relevant = false;
    for (var i = 0; i < records.length; i++) {
      if (!isThirdParty(records[i].target)) {
        relevant = true;
        break;
      }
    }
    if (!relevant) return;
    if (moTimer) return;
    moTimer = setTimeout(function () {
      moTimer = null;
      ensure();
    }, 400);
  });
  try {
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (_e) {}

  // Le repli dépend de la largeur de la fenêtre, du panneau de chat ouvert ou
  // non, et de la barre latérale : autant d'états qui changent sans mutation
  // DOM dans la ligne d'actions, donc sans passer par le MutationObserver.
  var resizeTimer = null;
  window.addEventListener("resize", function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeTimer = null;
      var btn = document.getElementById(BTN_ID);
      if (btn) fitButton(btn);
    }, 150);
  });

  ensure();
})();
