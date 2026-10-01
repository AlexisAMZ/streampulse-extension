// Charge le service worker complet (js/background.js et js/sw/*) sous Node
// avec un faux `chrome` : attrape les imports cassés, les cycles qui touchent
// une valeur avant son initialisation (TDZ) et les listeners oubliés, puis
// exerce les principaux handlers de messages (validation, expéditeur).
import { test, before, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createFakeChrome } from "./helpers/fake-chrome.mjs";

// config.js n'est pas versionné (.gitignore) : sans lui, le SW ne se charge pas.
const hasConfig = fs.existsSync(new URL("../config.js", import.meta.url));
const skip = hasConfig ? false : "config.js absent (non versionné)";

let fake;
let dispatch;
const popup = () => ({ id: fake.runtime.id, url: fake.runtime.getURL("html/popup.html") });
const twitchTab = () => ({ id: fake.runtime.id, url: "https://www.twitch.tv/foo", tab: { id: 9 } });

function send(request, sender) {
  return new Promise((resolve) => {
    const async = dispatch(request, sender, resolve);
    if (!async) setTimeout(() => resolve(undefined), 20);
  });
}

before(async () => {
  if (!hasConfig) return;
  fake = createFakeChrome();
  globalThis.chrome = fake;
  globalThis.self = globalThis;
  globalThis.fetch = async () => {
    throw new Error("réseau coupé (test)");
  };
  // Le SW journalise ses échecs réseau (attendus ici) : on les tait.
  mock.method(console, "warn", () => {});
  mock.method(console, "info", () => {});
  await import("../js/background.js");
  await new Promise((resolve) => setTimeout(resolve, 50));
  dispatch = fake.runtime.onMessage.listeners[0];
});

test("les listeners MV3 sont posés au chargement", { skip }, () => {
  assert.equal(fake.runtime.onMessage.listeners.length, 1);
  assert.equal(fake.runtime.onInstalled.listeners.length, 1);
  assert.equal(fake.runtime.onStartup.listeners.length, 1);
  assert.equal(fake.alarms.onAlarm.listeners.length, 1);
  assert.equal(fake.notifications.onClicked.listeners.length, 1);
  assert.equal(fake.notifications.onClosed.listeners.length, 1);
  // Trois listeners storage.onChanged : anti-discard des onglets, synchro
  // multi-appareils et libellé du menu contextuel.
  assert.equal(fake.storage.onChanged.listeners.length, 3);
  assert.equal(fake.tabs.onUpdated.listeners.length, 2);
  assert.equal(typeof globalThis.__SP_DEBUG__?.fakeRaid, "function");
});

test("expéditeur étranger refusé", { skip }, async () => {
  assert.deepEqual(await send({ type: "getStreamers" }, { id: "intrus" }), { error: "forbidden" });
});

test("action sensible refusée depuis un content script", { skip }, async () => {
  assert.deepEqual(await send({ type: "resetPreferences" }, twitchTab()), { error: "forbidden" });
});

test("un content script peut mettre à jour une préférence validée", { skip }, async () => {
  const written = await send({ type: "updatePreferences", updates: { theme: "light" } }, twitchTab());
  assert.equal(written.success, true);
  const unknown = await send({ type: "updatePreferences", updates: { nope: 1 } }, twitchTab());
  assert.equal(typeof unknown.error, "string");
});

test("getStreamers renvoie la liste, les statuts et les préférences", { skip }, async () => {
  const response = await send({ type: "getStreamers" }, popup());
  assert.ok(Array.isArray(response.streamers));
  assert.equal(typeof response.preferences, "object");
});

test("updatePreferences: charge vide acceptée, clé inconnue refusée, clé connue écrite", { skip }, async () => {
  assert.equal((await send({ type: "updatePreferences", updates: {} }, popup())).success, true);
  const unknown = await send({ type: "updatePreferences", updates: { nope: 1 } }, popup());
  assert.equal(typeof unknown.error, "string");
  const written = await send({ type: "updatePreferences", updates: { theme: "light" } }, popup());
  assert.equal(written.success, true);
  assert.equal(written.preferences.theme, "light");
});

test("addStreamer refuse un pseudo invalide", { skip }, async () => {
  const response = await send({ type: "addStreamer", platform: "twitch", handle: "!!" }, popup());
  assert.equal(typeof response.error, "string");
});

