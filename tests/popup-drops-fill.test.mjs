import test from "node:test";
import assert from "node:assert/strict";

const { fillTransform } = await import("../js/popup-drops.js");

test("la jauge des Drops se remplit par scaleX, bornée entre 0 et 1", () => {
  assert.equal(fillTransform(0), "scaleX(0)");
  assert.equal(fillTransform(42), "scaleX(0.42)");
  assert.equal(fillTransform(100), "scaleX(1)");
  assert.equal(fillTransform(140), "scaleX(1)");
  assert.equal(fillTransform(-5), "scaleX(0)");
});

test("valeur illisible : jauge vide", () => {
  assert.equal(fillTransform(Number.NaN), "scaleX(0)");
  assert.equal(fillTransform(undefined), "scaleX(0)");
  assert.equal(fillTransform("abc"), "scaleX(0)");
});
