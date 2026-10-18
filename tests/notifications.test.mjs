import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createFakeChrome } from "./helpers/fake-chrome.mjs";

globalThis.chrome = createFakeChrome();
const { NotificationCenter, NotificationSystem } = await import("../js/sw/notifications.js");
const { pollStreamers } = await import("../js/sw/polling.js");
const { DataStore } = await import("../js/sw/stores.js");
const { streamerCache, streamerStates, streamerLiveState } = await import("../js/sw/state.js");

const NOW = new Date(2026, 9, 17, 12).getTime();
const KEY = "streamPulseNotificationPause";
const prefs = { soundsEnabled: false, quietHoursEnabled: false };
let fake;
const notifications = () => fake.calls.filter(([name]) => name === "notifications.create");

beforeEach(() => {
  fake = createFakeChrome({ local: { betaGeneralPreferences: prefs } });
  globalThis.chrome = fake;
  NotificationCenter.initialized = false;
  NotificationCenter.clickMap.clear();
  NotificationSystem._testStep = 0;
  streamerCache.clear();
  streamerStates.clear();
  streamerLiveState.clear();
});

test("NotificationCenter bloque tout envoi et son pendant le silence, puis reprend sans timer ni effacement", async (t) => {
  let now = NOW;
  t.mock.method(Date, "now", () => now);
  const pause = { until: NOW + 1000, exceptPinned: false };
  await fake.storage.local.set({ [KEY]: pause });
  assert.equal(await NotificationCenter.show({ title: "Drop", playSound: true }), null);
  assert.equal(notifications().length, 0);
  assert.equal(fake.calls.some(([name]) => name.startsWith("offscreen.") || name === "alarms.create"), false);
  assert.equal(NotificationCenter.clickMap.size, 0);
  now = pause.until;
  assert.equal(typeof await NotificationCenter.show({ title: "New event" }), "string");
  assert.equal(notifications().length, 1);
  assert.deepEqual((await fake.storage.local.get(KEY))[KEY], pause);
});

test("NotificationCenter : exception des favoris, lots mixtes refuses et pas d'exception implicite", async (t) => {
  t.mock.method(Date, "now", () => NOW);
  await fake.storage.local.set({ [KEY]: { until: NOW + 1000, exceptPinned: true }, betaPinnedIds: ["fav", "fav2"] });
  assert.equal(await NotificationCenter.show({ streamerId: "other" }), null);
  assert.equal(await NotificationCenter.show({}), null);
  assert.equal(await NotificationCenter.show({ streamerIds: [] }), null);
  assert.equal(await NotificationCenter.show({ streamerIds: ["fav", "other"] }), null);
  assert.equal(typeof await NotificationCenter.show({ streamerId: "fav" }), "string");
  assert.equal(typeof await NotificationCenter.show({ streamerIds: ["fav", "fav2"] }), "string");
  assert.equal(notifications().length, 2);
});

test("NotificationCenter : les heures calmes bloquent aussi les favoris et les anciennes alarmes", async (t) => {
  t.mock.method(Date, "now", () => NOW);
  const entry = { alarmName: `${NotificationCenter.alarmPrefix}old`, intervalMinutes: 10, title: "Legacy" };
  await fake.storage.local.set({
    betaGeneralPreferences: { ...prefs, quietHoursEnabled: true, quietHoursStart: "10:00", quietHoursEnd: "14:00" },
    [KEY]: { until: NOW + 1000, exceptPinned: true }, betaPinnedIds: ["fav"],
    [NotificationCenter.storageKey]: [entry],
  });
  assert.equal(await NotificationCenter.show({ streamerId: "fav" }), null);
  assert.equal(await NotificationCenter.handleAlarm(entry.alarmName), true);
  assert.equal(notifications().length, 0);
});

