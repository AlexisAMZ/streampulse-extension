import { test, before, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createFakeChrome } from "./helpers/fake-chrome.mjs";

// config.js n'est pas versionné (.gitignore) : sans lui, le SW ne se charge pas.
const hasConfig = fs.existsSync(new URL("../config.js", import.meta.url));
const skip = hasConfig ? false : "config.js absent (non versionné)";

let dropsStreamUrl;
let streamGameOf;
const requested = [];
// Réponses du test en cours : lives Helix du jeu, et jeu lu en direct (GQL) de la chaîne 24/7.
const scenario = { helix: [], liveGame: "", signedIn: true };

before(async () => {
  if (!hasConfig) return;
  globalThis.chrome = createFakeChrome();
  globalThis.chrome.cookies.get = async () => (scenario.signedIn ? { value: "token" } : null);
  globalThis.self = globalThis;
  mock.method(globalThis, "fetch", async (url, init) => {
    requested.push(String(url));
    let body;
    if (String(url).includes("gql.twitch.tv")) {
      body = { data: { user: { stream: scenario.liveGame === "" ? null : { id: "1" }, broadcastSettings: { game: { id: scenario.liveGame } } } } };
    } else if (String(url).includes("user_login=")) {
      body = { data: [{ type: "live", user_login: "streampulse247", game_id: "1234" }] };
    } else {
      body = { data: scenario.helix };
    }
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body), init };
  });
  ({ dropsStreamUrl, streamGameOf } = await import("../js/sw/drops.js"));
});

const DIRECTORY = "https://www.twitch.tv/directory/game/Jeu?filter=drops";

test("un live du jeu avec le tag Drops est choisi", { skip }, async () => {
  Object.assign(scenario, { helix: [{ user_login: "autre" }, { user_login: "gamer", tags: ["Drops Enabled"] }], liveGame: "" });
  assert.equal(await dropsStreamUrl({ gameId: "1234", game: "Jeu" }), "https://www.twitch.tv/gamer");
});

test("la chaîne StreamPulse 24/7 n'est choisie que si elle est vraiment sur le jeu", { skip }, async () => {
  Object.assign(scenario, { helix: [{ user_login: "streampulse247", tags: ["DropsEnabled"] }, { user_login: "gamer" }], liveGame: "1234" });
  assert.equal(await dropsStreamUrl({ gameId: "1234", game: "Jeu" }), "https://www.twitch.tv/streampulse247");
});

test("Helix en retard : la chaîne 24/7 a déjà changé de jeu, un autre live est choisi", { skip }, async () => {
  Object.assign(scenario, { helix: [{ user_login: "streampulse247", tags: ["DropsEnabled"] }, { user_login: "gamer" }], liveGame: "9999" });
  assert.equal(await dropsStreamUrl({ gameId: "1234", game: "Jeu" }), "https://www.twitch.tv/gamer");
});

test("seule la chaîne 24/7 apparaît mais elle n'est plus sur le jeu : page du jeu", { skip }, async () => {
  Object.assign(scenario, { helix: [{ user_login: "StreamPulse247", tags: ["DropsEnabled"] }], liveGame: "9999" });
  assert.equal(await dropsStreamUrl({ gameId: "1234", game: "Jeu" }), DIRECTORY);
});

test("jeu de la chaîne 24/7 impossible à vérifier (déconnecté de Twitch) : jamais choisie", { skip }, async () => {
  Object.assign(scenario, { helix: [{ user_login: "streampulse247", tags: ["DropsEnabled"] }], liveGame: "1234", signedIn: false });
  try {
    assert.equal(await dropsStreamUrl({ gameId: "1234", game: "Jeu" }), DIRECTORY);
  } finally {
    scenario.signedIn = true;
  }
});

test("mode auto : le jeu d'un onglet est lu en direct, avant Helix", { skip }, async () => {
  Object.assign(scenario, { liveGame: "9999" });
  assert.equal(await streamGameOf("streampulse247"), "9999");
  Object.assign(scenario, { liveGame: "" });
  assert.equal(await streamGameOf("streampulse247"), "");
});

test("mode auto : sans session Twitch, le jeu vient de Helix", { skip }, async () => {
  Object.assign(scenario, { signedIn: false });
  try {
    assert.equal(await streamGameOf("streampulse247"), "1234");
  } finally {
    scenario.signedIn = true;
  }
});
