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

  var toastTimer = null;
  function showToast(message, isError) {
    try {
      var existing = document.getElementById("sp-qf-kick-toast");
      if (existing) existing.remove();
      var toast = document.createElement("div");
      toast.id = "sp-qf-kick-toast";
      toast.textContent = message;
      if (isError) toast.classList.add("is-error");
      document.body.appendChild(toast);
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.remove(); }, 4000);
    } catch (_e) {
      // Le toast ne doit jamais casser l'action qu'il rapporte.
    }
  }

  // Même D.A. que le bouton de suivi de Kick : vert volt #53fc18, texte
  // asphalt #090b0f, radius 4 (classe « rounded » de Kick), semibold —
  // valeurs relevées dans le CSS de kick.com (brand-bg-default =
  // kick-voltGreen-150, brand-fg-default = kick-asphaltBlack-950). Une fois
  // la chaîne suivie, le pill passe en violet StreamPulse pour l'état.
  var STYLE = [
    "#" + BTN_ID + " { display: inline-flex; align-items: center; gap: 7px;",
    "  padding: 8px 12px; margin-left: 8px; border-radius: 4px; vertical-align: middle;",
    "  border: 0; background: #53fc18; color: #090b0f; cursor: pointer;",
    "  font-family: inherit; font-size: 15px; font-weight: 600; white-space: nowrap; }",
    "#" + BTN_ID + ":hover { background: #47df15; }",
    "#" + BTN_ID + ":focus-visible { outline: 2px solid rgba(9, 11, 15, .8); outline-offset: 1px; }",
    "#" + BTN_ID + ".is-tracked { background: #1f1f26; border: 1px solid #3f3f3f; color: #fff; }",
    "#" + BTN_ID + ".is-tracked:hover { background: #26262f; }",
    "#" + BTN_ID + ".is-busy { opacity: .55; pointer-events: none; }",
    "#" + BTN_ID + " img { width: 18px; height: 18px; }",
    "#sp-qf-kick-toast { position: fixed; left: 16px; bottom: 16px; z-index: 9999;",
    "  padding: 10px 14px; border-radius: 8px; background: #1f1f26; color: #f1f1f1;",
    "  font-family: inherit; font-size: 13px;",
    "  box-shadow: 0 4px 16px rgba(0,0,0,.5); }",
    "#sp-qf-kick-toast.is-error { background: #b3261e; color: #fff; }",
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

  function onClick(e, btn) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    // Le handle vient du dataset, jamais de la closure : le bouton survit aux
    // navigations SPA vers une autre chaîne, sa cible non.
    var handle = btn.dataset.spHandle;
    if (!handle) return;
    busy = true;
    btn.classList.add("is-busy");
    var action = isTracked(handle) ? removeStreamer(handle) : addStreamer(handle);
    action
      .then(function (ok) {
        // L'écriture du fond déclenche storage.onChanged, mais on relit tout
        // de suite : le service worker peut être endormi au moment de l'écoute.
        return refreshState().then(function () {
          showToast(ok ? t("added", { name: handle }) : t("error"), !ok);
        });
      })
      .catch(function () {
        showToast(t("error"), true);
      })
      .finally(function () {
        busy = false;
        btn.classList.remove("is-busy");
      });
  }

  function buildButton() {
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
    btn.addEventListener("click", function (e) { onClick(e, btn); });
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
        existing = buildButton();
        existing.dataset.spHandle = handle;
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
