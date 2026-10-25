import { test, before, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createFakeChrome } from "./helpers/fake-chrome.mjs";

// config.js n'est pas versionné (.gitignore) : sans lui, le SW ne se charge pas.
const hasConfig = fs.existsSync(new URL("../config.js", import.meta.url));
const skip = hasConfig ? false : "config.js absent (non versionné)";

let dropsStreamUrl;
const requested = [];

before(async () => {
  if (!hasConfig) return;
  globalThis.chrome = createFakeChrome();
  globalThis.self = globalThis;
  mock.method(globalThis, "fetch", async (url) => {
    requested.push(String(url));
    const body = String(url).includes("user_id=")
      ? { data: [{ type: "live", user_login: "streampulse247" }] }
      : { data: [{ user_login: "gamer", tags: ["Drops Enabled"] }] };
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
  });
  ({ dropsStreamUrl } = await import("../js/sw/drops.js"));
});

test("le mode auto et le mode général n'envoient plus sur la chaîne StreamPulse, même en live", { skip }, async () => {
  const url = await dropsStreamUrl({ gameId: "1234", game: "Jeu" });
  assert.equal(url, "https://www.twitch.tv/gamer");
  assert.equal(requested.some((request) => request.includes("user_id=")), false);
});
