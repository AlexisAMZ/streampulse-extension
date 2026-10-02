/**
 * StreamPulse : badge communautaire et pseudo StreamPulse+ dans le tchat Kick.
 *
 * Miroir Kick de js/inject/twitch-badge.js : mêmes empreintes, même API
 * (streampulse.fr), mêmes classes CSS (css/inject/twitch-badge.css +
 * css/fx-effects.css, injectées sur Kick aussi). L'identité Kick est
 * indépendante : le pseudo Kick est haché avec le même sel et enregistré
 * auprès du service de badges quand l'utilisateur active le réglage.
 *
 * Adapté au DOM de Kick : messages dans #chatroom-messages (classes
 * .message), pseudo en .username avec sa couleur en style inline, emplacement
 * des badges dans .badges. Limitation assumée : les tuiles d'ancienneté
 * (StreamPulse+ façon 7TV) restent propres à Twitch, faute de plus-rule sur
 * ce domaine.
 */
(function () {
  "use strict";

  if (window.top !== window) return;

  var PREFERENCES_KEY = "betaGeneralPreferences";
  var API_URL = "https://streampulse.fr/api/streampulse-badges";
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
          if (currentUsername) {
            hashLogin(currentUsername).then(function (own) {
              if (own) next.add(own);
              badgeHashes = next;
              chrome.storage.local.set({ [STORAGE_KEY]: Array.from(badgeHashes) });
              refreshVisible();
            });
            return;
          }
          badgeHashes = next;
          chrome.storage.local.set({ [STORAGE_KEY]: Array.from(badgeHashes) });
          refreshVisible();
        })
        .catch(function () {
          // Service de badges optionnel : son indisponibilité n'entrave pas le tchat.
        });
    } catch (_e) {
      // Idem : fetch lui-même peut manquer (contexte invalidé).
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  function kickColor(messageEl) {
    try {
      var el = messageEl.querySelector(".username");
      var inline = el && el.style && el.style.color;
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
    if (messageEl.querySelector(".sp-chat-badge")) return;

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

    var slot = messageEl.querySelector(".badges");
    var username = messageEl.querySelector(".username");
    if (slot) {
      if (!slot.children.length) badge.classList.add("sp-chat-badge--standalone");
      slot.appendChild(badge);
    } else if (username) {
      username.insertAdjacentElement("beforebegin", badge);
    } else {
      messageEl.prepend(badge);
    }
  }

  function applyPaint(messageEl, hash) {
    var style = badgeStyles.get(hash);
    if (!style || !style.n) return;
    try {
      var name = messageEl.querySelector(".username");
      if (!name || name.classList.contains("sp-paint")) return;
      name.classList.add("sp-paint", "sp-paint--" + style.n);
      var glow = kickColor(messageEl);
      if (glow) name.style.setProperty("--sp-paint-glow", glow);
    } catch (_e) {
      // Kick reconstruit son DOM : le nœud peut disparaître entre-temps.
    }
  }

  function processMessageLine(messageEl) {
    if (!messageEl || messageEl.classList.contains("sp-badge-processed")) return;
    messageEl.classList.add("sp-badge-processed");

    var username = extractUsername(messageEl);
    if (!username) return;

    hashLogin(username).then(function (hash) {
      if (hash && badgeHashes.has(hash)) {
        injectBadge(messageEl, hash);
        applyPaint(messageEl, hash);
      }
    });
  }

  function extractUsername(messageEl) {
    for (var sel of [".username", "[data-username]"]) {
      var node = messageEl.querySelector(sel);
      var txt = node && (node.getAttribute("data-username") || node.textContent);
      if (txt && txt.trim()) return txt.trim().toLowerCase().replace(/^@+/, "");
    }
    return "";
  }

  var MESSAGE_SELECTOR = "#chatroom-messages .message, [data-testid='chat-message'], .chat-entry, .chat-message";

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
      refreshVisible();
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
