import { test } from "node:test";
import assert from "node:assert/strict";
import { isWithinQuietHours, parseHhMm } from "../js/quiet-hours.js";
import { DEFAULT_QUIET_END, DEFAULT_QUIET_START, isQuietNow, normalizeQuietTime } from "../js/quiet-hours.js";

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
