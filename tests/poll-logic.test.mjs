import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CATCHUP_THRESHOLD_MS,
  EMPTY_LIVE_STATE,
  catchUpNames,
  countLive,
  didStreamEnd,
  isCatchUp,
  nextLiveStateFrom,
  planStreamerAlerts,
  restoreLiveStateEntry,
} from "../js/sw/poll-logic.js";

const NOW = Date.parse("2026-09-29T20:00:00Z");
const streamer = { id: "s1", avatarUrl: "a.png" };

const live = (extra = {}) => ({
  active: { isLive: true, platform: "twitch", game: "Chess", title: "Hello", sessionId: "v1", startedAt: new Date(NOW - 60_000).toISOString(), ...extra },
});

test("restoreLiveStateEntry: rejette les entrées invalides et remplit les défauts", () => {
  assert.equal(restoreLiveStateEntry(null), null);
  assert.equal(restoreLiveStateEntry("x"), null);
  const restored = restoreLiveStateEntry({ isLive: 1, matchedRuleIds: "bad", updatedAt: "3" });
  assert.equal(restored.isLive, true);
  assert.deepEqual(restored.matchedRuleIds, []);
  assert.equal(restored.updatedAt, undefined);
  assert.equal(restored.supportsLiveStatus, true);
});

test("nextLiveStateFrom: statut en direct", () => {
  const next = nextLiveStateFrom(live(), EMPTY_LIVE_STATE, streamer, NOW);
  assert.equal(next.isLive, true);
  assert.equal(next.lastGame, "Chess");
  assert.equal(next.avatarUrl, "a.png");
  assert.equal(next.updatedAt, NOW);
  assert.equal(next.isError, false);
});

test("nextLiveStateFrom: hors ligne efface startedAt et la vignette", () => {
  const previous = { ...EMPTY_LIVE_STATE, isLive: true, startedAt: "x", thumbnailUrl: "t" };
  const next = nextLiveStateFrom({ active: { isLive: false, lastTitle: "old" } }, previous, streamer, NOW);
  assert.equal(next.startedAt, null);
  assert.equal(next.thumbnailUrl, "");
  assert.equal(next.lastTitle, "old");
});

test("nextLiveStateFrom: en erreur, l'état précédent est conservé", () => {
  const previous = { isLive: true, sessionId: "v1", game: "G", title: "T", startedAt: "s", thumbnailUrl: "th", matchedRuleIds: ["r"] };
  const next = nextLiveStateFrom({ active: { isLive: false, isError: true } }, previous, streamer, NOW);
  assert.equal(next.isLive, true);
  assert.equal(next.sessionId, "v1");
  assert.equal(next.game, "G");
  assert.equal(next.title, "T");
  assert.deepEqual(next.matchedRuleIds, ["r"]);
  assert.equal(didStreamEnd(previous, next), false);
});

test("didStreamEnd: fin réelle seulement", () => {
  assert.equal(didStreamEnd({ isLive: true }, { isLive: false, isError: false }), true);
  assert.equal(didStreamEnd({ isLive: false }, { isLive: false }), false);
  assert.equal(didStreamEnd({ isLive: true }, { isLive: true }), false);
});

test("isCatchUp: dernière observation trop ancienne ou live démarré depuis longtemps", () => {
  const fresh = { updatedAt: NOW - 60_000 };
  assert.equal(isCatchUp(fresh, { startedAt: new Date(NOW - 60_000).toISOString() }, NOW), false);
  assert.equal(isCatchUp({}, { startedAt: null }, NOW), true);
  assert.equal(isCatchUp({ updatedAt: NOW - CATCHUP_THRESHOLD_MS - 1 }, {}, NOW), true);
  assert.equal(isCatchUp(fresh, { startedAt: new Date(NOW - CATCHUP_THRESHOLD_MS - 1).toISOString() }, NOW), true);
});

const plan = (overrides) =>
  planStreamerAlerts({ streamer: { notificationsEnabled: true }, previous: EMPTY_LIVE_STATE, next: { isLive: true }, smartDecision: null, forceNotification: false, now: NOW, ...overrides });

test("planStreamerAlerts: passage en direct récent", () => {
  const previous = { ...EMPTY_LIVE_STATE, updatedAt: NOW - 60_000 };
  assert.deepEqual(plan({ previous, next: { isLive: true, startedAt: new Date(NOW).toISOString() } }), [{ type: "live" }]);
});

test("planStreamerAlerts: rattrapage groupé", () => {
  assert.deepEqual(plan({}), [{ type: "catchUp" }]);
});

test("planStreamerAlerts: toggle coupé ou hors ligne = rien", () => {
  assert.deepEqual(plan({ streamer: { notificationsEnabled: false } }), []);
  assert.deepEqual(plan({ next: { isLive: false } }), []);
});

test("planStreamerAlerts: forceNotification envoie l'alerte de live", () => {
  const previous = { isLive: true, sessionId: "v1", updatedAt: NOW };
  assert.deepEqual(plan({ previous, next: { isLive: true, sessionId: "v1" }, forceNotification: true }), [{ type: "live" }]);
});

test("planStreamerAlerts: les règles intelligentes remplacent l'alerte classique", () => {
  assert.deepEqual(plan({ smartDecision: { notifyRule: true } }), [{ type: "live" }]);
  assert.deepEqual(plan({ smartDecision: { notifyRule: false } }), []);
  assert.deepEqual(plan({ smartDecision: { notifyRule: true }, streamer: { notificationsEnabled: false } }), []);
});

test("planStreamerAlerts: nouvelle session = nouvelle alerte", () => {
  const previous = { isLive: true, sessionId: "v1", updatedAt: NOW - 1000 };
  const next = { isLive: true, sessionId: "v2", startedAt: new Date(NOW).toISOString() };
  assert.deepEqual(plan({ previous, next }), [{ type: "live" }]);
});

test("planStreamerAlerts: changement de catégorie et de titre dans la même session", () => {
  const previous = { isLive: true, sessionId: "v1", game: "A", title: "t1" };
  const next = { isLive: true, sessionId: "v1", game: "B", title: "t2" };
  assert.deepEqual(plan({ previous, next }), [
    { type: "game", from: "A", to: "B" },
    { type: "title", from: "t1", to: "t2" },
  ]);
  const muted = { notificationsEnabled: true, gameNotificationsEnabled: false, titleNotificationsEnabled: false };
  assert.deepEqual(plan({ previous, next, streamer: muted }), []);
});

test("planStreamerAlerts: pas d'alerte de changement depuis une valeur vide", () => {
  const previous = { isLive: true, sessionId: "v1", game: "", title: "" };
  assert.deepEqual(plan({ previous, next: { isLive: true, sessionId: "v1", game: "B", title: "t" } }), []);
});

test("catchUpNames et countLive", () => {
  assert.equal(catchUpNames(["a", "b"]), "a, b");
  assert.equal(catchUpNames(["a", "b", "c", "d", "e"]), "a, b, c +2");
  assert.equal(countLive([{ active: { isLive: true } }, { active: {} }, {}]), 1);
});
