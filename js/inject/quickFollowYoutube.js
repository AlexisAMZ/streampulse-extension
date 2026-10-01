/**
 * StreamPulse : bouton « Ajouter à StreamPulse » sur les pages de chaîne YouTube.
 *
 * Équivalent léger du quickFollow de Twitch (js/inject/quickFollow.js) : un
 * pill logo + libellé inséré à côté du bouton d'abonnement de YouTube. États :
 * « Ajouter à StreamPulse » puis « Suivi » une fois la chaîne suivie ; cliquer
 * quand c'est suivi la retire. Le temps de visionnage YouTube est géré par
 * watchTimeTracker.js, pas ici.
 *
 * Spécificités YouTube vs Twitch :
 *  - aucune ancre documentée : on s'accroche à #subscribe-button, observé par
 *    MutationObserver + l'événement yt-navigate-finish de l'SPA, avec un
 *    sondage de secours pour les chargements où l'observateur dort ;
 *  - les libellés réutilisent les clés quickFollow.* partagées, exposées par
 *    js/inject/i18n-inline.js chargé avant ce script ; la langue vient des
 *    préférences (storage.local), comme sur Twitch.
 */
(function () {
  "use strict";

  if (window.top !== window) return; // iframes : hors jeu.

  var STREAMERS_KEY = "betaGeneralStreamers";
  var PREFS_KEY = "betaGeneralPreferences";
  var BTN_ID = "sp-qf-yt";
  var LOGO_URL = chrome.runtime.getURL("images/photos/logosp-128.png");
  var POLL_MS = 2000;

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

  /**
   * Chaîne de la page : @handle ou /channel/ID dans l'URL (pages de chaîne),
   * sinon le lien de la chaîne propriétaire dans le DOM (pages watch : le
   * bouton apparaît à côté de son bouton d'abonnement).
   */
  function currentChannel() {
    var parts = location.pathname.split("/").filter(Boolean);
    if (parts.length) {
      var first = parts[0].toLowerCase();
      if (first.charAt(0) === "@") return first.slice(1);
      if (first === "channel" && parts[1]) return parts[1].toLowerCase();
    }
    var href =
      document.querySelector("#owner #channel-name a[href], ytd-channel-name a[href], #channel-name a[href]")?.getAttribute("href") ||
      "";
    return (/\/@([\w.-]{1,60})/.exec(href)?.[1] || /\/channel\/(UC[\w-]{1,60})/.exec(href)?.[1] || "").toLowerCase();
  }

  function isTracked(handle) {
    return trackedSet.has(handle);
  }

  function setTrackedFromList(streamers) {
    var next = new Set();
    (streamers || []).forEach(function (s) {
      var platform = s.platform || "twitch";
      var handle = String(s.handle || "").toLowerCase();
      if (platform === "youtube" && handle) next.add(handle);
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
    return send({ type: "addStreamer", platform: "youtube", handle }).then(function (res) {
      return Boolean(res && !res.error);
    });
  }

  function removeStreamer(handle) {
    return readLocal([STREAMERS_KEY]).then(function (data) {
      var streamers = (data && data[STREAMERS_KEY]) || [];
      var match = null;
      for (var i = 0; i < streamers.length; i++) {
        if (String(streamers[i].handle || "").toLowerCase() === handle && (streamers[i].platform || "twitch") === "youtube") {
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

  // La D.A. vient du bouton « S'abonner » lui-même : fond, texte, rayon,
  // hauteur, padding et police sont recopiés de son style calculé via des
  // variables CSS. Le pill colle donc au thème (clair/sombre) et aux refontes
  // de YouTube sans maintenance ; les valeurs en dur ne servent qu'au tout
  // premier rendu, avant qu'un vrai bouton soit mesurable.
  var STYLE = [
    "#" + BTN_ID + " { display: inline-flex; align-items: center; gap: 7px;",
    "  margin-left: 8px; vertical-align: middle; cursor: pointer; white-space: nowrap;",
    "  background: var(--sp-bg, #272727); color: var(--sp-color, #f1f1f1);",
    "  border-radius: var(--sp-radius, 18px); height: var(--sp-height, 36px);",
    "  padding: var(--sp-padding, 0 16px 0 13px); border: var(--sp-border, 0);",
    "  font-family: var(--sp-font, Roboto, Arial, sans-serif);",
    "  font-size: var(--sp-font-size, 14px); font-weight: var(--sp-weight, 500); }",
    "#" + BTN_ID + ":hover { filter: brightness(.94); }",
    "#" + BTN_ID + ".is-tracked { background: #9146FF; color: #fff; }",
    "#" + BTN_ID + ".is-tracked:hover { background: #a25eff; filter: none; }",
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

  /**
   * Copie le style calculé du vrai bouton « S'abonner » dans les variables
   * CSS du pill. L'état suivi (violet) reste géré par la classe : sa règle,
   * plus spécifique, garde la priorité sur les variables.
   */
  function applyNativeStyle(btn, anchor) {
    var source = anchor.querySelector("button") || anchor;
    if (!source || source.tagName !== "BUTTON") return; // squelette de chargement : rien à mesurer.
    var style = window.getComputedStyle(source);
    if (style.backgroundColor === "rgba(0, 0, 0, 0)") return;
    btn.style.setProperty("--sp-bg", style.backgroundColor);
    btn.style.setProperty("--sp-color", style.color);
    btn.style.setProperty("--sp-radius", style.borderRadius);
    btn.style.setProperty("--sp-height", style.height);
    btn.style.setProperty("--sp-padding", style.padding);
    btn.style.setProperty("--sp-border", style.borderStyle === "none" ? "0" : style.border);
    btn.style.setProperty("--sp-font", style.fontFamily);
    btn.style.setProperty("--sp-font-size", style.fontSize);
    btn.style.setProperty("--sp-weight", style.fontWeight);
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
    btn.className = "sp-qf-yt";

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
    // Pages de chaîne comme pages watch : le conteneur #subscribe-button, ou
    // le bouton d'abonnement lui-même selon la génération du DOM YouTube.
    return document.querySelector("#subscribe-button, ytd-subscribe-button-renderer");
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
        existing.dataset.spHandle = handle;
        anchor.insertAdjacentElement("afterend", existing);
      } else if (existing.dataset.spHandle !== handle) {
        // Navigation SPA vers une autre chaîne : même bouton, autre cible.
        existing.dataset.spHandle = handle;
        anchor.insertAdjacentElement("afterend", existing);
      }
      renderState(existing, handle);
      // Recopié à chaque passage : le thème ou le bouton de YouTube peuvent
      // changer sans navigation.
      applyNativeStyle(existing, anchor);
    });
  }

  // ---- boucle de vie --------------------------------------------------------

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === "local" && (changes[STREAMERS_KEY] || changes[PREFS_KEY])) {
      refreshState();
    }
  });

  // YouTube navigate en SPA : yt-navigate-finish couvre les changements de page,
  // l'observateur rattrape l'apparition tardive du bouton d'abonnement, et le
  // sondage couvre les cas où ni l'un ni l'autre ne se déclenchent.
  document.addEventListener("yt-navigate-finish", render);
  var observer = new MutationObserver(render);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(render, POLL_MS);

  refreshState();
  render();
})();
