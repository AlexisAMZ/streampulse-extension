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

import { gameFromUrl, mergeBadges } from "../js/badges-data.js";

// La liaison des badges à leurs campagnes et leurs statuts sont testés dans
// tests/badge-events.test.mjs et tests/badge-statuses.test.mjs.

test("gameFromUrl lit la catégorie du lien d'un badge", () => {
  assert.equal(gameFromUrl("https://www.twitch.tv/directory/game/1979%20Revolution/details"), "1979 Revolution");
  assert.equal(gameFromUrl("https://www.twitch.tv/directory/category/control-resonant"), "control resonant");
  assert.equal(gameFromUrl(null), "");
});

test("la Rematch Nations Cup terminée n'est pas comptée comme nouveauté", async () => {
  const { newBadges } = await import("../js/badges-data.js");
  const now = Date.parse("2026-10-02T12:00:00Z");
  const raw = { badges: [{ setID: "rematch-nations-cup", title: "Rematch Nations Cup", description: "This badge was earned by watching the Rematch Nations Cup!", version: "1" }], owned: [] };
  const { state } = mergeBadges({ updatedAt: 0, syncedAt: 0, badges: [], owned: [] }, raw, now);
  assert.equal(newBadges({ ...state, badges: state.badges.map((b) => ({ ...b, firstSeen: now })) }, now).length, 0);
});
