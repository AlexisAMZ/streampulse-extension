import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeChrome } from "./helpers/fake-chrome.mjs";
import {
  NOTIFICATION_PAUSE_KEY,
  diagnoseStreamerNotifications,
  pauseNotifications,
  readNotificationControls,
  readNotificationPermission,
  resumeNotifications,
  setNotificationPauseException,
} from "../js/notification-controls.js";
import { nextLiveStateFrom, planStreamerAlerts, restoreLiveStateEntry } from "../js/sw/poll-logic.js";
import { decideSmartAlert, normalizeRules } from "../js/smart-alerts.js";

const NOW = new Date(2026, 9, 17, 12).getTime();
const streamer = Object.freeze({ id: "caster", notificationsEnabled: true, gameNotificationsEnabled: true, titleNotificationsEnabled: false });
const status = Object.freeze({ updatedAt: NOW, active: { isLive: true, platform: "twitch", sessionId: "v1", game: "Chess", title: "Final", viewers: 50 } });
const liveState = Object.freeze({ ...status.active, updatedAt: NOW, matchedRuleIds: ["chess"] });
const smartRules = Object.freeze({ caster: [{ id: "chess", games: ["Chess"] }] });
const diagnose = (extra = {}) => diagnoseStreamerNotifications({ streamer, status, liveState, now: NOW, ...extra });

test("pause/reprise ecrivent seulement la cle dediee, les lectures n'effacent pas l'expiration", async () => {
  const preferences = { quietHoursEnabled: true, soundsEnabled: false, language: "fr", liveNotifications: false };
  const fake = createFakeChrome({ local: { betaGeneralPreferences: preferences, betaPinnedIds: ["caster"] } });
  const initial = fake.storage.local.dump();
  const pause = await pauseNotifications("hour", true, fake.storage.local, NOW);
  assert.equal(NOTIFICATION_PAUSE_KEY, "streamPulseNotificationPause");
  assert.deepEqual(pause, { until: NOW + 3_600_000, exceptPinned: true });
  assert.deepEqual(fake.storage.local.dump(), { ...initial, [NOTIFICATION_PAUSE_KEY]: pause });
  const read = await readNotificationControls(fake.storage.local);
  assert.deepEqual(read.pause, pause);
  assert.deepEqual(read.pinnedIds, ["caster"]);
  assert.equal(read.preferences.soundsEnabled, false);
  assert.deepEqual(fake.storage.local.dump(), { ...initial, [NOTIFICATION_PAUSE_KEY]: pause });
  await resumeNotifications(fake.storage.local);
  assert.deepEqual(fake.storage.local.dump(), initial);
  await assert.rejects(pauseNotifications("invalid", false, fake.storage.local, NOW), RangeError);
  assert.deepEqual(fake.storage.local.dump(), initial);
});

test("permissions Chrome : autorise, refuse ou inconnu, sans demander une permission", async () => {
  assert.equal(await readNotificationPermission({ getPermissionLevel: async () => "granted" }), "granted");
  assert.equal(await readNotificationPermission({ getPermissionLevel: async () => "denied" }), "denied");
  assert.equal(await readNotificationPermission({ getPermissionLevel: async () => { throw new Error("unavailable"); } }), "unknown");
  assert.equal(await readNotificationPermission({}), "unknown");
  assert.equal(await readNotificationPermission({ getPermissionLevel: async () => "unexpected" }), "unknown");
});

test("modifier l'exception conserve l'echeance et ne reactive jamais une pause terminee", async () => {
  const pause = { until: NOW + 1000, exceptPinned: false };
  const fake = createFakeChrome({ local: { [NOTIFICATION_PAUSE_KEY]: pause, betaPinnedIds: ["caster"] } });
  assert.deepEqual(await setNotificationPauseException(true, fake.storage.local, NOW), { ...pause, exceptPinned: true });
  assert.deepEqual(fake.storage.local.dump(), { [NOTIFICATION_PAUSE_KEY]: { ...pause, exceptPinned: true }, betaPinnedIds: ["caster"] });
  await setNotificationPauseException(false, fake.storage.local, pause.until);
  assert.deepEqual(fake.storage.local.dump()[NOTIFICATION_PAUSE_KEY], { ...pause, exceptPinned: true });
  await resumeNotifications(fake.storage.local);
  await setNotificationPauseException(true, fake.storage.local, NOW);
  assert.deepEqual(fake.storage.local.dump(), { betaPinnedIds: ["caster"] });
});

