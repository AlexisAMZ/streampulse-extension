// Disposition du popup : ordre et visibilité des onglets de la barre du haut
// et des rubriques des Réglages, choisis dans « Général et aide ». Réglages et
// « Général et aide » restent toujours visibles : c'est là qu'on revient en
// arrière. Rangé dans chrome.storage, relu à chaque ouverture.

import { onLanguageChange, t } from "./i18n.js";

const LAYOUT_KEY = "streamPulseLayout";
const LOCKED = new Set(["settings", "general"]);

const $ = (id) => document.getElementById(id);

/** Les deux listes réordonnables : conteneur, éléments et leur identifiant. */
const LISTS = {
  tabs: { container: () => document.querySelector(".tabs"), items: () => [...document.querySelectorAll(".tabs > .tab-button")], id: (node) => node.dataset.tab },
  // Les rubriques sont rangées en trois groupes (au quotidien, personnalisation, compte) : chacune se
  // réordonne dans son groupe, jamais d'un groupe à l'autre.
  menu: { container: () => document.querySelector(".menu-nav"), items: () => [...document.querySelectorAll(".menu-nav .menu-tab")], id: (node) => node.dataset.panel },
};

// Drops reste dans les Réglages : l'onglet du haut est masqué d'office, à réactiver dans Général › Disposition.
const DEFAULT_HIDDEN = { tabs: ["drops"], menu: [] };

let layout = { tabs: { order: [], hidden: [...DEFAULT_HIDDEN.tabs] }, menu: { order: [], hidden: [] } };
let initialized = false;

function normalize(value) {
  const part = (item) => ({
    order: Array.isArray(item?.order) ? item.order.filter((id) => typeof id === "string") : [],
    hidden: Array.isArray(item?.hidden) ? item.hidden.filter((id) => typeof id === "string" && !LOCKED.has(id)) : [],
  });
  return { tabs: part(value?.tabs), menu: part(value?.menu) };
}

/**
 * Libellés longs (allemand, russe…) ou onglets ajoutés : si la barre du haut
 * déborde, on retire d'abord la durée de visionnage, puis le compteur de points.
 */
function fitTopbar() {
  const bar = document.querySelector(".topbar");
  if (!bar) return;
  // Déborde dès que la fin de la barre mord sur la marge droite.
  const overflows = () => {
    const end = bar.querySelector(".topbar-end")?.getBoundingClientRect().right || 0;
    return end > bar.getBoundingClientRect().right - parseFloat(getComputedStyle(bar).paddingRight) + 1;
  };
  bar.classList.remove("is-tight", "is-tighter");
  if (!overflows()) return;
  bar.classList.add("is-tight");
  if (overflows()) bar.classList.add("is-tighter");
}

/** Réordonne le DOM et masque ce qui doit l'être ; les éléments inconnus gardent leur place en fin. */
function apply() {
  for (const [key, list] of Object.entries(LISTS)) {
    if (!list.container()) continue;
    const items = list.items();
    const rank = (node) => {
      const index = layout[key].order.indexOf(list.id(node));
      return index === -1 ? 1000 + items.indexOf(node) : index;
    };
    for (const parent of new Set(items.map((node) => node.parentNode))) {
      const group = items.filter((node) => node.parentNode === parent);
      const anchor = group[group.length - 1]?.nextSibling || null;
      [...group].sort((a, b) => rank(a) - rank(b)).forEach((node) => parent.insertBefore(node, anchor));
    }
    items.forEach((node) => {
      const wasFocused = node.contains(document.activeElement);
      node.hidden = layout[key].hidden.includes(list.id(node));
      if (wasFocused && node.hidden) {
        list.items().find((item) => !item.hidden)?.focus();
      }
    });
  }
  // Rubrique active masquée : on bascule sur la première visible.
  const active = document.querySelector('.menu-nav > .menu-tab[aria-selected="true"]');
  if (active?.hidden) LISTS.menu.items().find((node) => !node.hidden)?.click();
  const tab = document.querySelector('.tabs > .tab-button[aria-selected="true"]');
  if (tab?.hidden) LISTS.tabs.items().find((node) => !node.hidden && node.dataset.tab)?.click();
  fitTopbar();
}

function currentOrder(key) {
  return LISTS[key].items().map(LISTS[key].id);
}

async function save() {
  await chrome.storage.local.set({ [LAYOUT_KEY]: layout });
}

/** Deux éléments voisins du même groupe : seuls ceux-là s'échangent. */
function sameGroup(items, index, target) {
  return target >= 0 && target < items.length && items[index].parentNode === items[target].parentNode;
}

function move(key, id, delta) {
  const items = LISTS[key].items();
  const order = items.map(LISTS[key].id);
  const index = order.indexOf(id);
  const target = index + delta;
  if (index === -1 || !sameGroup(items, index, target)) return;
  [order[index], order[target]] = [order[target], order[index]];
  layout[key].order = order;
}

