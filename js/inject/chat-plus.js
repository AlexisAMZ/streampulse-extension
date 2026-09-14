/**
 * StreamPulse : effets StreamPulse+ dans les paramètres du tchat Twitch.
 *
 * Ajoute une ligne « Effets StreamPulse+ » sous « Aspect du chat », qui déplie
 * l'éditeur des effets du pseudo et du badge (settings-drawer.js). Twitch
 * reconstruit ce menu à chaque ouverture : la ligne est reposée à chaque fois,
 * en gardant son état déplié.
 */
(function () {
  "use strict";

  if (window.top !== window || window.__SP_CHAT_PLUS__) return;
  window.__SP_CHAT_PLUS__ = true;

  var BALLOON = '[data-a-target="chat-settings-balloon"]';
  var ANCHOR = '[data-a-target="chat-appearance-selector"]';
  var MARK_URL = chrome.runtime.getURL("images/photos/128px.png");
  var CHEVRON =
    '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M7.5 5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var expanded = false;

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function lang() {
    var api = window.__SP_I18N__;
    var htmlLang = document.documentElement.lang || navigator.language;
    return api ? api.resolve(htmlLang) : "en";
  }

  function build() {
    var api = window.__SP_I18N__;
    var drawer = window.__SP_DRAWER__;
    var wrap = el("div", "sp-chatplus" + (expanded ? " is-open" : ""));

    var row = el("button", "sp-chatplus-row");
    row.type = "button";
    row.setAttribute("aria-expanded", String(expanded));
    var mark = el("span", "sp-chatplus-mark");
    var mask = "url(" + MARK_URL + ")";
    mark.style.setProperty("-webkit-mask-image", mask);
    mark.style.setProperty("mask-image", mask);
    row.appendChild(mark);
    row.appendChild(el("span", "sp-chatplus-label", api ? api.get(lang(), "twitchUi.chatRow") : "StreamPulse+"));
    var chevron = el("span", "sp-chatplus-chevron");
    chevron.innerHTML = CHEVRON;
    row.appendChild(chevron);
    wrap.appendChild(row);

    var body = el("div", "sp-chatplus-body");
    if (drawer) body.appendChild(drawer.buildCosmetics({ compact: true }));
    wrap.appendChild(body);

    row.addEventListener("click", function (e) {
      e.stopPropagation();
      expanded = !expanded;
      wrap.classList.toggle("is-open", expanded);
      row.setAttribute("aria-expanded", String(expanded));
    });
    return wrap;
  }

  function ensure() {
    var balloon = document.querySelector(BALLOON);
    if (!balloon || balloon.querySelector(".sp-chatplus")) return;
    var anchor = balloon.querySelector(ANCHOR);
    var holder = anchor && anchor.parentElement;
    if (!holder || !holder.parentElement) return;
    holder.parentElement.insertBefore(build(), holder.nextSibling);
  }

  // Une seule vérification par image : le tchat mute des centaines de fois par seconde.
  var queued = false;
  new MutationObserver(function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      try {
        ensure();
      } catch (_e) {
        // Menu démonté pendant l'insertion : la mutation suivante réessaie.
      }
    });
  }).observe(document.body, { childList: true, subtree: true });

  ensure();
})();