test("diagnostic : regles par streamer, pas de verrou global invente ni d'historique", () => {
  const before = structuredClone({ streamer, status, liveState });
  const result = diagnose({ preferences: { liveNotifications: false, gameNotifications: false, titleNotifications: true } });
  assert.equal(result.decision.reason, "noChange");
  assert.deepEqual(result.settings, { live: true, game: true, title: false });
  assert.equal(result.updatedAt, NOW);
  assert.deepEqual({ streamer, status, liveState }, before);
  assert.equal(diagnose({ status: null }).decision.reason, "noStatus");
  assert.equal(diagnose({ liveState: null }).decision.reason, "noBaseline");
  assert.equal(diagnose({ status: { active: { isLive: false } } }).decision.reason, "offline");
  assert.equal(diagnose({ status: { active: { isLive: false, isError: true } } }).decision.reason, "apiError");
  assert.equal(diagnose({ status: { active: { isLive: false, supportsLiveStatus: false } } }).decision.reason, "unsupported");
});

test("diagnostic : permission, silence et heures calmes restent des blocages independants", () => {
  const preferences = { quietHoursEnabled: true, quietHoursStart: "10:00", quietHoursEnd: "14:00" };
  const pause = { until: NOW + 60_000, exceptPinned: true };
  const result = diagnose({ preferences, pause, pinnedIds: ["caster"], permission: "denied" });
  assert.equal(result.permission, "denied");
  assert.equal(result.silence.pinnedException, true);
  assert.equal(result.silence.quiet, true);
  assert.equal(result.silence.blocked, true);
  assert.equal(diagnose({ pause, pinnedIds: [] }).silence.paused, true);
  assert.equal(diagnose({ pause, now: pause.until }).silence.paused, false);
});

test("diagnostic : Plus inactif ignore les regles, Plus actif explique le match courant sans pretendre a un envoi", () => {
  const inactive = diagnose({ smartRules, isPlus: false });
  assert.equal(inactive.smart.configured, 1);
  assert.equal(inactive.smart.active, false);
  assert.equal(inactive.decision.reason, "noChange");
  const matched = diagnose({ smartRules, isPlus: true });
  assert.equal(matched.smart.matched, 1);
  assert.equal(matched.decision.reason, "smartUnchanged");
  assert.equal(diagnose({ smartRules, isPlus: true, liveState: { ...liveState, matchedRuleIds: [] } }).decision.reason, "smartMatch");
  assert.equal(diagnose({ smartRules, isPlus: true, status: { ...status, active: { ...status.active, game: "Poker" } } }).decision.reason, "smartNoMatch");
  const unavailable = diagnose({ smartRules, isPlus: true, status: { active: { isLive: false, isError: true } } });
  assert.equal(unavailable.smart.matched, null);
  assert.equal(unavailable.decision.reason, "apiError");
});

test("diagnostic : les actions simulees sont celles du vrai plan, pour les memes donnees", () => {
  for (const isPlus of [false, true]) {
    for (const active of [status.active, { ...status.active, game: "Poker", title: "Next" }, { ...status.active, sessionId: "v2" }, { isLive: false }, { isError: true }]) {
      const current = { ...status, active };
      const previous = restoreLiveStateEntry(liveState);
      const next = nextLiveStateFrom(current, previous, streamer, NOW);
      const smartDecision = isPlus && !next.isError ? decideSmartAlert(normalizeRules(smartRules).caster, active, previous.matchedRuleIds) : null;
      const expected = planStreamerAlerts({ streamer, previous, next, smartDecision, now: NOW });
      assert.deepEqual(diagnose({ status: current, smartRules, isPlus }).decision.alerts, expected);
    }
  }
});
