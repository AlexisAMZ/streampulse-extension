import test from "node:test";
import assert from "node:assert/strict";
import { activeRewards, normalizeRewards } from "../js/drops-data.js";

// Réponse réelle de rewardCampaignsAvailableToUser, relevée sur twitch.tv le 2026-09-26.
const raw = [
  { id: "92f5", name: "First Partners Collection", brand: "Pokemon", startsAt: "2026-08-24T17:00:00Z", endsAt: "2026-10-01T07:00:00Z", status: "UNKNOWN", summary: "First Partners Collection", externalURL: "https://help.twitch.tv/s/article/pokemon-chat-badges", unlockRequirements: { subsGoal: 0, minuteWatchedGoal: 20 }, game: null, rewards: [{ id: "r1", name: "Poké Ball", bannerImage: { image1xURL: "https://static-cdn.jtvnw.net/twitch-quests-assets/REWARD/a.png" } }] },
  { id: "68e4", name: "CONTROL Resonant launch", brand: "", startsAt: "2026-09-22T14:00:00Z", endsAt: "2026-10-13T13:59:59.999Z", externalURL: "https://www.twitch.tv", unlockRequirements: { subsGoal: 0, minuteWatchedGoal: 240 }, game: { displayName: "CONTROL Resonant" }, rewards: [{ id: "r2", name: "Sierra Helmet", bannerImage: null }] },
  { id: "9bdb", name: "First Partners Collection", brand: "Pokemon", startsAt: "2026-08-24T17:00:00Z", endsAt: "2026-10-01T07:00:00Z", unlockRequirements: { subsGoal: 2, minuteWatchedGoal: 0 }, rewards: [{ id: "r3", name: "Great Ball" }] },
  { id: "vide", name: "Sans récompense", rewards: [] },
  null,
];

test("normalizeRewards lit conditions, dates et récompenses des campagnes de badges", () => {
  const rewards = normalizeRewards(raw);
  assert.deepEqual(rewards.map((r) => r.id), ["92f5", "68e4", "9bdb"]);
  assert.equal(rewards[0].minutesGoal, 20);
  assert.equal(rewards[0].rewards[0].image, "https://static-cdn.jtvnw.net/twitch-quests-assets/REWARD/a.png");
  assert.equal(rewards[1].url, "", "le lien vers l'accueil de Twitch est ignoré");
  assert.equal(rewards[1].game, "CONTROL Resonant");
  assert.equal(rewards[2].subsGoal, 2);
});

test("activeRewards garde les campagnes en cours, celle qui finit la première d'abord", () => {
  const rewards = normalizeRewards(raw);
  const now = Date.parse("2026-09-26T20:00:00Z");
  assert.deepEqual(activeRewards(rewards, now).map((r) => r.id), ["92f5", "9bdb", "68e4"]);
  assert.deepEqual(activeRewards(rewards, Date.parse("2026-10-05T00:00:00Z")).map((r) => r.id), ["68e4"]);
});

import { catalogBadges, countBadges, mergeBadges } from "../js/drops-data.js";

test("catalogBadges filtre gratuits, payants, obtenus, à obtenir, et cherche dans la description", () => {
  const raw = { badges: [
    { setID: "rematch-blue-lock", title: "Rematch Blue Lock", description: "This badge was earned by watching a streamer in the Rematch category for 30 minutes" },
    { setID: "big-walk", title: "Big Walk", description: "This badge was earned by subscribing or gifting a sub to a streamer in the Big Walk category." },
    { setID: "d20", title: "d20", description: "This badge was earned by watching Dungeon Masters on Twitch." },
    { setID: "d20", title: "d20", description: "version 2" },
  ], owned: ["d20"] };
  const { state } = mergeBadges({ updatedAt: 0, syncedAt: 0, badges: [], owned: [] }, raw, 1);
  assert.equal(state.badges.length, 3, "une ligne par set, quelle que soit la version");
  assert.deepEqual(countBadges(state), { available: 0, all: 3, free: 2, paid: 1, missing: 2, owned: 1 });
  assert.deepEqual(catalogBadges(state, "paid").map((b) => b.id), ["big-walk"]);
  assert.deepEqual(catalogBadges(state, "missing", "rematch").map((b) => b.id), ["rematch-blue-lock"]);
  assert.equal(catalogBadges(state, "owned")[0].owned, true);
});

import { activeNames } from "../js/drops-data.js";

