import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PLUS_GRACE_MS, PLUS_KEY, isPlusActive, needsRecheck } from "../js/plus.js";

const NOW = Date.parse("2026-09-29T12:00:00Z");
const monthly = (iat) => ({ status: "active", licenseKey: "K", plan: "monthly", verifiedAt: iat, iat, sig: "sig" });

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

test("isPlusActive : sans signature du serveur, aucune licence n'ouvre rien", () => {
  const { sig: _sig, ...unsigned } = monthly(NOW);
  assert.equal(isPlusActive(unsigned, NOW), false);
  assert.equal(isPlusActive({ ...unsigned, plan: "lifetime" }, NOW), false);
  assert.equal(isPlusActive({ ...monthly(NOW), iat: 0 }, NOW), false);
});

test("isPlusActive : à vie sans expiration, mensuelle pendant le délai de grâce", () => {
  assert.equal(isPlusActive({ ...monthly(1), plan: "lifetime" }, NOW), true);
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

test("tenureTier : la formule annuelle suit l'ancienneté, comme le mensuel", () => {
  const now = Date.UTC(2026, 9, 13);
  const since = now - 13 * globalThis.StreamPulsePlusRule.MONTH_MS;
  assert.equal(globalThis.StreamPulsePlusRule.tenureTier("yearly", since, now), "y1");
  assert.equal(globalThis.StreamPulsePlusRule.tenureTier("lifetime", since, now), "life");
});

test("licence forgée : des dates dans le futur ne donnent ni Plus actif ni report de la revérification", () => {
  const future = NOW + 10 * 365 * 24 * 60 * 60 * 1000;
  const forgedLifetime = { status: "active", licenseKey: "K", plan: "lifetime", verifiedAt: future, checkedAt: future };
  assert.equal(isPlusActive(forgedLifetime, NOW), false);
  assert.equal(isPlusActive(monthly(future), NOW), false);
  assert.equal(needsRecheck(forgedLifetime, NOW), true);
  assert.equal(needsRecheck({ ...monthly(NOW), checkedAt: future }, NOW), true);
});

test("licence valide : un léger décalage d'horloge est toléré", () => {
  assert.equal(isPlusActive(monthly(NOW + 60 * 1000), NOW), true);
  assert.equal(needsRecheck({ ...monthly(NOW), checkedAt: NOW + 60 * 1000 }, NOW), false);
});
