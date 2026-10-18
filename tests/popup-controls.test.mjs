import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createPreferenceControls, PREFERENCE_CONTROLS } from "../js/popup-preference-controls.js";
import { sendAppMessage } from "../js/runtime-message.js";

function controls(prefs, fail = false) {
  const nodes = new Map(PREFERENCE_CONTROLS.map(({ id }) => [id, {
    value: "", checked: false, disabled: false, listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
  }]));
  nodes.set("volume-boost-value", { textContent: "" });
  const writes = [];
  const root = { getElementById: (id) => nodes.get(id) };
  const ui = createPreferenceControls({ root, getPreferences: () => prefs, updatePreferences: async (patch) => {
    writes.push(patch);
    if (fail) return false;
    Object.assign(prefs, patch);
    return true;
  } });
  ui.render();
  return { nodes, writes, ui };
}

test("every bound preference control exists once in the actual popup HTML", async () => {
  const html = await readFile(new URL("../html/popup.html", import.meta.url), "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, new Set(ids).size, "duplicate HTML id");
  for (const { id } of PREFERENCE_CONTROLS) assert.equal(ids.filter((value) => value === id).length, 1, id);
});

test("quiet hours, predictions and volume survive reopening; both Drops controls agree", async () => {
  const prefs = {};
  const { nodes } = controls(prefs);
  for (const [id, property, value] of [
    ["pref-quiet-hours", "checked", true], ["pref-quiet-hours-start", "value", "22:30"],
    ["pref-quiet-hours-end", "value", "07:15"], ["pref-predictions-popup", "checked", false],
    ["pref-volume-boost", "value", "150"], ["pref-drops-tracking-panel", "checked", false],
  ]) {
    const control = nodes.get(id);
    control[property] = value;
    await control.listeners.change({ target: control });
  }
  assert.deepEqual(prefs, { quietHoursEnabled: true, quietHoursStart: "22:30", quietHoursEnd: "07:15", enablePredictionsPopup: false, playerVolumeBoost: 150, dropsTracking: false });
  const reopened = controls(prefs).nodes;
  assert.equal(reopened.get("pref-volume-boost").value, "150");
  assert.equal(reopened.get("pref-quiet-hours-start").value, "22:30");
  assert.equal(reopened.get("pref-drops-tracking-panel").checked, false);
});

test("failed preference writes revert the control and volume input updates its label", async () => {
  const { nodes, writes } = controls({ quietHoursEnabled: false, playerVolumeBoost: 100 }, true);
  const toggle = nodes.get("pref-quiet-hours");
  toggle.checked = true;
  await toggle.listeners.change({ target: toggle });
  assert.equal(toggle.checked, false);
  assert.equal(toggle.disabled, false);
  const volume = nodes.get("pref-volume-boost");
  volume.value = "160";
  volume.listeners.input();
  assert.equal(nodes.get("volume-boost-value").textContent, "160");
  await volume.listeners.change();
  assert.equal(volume.value, "100");
  assert.equal(writes.length, 2);
});

test("runtime transport failures and absent responses are explicit errors, not null", async () => {
  for (const response of [null, undefined, false]) {
    const result = await sendAppMessage({}, { sendMessage: async () => response }, "Unavailable");
    assert.deepEqual(result, { error: "Unavailable" });
  }
  assert.deepEqual(await sendAppMessage({}, { sendMessage: async () => { throw new Error("closed"); } }, "Unavailable"), { error: "Unavailable" });
  assert.deepEqual(await sendAppMessage({}, { sendMessage: async () => ({ success: true }) }), { success: true });
  assert.deepEqual(await sendAppMessage({}, { sendMessage: async () => ({ streamers: [] }) }), { streamers: [] });
});
