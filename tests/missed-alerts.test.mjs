import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_MISSED, MISSED_KEEP_MS, addMissed, markSeen, missedFrom, unseenCount, weekSummary } from "../js/missed-alerts.js";

const NOW = Date.parse("2026-10-28T12:00:00Z");
const MIN = 60_000;
const badge = (id, at = NOW, extra = {}) => ({ id, kind: "badge", title: `Badge ${id}`, game: "Rust", durationMs: 30 * MIN, endsAt: at + 30 * MIN, at, ...extra });

test("missedFrom : stockage illisible → liste vide", () => {
  assert.deepEqual(missedFrom(undefined), { items: [], seenAt: 0 });
  assert.deepEqual(missedFrom({ items: [{ id: 3 }, null, badge("a")], seenAt: "x" }).items.map((i) => i.id), ["a"]);
});

test("addMissed : plus récent d'abord, sans doublon, sans mutation", () => {
  const start = missedFrom(null);
  const one = addMissed(start, [badge("a", NOW - MIN)], NOW);
  const two = addMissed(one, [badge("b"), badge("a", NOW)], NOW);
  assert.deepEqual(two.items.map((i) => i.id), ["b", "a"]);
  assert.equal(two.items[1].at, NOW - MIN, "le premier passage garde sa date");
  assert.deepEqual(start.items, []);
  assert.equal(one.items.length, 1);
});

test("addMissed : oublie au-delà de 7 jours et plafonne", () => {
  const old = addMissed(missedFrom(null), [badge("old", NOW - MISSED_KEEP_MS - 1)], NOW - MISSED_KEEP_MS - 1);
  assert.deepEqual(addMissed(old, [badge("new")], NOW).items.map((i) => i.id), ["new"]);
  const many = addMissed(missedFrom(null), Array.from({ length: 40 }, (_, i) => badge(`x${i}`, NOW - i)), NOW);
  assert.equal(many.items.length, MAX_MISSED);
});

test("unseenCount / markSeen : le point de l'icône suit ce qui n'a pas été vu", () => {
  const state = addMissed(missedFrom(null), [badge("a", NOW - 2 * MIN), badge("b", NOW - MIN)], NOW);
  assert.equal(unseenCount(state), 2);
  const seen = markSeen(state, NOW);
  assert.equal(unseenCount(seen), 0);
  assert.equal(unseenCount(addMissed(seen, [badge("c", NOW + MIN)], NOW + MIN)), 1);
});

test("weekSummary : badges et Drops de la semaine", () => {
  const state = addMissed(missedFrom(null), [badge("a"), badge("b"), { id: "d", kind: "drop", title: "Valorant", game: "Valorant", at: NOW }], NOW);
  assert.deepEqual(weekSummary(state, NOW), { badges: 2, drops: 1, total: 3 });
});
