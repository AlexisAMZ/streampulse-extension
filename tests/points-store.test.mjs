import test from "node:test";
import assert from "node:assert/strict";
import { createPointsStore } from "../js/points-store.js";
import { POINTS_CHANNELS_KEY, POINTS_DAILY_KEY, POINTS_JOURNAL_KEY } from "../js/points-data.js";

const NOW = new Date(2026, 8, 26, 21, 50).getTime();

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

const raw = (channel, total, at = NOW, reason = "WATCH") => ({
  timestamp: new Date(at).toISOString(),
  point_gain: { channel_id: channel, total_points: total, baseline_points: total, reason_code: reason, multipliers: [] },
  balance: { balance: 1000 },
});

const silent = { warn() {} };

test("record enregistre un gain et refuse un doublon ou une charge invalide", async () => {
  const storage = memoryStorage();
  const store = createPointsStore({ storage, resolveChannels: async () => [], now: () => NOW, log: silent });
  assert.deepEqual(await store.record(raw("1", 10)), { recorded: true, channelId: "1" });
  assert.deepEqual(await store.record(raw("1", 10)), { recorded: false, reason: "duplicate" });
  assert.deepEqual(await store.record({ nope: true }), { recorded: false, reason: "invalid" });
  assert.equal(storage.data[POINTS_JOURNAL_KEY].length, 1);
});

test("deux gains simultanés sont tous les deux gardés (file sérialisée)", async () => {
  const storage = memoryStorage();
  const store = createPointsStore({ storage, resolveChannels: async () => [], now: () => NOW, log: silent });
  await Promise.all([store.record(raw("1", 10, NOW - 1)), store.record(raw("2", 50, NOW, "CLAIM"))]);
  const day = storage.data[POINTS_DAILY_KEY]["2026-09-26"];
  assert.equal(day["1"].WATCH.points, 10);
  assert.equal(day["2"].CLAIM.points, 50);
});

test("resolveNames nomme les chaînes inconnues, et survit à un échec du réseau", async () => {
  const storage = memoryStorage();
  let calls = 0;
  const store = createPointsStore({
    storage,
    resolveChannels: async (ids) => {
      calls += 1;
      if (calls === 1) throw new Error("réseau");
      return ids.map((id) => ({ id, login: `chaine${id}`, displayName: `Chaine${id}`, avatar: "https://x/a.png" }));
    },
    now: () => NOW,
    log: silent,
  });
  await store.record(raw("7", 10));
  assert.equal(await store.resolveNames(), 0);
  assert.equal(await store.resolveNames(), 1);
  assert.equal(storage.data[POINTS_CHANNELS_KEY]["7"].displayName, "Chaine7");
  assert.equal(storage.data[POINTS_CHANNELS_KEY]["7"].balance, 1000, "le reste de la fiche est gardé");
  assert.equal(await store.resolveNames(), 0, "plus rien à résoudre");
  assert.equal(calls, 2);
});

test("reset efface les trois clés", async () => {
  const storage = memoryStorage();
  const store = createPointsStore({ storage, resolveChannels: async () => [], now: () => NOW, log: silent });
  await store.record(raw("1", 10));
  await store.reset();
  assert.deepEqual(Object.keys(storage.data).filter((key) => key.startsWith("streamPulsePoints")), []);
});

test("le nettoyage des vieux gains passe au plus une fois par jour", async () => {
  const old = NOW - 90 * 86_400_000;
  const storage = memoryStorage();
  let clock = old;
  const store = createPointsStore({ storage, resolveChannels: async () => [], now: () => clock, log: silent });
  await store.record(raw("1", 10, old));
  clock = NOW;
  await store.record(raw("1", 12, NOW));
  assert.equal(storage.data[POINTS_JOURNAL_KEY].length, 1, "le gain de 90 jours sort du journal");
});
