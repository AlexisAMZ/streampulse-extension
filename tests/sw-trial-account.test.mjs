import { test } from "node:test";
import assert from "node:assert/strict";
import { PLUS_KEY, isPlusActive, trialOnOtherAccount, trialPaused } from "../js/plus.js";
import { refreshTrialAccount } from "../js/sw/trial-account.js";

const NOW = Date.parse("2026-10-28T12:00:00Z");
const DEVICE = "abcdef0123456789abcdef0123456789";
const trial = (extra = {}) => ({ status: "active", licenseKey: `TRIAL-${DEVICE}`, plan: "trial", since: NOW, iat: NOW, sig: "s", ...extra });

function memoryStorage(initial = {}) {
  const data = { streamPulseDeviceId: DEVICE, ...initial };
  return {
    data,
    async get(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.filter((key) => key in data).map((key) => [key, data[key]]));
    },
    async set(values) { Object.assign(data, values); },
  };
}
const noFetch = async () => { throw new Error("pas d'appel attendu"); };
const deps = (storage, viewer, fetch = noFetch) => ({ storage, fetch, viewerId: async () => viewer, now: NOW });

test("bon compte Twitch : StreamPulse+ actif", async () => {
  const storage = memoryStorage({ [PLUS_KEY]: trial({ twitch: "42" }) });
  assert.equal(await refreshTrialAccount(deps(storage, "42")), "same");
  assert.equal(isPlusActive(storage.data[PLUS_KEY], NOW), true);
});

test("autre compte Twitch : tout StreamPulse+ en pause, l'essai reste reconnu", async () => {
  const storage = memoryStorage({ [PLUS_KEY]: trial({ twitch: "42" }) });
  assert.equal(await refreshTrialAccount(deps(storage, "7")), "other");
  assert.equal(isPlusActive(storage.data[PLUS_KEY], NOW), false);
  assert.equal(trialPaused(storage.data[PLUS_KEY], NOW), true);
  // Retour sur le bon compte : tout revient.
  assert.equal(await refreshTrialAccount(deps(storage, "42")), "same");
  assert.equal(isPlusActive(storage.data[PLUS_KEY], NOW), true);
  assert.equal(trialPaused(storage.data[PLUS_KEY], NOW), false);
});

test("déconnecté de Twitch : pas de pause (rien à récupérer sur aucun compte)", async () => {
  const storage = memoryStorage({ [PLUS_KEY]: trial({ twitch: "42" }) });
  assert.equal(await refreshTrialAccount(deps(storage, "")), "same");
  assert.equal(isPlusActive(storage.data[PLUS_KEY], NOW), true);
});

test("essai sans compte : lié au premier compte connecté", async () => {
  const storage = memoryStorage({ [PLUS_KEY]: trial() });
  const fetch = async () => ({ ok: true, status: 200, json: async () => ({ valid: true, plan: "trial", key: `TRIAL-${DEVICE}`, since: NOW, twitch: "42", iat: NOW, sig: "s2" }) });
  assert.equal(await refreshTrialAccount(deps(storage, "42", fetch)), "bound");
  assert.equal(storage.data[PLUS_KEY].twitch, "42");
  assert.equal(isPlusActive(storage.data[PLUS_KEY], NOW), true);
});

test("licence payante : jamais de pause, quel que soit le compte", async () => {
  const paid = { ...trial(), plan: "monthly", licenseKey: "SP-AAAA-BBBB-CCCC-DDDD" };
  const storage = memoryStorage({ [PLUS_KEY]: paid });
  assert.equal(await refreshTrialAccount(deps(storage, "7")), "none");
  assert.equal(storage.data[PLUS_KEY], paid);
  assert.equal(trialOnOtherAccount(paid, "7"), false);
});