function toggle(key, id, visible) {
  const hidden = new Set(layout[key].hidden);
  if (visible) hidden.delete(id);
  else hidden.add(id);
  layout[key].hidden = [...hidden];
}

function iconButton(label, glyph, onClick, disabled) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-button layout-move";
  button.textContent = glyph;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function renderEditor(key, listId) {
  const target = $(listId);
  if (!target) return;
  const items = LISTS[key].items();
  target.replaceChildren(...items.map((node, index) => {
    const id = LISTS[key].id(node);
    const source = node.querySelector("span[data-i18n]") || node;
    const name = source.dataset.i18n ? t(source.dataset.i18n) : source.textContent.trim();
    const row = document.createElement("li");
    row.className = "layout-row";
    row.dataset.id = id;
    const label = document.createElement("label");
    label.className = "layout-label";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = !node.hidden;
    check.disabled = LOCKED.has(id);
    check.addEventListener("change", () => update(() => toggle(key, id, check.checked)));
    const text = document.createElement("span");
    text.textContent = name;
    label.append(check, text);
    row.append(
      label,
      iconButton(t("popup.layout.moveUp", { name }), "↑", () => update(() => move(key, id, -1), listId, id, -1), !sameGroup(items, index, index - 1)),
      iconButton(t("popup.layout.moveDown", { name }), "↓", () => update(() => move(key, id, 1), listId, id, 1), !sameGroup(items, index, index + 1)),
    );
    return row;
  }));
}

function renderEditors() {
  renderEditor("tabs", "layout-tabs");
  renderEditor("menu", "layout-menu");
}

function refreshLayoutTexts() {
  for (const [key, listId] of [["tabs", "layout-tabs"], ["menu", "layout-menu"]]) {
    const rows = [...($(listId)?.children || [])];
    for (const node of LISTS[key].items()) {
      const row = rows.find((item) => item.dataset.id === LISTS[key].id(node));
      if (!row) continue;
      // Read the translation directly, regardless of the parent's i18n order.
      const source = node.querySelector("span[data-i18n]") || node;
      const name = source.dataset.i18n ? t(source.dataset.i18n) : source.textContent.trim();
      row.querySelector(".layout-label span").textContent = name;
      row.querySelectorAll(".layout-move").forEach((button, index) => {
        const label = t(index ? "popup.layout.moveDown" : "popup.layout.moveUp", { name });
        button.title = label;
        button.setAttribute("aria-label", label);
      });
    }
  }
  // Parent translation listeners may update the topbar later in this turn.
  queueMicrotask(fitTopbar);
}

/** Applique un changement, l'enregistre, redessine, et garde le focus sur le bouton utilisé. */
function update(change, listId, id, delta) {
  change();
  apply();
  renderEditors();
  save().catch(() => {});
  if (listId && id) {
    const rows = [...$(listId).children];
    const key = listId === "layout-tabs" ? "tabs" : "menu";
    const index = currentOrder(key).indexOf(id);
    rows[index]?.querySelectorAll(".layout-move")[delta < 0 ? 0 : 1]?.focus();
  }
}

export async function initLayout() {
  if (initialized) return;
  initialized = true;
  // Les libellés changent avec la langue et les compteurs : on réajuste à chaque changement de taille.
  if (typeof ResizeObserver === "function") {
    // Ajuster à l'image suivante, hors du rappel : changer la barre pendant que
    // l'observateur la mesure déclenche « ResizeObserver loop completed ».
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fitTopbar);
    });
    document.querySelectorAll(".tabs, .topbar-end").forEach((element) => observer.observe(element));
  }
  const stored = await chrome.storage.local.get(LAYOUT_KEY);
  layout = normalize(stored[LAYOUT_KEY]);
  // Jamais personnalisé : masquage par défaut. Une disposition déjà enregistrée garde le choix de la personne.
  if (!stored[LAYOUT_KEY]) layout.tabs.hidden = [...DEFAULT_HIDDEN.tabs];
  apply();
  renderEditors();
  onLanguageChange(refreshLayoutTexts);
  $("layout-reset")?.addEventListener("click", () => {
    layout = normalize({});
    layout.tabs.hidden = [...DEFAULT_HIDDEN.tabs];
    // Ordre d'origine : celui du HTML, relu depuis les identifiants de départ.
    for (const key of Object.keys(LISTS)) layout[key].order = DEFAULT_ORDER[key];
    apply();
    renderEditors();
    save().catch(() => {});
  });
}

const DEFAULT_ORDER = {
  tabs: ["streamers", "history", "drops", "badges", "settings"],
  menu: ["notifications", "rewards", "drops", "badges", "activity", "player", "previews", "chat", "identity", "general", "data", "plus", "help"],
};
