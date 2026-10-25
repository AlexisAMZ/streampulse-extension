import { test, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createFakeChrome } from "./helpers/fake-chrome.mjs";

// config.js n'est pas versionné (.gitignore) : sans lui, le SW ne se charge pas.
const skip = fs.existsSync(new URL("../config.js", import.meta.url)) ? false : "config.js absent (non versionné)";

const ID = "UClqVM39KDCN-RISpnU6Wz-A";
const PAGE = `<html><head><link rel="canonical" href="https://www.youtube.com/channel/${ID}"><meta property="og:title" content="Zabuza &amp; Co"><meta property="og:image" content="https://yt3.googleusercontent.com/zabuza=s900"></head></html>`;

let PlatformChecker;
let addStreamer;
const requested = [];
let pageOk = true;

before(async () => {
  if (skip) return;
  globalThis.chrome = createFakeChrome();
  globalThis.self = globalThis;
  mock.method(globalThis, "fetch", async (url) => {
    requested.push(String(url));
    const ok = pageOk && String(url).includes(`/channel/${ID}`);
    return { ok, status: ok ? 200 : 404, text: async () => (ok ? PAGE : ""), json: async () => ({}) };
  });
  ({ PlatformChecker } = await import("../js/sw/platform-checker.js"));
  ({ addStreamer } = await import("../js/sw/add-streamer.js"));
});

beforeEach(() => {
  if (skip) return;
  requested.length = 0;
  pageOk = true;
  PlatformChecker._youtubeCache.clear();
  PlatformChecker._youtubeCacheLoaded = true;
});

test("un identifiant de chaîne se résout en nom et photo, pas en identifiant brut", { skip }, async () => {
  const channel = await PlatformChecker.resolveYoutubeChannel(ID);
  assert.equal(channel.id, ID);
  assert.equal(channel.name, "Zabuza & Co");
  assert.equal(channel.avatar, "https://yt3.googleusercontent.com/zabuza=s900");
  assert.ok(requested.some((url) => url.includes(`/channel/${ID}`)));
});

test("page de chaîne injoignable : repli sur l'identifiant, sans le mémoriser comme nom", { skip }, async () => {
  pageOk = false;
  const first = await PlatformChecker.resolveYoutubeChannel(ID);
  assert.equal(first.id, ID);
  assert.equal(first.name, ID);
  pageOk = true;
  const second = await PlatformChecker.resolveYoutubeChannel(ID);
  assert.equal(second.name, "Zabuza & Co");
});

test("une entrée de cache qui n'a que l'identifiant comme nom est réparée", { skip }, async () => {
  PlatformChecker._youtubeCache.set(ID, { id: ID, avatar: "", name: ID });
  const channel = await PlatformChecker.resolveYoutubeChannel(ID);
  assert.equal(channel.name, "Zabuza & Co");
});

test("l'ajout d'une chaîne par identifiant enregistre son vrai nom", { skip }, async () => {
  const result = await addStreamer({ platform: "youtube", handle: ID });
  assert.equal(result.success, true);
  const added = result.streamers.find((streamer) => streamer.handle === ID);
  assert.equal(added.displayName, "Zabuza & Co");
});
