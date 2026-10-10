/**
 * StreamPulse : badge communautaire et pseudo StreamPulse+ dans le tchat Kick.
 *
 * Miroir Kick de js/inject/twitch-badge.js : mêmes empreintes, même API
 * (streampulse.tech), mêmes classes CSS (css/inject/twitch-badge.css +
 * css/fx-effects.css, injectées sur Kick aussi). L'identité Kick est
 * indépendante : le pseudo Kick est haché avec le même sel et enregistré
 * auprès du service de badges quand l'utilisateur active le réglage.
 *
 * Adapté au DOM 2026 de Kick : messages en rangées [data-index] d'une liste
 * virtualisée dans #chatroom-messages, pseudo en <button data-prevent-expand>
 * avec sa couleur en style inline, badges dans le premier <div> du bloc
 * identité (gap-1 entre images). Limitation assumée : les tuiles
 * d'ancienneté (StreamPulse+ façon 7TV) restent propres à Twitch, faute de
 * plus-rule sur ce domaine.
 */
(function () {
  "use strict";

  if (window.top !== window) return;

  // Journalisation de debogage, muette par defaut — comme twitch-badge.js :
  // activer dans la console de l'onglet Kick avec localStorage.SP_DEBUG = "1".
  var DEBUG = false;
  try {
    var flag = localStorage.getItem("SP_DEBUG");
    DEBUG = flag === "1" || flag === "2" || flag === "trace";
  } catch (_e) {
    // localStorage refuse : on reste muet.
  }
  function log() {
    if (!DEBUG) return;
    try {
      console.log.apply(console, ["[SP-Kick-Badge]"].concat(Array.prototype.slice.call(arguments)));
    } catch (_e) {
      // La journalisation ne doit jamais casser ce qu'elle observe.
    }
  }

  var PREFERENCES_KEY = "betaGeneralPreferences";
  var API_URL = "https://streampulse.tech/api/streampulse-badges";
  var STORAGE_KEY = "streampulseBadgeHashes";
  var HASH_SALT = "streampulse:badge:v1:";
  var HASH_LENGTH = 12;

  var badgeHashes = new Set();
  var badgeStyles = new Map();
  var currentUsername = null;
  var enabled = false;
  var observer = null;

  // ── Empreintes ────────────────────────────────────────────────────────────

  var hashCache = new Map();
  function hashLogin(login) {
    var key = String(login || "").toLowerCase().trim();
    if (!key) return Promise.resolve("");
    var cached = hashCache.get(key);
    if (cached) return Promise.resolve(cached);
    try {
      var bytes = new TextEncoder().encode(HASH_SALT + key);
      return crypto.subtle.digest("SHA-256", bytes).then(function (buffer) {
        var hex = Array.prototype.map
          .call(new Uint8Array(buffer), function (b) {
            return b.toString(16).padStart(2, "0");
          })
          .join("")
          .slice(0, HASH_LENGTH);
        hashCache.set(key, hex);
        return hex;
      });
    } catch (_e) {
      return Promise.resolve("");
    }
  }

  // ── Badge / pseudo : données distantes ────────────────────────────────────

  function fetchRemoteBadges() {
    try {
      fetch(API_URL + "?v=2")
        .then(function (res) {
          if (!res.ok) return [];
          return res.json();
        })
        .then(function (data) {
          // v2 : { hashes, colors, styles } ; une ancienne reponse reste un tableau.
          var list = Array.isArray(data) ? data : (data && Array.isArray(data.hashes) ? data.hashes : []);
          var styles = data && !Array.isArray(data) && data.styles && typeof data.styles === "object" ? data.styles : {};
          var nextStyles = new Map();
          Object.keys(styles).forEach(function (h) {
            var style = styles[h] || {};
            var n = typeof style.n === "string" ? style.n : "";
            if (/^[a-f0-9]{12}$/.test(h) && (style.b || n)) nextStyles.set(h, { b: String(style.b || ""), n: n });
          });
          badgeStyles = nextStyles;
          // La liste du serveur fait foi (comme sur Twitch) : un badge
          // disparaît quand l'extension de son porteur a été supprimée. Le
          // pseudo courant reste admis : son enregistrement peut dater d'il
          // y a moins d'un jour et ne pas être encore revenu dans la liste.
          var next = new Set();
          for (var i = 0; i < list.length; i++) {
            var hash = String(list[i] || "").toLowerCase().trim();
            if (/^[a-f0-9]{12}$/.test(hash)) next.add(hash);
          }
          log(next.size, "empreintes chargees,", nextStyles.size, "styles");
          if (currentUsername) {
            hashLogin(currentUsername).then(function (own) {
              if (own) next.add(own);
              badgeHashes = next;
              chrome.storage.local.set({ [STORAGE_KEY]: Array.from(badgeHashes) });
              rescanVisibleMessages();
            });
            return;
          }
          badgeHashes = next;
          chrome.storage.local.set({ [STORAGE_KEY]: Array.from(badgeHashes) });
          rescanVisibleMessages();
        })
        .catch(function (error) {
          log("service de badges indisponible :", error && error.message);
        });
    } catch (_e) {
      // Idem : fetch lui-même peut manquer (contexte invalidé).
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  // DOM 2026 du tchat Kick : chaque message est une rangée [data-index] d'une
  // liste virtualisee. Le pseudo est un <button data-prevent-expand> (sa
  // couleur inline), precede eventuellement d'un <div> de badges — ni
  // .username, ni .message, ni .badges, qui n'existent plus.
  var MESSAGE_SELECTOR = "#chatroom-messages [data-index]";

  /** Le bouton pseudo d'une rangée : data-prevent-expand, sinon le bouton du bloc identite. */
  function usernameButton(messageEl) {
    var btn = messageEl.querySelector('button[data-prevent-expand="true"]');
    if (!btn || !(btn.textContent || "").trim()) {
      var block = messageEl.querySelector("div[class*='items-baseline']");
      btn = block ? block.querySelector("button") : null;
    }
    return btn;
  }

  function kickColor(messageEl) {
    try {
      var btn = usernameButton(messageEl);
      var inline = btn && btn.style && btn.style.color;
      if (inline) return inline;
    } catch (_e) {
      // Kick reconstruit son DOM : le nœud peut disparaître entre-temps.
    }
    return "#9146FF";
  }

  function applyLook(badge, style) {
    if (!style || !style.b) return;
    badge.classList.add("sp-chat-badge--fx-" + style.b);
  }

  function injectBadge(messageEl, hash) {
    // Extension rechargée sans rafraîchir l'onglet : chrome.runtime a disparu.
    if (!(chrome.runtime && chrome.runtime.id)) return;
    if (messageEl.querySelector(".sp-chat-badge")) return;

    var btn = usernameButton(messageEl);
    if (!btn) return;

    var badge = document.createElement("span");
    badge.className = "sp-chat-badge";
    if (hash) badge.setAttribute("data-sp-hash", hash);
    badge.setAttribute("aria-label", "StreamPulse");

    var mark = document.createElement("span");
    mark.className = "sp-chat-badge-img";
    var mask = "url(" + chrome.runtime.getURL("images/photos/badge-mark.svg") + ")";
    mark.style.setProperty("-webkit-mask-image", mask);
    mark.style.setProperty("mask-image", mask);
    mark.style.setProperty("--sp-badge-color", kickColor(messageEl));
    applyLook(badge, hash && badgeStyles.get(hash));

    badge.appendChild(mark);

    // Le conteneur de badges de Kick est le premier <div> du bloc identite
    // (gap-1 entre images) ; absent quand l'auteur n'a aucun badge.
    var holder = btn.parentElement;
    var slot = null;
    if (holder) {
      for (var child = holder.firstElementChild; child; child = child.nextElementSibling) {
        if (child.tagName === "DIV") { slot = child; break; }
      }
    }
    if (slot) {
      slot.appendChild(badge);
    } else if (holder) {
      badge.classList.add("sp-chat-badge--standalone");
      holder.insertBefore(badge, btn);
    }
  }

  function applyPaint(messageEl, hash) {
    var style = badgeStyles.get(hash);
    if (!style || !style.n) return;
    try {
      var name = usernameButton(messageEl);
      if (!name || name.classList.contains("sp-paint")) return;
      name.classList.add("sp-paint", "sp-paint--" + style.n);
      var glow = kickColor(messageEl);
      if (glow) name.style.setProperty("--sp-paint-glow", glow);
    } catch (_e) {
      // Kick reconstruit son DOM : le nœud peut disparaître entre-temps.
    }
  }

  function processMessageLine(messageEl) {
    var username = extractUsername(messageEl);
    if (!username) return;
    // La liste est virtualisee : une rangée [data-index] est une case reutilisee
    // pour le message suivant. On ne saute la rangée que si c'est toujours le
    // meme pseudo — sinon on repare ce qui a été posé pour l'ancien.
    if (messageEl.classList.contains("sp-badge-processed") && messageEl.getAttribute("data-sp-user") === username) return;
    messageEl.classList.add("sp-badge-processed");
    messageEl.setAttribute("data-sp-user", username);

    hashLogin(username).then(function (hash) {
      var carrier = !!(hash && badgeHashes.has(hash));
      // Restes d'un message précédent sur cette case : badge d'un autre hash,
      // paint d'un autre pseudo — ils partiraient avec le mauvais auteur.
      var existing = messageEl.querySelector(".sp-chat-badge");
      if (existing && (!carrier || existing.getAttribute("data-sp-hash") !== hash)) existing.remove();
      var painted = usernameButton(messageEl);
      if (painted && painted.classList.contains("sp-paint") && (!carrier || !badgeStyles.get(hash))) {
        painted.className = painted.className.replace(/\bsp-paint(--\S+)?/g, "").replace(/\s+/g, " ").trim();
        painted.style.removeProperty("--sp-paint-glow");
      }
      if (!carrier) return;
      injectBadge(messageEl, hash);
      applyPaint(messageEl, hash);
    });
  }

  function extractUsername(messageEl) {
    var node = usernameButton(messageEl);
    var txt = node && node.textContent;
    if (txt && txt.trim()) return txt.trim().toLowerCase().replace(/^@+/, "");
    return "";
  }

  /**
   * Repasse sur les rangées deja affichees, une fois la liste distante connue :
   * seules celles sans badge sont reprises (les autres sont deja a jour).
   */
  function rescanVisibleMessages() {
    try {
      var messages = document.querySelectorAll(MESSAGE_SELECTOR);
      for (var i = 0; i < messages.length; i++) {
        var el = messages[i];
        if (el.querySelector(".sp-chat-badge")) continue;
        el.classList.remove("sp-badge-processed");
        processMessageLine(el);
      }
    } catch (_e) {
      // Kick reconstruit son DOM : le noeud peut disparaitre entre la selection et l'usage.
    }
  }

  function refreshVisible() {
    try {
      var messages = document.querySelectorAll(MESSAGE_SELECTOR);
      for (var i = 0; i < messages.length; i++) processMessageLine(messages[i]);
    } catch (_e) {
      // Kick reconstruit son DOM en permanence : on retentera au prochain passage.
    }
  }

  // ── Utilisateur courant (pseudo Kick) ─────────────────────────────────────

  function detectCurrentUser() {
    // Le lien du profil dans la barre de navigation porte la photo de
    // l'utilisateur connecté (profile_image) : c'est LUI, pas un streamer.
    var links = document.querySelectorAll("a[href^='/']");
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var img = link.querySelector("img[src*='profile_image']");
      var href = link.getAttribute("href") || "";
      var seg = href.replace(/^\/+/, "").toLowerCase();
      if (img && /^[a-z0-9_-]{2,25}$/.test(seg)) return seg;
    }
    return null;
  }

  function registerCurrentUser(username) {
    if (!username) return;
    hashLogin(username).then(function (hash) {
      if (!hash) return;
      badgeHashes.add(hash);
      rescanVisibleMessages();
      log("utilisateur detecte, empreinte enregistree");
      try {
        chrome.storage.local.get([STORAGE_KEY, "lastBadgeSync"], function (res) {
          ((res && res[STORAGE_KEY]) || []).forEach(function (h) {
            badgeHashes.add(String(h).toLowerCase().trim());
          });
          badgeHashes.add(hash);
          chrome.storage.local.set({ [STORAGE_KEY]: Array.from(badgeHashes) });

          var now = Date.now();
          var lastSync = res && res.lastBadgeSync ? res.lastBadgeSync : 0;
          if (now - lastSync > 86400000) {
            fetch(API_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ hash: hash })
            }).then(function (response) {
              if (!response.ok) throw new Error("HTTP " + response.status);
              chrome.storage.local.set({ lastBadgeSync: now });
            }).catch(function () {});
          }
        });
      } catch (_e) {
        // Service worker endormi ou contexte invalidé : sans conséquence ici.
      }
    });
  }

  // ── Vie du script ─────────────────────────────────────────────────────────

  function start() {
    log("demarrage");
    fetchRemoteBadges();
    refreshVisible();
    if (!observer) {
      var target = document.getElementById("chatroom-messages") || document.body;
      observer = new MutationObserver(function () {
        if (!enabled) return;
        refreshVisible();
        if (!currentUsername) {
          var detected = detectCurrentUser();
          if (detected) {
            currentUsername = detected;
            registerCurrentUser(detected);
          }
        }
      });
      observer.observe(target, { childList: true, subtree: true });
    }
    if (!currentUsername) {
      var detected = detectCurrentUser();
      if (detected) {
        currentUsername = detected;
        registerCurrentUser(detected);
      }
    }
  }

  function stop() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    // Les badges déjà posés restent : seul le suivi s'arrête.
  }

  function loadSettings() {
    chrome.storage.local.get([PREFERENCES_KEY], function (result) {
      var prefs = (result && result[PREFERENCES_KEY]) || {};
      enabled = prefs.communityBadge === true;
      log("reglages :", enabled ? "actif" : "inactif (communityBadge !== true)");
      if (enabled) start();
      else stop();
    });
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === "local" && changes[PREFERENCES_KEY]) {
      loadSettings();
    }
  });

  loadSettings();
})();
