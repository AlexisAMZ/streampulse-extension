import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PLUS_GRACE_MS, PLUS_KEY, isPlusActive } from "../js/plus.js";

const NOW = Date.parse("2026-09-29T12:00:00Z");
const monthly = (verifiedAt) => ({ status: "active", licenseKey: "K", plan: "monthly", verifiedAt });

test("js/plus.js délègue à la règle partagée js/inject/plus-rule.js", () => {
  assert.equal(typeof globalThis.StreamPulsePlusRule.isPlusActive, "function");
  assert.equal(PLUS_KEY, globalThis.StreamPulsePlusRule.PLUS_KEY);
  assert.equal(PLUS_GRACE_MS, 30 * 24 * 60 * 60 * 1000);
});

test("isPlusActive : licence absente, inactive ou sans clé", () => {
  assert.equal(isPlusActive(null, NOW), false);
  assert.equal(isPlusActive({ status: "canceled", licenseKey: "K" }, NOW), false);
  assert.equal(isPlusActive({ status: "active" }, NOW), false);
});

test("isPlusActive : à vie toujours, mensuelle pendant le délai de grâce", () => {
  assert.equal(isPlusActive({ status: "active", licenseKey: "K", plan: "lifetime", verifiedAt: 0 }, NOW), true);
  assert.equal(isPlusActive(monthly(NOW - PLUS_GRACE_MS), NOW), true);
  assert.equal(isPlusActive(monthly(NOW - PLUS_GRACE_MS - 1), NOW), false);
});

test("aucun content script ne réimplémente la règle", () => {
  const files = [
    "js/twitchPlayerButtons.js",
    "js/inject/predictionsAssist.js",
    "js/inject/settings-drawer.js",
    "js/inject/twitch-badge.js",
  ];
  for (const file of files) {
    const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /PLUS_GRACE_MS|verifiedAt/, file);
    assert.match(source, /StreamPulsePlusRule/, file);
  }
});
