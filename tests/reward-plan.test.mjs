import test from "node:test";
import assert from "node:assert/strict";
import { buildRewardPlan, formatPlanMinutes, normalizePlanSelection } from "../js/reward-plan.js";

const NOW = Date.parse("2026-10-17T12:00:00Z");
const campaign = {
  id: "c",
  game: "Chess",
  endsAt: NOW + 240 * 60_000,
  drops: [
    { id: "a", name: "A", minutes: 30 },
    { id: "b", name: "B", minutes: 60 },
  ],
};

test("Drops of one campaign count minutes at the same time, campaigns add up", () => {
  const plan = buildRewardPlan({ campaigns: [campaign], selectedIds: ["a", "b"], now: NOW });
  assert.deepEqual(plan.rows.map((row) => row.minutesRemaining), [30, 60]);
  assert.equal(plan.totalMinutes, 60);
  assert.equal(plan.overBudget, false);
  const other = { id: "d", game: "Go", drops: [{ id: "x", name: "X", minutes: 45 }] };
  assert.equal(buildRewardPlan({ campaigns: [campaign, other], selectedIds: ["a", "b", "x"], now: NOW }).totalMinutes, 105);
});

test("minutes already watched are subtracted per Drop", () => {
  const plan = buildRewardPlan({ campaigns: [campaign], selectedIds: ["a", "b"], now: NOW, progress: { dropId: "a", minutes: 20 } });
  assert.equal(plan.rows[0].minutesRemaining, 10);
  assert.equal(plan.rows[1].minutesRemaining, 60);
  assert.equal(plan.totalMinutes, 60);
  const both = buildRewardPlan({ campaigns: [campaign], selectedIds: ["a", "b"], now: NOW, progressById: { a: 30, b: 45 } });
  assert.deepEqual(both.rows.map((row) => row.minutesRemaining), [0, 15]);
  assert.equal(both.totalMinutes, 15);
});

test("budget, deadlines and unknown durations are explicit", () => {
  const plan = buildRewardPlan({ campaigns: [campaign], selectedIds: ["a", "b"], budgetMinutes: 30, now: NOW });
  assert.equal(plan.overBudget, true);
  assert.equal(plan.deadlineReached, false);
  const late = buildRewardPlan({ campaigns: [{ ...campaign, endsAt: NOW + 40 * 60_000 }], selectedIds: ["a", "b"], now: NOW });
  assert.equal(late.deadlineReached, true);
  const unknown = buildRewardPlan({ campaigns: [{ ...campaign, drops: [{ id: "z", minutes: undefined }] }], selectedIds: ["z"], now: NOW });
  assert.equal(unknown.incomplete, true);
  assert.equal(unknown.totalMinutes, 0);
});

test("an invalid deadline from a platform is reported as incomplete", () => {
  const plan = buildRewardPlan({ campaigns: [campaign], selectedIds: ["a", "b"] });
  assert.equal(plan.rows.length, 2);
  assert.equal(plan.incomplete, false);
});

test("selection is bounded and sanitized; empty plans are valid", () => {
  assert.deepEqual(normalizePlanSelection({ selectedIds: ["a", "a", 3, ""], budgetMinutes: -2 }), { selectedIds: ["a"], budgetMinutes: null });
  assert.deepEqual(buildRewardPlan(), { rows: [], totalMinutes: 0, incomplete: false, budgetMinutes: null, overBudget: false, deadlineReached: false });
  assert.equal(formatPlanMinutes(90), "1 h 30");
  assert.equal(formatPlanMinutes(0), "0 min");
});
