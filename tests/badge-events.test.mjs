import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCampaignDetails,
  mergeCampaigns,
  normalizeCampaigns,
  normalizeRewards,
} from "../js/drops-data.js";
import {
  buildBadgeEvents,
  categoryFromDescription,
  gameKey,
  mergeBadges,
  sameGame,
} from "../js/badges-data.js";
import { CAMPAIGNS_RAW, CATALOG_RAW, DAY, NOW } from "./helpers/badges-fixtures.mjs";

const catalog = mergeBadges({ updatedAt: 0, syncedAt: 0, badges: [], owned: [] }, CATALOG_RAW, NOW).state.badges;
const campaigns = mergeCampaigns([], normalizeCampaigns(CAMPAIGNS_RAW), NOW);
const eventOf = (events, badgeId) => events.filter((event) => event.badgeId === badgeId);

test("gameKey et sameGame reconnaissent un jeu sous ses différents noms", () => {
  assert.equal(gameKey("PERSONA3 RELOAD"), gameKey("Persona 3 Reload"));
  assert.equal(gameKey("Warhammer 40,000: Space Marine II"), "warhammer40000spacemarine2");
  assert.ok(sameGame("ACE COMBAT 8: WINGS OF THEVE", "ACE COMBAT 8"));
  assert.ok(sameGame("Warhammer 40,000: Space Marine II", "Space Marine 2"));
  assert.ok(sameGame("Shin Megami Tensei V: Vengeance", "Shin Megami Tensei 5: Vengeance"));
  assert.equal(sameGame("Rust", "Rust Console Edition"), false, "nom trop court : égalité seulement");
  assert.equal(sameGame("", "REMATCH"), false);
});

test("categoryFromDescription lit « in the X category »", () => {
  assert.equal(categoryFromDescription("earned by subscribing or gifting a sub to a streamer in the ELDEN RING category."), "ELDEN RING");
  assert.equal(categoryFromDescription("a streamer in The Witcher 3: Wild Hunt category during launch"), "Witcher 3: Wild Hunt");
  assert.equal(categoryFromDescription("earned by watching Dungeon Masters on Twitch."), "");
});

test("buildBadgeEvents relie chaque badge au Drop qui le nomme, avec les dates du Drop", () => {
  const events = buildBadgeEvents({ campaigns, catalog, now: NOW });
  const [bloody] = eventOf(events, "bloody-finger-elden-ring");
  assert.deepEqual(
    [bloody.kind, bloody.link, bloody.campaignId, bloody.dropId, bloody.subs, bloody.gameId],
    ["drops", "reward", "c-er", "d-er", 1, "512953"],
  );
  assert.equal(eventOf(events, "ultramarine")[0].endsAt, Date.parse("2026-10-29T07:59:00Z"), "fin du Drop, pas de la campagne");
  assert.equal(eventOf(events, "d20")[0].minutes, 30, "d20 ne cite aucun jeu : seul le nom de la récompense le relie");
  assert.deepEqual(eventOf(events, "hoxton").map((e) => e.campaignId), ["c-pd"]);
  assert.equal(eventOf(events, "yellow-party-hat")[0].endsAt, Date.parse("2026-10-04T22:59:00Z"));
});

test("secours par le jeu, seulement pour une campagne Twitch Gaming sans détail", () => {
  const events = buildBadgeEvents({ campaigns, catalog, now: NOW });
  assert.deepEqual(eventOf(events, "koromaru").map((e) => [e.campaignId, e.link]), [["c-p3", "game"]]);
  assert.deepEqual(eventOf(events, "ace-combat-8-nugget").map((e) => [e.campaignId, e.link]), [["c-ac", "game"]]);
  assert.deepEqual(eventOf(events, "elden-ring-recluse"), [], "ELDEN RING est détaillée : seul le badge qu'elle nomme s'y rattache");
  for (const id of ["vaultbreakers", "clipped-that", "twitchcon-2026---san-diego---taco"]) assert.deepEqual(eventOf(events, id), []);
  assert.ok(!events.some((event) => event.campaignId === "c-lol"), "campagne d'éditeur : jamais de secours");
});

