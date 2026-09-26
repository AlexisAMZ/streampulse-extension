/**
 * Le pont tourne dans la page Twitch : on le charge dans un bac à sable avec
 * un faux fetch GraphQL (réseau coupé) et sans panneau de prédiction, puis on
 * lui envoie les messages du poll comme le ferait predictionsAssist.js.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("../js/inject/predictions-bridge.js", import.meta.url), "utf8");
const ORIGIN = "https://www.twitch.tv";
const GQL_URL = "https://gql.twitch.tv/gql";

function sandbox({ networkDown = false } = {}) {
  const infos = [];
  const warns = [];
  const fakeConsole = {
    info: (...args) => infos.push(args),
    warn: (...args) => warns.push(args),
    log() {},
  };
  let fetchCalls = 0;
  const nativeFetch = async () => {
    fetchCalls += 1;
    // La requête GQL du site passe (elle alimente les en-têtes capturés) ;
    // le réseau tombe juste après : nos appels échouent.
    if (networkDown && fetchCalls > 1) throw new TypeError("Failed to fetch");
    return { ok: true, json: async () => [] };
  };
  const posted = [];
  const pageListeners = [];
  const document = {
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  class FakeXMLHttpRequest {}
  FakeXMLHttpRequest.prototype.open = function () {};
  FakeXMLHttpRequest.prototype.setRequestHeader = function () {};
  const win = {
    fetch: nativeFetch,
    XMLHttpRequest: FakeXMLHttpRequest,
    postMessage: (message, origin) => posted.push({ message, origin }),
    addEventListener: (type, listener) => {
      if (type === "message") pageListeners.push(listener);
    },
  };
  win.top = win;
  // Dans la page, XMLHttpRequest et crypto sont des globaux : ici, on les
  // fournit en paramètres du bac à sable comme window et document.
  const fakeCrypto = { randomUUID: () => "00000000-1111-2222-3333-444444444444" };
  new Function("window", "location", "document", "console", "XMLHttpRequest", "crypto", SOURCE)(
    win, { origin: ORIGIN }, document, fakeConsole, FakeXMLHttpRequest, fakeCrypto
  );

  /** Le site fait sa propre requête GQL : le pont doit en retenir les en-têtes. */
  async function simulateTwitchGql() {
    await win.fetch(GQL_URL, {
      method: "POST",
      headers: { authorization: "OAuth session", "client-id": "kimne78kx3ncx6brgo4mv6wki5h1ko" },
    });
  }

  let sequence = 0;
  async function send(op, payload = {}) {
    const id = `sp-test-${++sequence}`;
    pageListeners.forEach((listener) => listener({ source: win, data: { __sp: "prediction-request", id, op, ...payload } }));
    const started = Date.now();
    for (;;) {
      const response = posted.find((item) => item.message.__sp === "prediction-response" && item.message.id === id);
      if (response) return response.message;
      if (Date.now() - started > 2000) throw new Error("pas de réponse du pont");
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  return { win, infos, warns, fetchCalls: () => fetchCalls, simulateTwitchGql, send };
}

test("réseau coupé : le contexte passe par le repli DOM et logue une seule ligne info", async () => {
  const box = sandbox({ networkDown: true });
  await box.simulateTwitchGql();
  const response = await box.send("context", { channel: "missmikkaa" });
  assert.equal(response.ok, true);
  assert.deepEqual(response.events, []);
  assert.equal(box.fetchCalls(), 2); // la requête GQL de Twitch, puis la nôtre
  assert.equal(box.infos.length, 1);
  assert.equal(box.infos[0][0], "StreamPulse: GraphQL predictions unavailable, DOM fallback:");
  assert.equal(box.infos[0][1], "Failed to fetch");
  assert.equal(box.warns.length, 0);
});

test("les requêtes suivantes ne retentent pas GraphQL pendant le cooldown ni ne re-loguent", async () => {
  const box = sandbox({ networkDown: true });
  await box.simulateTwitchGql();
  await box.send("context", { channel: "missmikkaa" });
  await box.send("context", { channel: "missmikkaa" });
  await box.send("context", { channel: "missmikkaa" });
  assert.equal(box.fetchCalls(), 2); // aucune nouvelle tentative fetch
  assert.equal(box.infos.length, 1); // dédupliqué
});

/** Horloge décalée pour franchir le cooldown de 2 minutes sans l'attendre. */
async function withFakeClock(offsetMs, run) {
  const realDateNow = Date.now;
  let clock = realDateNow() + offsetMs;
  Date.now = () => clock++;
  try {
    return await run();
  } finally {
    // eslint-disable-next-line require-atomic-updates -- remise en place de l'horloge sauvegardée avant l'essai, sans concurrence dans le test.
    Date.now = realDateNow;
  }
}

test("après le cooldown de 2 minutes, GraphQL est retenté (dédupliqué, sans warning)", async () => {
  const box = sandbox({ networkDown: true });
  await box.simulateTwitchGql();
  await box.send("context", { channel: "missmikkaa" });
  await withFakeClock(120_001, async () => {
    const response = await box.send("context", { channel: "missmikkaa" });
    assert.equal(response.ok, true);
    assert.equal(box.fetchCalls(), 3); // nouvelle tentative, à nouveau en échec
    assert.equal(box.infos.length, 1); // la déduplication couvre 10 minutes
    assert.equal(box.warns.length, 0);
  });
});

test("un pari GraphQL en échec retombe sur le DOM avec sa propre ligne dédupliquée", async () => {
  const box = sandbox({ networkDown: true });
  await box.simulateTwitchGql();
  const response = await box.send("bet", { eventId: "e1", outcomeId: "o1", outcomeTitle: "Oui", points: 100 });
  assert.equal(response.ok, false);
  assert.equal(response.error, "panel_not_found"); // pas de panneau dans le bac à sable
  assert.equal(box.infos.length, 1);
  assert.equal(box.infos[0][0], "StreamPulse: GraphQL bet unavailable, DOM fallback:");
  assert.equal(box.warns.length, 0);
});

test("GraphQL disponible : aucune bascule, aucun log", async () => {
  const box = sandbox();
  await box.simulateTwitchGql();
  const response = await box.send("context", { channel: "missmikkaa" });
  assert.equal(response.ok, true);
  assert.deepEqual(box.infos, []);
  assert.deepEqual(box.warns, []);
});
