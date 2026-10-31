import { test } from "node:test";
import assert from "node:assert/strict";
import { channelFromPageUrl } from "../js/platforms.js";

test("Twitch : le login de la chaîne ouverte, en minuscules", () => {
  assert.deepEqual(channelFromPageUrl("https://www.twitch.tv/Gotaga"), { platform: "twitch", handle: "gotaga" });
  assert.deepEqual(channelFromPageUrl("https://twitch.tv/xqc/videos?filter=all"), { platform: "twitch", handle: "xqc" });
});

test("Kick : le login de la chaîne ouverte", () => {
  assert.deepEqual(channelFromPageUrl("https://kick.com/Amine"), { platform: "kick", handle: "amine" });
});

test("YouTube : le @handle des pages de chaîne", () => {
  assert.deepEqual(channelFromPageUrl("https://www.youtube.com/@MrBeast/live"), { platform: "youtube", handle: "mrbeast" });
  assert.deepEqual(channelFromPageUrl("https://www.youtube.com/@caf%C3%A9"), { platform: "youtube", handle: "café" });
});

test("pages sans chaîne identifiable : null", () => {
  assert.equal(channelFromPageUrl("https://www.twitch.tv/directory"), null);
  assert.equal(channelFromPageUrl("https://www.twitch.tv/"), null);
  assert.equal(channelFromPageUrl("https://kick.com/categories/irl"), null);
  assert.equal(channelFromPageUrl("https://www.youtube.com/watch?v=abc"), null);
  assert.equal(channelFromPageUrl("https://example.com/gotaga"), null);
  assert.equal(channelFromPageUrl("chrome://extensions"), null);
  assert.equal(channelFromPageUrl(undefined), null);
});
