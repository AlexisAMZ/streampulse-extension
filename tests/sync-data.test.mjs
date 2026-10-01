import test from "node:test";
import assert from "node:assert/strict";

test("chunkForSync découpe sous le budget et ignore les entrées impublishables", async () => {
  const { chunkForSync, CHUNK_BUDGET_BYTES } = await import("../js/sync-data.js");
  const streamers = Array.from({ length: 40 }, (_, i) => ({ id: `s${i}`, name: `Streamer numéro ${i}` }));
  const chunks = chunkForSync(streamers, 300);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.flat().length, 40);
  for (const chunk of chunks) {
    assert.ok(JSON.stringify(chunk).length <= 300);
  }
  const monster = { id: "monster", pad: "x".repeat(CHUNK_BUDGET_BYTES) };
  const mixed = chunkForSync([{ id: "a" }, monster, { id: "b" }]);
  assert.deepEqual(mixed.flat().map((streamer) => streamer.id), ["a", "b"]);
  assert.deepEqual(chunkForSync([]), []);
  assert.deepEqual(chunkForSync(undefined), []);
});

test("mergeStreamers fait l'union par identifiant et garde la version locale en doublon", async () => {
  const { mergeStreamers } = await import("../js/sync-data.js");
  const local = [{ id: "a", handle: "a" }, { id: "b", handle: "b", notificationsEnabled: false }];
  const remote = [{ id: "b", handle: "b", notificationsEnabled: true }, { id: "c", handle: "c" }];
  const merged = mergeStreamers(local, remote);
  assert.deepEqual(merged.map((streamer) => streamer.id), ["a", "b", "c"]);
  assert.equal(merged[1].notificationsEnabled, false);
  assert.deepEqual(mergeStreamers([], remote).map((streamer) => streamer.id), ["b", "c"]);
  assert.deepEqual(mergeStreamers(local, undefined), local);
});

test("mergePreferences complète les réglages restés d'usine et protège les choix locaux", async () => {
  const { mergePreferences } = await import("../js/sync-data.js");
  const local = {
    liveNotifications: true,
    dropAlerts: false,
    watchTimeTracker: false,
    crossDeviceSync: false,
  };
  const remote = {
    liveNotifications: false,
    dropAlerts: true,
    watchTimeTracker: true,
    crossDeviceSync: true,
  };
  const merged = mergePreferences(local, remote);
  // liveNotifications était à sa valeur d'usine (true) : suit l'autre appareil.
  assert.equal(merged.liveNotifications, false);
  // dropAlerts était à sa valeur d'usine (false) : suit l'autre appareil.
  assert.equal(merged.dropAlerts, true);
  // watchTimeTracker avait été personnalisé (false ≠ défaut true) : garde sa valeur.
  assert.equal(merged.watchTimeTracker, false);
  // La participation à la synchro ne voyage jamais.
  assert.equal(merged.crossDeviceSync, false);
  assert.deepEqual(mergePreferences(local, undefined), local);
});

test("mergePinnedIds fait l'union ordonnée sans doublon", async () => {
  const { mergePinnedIds } = await import("../js/sync-data.js");
  assert.deepEqual(mergePinnedIds(["a", "b"], ["b", "c"]), ["a", "b", "c"]);
  assert.deepEqual(mergePinnedIds(undefined, ["a", 1, ""]), ["a"]);
  assert.deepEqual(mergePinnedIds(undefined, undefined), []);
});

test("isRemoteSync ignore les échos et les états incomplets", async () => {
  const { isRemoteSync } = await import("../js/sync-data.js");
  assert.equal(isRemoteSync({ device: "autre", rev: 3 }, "moi"), true);
  assert.equal(isRemoteSync({ device: "moi", rev: 3 }, "moi"), false);
  assert.equal(isRemoteSync({ device: "autre", rev: 0 }, "moi"), false);
  assert.equal(isRemoteSync(null, "moi"), false);
});
