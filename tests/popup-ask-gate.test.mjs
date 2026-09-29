import test from "node:test";
import assert from "node:assert/strict";

globalThis.navigator ??= { userAgent: "" };
const { isFirstOpenOfVersion, openAskGate, ASK_VERSION_KEY, GLANCE_MS } = await import("../js/popup-review.js");

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    get: async (key) => (key in data ? { [key]: data[key] } : {}),
    set: async (items) => { Object.assign(data, items); },
  };
}

test("première ouverture d'une version : jamais de bandeau", () => {
  assert.equal(isFirstOpenOfVersion(undefined, "3.1.0"), true);
  assert.equal(isFirstOpenOfVersion("", "3.1.0"), true);
  assert.equal(isFirstOpenOfVersion("3.0.9", "3.1.0"), true);
  assert.equal(isFirstOpenOfVersion("3.1.0", "3.1.0"), false);
});

test("la porte reste fermée à la première ouverture après une mise à jour, et retient la version", async () => {
  const storage = memoryStorage({ [ASK_VERSION_KEY]: "3.0.9" });
  const waits = [];
  const open = await openAskGate({ storage, version: "3.1.0", wait: async (ms) => { waits.push(ms); } });
  assert.equal(open, false);
  assert.equal(storage.data[ASK_VERSION_KEY], "3.1.0");
  assert.deepEqual(waits, [], "aucune attente inutile quand la porte est fermée");
});

test("ouverture suivante : la porte s'ouvre après le coup d'œil", async () => {
  const storage = memoryStorage({ [ASK_VERSION_KEY]: "3.1.0" });
  const waits = [];
  const open = await openAskGate({ storage, version: "3.1.0", wait: async (ms) => { waits.push(ms); } });
  assert.equal(open, true);
  assert.deepEqual(waits, [GLANCE_MS]);
  assert.ok(GLANCE_MS >= 3000, "le coup d'œil de deux secondes n'est jamais interrompu");
});

test("stockage illisible : la porte reste fermée plutôt que de risquer un bandeau", async () => {
  const storage = { get: async () => { throw new Error("quota"); }, set: async () => {} };
  const open = await openAskGate({ storage, version: "3.1.0", wait: async () => {}, warn: () => {} });
  assert.equal(open, false);
});
