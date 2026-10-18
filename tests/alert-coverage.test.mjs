import assert from "node:assert/strict";
import test from "node:test";
import { alertCoverage } from "../js/alert-coverage.js";

test("an empty roster has no coverage to report", () => {
  assert.deepEqual(alertCoverage([], "live"), { state: "empty", on: 0, total: 0 });
  assert.equal(alertCoverage(undefined, "game").state, "empty");
});

test("live alerts default to on, category and title alerts default to off", () => {
  const roster = [{ id: "a" }, { id: "b" }];
  assert.equal(alertCoverage(roster, "live").state, "on");
  assert.equal(alertCoverage(roster, "game").state, "off");
  assert.equal(alertCoverage(roster, "title").state, "off");
});

test("a roster that differs reports how many streamers are on", () => {
  const roster = [{ id: "a", gameNotificationsEnabled: true }, { id: "b", gameNotificationsEnabled: false }, { id: "c" }];
  assert.deepEqual(alertCoverage(roster, "game"), { state: "mixed", on: 1, total: 3 });
  assert.equal(alertCoverage([{ notificationsEnabled: false }], "live").state, "off");
});
