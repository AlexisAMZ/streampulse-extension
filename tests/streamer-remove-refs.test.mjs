import { test } from "node:test";
import assert from "node:assert/strict";
import { pruneStreamerRefs } from "../js/streamers-data.js";
import { snapshotStreamer, restoreGroups, restoreMessages } from "../js/streamer-undo.js";

const groups = [
  { id: "g1", name: "Potes", memberIds: ["a", "b"] },
  { id: "g2", name: "FPS", memberIds: ["c"] },
];

test("la suppression retire l'id des épingles et des groupes, sans muter", () => {
  const pinned = ["b", "a"];
  const out = pruneStreamerRefs({ pinnedIds: pinned, groups }, "a");
  assert.deepEqual(out.pinnedIds, ["b"]);
  assert.deepEqual(out.groups.map((g) => g.memberIds), [["b"], ["c"]]);
  assert.deepEqual(pinned, ["b", "a"]);
  assert.deepEqual(groups[0].memberIds, ["a", "b"]);
  assert.equal(out.changed, true);
});

test("rien à nettoyer : changed faux, entrées non tableaux tolérées", () => {
  assert.equal(pruneStreamerRefs({ pinnedIds: ["b"], groups }, "zzz").changed, false);
  const out = pruneStreamerRefs({ pinnedIds: undefined, groups: null }, "a");
  assert.deepEqual(out, { pinnedIds: [], groups: [], changed: false });
});

test("Annuler restaure épingle et groupe après nettoyage", () => {
  const state = { streamers: [{ id: "a", handle: "a", platform: "twitch" }, { id: "b", handle: "b", platform: "twitch" }], pinnedIds: ["a"], groups };
  const snap = snapshotStreamer(state, "a");
  const pruned = pruneStreamerRefs(state, "a");
  const msgs = restoreMessages(snap, "a", { streamers: state.streamers, pinnedIds: pruned.pinnedIds });
  assert.deepEqual(msgs.find((m) => m.type === "setPinnedStreamers").pinnedIds, ["a"]);
  assert.deepEqual(restoreGroups(pruned.groups, snap, "a")[0].memberIds, ["b", "a"]);
});
