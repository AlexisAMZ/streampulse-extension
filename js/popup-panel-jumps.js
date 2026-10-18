// Raccourcis « Sur cette page » en tête des rubriques de réglages longues : une
// pastille par groupe, un clic amène au groupe. Rien à traduire : les libellés
// sont ceux des titres de groupe, relus à chaque changement de langue.
import { onLanguageChange } from "./i18n.js";

const MIN_GROUPS = 3;

function labelOf(header) {
  const first = header.firstElementChild;
  const source = first && !first.classList.contains("plus-tag") ? first : header;
  return source.textContent.trim();
}

/** Ajoute la barre de raccourcis sous le titre de chaque rubrique qui a assez de groupes. */
export function createPanelJumps({ root = document } = {}) {
  const search = root.getElementById("settings-search");
  const filterBar = root.getElementById("settings-filter");
  const jumps = [];

  for (const panel of root.querySelectorAll(".menu-panel")) {
    const headers = [...panel.children].filter((child) => child.matches?.("h3.settings-group-header"));
    if (headers.length < MIN_GROUPS) continue;
    const title = panel.querySelector(":scope > h2");
    if (!title) continue;
    const nav = document.createElement("nav");
    nav.className = "panel-jumps";
    nav.setAttribute("aria-labelledby", title.id || (title.id = `${panel.id}-title`));
    const buttons = headers.map((header) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "panel-jump";
      button.addEventListener("click", () => {
        const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
        header.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      });
      nav.append(button);
      return { button, header };
    });
    title.after(nav);
    jumps.push({ nav, buttons });
  }

  function label() {
    for (const { buttons } of jumps) {
      for (const { button, header } of buttons) {
        const text = labelOf(header);
        if (button.textContent !== text) button.textContent = text;
      }
    }
  }

  // Une recherche ou un filtre de plateforme masque des groupes : les raccourcis s'effacent le temps du filtre.
  function sync() {
    const filtering = Boolean(search?.value.trim()) || Boolean(filterBar?.querySelector('[data-platform]:not([data-platform="all"])[aria-pressed="true"]'));
    for (const { nav } of jumps) nav.hidden = filtering;
  }

  search?.addEventListener("input", sync);
  filterBar?.addEventListener("click", () => queueMicrotask(sync));
  onLanguageChange(label);
  label();
  sync();
  return { label };
}
