import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PREFERENCES, sanitizePreferences } from "../js/preferences-data.js";
import { SOUND_KINDS, SOUND_PRESETS, SOUND_SYNTH, resolveSound } from "../js/notification-sounds.js";

test("sans réglage, tout reste sur le son d'origine", () => {
  for (const kind of SOUND_KINDS) assert.equal(resolveSound({}, kind), "classic");
  assert.equal(DEFAULT_PREFERENCES.notificationSound, "classic");
});

test("le son général s'applique à tous les types", () => {
  const preferences = sanitizePreferences({ notificationSound: "chime" });
  for (const kind of SOUND_KINDS) assert.equal(resolveSound(preferences, kind), "chime");
});

test("un type peut avoir son propre son, les autres héritent", () => {
  const preferences = sanitizePreferences({ notificationSound: "chime", soundRaid: "pulse" });
  assert.equal(resolveSound(preferences, "raid", { plus: true }), "pulse");
  assert.equal(resolveSound(preferences, "live", { plus: true }), "chime");
});

test("sans StreamPulse+, le son par type est ignoré : le son général s'applique partout", () => {
  const preferences = sanitizePreferences({ notificationSound: "chime", soundRaid: "pulse", soundLive: "bubble" });
  for (const kind of SOUND_KINDS) {
    assert.equal(resolveSound(preferences, kind), "chime");
    assert.equal(resolveSound(preferences, kind, { plus: false }), "chime");
  }
  assert.equal(preferences.soundRaid, "pulse", "le choix reste enregistré pour le jour où l'abonnement revient");
});

test("sons coupés : aucun son, quel que soit le type", () => {
  const preferences = sanitizePreferences({ soundsEnabled: false, soundLive: "bubble" });
  for (const kind of SOUND_KINDS) assert.equal(resolveSound(preferences, kind, { plus: true }), null);
});

test("valeurs inconnues ou corrompues : retour au défaut, jamais de crash", () => {
  const preferences = sanitizePreferences({ notificationSound: "../../evil", soundLive: 42, soundGame: "nope" });
  assert.equal(preferences.notificationSound, "classic");
  assert.equal(preferences.soundLive, "inherit");
  assert.equal(preferences.soundGame, "inherit");
  assert.equal(resolveSound(preferences, "unknown-kind"), "classic");
  assert.equal(resolveSound(null, "live"), "classic");
});

test("chaque son de synthèse est bien formé et court", () => {
  for (const id of SOUND_PRESETS.filter((preset) => preset !== "classic")) {
    const notes = SOUND_SYNTH[id];
    assert.ok(notes?.length > 0, id);
    for (const note of notes) {
      assert.ok(note.freq >= 100 && note.freq <= 3000, `${id} freq`);
      assert.ok(note.start >= 0 && note.dur > 0 && note.start + note.dur <= 1.5, `${id} durée`);
      assert.ok(note.gain > 0 && note.gain <= 0.5, `${id} gain`);
    }
  }
  assert.equal(SOUND_SYNTH.classic, undefined);
});

test("le service worker applique le son par type seulement avec StreamPulse+", async () => {
  const { createFakeChrome } = await import("./helpers/fake-chrome.mjs");
  globalThis.chrome = createFakeChrome({ local: {} });
  const { NotificationCenter, NotificationSystem } = await import("../js/sw/notifications.js");
  const preferences = sanitizePreferences({ notificationSound: "chime", soundGame: "drop", language: "en" });
  const streamer = { id: "ada", platform: "twitch", handle: "ada" };
  async function played(local) {
    const fake = createFakeChrome({ local });
    globalThis.chrome = fake;
    NotificationCenter.initialized = false;
    await NotificationSystem.notifyLive(streamer, { platform: "twitch", viewers: 3 }, preferences);
    await NotificationSystem.notifyGameChange(streamer, "A", "B", preferences, null, true);
    await NotificationSystem.notifyLive(streamer, { platform: "twitch" }, { ...preferences, soundsEnabled: false });
    return fake.calls.filter(([name]) => name === "runtime.sendMessage").map(([, message]) => message?.audioCommand?.preset);
  }
  const plus = { streamPulsePlus: { status: "active", plan: "lifetime", licenseKey: "SP-TEST" } };
  assert.deepEqual(await played(plus), ["chime", "drop"]);
  assert.deepEqual(await played({}), ["chime", "chime"]);
});
