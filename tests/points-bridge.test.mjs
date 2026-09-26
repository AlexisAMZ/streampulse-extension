/**
 * Le pont tourne dans la page Twitch : on le charge dans un bac à sable avec
 * un faux WebSocket, puis on lui envoie les messages tels que Twitch les reçoit.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("../js/inject/points-bridge.js", import.meta.url), "utf8");
const ORIGIN = "https://www.twitch.tv";

const pointsEarned = {
  type: "points-earned",
  data: {
    timestamp: "2026-09-26T19:47:12.3Z",
    channel_id: "123",
    point_gain: { channel_id: "123", total_points: 12, baseline_points: 10, reason_code: "WATCH", multipliers: [{ reason_code: "SUB_T1", factor: 0.2 }] },
    balance: { channel_id: "123", balance: 23410 },
  },
};

/** Enveloppe Hermes relevée sur twitch.tv le 2026-09-26. */
const hermes = (inner) => JSON.stringify({
  notification: { subscription: { id: "abc" }, type: "pubsub", pubsub: JSON.stringify(inner) },
  id: "msg-1",
  type: "notification",
  timestamp: "2026-09-26T19:47:12.4Z",
});

/** Enveloppe de l'ancien PubSub. */
const pubsub = (inner) => JSON.stringify({
  type: "MESSAGE",
  data: { topic: "community-points-user-v1.999", message: JSON.stringify(inner) },
});

function sandbox() {
  class FakeWebSocket {
    static OPEN = 1;
    constructor(url) {
      this.url = url;
      this.listeners = [];
    }
    addEventListener(type, listener) {
      if (type === "message") this.listeners.push(listener);
    }
    receive(data) {
      this.listeners.forEach((listener) => listener({ data }));
    }
  }
  const posted = [];
  const pageListeners = [];
  const win = {
    WebSocket: FakeWebSocket,
    postMessage: (message, origin) => posted.push({ message, origin }),
    addEventListener: (type, listener) => {
      if (type === "message") pageListeners.push(listener);
    },
  };
  win.top = win;
  new Function("window", "location", SOURCE)(win, { origin: ORIGIN });
  const ready = () => pageListeners.forEach((listener) => listener({ source: win, data: { source: "streampulse:points:ready" } }));
  return { win, posted, ready, FakeWebSocket };
}

test("un gain reçu par Hermes est transmis une fois", () => {
  const { win, posted, ready } = sandbox();
  ready();
  const socket = new win.WebSocket("wss://hermes.twitch.tv/v1");
  socket.receive(hermes(pointsEarned));
  assert.equal(posted.length, 1);
  assert.deepEqual(posted[0].message, { source: "streampulse:points", v: 1, data: pointsEarned.data });
  assert.equal(posted[0].origin, ORIGIN);
});

test("un gain reçu par l'ancien PubSub est transmis aussi", () => {
  const { win, posted, ready } = sandbox();
  ready();
  new win.WebSocket("wss://pubsub-edge.twitch.tv/v1").receive(pubsub(pointsEarned));
  assert.equal(posted.length, 1);
  assert.equal(posted[0].message.data.point_gain.reason_code, "WATCH");
});

test("les autres messages sont ignorés", () => {
  const { win, posted, ready } = sandbox();
  ready();
  const socket = new win.WebSocket("wss://hermes.twitch.tv/v1");
  socket.receive(hermes({ type: "viewcount", viewers: 35271 }));
  socket.receive('{"type":"keepalive"}');
  socket.receive("pas du json mais points-earned quand même");
  socket.receive(new ArrayBuffer(8));
  assert.equal(posted.length, 0);
});

test("les gains reçus avant le relais sont gardés puis transmis", () => {
  const { win, posted, ready } = sandbox();
  const socket = new win.WebSocket("wss://hermes.twitch.tv/v1");
  socket.receive(hermes(pointsEarned));
  assert.equal(posted.length, 0);
  ready();
  assert.equal(posted.length, 1);
});

test("Twitch garde ses propres écouteurs et un vrai WebSocket", () => {
  const { win, FakeWebSocket } = sandbox();
  const socket = new win.WebSocket("wss://hermes.twitch.tv/v1");
  const seen = [];
  socket.addEventListener("message", (event) => seen.push(event.data));
  socket.receive("bonjour");
  assert.deepEqual(seen, ["bonjour"]);
  assert.ok(socket instanceof FakeWebSocket);
  assert.ok(socket instanceof win.WebSocket);
  assert.equal(win.WebSocket.OPEN, 1);
});
