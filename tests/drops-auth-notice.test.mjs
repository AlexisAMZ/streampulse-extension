import test from "node:test";
import assert from "node:assert/strict";
import {
  isTwitchSignedIn,
  minutesLabel,
  setTwitchLoginForTest,
  setDropsPlatformForTest,
  getDropsPlatform,
  setBadgesPlatformForTest,
  getBadgesPlatform,
  DROPS_PLATFORM_KEY,
  BADGES_PLATFORM_KEY,
} from "../js/popup-drops.js";

test("minutesLabel formate les durées en minutes, heures et jours", () => {
  const norm = (s) => s.replace(/[\s\u202f\u00a0]+/g, " ");
  assert.match(norm(minutesLabel(0)), /0\s*min/);
  assert.match(norm(minutesLabel(45)), /45\s*min/);
  assert.match(norm(minutesLabel(300)), /5\s*(h|hr)/);
  assert.match(norm(minutesLabel(600)), /10\s*(h|hr)/);
  assert.match(norm(minutesLabel(1440)), /1\s*(j|day)/);
  assert.match(norm(minutesLabel(3000)), /2\s*(j|day)s?\s*2\s*(h|hr)/);
  assert.match(norm(minutesLabel(15000)), /10\s*(j|day)s?\s*10\s*(h|hr)/);
});

test("isTwitchSignedIn détecte l'absence de session Twitch", async () => {
  setTwitchLoginForTest("");
  globalThis.chrome = {
    cookies: {
      get: async () => null,
    },
  };
  const signedIn = await isTwitchSignedIn();
  assert.equal(signedIn, false);
});

test("isTwitchSignedIn détecte le cookie login", async () => {
  setTwitchLoginForTest("");
  globalThis.chrome = {
    cookies: {
      get: async ({ name }) => (name === "login" ? { value: "alexisamz" } : null),
    },
  };
  const signedIn = await isTwitchSignedIn();
  assert.equal(signedIn, true);
});

test("isTwitchSignedIn détecte le cookie auth-token", async () => {
  setTwitchLoginForTest("");
  globalThis.chrome = {
    cookies: {
      get: async ({ name }) => (name === "auth-token" ? { value: "oauth_test_token" } : null),
    },
  };
  const signedIn = await isTwitchSignedIn();
  assert.equal(signedIn, true);
});

test("filtre de plateforme Drops : bascule all / twitch / kick", () => {
  assert.equal(DROPS_PLATFORM_KEY, "streamPulseDropsPlatform");
  setDropsPlatformForTest("all");
  assert.equal(getDropsPlatform(), "all");
  setDropsPlatformForTest("twitch");
  assert.equal(getDropsPlatform(), "twitch");
  setDropsPlatformForTest("kick");
  assert.equal(getDropsPlatform(), "kick");
  setDropsPlatformForTest("all");
});

test("filtre de plateforme Badges : bascule all / twitch / kick", () => {
  assert.equal(BADGES_PLATFORM_KEY, "streamPulseBadgesPlatform");
  setBadgesPlatformForTest("all");
  assert.equal(getBadgesPlatform(), "all");
  setBadgesPlatformForTest("twitch");
  assert.equal(getBadgesPlatform(), "twitch");
  setBadgesPlatformForTest("kick");
  assert.equal(getBadgesPlatform(), "kick");
  setBadgesPlatformForTest("all");
});
