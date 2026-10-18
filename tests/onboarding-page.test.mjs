import test from "node:test";
import assert from "node:assert/strict";
import { extensionPage } from "./helpers/extension-page.mjs";

const activeLicense = { status: "active", plan: "lifetime", licenseKey: "test-only" };
const preferences = { language: "en", autoClaimDrops: true, autoOpenInventory: true, autoFarmNewBadges: true, badgeFarmLowQuality: true, enableClipDownload: true, gameNotifications: true, titleNotifications: true };

for (const search of ["", "?mode=plus"]) {
  test(`onboarding ${search || "normal"}: effective Plus access, stored choices preserved`, async (t) => {
    const result = await extensionPage("onboarding", async ({ $, module, waitFor, change, calls }) => {
      await module("onboarding.js");
      await waitFor(() => calls.some((call) => call.type === "getStreamers") && $("language-options").children.length);
      await new Promise((resolve) => setTimeout(resolve, 20));
      const ids = ["onboarding-auto-claim-drops", "onboarding-auto-open-inventory", "onboarding-plus-auto-claim-drops", "onboarding-plus-auto-open-inventory", "onboarding-plus-auto-farm", "onboarding-plus-low-quality", "onboarding-plus-clip-download"];
      const snapshot = () => ids.map((id) => ({ id, checked: $(id).checked, disabled: $(id).disabled, label: $(id).closest("label").textContent.includes("PLUS") }));
      const inactive = snapshot();
      $("onboarding-auto-claim-drops").checked = true;
      $("onboarding-auto-claim-drops").dispatchEvent(new Event("change", { bubbles: true }));
      const guarded = calls.filter((call) => call.type === "updatePreferences").length;
      change({ streamPulsePlus: { status: "active", plan: "lifetime", licenseKey: "test-only" } });
      const active = snapshot();
      change({ streamPulsePlus: { status: "active", plan: "monthly", licenseKey: "test-only", verifiedAt: 1 } });
      const expired = snapshot();
      const welcome = document.querySelector('[data-step="5"] .step-desc').textContent;
      const freeAlerts = [$("onboarding-game-alerts").checked, $("onboarding-game-alerts").disabled, $("onboarding-title-alerts").checked, $("onboarding-title-alerts").disabled];
      return { inactive, active, expired, guarded, freeAlerts, welcome, writes: calls.filter((call) => call.type === "storage.set") };
    }, { stored: { betaGeneralPreferences: preferences }, search });
    await t.test("inactive and expired licenses show locked, off, labeled switches", () => {
      for (const item of [...result.inactive, ...result.expired]) assert.deepEqual(item, { id: item.id, checked: false, disabled: true, label: true });
    });
    await t.test("activation restores the stored choices without writing preferences", () => {
      for (const item of result.active) assert.deepEqual(item, { id: item.id, checked: true, disabled: false, label: true });
      assert.equal(result.guarded, 0);
      assert.deepEqual(result.writes, []);
    });
    await t.test("category/title alerts remain free and inactive welcome does not claim an active subscription", () => {
      assert.deepEqual(result.freeAlerts, [true, false, true, false]);
      assert.doesNotMatch(result.welcome, /subscription is active/i);
    });
  });
}

