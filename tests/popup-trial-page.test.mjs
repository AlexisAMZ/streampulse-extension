// Popup réel dans Chrome sans tête : éditeur de portée des alertes
// StreamPulse+ (js/popup-alert-scope.js) et célébration de l'essai
// (js/confetti.js).
import test from "node:test";
import assert from "node:assert/strict";
import { extensionPage } from "./helpers/extension-page.mjs";

test("alertes : sans Plus l'interrupteur ouvre l'offre, avec Plus la portée s'édite et s'enregistre", async () => {
  const result = await extensionPage("popup", async (api) => {
    const { $, module, calls, tick } = api;
    const { initI18n } = await module("i18n.js");
    await initI18n("fr");
    const { createScopeEditor } = await module("popup-alert-scope.js");
    let plus = false;
    let offers = 0;
    const editor = createScopeEditor({
      key: "streamPulseDropAlerts",
      toggleId: "pref-drop-campaign-alerts",
      modesId: "drop-alerts-modes",
      gamesId: "drop-alerts-games",
      lineId: "drop-alerts-line",
      isPlus: () => plus,
      openPlus: () => { offers += 1; },
    });
    editor.load({});
    editor.bind();
    editor.render();
    const toggle = $("pref-drop-campaign-alerts");
    const saves = () => calls.filter((call) => call.type === "storage.set" && "streamPulseDropAlerts" in call.items).map((call) => call.items.streamPulseDropAlerts);

    // Sans Plus : l'interrupteur ne s'allume pas, l'offre s'ouvre, rien n'est écrit.
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));
    const locked = { checked: toggle.checked, offers, saves: saves().length, modesDisabled: [...$("drop-alerts-modes").querySelectorAll("[data-mode]")].every((b) => b.disabled) };

    // Avec Plus : activation, puis « Tous les jeux ».
    plus = true;
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));
    await tick();
    $("drop-alerts-modes").querySelector('[data-mode="all"]').click();
    await tick();
    const all = { saved: saves().at(-1), lineHidden: $("drop-alerts-line").hidden, pressed: $("drop-alerts-modes").querySelector('[data-mode="all"]').getAttribute("aria-pressed") };

    // « Jeux choisis » : ajout par Entrée, doublon ignoré, retrait par la croix.
    $("drop-alerts-modes").querySelector('[data-mode="games"]').click();
    await tick();
    const add = (game) => {
      const input = $("drop-alerts-games").querySelector(".smart-add");
      input.value = game;
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    };
    add("Valorant");
    await tick();
    add("valorant");
    await tick();
    add("CS2");
    await tick();
    const chips = [...$("drop-alerts-games").querySelectorAll(".smart-term")].map((chip) => chip.textContent);
    $("drop-alerts-games").querySelector(".smart-term button").click();
    await tick();
    const last = saves().at(-1);
    return { locked, all, chips, last, lineVisible: !$("drop-alerts-line").hidden };
  });
  assert.deepEqual(result.locked, { checked: false, offers: 1, saves: 0, modesDisabled: true });
  assert.equal(result.all.saved.enabled, true);
  assert.equal(result.all.saved.mode, "all");
  assert.ok(result.all.saved.since > 0, "la portée note son changement");
  assert.equal(result.all.lineHidden, true, "tous les jeux : pas de liste");
  assert.equal(result.all.pressed, "true");
  assert.deepEqual(result.chips, ["Valorant", "CS2"]);
  assert.deepEqual(result.last.games, ["CS2"]);
  assert.equal(result.last.mode, "games");
  assert.equal(result.lineVisible, true);
});

test("célébration : écran centré, textes, clic pour fermer, version animée et version sans animation", async () => {
  const result = await extensionPage("popup", async (api) => {
    const { module, tick } = api;
    const { celebrateTrial } = await module("confetti.js");
    const copy = { line: "> StreamPulse+ activé", big: "7 J", caption: "Tout est débloqué pendant 7 jours." };

    // Réglage système « réduire les animations » (forcé par le harnais) : affichage immédiat, sans pixels.
    const still = celebrateTrial(copy);
    const layer = document.querySelector(".trial-celebration");
    const screen = layer.querySelector(".trial-celebration-screen").getBoundingClientRect();
    const stillState = {
      still: layer.classList.contains("is-still"),
      role: layer.getAttribute("role"),
      live: layer.getAttribute("aria-live"),
      line: layer.querySelector(".trial-celebration-line").textContent,
      big: layer.querySelector(".trial-celebration-big").textContent,
      caption: layer.querySelector(".trial-celebration-caption").textContent,
      centerX: Math.round(screen.left + screen.width / 2 - innerWidth / 2),
      centerY: Math.round(screen.top + screen.height / 2 - innerHeight / 2),
    };
    layer.click();
    await still;
    const closedByClick = !document.querySelector(".trial-celebration");

    // Animations autorisées : texte tapé lettre par lettre, puis pixels.
    const realMatch = window.matchMedia;
    window.matchMedia = () => ({ matches: false });
    const moving = celebrateTrial(copy);
    const typedEarly = document.querySelector(".trial-celebration-line").textContent.length;
    await new Promise((resolve) => setTimeout(resolve, 900));
    const animated = {
      typed: document.querySelector(".trial-celebration-line").textContent,
      pixels: Boolean(document.querySelector(".trial-celebration-pixels")),
      burst: document.querySelector(".trial-celebration").classList.contains("is-burst"),
    };
    await moving;
    window.matchMedia = realMatch;
    await tick();
    return { stillState, closedByClick, typedEarly, animated, gone: !document.querySelector(".trial-celebration, .trial-celebration-pixels") };
  });
  assert.equal(result.stillState.still, true);
  assert.equal(result.stillState.role, "status");
  assert.equal(result.stillState.live, "polite");
  assert.equal(result.stillState.line, "> StreamPulse+ activé");
  assert.equal(result.stillState.big, "7 J");
  assert.equal(result.stillState.caption, "Tout est débloqué pendant 7 jours.");
  assert.ok(Math.abs(result.stillState.centerX) <= 2, `écran centré horizontalement (${result.stillState.centerX})`);
  assert.ok(Math.abs(result.stillState.centerY) <= 2, `écran centré verticalement (${result.stillState.centerY})`);
  assert.equal(result.closedByClick, true);
  assert.ok(result.typedEarly < 5, "le texte s'écrit progressivement");
  assert.equal(result.animated.typed, "> StreamPulse+ activé");
  assert.equal(result.animated.pixels, true);
  assert.equal(result.animated.burst, true);
  assert.equal(result.gone, true, "tout est retiré à la fin");
});
