// Disposition du popup : ordre et visibilité des onglets de la barre du haut
// et des rubriques des Réglages, choisis dans « Général et aide ». Réglages et
// « Général et aide » restent toujours visibles : c'est là qu'on revient en
// arrière. Rangé dans chrome.storage, relu à chaque ouverture.

import { t } from "./i18n.js";

export const LAYOUT_KEY = "streamPulseLayout";
const LOCKED = new Set(["settings", "general"]);

const $ = (id) => document.getElementById(id);

/** Les deux listes réordonnables : conteneur, éléments et leur identifiant. */
const LISTS = {
  tabs: { container: () => document.querySelector(".tabs"), items: () => [...document.querySelectorAll(".tabs > .tab-button, .tabs > #header-patch-notes")], id: (node) => node.dataset.tab || "changelog" },
  menu: { container: () => document.querySelector(".menu-nav"), items: () => [...document.querySelectorAll(".menu-nav > .menu-tab")], id: (node) => node.dataset.panel },
};

let layout = { tabs: { order: [], hidden: [] }, menu: { order: [], hidden: [] } };

function normalize(value) {
  const part = (item) => ({
    order: Array.isArray(item?.order) ? item.order.filter((id) => typeof id === "string") : [],
    hidden: Array.isArray(item?.hidden) ? item.hidden.filter((id) => typeof id === "string" && !LOCKED.has(id)) : [],
  });
  return { tabs: part(value?.tabs), menu: part(value?.menu) };
}

/** Réordonne le DOM et masque ce qui doit l'être ; les éléments inconnus gardent leur place en fin. */
function apply() {
  for (const [key, list] of Object.entries(LISTS)) {
    const container = list.container();
    if (!container) continue;
    const items = list.items();
    const rank = (node) => {
      const index = layout[key].order.indexOf(list.id(node));
      return index === -1 ? 1000 + items.indexOf(node) : index;
    };
    const anchor = items[items.length - 1]?.nextSibling || null;
    [...items].sort((a, b) => rank(a) - rank(b)).forEach((node) => container.insertBefore(node, anchor));
    items.forEach((node) => { node.hidden = layout[key].hidden.includes(list.id(node)); });
  }
  // Rubrique active masquée : on bascule sur la première visible.
  const active = document.querySelector('.menu-nav > .menu-tab[aria-selected="true"]');
  if (active?.hidden) LISTS.menu.items().find((node) => !node.hidden)?.click();
  const tab = document.querySelector('.tabs > .tab-button[aria-selected="true"]');
  if (tab?.hidden) LISTS.tabs.items().find((node) => !node.hidden && node.dataset.tab)?.click();
}

function currentOrder(key) {
  return LISTS[key].items().map(LISTS[key].id);
}

async function save() {
  await chrome.storage.local.set({ [LAYOUT_KEY]: layout });
}

function move(key, id, delta) {
  const order = currentOrder(key);
  const index = order.indexOf(id);
  const target = index + delta;
  if (index === -1 || target < 0 || target >= order.length) return;
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
    const name = (node.querySelector("span[data-i18n]") || node).textContent.trim();
    const row = document.createElement("li");
    row.className = "layout-row";
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
      iconButton(t("popup.layout.moveUp", { name }), "↑", () => update(() => move(key, id, -1), listId, id, -1), index === 0),
      iconButton(t("popup.layout.moveDown", { name }), "↓", () => update(() => move(key, id, 1), listId, id, 1), index === items.length - 1),
    );
    return row;
  }));
}

function renderEditors() {
  renderEditor("tabs", "layout-tabs");
  renderEditor("menu", "layout-menu");
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
  const stored = await chrome.storage.local.get(LAYOUT_KEY);
  layout = normalize(stored[LAYOUT_KEY]);
  apply();
  renderEditors();
  $("layout-reset")?.addEventListener("click", () => {
    layout = normalize({});
    // Ordre d'origine : celui du HTML, relu depuis les identifiants de départ.
    for (const key of Object.keys(LISTS)) layout[key].order = DEFAULT_ORDER[key];
    apply();
    renderEditors();
    save().catch(() => {});
  });
}

const DEFAULT_ORDER = {
  tabs: ["streamers", "history", "settings", "changelog"],
  menu: ["alerts", "automation", "player", "previews", "chat", "data", "points", "drops", "badges", "plus", "general"],
};
