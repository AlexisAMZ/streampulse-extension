import test from "node:test";
import assert from "node:assert/strict";
import { createDropsStore } from "../js/drops-store.js";
import { DROPS_CAMPAIGNS_KEY, DROPS_HISTORY_KEY, DROPS_PROGRESS_KEY, DROPS_SINCE_KEY } from "../js/drops-data.js";

const NOW = new Date(2026, 8, 26, 21, 50).getTime();
const DAY = 86_400_000;
const iso = (at) => new Date(at).toISOString();
const silent = { warn() {} };

function memoryStorage(initial = {}) {
  const data = structuredClone(initial);
  return {
    data,
    async get(keys) {
      const out = {};
      for (const key of [].concat(keys)) if (key in data) out[key] = structuredClone(data[key]);
      return out;
    },
    async set(values) {
      Object.assign(data, structuredClone(values));
    },
    async remove(keys) {
      for (const key of [].concat(keys)) delete data[key];
    },
  };
}

function inventory({ minutes = 32, instance = null, claimed = false, awarded = [] } = {}) {
  return {
    currentUser: {
      inventory: {
        dropCampaignsInProgress: [{
          id: "c1",
          game: { displayName: "World of Tanks: HEAT" },
          allow: { isEnabled: false, channels: null },
          timeBasedDrops: [{
            id: "d1",
            requiredMinutesWatched: 60,
            endAt: iso(NOW + DAY),
            benefitEdges: [{ benefit: { id: "b1", name: "Vehicle XP Booster" } }],
            self: { currentMinutesWatched: minutes, dropInstanceID: instance, isClaimed: claimed },
          }],
        }],
        gameEventDrops: awarded,
      },
    },
  };
}

function setup(clock = { at: NOW }, resolveChannels) {
  const storage = memoryStorage();
  const store = createDropsStore({ storage, now: () => clock.at, log: silent, resolveChannels });
  return { storage, store, clock };
}

test("recordInventory écrit la progression et fixe le début du suivi une seule fois", async () => {
  const { storage, store, clock } = setup();
  const result = await store.recordInventory(inventory(), { autoClaim: true });
  assert.equal(result.recorded, true);
  assert.deepEqual(result.claim, []);
  assert.equal(storage.data[DROPS_PROGRESS_KEY].drops[0].minutes, 32);
  assert.equal(storage.data[DROPS_SINCE_KEY], NOW);
  clock.at = NOW + 60_000;
  await store.recordInventory(inventory({ minutes: 33 }));
  assert.equal(storage.data[DROPS_SINCE_KEY], NOW);
  assert.deepEqual(await store.recordInventory({ nope: true }), { recorded: false, reason: "invalid", added: [], claim: [] });
});

test("un Drop prêt n'est proposé qu'à un seul onglet, et jamais sans récupération auto", async () => {
  const { store } = setup();
  assert.deepEqual((await store.recordInventory(inventory({ minutes: 60, instance: "i-1" }))).claim, []);
  const [first, second] = await Promise.all([
    store.recordInventory(inventory({ minutes: 60, instance: "i-1" }), { autoClaim: true }),
    store.recordInventory(inventory({ minutes: 60, instance: "i-1" }), { autoClaim: true }),
  ]);
  assert.deepEqual(first.claim, ["i-1"]);
  assert.deepEqual(second.claim, []);
});

test("recordClaim réussi ajoute le Drop à l'historique ; un échec libère le Drop", async () => {
  const { storage, store } = setup();
  await store.recordInventory(inventory({ minutes: 60, instance: "i-1" }), { autoClaim: true });
  const failed = await store.recordClaim({ instanceId: "i-1", ok: true, status: "DROP_EXPIRED" });
  assert.equal(failed.recorded, false);
  assert.deepEqual((await store.recordInventory(inventory({ minutes: 60, instance: "i-1" }), { autoClaim: true })).claim, ["i-1"]);

  const done = await store.recordClaim({ instanceId: "i-1", ok: true, status: "ELIGIBLE_FOR_ALL", auto: true });
  assert.equal(done.recorded, true);
  assert.equal(done.entry.name, "Vehicle XP Booster");
  assert.equal(done.entry.auto, true);
  assert.equal(storage.data[DROPS_HISTORY_KEY].length, 1);
  assert.equal(storage.data[DROPS_PROGRESS_KEY].drops.length, 0);
});

