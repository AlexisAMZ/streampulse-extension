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
  // Le jeton de session du READY est reporté par défaut dans les messages de
  // la page ; un test peut le remplacer pour simuler une falsification.
  const fromPage = (data) => pageListeners.forEach((listener) => listener({ source: win, data: { token: posted[0]?.token, ...data } }));
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  const commands = () => posted.filter((message) => message.source === "streampulse:drops:cmd");
  return { posted, sent, fromPage, flush, commands, timers, storageListeners, chrome, runtime: () => runtimeListener };
}

test("le relais annonce qu'il est prêt avec un jeton de session, puis relit l'inventaire et les campagnes périmés", async () => {
  const box = sandbox();
  assert.equal(box.posted[0].source, "streampulse:drops:ready");
  assert.ok(box.posted[0].token, "un jeton de session est transmis au pont");
  assert.equal(box.timers.length, 1, "première lecture différée, le temps que la page envoie ses requêtes");
  box.timers[0]();
  assert.deepEqual(box.commands().map((command) => command.action), ["inventory", "campaigns"]);
});

test("un message sans le bon jeton de session est ignoré", async () => {
  const box = sandbox({ respond: () => ({ refresh: true, claim: [] }) });
  box.fromPage({ source: "streampulse:drops", v: 1, token: "jeton forgé", kind: "event", data: { type: "drop-progress", data: { drop_id: "x" } } });
  box.fromPage({ source: "streampulse:drops", v: 1, token: undefined, kind: "event", data: { type: "drop-progress", data: { drop_id: "x" } } });
  await box.flush();
  assert.equal(box.sent.length, 0, "aucun événement forgé ne part au service worker");
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

test("le détail demandé par le service worker part vers le pont, puis au plus une fois par minute", async (t) => {
  let clock = 1_000_000;
  t.mock.method(Date, "now", () => clock);
  const box = sandbox({
    respond: (message) => (message.type === "recordDropsCampaigns" ? { details: ["c-p3", "c-ac"] } : message.type === "recordDropsCampaignDetails" ? { details: ["c-x1"] } : {}),
  });
  box.fromPage({ source: "streampulse:drops", v: 1, kind: "result", action: "campaigns", ok: true, data: { campaigns: [{ id: "c-p3" }], source: "gql" } });
  await box.flush();
  const [details] = box.commands();
  assert.deepEqual([details.action, details.ids], ["details", ["c-p3", "c-ac"]]);

  box.fromPage({ source: "streampulse:drops", v: 1, kind: "result", action: "details", ok: true, data: { campaigns: [], ids: ["c-p3", "c-ac"] } });
  await box.flush();
  assert.deepEqual(box.sent.at(-1), { type: "recordDropsCampaignDetails", ok: true, data: [], ids: ["c-p3", "c-ac"], error: undefined });
  assert.equal(box.commands().length, 1, "la suite attend la minute suivante");

  clock += 61_000;
  box.timers[0]();
  // Le passage suivant relit aussi inventaire et campagnes : on cherche la demande de détail.
  assert.deepEqual(box.commands().filter((command) => command.action === "details").at(-1).ids, ["c-x1"]);
});
