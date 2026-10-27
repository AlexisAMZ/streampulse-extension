import { test } from "node:test";
import assert from "node:assert/strict";

// Le service worker décide seul de la récupération auto des Drops remontés par
// les content scripts : sans StreamPulse+ signé, aucune récupération.
const data = {};
const area = {
  async get(keys) {
    const list = keys == null ? Object.keys(data) : typeof keys === "object" && !Array.isArray(keys) ? Object.keys(keys) : [].concat(keys);
    return Object.fromEntries(list.filter((key) => key in data).map((key) => [key, structuredClone(data[key])]));
  },
  async set(values) { Object.assign(data, structuredClone(values)); },
  async remove(keys) { for (const key of [].concat(keys)) delete data[key]; },
};
globalThis.chrome = {
  storage: { local: area, session: area, sync: area, onChanged: { addListener() {} } },
  runtime: { id: "x", getManifest: () => ({ version: "1" }), getURL: (path) => `chrome-extension://x/${path}`, sendMessage: async () => {} },
  alarms: { create() {}, get: async () => null, clear: async () => {} },
  i18n: { getUILanguage: () => "fr" },
  tabs: { query: async () => [] },
  action: {},
};

const { handleRecordDropsInventory } = await import("../js/sw/messages-drops.js");
const NOW = Date.now();

function inventory(instanceId) {
  return { currentUser: { inventory: { gameEventDrops: [], dropCampaignsInProgress: [{
    id: `c-${instanceId}`, game: { displayName: "G" }, allow: { isEnabled: false, channels: null },
    timeBasedDrops: [{
      id: `d-${instanceId}`, requiredMinutesWatched: 60, endAt: new Date(NOW + 86400000).toISOString(),
      benefitEdges: [{ benefit: { id: `b-${instanceId}`, name: "X" } }],
      self: { currentMinutesWatched: 60, dropInstanceID: instanceId, isClaimed: false },
    }],
  }] } } };
}

const record = (instanceId) => new Promise((resolve) => {
  handleRecordDropsInventory({ ok: true, data: inventory(instanceId) }, {}, resolve);
});

test("Drops remontés par un content script : pas de récupération auto sans Plus", async () => {
  delete data.streamPulsePlus;
  assert.deepEqual((await record("FREE")).claim, []);
  // Licence écrite à la main, sans signature du serveur : toujours rien.
  data.streamPulsePlus = { status: "active", licenseKey: "SP-AAAA-BBBB-CCCC-DDDD", plan: "lifetime", verifiedAt: NOW };
  assert.deepEqual((await record("FORGED")).claim, []);
});

test("Drops remontés par un content script : récupération auto avec Plus", async () => {
  data.streamPulsePlus = { status: "active", licenseKey: "SP-AAAA-BBBB-CCCC-DDDD", plan: "monthly", verifiedAt: NOW, iat: NOW, sig: "sig" };
  assert.deepEqual((await record("PLUS")).claim, ["PLUS"]);
});