test("onboarding: reduced motion, focus, profile errors, retries and concurrent navigation", async (t) => {
  const result = await extensionPage("onboarding", async (api) => {
    const { $, module, waitFor, tick, calls } = api;
    window.matchMedia = () => ({ matches: true });
    await module("onboarding.js");
    await waitFor(() => calls.some((call) => call.type === "getStreamers"));
    await tick();
    const next = (id) => { $(id).click(); return document.querySelector(".wizard-step.active").dataset.step; };
    const activeFeedback = () => Boolean(document.querySelector(".wizard-step.active #feedback:not([hidden]).error"));
    const reducedStep = next("btn-next-0");
    const focused = document.activeElement === document.querySelector('.wizard-step[data-step="1"] h2');
    $("profile-input").value = "viewer";
    $("profile-input").dispatchEvent(new Event("input"));
    const failures = [];
    for (const response of [null, undefined, {}, { success: false }, { error: "Profile refused" }]) {
      api.respond = async () => response;
      $("btn-next-1").click();
      await tick();
      failures.push({ step: document.querySelector(".wizard-step.active").dataset.step, error: activeFeedback(), value: $("profile-input").value });
    }
    let resolveSave;
    api.respond = () => new Promise((resolve) => { resolveSave = resolve; });
    const before = calls.filter((call) => call.type === "updateUserProfile").length;
    $("btn-next-1").click();
    $("btn-next-1").click();
    $("btn-skip-1").click();
    $("btn-back-1").click();
    const pending = { calls: calls.filter((call) => call.type === "updateUserProfile").length - before, step: document.querySelector(".wizard-step.active").dataset.step };
    resolveSave({ success: true });
    await tick();
    const savedStep = document.querySelector(".wizard-step.active").dataset.step;
    return { reducedStep, focused, failures, pending, savedStep };
  });
  await t.test("reduced motion advances without animationend and focuses the new heading", () => {
    assert.equal(result.reducedStep, "1");
    assert.equal(result.focused, true);
  });
  await t.test("absent/negative responses stay on the profile step and show an error without losing input", () => {
    for (const failure of result.failures) assert.deepEqual(failure, { step: "1", error: true, value: "viewer" });
  });
  await t.test("only one save, no navigation during it, successful retry advances", () => {
    assert.deepEqual(result.pending, { calls: 1, step: "1" });
    assert.equal(result.savedStep, "2");
  });
});