test("citer le jeu d'une campagne de récompenses ne suffit plus : il faut le nom exact ou une campagne de badges", () => {
  const now = Date.parse("2026-09-26T20:00:00Z");
  const raw = { badges: [
    { setID: "mold", title: "Don't Eat The Mold", description: "watching a streamer in the CONTROL Resonant category for 1 hour" },
    { setID: "pichu", title: "Pichu", description: "earned during the Pokémon First Partners Collection campaign." },
    { setID: "old", title: "Old", description: "watching Some Old Game in 2023" },
  ], owned: [] };
  const { state } = mergeBadges({ updatedAt: 0, syncedAt: 0, badges: [], owned: [] }, raw, now);
  const rewards = normalizeRewards(raw_rewards());
  const names = activeNames({ rewards }, now);
  const available = catalogBadges(state, "available", "", { now, names }).map((b) => b.id);
  assert.deepEqual(available, []);
});

function raw_rewards() {
  return [
    { id: "c", name: "CONTROL Resonant launch", startsAt: "2026-09-22T14:00:00Z", endsAt: "2026-10-13T13:59:59Z", game: { displayName: "CONTROL Resonant" }, rewards: [{ id: "r", name: "Sierra Helmet" }] },
    { id: "p", name: "First Partners Collection", brand: "Pokemon", startsAt: "2026-08-24T17:00:00Z", endsAt: "2026-10-01T07:00:00Z", rewards: [{ id: "r1", name: "Poké Ball" }] },
  ];
}

test("un vieux badge du même jeu, daté d'une année passée, n'est pas disponible ; le nom exact d'une récompense l'est", () => {
  const now = Date.parse("2026-09-26T20:00:00Z");
  const raw = { badges: [
    { setID: "old-control", title: "Old Control", description: "watching CONTROL Resonant during the 2025 reveal" },
    { setID: "poke-ball", title: "Poké Ball", description: "Pokémon collection" },
  ], owned: [] };
  const { state } = mergeBadges({ updatedAt: 0, syncedAt: 0, badges: [], owned: [] }, raw, now);
  const names = activeNames({ rewards: normalizeRewards(raw_rewards()) }, now);
  assert.deepEqual(catalogBadges(state, "available", "", { now, names }).map((b) => b.id), ["poke-ball"]);
});

import { gameFromUrl } from "../js/drops-data.js";

test("gameFromUrl lit la catégorie du lien d'un badge", () => {
  assert.equal(gameFromUrl("https://www.twitch.tv/directory/game/1979%20Revolution/details"), "1979 Revolution");
  assert.equal(gameFromUrl("https://www.twitch.tv/directory/category/control-resonant"), "control resonant");
  assert.equal(gameFromUrl(null), "");
});

import { badgeCampaignFor, normalizeCampaigns } from "../js/drops-data.js";

test("un badge est relié à la campagne de Drops en cours de son jeu, qui donne sa vraie date de fin", () => {
  const now = Date.parse("2026-09-26T20:00:00Z");
  const campaigns = normalizeCampaigns([
    { id: "lol", name: "LoL", status: "ACTIVE", startAt: "2026-09-01T18:00:00Z", endAt: "2026-10-03T15:59:00Z", game: { displayName: "League of Legends" }, owner: { name: "Riot Games" } },
    { id: "rm", name: "REMATCH", status: "ACTIVE", startAt: "2026-09-23T23:01:00Z", endAt: "2026-10-21T22:58:00Z", game: { displayName: "REMATCH" }, owner: { name: "Twitch Gaming" } },
    { id: "dd", name: "D&D", status: "ACTIVE", startAt: "2026-09-24T01:15:00Z", endAt: "2026-10-21T06:58:00Z", game: { displayName: "Dungeons & Dragons" }, owner: { name: "Twitch Gaming" } },
  ]);
  const raw = { badges: [
    { setID: "rematch-blue-lock", title: "Rematch Blue Lock", description: "watching a streamer in the Rematch category for 30 minutes" },
    { setID: "d20", title: "d20", description: "watching Dungeon Masters on Twitch.", clickURL: "https://www.twitch.tv/directory/category/dungeons-&-dragons" },
    { setID: "old", title: "Old", description: "nothing to do with it" },
    { setID: "lol-classic", title: "LoL Classic", description: "watching League of Legends" },
  ], owned: [] };
  const { state } = mergeBadges({ updatedAt: 0, syncedAt: 0, badges: [], owned: [] }, raw, now);
  assert.equal(badgeCampaignFor(state.badges[0], campaigns, now).id, "rm");
  assert.equal(badgeCampaignFor(state.badges[1], campaigns, now).id, "dd");
  const available = catalogBadges(state, "available", "", { now, campaigns, names: new Set() });
  assert.deepEqual(available.map((b) => b.id).sort(), ["d20", "rematch-blue-lock"]);
  assert.equal(available.find((b) => b.id === "d20").campaign.endsAt, Date.parse("2026-10-21T06:58:00Z"));
});
