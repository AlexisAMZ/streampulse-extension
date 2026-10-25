import { test } from "node:test";
import assert from "node:assert/strict";
import { isYoutubeUpcoming } from "../js/platforms.js";

test("Première ou live programmé pas encore lancé", () => {
  assert.equal(isYoutubeUpcoming('{"videoDetails":{"isUpcoming":true,"isLiveContent":true}}'), true);
});

test("live ou Première en cours", () => {
  assert.equal(isYoutubeUpcoming('{"videoDetails":{"isLive":true,"isLiveContent":true}}'), false);
  assert.equal(isYoutubeUpcoming(""), false);
  assert.equal(isYoutubeUpcoming(null), false);
});