test("un Drop récupéré hors de StreamPulse est vu à la lecture suivante", async () => {
  const { storage, store, clock } = setup();
  await store.recordInventory(inventory({ minutes: 50 }));
  clock.at = NOW + 20 * 60_000;
  const result = await store.recordInventory(inventory({ minutes: 60, claimed: true }));
  assert.equal(result.added.length, 1);
  assert.equal(storage.data[DROPS_HISTORY_KEY][0].key, "drop:d1");
});

test("recordEvent fait avancer un Drop, et relance l'inventaire pour un Drop inconnu sans le récupérer", async () => {
  const { storage, store, clock } = setup();
  await store.recordInventory(inventory());
  const moved = await store.recordEvent({ type: "drop-progress", data: { drop_id: "d1", current_progress_min: 45, required_progress_min: 60, channel_id: "123" } });
  assert.equal(moved.refresh, false);
  assert.equal(storage.data[DROPS_PROGRESS_KEY].drops[0].minutes, 45);

  const ready = await store.recordEvent({ type: "drop-claim", data: { drop_id: "d1", drop_instance_id: "i-1" } }, { autoClaim: true });
  assert.deepEqual(ready.claim, ["i-1"]);

  const unknown = await store.recordEvent({ type: "drop-claim", data: { drop_id: "zz", drop_instance_id: "i-2" } }, { autoClaim: true });
  assert.equal(unknown.refresh, true);
  assert.deepEqual(unknown.claim, []);
  const again = await store.recordEvent({ type: "drop-progress", data: { drop_id: "zz", current_progress_min: 1 } });
  assert.equal(again.refresh, false, "une seule relecture par période");
  clock.at = NOW + 3 * 60_000;
  assert.equal((await store.recordEvent({ type: "drop-progress", data: { drop_id: "zz", current_progress_min: 1 } })).refresh, true);
  assert.equal((await store.recordEvent({ type: "autre" })).recorded, false);
});

test("recordCampaigns garde les campagnes lisibles et note la source", async () => {
  const { storage, store } = setup();
  assert.deepEqual(await store.recordCampaigns([null], "gql"), { recorded: false });
  const result = await store.recordCampaigns([{ id: "c1", name: "HEAT", status: "ACTIVE", startAt: iso(NOW - DAY), endAt: iso(NOW + DAY), game: { displayName: "World of Tanks: HEAT" } }], "apollo");
  assert.deepEqual(result, { recorded: true, count: 1 });
  assert.equal(storage.data[DROPS_CAMPAIGNS_KEY].source, "apollo");
  assert.equal(storage.data[DROPS_CAMPAIGNS_KEY].updatedAt, NOW);
  assert.equal((await store.readCampaigns()).campaigns.length, 1);
});

test("resolveNames nomme les chaînes des événements, et survit à une panne de Helix", async () => {
  let fail = true;
  const { storage, store } = setup({ at: NOW }, async (ids) => {
    if (fail) throw new Error("réseau");
    return ids.map((id) => ({ id, displayName: "Terracid" }));
  });
  await store.recordInventory(inventory());
  await store.recordEvent({ type: "drop-progress", data: { drop_id: "d1", current_progress_min: 40, channel_id: "123" } });
  assert.equal(await store.resolveNames(), 0);
  fail = false;
  assert.equal(await store.resolveNames(), 1);
  assert.deepEqual(storage.data[DROPS_PROGRESS_KEY].channels, { 123: "Terracid" });
  assert.equal(await store.resolveNames(), 0);
});
