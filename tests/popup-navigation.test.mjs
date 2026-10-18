import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { filterByPlatform, selectLiveWithLinks } from "../js/popup-navigation.js";

const streamers = [
  { id: "t", platform: "twitch", displayName: "Twitch live", status: { active: { isLive: true } } },
  { id: "k", platform: "kick", displayName: "Kick offline", status: { active: { isLive: false } } },
];

test("a platform filter without a live never claims the whole roster is offline", () => {
  assert.deepEqual(filterByPlatform(streamers, "kick"), { streamers: [streamers[1]], liveCount: 0 });
  assert.deepEqual(filterByPlatform(streamers, "twitch"), { streamers: [streamers[0]], liveCount: 1 });
  assert.deepEqual(filterByPlatform(streamers, "all"), { streamers, liveCount: 1 });
});

test("linked accounts show one live and hide redundant peers", () => {
  const links = [{ id: "pair", name: "Both", streamerIds: ["k", "t"], preferredId: "k" }];
  const statusesLive = {
    t: { active: { isLive: true } },
    k: { active: { isLive: true } },
  };
  assert.deepEqual(selectLiveWithLinks(streamers, statusesLive, links), [streamers[1]]);
  assert.deepEqual(selectLiveWithLinks(streamers, {
    t: { active: { isLive: true } },
    k: { active: { isLive: false } },
  }, links), [streamers[0]]);
});

test("the seed preview keeps the real popup modules and local assets", async () => {
  const html = await readFile(new URL("../scripts/dev/popup-harness.html", import.meta.url), "utf8");
  assert.match(html, /<script[^>]+type="module"/);
  assert.match(html, /await import\("\/js\/popup\.js"\)/);
  assert.doesNotMatch(html, /(?:src)="https?:/);
});
