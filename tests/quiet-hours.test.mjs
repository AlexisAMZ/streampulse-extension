import { test } from "node:test";
import assert from "node:assert/strict";
import { isWithinQuietHours, parseHhMm } from "../js/quiet-hours.js";
import { DEFAULT_QUIET_END, DEFAULT_QUIET_START, getNotificationSilence, isQuietNow, normalizeNotificationPause, normalizeQuietTime, notificationPauseUntil } from "../js/quiet-hours.js";

const at = (h, m) => new Date(2026, 8, 28, h, m, 0, 0);

test("parseHhMm : « HH:MM » strict, sinon null", () => {
  assert.deepEqual(parseHhMm("23:00"), { hours: 23, minutes: 0 });
  assert.deepEqual(parseHhMm("8:15"), { hours: 8, minutes: 15 });
  assert.equal(parseHhMm("24:00"), null);
  assert.equal(parseHhMm("08:60"), null);
  assert.equal(parseHhMm("08h15"), null);
  assert.equal(parseHhMm(""), null);
  assert.equal(parseHhMm(null), null);
  assert.equal(parseHhMm(undefined), null);
});

test("heures calmes désactivées : jamais bloqué", () => {
  assert.equal(isWithinQuietHours(at(23, 30), { quietHoursEnabled: false, quietHoursStart: "23:00", quietHoursEnd: "08:00" }), false);
  assert.equal(isWithinQuietHours(at(23, 30), {}), false);
  assert.equal(isWithinQuietHours(at(23, 30), null), false);
});

test("bornes invalides : jamais bloqué (on n'aveugle pas l'utilisateur)", () => {
  assert.equal(isWithinQuietHours(at(23, 30), { quietHoursEnabled: true, quietHoursStart: "bad", quietHoursEnd: "08:00" }), false);
  assert.equal(isWithinQuietHours(at(23, 30), { quietHoursEnabled: true, quietHoursStart: "", quietHoursEnd: "" }), false);
});

test("plage simple (23:00 → 08:00 passe minuit) : bloqué la nuit, pas le jour", () => {
  const prefs = { quietHoursEnabled: true, quietHoursStart: "23:00", quietHoursEnd: "08:00" };
  assert.equal(isWithinQuietHours(at(23, 0), prefs), true);
  assert.equal(isWithinQuietHours(at(23, 30), prefs), true);
  assert.equal(isWithinQuietHours(at(3, 45), prefs), true);
  assert.equal(isWithinQuietHours(at(7, 59), prefs), true);
  assert.equal(isWithinQuietHours(at(8, 0), prefs), false);
  assert.equal(isWithinQuietHours(at(12, 0), prefs), false);
  assert.equal(isWithinQuietHours(at(22, 59), prefs), false);
});

test("plage en journée (13:30 → 15:00) : bloquée sur place seulement", () => {
  const prefs = { quietHoursEnabled: true, quietHoursStart: "13:30", quietHoursEnd: "15:00" };
  assert.equal(isWithinQuietHours(at(13, 29), prefs), false);
  assert.equal(isWithinQuietHours(at(13, 30), prefs), true);
  assert.equal(isWithinQuietHours(at(14, 59), prefs), true);
  assert.equal(isWithinQuietHours(at(15, 0), prefs), false);
  assert.equal(isWithinQuietHours(at(2, 0), prefs), false);
});

test("start === end : plage vide, jamais bloqué", () => {
  const prefs = { quietHoursEnabled: true, quietHoursStart: "01:00", quietHoursEnd: "01:00" };
  assert.equal(isWithinQuietHours(at(1, 0), prefs), false);
});

test("accepte un horodatage comme la date", () => {
  const prefs = { quietHoursEnabled: true, quietHoursStart: "23:00", quietHoursEnd: "08:00" };
  assert.equal(isWithinQuietHours(at(23, 5).getTime(), prefs), true);
  assert.equal(isWithinQuietHours(Number("pas un nombre"), prefs), false);
});

// ── Tests de la branche interface (popup) ──
test("normalise une heure saisie en HH:MM", () => {
  assert.equal(normalizeQuietTime("8:05", "23:00"), "08:05");
  assert.equal(normalizeQuietTime(" 23:00 ", "08:00"), "23:00");
  assert.equal(normalizeQuietTime("00:00", "08:00"), "00:00");
});

test("rejette les heures invalides et retombe sur la valeur par défaut", () => {
  assert.equal(normalizeQuietTime("", "23:00"), "23:00");
  assert.equal(normalizeQuietTime(undefined, "08:00"), "08:00");
  assert.equal(normalizeQuietTime("24:00", "23:00"), "23:00");
  assert.equal(normalizeQuietTime("12:60", "23:00"), "23:00");
  assert.equal(normalizeQuietTime("matin", "08:00"), "08:00");
});

