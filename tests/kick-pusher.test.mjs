import test from "node:test";
import assert from "node:assert/strict";

test("Kick Pusher : synchronisation, souscription et réception des événements de live", async () => {
  const sentMessages = [];
  let socketInstance = null;

  class MockWebSocket {
    static OPEN = 1;
    constructor(url) {
      this.url = url;
      this.readyState = MockWebSocket.OPEN;
      socketInstance = this;
      setTimeout(() => {
        if (this.onopen) this.onopen();
      }, 5);
    }
    send(data) {
      sentMessages.push(JSON.parse(data));
    }
    close() {
      this.readyState = 3;
      if (this.onclose) this.onclose();
    }
  }

  globalThis.WebSocket = MockWebSocket;
  globalThis.chrome = {
    runtime: { getManifest: () => ({ version: "26.11.20" }) },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    storage: {
      local: {
        get: async (keys) => {
          if (keys === "betaGeneralStreamers" || (Array.isArray(keys) && keys.includes("betaGeneralStreamers"))) {
            return {
              betaGeneralStreamers: [
                { id: "streamer1", platform: "kick", kickChannelId: 12345, handle: "streamer1" },
              ],
            };
          }
          return {};
        },
        set: async () => {},
      },
    },
  };

  const { syncKickPusher, stopKickPusher } = await import("../js/sw/kick-pusher.js");

  await syncKickPusher();
  await new Promise((r) => setTimeout(r, 20));

  // Simule l'événement de bienvenue Pusher
  socketInstance.onmessage({
    data: JSON.stringify({ event: "pusher:connection_established", data: "{}" }),
  });

  // Vérifie la souscription
  const subMsg = sentMessages.find((m) => m.event === "pusher:subscribe");
  assert.ok(subMsg, "Souscription Pusher envoyée");
  assert.equal(subMsg.data.channel, "channel.12345");

  // Simule un événement LivestreamStarted
  socketInstance.onmessage({
    data: JSON.stringify({
      event: "App\\Events\\LivestreamStarted",
      data: JSON.stringify({ channel_id: 12345 }),
    }),
  });

  // Arrêt propre
  stopKickPusher();
  assert.equal(socketInstance.readyState, 3, "Socket fermé");
});
