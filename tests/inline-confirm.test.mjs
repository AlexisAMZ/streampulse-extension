import test from "node:test";
import assert from "node:assert/strict";
import { ARM_MS, nextConfirmState } from "../js/inline-confirm.js";

/** Le modèle de confirmation destructive unique : inline en 2 clics, jamais confirm(). */
test("premier clic : armement sans confirmation", () => {
  const next = nextConfirmState({ armed: false, armedAt: 0 }, 1000);
  assert.equal(next.action, "arm");
  assert.equal(next.armed, true);
  assert.equal(next.armedAt, 1000);
});

test("deuxième clic dans la fenêtre : confirmation", () => {
  const armed = { armed: true, armedAt: 1000 };
  const next = nextConfirmState(armed, 1000 + ARM_MS - 1);
  assert.equal(next.action, "confirm");
  assert.equal(next.armed, false);
});

test("clic après expiration : réarmement, pas de confirmation", () => {
  const armed = { armed: true, armedAt: 1000 };
  const next = nextConfirmState(armed, 1000 + ARM_MS + 1);
  assert.equal(next.action, "rearm");
  assert.equal(next.armed, true);
  assert.equal(next.armedAt, 1000 + ARM_MS + 1);
});

test("clic exactement à la fin de la fenêtre : encore armé, on confirme", () => {
  const armed = { armed: true, armedAt: 1000 };
  const next = nextConfirmState(armed, 1000 + ARM_MS);
  assert.equal(next.action, "confirm");
});

test("état absent ou nul : équivalent à désarmé", () => {
  assert.equal(nextConfirmState(undefined, 5).action, "arm");
  assert.equal(nextConfirmState(null, 5).action, "arm");
  assert.equal(nextConfirmState({ armed: false, armedAt: 99 }, 5).action, "arm");
});

test("durée d'armement par défaut raisonnable (2 à 10 s)", () => {
  assert.ok(ARM_MS >= 2000 && ARM_MS <= 10000, `ARM_MS = ${ARM_MS}`);
});
