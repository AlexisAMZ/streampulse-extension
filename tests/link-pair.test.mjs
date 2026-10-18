import assert from "node:assert/strict";
import test from "node:test";
import { linkCandidates, linkPair, unlinkStreamer } from "../js/linked-accounts.js";

const roster = [
  { id: "t1", platform: "twitch", handle: "alice", displayName: "Alice" },
  { id: "k1", platform: "kick", handle: "alice", displayName: "Alice" },
  { id: "t2", platform: "twitch", handle: "bob" },
  { id: "y1", platform: "youtube", handle: "alice" },
];

test("candidates are free accounts on other platforms only", () => {
  assert.deepEqual(linkCandidates(roster, [], "t1").map((s) => s.id), ["k1", "y1"]);
  assert.deepEqual(linkCandidates(roster, [], "unknown"), []);
});

test("linking adds one preferred-first group and ignores impossible pairs", () => {
  const linked = linkPair([], roster, "t1", "k1", "Alice");
  assert.equal(linked.length, 1);
  assert.deepEqual(linked[0].streamerIds, ["t1", "k1"]);
  assert.equal(linked[0].preferredId, "t1");
  assert.equal(linkPair(linked, roster, "t1", "y1", "Alice").length, 1, "already linked");
  assert.equal(linkPair([], roster, "t1", "t2", "Alice").length, 0, "same platform");
  assert.equal(linkPair([], roster, "t1", "k1", "  ").length, 0, "empty name");
});

test("candidates exclude accounts taken by another group; unlinking frees them", () => {
  const linked = linkPair([], roster, "t1", "k1", "Alice");
  assert.deepEqual(linkCandidates(roster, linked, "t2").map((s) => s.id), ["k1"].filter(() => false).concat(["y1"]));
  assert.deepEqual(unlinkStreamer(linked, roster, "k1"), []);
  assert.deepEqual(linkCandidates(roster, unlinkStreamer(linked, roster, "k1"), "t1").map((s) => s.id), ["k1", "y1"]);
});
