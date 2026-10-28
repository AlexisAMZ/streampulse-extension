import { test } from "node:test";
import assert from "node:assert/strict";
import { PLUS_KEY } from "../js/plus.js";
import { TRIAL_STATE_KEY, requestPendingTrial, requestTrial } from "../js/sw/trial.js";

const NOW = Date.parse("2026-10-28T12:00:00Z");
const DEVICE = "abcdef0123456789abcdef0123456789";

function memoryStorage(initial = {}) {
  const data = { streamPulseDeviceId: DEVICE, ...initial };
  return {
    data,
    async get(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.filter((key) => key in data).map((key) => [key, data[key]]));
    },
    async set(values) {
      Object.assign(data, values);
    },
  };
}

const reply = (status, body) => async () => ({ ok: status < 400, status, json: async () => body });
const granted = reply(200, { valid: true, plan: "trial", key: `TRIAL-${DEVICE}`, since: NOW, iat: NOW, sig: "s" });

test("bouton : l'essai est demandé et la licence d'essai enregistrée", async () => {
  const storage = memoryStorage();
  assert.equal(await requestTrial({ storage, fetch: granted, now: NOW }), "started");
  assert.equal(storage.data[PLUS_KEY].plan, "trial");
  assert.equal(storage.data[PLUS_KEY].checkedAt, NOW);
  assert.deepEqual(storage.data[TRIAL_STATE_KEY], { pending: false, used: true, at: NOW });
});

test("panne réseau : la demande reste en attente, puis repart au réveil suivant", async () => {
  const storage = memoryStorage();
  assert.equal(await requestTrial({ storage, fetch: reply(503, {}), now: NOW }), "retry");
  assert.equal(storage.data[TRIAL_STATE_KEY].pending, true);
  assert.equal(await requestPendingTrial({ storage, fetch: granted, now: NOW + 1 }), "started");
});

test("essai déjà utilisé sur cet appareil : plus de demande", async () => {
  const storage = memoryStorage();
  assert.equal(await requestTrial({ storage, fetch: reply(404, { valid: false, error: "trial_ended" }), now: NOW }), "refused");
  assert.equal(storage.data[PLUS_KEY], undefined);
  assert.equal(await requestPendingTrial({ storage, fetch: granted, now: NOW }), "none");
});

test("licence déjà présente : jamais remplacée par un essai", async () => {
  const bought = { licenseKey: "SP-AAAA-BBBB-CCCC-DDDD", plan: "monthly", status: "active" };
  const storage = memoryStorage({ [PLUS_KEY]: bought });
  assert.equal(await requestTrial({ storage, fetch: granted, now: NOW }), "licensed");
  assert.equal(storage.data[PLUS_KEY], bought);
});

test("bouton : demande l'essai même si l'état dit déjà utilisé, le serveur tranche", async () => {
  const storage = memoryStorage({ [TRIAL_STATE_KEY]: { pending: false, used: true, at: NOW - 1 } });
  assert.equal(await requestTrial({ storage, fetch: reply(404, { valid: false, error: "trial_ended" }), now: NOW }), "refused");
  assert.equal(await requestTrial({ storage, fetch: granted, now: NOW }), "started");
  assert.equal(storage.data[PLUS_KEY].plan, "trial");
});

test("triangulation : compte Kick et marque Google envoyés, marque posée après l'essai", async () => {
  const storage = memoryStorage();
  const sync = memoryStorage({});
  let sent = null;
  const fetch = async (url, init) => { sent = JSON.parse(init.body); return granted(); };
  const deps = { storage, fetch, now: NOW, viewerId: async () => "42", kickId: async () => "777", syncStorage: sync };
  assert.equal(await requestTrial(deps), "started");
  assert.deepEqual({ twitch: sent.twitch, kick: sent.kick, synced: sent.synced }, { twitch: "42", kick: "777", synced: undefined });
  assert.equal(sync.data.streamPulseTrialTaken, true);
  // Réinstallation (stockage local vide) sur le même compte Google : la marque part au serveur.
  await requestTrial({ ...deps, storage: memoryStorage(), fetch: async (url, init) => { sent = JSON.parse(init.body); return reply(404, { valid: false, error: "trial_ended" })(); } });
  assert.equal(sent.synced, true);
});
