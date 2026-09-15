(function () {
  "use strict";

  var LOG = "[SP-Badge]";

  // Journalisation de debogage, muette par defaut. Activer dans la console de
  // l'onglet Twitch avec localStorage.setItem("SP_DEBUG", "1"), comme
  // quickFollow.js. Sans cela le badge imprimait a chaque balayage du tchat,
  // dans la console de tous les utilisateurs. On accepte "2" au meme titre que
  // "1" : le niveau verbeux de quickFollow.js ne doit pas eteindre les traces
  // des autres scripts injectes.
  var DEBUG = false;
  try {
    var flag = localStorage.getItem("SP_DEBUG");
    DEBUG = flag === "1" || flag === "2" || flag === "trace";
  } catch (_e) {
    // localStorage est refuse dans certains contextes, cookies bloques ou iframe cloisonnee : on reste en mode non verbeux.
  }

  function log() {
    if (!DEBUG) return;
    try {
      console.log.apply(console, [LOG].concat(Array.prototype.slice.call(arguments)));
    } catch (_e) {
      // La journalisation ne doit jamais casser ce qu'elle observe.
    }
  }
  var API_URL = "https://streampulse.fr/api/streampulse-badges";
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

  // Couleurs publiques des abonnes StreamPulse+ : empreinte -> couleur hexa.
  var badgeColors = new Map();
  var PLUS_KEY = "streamPulsePlus";
  var PUBLISHED_KEY = "streampulseBadgePublished";
  var HEX_RE = /^#[0-9a-f]{6}$/i;
  var PLUS_GRACE_MS = 30 * 24 * 60 * 60 * 1000;
  // Effets publics des abonnes : empreinte -> { b: effet du badge, n: pseudo special }.
  var badgeStyles = new Map();
  var COSMETICS_KEY = "streamPulseCosmetics";
  var BADGE_FX = ["pulse", "shine", "rainbow", "glow", "bounce", "spin", "flicker"];
  var NAME_FX = ["aurora", "sunset", "lcd", "gold", "neon", "rainbow"];
  var REFRESH_MS = 5 * 60 * 1000;
  // Empreinte du compte Twitch connecte et licence de ce navigateur.
  var ownHash = "";
  var viewerPlus = false;
  var ownPlan = "";
  var badgeLang = "en";
  var MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;
  // Reglages locaux de son propre badge : appliques tout de suite, sans attendre le serveur.
  var ownLocal = { color: null, b: "", n: "" };

  function readOwnLocal(prefs, cosmetics) {
    var color = prefs && HEX_RE.test(prefs.communityBadgeColor || "") ? prefs.communityBadgeColor.toLowerCase() : null;
    var c = cosmetics || {};
    ownLocal = {
      color: color,
      b: BADGE_FX.indexOf(c.badgeFx) !== -1 ? c.badgeFx : "",
      n: NAME_FX.indexOf(c.nameFx) !== -1 ? c.nameFx : ""
    };
  }

  /** Son propre badge suit les reglages de ce navigateur, meme avant la reponse du serveur. */
  function applyOwnLocal() {
    if (!ownHash) return;
    if (viewerPlus && ownLocal.color) badgeColors.set(ownHash, ownLocal.color);
    else badgeColors.delete(ownHash);
    if (viewerPlus) {
      // Formule et anciennete viennent du serveur ; en attendant, la licence locale suffit.
      var known = badgeStyles.get(ownHash) || {};
      badgeStyles.set(ownHash, { b: ownLocal.b, n: ownLocal.n, p: known.p || ownPlan, s: known.s || 0 });
    } else {
      badgeStyles.delete(ownHash);
    }
  }

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
    } catch (_e) {
      // Le cookie peut etre absent ou illisible selon le contexte : on tentera les autres sources.
    }
    return null;
  }

  // ── Enregistrement et synchronisation ────────────────────────────────────

  function registerCurrentUser(username) {
    if (!username) return;

    hashLogin(username).then(function (hash) {
      if (!hash) return;
      badgeHashes.add(hash);
      ownHash = hash;
      applyOwnLocal();
      // Les messages deja affiches ont ete lus avant que le compte soit reconnu :
      // on reprend ceux restes sans badge, puis on applique les effets.
      rescanVisibleMessages();
      refreshVisibleCosmetics();
      log("utilisateur detecte, empreinte enregistree");
      publishBadgeColor(hash);

      try {
        chrome.storage.local.get([STORAGE_KEY, "lastBadgeSync"], function (res) {
          // Ajout, jamais remplacement : la liste distante a pu arriver entre-temps.
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
              log("sync API OK");
            }).catch(function (e) {
              log("sync API echouee :", e.message);
            });
          }
        });
      } catch (_e) {
        // Service worker endormi, ou contexte d'extension invalide par une mise a jour : le message est perdu sans consequence ici.
      }
    });
  }

  function fetchRemoteBadges() {
    try {
      fetch(API_URL + "?v=2")
        .then(function (res) {
          if (!res.ok) return [];
          return res.json();
        })
        .then(function (data) {
          // v2 : { hashes, colors } ; une ancienne reponse reste un tableau.
          var list = Array.isArray(data) ? data : (data && Array.isArray(data.hashes) ? data.hashes : []);
          var colors = data && !Array.isArray(data) && data.colors && typeof data.colors === "object" ? data.colors : {};
          var nextColors = new Map();
          Object.keys(colors).forEach(function (h) {
            var color = String(colors[h] || "").toLowerCase();
            if (/^[a-f0-9]{12}$/.test(h) && HEX_RE.test(color)) nextColors.set(h, color);
          });
          badgeColors = nextColors;
          var styles = data && !Array.isArray(data) && data.styles && typeof data.styles === "object" ? data.styles : {};
          var nextStyles = new Map();
          Object.keys(styles).forEach(function (h) {
            var style = styles[h] || {};
            var b = BADGE_FX.indexOf(style.b) !== -1 ? style.b : "";
            var n = NAME_FX.indexOf(style.n) !== -1 ? style.n : "";
            var p = style.p === "lifetime" || style.p === "monthly" ? style.p : "";
            var since = Number(style.s) || 0;
            if (/^[a-f0-9]{12}$/.test(h) && (b || n || p)) nextStyles.set(h, { b: b, n: n, p: p, s: since });
          });
          badgeStyles = nextStyles;
          applyOwnLocal();
          refreshVisibleCosmetics();
          if (!list.length) {
            rescanVisibleMessages();
            return;
          }
          for (var i = 0; i < list.length; i++) {
            var hash = String(list[i] || "").toLowerCase().trim();
            // Ignorer tout ce qui n'a pas la forme d'une empreinte : une
            // reponse d'une ancienne version contiendrait des pseudos.
            if (/^[a-f0-9]{12}$/.test(hash)) badgeHashes.add(hash);
          }
          chrome.storage.local.set({ [STORAGE_KEY]: Array.from(badgeHashes) });
          log(badgeHashes.size, "empreintes chargees,", badgeColors.size, "couleurs");
          rescanVisibleMessages();
        })
        .catch(function () {});
    } catch (_e) {
      // Le service de badges est optionnel : son indisponibilite ne doit pas gener le tchat.
    }
  }

  /** Cle de licence si StreamPulse+ est actif (meme regle que js/plus.js). */
  function activePlusKey(record) {
    if (!record || record.status !== "active" || !record.licenseKey) return null;
    if (record.plan === "lifetime") return record.licenseKey;
    return Date.now() - (Number(record.verifiedAt) || 0) <= PLUS_GRACE_MS ? record.licenseKey : null;
  }

  /**
   * Publie la couleur personnalisee d'un abonne StreamPulse+ pour que les
   * autres utilisateurs la voient. Republiee chaque jour : le serveur oublie
   * une couleur non confirmee depuis 3 jours, donc a la fin de l'abonnement.
   */
  function publishBadgeColor(hash) {
    if (!hash) return;
    try {
      chrome.storage.local.get([PLUS_KEY, PUBLISHED_KEY, COSMETICS_KEY, "betaGeneralPreferences"], function (res) {
        var key = activePlusKey(res && res[PLUS_KEY]);
        if (!key) return;
        var prefs = (res && res.betaGeneralPreferences) || {};
        var color = HEX_RE.test(prefs.communityBadgeColor || "") ? prefs.communityBadgeColor.toLowerCase() : null;
        var cosmetics = (res && res[COSMETICS_KEY]) || {};
        var badgeFx = BADGE_FX.indexOf(cosmetics.badgeFx) !== -1 ? cosmetics.badgeFx : "";
        var nameFx = NAME_FX.indexOf(cosmetics.nameFx) !== -1 ? cosmetics.nameFx : "";
        var today = new Date().toISOString().slice(0, 10);
        var wanted = [hash, color || "none", badgeFx, nameFx, today].join("|");
        if ((res && res[PUBLISHED_KEY]) === wanted) return;
        fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hash: hash, color: color, badgeFx: badgeFx, nameFx: nameFx, key: key })
        }).then(function (response) {
          if (!response.ok) throw new Error("HTTP " + response.status);
          var saved = {};
          saved[PUBLISHED_KEY] = wanted;
          chrome.storage.local.set(saved);
          log("reglages publies");
          log("couleur publiee");
        }).catch(function (e) {
          log("couleur non publiee :", e.message);
        });
      });
    } catch (_e) {
      // Contexte d'extension invalide apres une mise a jour : on reessaiera au prochain chargement.
    }
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
    } catch (_e) {
      // Twitch reconstruit son DOM en permanence : le noeud peut disparaitre entre sa selection et son usage.
    }
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
    } catch (_e) {
      // Service worker endormi, ou contexte d'extension invalide par une mise a jour : le message est perdu sans consequence ici.
    }
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
    } catch (_e) {
      // Twitch reconstruit son DOM en permanence : le noeud peut disparaitre entre sa selection et son usage.
    }
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
    } catch (_e) {
      // Twitch reconstruit son DOM en permanence : le noeud peut disparaitre entre sa selection et son usage.
    }
    return themeColor();
  }

  /**
   * Couleur d'un badge. Celle qu'un abonne StreamPulse+ a choisie pour son
   * propre badge l'emporte toujours ; sinon le reglage de ce navigateur
   * (couleur du pseudo ou selon le theme) s'applique. La couleur personnalisee
   * ne concerne que son propre badge, et seulement avec StreamPulse+.
   */
  function resolveBadgeColor(messageEl, hash) {
    if (hash && hash === ownHash && viewerPlus && HEX_RE.test(badgeColorMode)) return badgeColorMode;
    var publicColor = hash && badgeColors.get(hash);
    if (publicColor) return publicColor;
    return badgeColorMode === "theme" ? themeColor() : authorColor(messageEl);
  }

  function createBadgeElement(messageEl, hash) {
    var badge = document.createElement("span");
    badge.className = "sp-chat-badge";
    if (hash) badge.setAttribute("data-sp-hash", hash);
    // La carte au survol remplace l'infobulle du navigateur ; le libelle reste pour les lecteurs d'ecran.
    badge.setAttribute("aria-label", "StreamPulse");

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
    mark.style.setProperty("--sp-badge-color", resolveBadgeColor(messageEl, hash));
    var style = hash && badgeStyles.get(hash);
    if (style && style.b) badge.classList.add("sp-chat-badge--fx-" + style.b);

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
      if (hash && badgeHashes.has(hash)) {
        injectBadge(messageEl, hash);
        applyPaint(messageEl, hash);
      }
    });
  }

  /**
   * Les conteneurs de badges n'espacent pas tous leurs enfants de la meme
   * facon : Twitch pose une marge sur ses propres badges, 7TV parfois un gap.
   * Plutot que de parier, on mesure l'espace reellement obtenu et on ne pose
   * une marge que s'il n'y en a pas : sinon le badge est colle au precedent.
   */
  function ensureSpacing(badge) {
    try {
      var prev = badge.previousElementSibling;
      if (!prev) return;
      var gap = badge.getBoundingClientRect().left - prev.getBoundingClientRect().right;
      if (gap < 3) badge.classList.add("sp-chat-badge--spaced");
    } catch (_e) {
      // Twitch reconstruit son DOM en permanence : le noeud peut disparaitre entre sa selection et son usage.
    }
  }

  /**
   * Emplacement des badges d'une ligne de tchat.
   *
   * Depuis 2026, Twitch n'a plus de conteneur .chat-line__message--badges : les
   * badges vivent dans le <span> qui precede .chat-line__username, vide quand
   * l'auteur n'en a aucun. L'ancien repli [class*="chat-badge"] attrapait alors
   * l'<img class="chat-badge"> d'un badge d'abonne, et le logo, insere dans une
   * image, ne s'affichait jamais. Un repli ne doit donc jamais viser une image.
   */
  function findBadgeSlot(messageEl) {
    var username = messageEl.querySelector(".chat-line__username");
    var slot = username && username.previousElementSibling;
    if (slot && slot.tagName === "SPAN") return slot;

    // Anciennes structures Twitch, puis 7TV.
    return messageEl.querySelector(
      '.chat-line__message--badges, ' +
      '[data-a-target="chat-badges"], ' +
      '.seventv-chat-user-badge-list, ' +
      '[class*="badge-list"]:not(img)'
    );
  }

  /** Pseudo special d'un abonne StreamPulse+ (degrade, neon…), comme les « paints » de 7TV. */
  function applyPaint(messageEl, hash) {
    var style = badgeStyles.get(hash);
    if (!style || !style.n) return;
    try {
      var name = messageEl.querySelector(
        '[data-a-target="chat-message-username"], .chat-author__display-name, .seventv-chat-user-username'
      );
      if (!name || name.classList.contains("sp-paint")) return;
      name.classList.add("sp-paint", "sp-paint--" + style.n);
      var glow = badgeColors.get(hash) || authorColor(messageEl);
      if (glow) name.style.setProperty("--sp-paint-glow", glow);
    } catch (_e) {
      // Twitch reconstruit son DOM en permanence : le noeud peut disparaitre entre sa selection et son usage.
    }
  }

  // ── Carte au survol du badge ─────────────────────────────────────────────

  var badgeCard = null;

  function tr(key, params) {
    var api = typeof window !== "undefined" ? window.__SP_I18N__ : null;
    return api ? api.get(badgeLang, "badge." + key, params) : key;
  }

  /** Une seule carte pour tout le tchat, creee au premier survol. */
  function getBadgeCard() {
    if (badgeCard && badgeCard.isConnected) return badgeCard;
    badgeCard = document.createElement("div");
    badgeCard.className = "sp-badge-card";
    badgeCard.setAttribute("role", "tooltip");
    var logo = document.createElement("span");
    logo.className = "sp-badge-card__logo";
    var mask = "url(" + badgeIconUrl + ")";
    logo.style.setProperty("-webkit-mask-image", mask);
    logo.style.setProperty("mask-image", mask);
    var title = document.createElement("span");
    title.className = "sp-badge-card__title";
    var line = document.createElement("span");
    line.className = "sp-badge-card__line";
    badgeCard.append(logo, title, line);
    document.body.appendChild(badgeCard);
    return badgeCard;
  }

  function memberLine(style) {
    if (style.p === "lifetime") return tr("lifetime");
    var months = style.s ? Math.floor((Date.now() - style.s) / MONTH_MS) : 0;
    if (months < 1) return tr("newMember");
    return months === 1 ? tr("monthOne") : tr("months", { count: months });
  }

  function showBadgeCard(badge) {
    try {
      var hash = badge.getAttribute("data-sp-hash");
      var style = hash && badgeStyles.get(hash);
      var plus = !!(style && style.p);
      var card = getBadgeCard();
      card.classList.toggle("is-plus", plus);
      var title = card.querySelector(".sp-badge-card__title");
      title.textContent = "StreamPulse";
      if (plus) {
        var mark = document.createElement("b");
        mark.textContent = "+";
        title.appendChild(mark);
      }
      card.querySelector(".sp-badge-card__line").textContent = plus ? memberLine(style) : tr("freeLine");
      var rect = badge.getBoundingClientRect();
      card.classList.add("is-visible");
      var width = card.offsetWidth;
      var height = card.offsetHeight;
      var top = rect.top - height - 8;
      if (top < 8) top = rect.bottom + 8;
      var left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
      card.style.top = top + "px";
      card.style.left = left + "px";
    } catch (_e) {
      // Le message a pu disparaitre du tchat pendant le survol.
    }
  }

  function hideBadgeCard() {
    if (badgeCard) badgeCard.classList.remove("is-visible");
  }

  function setupBadgeCard() {
    // Delegation : deux ecouteurs pour tout le tchat, aucun par badge.
    document.addEventListener("mouseover", function (event) {
      var badge = event.target && event.target.closest ? event.target.closest(".sp-chat-badge") : null;
      if (badge) showBadgeCard(badge);
    }, true);
    document.addEventListener("mouseout", function (event) {
      var badge = event.target && event.target.closest ? event.target.closest(".sp-chat-badge") : null;
      if (badge && !badge.contains(event.relatedTarget)) hideBadgeCard();
    }, true);
    window.addEventListener("scroll", hideBadgeCard, true);
  }

  /** Reapplique couleur, effet et pseudo special aux messages deja affiches. */
  function refreshVisibleCosmetics() {
    try {
      var badges = document.querySelectorAll(".sp-chat-badge[data-sp-hash]");
      for (var i = 0; i < badges.length; i++) {
        var badge = badges[i];
        var hash = badge.getAttribute("data-sp-hash");
        var line = badge.closest(MESSAGE_SELECTORS);
        if (!line) continue;
        var mark = badge.querySelector(".sp-chat-badge-img");
        if (mark) mark.style.setProperty("--sp-badge-color", resolveBadgeColor(line, hash));
        badge.className = badge.className.replace(/\bsp-chat-badge--fx-\S+/g, "").replace(/\s+/g, " ").trim();
        var style = badgeStyles.get(hash);
        if (style && style.b) badge.classList.add("sp-chat-badge--fx-" + style.b);
        var name = line.querySelector('[data-a-target="chat-message-username"], .chat-author__display-name, .seventv-chat-user-username');
        if (name) {
          name.className = name.className.replace(/\bsp-paint(--\S+)?/g, "").replace(/\s+/g, " ").trim();
          name.style.removeProperty("--sp-paint-glow");
        }
        applyPaint(line, hash);
      }
    } catch (_e) {
      // Twitch reconstruit son DOM en permanence : le noeud peut disparaitre entre sa selection et son usage.
    }
  }

  function injectBadge(messageEl, hash) {
    if (messageEl.querySelector(".sp-chat-badge")) return;

    var slot = findBadgeSlot(messageEl);
    if (slot) {
      var badge = createBadgeElement(messageEl, hash);
      // Seul dans son emplacement, rien ne l'espace du pseudo qui suit.
      if (!slot.children.length) badge.classList.add("sp-chat-badge--standalone");
      slot.appendChild(badge);
      ensureSpacing(badge);
      return;
    }

    // Repli : inserer juste avant le pseudo
    var usernameEl = messageEl.querySelector(
      '[data-a-target="chat-message-username"], ' +
      '.chat-author__display-name, ' +
      '.seventv-chat-user, ' +
      '[class*="chat-user"]:not(img)'
    );
    if (usernameEl && usernameEl.parentNode) {
      var standalone = createBadgeElement(messageEl, hash);
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
    chrome.storage.local.get(["betaGeneralPreferences", PLUS_KEY, COSMETICS_KEY], function (res) {
      var prefs = (res && res.betaGeneralPreferences) || {};
      viewerPlus = !!activePlusKey(res && res[PLUS_KEY]);
      ownPlan = viewerPlus ? (res[PLUS_KEY].plan === "monthly" ? "monthly" : "lifetime") : "";
      var i18n = typeof window !== "undefined" ? window.__SP_I18N__ : null;
      badgeLang = i18n ? i18n.resolve(prefs.language || navigator.language) : "en";
      readOwnLocal(prefs, res && res[COSMETICS_KEY]);
      // Badge desactive par defaut depuis 26.9.18 : il envoie une empreinte du
      // pseudo, donc il ne demarre qu'avec l'accord explicite de l'utilisateur.
      if (prefs.communityBadge !== true) {
        log("desactive (non active par l utilisateur)");
        return;
      }

      badgeColorMode = normalizeColorMode(prefs.communityBadgeColor);
      log("init", badgeIconUrl ? "icone OK" : "icone MANQUANTE", "| couleur :", badgeColorMode);
      initBadges();
      setupChatObserver();
      setupBadgeCard();
      // Les reglages des autres abonnes arrivent sans recharger la page.
      setInterval(fetchRemoteBadges, REFRESH_MS);

      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area !== "local") return;
        var prefsChange = changes.betaGeneralPreferences;
        var cosmeticsChange = changes[COSMETICS_KEY];
        var plusChange = changes[PLUS_KEY];
        if (!prefsChange && !cosmeticsChange && !plusChange) return;
        if (prefsChange) badgeColorMode = normalizeColorMode((prefsChange.newValue || {}).communityBadgeColor);
        if (plusChange) {
          viewerPlus = !!activePlusKey(plusChange.newValue);
          ownPlan = viewerPlus ? (plusChange.newValue.plan === "monthly" ? "monthly" : "lifetime") : "";
        }
        chrome.storage.local.get(["betaGeneralPreferences", COSMETICS_KEY], function (res) {
          readOwnLocal((res && res.betaGeneralPreferences) || {}, res && res[COSMETICS_KEY]);
          // Aucune requete ni boucle : seuls les messages deja affiches sont retouches.
          applyOwnLocal();
          refreshVisibleCosmetics();
          if (currentTwitchUser) hashLogin(currentTwitchUser).then(publishBadgeColor);
        });
      });

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
