import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_REFRESH_MINUTES, effectiveRefreshMinutes, normalizeRefreshMinutes, refreshGapMs } from "../js/refresh-interval.js";
import { DEFAULT_PREFERENCES, sanitizePreferences } from "../js/preferences-data.js";

test("normalizeRefreshMinutes : seuls les choix proposés passent", () => {
  assert.equal(normalizeRefreshMinutes(1), 1);
  assert.equal(normalizeRefreshMinutes("2"), 2);
  assert.equal(normalizeRefreshMinutes(0.1), DEFAULT_REFRESH_MINUTES);
  assert.equal(normalizeRefreshMinutes(7), DEFAULT_REFRESH_MINUTES);
  assert.equal(normalizeRefreshMinutes(undefined), DEFAULT_REFRESH_MINUTES);
});

test("effectiveRefreshMinutes : le choix ne vaut qu'avec StreamPulse+", () => {
  assert.equal(effectiveRefreshMinutes({ dropsRefreshMinutes: 1 }, true), 1);
  assert.equal(effectiveRefreshMinutes({ dropsRefreshMinutes: 1 }, false), DEFAULT_REFRESH_MINUTES);
  assert.equal(effectiveRefreshMinutes(null, true), DEFAULT_REFRESH_MINUTES);
});

test("refreshGapMs : un peu sous la période, jamais sous 30 s", () => {
  assert.equal(refreshGapMs(5), 5 * 60_000 - 20_000);
  assert.equal(refreshGapMs(1) >= 30_000, true);
});

test("préférences : dropsRefreshMinutes par défaut et nettoyée", () => {
  assert.equal(DEFAULT_PREFERENCES.dropsRefreshMinutes, DEFAULT_REFRESH_MINUTES);
  assert.equal(sanitizePreferences({ dropsRefreshMinutes: 2 }).dropsRefreshMinutes, 2);
  assert.equal(sanitizePreferences({ dropsRefreshMinutes: 42 }).dropsRefreshMinutes, DEFAULT_REFRESH_MINUTES);
});
