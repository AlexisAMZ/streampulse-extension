import { test } from "node:test";
import assert from "node:assert/strict";
import { isSameChannel, findChannelTab, channelQueryPatterns, openChannel } from "../js/open-channel.js";

test("même chaîne Twitch, casse et sous-pages comprises", () => {
  assert.equal(isSameChannel("https://www.twitch.tv/Gotaga/videos", "https://www.twitch.tv/gotaga"), true);
  assert.equal(isSameChannel("https://twitch.tv/gotaga", "https://www.twitch.tv/gotaga"), true);
  assert.equal(isSameChannel("https://www.twitch.tv/gotagaa", "https://www.twitch.tv/gotaga"), false);
});

test("Kick et YouTube", () => {
  assert.equal(isSameChannel("https://kick.com/amine", "https://kick.com/amine"), true);
  assert.equal(isSameChannel("https://www.twitch.tv/amine", "https://kick.com/amine"), false);
  assert.equal(isSameChannel("https://www.youtube.com/@mrbeast/live", "https://www.youtube.com/@MrBeast"), true);
  assert.equal(isSameChannel("https://www.youtube.com/channel/UCabc/live", "https://www.youtube.com/channel/UCabc"), true);
  assert.equal(isSameChannel("https://www.youtube.com/channel/UCxyz", "https://www.youtube.com/channel/UCabc"), false);
});

test("URL racine ou invalide ne correspond jamais", () => {
  assert.equal(isSameChannel("https://www.twitch.tv/", "https://www.twitch.tv/"), false);
  assert.equal(isSameChannel("pas une url", "https://kick.com/a"), false);
});

test("findChannelTab préfère l'onglet actif", () => {
  const tabs = [
    { id: 1, url: "https://www.twitch.tv/other" },
    { id: 2, url: "https://www.twitch.tv/gotaga" },
    { id: 3, url: "https://www.twitch.tv/gotaga", active: true },
  ];
  assert.equal(findChannelTab(tabs, "https://www.twitch.tv/gotaga").id, 3);
  assert.equal(findChannelTab([], "https://www.twitch.tv/gotaga"), null);
});

test("motifs de requête", () => {
  assert.deepEqual(channelQueryPatterns("https://www.twitch.tv/x"), ["https://twitch.tv/*", "https://*.twitch.tv/*"]);
});

function fakeChrome(tabs) {
  const calls = [];
  return {
    calls,
    tabs: {
      query: async () => tabs,
      create: async (o) => calls.push(["create", o]),
      update: async (id, o) => calls.push(["update", id, o]),
    },
    windows: { update: async (id, o) => calls.push(["window", id, o]) },
  };
}

test("openChannel active l'onglet existant et sa fenêtre", async () => {
  const api = fakeChrome([{ id: 7, windowId: 2, url: "https://kick.com/amine" }]);
  const result = await openChannel(api, "https://kick.com/amine");
  assert.equal(result.reused, true);
  assert.deepEqual(api.calls, [["update", 7, { active: true }], ["window", 2, { focused: true }]]);
});

test("openChannel ouvre un onglet sinon", async () => {
  const api = fakeChrome([]);
  const result = await openChannel(api, "https://kick.com/amine");
  assert.equal(result.reused, false);
  assert.deepEqual(api.calls, [["create", { url: "https://kick.com/amine" }]]);
});
