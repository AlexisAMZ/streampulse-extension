import test from "node:test";
import assert from "node:assert/strict";
import { extensionPage } from "./helpers/extension-page.mjs";

test("points: initialize and interact with the actual menu-activity HTML", async (t) => {
  const result = await extensionPage("popup", async (api) => {
    const { $, module, calls, change, tick, changes } = api;
    const { initI18n } = await module("i18n.js");
    await initI18n("en");
    const { addGain, emptyState, normalizeGain, toStorage } = await module("points-data.js");
    const state = addGain(emptyState(), normalizeGain({ channel_id: "123", point_gain: { channel_id: "123", total_points: 50, baseline_points: 50, reason_code: "CLAIM" } }));
    state.channels["123"].name = "Viewer";
    Object.assign(api.stored, toStorage(state));
    const { initPoints } = await module("popup-points.js");
    let plus = false;
    const plusListeners = new Set();
    let opened = 0;
    const options = { isPlus: () => plus, openPlus: () => { opened += 1; }, onPlusChange: (listener) => plusListeners.add(listener) };
    await initPoints(options);
    await initPoints(options);
    $("settings-section").classList.remove("hidden");
    $("menu-activity").hidden = false;
    const free = { total: $("points-total").textContent, rows: $("points-channels").children.length, locked: !$("points-locked").hidden };
    $("points-unlock").click();
    plus = true;
    for (const listener of plusListeners) listener();
    document.querySelector("#points-channels [data-channel]")?.click();
    const detail = { visible: !$("points-detail").hidden, table: Boolean($("points-detail-body").querySelector("table")), focus: document.activeElement === $("points-back") };
    $("points-back").click();
    document.querySelector('#points-period [data-period="today"]').click();
    const period = document.querySelector('#points-period [data-period="today"]').getAttribute("aria-pressed");
    api.respond = async () => null;
    $("btn-reset-points").click();
    $("btn-reset-points").click();
    await tick();
    const reset = { status: $("points-reset-status").textContent, disabled: $("btn-reset-points").disabled, calls: calls.filter((call) => call.type === "resetPoints").length };
    change(toStorage(emptyState()));
    await tick();
    return { actualPanel: Boolean($("menu-activity")), stalePanel: Boolean($("menu-points")), free, opened, detail, period, reset, empty: { total: $("points-total").textContent, visible: !$("points-empty").hidden }, plusListeners: plusListeners.size, storageListeners: changes.size };
  });
  await t.test("real HTML initializes data rather than silently returning", () => {
    assert.equal(result.actualPanel, true);
    assert.equal(result.stalePanel, false);
    assert.deepEqual(result.free, { total: "50", rows: 1, locked: true });
    assert.deepEqual(result.empty, { total: "0", visible: true });
  });
  await t.test("Plus details, focus, period and storage updates are functional", () => {
    assert.deepEqual(result.detail, { visible: true, table: true, focus: true });
    assert.equal(result.period, "true");
    assert.equal(result.opened, 1);
  });
  await t.test("reset rejects null and repeated init never duplicates bindings", () => {
    assert.deepEqual(result.reset, { status: "Could not save. Try again.", disabled: false, calls: 1 });
    assert.equal(result.plusListeners, 1);
    assert.equal(result.storageListeners, 1);
  });
});

test("points: language refresh preserves the selected detail, period and reset confirmation", async (t) => {
  const result = await extensionPage("popup", async (api) => {
    const { $, module, tick } = api;
    const { initI18n, setLanguage, applyTranslations, onLanguageChange, t } = await module("i18n.js");
    await initI18n("en");
    applyTranslations(document);
    const { addGain, emptyState, normalizeGain, toStorage } = await module("points-data.js");
    const state = addGain(emptyState(), normalizeGain({ channel_id: "123", point_gain: { channel_id: "123", total_points: 1250, baseline_points: 1250, reason_code: "CLAIM" } }));
    state.channels["123"].name = "Viewer";
    Object.assign(api.stored, toStorage(state));
    const { initPoints } = await module("popup-points.js");
    await initPoints({ isPlus: () => true, openPlus: () => {}, onPlusChange: () => {} });
    // Exercise the parent's static translation pass after the module listener.
    onLanguageChange(() => applyTranslations(document));
    $("settings-section").classList.remove("hidden");
    $("menu-activity").hidden = false;
    document.querySelector('#points-period [data-period="today"]').click();
    document.querySelector("#points-channels [data-channel]").click();
    const snapshot = () => ({
      total: $("points-detail-body").querySelector(".pts-lcd-total").textContent,
      reason: $("points-detail-body").querySelector('[data-reason="CLAIM"]').textContent,
      health: $("points-health").textContent,
    });
    const english = snapshot();
    await setLanguage("fr");
    await tick();
    const french = snapshot();
    const preserved = { detail: !$("points-detail").hidden, period: document.querySelector('#points-period [aria-pressed="true"]').dataset.period, focused: document.activeElement === $("points-back") };
    await setLanguage("en");
    const back = snapshot();
    $("btn-reset-points").click();
    await setLanguage("fr");
    const armed = { label: $("btn-reset-points").textContent === t("popup.points.resetConfirm"), armed: $("btn-reset-points").dataset.armed };
    const respond = api.respond;
    api.respond = (message) => message.type === "resetPoints" ? null : respond(message);
    $("btn-reset-points").click();
    await tick();
    await setLanguage("en");
    const failed = $("points-reset-status").textContent === t("popup.feedback.saveFailed");
    api.respond = respond;
    $("btn-reset-points").click();
    $("btn-reset-points").click();
    await tick();
    await setLanguage("fr");
    const saved = $("points-reset-status").textContent === t("popup.points.resetDone");
    return { english, french, back, preserved, armed, failed, saved };
  });
  await t.test("dynamic numbers, reasons and health follow the current language", () => {
    for (const key of ["total", "reason", "health"]) {
      assert.notEqual(result.english[key], result.french[key], key);
      assert.equal(result.back[key], result.english[key], key);
    }
    assert.deepEqual(result.preserved, { detail: true, period: "today", focused: true });
  });
  await t.test("reset confirmation and save status stay translated after the parent's pass", () => {
    assert.deepEqual(result.armed, { label: true, armed: "1" });
    assert.equal(result.failed, true);
    assert.equal(result.saved, true);
  });
});
