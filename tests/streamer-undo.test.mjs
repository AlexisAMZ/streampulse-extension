import { test } from "node:test";
import assert from "node:assert/strict";
import { snapshotStreamer, addMessageFor, restoreMessages, restoreGroups } from "../js/streamer-undo.js";

const base = {
  streamers: [
    { id: "a", handle: "a", platform: "twitch", notificationsEnabled: true },
    { id: "kick:b", handle: "b", platform: "kick", displayName: "Bee", notificationsEnabled: false, gameNotificationsEnabled: true, titleNotificationsEnabled: false },
    { id: "c", handle: "c", platform: "twitch" },
  ],
  pinnedIds: ["kick:b"],
  groups: [{ id: "g1", name: "Potes", memberIds: ["kick:b", "c"] }],
};

test("la photo garde rang, épingle et groupe sans partager l'objet", () => {
  const snap = snapshotStreamer(base, "kick:b");
  assert.deepEqual(snap.order, ["a", "kick:b", "c"]);
  assert.equal(snap.pinned, true);
  assert.equal(snap.groupId, "g1");
  assert.notEqual(snap.streamer, base.streamers[1]);
  assert.equal(snapshotStreamer(base, "zzz"), null);
});

test("le message d'ajout reprend plateforme, identifiant et nom", () => {
  const snap = snapshotStreamer(base, "kick:b");
  assert.deepEqual(addMessageFor(snap), { type: "addStreamer", platform: "kick", handle: "b", displayName: "Bee" });
});

test("restauration : alertes, ordre et épingle", () => {
  const snap = snapshotStreamer(base, "kick:b");
  const after = {
    streamers: [base.streamers[0], base.streamers[2], { id: "kick:b", handle: "b", platform: "kick", notificationsEnabled: true, gameNotificationsEnabled: true, titleNotificationsEnabled: true }],
    pinnedIds: [],
  };
  assert.deepEqual(restoreMessages(snap, "kick:b", after), [
    { type: "toggleNotifications", id: "kick:b", enabled: false },
    { type: "toggleTitleNotifications", id: "kick:b", enabled: false },
    { type: "reorderStreamers", order: ["a", "kick:b", "c"] },
    { type: "setPinnedStreamers", pinnedIds: ["kick:b"] },
  ]);
});

test("pas d'épingle en double si elle est restée", () => {
  const snap = snapshotStreamer(base, "kick:b");
  const msgs = restoreMessages(snap, "kick:b", { streamers: base.streamers, pinnedIds: ["kick:b"] });
  assert.equal(msgs.some((m) => m.type === "setPinnedStreamers"), false);
});

test("groupe : remis une seule fois, les autres groupes intacts", () => {
  const snap = snapshotStreamer(base, "kick:b");
  const groups = [{ id: "g1", memberIds: ["c"] }, { id: "g2", memberIds: ["a"] }];
  const out = restoreGroups(groups, snap, "kick:b");
  assert.deepEqual(out[0].memberIds, ["c", "kick:b"]);
  assert.equal(out[1], groups[1]);
  assert.deepEqual(groups[0].memberIds, ["c"]);
  assert.deepEqual(restoreGroups(out, snap, "kick:b")[0].memberIds, ["c", "kick:b"]);
});