test("défauts : 23:00 → 08:00", () => {
  assert.equal(DEFAULT_QUIET_START, "23:00");
  assert.equal(DEFAULT_QUIET_END, "08:00");
});

test("plage simple : silencieux entre début et fin le même jour", () => {
  const noon = new Date(2026, 8, 28, 12, 0).getTime();
  assert.equal(isQuietNow(noon, "10:00", "14:00"), true);
  assert.equal(isQuietNow(noon, "14:00", "15:00"), false);
});

test("plage passant minuit : silencieux le soir et tôt le matin", () => {
  const late = new Date(2026, 8, 28, 23, 30).getTime();
  const early = new Date(2026, 8, 28, 6, 0).getTime();
  const midday = new Date(2026, 8, 28, 12, 0).getTime();
  assert.equal(isQuietNow(late, "23:00", "08:00"), true);
  assert.equal(isQuietNow(early, "23:00", "08:00"), true);
  assert.equal(isQuietNow(midday, "23:00", "08:00"), false);
});

test("plage nulle (début = fin) : jamais silencieux", () => {
  const noon = new Date(2026, 8, 28, 12, 0).getTime();
  assert.equal(isQuietNow(noon, "12:00", "12:00"), false);
});

test("entrées sales : retombe sur les défauts sans lever d'erreur", () => {
  const midnight = new Date(2026, 8, 28, 0, 30).getTime();
  assert.equal(isQuietNow(midnight, "n'importe quoi", null), true);
});

test("silence temporaire : 1 h exacte, demain a 08 h locales meme avant 08 h", () => {
  for (const date of [new Date(2026, 2, 28, 22, 15), new Date(2026, 9, 24, 22, 15), new Date(2026, 11, 31, 3, 0)]) {
    assert.equal(notificationPauseUntil("hour", date.getTime()), date.getTime() + 3_600_000);
    const tomorrow = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 8);
    assert.equal(notificationPauseUntil("tomorrow", date.getTime()), tomorrow.getTime());
  }
  assert.throws(() => notificationPauseUntil("forever", at(12, 0).getTime()), RangeError);
  assert.throws(() => notificationPauseUntil("hour", NaN), RangeError);
});

test("silence temporaire : stockage invalide inactif, exception strictement booleenne", () => {
  for (const value of [undefined, null, [], "bad", {}, { until: "123" }, { until: Infinity }, { until: -1 }, { until: 1e17 }]) {
    assert.deepEqual(normalizeNotificationPause(value), { until: 0, exceptPinned: false });
  }
  assert.deepEqual(normalizeNotificationPause({ until: 123, exceptPinned: "true", extra: 1 }), { until: 123, exceptPinned: false });
});

test("silence temporaire : expiration sans ecriture ni minuterie, et favoris opt-in", () => {
  const now = at(12, 0).getTime();
  const pause = Object.freeze({ until: now + 3_600_000, exceptPinned: true });
  const input = { now, pause, preferences: {}, pinnedIds: ["fav"], streamerId: "other" };
  assert.equal(getNotificationSilence(input).blocked, true);
  assert.equal(getNotificationSilence({ ...input, streamerId: "fav" }).pinnedException, true);
  assert.equal(getNotificationSilence({ ...input, streamerId: "fav" }).blocked, false);
  assert.equal(getNotificationSilence({ ...input, streamerId: undefined }).blocked, true);
  assert.equal(getNotificationSilence({ ...input, pinnedIds: "other" }).blocked, true);
  assert.equal(getNotificationSilence({ ...input, pause: { ...pause, exceptPinned: false }, streamerId: "fav" }).blocked, true);
  assert.equal(getNotificationSilence({ ...input, now: pause.until - 1 }).blocked, true);
  assert.equal(getNotificationSilence({ ...input, now: pause.until }).blocked, false);
  assert.equal(getNotificationSilence({ ...input, now: pause.until + 1 }).until, 0);
});

test("les favoris ne contournent pas les heures calmes", () => {
  const now = at(23, 30).getTime();
  const silence = getNotificationSilence({
    now, pause: { until: now + 3_600_000, exceptPinned: true }, pinnedIds: ["fav"], streamerId: "fav",
    preferences: { quietHoursEnabled: true, quietHoursStart: "23:00", quietHoursEnd: "08:00" },
  });
  assert.equal(silence.pinnedException, true);
  assert.equal(silence.paused, false);
  assert.equal(silence.quiet, true);
  assert.equal(silence.blocked, true);
});
