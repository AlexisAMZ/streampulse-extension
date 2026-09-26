/**
 * Le relais tourne dans le monde isolé d'un onglet Twitch : on le charge avec
 * un faux `chrome` et une fausse fenêtre, puis on joue les messages du pont et
 * du service worker.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("../js/dropsRecorder.js", import.meta.url), "utf8");
const ORIGIN = "https://www.twitch.tv";

function sandbox({ prefs = {}, stored = {}, respond = () => ({}) } = {}) {
  const posted = [];
  const sent = [];
  const pageListeners = [];
  const storageListeners = [];
  let runtimeListener = null;
  const timers = [];
  const win = {
    postMessage: (message) => posted.push(message),
    addEventListener: (type, listener) => type === "message" && pageListeners.push(listener),
  };
  win.top = win;
  const chrome = {
    runtime: {
      id: "streampulse",
      lastError: undefined,
      sendMessage: async (message) => {
        sent.push(message);
        return respond(message);
      },
      onMessage: { addListener: (listener) => { runtimeListener = listener; } },
    },
    storage: {
      local: { get: (_keys, callback) => callback({ betaGeneralPreferences: prefs, ...stored }) },
      onChanged: { addListener: (listener) => storageListeners.push(listener) },
    },
  };
  const fakeSetTimeout = (fn) => timers.push(fn);
  new Function("window", "location", "chrome", "setTimeout", "setInterval", SOURCE)(win, { origin: ORIGIN }, chrome, fakeSetTimeout, () => {});
  const fromPage = (data) => pageListeners.forEach((listener) => listener({ source: win, data }));
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  const commands = () => posted.filter((message) => message.source === "streampulse:drops:cmd");
  return { posted, sent, fromPage, flush, commands, timers, storageListeners, chrome, runtime: () => runtimeListener };
}

test("le relais annonce qu'il est prêt, puis relit l'inventaire et les campagnes périmés", async () => {
  const box = sandbox();
  assert.deepEqual(box.posted[0], { source: "streampulse:drops:ready" });
  assert.equal(box.timers.length, 1, "première lecture différée, le temps que la page envoie ses requêtes");
  box.timers[0]();
  assert.deepEqual(box.commands().map((command) => command.action), ["inventory", "campaigns"]);
});

test("une lecture récente d'un autre onglet évite une relecture", async () => {
  const now = Date.now();
  const box = sandbox({ stored: { streamPulseDropsProgress: { updatedAt: now }, streamPulseDropsCampaigns: { updatedAt: now } } });
  box.timers[0]();
  assert.deepEqual(box.commands(), []);
});

test("un inventaire lu est transmis, puis les Drops confiés par le service worker sont récupérés", async () => {
  const box = sandbox({ respond: (message) => (message.type === "recordDropsInventory" ? { claim: ["999#c1#d1"] } : {}) });
  box.fromPage({ source: "streampulse:drops", v: 1, kind: "result", action: "inventory", ok: true, data: { currentUser: {} } });
  await box.flush();
  assert.equal(box.sent[0].type, "recordDropsInventory");
  assert.equal(box.sent[0].ok, true);
  const [claim] = box.commands();
  assert.deepEqual([claim.action, claim.instanceId, claim.auto], ["claim", "999#c1#d1", true]);

  box.fromPage({ source: "streampulse:drops", v: 1, kind: "result", action: "claim", instanceId: "999#c1#d1", auto: true, ok: true, data: { status: "ELIGIBLE_FOR_ALL" } });
  await box.flush();
  assert.deepEqual(box.sent[1], { type: "recordDropClaim", instanceId: "999#c1#d1", auto: true, ok: true, status: "ELIGIBLE_FOR_ALL", error: "" });
});

test("un événement inconnu du service worker relance l'inventaire", async () => {
  const box = sandbox({ respond: () => ({ refresh: true, claim: [] }) });
  box.fromPage({ source: "streampulse:drops", v: 1, kind: "event", data: { type: "drop-progress", data: { drop_id: "x" } } });
  await box.flush();
  assert.equal(box.sent[0].type, "recordDropsEvent");
  assert.deepEqual(box.commands().map((command) => command.action), ["inventory"]);
});

test("une récupération demandée par le popup part vers le pont, marquée manuelle", () => {
  const box = sandbox();
  let response;
  box.runtime()({ type: "dropsCommand", action: "claim", instanceId: "i-1" }, {}, (value) => { response = value; });
  assert.deepEqual(response, { ok: true });
  const [claim] = box.commands();
  assert.deepEqual([claim.action, claim.instanceId, claim.auto], ["claim", "i-1", false]);
  box.runtime()({ type: "dropsCommand", action: "effacer" }, {}, (value) => { response = value; });
  assert.deepEqual(response, { ok: false });
});

test("suivi désactivé : rien n'est relayé ni relu", async () => {
  const box = sandbox({ prefs: { dropsTracking: false } });
  assert.equal(box.timers.length, 0);
  box.fromPage({ source: "streampulse:drops", v: 1, kind: "event", data: { type: "drop-progress", data: {} } });
  await box.flush();
  assert.equal(box.sent.length, 0);
  let response;
  box.runtime()({ type: "dropsCommand", action: "inventory" }, {}, (value) => { response = value; });
  assert.deepEqual(response, { ok: false });

  box.storageListeners.forEach((listener) => listener({ betaGeneralPreferences: { newValue: { dropsTracking: true } } }, "local"));
  assert.equal(box.timers.length, 1, "réactiver le suivi relance les lectures");
});

test("extension rechargée : le relais s'arrête sans lever d'erreur", () => {
  const box = sandbox();
  box.chrome.runtime.id = undefined;
  box.chrome.storage.local.get = () => { throw new Error("Extension context invalidated."); };
  assert.doesNotThrow(() => box.timers[0]());
  assert.deepEqual(box.commands(), []);
});
