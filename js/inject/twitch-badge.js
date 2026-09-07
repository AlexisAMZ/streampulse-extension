(function () {
  "use strict";

  var LOG = "[SP-Badge]";
  var badgeUsers = new Set();
  var currentTwitchUser = null;
  var badgeIconUrl = (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL)
    ? chrome.runtime.getURL("images/photos/128px.png")
    : "";

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
    badgeUsers.add(username);
    console.log(LOG, "utilisateur detecte :", username);

    try {
      chrome.storage.local.get(["streampulseBadgeUsers", "lastBadgeSync"], function (res) {
        var list = (res && res.streampulseBadgeUsers) || [];
        var set = new Set(list);
        set.add(username);
        badgeUsers = set;
        chrome.storage.local.set({ streampulseBadgeUsers: Array.from(set) });

        var now = Date.now();
        var lastSync = res && res.lastBadgeSync ? res.lastBadgeSync : 0;
        if (now - lastSync > 86400000) {
          fetch("https://alexisamz.fr/api/streampulse-badges", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: username })
          }).then(function () {
            chrome.storage.local.set({ lastBadgeSync: now });
            console.log(LOG, "sync API OK");
          }).catch(function (e) {
            console.log(LOG, "sync API echoue (normal si pas deploye)", e.message);
          });
        }
      });
    } catch (_e) {}
  }

  function fetchRemoteBadges() {
    try {
      fetch("https://alexisamz.fr/api/streampulse-badges")
        .then(function (res) {
          if (!res.ok) return [];
          return res.json();
        })
        .then(function (data) {
          if (Array.isArray(data) && data.length) {
            for (var i = 0; i < data.length; i++) {
              if (data[i]) badgeUsers.add(String(data[i]).toLowerCase().trim());
            }
            if (currentTwitchUser) badgeUsers.add(currentTwitchUser);
            chrome.storage.local.set({ streampulseBadgeUsers: Array.from(badgeUsers) });
            console.log(LOG, badgeUsers.size, "utilisateurs charges");
          }
        })
        .catch(function () {});
    } catch (_e) {}
  }

  function initBadges() {
    try {
      chrome.storage.local.get("streampulseBadgeUsers", function (res) {
        if (res && Array.isArray(res.streampulseBadgeUsers)) {
          res.streampulseBadgeUsers.forEach(function (u) {
            badgeUsers.add(String(u).toLowerCase().trim());
          });
        }
        currentTwitchUser = detectCurrentTwitchUser();
        if (currentTwitchUser) {
          registerCurrentUser(currentTwitchUser);
        } else {
          console.log(LOG, "pseudo non detecte, nouvelle tentative dans 5s");
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

  function createBadgeElement() {
    var badge = document.createElement("span");
    badge.className = "sp-chat-badge";
    badge.setAttribute("title", "Utilisateur StreamPulse");
    badge.setAttribute("aria-label", "Utilisateur StreamPulse");

    var img = document.createElement("img");
    img.className = "sp-chat-badge-img";
    img.src = badgeIconUrl;
    img.alt = "StreamPulse";

    badge.appendChild(img);
    return badge;
  }

  // ── Injection dans un message ────────────────────────────────────────────

  function processMessageLine(messageEl) {
    if (!messageEl || messageEl.classList.contains("sp-badge-processed")) return;
    messageEl.classList.add("sp-badge-processed");

    var username = getMessageUsername(messageEl);
    if (!username || !badgeUsers.has(username)) return;

    // 1. Conteneur de badges Twitch natif
    var badgesContainer = messageEl.querySelector(
      '.chat-line__message--badges, ' +
      '[data-a-target="chat-badges"]'
    );
    if (badgesContainer && !badgesContainer.querySelector(".sp-chat-badge")) {
      badgesContainer.appendChild(createBadgeElement());
      return;
    }

    // 2. Conteneur de badges 7TV
    var stvBadges = messageEl.querySelector(
      '.seventv-chat-user-badge-list, ' +
      '[class*="badge-list"], ' +
      '[class*="chat-badge"]'
    );
    if (stvBadges && !stvBadges.querySelector(".sp-chat-badge")) {
      stvBadges.appendChild(createBadgeElement());
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
      usernameEl.parentNode.insertBefore(createBadgeElement(), usernameEl);
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
        console.log(LOG, "observe sur", chatContainer.className || chatContainer.tagName);

        // Traiter les messages deja presents
        var existing = chatContainer.querySelectorAll(MESSAGE_SELECTORS);
        console.log(LOG, existing.length, "messages existants a traiter");
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
        console.log(LOG, "desactive par l utilisateur");
        return;
      }

      console.log(LOG, "init", badgeIconUrl ? "icone OK" : "icone MANQUANTE");
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
