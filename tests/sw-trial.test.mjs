import { test } from "node:test";
import assert from "node:assert/strict";
import { PLUS_KEY } from "../js/plus.js";
import { TRIAL_STATE_KEY, beginTrialOnInstall, requestPendingTrial } from "../js/sw/trial.js";

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

test("installation : l'essai est demandé et la licence d'essai enregistrée", async () => {
  const storage = memoryStorage();
  assert.equal(await beginTrialOnInstall({ storage, fetch: granted, now: NOW }), "started");
  assert.equal(storage.data[PLUS_KEY].plan, "trial");
  assert.equal(storage.data[PLUS_KEY].checkedAt, NOW);
  assert.deepEqual(storage.data[TRIAL_STATE_KEY], { pending: false, at: NOW });
});

test("panne réseau : la demande reste en attente, puis repart au réveil suivant", async () => {
  const storage = memoryStorage();
  assert.equal(await beginTrialOnInstall({ storage, fetch: reply(503, {}), now: NOW }), "retry");
  assert.equal(storage.data[TRIAL_STATE_KEY].pending, true);
  assert.equal(await requestPendingTrial({ storage, fetch: granted, now: NOW + 1 }), "started");
});

test("essai déjà utilisé sur cet appareil : plus de demande", async () => {
  const storage = memoryStorage();
  assert.equal(await beginTrialOnInstall({ storage, fetch: reply(404, { valid: false, error: "trial_ended" }), now: NOW }), "refused");
  assert.equal(storage.data[PLUS_KEY], undefined);
  assert.equal(await requestPendingTrial({ storage, fetch: granted, now: NOW }), "none");
});

test("licence déjà présente : jamais remplacée par un essai", async () => {
  const bought = { licenseKey: "SP-AAAA-BBBB-CCCC-DDDD", plan: "monthly", status: "active" };
  const storage = memoryStorage({ [PLUS_KEY]: bought });
  assert.equal(await beginTrialOnInstall({ storage, fetch: granted, now: NOW }), "licensed");
  assert.equal(storage.data[PLUS_KEY], bought);
});
