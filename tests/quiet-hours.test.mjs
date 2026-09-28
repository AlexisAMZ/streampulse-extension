import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_QUIET_END,
  DEFAULT_QUIET_START,
  isQuietNow,
  normalizeQuietTime,
} from "../js/quiet-hours.js";

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
