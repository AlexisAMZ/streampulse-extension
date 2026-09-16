(() => {
  "use strict";

  // Infobulle des boutons StreamPulse dans le lecteur Twitch.
  //
  // Twitch dessine ses propres bulles avec des classes regenerees a chaque
  // build : on ne s'y accroche pas, on reproduit leur apparence. Partage par
  // twitchPlayerEnhancer.js et twitchPlayerButtons.js pour n'avoir qu'un seul
  // style a maintenir.
  //
  // Expose window.__SP_TIP__.attach(element, () => texte).

  if (window.__SP_TIP__) return;

  const STYLE_ID = "streampulse-tip-style";
  const TIP_ID = "streampulse-tip";
  const GAP = 8;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${TIP_ID} {
        position: fixed;
        z-index: 2147483000;
        max-width: 240px;
        padding: 4px 8px;
        border-radius: 4px;
        background: #000000;
        color: #ffffff;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.4;
        text-align: center;
        white-space: pre-line;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.1s ease;
      }
      #${TIP_ID}.is-visible { opacity: 1; }
    `;
    (document.head || document.documentElement)?.appendChild(style);
  }

  function tipElement() {
    let tip = document.getElementById(TIP_ID);
    if (!tip) {
      ensureStyle();
      tip = document.createElement("div");
      tip.id = TIP_ID;
      tip.setAttribute("role", "tooltip");
      document.body?.appendChild(tip);
    }
    return tip;
  }

  function hide() {
    const tip = document.getElementById(TIP_ID);
    if (tip) {
      tip.classList.remove("is-visible");
      tip.style.left = "-9999px";
    }
  }

  function show(anchor, text) {
    if (!text) return;
    const tip = tipElement();
    if (!tip) return;
    tip.textContent = text;
    tip.classList.add("is-visible");

    // Place au-dessus du bouton, recentre, et rabattu dans la fenetre.
    const box = anchor.getBoundingClientRect();
    const size = tip.getBoundingClientRect();
    const left = Math.min(
      Math.max(4, box.left + box.width / 2 - size.width / 2),
      window.innerWidth - size.width - 4
    );
    const above = box.top - size.height - GAP;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(above >= 4 ? above : box.bottom + GAP)}px`;
  }

  /**
   * @param {HTMLElement} element bouton a documenter
   * @param {() => string} getText libelle, relu a chaque survol (langue, etat)
   */
  function attach(element, getText) {
    if (!element || element.dataset.spTip === "1") return;
    element.dataset.spTip = "1";
    const open = () => show(element, getText());
    element.addEventListener("mouseenter", open);
    element.addEventListener("focus", open);
    element.addEventListener("mouseleave", hide);
    element.addEventListener("blur", hide);
    element.addEventListener("click", hide);
  }

  window.__SP_TIP__ = { attach, hide };
  window.addEventListener("scroll", hide, true);
})();