test("les trois variantes TEST explicites passent, pas un streamer simplement nomme test", async (t) => {
  t.mock.method(Date, "now", () => NOW);
  await fake.storage.local.set({
    [KEY]: { until: NOW + 1000, exceptPinned: false },
    betaGeneralPreferences: { ...prefs, quietHoursEnabled: true, quietHoursStart: "10:00", quietHoursEnd: "14:00" },
  });
  for (let i = 0; i < 3; i += 1) await NotificationSystem.sendTest(prefs);
  assert.equal(notifications().length, 3);
  await NotificationSystem.notifyLive({ id: "test", platform: "twitch", handle: "test" }, { isLive: true }, prefs);
  assert.equal(notifications().length, 3);
});

test("le gate est relu pour chaque evenement, y compris categorie, titre et evenements generiques", async (t) => {
  t.mock.method(Date, "now", () => NOW);
  const streamer = { id: "fav", handle: "fav", platform: "twitch" };
  await NotificationSystem.notifyLive(streamer, { isLive: true }, prefs);
  await fake.storage.local.set({ [KEY]: { until: NOW + 1000, exceptPinned: false } });
  await NotificationSystem.notifyGameChange(streamer, "Chess", "Poker", prefs);
  await NotificationSystem.notifyTitleChange(streamer, "A", "B", prefs);
  await NotificationCenter.show({ title: "Raid" });
  assert.equal(notifications().length, 1);
});

test("un stockage illisible n'autorise pas silencieusement un envoi", async (t) => {
  t.mock.method(console, "warn", () => {});
  t.mock.method(fake.storage.local, "get", async () => { throw new Error("unavailable"); });
  assert.equal(await NotificationCenter.show({ playSound: true }), null);
  assert.equal(notifications().length, 0);
});

function mockPolling(t, getTitle = () => "Title") {
  t.mock.method(Date, "now", () => NOW);
  t.mock.method(globalThis, "fetch", async (url) => {
    const href = String(url);
    if (href.includes("streampulse-config")) return Response.json({ clientId: "fake-client", accessToken: "fake-token" });
    if (href.includes("helix/streams")) return Response.json({ data: ["fav", "other"].map((name) => ({
      user_login: name, id: `session-${name}`, game_name: "Chess", title: getTitle(), viewer_count: 10,
      started_at: new Date(NOW - 3_600_000).toISOString(),
    })) });
    throw new Error("network disabled in tests");
  });
}

test("rattrapage : seuls les noms favoris passent, les etats de tous sont persistes sans rejeu a la reprise", async (t) => {
  let title = "Title";
  mockPolling(t, () => title);
  await fake.storage.local.set({
    betaGeneralStreamers: ["fav", "other"].map((id) => ({ id, platform: "twitch", handle: id, displayName: id, titleNotificationsEnabled: true })),
    [KEY]: { until: NOW + 1000, exceptPinned: true }, betaPinnedIds: ["fav"],
  });
  await pollStreamers();
  assert.equal(notifications().length, 1);
  assert.match(notifications()[0][2].message, /fav/);
  assert.doesNotMatch(notifications()[0][2].message, /other/);
  assert.equal((await DataStore.getLiveState()).other.isLive, true);
  assert.equal((await DataStore.getLiveState()).fav.isLive, true);
  await fake.storage.local.remove(KEY);
  streamerLiveState.clear();
  await pollStreamers();
  assert.equal(notifications().length, 1, "un redemarrage MV3 ne rejoue pas les alertes silencieuses");
  title = "Next";
  await pollStreamers();
  assert.equal(notifications().length, 3, "les nouveaux evenements peuvent de nouveau notifier");
});

test("un silence commence pendant le sondage est respecte avant l'envoi", async (t) => {
  mockPolling(t);
  await fake.storage.local.set({ betaGeneralStreamers: [{ id: "fav", platform: "twitch", handle: "fav" }] });
  const save = DataStore.saveLiveState.bind(DataStore);
  t.mock.method(DataStore, "saveLiveState", async (state) => {
    await save(state);
    await fake.storage.local.set({ [KEY]: { until: NOW + 1000, exceptPinned: false } });
  });
  await pollStreamers();
  assert.equal(notifications().length, 0);
  assert.equal((await DataStore.getLiveState()).fav.isLive, true);
});