test("le détail arrivé remplace la liaison par le jeu", () => {
  const first = buildBadgeEvents({ campaigns, catalog, now: NOW });
  const details = [{ id: "c-p3", timeBasedDrops: [{ id: "d-k", name: "Koromaru", startAt: "2026-09-24T16:00:00Z", endAt: "2026-10-11T06:58:00Z", requiredSubs: 1, benefitEdges: [{ benefit: { id: "b-k", name: "Koromaru", distributionType: "BADGE" } }] }] }];
  const detailed = applyCampaignDetails(campaigns, details, ["c-p3"], NOW + 1);
  const next = buildBadgeEvents({ campaigns: detailed, catalog, previous: first, now: NOW + 1 });
  assert.deepEqual(eventOf(next, "koromaru").map((e) => [e.link, e.dropId, e.subs]), [["reward", "d-k", 1]]);
});

test("un nom de récompense de campagne égal au titre d'un badge le relie aussi", () => {
  const rewards = normalizeRewards([{ id: "rw-poke", name: "First Partners Collection", brand: "Pokemon", startsAt: "2026-08-24T17:00:00Z", endsAt: "2026-11-01T07:00:00Z", unlockRequirements: { subsGoal: 0, minuteWatchedGoal: 20 }, rewards: [{ id: "r1", name: "Poké Ball" }] }]);
  const withBall = [...catalog, { id: "poke-ball", title: "Poké Ball", description: "Pokémon collection", game: "", firstSeen: 0 }];
  const [ball] = eventOf(buildBadgeEvents({ campaigns: [], rewards, catalog: withBall, now: NOW }), "poke-ball");
  assert.deepEqual([ball.kind, ball.link, ball.minutes, ball.endsAt], ["rewards", "reward", 20, Date.parse("2026-11-01T07:00:00Z")]);
});

test("un badge daté d'une année passée ou retiré n'est jamais relié par le jeu", () => {
  const lol = normalizeCampaigns([{ id: "c-lolb", name: "LoL", status: "ACTIVE", startAt: "2026-09-20T18:00:00Z", endAt: "2026-10-10T15:59:00Z", game: { displayName: "League of Legends" }, owner: { name: "Twitch Gaming" } }]);
  const control = normalizeCampaigns([{ id: "c-ctl", name: "CONTROL", status: "ACTIVE", startAt: "2026-09-22T14:00:00Z", endAt: "2026-10-13T13:59:00Z", game: { displayName: "CONTROL Resonant" }, owner: { name: "Twitch Gaming" } }]);
  const old = [
    { id: "league-of-legends-classic", title: "League of Legends Classic", description: "earned by watching a streamer in the League of Legends category during the LoL Classic launch", game: "", firstSeen: 0 },
    { id: "old-control", title: "Old Control", description: "watching a streamer in the CONTROL Resonant category during the 2025 reveal", game: "", firstSeen: 0 },
  ];
  assert.deepEqual(buildBadgeEvents({ campaigns: [...lol, ...control], catalog: old, now: NOW }), []);
});

test("le journal garde 60 jours après la fin, sans muter ce qu'il reçoit", () => {
  const ended = (days) => ({ badgeId: "x", kind: "drops", campaignId: `c${days}`, dropId: "", game: "X", gameId: "", owner: "Twitch Gaming", startsAt: 0, endsAt: NOW - days * DAY, minutes: 0, subs: 0, link: "reward", seenAt: NOW - days * DAY });
  const previous = [ended(59), ended(61)];
  const frozen = structuredClone(previous);
  const events = buildBadgeEvents({ campaigns: [], catalog, previous, now: NOW });
  assert.deepEqual(events.map((e) => e.campaignId), ["c59"]);
  assert.deepEqual(previous, frozen);
});

// ─── Relecture : invalidation des événements ─────────────────────────────────

import { badgeStatus } from "../js/badges-data.js";

const HOUR_MS = 3_600_000;
const statusOf = (events, id, now) => badgeStatus(catalog.find((badge) => badge.id === id), events, { now }).status;

test("une campagne disparue de la liste avant sa fin n'est plus « en cours »", () => {
  const first = buildBadgeEvents({ campaigns, catalog, now: NOW });
  const later = NOW + HOUR_MS;
  const relisted = mergeCampaigns(campaigns, normalizeCampaigns(CAMPAIGNS_RAW.filter((campaign) => campaign.id !== "c-rm")), later);
  const next = buildBadgeEvents({ campaigns: relisted, catalog, previous: first, now: later });
  assert.notEqual(statusOf(next, "rematch-blue-lock", later + 1), "live");
  assert.equal(next.find((event) => event.badgeId === "rematch-blue-lock").endsAt, later, "fin notée au moment où Twitch ne la liste plus");
  assert.equal(statusOf(next, "bloody-finger-elden-ring", later + 1), "live", "les autres campagnes ne bougent pas");
});

