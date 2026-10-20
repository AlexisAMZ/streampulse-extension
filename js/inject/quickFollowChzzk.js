/**
 * StreamPulse : bouton « Ajouter à StreamPulse » sur les pages de chaîne CHZZK.
 *
 * Même pill que sur Twitch, Kick et YouTube : logo + libellé, états « Ajouter » / « Suivi », clic pour
 * ajouter ou retirer. Ce script n'existe que si l'utilisateur a accordé le site CHZZK (il est enregistré
 * dynamiquement par js/sw/chzzk-access.js), donc l'accès à l'API est déjà là quand on clique.
 *
 * Spécificités CHZZK :
 *  - une chaîne s'identifie par un identifiant de 32 caractères hexadécimaux : /<id>, /live/<id>,
 *    /<id>/community… ; le pseudo affiché n'est pas dans l'adresse ;
 *  - le bouton se place à côté du bouton « Suivre » du site (repéré par son texte, les classes de
 *    CHZZK sont générées) et, faute de le trouver, flotte en bas à gauche : il ne disparaît jamais ;
 *  - libellés = clés quickFollow.* partagées via window.__SP_I18N__.
 */
(function () {
  "use strict";

  if (window.top !== window) return;

  var STREAMERS_KEY = "betaGeneralStreamers";
  var PREFS_KEY = "betaGeneralPreferences";
  var BTN_ID = "sp-qf-chzzk";
  var LOGO_URL = chrome.runtime.getURL("images/photos/logosp-128.png");
  var POLL_MS = 2000;
  var MIN_RENDER_GAP_MS = 1000;
  var CHANNEL_ID = /^[0-9a-f]{32}$/i;
  var FOLLOW_LABEL = /^(팔로우|팔로잉|follow(ing)?)$/i;
  var SECTIONS_BEFORE_ID = { live: true, video: true, channel: true };

  var currentLang = "en";
  var trackedSet = new Set();
  var busy = false;
  // Tant que la liste suivie n'a pas été lue, l'état est inconnu : ne pas afficher « Ajouter » à tort.
  var trackedReady = false;

  function t(key, params) {
    var api = window.__SP_I18N__;
    return api ? api.get(currentLang, "quickFollow." + key, params) : key;
  }

  function currentChannel() {
    var parts = location.pathname.split("/").filter(Boolean);
    var candidate = SECTIONS_BEFORE_ID[(parts[0] || "").toLowerCase()] ? parts[1] : parts[0];
    return candidate && CHANNEL_ID.test(candidate) ? candidate.toLowerCase() : "";
  }

  function setTrackedFromList(streamers) {
    var next = new Set();
    (streamers || []).forEach(function (s) {
      var handle = String(s.handle || "").toLowerCase();
      if (s.platform === "chzzk" && handle) next.add(handle);
    });
    trackedSet = next;
  }

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

  function send(message) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(message, function (res) {
          resolve(chrome.runtime.lastError ? null : res || null);
        });
      } catch (_e) {
        resolve(null);
      }
    });
  }

  function refreshState() {
    return readLocal([PREFS_KEY, STREAMERS_KEY]).then(function (data) {
      if (data) {
        var api = window.__SP_I18N__;
        var language = (data[PREFS_KEY] || {}).language;
        currentLang = api && language ? api.resolve(language) : "en";
        setTrackedFromList(data[STREAMERS_KEY]);
      }
      trackedReady = true;
      render();
    });
  }

  function addStreamer(handle) {
    return send({ type: "addStreamer", platform: "chzzk", handle: handle }).then(function (res) {
      return Boolean(res && !res.error);
    });
  }

  function removeStreamer(handle) {
    return readLocal([STREAMERS_KEY]).then(function (data) {
      var streamers = (data && data[STREAMERS_KEY]) || [];
      var match = streamers.find(function (s) {
        return s.platform === "chzzk" && String(s.handle || "").toLowerCase() === handle;
      });
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
      var existing = document.getElementById(BTN_ID + "-toast");
      if (existing) existing.remove();
      var toast = document.createElement("div");
      toast.id = BTN_ID + "-toast";
      toast.textContent = message;
      if (isError) toast.classList.add("is-error");
      document.body.appendChild(toast);
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.remove(); }, 4000);
    } catch (_e) {
      // Le toast ne doit jamais casser l'action qu'il rapporte.
    }
  }

  // Vert CHZZK #00ffa3, texte sombre ; suivi : gris sombre à bordure, comme les autres plateformes.
  var STYLE = [
    "#" + BTN_ID + " { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px 6px 12px; margin-left: 8px;",
    "  border-radius: 999px; vertical-align: middle; border: 0; background: #00ffa3; color: #0b0d12;",
    "  cursor: pointer; font-family: inherit; font-size: 13px; line-height: 1.2; font-weight: 700; white-space: nowrap; }",
    "#" + BTN_ID + ":hover { background: #00e693; }",
    "#" + BTN_ID + ":focus-visible { outline: 2px solid rgba(11, 13, 18, .8); outline-offset: 1px; }",
    "#" + BTN_ID + ".is-tracked { background: #1f1f26; border: 1px solid #3f3f3f; color: #fff; }",
    "#" + BTN_ID + ".is-tracked:hover { background: #26262f; }",
    "#" + BTN_ID + ".is-busy { opacity: .55; pointer-events: none; }",
    "#" + BTN_ID + ".is-floating { position: fixed; left: 16px; bottom: 16px; z-index: 9998; margin: 0;",
    "  box-shadow: 0 4px 16px rgba(0,0,0,.5); }",
    "#" + BTN_ID + " img { width: 16px; height: 16px; border-radius: 50%; }",
    "#" + BTN_ID + "-toast { position: fixed; left: 16px; bottom: 64px; z-index: 9999; padding: 10px 14px;",
    "  border-radius: 8px; background: #1f1f26; color: #f1f1f1; font-family: inherit; font-size: 13px;",
    "  box-shadow: 0 4px 16px rgba(0,0,0,.5); }",
    "#" + BTN_ID + "-toast.is-error { background: #b3261e; color: #fff; }",
  ].join("\n");

  function injectStyle() {
    if (document.getElementById(BTN_ID + "-style")) return;
    var style = document.createElement("style");
    style.id = BTN_ID + "-style";
    style.textContent = STYLE;
    (document.head || document.documentElement).appendChild(style);
  }

  function renderState(btn, handle) {
    var tracked = trackedReady && trackedSet.has(handle);
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
    var handle = btn.dataset.spHandle;
    if (!handle) return;
    busy = true;
    btn.classList.add("is-busy");
    var action = trackedSet.has(handle) ? removeStreamer(handle) : addStreamer(handle);
    action
      .then(function (ok) {
        return refreshState().then(function () {
          showToast(ok ? t("added", { name: handle }) : t("error"), !ok);
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
    btn.addEventListener("click", function (e) { onClick(e, btn); });
    return btn;
  }

  /** Le bouton « Suivre » du site : un vrai bouton visible dont le texte est exactement ce mot. */
  function findAnchor() {
    var buttons = document.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      var button = buttons[i];
      if (button.id === BTN_ID || !FOLLOW_LABEL.test((button.textContent || "").trim())) continue;
      if (button.getBoundingClientRect().width > 0) return button;
    }
    return null;
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
      if (!existing) existing = buildButton();
      existing.dataset.spHandle = handle;
      var anchor = findAnchor();
      existing.classList.toggle("is-floating", !anchor);
      if (anchor) {
        if (existing.previousElementSibling !== anchor) anchor.insertAdjacentElement("afterend", existing);
      } else if (existing.parentElement !== document.body) {
        document.body.appendChild(existing);
      }
      renderState(existing, handle);
    });
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === "local" && (changes[STREAMERS_KEY] || changes[PREFS_KEY])) refreshState();
  });

  // CHZZK navigue en SPA : l'observateur rattrape les re-rendus, le sondage la navigation muette.
  // Le tchat de CHZZK repeint des centaines de nœuds par seconde : le rendu (qui parcourt les boutons de
  // la page) est limité à une fois par seconde environ, sinon il gèle le lecteur.
  var renderTimer = null;
  var lastRender = 0;
  function scheduleRender() {
    if (renderTimer) return;
    renderTimer = setTimeout(function () {
      renderTimer = null;
      lastRender = Date.now();
      render();
    }, Math.max(0, MIN_RENDER_GAP_MS - (Date.now() - lastRender)));
  }
  new MutationObserver(scheduleRender).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(scheduleRender, POLL_MS);

  refreshState();
  render();
})();