test("lookupTwitchUser refuse un pseudo vide", { skip }, async () => {
  assert.deepEqual(await send({ type: "lookupTwitchUser", handle: "" }, twitchTab()), { error: "invalid" });
});

test("reorderStreamers et setPinnedStreamers écrivent depuis le stockage courant", { skip }, async () => {
  await fake.storage.local.set({ betaGeneralStreamers: [{ id: "a", platform: "twitch", handle: "a" }, { id: "b", platform: "twitch", handle: "b" }] });
  const reordered = await send({ type: "reorderStreamers", order: ["b", "a"] }, popup());
  assert.deepEqual(reordered.streamers.map((s) => s.id), ["b", "a"]);
  const pinned = await send({ type: "setPinnedStreamers", pinnedIds: ["a", "zzz", "a"] }, popup());
  assert.deepEqual(pinned.pinnedIds, ["a"]);
});

test("trackWatchTime compte un seul onglet par chaîne et par minute", { skip }, async () => {
  const tab = (id) => ({ id: fake.runtime.id, url: "https://www.twitch.tv/x", tab: { id } });
  const first = await send({ type: "trackWatchTime", platform: "twitch", channel: "x", seconds: 60, game: "G" }, tab(1));
  const second = await send({ type: "trackWatchTime", platform: "twitch", channel: "x", seconds: 60, game: "G" }, tab(2));
  assert.equal(first.counted, true);
  assert.equal(second.counted, false);
});

test("incrementStat et getEventLogs", { skip }, async () => {
  assert.equal((await send({ type: "incrementStat", stat: "raidsCancelled", raidTarget: "bob" }, twitchTab())).success, true);
  const { logs } = await send({ type: "getEventLogs" }, popup());
  assert.equal(logs[0].type, "raid");
  assert.match(logs[0].text, /bob/);
});

test("type de message inconnu : pas de réponse", { skip }, async () => {
  assert.equal(await send({ type: "inconnu" }, popup()), undefined);
});

test("addStreamer refuse un doublon et une chaîne introuvable", { skip }, async () => {
  await fake.storage.local.set({ betaGeneralStreamers: [{ id: "dup", platform: "twitch", handle: "dup" }] });
  const duplicate = await send({ type: "addStreamer", platform: "twitch", handle: "DUP" }, popup());
  assert.equal(typeof duplicate.error, "string");
  // Réseau coupé : YouTube ne résout pas la chaîne, rien n'est écrit.
  const missing = await send({ type: "addStreamer", platform: "youtube", handle: "inconnu" }, popup());
  assert.equal(typeof missing.error, "string");
  const { betaGeneralStreamers } = await fake.storage.local.get("betaGeneralStreamers");
  assert.equal(betaGeneralStreamers.length, 1);
});

test("sondage : rattrapage groupé puis alerte de catégorie, état conservé en erreur", { skip }, async () => {
  let game = "Chess";
  let helixDown = false;
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.includes("streampulse-config")) return Response.json({ clientId: "cid", accessToken: "tok" });
    if (href.includes("helix/streams")) {
      if (helixDown) return new Response("", { status: 500, statusText: "down" });
      return Response.json({ data: [{ user_login: "caster", id: "s1", game_name: game, title: "t", viewer_count: 5, started_at: new Date().toISOString() }] });
    }
    throw new Error(`réseau coupé (test) ${href}`);
  };
  await fake.storage.local.set({
    betaGeneralStreamers: [{ id: "caster", platform: "twitch", handle: "caster", notificationsEnabled: true, gameNotificationsEnabled: true }],
  });
  const notifications = () => fake.calls.filter(([name]) => name === "notifications.create").map(([, , options]) => options.title);

  const before = notifications().length;
  await send({ type: "refreshStatuses" }, popup());
  assert.equal(notifications().length, before + 1, "une seule notification de rattrapage");

  game = "Poker";
  await send({ type: "refreshStatuses" }, popup());
  assert.equal(notifications().length, before + 2, "alerte de changement de catégorie");

  helixDown = true;
  await send({ type: "refreshStatuses" }, popup());
  const { streamPulseLiveState } = await fake.storage.local.get("streamPulseLiveState");
  assert.equal(streamPulseLiveState.caster.isLive, true, "l'erreur d'API ne passe pas le streamer hors ligne");
  assert.equal(notifications().length, before + 2);
});