test("un Drop retiré d'une campagne détaillée ne garde plus son badge", () => {
  const first = buildBadgeEvents({ campaigns, catalog, now: NOW });
  const payday = CAMPAIGNS_RAW.find((campaign) => campaign.id === "c-pd");
  const trimmed = { ...payday, timeBasedDrops: payday.timeBasedDrops.filter((drop) => drop.id === "d-dal") };
  const relisted = mergeCampaigns(campaigns, normalizeCampaigns([...CAMPAIGNS_RAW.filter((campaign) => campaign.id !== "c-pd"), trimmed]), NOW + 1);
  const next = buildBadgeEvents({ campaigns: relisted, catalog, previous: first, now: NOW + 1 });
  assert.equal(statusOf(next, "dallas", NOW + 2), "live");
  assert.notEqual(statusOf(next, "hoxton", NOW + 2), "live");
  assert.notEqual(statusOf(next, "wolf", NOW + 2), "live");
});

test("une campagne close avant terme clôt aussi ses Drops", () => {
  const rematch = CAMPAIGNS_RAW.find((campaign) => campaign.id === "c-rm");
  const closed = { ...rematch, status: "EXPIRED", endAt: "2026-10-05T10:00:00Z" };
  const relisted = mergeCampaigns(campaigns, normalizeCampaigns([...CAMPAIGNS_RAW.filter((campaign) => campaign.id !== "c-rm"), closed]), NOW);
  const events = buildBadgeEvents({ campaigns: relisted, catalog, now: NOW });
  const [event] = events.filter((item) => item.badgeId === "rematch-blue-lock");
  assert.equal(event.endsAt, Date.parse("2026-10-05T10:00:00Z"), "la fin de la campagne l'emporte sur celle du Drop");
  assert.equal(statusOf(events, "rematch-blue-lock", NOW), "ended");
});

test("le titre se reconnaît malgré l'apostrophe typographique ou les espaces", () => {
  const mold = { id: "dont-eat-the-mold", title: "Don't Eat The Mold", description: "earned by watching a streamer in the CONTROL Resonant category for 1 hour", game: "", firstSeen: 0 };
  const control = normalizeCampaigns([{
    id: "c-ctl", name: "CONTROL Resonant", status: "ACTIVE", startAt: "2026-09-22T14:00:00Z", endAt: "2026-10-13T13:59:00Z",
    game: { id: "1338428218", displayName: "CONTROL Resonant" }, owner: { name: "Twitch Gaming" },
    timeBasedDrops: [{ id: "d-mold", name: "Mold", startAt: "2026-09-22T14:00:00Z", endAt: "2026-10-13T13:59:00Z", requiredMinutesWatched: 60, benefitEdges: [{ benefit: { id: "b-mold", name: "Don’t  Eat The Mold", distributionType: "BADGE" } }] }],
  }]);
  const [event] = buildBadgeEvents({ campaigns: mergeCampaigns([], control, NOW), catalog: [mold], now: NOW });
  assert.deepEqual([event?.badgeId, event?.link], ["dont-eat-the-mold", "reward"]);
});

test("le secours par le jeu ignore les campagnes closes ou pas encore ouvertes", () => {
  const shrimp = { id: "old-shrimp", title: "Old Shrimp", description: "earned by watching a streamer in the Old School RuneScape category for 1 hour", game: "", firstSeen: 0 };
  const closed = { id: "c-osrs", name: "OSRS", status: "EXPIRED", startAt: "2026-10-03T13:00:00Z", endAt: "2026-10-04T22:59:00Z", game: { displayName: "Old School RuneScape" }, owner: { name: "Twitch Gaming" } };
  const future = { ...closed, id: "c-osrs-next", status: "ACTIVE", startAt: "2026-10-10T13:00:00Z", endAt: "2026-10-12T22:59:00Z" };
  const events = buildBadgeEvents({ campaigns: mergeCampaigns([], normalizeCampaigns([closed, future]), NOW), catalog: [shrimp], now: NOW });
  assert.deepEqual(events, []);
});
