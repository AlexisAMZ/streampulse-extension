import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAuto,
  jobFromBadge,
  addJobs,
  removeJob,
  freeBadgeJobs,
  pruneJobs,
  gameGroups,
  currentGroup,
  bannerModel,
} from "../js/badge-auto.js";

const HOUR = 3_600_000;
const NOW = 1_800_000_000_000;
const campaign = (id, gameId, game, endsAt) => ({ id, gameId, game, endsAt });
const badge = (id, camp, extra = {}) => ({ id, title: `Badge ${id}`, image: `https://x/${id}.png`, owned: false, paid: false, campaign: camp, ...extra });

const valo = campaign("c-valo", "516575", "VALORANT", NOW + 48 * HOUR);
const lol = campaign("c-lol", "21779", "League of Legends", NOW + 5 * HOUR);

test("ancien format (un seul badge) : repris comme une file d'un badge", () => {
  const state = normalizeAuto({ badgeId: "b1", title: "Badge 1", image: "", game: "VALORANT", gameId: "516575", campaignId: "c-valo", tabId: 12, startedAt: 5 });
  assert.equal(state.mode, "manual");
  assert.equal(state.tabId, 12);
  assert.equal(normalizeAuto({ jobs: [], gameKey: "516575" }).gameKey, "516575");
  assert.deepEqual(state.jobs.map((job) => job.badgeId), ["b1"]);
  assert.equal(normalizeAuto(null), null);
  assert.equal(normalizeAuto({ jobs: [] , mode: "all"}).mode, "all");
  assert.deepEqual(normalizeAuto({ jobs: [{ badgeId: "" }, "x", { badgeId: "ok", gameId: "1" }] }).jobs.map((job) => job.badgeId), ["ok"]);
});

test("un badge de catalogue devient une tâche avec son jeu et sa fin", () => {
  assert.deepEqual(jobFromBadge(badge("b1", valo), NOW), {
    badgeId: "b1", title: "Badge b1", image: "https://x/b1.png", game: "VALORANT", gameId: "516575", campaignId: "c-valo", endsAt: valo.endsAt, addedAt: NOW,
  });
  assert.equal(jobFromBadge(badge("b2", null), NOW), null);
});

test("ajout sans doublon, retrait d'un badge", () => {
  let state = addJobs(null, [jobFromBadge(badge("b1", valo), NOW)], { mode: "manual" });
  state = addJobs(state, [jobFromBadge(badge("b1", valo), NOW + 1), jobFromBadge(badge("b2", lol), NOW + 2)]);
  assert.deepEqual(state.jobs.map((job) => job.badgeId), ["b1", "b2"]);
  assert.equal(state.jobs[0].addedAt, NOW);
  state = removeJob(state, "b1");
  assert.deepEqual(state.jobs.map((job) => job.badgeId), ["b2"]);
});

test("tous les badges possibles : gratuits, pas encore obtenus, avec une campagne en cours", () => {
  const catalog = [
    badge("free", valo),
    badge("owned", valo, { owned: true }),
    badge("paid", valo, { paid: true }),
    badge("nocampaign", null),
  ];
  assert.deepEqual(freeBadgeJobs(catalog, NOW).map((job) => job.badgeId), ["free"]);
});

test("paliers d'un même jeu (30 min, 1 h, 90 min) : un seul groupe, gardé tant qu'il en reste un", () => {
  const tiers = [badge("t30", valo), badge("t60", valo), badge("t90", valo)].map((item) => jobFromBadge(item, NOW));
  const state = addJobs(null, [...tiers, jobFromBadge(badge("l1", lol), NOW)], { mode: "all" });
  const groups = gameGroups(state.jobs);
  assert.equal(groups.length, 2);
  // La campagne qui finit le plus tôt passe d'abord.
  assert.equal(groups[0].gameId, "21779");
  assert.deepEqual(groups[1].jobs.map((job) => job.badgeId), ["t30", "t60", "t90"]);

  // LoL obtenu : on passe à VALORANT ; t30 obtenu, on reste sur VALORANT pour t60 et t90.
  let pruned = pruneJobs(state, { owned: ["l1", "t30"], now: NOW });
  assert.deepEqual(pruned.obtained.map((job) => job.badgeId), ["t30", "l1"]);
  assert.equal(currentGroup(pruned.state).gameId, "516575");
  assert.deepEqual(currentGroup(pruned.state).jobs.map((job) => job.badgeId), ["t60", "t90"]);
});

test("campagne finie : ses badges sortent de la file", () => {
  const ended = campaign("c-old", "1", "Old", NOW - 1);
  const state = addJobs(null, [jobFromBadge(badge("old", ended), NOW - HOUR), jobFromBadge(badge("b1", valo), NOW)]);
  const { state: next, expired } = pruneJobs(state, { owned: [], now: NOW });
  assert.deepEqual(expired.map((job) => job.badgeId), ["old"]);
  assert.deepEqual(next.jobs.map((job) => job.badgeId), ["b1"]);
  assert.equal(currentGroup({ jobs: [] }), null);
});

test("bannière : badges en cours, jeu, suite de la file et minutes du Drop le plus avancé", () => {
  const state = addJobs(null, [badge("t30", valo), badge("t60", valo), badge("l1", lol), badge("x", campaign("c-x", "9", "Other", NOW + 99 * HOUR))].map((item) => jobFromBadge(item, NOW)), { mode: "all" });
  const drops = [
    { campaignId: "c-lol", minutes: 12, required: 30, claimed: false },
    { campaignId: "c-lol", minutes: 30, required: 60, claimed: false },
    { campaignId: "c-valo", minutes: 1, required: 30, claimed: false },
  ];
  assert.deepEqual(bannerModel(state, drops), {
    mode: "all",
    game: "League of Legends",
    badges: ["Badge l1"],
    minutes: { done: 12, required: 30 },
    nextBadges: 3,
    nextGames: 2,
  });
  assert.equal(bannerModel({ jobs: [] }, []), null);
});
