import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeCampaigns,
  normalizeCampaigns,
} from "../js/drops-data.js";
import {
  addedFrom,
  badgeAddedAt,
  badgeStatus,
  buildBadgeEvents,
  catalogBadges,
  countBadges,
  mergeBadges,
  normalizeAdded,
  viewerEarnable,
} from "../js/badges-data.js";
import { CAMPAIGNS_RAW, CATALOG_RAW, DAY, NOW, SITE_ADDED } from "./helpers/badges-fixtures.mjs";

const state = mergeBadges({ updatedAt: 0, syncedAt: 0, badges: [], owned: [] }, CATALOG_RAW, NOW).state;
const events = buildBadgeEvents({ campaigns: mergeCampaigns([], normalizeCampaigns(CAMPAIGNS_RAW), NOW), catalog: state.badges, now: NOW });
const context = { now: NOW, events, added: SITE_ADDED };
const ids = (list) => list.map((badge) => badge.id);

test("viewerEarnable : regarder, s'abonner, offrir ou Bits ; jamais un badge de créateur, de billet ou de salon", () => {
  assert.ok(viewerEarnable("earned by watching a streamer in the Vaultbreakers category for 60 minutes"));
  assert.ok(viewerEarnable("earned by subscribing or gifting a sub to a streamer in the DayZ category"));
  assert.ok(viewerEarnable("awarded to people who viewed the official 2026 RuneFest livestream"));
  assert.equal(viewerEarnable("earned by a DJ Program creator who clipped an epic mid-set moment"), false);
  assert.equal(viewerEarnable("given to anyone who purchased a 3-day ticket to TwitchCon"), false);
  assert.equal(viewerEarnable(""), false);
});

test("badgeAddedAt garde la plus ancienne date connue ; normalizeAdded écarte l'illisible", () => {
  assert.equal(badgeAddedAt({ id: "a", firstSeen: 200 }, { a: 100 }), 100);
  assert.equal(badgeAddedAt({ id: "a", firstSeen: 0 }, { a: 100 }), 100);
  assert.equal(badgeAddedAt({ id: "a", firstSeen: 300 }, {}), 300);
  assert.equal(badgeAddedAt({ id: "a", firstSeen: 0 }, {}), 0);
  assert.deepEqual(normalizeAdded({ vaultbreakers: 1759664355452, "bad id!": 5, d20: "x", ok: -3 }), { vaultbreakers: 1759664355452 });
  assert.deepEqual(addedFrom({}), { fetchedAt: 0, added: {} });
  assert.deepEqual(addedFrom({ streamPulseBadgeAdded: { fetchedAt: 5, added: { d20: 7 } } }), { fetchedAt: 5, added: { d20: 7 } });
});

test("statuts du 5 octobre 2026", () => {
  const status = (id, ctx = context) => badgeStatus(state.badges.find((b) => b.id === id), ctx.events, { now: ctx.now, addedAt: badgeAddedAt(state.badges.find((b) => b.id === id), ctx.added) }).status;
  for (const id of ["bloody-finger-elden-ring", "ultramarine", "koromaru", "ace-combat-8-nugget", "d20", "rematch-blue-lock", "dallas", "hoxton"]) assert.equal(status(id), "live", id);
  assert.equal(status("yellow-party-hat"), "ended");
  assert.equal(status("yellow-party-hat", { ...context, now: NOW + 8 * DAY }), null, "terminé depuis plus de 7 jours : retiré");
  assert.equal(status("vaultbreakers"), "soon", "ajouté le jour même, pas encore de campagne");
  assert.equal(status("vaultbreakers", { ...context, added: {} }), null, "sans date d'ajout, rien n'annonce sa venue");
  assert.equal(status("vaultbreakers", { ...context, now: NOW + 31 * DAY }), null, "30 jours sans campagne : retiré");
  assert.equal(status("clipped-that"), null);
  assert.equal(status("twitchcon-2026---san-diego---taco"), null);
  assert.equal(status("elden-ring-recluse"), null);
});

test("un Drop qui démarre plus tard rend le badge « à venir », daté", () => {
  const later = { badgeId: "vaultbreakers", kind: "drops", campaignId: "c-vb", dropId: "d-vb", game: "Vaultbreakers", gameId: "547208385", owner: "Twitch Gaming", startsAt: NOW + DAY, endsAt: NOW + 20 * DAY, minutes: 60, subs: 0, link: "reward", seenAt: NOW };
  const result = badgeStatus(state.badges.find((b) => b.id === "vaultbreakers"), [later], { now: NOW, addedAt: 0 });
  assert.deepEqual([result.status, result.event.startsAt], ["soon", NOW + DAY]);
});

test("catalogBadges : statut, coût, recherche et ordre", () => {
  assert.deepEqual(ids(catalogBadges(state, { ...context, status: "live" })), [
    "dallas", "hoxton", "wolf", "koromaru", "ampersand", "d20", "rematch-blue-lock", "ace-combat-8-nugget", "bloody-finger-elden-ring", "ultramarine",
  ]);
  assert.deepEqual(ids(catalogBadges(state, { ...context, status: "live", cost: "free" })), ["hoxton", "wolf", "d20", "rematch-blue-lock"]);
  assert.deepEqual(ids(catalogBadges(state, { ...context, status: "soon" })), ["vaultbreakers"]);
  assert.deepEqual(ids(catalogBadges(state, { ...context, status: "ended" })), ["yellow-party-hat"]);
  assert.deepEqual(ids(catalogBadges(state, { ...context, status: "owned" })), ["hoxton"]);
  assert.deepEqual(ids(catalogBadges(state, { ...context, query: "persona" })), ["koromaru"]);
  const koromaru = catalogBadges(state, context).find((b) => b.id === "koromaru");
  assert.equal(koromaru.paid, true, "liaison par le jeu sans condition : la description fait foi");
  const bloody = catalogBadges(state, context).find((b) => b.id === "bloody-finger-elden-ring");
  assert.deepEqual([bloody.paid, bloody.addedAt], [true, SITE_ADDED["bloody-finger-elden-ring"]]);
});

test("catalogBadges donne au mode auto la campagne du Drop en cours", () => {
  const rematch = catalogBadges(state, { ...context, status: "live" }).find((b) => b.id === "rematch-blue-lock");
  assert.deepEqual(rematch.campaign, { id: "c-rm", game: "REMATCH", gameId: "1362102608", endsAt: Date.parse("2026-10-21T22:58:00Z") });
  assert.equal(catalogBadges(state, { ...context, status: "ended" })[0].campaign, null);
});

test("countBadges compte chaque statut et les gratuits en cours", () => {
  assert.deepEqual(countBadges(state, context), { all: 12, live: 10, soon: 1, ended: 1, owned: 1, liveFree: 4 });
});

test("« Obtenus » se range par statut, puis par titre", () => {
  // Par fin : Ampersand, Rematch, Bloody Finger ; par titre : Ampersand, Bloody Finger, Rematch.
  const owned = { ...state, owned: ["rematch-blue-lock", "bloody-finger-elden-ring", "ampersand", "yellow-party-hat", "vaultbreakers"] };
  assert.deepEqual(ids(catalogBadges(owned, { ...context, status: "owned" })), ["ampersand", "bloody-finger-elden-ring", "rematch-blue-lock", "vaultbreakers", "yellow-party-hat"]);
});
