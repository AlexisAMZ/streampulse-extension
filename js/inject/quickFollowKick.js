/**
 * StreamPulse : bouton « Ajouter à StreamPulse » sur les pages de chaîne Kick.
 *
 * Même pill que sur Twitch et YouTube : logo + libellé à côté du bouton de
 * suivi de Kick (data-testid="follow-button", stable dans le rendu SSR comme
 * côté client). États « Ajouter » / « Suivi », clic pour ajouter ou retirer.
 *
 * Spécificités Kick :
 *  - la première route d'une page de chaîne est le nom d'utilisateur, sauf les
 *    routes réservées (mêmes exclusions que watchTimeTracker, plus « video ») ;
 *  - Kick est une SPA React : yt-navigate-finish n'existe pas ici, la combinaison
 *    MutationObserver + sondage borné couvre la navigation et les re-rendus ;
 *  - libellés = clés quickFollow.* partagées via window.__SP_I18N__
 *    (js/inject/i18n-inline.js est injecté avant ce script sur Kick).
 */
(function () {
  "use strict";

  if (window.top !== window) return; // iframes : hors jeu.

  var STREAMERS_KEY = "betaGeneralStreamers";
  var PREFS_KEY = "betaGeneralPreferences";
  var BTN_ID = "sp-qf-kick";
  var LOGO_URL = chrome.runtime.getURL("images/photos/logosp-128.png");
  var POLL_MS = 2000;
  // Routes Kick qui ne sont pas des chaînes : mêmes exclusions que le tracker,
  // plus la page VOD « video » et le catalogue « browse ».
  var IGNORED_ROUTES = {
    categories: true, following: true, search: true, dashboard: true,
    video: true, browse: true, community: true,
  };

  var currentLang = "en";
  var trackedSet = new Set();
  var busy = false;
  // Tant que la liste suivie n'a pas été lue, l'état du bouton est inconnu :
  // peindre « Ajouter » pendant cet intervalle mentirait sur une chaîne
  // déjà suivie (même raisonnement que quickFollow sur Twitch).
  var trackedReady = false;

  function langKey(value) {
    var api = typeof window !== "undefined" ? window.__SP_I18N__ : null;
    return api ? api.resolve(value) : "en";
  }

  function t(key, params) {
    var api = typeof window !== "undefined" ? window.__SP_I18N__ : null;
    if (!api) return key;
    return api.get(currentLang, "quickFollow." + key, params);
  }

  // ---- chaîne courante ------------------------------------------------------

  function currentChannel() {
    var first = (location.pathname.split("/").filter(Boolean)[0] || "").toLowerCase();
    if (!first || IGNORED_ROUTES[first]) return "";
    return first;
  }

  function isTracked(handle) {
    return trackedSet.has(handle);
  }

  function setTrackedFromList(streamers) {
    var next = new Set();
    (streamers || []).forEach(function (s) {
      var platform = s.platform || "twitch";
      var handle = String(s.handle || "").toLowerCase();
      if (platform === "kick" && handle) next.add(handle);
    });
    trackedSet = next;
  }

  // ---- storage & messaging --------------------------------------------------

  function readLocal(keys) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(keys, function (res) {
          if (chrome.runtime.lastError) resolve(null);
          else resolve(res || null);
        });
      } catch (_e) {
        resolve(null);
      }
    });
  }

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

  function refreshState() {
    return readLocal([PREFS_KEY, STREAMERS_KEY]).then(function (data) {
      if (data) {
        currentLang = langKey((data[PREFS_KEY] || {}).language);
        setTrackedFromList(data[STREAMERS_KEY]);
      }
      // Lecture impossible ou pas : on débloque quoi qu'il arrive, un bouton
      // figé indéfiniment serait pire qu'un état à corriger.
      trackedReady = true;
      render();
    });
  }

  function addStreamer(handle) {
    return send({ type: "addStreamer", platform: "kick", handle }).then(function (res) {
      return Boolean(res && !res.error);
    });
  }

  function removeStreamer(handle) {
    return readLocal([STREAMERS_KEY]).then(function (data) {
      var streamers = (data && data[STREAMERS_KEY]) || [];
      var match = null;
      for (var i = 0; i < streamers.length; i++) {
        if (String(streamers[i].handle || "").toLowerCase() === handle && (streamers[i].platform || "twitch") === "kick") {
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

  // ---- bouton ---------------------------------------------------------------

  var STYLE = [
    "#" + BTN_ID + " { display: inline-flex; align-items: center; gap: 6px; height: 34px;",
    "  padding: 0 14px 0 12px; margin-left: 8px; border-radius: 8px; vertical-align: middle;",
    "  border: 1px solid rgba(83, 252, 24, .0); background: rgba(145, 70, 255, .12);",
    "  color: #b98bff; cursor: pointer; font-family: inherit;",
    "  font-size: 14px; font-weight: 500; white-space: nowrap; }",
    "#" + BTN_ID + ":hover { background: rgba(145, 70, 255, .24); }",
    "#" + BTN_ID + ".is-tracked { background: #9146FF; border-color: #9146FF; color: #fff; }",
    "#" + BTN_ID + ".is-busy { opacity: .55; pointer-events: none; }",
    "#" + BTN_ID + " img { width: 16px; height: 16px; }",
  ].join("\n");

  function injectStyle() {
    if (document.getElementById(BTN_ID + "-style")) return;
    var style = document.createElement("style");
    style.id = BTN_ID + "-style";
    style.textContent = STYLE;
    (document.head || document.documentElement).appendChild(style);
  }

  function renderState(btn, handle) {
    var tracked = trackedReady && isTracked(handle);
    var label = btn.querySelector(".sp-qf-label");
    if (label) label.textContent = tracked ? t("tracked") : t("add");
    btn.title = tracked ? t("remove") : t("add");
    btn.setAttribute("aria-pressed", tracked ? "true" : "false");
    btn.classList.toggle("is-tracked", tracked);
  }

  function onClick(e, btn, handle) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    busy = true;
    btn.classList.add("is-busy");
    var action = isTracked(handle) ? removeStreamer(handle) : addStreamer(handle);
    action
      .then(function (ok) {
        // L'écriture du fond déclenche storage.onChanged, mais on relit tout
        // de suite : le service worker peut être endormi au moment de l'écoute.
        return refreshState().then(function () {
          if (!ok) btn.title = t("error");
        });
      })
      .catch(function () {
        btn.title = t("error");
      })
      .finally(function () {
        busy = false;
        btn.classList.remove("is-busy");
      });
  }

  function buildButton(handle) {
    var btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.className = "sp-qf-kick";

    var logo = document.createElement("img");
    logo.src = LOGO_URL;
    logo.alt = "";

    var label = document.createElement("span");
    label.className = "sp-qf-label";

    btn.appendChild(logo);
    btn.appendChild(label);
    btn.addEventListener("click", function (e) { onClick(e, btn, handle); });
    return btn;
  }

  function findAnchor() {
    // data-testid="follow-button" : présent dans le rendu SSR comme côté
    // client, vérifié sur kick.com. Sur une page hors chaîne il est absent.
    return document.querySelector('[data-testid="follow-button"]');
  }

  var renderQueued = false;
  function render() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(function () {
      renderQueued = false;
      injectStyle();
      var handle = currentChannel();
      var existing = document.getElementById(BTN_ID);
      if (!handle) {
        if (existing) existing.remove();
        return;
      }
      var anchor = findAnchor();
      if (!anchor) {
        if (existing) existing.remove();
        return;
      }
      if (!existing) {
        existing = buildButton(handle);
        anchor.insertAdjacentElement("afterend", existing);
      } else if (existing.dataset.spHandle !== handle) {
        // Navigation SPA vers une autre chaîne : même bouton, autre cible.
        existing.dataset.spHandle = handle;
        anchor.insertAdjacentElement("afterend", existing);
      }
      renderState(existing, handle);
    });
  }

  // ---- boucle de vie --------------------------------------------------------

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === "local" && (changes[STREAMERS_KEY] || changes[PREFS_KEY])) {
      refreshState();
    }
  });

  // Kick navigue en SPA React : l'observateur rattrape l'apparition du bouton
  // de suivi après chaque rendu, et le sondage couvre la navigation muette.
  var observer = new MutationObserver(render);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(render, POLL_MS);

  refreshState();
  render();
})();
