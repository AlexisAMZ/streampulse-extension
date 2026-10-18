import test from "node:test";
import assert from "node:assert/strict";
import { extensionPage } from "./helpers/extension-page.mjs";

test("layout: language refresh preserves controls/order and initialization binds once", async (t) => {
  const result = await extensionPage("popup", async ({ $, module, calls, tick }) => {
    const { initI18n, setLanguage, applyTranslations } = await module("i18n.js");
    await initI18n("en");
    applyTranslations(document);
    let observers = 0;
    window.ResizeObserver = class { constructor() { observers += 1; } observe() {} };
    const { initLayout } = await module("popup-layout.js");
    await Promise.all([initLayout(), initLayout()]);
    $("settings-section").classList.remove("hidden");
    $("menu-general").hidden = false;
    const label = $("layout-tabs").querySelector(".layout-label span");
    const control = $("layout-tabs").querySelector("input");
    const button = $("layout-tabs").querySelector(".layout-move");
    const english = { label: label.textContent, title: button.title, aria: button.getAttribute("aria-label") };
    control.focus();
    const before = calls.filter((call) => call.type === "storage.set").length;
    await setLanguage("fr");
    await tick();
    const french = { label: $("layout-tabs").querySelector(".layout-label span").textContent, title: $("layout-tabs").querySelector(".layout-move").title };
    const preserved = { sameControl: control === $("layout-tabs").querySelector("input"), focused: document.activeElement === control, hidden: $("tab-history").hidden, first: document.querySelector(".tabs > button").dataset.tab, writes: calls.filter((call) => call.type === "storage.set").length - before };
    await setLanguage("en");
    await tick();
    const back = $("layout-tabs").querySelector(".layout-move").title;
    const resets = calls.filter((call) => call.type === "storage.set").length;
    $("layout-reset").click();
    await tick();
    return { english, french, back, preserved, observers, resetWrites: calls.filter((call) => call.type === "storage.set").length - resets };
  }, { stored: { streamPulseLayout: { tabs: { order: ["history", "streamers", "settings"], hidden: ["history"] } } } });
  await t.test("dynamic labels and accessible move labels follow onLanguageChange", () => {
    assert.notEqual(result.english.label, result.french.label);
    assert.notEqual(result.english.title, result.french.title);
    assert.equal(result.english.title, result.english.aria);
    assert.equal(result.back, result.english.title);
  });
  await t.test("focus, controls, hidden choice and order survive translation without writes", () => {
    assert.deepEqual(result.preserved, { sameControl: true, focused: true, hidden: true, first: "history", writes: 0 });
  });
  await t.test("repeated init and languages do not duplicate observer/reset listeners", () => {
    assert.equal(result.observers, 1);
    assert.equal(result.resetWrites, 1);
  });
});
