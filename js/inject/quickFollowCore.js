/**
 * StreamPulse : noyau commun des boutons « Ajouter à StreamPulse » (Kick, YouTube, CHZZK).
 *
 * Chaque plateforme fournit seulement ce qui lui est propre : comment lire la chaîne de la page,
 * où se trouve le bouton « Suivre » du site, son style. Le noyau fait le reste : lecture de la liste
 * suivie, états « Ajouter » / « Suivi », ajout et retrait par le service worker, notification, rendu.
 * (Twitch garde son propre fichier, js/inject/quickFollow.js : ancre et suivi plus particuliers.)
 *
 * Script classique, exposé en window.__SP_QF__. Libellés = clés quickFollow.* de
 * window.__SP_I18N__ (js/inject/i18n-inline.js, chargé avant).
 */
(function () {
  "use strict";

  if (window.__SP_QF__) return;

  var STREAMERS_KEY = "betaGeneralStreamers";
  var PREFS_KEY = "betaGeneralPreferences";
  var POLL_MS = 2000;

  function readLocal(keys) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(keys, function (res) {
          resolve(chrome.runtime.lastError ? null : res || null);
        });
      } catch (_e) {
        resolve(null);
      }
    });
  }

  // Le service worker MV3 peut dormir ou démarrer à peine : « Receiving end does not exist »
  // veut dire que le message n'est jamais arrivé, donc le renvoyer ne double rien.
  var NOT_DELIVERED = /receiving end does not exist/i;
  var MAX_RETRIES = 2;

  function send(message, attempt) {
    attempt = attempt || 0;
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(message, function (res) {
          var error = chrome.runtime.lastError;
          if (!error) return resolve(res || null);
          console.warn("[StreamPulse] message " + message.type + " sans réponse :", error.message);
          if (attempt < MAX_RETRIES && NOT_DELIVERED.test(error.message || "")) {
            setTimeout(function () { resolve(send(message, attempt + 1)); }, 400 * (attempt + 1));
            return;
          }
          resolve(null);
        });
      } catch (e) {
        console.warn("[StreamPulse] message " + message.type + " impossible :", e && e.message);
        resolve(null);
      }
    });
  }

  /**
   * config :
   *   platform         "kick" | "youtube" | "chzzk" : plateforme des chaînes suivies.
   *   id               identifiant DOM du bouton (le style et la notification en dérivent).
   *   style            CSS du bouton, déjà écrit avec #id.
   *   currentChannel() chaîne de la page, en minuscules, ou "".
   *   findAnchor()     élément à côté duquel se placer, ou null.
   *   floating         true : sans ancre, le bouton flotte (classe is-floating) au lieu de disparaître.
   *   minGapMs         écart minimal entre deux rendus (0 = au plus un par image).
   *   navigateEvents   événements de navigation SPA qui relancent le rendu.
   *   delegateClick    true : clic délégué au document (le site clone ses conteneurs).
   *   afterRender(btn, anchor)  réglages propres à la plateforme après chaque rendu.
   */
  function create(config) {
    var BTN_ID = config.id;
    var LOGO_URL = chrome.runtime.getURL("images/photos/logosp-128.png");
    var minGap = config.minGapMs || 0;

    var currentLang = "en";
    var trackedSet = new Set();
    var busy = false;
    // Tant que la liste suivie n'a pas été lue, l'état est inconnu : peindre « Ajouter » mentirait sur
    // une chaîne déjà suivie.
    var trackedReady = false;

    function t(key, params) {
      var api = window.__SP_I18N__;
      return api ? api.get(currentLang, "quickFollow." + key, params) : key;
    }

    function isOurs(streamer) {
      return (streamer.platform || "twitch") === config.platform;
    }

    function setTrackedFromList(streamers) {
      var next = new Set();
      (streamers || []).forEach(function (s) {
        var handle = String(s.handle || "").toLowerCase();
        if (isOurs(s) && handle) next.add(handle);
      });
      trackedSet = next;
    }

    function refreshState() {
      return readLocal([PREFS_KEY, STREAMERS_KEY]).then(function (data) {
        if (data) {
          var api = window.__SP_I18N__;
          var language = (data[PREFS_KEY] || {}).language;
          currentLang = api && language ? api.resolve(language) : "en";
          setTrackedFromList(data[STREAMERS_KEY]);
        }
        // Lecture impossible ou non : on débloque quoi qu'il arrive.
        trackedReady = true;
        render();
      });
    }

    function addStreamer(handle) {
      return send({ type: "addStreamer", platform: config.platform, handle: handle }).then(function (res) {
        // Le service worker renvoie un message traduit et précis (chaîne
        // introuvable, déjà ajoutée…) : on l'affiche plutôt que l'erreur générique.
        return res && !res.error ? true : (res && typeof res.error === "string" ? res.error : false);
      });
    }

    function removeStreamer(handle) {
      return readLocal([STREAMERS_KEY]).then(function (data) {
        var streamers = (data && data[STREAMERS_KEY]) || [];
        var match = streamers.find(function (s) {
          return isOurs(s) && String(s.handle || "").toLowerCase() === handle.toLowerCase();
        });
        if (!match || !match.id) return false;
        return send({ type: "removeStreamer", id: match.id }).then(function (res) {
          return Boolean(res && !res.error);
        });
      });
    }

    /** La page affiche-t-elle un direct en cours ? Par défaut non (message d'attente). */
    function isLiveNow() {
      try {
        return Boolean(config.isLive && config.isLive());
      } catch (_e) {
        return false;
      }
    }

    var toastTimer = null;
    function showToast(message, isError) {
      try {
        var existing = document.getElementById(BTN_ID + "-toast");
        if (existing) existing.remove();
        var toast = document.createElement("div");
        toast.id = BTN_ID + "-toast";
        toast.textContent = message;
        if (isError) toast.classList.add("is-error");
        document.body.appendChild(toast);
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toast.remove(); }, isError ? 4000 : 6000);
      } catch (_e) {
        // La notification ne doit jamais casser l'action qu'elle rapporte.
      }
    }

    function injectStyle() {
      if (document.getElementById(BTN_ID + "-style")) return;
      var style = document.createElement("style");
      style.id = BTN_ID + "-style";
      style.textContent = config.style;
      (document.head || document.documentElement).appendChild(style);
    }

    function renderState(btn, handle) {
      // Comparaison sans casse : un ID de chaîne YouTube (UC…) garde la sienne.
      var tracked = trackedReady && trackedSet.has(handle.toLowerCase());
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
      // Le handle vient du dataset, jamais d'une fermeture : le bouton survit aux navigations SPA
      // vers une autre chaîne, sa cible non.
      var handle = btn.dataset.spHandle;
      if (!handle) return;
      busy = true;
      btn.classList.add("is-busy");
      var action = trackedSet.has(handle.toLowerCase()) ? removeStreamer(handle) : addStreamer(handle);
      action
        .then(function (result) {
          var ok = result === true;
          // On relit tout de suite : le service worker peut dormir au moment du storage.onChanged.
          return refreshState().then(function () {
            // Chaîne hors live (YouTube surtout) : on dit qu'elle est bien suivie et qu'on préviendra.
            var addedKey = ok && config.addedWaitingKey && !isLiveNow() ? config.addedWaitingKey : "added";
            showToast(ok ? t(addedKey, { name: handle }) : (typeof result === "string" && result) || t("error"), !ok);
          });
        })
        .catch(function () { showToast(t("error"), true); })
        .finally(function () {
          busy = false;
          btn.classList.remove("is-busy");
        });
    }

    function buildButton() {
      var btn = document.createElement("button");
      btn.id = BTN_ID;
      btn.type = "button";
      var logo = document.createElement("img");
      logo.src = LOGO_URL;
      logo.alt = "";
      var label = document.createElement("span");
      label.className = "sp-qf-label";
      btn.append(logo, label);
      if (!config.delegateClick) btn.addEventListener("click", function (e) { onClick(e, btn); });
      return btn;
    }

    function place(btn, anchor) {
      if (anchor) {
        btn.classList.remove("is-floating");
        if (btn.previousElementSibling !== anchor) anchor.insertAdjacentElement("afterend", btn);
      } else {
        btn.classList.add("is-floating");
        if (btn.parentElement !== document.body) document.body.appendChild(btn);
      }
    }

    var renderQueued = false;
    function render() {
      if (renderQueued) return;
      renderQueued = true;
      requestAnimationFrame(function () {
        renderQueued = false;
        injectStyle();
        var handle = config.currentChannel();
        var existing = document.getElementById(BTN_ID);
        if (!handle) {
          if (existing) existing.remove();
          return;
        }
        var anchor = config.findAnchor();
        if (!anchor && !config.floating) {
          if (existing) existing.remove();
          return;
        }
        if (!existing) existing = buildButton();
        existing.dataset.spHandle = handle;
        place(existing, anchor);
        renderState(existing, handle);
        if (config.afterRender) config.afterRender(existing, anchor);
      });
    }

    // Écart minimal entre deux rendus : les sites à tchat bavard repeignent des centaines de nœuds par
    // seconde, et chaque rendu parcourt la page.
    var renderTimer = null;
    var lastRender = 0;
    function scheduleRender() {
      if (!minGap) return render();
      if (renderTimer) return;
      renderTimer = setTimeout(function () {
        renderTimer = null;
        lastRender = Date.now();
        render();
      }, Math.max(0, minGap - (Date.now() - lastRender)));
    }

    function start() {
      if (config.delegateClick) {
        // Le site clone ses conteneurs : un listener posé sur le bouton mourrait avec l'original.
        document.addEventListener(
          "click",
          function (e) {
            var btn = e.target && e.target.closest && e.target.closest("#" + BTN_ID);
            if (btn) onClick(e, btn);
          },
          true
        );
      }
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area === "local" && (changes[STREAMERS_KEY] || changes[PREFS_KEY])) refreshState();
      });
      (config.navigateEvents || []).forEach(function (name) { document.addEventListener(name, scheduleRender); });
      new MutationObserver(scheduleRender).observe(document.documentElement, { childList: true, subtree: true });
      setInterval(scheduleRender, POLL_MS);
      refreshState();
      render();
    }

    return { start: start };
  }

  // `send` est exposé pour les tests (tests/quick-follow-send.test.mjs).
  window.__SP_QF__ = { create: create, send: send };
})();
