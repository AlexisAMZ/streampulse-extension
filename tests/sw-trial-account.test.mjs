import { test } from "node:test";
import assert from "node:assert/strict";
import { PLUS_KEY, TRIAL_ACCOUNT_KEY, plusForAccount } from "../js/plus.js";
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
    async remove(key) { delete data[key]; },
  };
}
const noFetch = async () => { throw new Error("pas d'appel attendu"); };
const deps = (storage, viewer, fetch = noFetch) => ({ storage, fetch, viewerId: async () => viewer, now: NOW });

test("bon compte Twitch : les récupérations restent ouvertes", async () => {
  const storage = memoryStorage({ [PLUS_KEY]: trial({ twitch: "42" }) });
  assert.equal(await refreshTrialAccount(deps(storage, "42")), "allowed");
  assert.equal(plusForAccount(storage.data[PLUS_KEY], storage.data[TRIAL_ACCOUNT_KEY], NOW), true);
});

test("autre compte Twitch : Drops et badges en pause", async () => {
  const storage = memoryStorage({ [PLUS_KEY]: trial({ twitch: "42" }) });
  assert.equal(await refreshTrialAccount(deps(storage, "7")), "other");
  assert.equal(plusForAccount(storage.data[PLUS_KEY], storage.data[TRIAL_ACCOUNT_KEY], NOW), false);
});

test("essai sans compte : lié au premier compte connecté", async () => {
  const storage = memoryStorage({ [PLUS_KEY]: trial() });
  const fetch = async () => ({ ok: true, status: 200, json: async () => ({ valid: true, plan: "trial", key: `TRIAL-${DEVICE}`, since: NOW, twitch: "42", iat: NOW, sig: "s2" }) });
  assert.equal(await refreshTrialAccount(deps(storage, "42", fetch)), "bound");
  assert.equal(storage.data[PLUS_KEY].twitch, "42");
  assert.equal(storage.data[TRIAL_ACCOUNT_KEY].allowed, true);
});

test("licence payante : aucune vérification de compte, l'état est effacé", async () => {
  const storage = memoryStorage({ [PLUS_KEY]: { ...trial(), plan: "monthly", licenseKey: "SP-AAAA-BBBB-CCCC-DDDD" }, [TRIAL_ACCOUNT_KEY]: { allowed: false } });
  assert.equal(await refreshTrialAccount(deps(storage, "7")), "none");
  assert.equal(storage.data[TRIAL_ACCOUNT_KEY], undefined);
  assert.equal(plusForAccount(storage.data[PLUS_KEY], undefined, NOW), true);
});
