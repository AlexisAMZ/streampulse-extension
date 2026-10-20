import test from "node:test";
import assert from "node:assert/strict";
import {
  AVAILABLE_PLATFORMS, buildProfileUrl, formatHandleForDisplay, getHandleComparisonKey, getOfferedPlatforms,
  isPlatformOffered, normalizePlatform, sanitizeHandle,
} from "../js/platforms.js";

const ID = "bb382c2c0cc9fa7c86ab3b037fb5799c";

test("CHZZK est une plateforme connue", () => {
  assert.equal(normalizePlatform("chzzk"), "chzzk");
  assert.equal(normalizePlatform("CHZZK"), "chzzk");
  assert.ok(AVAILABLE_PLATFORMS.some((definition) => definition.id === "chzzk"));
});

test("pseudo : identifiant en minuscules, lien extrait, nom coréen conservé", () => {
  assert.equal(sanitizeHandle("chzzk", ID.toUpperCase()), ID);
  assert.equal(sanitizeHandle("chzzk", `https://chzzk.naver.com/live/${ID}`), ID);
  assert.equal(sanitizeHandle("chzzk", " @침착맨 "), "침착맨");
  assert.equal(sanitizeHandle("chzzk", ""), "");
});

test("comparaison et adresse de profil", () => {
  assert.equal(getHandleComparisonKey("chzzk", ID.toUpperCase()), `chzzk:${ID}`);
  assert.equal(buildProfileUrl("chzzk", ID), `https://chzzk.naver.com/${ID}`);
  assert.equal(buildProfileUrl("chzzk", ""), "https://chzzk.naver.com/");
  assert.ok(formatHandleForDisplay("chzzk", ID).length > 0);
});

test("visible seulement en coréen et en anglais, sauf si déjà suivie", () => {
  assert.equal(isPlatformOffered("chzzk", "ko"), true);
  assert.equal(isPlatformOffered("chzzk", "en"), true);
  assert.equal(isPlatformOffered("chzzk", "pt-BR"), false);
  assert.equal(isPlatformOffered("chzzk", "fr"), false);
  assert.equal(isPlatformOffered("chzzk", "fr", ["twitch", "chzzk"]), true);
  assert.equal(isPlatformOffered("chzzk", ""), false);
  assert.equal(isPlatformOffered("chzzk", "KO-kr"), true);
});

test("les autres plateformes restent proposées partout", () => {
  for (const platform of ["twitch", "kick", "youtube"]) assert.equal(isPlatformOffered(platform, "ja"), true);
  assert.equal(isPlatformOffered("inconnue", "ko"), false);
});

test("liste proposée selon la langue", () => {
  assert.deepEqual(getOfferedPlatforms("fr").map((d) => d.id), ["twitch", "kick", "youtube"]);
  assert.deepEqual(getOfferedPlatforms("ko").map((d) => d.id), ["twitch", "kick", "youtube", "chzzk"]);
  assert.deepEqual(getOfferedPlatforms("fr", ["chzzk"]).map((d) => d.id), ["twitch", "kick", "youtube", "chzzk"]);
});
