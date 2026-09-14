/**
 * StreamPulse : favoris dans la barre latérale Twitch (monde isolé).
 *
 * Les favoris sont la liste épinglée du popup (betaPinnedIds) : une seule
 * liste, gérée d'ici ou du popup. Un bloc « Favoris StreamPulse » s'insère
 * au-dessus des chaînes suivies, et chaque carte suivie reçoit une étoile au
 * survol. Épingler une chaîne non suivie par StreamPulse l'ajoute d'abord.
 */
(function () {
  "use strict";

  if (window.top !== window || window.__SP_SIDEBAR_FAVS__) return;
  window.__SP_SIDEBAR_FAVS__ = true;

  var PINS_KEY = "betaPinnedIds";
  var STATUSES_KEY = "betaGeneralStatuses";
  var STREAMERS_KEY = "betaGeneralStreamers";
  var PREFERENCES_KEY = "betaGeneralPreferences";
  var SECTION_ID = "sp-fav-section";
  var FOLLOWED_HEADER = ".followed-side-nav-header";
  var CARD = ".side-nav-card";
  var LOGIN_RE = /^\/([a-z0-9_]{2,25})\/?$/i;

  var STAR =
    '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M10 2.2l2.35 4.9 5.35.7-3.92 3.72 1 5.32L10 14.27l-4.78 2.57 1-5.32L2.3 7.8l5.35-.7z" fill="currentColor"/></svg>';

  var state = { pins: [], streamers: [], statuses: {}, lang: "en" };

  function tr(key) {
    var api = window.__SP_I18N__;
    return api ? api.get(state.lang, "twitchUi." + key) : key;
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function alive() {
    return !!(chrome.runtime && chrome.runtime.id);
  }

  function compact(n) {
    try {
      return new Intl.NumberFormat(state.lang, { notation: "compact", maximumFractionDigits: 1 }).format(n || 0);
    } catch (_e) {
      return String(n || 0);
    }
  }

  function loginOfCard(card) {
    var link = card.querySelector("a[href]");
    var match = link && LOGIN_RE.exec(link.getAttribute("href") || "");
    return match ? match[1].toLowerCase() : "";
  }

  function streamerFor(login) {
    for (var i = 0; i < state.streamers.length; i++) {
      var s = state.streamers[i];
      if (s.platform === "twitch" && String(s.handle || s.twitch || "").toLowerCase() === login) return s;
    }
    return null;
  }

  function isPinnedLogin(login) {
    var s = streamerFor(login);
    return !!s && state.pins.indexOf(s.id) !== -1;
  }

  // ---- données ---------------------------------------------------------------
  function load(done) {
    if (!alive()) return;
    chrome.storage.local.get([PINS_KEY, STATUSES_KEY, STREAMERS_KEY, PREFERENCES_KEY], function (r) {
      r = r || {};
      state.pins = Array.isArray(r[PINS_KEY]) ? r[PINS_KEY] : [];
      state.streamers = Array.isArray(r[STREAMERS_KEY]) ? r[STREAMERS_KEY] : [];
      state.statuses = r[STATUSES_KEY] || {};
      var api = window.__SP_I18N__;
      state.lang = api ? api.resolve((r[PREFERENCES_KEY] || {}).language || navigator.language) : "en";
      if (done) done();
    });
  }

  function setPins(next) {
    state.pins = next;
    chrome.storage.local.set({ [PINS_KEY]: next });
    render();
  }

  /** Épingle ou retire ; une chaîne absente de StreamPulse y est ajoutée avant. */
  function togglePin(login) {
    if (!alive() || !login) return;
    var existing = streamerFor(login);
    if (existing) {
      var pinned = state.pins.indexOf(existing.id) !== -1;
      setPins(pinned ? state.pins.filter(function (id) { return id !== existing.id; }) : state.pins.concat(existing.id));
      return;
    }
    chrome.runtime.sendMessage({ type: "addStreamer", platform: "twitch", handle: login }, function (resp) {
      if (chrome.runtime.lastError) return;
      var added = resp && Array.isArray(resp.streamers) ? resp.streamers : null;
      load(function () {
        if (added) state.streamers = added;
        var s = streamerFor(login);
        if (s && state.pins.indexOf(s.id) === -1) setPins(state.pins.concat(s.id));
      });
    });
  }

  // ---- bloc favoris ----------------------------------------------------------
  function favorites() {
    return state.pins
      .map(function (id) {
        var s = null;
        for (var i = 0; i < state.streamers.length; i++) if (state.streamers[i].id === id) s = state.streamers[i];
        if (!s || s.platform !== "twitch") return null;
        // Le service worker range le live dans `active` (voir background.js).
        var raw = state.statuses[s.id] || {};
        return { s: s, st: raw.active || raw };
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return (Number(!!b.st.isLive) - Number(!!a.st.isLive)) || ((b.st.viewers || 0) - (a.st.viewers || 0));
      });
  }

  function row(entry) {
    var login = String(entry.s.handle || entry.s.twitch || "").toLowerCase();
    var live = !!entry.st.isLive;
    var a = el("a", "sp-fav-row" + (live ? " is-live" : ""));
    a.href = "/" + login;
    a.title = entry.s.displayName || login;

    var av = el("span", "sp-fav-av");
    if (entry.s.avatarUrl) {
      var img = document.createElement("img");
      img.src = entry.s.avatarUrl;
      img.alt = "";
      img.loading = "lazy";
      av.appendChild(img);
    } else {
      av.textContent = (entry.s.displayName || login || "?").charAt(0).toUpperCase();
    }
    a.appendChild(av);

    var meta = el("span", "sp-fav-meta");
    meta.appendChild(el("span", "sp-fav-name", entry.s.displayName || login));
    meta.appendChild(el("span", "sp-fav-cat", live ? entry.st.game || "" : tr("offline")));
    a.appendChild(meta);

    if (live) {
      var viewers = el("span", "sp-fav-viewers");
      viewers.appendChild(el("span", "sp-fav-dot"));
      viewers.appendChild(document.createTextNode(compact(entry.st.viewers)));
      a.appendChild(viewers);
    }

    var unpin = el("button", "sp-fav-unpin");
    unpin.type = "button";
    unpin.innerHTML = STAR;
    unpin.setAttribute("aria-label", tr("unpin"));
    unpin.title = tr("unpin");
    unpin.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      togglePin(login);
    });
    a.appendChild(unpin);
    return a;
  }

  function buildSection() {
    var section = el("div", "sp-fav-section");
    section.id = SECTION_ID;
    section.setAttribute("role", "group");
    section.setAttribute("aria-label", tr("favorites"));

    var head = el("div", "sp-fav-head");
    var icon = el("span", "sp-fav-head-ic");
    icon.innerHTML = STAR;
    head.appendChild(icon);
    head.appendChild(el("span", "sp-fav-title", tr("favorites")));
    section.appendChild(head);

    var list = favorites();
    if (!list.length) {
      section.appendChild(el("p", "sp-fav-empty", tr("emptyFavorites")));
    } else {
      list.forEach(function (entry) {
        section.appendChild(row(entry));
      });
    }
    return section;
  }

  // ---- cartes Twitch -----------------------------------------------------------
  function decorateCards(root) {
    Array.prototype.forEach.call(root.querySelectorAll(CARD), function (card) {
      if (card.closest("#" + SECTION_ID)) return;
      var login = loginOfCard(card);
      if (!login) return;
      card.classList.add("sp-fav-host");
      card.classList.toggle("sp-fav-pinned", isPinnedLogin(login));

      var star = card.querySelector(":scope > .sp-fav-star");
      if (!star) {
        star = el("button", "sp-fav-star");
        star.type = "button";
        star.innerHTML = STAR;
        star.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          togglePin(loginOfCard(card));
        });
        card.appendChild(star);
      }
      var label = tr(isPinnedLogin(login) ? "unpin" : "pin");
      star.setAttribute("aria-label", label);
      star.title = label;
    });
  }

  function render() {
    var header = document.querySelector(FOLLOWED_HEADER);
    var followed = header && header.closest(".side-nav-section");
    var existing = document.getElementById(SECTION_ID);
    if (!followed || !followed.parentElement) {
      if (existing) existing.remove();
      return;
    }
    var collapsed = followed.getBoundingClientRect().width < 120;
    var next = buildSection();
    next.classList.toggle("is-collapsed", collapsed);
    if (existing && existing.parentElement === followed.parentElement) existing.replaceWith(next);
    else {
      if (existing) existing.remove();
      followed.parentElement.insertBefore(next, followed);
    }
    decorateCards(followed.parentElement);
  }

  // ---- cycle de vie ------------------------------------------------------------
  var timer = null;
  function schedule(reload) {
    if (timer) return;
    timer = setTimeout(function () {
      timer = null;
      if (reload) load(render);
      else render();
    }, 400);
  }

  // Twitch re-rend la barre latérale en continu : on ne reconstruit que si le
  // bloc a disparu ou si de nouvelles cartes n'ont pas encore leur étoile.
  var observer = new MutationObserver(function () {
    if (!document.getElementById(SECTION_ID) || document.querySelector(CARD + ":not(.sp-fav-host)")) schedule(false);
  });

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local") return;
    if (changes[PINS_KEY] || changes[STATUSES_KEY] || changes[STREAMERS_KEY] || changes[PREFERENCES_KEY]) schedule(true);
  });

  load(function () {
    render();
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
