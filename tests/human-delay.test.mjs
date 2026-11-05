import test from "node:test";
import assert from "node:assert/strict";
import "../js/inject/human-delay.js";

const { between, DELAYS } = globalThis.StreamPulseHumanDelay;

test("between reste dans la fourchette, bornes comprises", () => {
  assert.equal(between(2000, 6000, () => 0), 2000);
  assert.equal(between(2000, 6000, () => 0.5), 4000);
  assert.equal(between(2000, 6000, () => 0.999999), 5999);
});

test("between accepte des bornes inversées et des valeurs absurdes", () => {
  assert.equal(between(6000, 2000, () => 0), 2000);
  assert.equal(between(-5, 10, () => 0), 0);
  assert.equal(between(Number.NaN, 1000, () => 0.5), 500);
});

test("between tire une valeur différente d'un appel à l'autre avec le hasard réel", () => {
  const seen = new Set(Array.from({ length: 40 }, () => between(1000, 20000)));
  assert.ok(seen.size > 10);
});

test("les fourchettes ne dépassent pas la veille d'un service worker MV3", () => {
  for (const [name, range] of Object.entries(DELAYS)) {
    assert.ok(range.min >= 0 && range.min < range.max, name);
    assert.ok(range.max <= 25_000, `${name} doit rester sous 25 s`);
  }
});
