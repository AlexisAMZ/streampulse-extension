import { test } from "node:test";
import assert from "node:assert/strict";
import { activatePlusFromSite, isTrustedPlusSender } from "../js/sw/plus-external.js";

function memoryStorage() {
  const data = {};
  return {
    data,
    get: async (key) => (key in data ? { [key]: data[key] } : {}),
    set: async (values) => Object.assign(data, values),
  };
}
const okFetch = async () => ({ ok: true, status: 200, json: async () => ({ valid: true, plan: "yearly" }) });
const KEY = "SP-ABCD-EFGH-IJKL-MNOP";
const SITE = { origin: "https://streampulse.tech", url: "https://streampulse.tech/fr/plus/merci" };

test("seul le site StreamPulse est accepté", () => {
  assert.equal(isTrustedPlusSender(SITE), true);
  assert.equal(isTrustedPlusSender({ url: "https://www.streampulse.tech/plus/merci" }), true);
  assert.equal(isTrustedPlusSender({ origin: "https://streampulse.tech.evil.com" }), false);
  assert.equal(isTrustedPlusSender({ url: "pas une url" }), false);
  assert.equal(isTrustedPlusSender(undefined), false);
});

test("une clé valide est vérifiée puis enregistrée", async () => {
  const storage = memoryStorage();
  let activated = null;
  const result = await activatePlusFromSite({ type: "activatePlus", key: KEY }, SITE, {
    storage, fetch: okFetch, now: 1000, onActivated: (record) => { activated = record; },
  });
  assert.deepEqual(result, { ok: true, plan: "yearly" });
  assert.equal(storage.data.streamPulsePlus?.licenseKey ?? Object.values(storage.data).find((v) => v?.licenseKey)?.licenseKey, KEY);
  assert.equal(activated.plan, "yearly");
});

test("une autre origine ne touche à rien", async () => {
  const storage = memoryStorage();
  let called = false;
  const result = await activatePlusFromSite({ type: "activatePlus", key: KEY }, { origin: "https://evil.com" }, {
    storage, fetch: async () => { called = true; return okFetch(); },
  });
  assert.deepEqual(result, { ok: false, error: "origin" });
  assert.equal(called, false);
});

test("clé refusée par le serveur : rien n'est enregistré", async () => {
  const storage = memoryStorage();
  const result = await activatePlusFromSite({ type: "activatePlus", key: KEY }, SITE, {
    storage, fetch: async () => ({ ok: false, status: 404, json: async () => ({ valid: false }) }),
  });
  assert.deepEqual(result, { ok: false, error: "invalid" });
  assert.equal(Object.values(storage.data).some((v) => v?.licenseKey), false);
});

test("ping permet au site de savoir si l'extension est là", async () => {
  assert.deepEqual(await activatePlusFromSite({ type: "ping" }, SITE, { storage: memoryStorage(), fetch: okFetch }), { ok: true });
});
