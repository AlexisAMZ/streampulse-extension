// Éditeur d'une portée d'alerte StreamPulse+ dans le popup : interrupteur,
// choix « tous les jeux / jeux choisis » et puces des jeux. Utilisé par les
// alertes Drops et les alertes badges (js/popup-drops.js). Le stockage passe
// par js/alert-scope.js ; sans licence, l'interrupteur ouvre l'offre.

import { t } from "./i18n.js";
import { MAX_GAMES, SCOPE_ALL, normalizeScope, updateScope } from "./alert-scope.js";

const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

/**
 * @param {{ key: string, toggleId: string, modesId: string, gamesId: string, lineId: string,
 *   isPlus: () => boolean, openPlus: () => void }} options
 * @returns {{ load: (stored: object) => void, render: () => void, bind: () => void }}
 */
export function createScopeEditor({ key, toggleId, modesId, gamesId, lineId, isPlus, openPlus }) {
  const $ = (id) => document.getElementById(id);
  let scope = normalizeScope(null);

  async function save(changes) {
    scope = updateScope(scope, changes, Date.now());
    render();
    try {
      await chrome.storage.local.set({ [key]: scope });
    } catch (error) {
      console.warn("[popup] réglage d'alerte non enregistré :", error?.message || error);
    }
  }

  function chip(game) {
    const node = document.createElement("span");
    node.className = "smart-term";
    node.textContent = game;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.innerHTML = CLOSE_ICON;
    remove.setAttribute("aria-label", t("popup.dropAlerts.removeGame", { game }));
    remove.addEventListener("click", () => save({ games: scope.games.filter((item) => item !== game) }));
    node.append(remove);
    return node;
  }

  function addInput() {
    const input = document.createElement("input");
    input.className = "smart-add";
    input.type = "text";
    input.placeholder = t("popup.dropAlerts.gamePlaceholder");
    input.setAttribute("aria-label", t("popup.dropAlerts.gamesLabel"));
    input.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const game = input.value.trim();
      if (!game) return;
      await save({ games: [...scope.games, game] });
      $(gamesId)?.querySelector(".smart-add")?.focus();
    });
    return input;
  }

  function render() {
    const plus = isPlus();
    const toggle = $(toggleId);
    if (toggle && document.activeElement !== toggle) toggle.checked = plus && scope.enabled;
    const all = scope.mode === SCOPE_ALL;
    for (const button of $(modesId)?.querySelectorAll("[data-mode]") || []) {
      const active = (button.dataset.mode === SCOPE_ALL) === all;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      button.disabled = !plus || !scope.enabled;
    }
    const line = $(lineId);
    if (line) line.hidden = !plus || !scope.enabled || all;
    const host = $(gamesId);
    if (!host || line?.hidden) return;
    const chips = scope.games.map(chip);
    if (scope.games.length < MAX_GAMES) chips.push(addInput());
    host.replaceChildren(...chips);
  }

  function bind() {
    $(toggleId)?.addEventListener("change", (event) => {
      if (!isPlus()) {
        event.target.checked = false;
        openPlus();
        return;
      }
      save({ enabled: event.target.checked });
    });
    $(modesId)?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-mode]");
      if (!button || button.disabled || button.dataset.mode === scope.mode) return;
      save({ mode: button.dataset.mode });
    });
  }

  return {
    load: (stored) => {
      scope = normalizeScope(stored?.[key]);
    },
    render,
    bind,
  };
}
