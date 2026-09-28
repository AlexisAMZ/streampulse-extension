import { test } from "node:test";
import assert from "node:assert/strict";
import { isWithinQuietHours, parseHhMm } from "../js/quiet-hours.js";

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
