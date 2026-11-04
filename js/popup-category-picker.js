// Sélecteur de catégories des alertes intelligentes : on choisit un nom
// officiel de la plateforme (recherche Twitch/Kick ou catégorie en cours)
// au lieu de deviner l'orthographe exacte que la règle compare.

import { t } from "./i18n.js";
import { cleanCategoryQuery } from "./category-search.js";
import { MAX_TERMS_PER_RULE, isKnownCategory, normalizeRule } from "./smart-alerts.js";

const DEBOUNCE_MS = 220;
const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
const PLUS_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

let uid = 0;
// Images vues pendant les recherches : les puces choisies gardent leur visuel.
const imageByName = new Map();
const keyOf = (name) => String(name || "").toLowerCase();

function artNode(image) {
  const art = el("span", "smart-cat-art");
  if (image) {
    const img = el("img");
    img.alt = "";
    img.loading = "lazy";
    img.src = image;
    art.append(img);
  }
  return art;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * @param {{ rule: object, platform: string, currentGame: string, onChange: () => void }} options
 * `onChange` est appelé après chaque ajout ou retrait (l'appelant enregistre et redessine).
 */
export function createCategoryField({ rule, platform, currentGame, onChange }) {
  const id = `cat-${++uid}`;
  const root = el("div", "smart-cat");
  const terms = el("div", "smart-terms");
  const known = [currentGame].filter(Boolean);
  const searchable = platform === "twitch" || platform === "kick";

  const commit = (name) => {
    const value = String(name || "").trim();
    if (!value) return;
    rule.games = normalizeRule({ ...rule, games: [...rule.games, value] }).games;
    onChange();
  };

  if (!rule.games.length) terms.append(el("span", "smart-any", t("popup.smart.anyGame")));
  rule.games.forEach((game) => {
    const verified = isKnownCategory(game, known);
    const picture = imageByName.get(keyOf(game));
    const chip = el("span", `smart-term${verified ? " is-verified" : ""}${picture ? " has-art" : ""}`);
    if (picture) chip.append(artNode(picture));
    chip.append(el("span", "smart-term-name", game));
    const remove = el("button");
    remove.type = "button";
    remove.innerHTML = CLOSE_ICON;
    remove.setAttribute("aria-label", t("popup.smart.removeTerm", { term: game }));
    remove.addEventListener("click", () => {
      rule.games = rule.games.filter((value) => value !== game);
      onChange();
    });
    chip.append(remove);
    terms.append(chip);
  });

  root.append(terms);
  if (rule.games.length >= MAX_TERMS_PER_RULE) return root;

  // Catégorie en cours : un clic, nom garanti identique à celui que la règle comparera.
  if (currentGame && !isKnownCategory(currentGame, rule.games)) {
    const now = el("button", "smart-cat-now");
    now.type = "button";
    now.innerHTML = PLUS_ICON;
    now.append(el("span", null, t("popup.smart.useCurrent", { game: currentGame })));
    now.addEventListener("click", () => commit(currentGame));
    root.append(now);
  }

  const field = el("div", "smart-cat-field");
  const input = el("input", "smart-cat-input");
  input.type = "text";
  input.placeholder = t(searchable ? "popup.smart.categorySearch" : "popup.smart.gamePlaceholder");
  input.setAttribute("aria-label", t("popup.smart.gameLine"));
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", id);
  input.autocomplete = "off";
  const list = el("ul", "smart-cat-list");
  list.id = id;
  list.setAttribute("role", "listbox");
  list.hidden = true;
  field.append(input, list);
  root.append(field);

  let items = [];
  let active = -1;
  let timer = 0;
  let ticket = 0;

  const close = () => {
    list.hidden = true;
    items = [];
    active = -1;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  };
  const setActive = (next) => {
    active = next;
    [...list.children].forEach((option, index) => option.setAttribute("aria-selected", String(index === active)));
    if (active >= 0) input.setAttribute("aria-activedescendant", `${id}-${active}`);
    else input.removeAttribute("aria-activedescendant");
  };
  const render = (message) => {
    list.replaceChildren();
    if (message) {
      list.append(el("li", "smart-cat-empty", message));
    } else {
      items.forEach((item, index) => {
        const option = el("li", "smart-cat-option");
        option.id = `${id}-${index}`;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        option.append(artNode(item.image), el("span", "smart-cat-name", item.name));
        option.addEventListener("mousedown", (event) => {
          event.preventDefault();
          commit(item.name);
        });
        list.append(option);
      });
    }
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    setActive(-1);
  };

  async function lookup() {
    const query = cleanCategoryQuery(input.value);
    const mine = ++ticket;
    if (!query || !searchable) return close();
    try {
      const response = await chrome.runtime.sendMessage({ type: "searchCategories", platform, query });
      if (mine !== ticket || document.activeElement !== input) return;
      items = Array.isArray(response?.items) ? response.items : [];
      items.forEach((item) => item.image && imageByName.set(keyOf(item.name), item.image));
      render(items.length ? "" : t(!response || response.error ? "popup.smart.categoryOffline" : "popup.smart.categoryNone"));
    } catch (error) {
      console.warn("[popup] catégories :", error?.message || error);
      close();
    }
  }

  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(lookup, DEBOUNCE_MS);
  });
  input.addEventListener("blur", () => setTimeout(close, 120));
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && items.length) {
      event.preventDefault();
      setActive(active + 1 >= items.length ? 0 : active + 1);
    } else if (event.key === "ArrowUp" && items.length) {
      event.preventDefault();
      setActive(active <= 0 ? items.length - 1 : active - 1);
    } else if (event.key === "Escape" && !list.hidden) {
      event.preventDefault();
      close();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (active >= 0 && items[active]) commit(items[active].name);
      else if (items.length === 1) commit(items[0].name);
      else if (items.length === 0 && input.value.trim()) commit(input.value);
    }
  });
  return root;
}