test("onboarding: animation children, cancellation and missing events cannot strand the wizard", async (t) => {
  const result = await extensionPage("onboarding", async ({ $, module, waitFor, tick, calls }) => {
    window.matchMedia = () => ({ matches: false });
    await module("onboarding.js");
    await waitFor(() => calls.some((call) => call.type === "getStreamers"));
    await tick();
    const step = () => document.querySelector(".wizard-step.active").dataset.step;
    $("btn-next-0").click();
    $("btn-next-0").click();
    document.querySelector(".welcome-line").dispatchEvent(new AnimationEvent("animationend", { bubbles: true, animationName: "word-in" }));
    const childEvent = step();
    document.querySelector('.wizard-step[data-step="0"]').dispatchEvent(new AnimationEvent("animationcancel", { animationName: "slide-out-left" }));
    const cancelled = step();
    document.querySelector('.wizard-step[data-step="0"]').dispatchEvent(new AnimationEvent("animationend", { animationName: "slide-out-left" }));
    $("btn-skip-1").click();
    // Suppress both completion events: the navigation fallback still has to fire.
    document.querySelector('.wizard-step[data-step="1"]').addEventListener("animationend", (event) => event.stopImmediatePropagation(), true);
    document.querySelector('.wizard-step[data-step="1"]').addEventListener("animationcancel", (event) => event.stopImmediatePropagation(), true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { childEvent, cancelled, fallback: step(), activeCount: document.querySelectorAll(".wizard-step.active").length, focused: document.activeElement === document.querySelector('.wizard-step[data-step="2"] h2') };
  });
  await t.test("bubbling child animations are ignored, cancellation completes once", () => {
    assert.equal(result.childEvent, "0");
    assert.equal(result.cancelled, "1");
    assert.equal(result.activeCount, 1);
  });
  await t.test("missing animation events have a bounded fallback with focus", () => {
    assert.equal(result.fallback, "2");
    assert.equal(result.focused, true);
  });
});

test("onboarding: reduced motion disables Plus picker transitions and effects", async () => {
  const result = await extensionPage("onboarding", async ({ $, waitFor, calls }) => {
    await waitFor(() => calls.some((call) => call.type === "getStreamers"));
    await waitFor(() => !$('onboarding-plus-auto-farm').disabled);
    for (const id of ["btn-next-5", "btn-next-6", "btn-next-7", "btn-next-8"]) $(id).click();
    const option = document.querySelector('#plus-name-fx [data-value="fire"]');
    return {
      reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      step: document.querySelector(".wizard-step.active").dataset.step,
      focused: document.activeElement === document.querySelector('.wizard-step[data-step="9"] h2'),
      transition: getComputedStyle(option).transitionDuration,
      animation: getComputedStyle(option.querySelector(".fx-sample-name")).animationName,
    };
  }, { stored: { streamPulsePlus: activeLicense, betaGeneralPreferences: preferences }, search: "?mode=plus" });
  assert.deepEqual(result, { reduced: true, step: "9", focused: true, transition: "0s", animation: "none" });
});

test("onboarding: settings, streamer mutations and finish require explicit save success", async (t) => {
  const result = await extensionPage("onboarding", async (api) => {
    const { $, module, waitFor, tick, calls } = api;
    window.matchMedia = () => ({ matches: true });
    await module("onboarding.js");
    await waitFor(() => calls.some((call) => call.type === "getStreamers"));
    await tick();
    const step = () => document.querySelector(".wizard-step.active").dataset.step;
    const advance = (id) => {
      const previous = document.querySelector(".wizard-step.active");
      $(id).click();
      previous.dispatchEvent(new AnimationEvent("animationend", { animationName: "slide-out-left" }));
    };
    const error = () => Boolean(document.querySelector(".wizard-step.active #feedback:not([hidden]).error"));
    advance("btn-next-0");
    advance("btn-skip-1");
    api.respond = async () => undefined;
    $("streamer-input").value = "viewer";
    $("onboarding-form").dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    await tick();
    const add = { error: error(), value: $("streamer-input").value };
    document.querySelector(".remove-streamer")?.click();
    await tick();
    const remove = { error: error(), count: $("streamer-list").children.length };
    advance("btn-skip-2");
    const toggle = $("onboarding-auto-open-inventory");
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));
    await tick();
    const preference = { error: error(), checked: toggle.checked, disabled: toggle.disabled };
    let resolveSave;
    api.respond = () => new Promise((resolve) => { resolveSave = resolve; });
    const before = calls.filter((call) => call.type === "updatePreferences").length;
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));
    $("btn-next-3").click();
    const pending = { step: step(), calls: calls.filter((call) => call.type === "updatePreferences").length - before };
    resolveSave({ success: true, preferences: { autoOpenInventory: false } });
    await tick();
    const saved = [toggle.checked, $("onboarding-plus-auto-open-inventory").checked];
    advance("btn-next-3");
    api.respond = async () => null;
    $("finish-button").click();
    await tick();
    const finish = { error: error(), closes: calls.filter((call) => call.type === "tabs.remove").length };
    api.respond = async () => ({ success: true });
    $("finish-button").click();
    await tick();
    return { add, remove, preference, pending, saved, finish, closesAfterRetry: calls.filter((call) => call.type === "tabs.remove").length };
  }, { stored: { streamPulsePlus: activeLicense, betaGeneralPreferences: preferences, betaGeneralStreamers: [{ id: "viewer", handle: "viewer", displayName: "Viewer", platform: "twitch" }] } });
  await t.test("null add/remove responses do not clear input or list", () => {
    assert.deepEqual(result.add, { error: true, value: "viewer" });
    assert.deepEqual(result.remove, { error: true, count: 1 });
  });
  await t.test("settings error is in the active step and the control rolls back", () => {
    assert.deepEqual(result.preference, { error: true, checked: true, disabled: false });
    assert.deepEqual(result.pending, { step: "3", calls: 1 });
    assert.deepEqual(result.saved, [false, false]);
  });
  await t.test("finish only closes after acknowledged persistence", () => {
    assert.deepEqual(result.finish, { error: true, closes: 0 });
    assert.equal(result.closesAfterRetry, 1);
  });
});
