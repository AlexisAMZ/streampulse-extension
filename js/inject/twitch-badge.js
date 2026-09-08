(function () {
  "use strict";

  var LOG = "[SP-Badge]";

  // Journalisation de debogage, muette par defaut. Activer dans la console de
  // l'onglet Twitch avec localStorage.setItem("SP_DEBUG", "1"), comme
  // quickFollow.js. Sans cela le badge imprimait a chaque balayage du tchat,
  // dans la console de tous les utilisateurs.
  var DEBUG = false;
  try {
    DEBUG = localStorage.getItem("SP_DEBUG") === "1";
  } catch (_e) {}

  function log() {
    if (!DEBUG) return;
    try {
      console.log.apply(console, [LOG].concat(Array.prototype.slice.call(arguments)));
    } catch (_e) {}
  }
  var API_URL = "https://alexisamz.fr/api/streampulse-badges";
  var STORAGE_KEY = "streampulseBadgeHashes";
  var LEGACY_STORAGE_KEY = "streampulseBadgeUsers"; // pseudos en clair, a purger

  // Sel applicatif : il n'est pas secret (il vit dans l'extension), mais il
  // empeche de reutiliser une table precalculee de pseudos Twitch contre la
  // liste publique d'empreintes.
  var HASH_SALT = "streampulse:badge:v1:";
  var HASH_LENGTH = 12; // 48 bits : collisions negligeables a notre echelle

  // Empreintes des porteurs du badge, et cache pseudo -> empreinte pour ne pas
  // rehacher a chaque message du tchat.
  var badgeHashes = new Set();
  var hashCache = new Map();
  var currentTwitchUser = null;

  // "author" (couleur du pseudo), "theme" (blanc/noir), ou une couleur hexa.
  var badgeColorMode = "author";
  var badgeIconUrl = (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL)
    ? chrome.runtime.getURL("images/photos/128px.png")
    : "";

  // ── Hachage des pseudos ──────────────────────────────────────────────────

  /**
   * Empreinte tronquee d'un pseudo. Le pseudo lui-meme ne quitte jamais le
   * navigateur : seule cette valeur est envoyee et comparee.
   */
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

  // ── Detection du pseudo Twitch connecte ──────────────────────────────────

  function detectCurrentTwitchUser() {
    try {
      // 1. Cookie Twitch "login" (non-HttpOnly, accessible en JS)
      var cookieMatch = document.cookie.match(/(?:^|;\s*)login=([^;]+)/);
      if (cookieMatch && cookieMatch[1]) {
        return decodeURIComponent(cookieMatch[1]).trim().toLowerCase();
      }

      // 2. Attribut aria-label sur le bouton user menu
      var userMenuBtn = document.querySelector('[data-a-target="user-menu-toggle"]');
      if (userMenuBtn) {
        var label = userMenuBtn.getAttribute("aria-label") || "";
        var m = label.match(/^([a-zA-Z0-9_]+)/);
        if (m) return m[1].toLowerCase();
      }

      // 3. Lien profil dans le menu deroulant
      var profileLink = document.querySelector('a[data-a-target="user-profile-link"], a[href*="/settings/profile"]');
      if (profileLink) {
        var href = profileLink.getAttribute("href") || "";
        var pm = href.match(/\/([a-zA-Z0-9_]+)/);
        if (pm) return pm[1].toLowerCase();
      }
    } catch (_e) {}
    return null;
  }

  // ── Enregistrement et synchronisation ────────────────────────────────────

  function registerCurrentUser(username) {
    if (!username) return;

    hashLogin(username).then(function (hash) {
      if (!hash) return;
      badgeHashes.add(hash);
      log("utilisateur detecte, empreinte enregistree");

      try {
        chrome.storage.local.get([STORAGE_KEY, "lastBadgeSync"], function (res) {
          var stored = (res && res[STORAGE_KEY]) || [];
          var set = new Set(stored);
          set.add(hash);
          badgeHashes = set;
          chrome.storage.local.set({ [STORAGE_KEY]: Array.from(set) });

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
              log("sync API OK");
            }).catch(function (e) {
              log("sync API echouee :", e.message);
            });
          }
        });
      } catch (_e) {}
    });
  }

  function fetchRemoteBadges() {
    try {
      fetch(API_URL)
        .then(function (res) {
          if (!res.ok) return [];
          return res.json();
        })
        .then(function (data) {
          if (!Array.isArray(data) || !data.length) return;
          for (var i = 0; i < data.length; i++) {
            var hash = String(data[i] || "").toLowerCase().trim();
            // Ignorer tout ce qui n'a pas la forme d'une empreinte : une
            // reponse d'une ancienne version contiendrait des pseudos.
            if (/^[a-f0-9]{12}$/.test(hash)) badgeHashes.add(hash);
          }
          chrome.storage.local.set({ [STORAGE_KEY]: Array.from(badgeHashes) });
          log(badgeHashes.size, "empreintes chargees");
          rescanVisibleMessages();
        })
        .catch(function () {});
    } catch (_e) {}
  }

  /**
   * Repasse sur les messages deja affiches, une fois la liste distante connue.
   * Seules les lignes sans badge sont reprises.
   */
  function rescanVisibleMessages() {
    try {
      var messages = document.querySelectorAll(MESSAGE_SELECTORS);
      for (var i = 0; i < messages.length; i++) {
        var el = messages[i];
        if (el.querySelector(".sp-chat-badge")) continue;
        el.classList.remove("sp-badge-processed");
        processMessageLine(el);
      }
    } catch (_e) {}
  }

  function initBadges() {
    try {
      chrome.storage.local.get(STORAGE_KEY, function (res) {
        if (res && Array.isArray(res[STORAGE_KEY])) {
          res[STORAGE_KEY].forEach(function (h) {
            badgeHashes.add(String(h).toLowerCase().trim());
          });
        }
        // Les versions precedentes stockaient des pseudos en clair : on ne les
        // convertit pas, on les supprime.
        chrome.storage.local.remove(LEGACY_STORAGE_KEY);

        currentTwitchUser = detectCurrentTwitchUser();
        if (currentTwitchUser) {
          registerCurrentUser(currentTwitchUser);
        } else {
          log("pseudo non detecte, nouvelle tentative dans 5s");
        }
        fetchRemoteBadges();
      });
    } catch (_e) {}
  }

  // ── Extraction du pseudo depuis un message de tchat ──────────────────────

  function getMessageUsername(messageEl) {
    try {
      // 1. Twitch natif : data-a-user sur le lien auteur
      var nativeAuthor = messageEl.querySelector(
        '[data-a-target="chat-message-username"], ' +
        'a.chat-author__display-name, ' +
        'button.chat-author__display-name'
      );
      if (nativeAuthor) {
        var user = nativeAuthor.getAttribute("data-a-user");
        if (user) return user.trim().toLowerCase();
        // Fallback : texte du pseudo
        var text = (nativeAuthor.textContent || "").trim().toLowerCase();
        if (text && /^[a-z0-9_]{3,25}$/.test(text)) return text;
      }

      // 2. 7TV : bouton utilisateur avec data attribute ou classe
      var seventvUser = messageEl.querySelector(
        '.seventv-chat-user, ' +
        '[class*="chat-user"], ' +
        '[data-seventv-chat-username]'
      );
      if (seventvUser) {
        // data attribute
        var stv = seventvUser.getAttribute("data-seventv-chat-username") ||
                  seventvUser.getAttribute("data-chat-user") ||
                  seventvUser.getAttribute("data-username");
        if (stv) return stv.trim().toLowerCase();

        // Lien href /username
        var href = seventvUser.getAttribute("href") || "";
        var hm = href.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
        if (!hm) hm = href.match(/\/([a-zA-Z0-9_]+)$/);
        if (hm) return hm[1].toLowerCase();

        // Texte du bouton (display name, souvent == login en minuscule)
        var st = (seventvUser.textContent || "").trim().toLowerCase();
        if (st && /^[a-z0-9_]{3,25}$/.test(st)) return st;
      }

      // 3. Fallback generique : tout element contenant un lien profil Twitch
      var anyLink = messageEl.querySelector('a[href*="twitch.tv/"]');
      if (anyLink) {
        var lm = (anyLink.getAttribute("href") || "").match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
        if (lm) return lm[1].toLowerCase();
      }
    } catch (_e) {}
    return null;
  }

  // ── Creation du badge ────────────────────────────────────────────────────

  function normalizeColorMode(value) {
    if (value === "theme" || value === "author") return value;
    if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim())) {
      return value.trim().toLowerCase();
    }
    return "author";
  }

  /** Blanc sur le theme sombre de Twitch, noir sur le theme clair. */
  function themeColor() {
    var root = document.documentElement;
    var dark = root.classList.contains("tw-root--theme-dark") ||
      (document.body && document.body.classList.contains("dark-theme"));
    return dark ? "#ffffff" : "#0e0e10";
  }

  /**
   * Couleur du pseudo, telle que Twitch la pose sur l'element auteur. Un
   * pseudo sans couleur, ou un tchat remplace par 7TV, retombe sur le theme :
   * le badge ne doit jamais devenir invisible.
   */
  function authorColor(messageEl) {
    try {
      var el = messageEl.querySelector(
        '[data-a-target="chat-message-username"], ' +
        '.chat-author__display-name, ' +
        '.seventv-chat-user-username, ' +
        '[class*="chat-user"] span'
      );
      while (el) {
        var inline = el.style && el.style.color;
        if (inline) return inline;
        var computed = getComputedStyle(el).color;
        if (computed && computed !== "rgba(0, 0, 0, 0)") return computed;
        el = el.parentElement;
        if (el === messageEl) break;
      }
    } catch (_e) {}
    return themeColor();
  }

  function resolveBadgeColor(messageEl) {
    if (badgeColorMode === "author") return authorColor(messageEl);
    if (badgeColorMode === "theme") return themeColor();
    return badgeColorMode;
  }

  function createBadgeElement(messageEl) {
    var badge = document.createElement("span");
    badge.className = "sp-chat-badge";
    badge.setAttribute("title", "Utilisateur StreamPulse");
    badge.setAttribute("aria-label", "Utilisateur StreamPulse");

    // Le logo est un PNG monochrome applique en masque : il prend donc la
    // couleur de fond, ce qu'une balise <img> ne permettrait pas.
    var mark = document.createElement("span");
    mark.className = "sp-chat-badge-img";
    // Le masque est pose directement sur l'element : passe par une variable CSS
    // consommee dans la feuille de style, une URL relative serait resolue par
    // rapport a la feuille et non au document.
    var mask = "url(" + badgeIconUrl + ")";
    mark.style.setProperty("-webkit-mask-image", mask);
    mark.style.setProperty("mask-image", mask);
    mark.style.setProperty("--sp-badge-color", resolveBadgeColor(messageEl));

    badge.appendChild(mark);
    return badge;
  }

  // ── Injection dans un message ────────────────────────────────────────────

  function processMessageLine(messageEl) {
    if (!messageEl || messageEl.classList.contains("sp-badge-processed")) return;
    messageEl.classList.add("sp-badge-processed");

    var username = getMessageUsername(messageEl);
    if (!username) return;

    // Le hachage est asynchrone : la ligne est marquee traitee tout de suite
    // pour ne pas la reprendre, et le badge arrive au tour suivant.
    hashLogin(username).then(function (hash) {
      if (hash && badgeHashes.has(hash)) injectBadge(messageEl);
    });
  }

  /**
   * Les conteneurs de badges n'espacent pas tous leurs enfants de la meme
   * facon : Twitch pose une marge sur ses propres badges, 7TV parfois un gap.
   * Plutot que de parier, on mesure l'espace reellement obtenu et on ne pose
   * une marge que s'il n'y en a pas — sinon le badge est colle au precedent.
   */
  function ensureSpacing(badge) {
    try {
      var prev = badge.previousElementSibling;
      if (!prev) return;
      var gap = badge.getBoundingClientRect().left - prev.getBoundingClientRect().right;
      if (gap < 3) badge.classList.add("sp-chat-badge--spaced");
    } catch (_e) {}
  }

  function injectBadge(messageEl) {
    // 1. Conteneur de badges Twitch natif
    var badgesContainer = messageEl.querySelector(
      '.chat-line__message--badges, ' +
      '[data-a-target="chat-badges"]'
    );
    if (badgesContainer && !badgesContainer.querySelector(".sp-chat-badge")) {
      var nativeBadge = createBadgeElement(messageEl);
      badgesContainer.appendChild(nativeBadge);
      ensureSpacing(nativeBadge);
      return;
    }

    // 2. Conteneur de badges 7TV
    var stvBadges = messageEl.querySelector(
      '.seventv-chat-user-badge-list, ' +
      '[class*="badge-list"], ' +
      '[class*="chat-badge"]'
    );
    if (stvBadges && !stvBadges.querySelector(".sp-chat-badge")) {
      var stvBadge = createBadgeElement(messageEl);
      stvBadges.appendChild(stvBadge);
      ensureSpacing(stvBadge);
      return;
    }

    // 3. Fallback : inserer juste avant le pseudo
    var usernameEl = messageEl.querySelector(
      '[data-a-target="chat-message-username"], ' +
      '.chat-author__display-name, ' +
      '.seventv-chat-user, ' +
      '[class*="chat-user"]'
    );
    if (usernameEl && usernameEl.parentNode && !usernameEl.parentNode.querySelector(".sp-chat-badge")) {
      var standalone = createBadgeElement(messageEl);
      standalone.classList.add("sp-chat-badge--standalone");
      usernameEl.parentNode.insertBefore(standalone, usernameEl);
    }
  }

  // ── Observation du tchat ─────────────────────────────────────────────────

  // Selecteurs pour identifier une ligne de message individuelle
  var MESSAGE_SELECTORS = [
    '.chat-line__message',
    '[data-a-target="chat-line-message"]',
    '.seventv-message',
    '[class*="seventv-chat-message"]',
    '[data-seventv-message-context]',
    '[class*="chat-entry"]'
  ].join(", ");

  // Selecteurs pour le conteneur scrollable du tchat
  var CONTAINER_SELECTORS = [
    '.chat-scrollable-area__message-container',
    '[data-a-target="chat-scroller"]',
    '.seventv-chat-scroller',
    '.seventv-chat-message-container',
    '[class*="seventv"][class*="scroller"]',
    '.chat-room .simplebar-scroll-content',
    '.chat-list .simplebar-scroll-content',
    '.chat-room'
  ].join(", ");

  function setupChatObserver() {
    var chatObserver = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var mut = mutations[i];
        for (var j = 0; j < mut.addedNodes.length; j++) {
          var node = mut.addedNodes[j];
          if (node.nodeType !== 1) continue;

          // Le noeud ajoute est-il lui-meme un message ?
          if (node.matches && node.matches(MESSAGE_SELECTORS)) {
            processMessageLine(node);
          }

          // Ou contient-il des messages ?
          if (node.querySelectorAll) {
            var subMessages = node.querySelectorAll(MESSAGE_SELECTORS);
            for (var k = 0; k < subMessages.length; k++) {
              processMessageLine(subMessages[k]);
            }
          }
        }
      }
    });

    var currentContainer = null;

    function attachObserver() {
      var chatContainer = document.querySelector(CONTAINER_SELECTORS);
      if (chatContainer && chatContainer !== currentContainer) {
        chatObserver.disconnect();
        chatObserver.observe(chatContainer, { childList: true, subtree: true });
        currentContainer = chatContainer;
        log("observe sur", chatContainer.className || chatContainer.tagName);

        // Traiter les messages deja presents
        var existing = chatContainer.querySelectorAll(MESSAGE_SELECTORS);
        log(existing.length, "messages existants a traiter");
        for (var e = 0; e < existing.length; e++) {
          processMessageLine(existing[e]);
        }
      }
    }

    attachObserver();
    setInterval(attachObserver, 2000);
  }

  // ── Demarrage ────────────────────────────────────────────────────────────

  // Verifie la preference avant de demarrer
  try {
    // Les preferences vivent sous "betaGeneralPreferences" (PREFERENCES_KEY dans
    // background.js) : lire "preferences" renvoyait toujours undefined, donc le
    // reglage "Badge communautaire" ne desactivait jamais rien.
    chrome.storage.local.get("betaGeneralPreferences", function (res) {
      var prefs = (res && res.betaGeneralPreferences) || {};
      if (prefs.communityBadge === false) {
        log("desactive par l utilisateur");
        return;
      }

      badgeColorMode = normalizeColorMode(prefs.communityBadgeColor);
      log("init", badgeIconUrl ? "icone OK" : "icone MANQUANTE", "| couleur :", badgeColorMode);
      initBadges();
      setupChatObserver();

      setInterval(function () {
        if (!currentTwitchUser) {
          currentTwitchUser = detectCurrentTwitchUser();
          if (currentTwitchUser) {
            registerCurrentUser(currentTwitchUser);
          }
        }
      }, 5000);
    });
  } catch (_e) {
    // Fallback si chrome.storage indisponible : demarrer quand meme
    initBadges();
    setupChatObserver();
  }
})();
