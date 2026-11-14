import test from "node:test";
import assert from "node:assert/strict";
import { GTA6_EVENT_END, GTA6_LAUNCH, launchState } from "../js/gta6-launch.js";

const at = (...parts) => new Date(...parts);

test("la sortie est à minuit le 19 novembre 2026, heure locale du navigateur", () => {
  assert.equal(GTA6_LAUNCH.getFullYear(), 2026);
  assert.equal(GTA6_LAUNCH.getMonth(), 10);
  assert.equal(GTA6_LAUNCH.getDate(), 19);
  assert.equal(GTA6_LAUNCH.getHours(), 0);
  assert.equal(GTA6_LAUNCH.getMinutes(), 0);
});

test("avant la sortie : jours, heures, minutes et secondes restantes", () => {
  const state = launchState(at(2026, 10, 14, 21, 47, 13));
  assert.deepEqual(state, { phase: "soon", days: 4, hours: 2, minutes: 12, seconds: 47 });
});

test("une seconde avant minuit : encore en attente", () => {
  assert.deepEqual(launchState(at(2026, 10, 18, 23, 59, 59)), { phase: "soon", days: 0, hours: 0, minutes: 0, seconds: 1 });
});

test("pile à minuit et pendant l'événement : disponible", () => {
  assert.deepEqual(launchState(GTA6_LAUNCH), { phase: "out" });
  assert.deepEqual(launchState(at(2026, 10, 30, 23, 59, 59)), { phase: "out" });
});

test("après la fin de l'événement : plus de panneau", () => {
  assert.deepEqual(launchState(GTA6_EVENT_END), { phase: "over" });
  assert.deepEqual(launchState(at(2027, 0, 5)), { phase: "over" });
});

test("une date invalide ne casse rien", () => {
  assert.deepEqual(launchState(new Date(Number.NaN)), { phase: "over" });
});
