import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanQuery, normalizeKick, normalizeTwitch, rankSuggestions, searchChannels } from "../js/channel-search.js";

test("cleanQuery : sans @, sans lien, deux caractères minimum", () => {
  assert.equal(cleanQuery("@Zerator"), "Zerator");
  assert.equal(cleanQuery("  ga "), "ga");
  assert.equal(cleanQuery("g"), "");
  assert.equal(cleanQuery("https://twitch.tv/zerator"), "");
  assert.equal(cleanQuery("kick.com/xqc"), "");
  assert.equal(cleanQuery("<script>"), "script");
  assert.equal(cleanQuery("a".repeat(40)).length, 25);
});

test("normalizeTwitch garde les pseudos valides", () => {
  const items = normalizeTwitch({
    data: [
      { broadcaster_login: "Zerator", display_name: "ZeratoR", thumbnail_url: "https://x/a.png", is_live: true, game_name: "Just Chatting" },
      { broadcaster_login: "bad login!", display_name: "Nope" },
      { display_name: "sans login" },
    ],
  });
  assert.deepEqual(items, [{ platform: "twitch", login: "zerator", displayName: "ZeratoR", avatar: "https://x/a.png", live: true, game: "Just Chatting", followers: 0 }]);
  assert.deepEqual(normalizeTwitch(null), []);
});

test("normalizeKick lit la recherche publique de Kick", () => {
  const items = normalizeKick({
    channels: [
      { slug: "xqc", isLive: false, followersCount: 1115454, user: { username: "xQc", profilePic: "https://k/x.webp" } },
      { slug: "banned", is_banned: true, user: { username: "Banned" } },
    ],
  });
  assert.deepEqual(items, [{ platform: "kick", login: "xqc", displayName: "xQc", avatar: "https://k/x.webp", live: false, game: "", followers: 1115454 }]);
});

test("rankSuggestions : exact, puis début du pseudo, lives d'abord, sans doublon", () => {
  const item = (login, live = false, followers = 0) => ({ platform: "twitch", login, displayName: login, avatar: "", live, game: "", followers });
  const ranked = rankSuggestions([item("gotaga_fan"), item("legotaga", true), item("gotaga"), item("gotagalive", true), item("gotaga")], "Gotaga");
  assert.deepEqual(ranked.map((entry) => entry.login), ["gotaga", "gotagalive", "gotaga_fan", "legotaga"]);
  assert.equal(rankSuggestions([item("a1"), item("a2"), item("a3")], "a", 2).length, 2);
});

test("searchChannels choisit la bonne source et ignore YouTube", async () => {
  const calls = [];
  const fetchers = {
    twitch: async (query) => { calls.push(["twitch", query]); return { data: [{ broadcaster_login: "squeezie", display_name: "Squeezie" }] }; },
    kick: async (query) => { calls.push(["kick", query]); return { channels: [] }; },
  };
  assert.equal((await searchChannels("twitch", "@squee", fetchers))[0].login, "squeezie");
  assert.deepEqual(await searchChannels("kick", "squee", fetchers), []);
  assert.deepEqual(await searchChannels("youtube", "squee", fetchers), []);
  assert.deepEqual(await searchChannels("twitch", "s", fetchers), []);
  assert.deepEqual(calls, [["twitch", "squee"], ["kick", "squee"]]);
});
