import { test } from "node:test";
import assert from "node:assert/strict";
import { dayKey, freeAvailable, freeUsedToday, isFreeRun, normalizeFree } from "../js/badge-free.js";

const NOW = new Date(2026, 9, 13, 15, 0).getTime();
const TOMORROW = new Date(2026, 9, 14, 0, 5).getTime();

test("dayKey : date locale du jour", () => {
  assert.equal(dayKey(NOW), "2026-10-13");
});

test("normalizeFree : rejette les enregistrements incomplets", () => {
  assert.equal(normalizeFree(null), null);
  assert.equal(normalizeFree({ day: "hier", badgeId: "b" }), null);
  assert.deepEqual(normalizeFree({ day: "2026-10-13", badgeId: "b" }), { day: "2026-10-13", badgeId: "b" });
});

test("freeAvailable : un badge par jour, le même peut repartir", () => {
  const used = { day: dayKey(NOW), badgeId: "a" };
  assert.equal(freeAvailable(null, "a", NOW), true);
  assert.equal(freeAvailable(used, "a", NOW), true);
  assert.equal(freeAvailable(used, "b", NOW), false);
  assert.equal(freeAvailable(used, "b", TOMORROW), true);
});

test("freeUsedToday : repart à minuit", () => {
  const used = { day: dayKey(NOW), badgeId: "a" };
  assert.equal(freeUsedToday(used, NOW), true);
  assert.equal(freeUsedToday(used, TOMORROW), false);
});

test("isFreeRun : un seul badge, celui du quota, jamais le mode « tous »", () => {
  const record = { day: "2026-10-13", badgeId: "a" };
  const one = (badgeId, mode = "manual") => ({ mode, jobs: [{ badgeId }] });
  assert.equal(isFreeRun(one("a"), record), true);
  assert.equal(isFreeRun(one("b"), record), false);
  assert.equal(isFreeRun(one("a", "all"), record), false);
  assert.equal(isFreeRun({ mode: "manual", jobs: [{ badgeId: "a" }, { badgeId: "c" }] }, record), false);
  assert.equal(isFreeRun(one("a"), null), false);
});
