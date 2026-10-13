import { test } from "node:test";
import assert from "node:assert/strict";
import { PLUS_VALUE_KEY, plusValueAdd, plusValueFrom } from "../js/plus-value.js";

const NOW = 1_760_000_000_000;

test("plusValueFrom : clé et forme par défaut", () => {
  assert.deepEqual(plusValueFrom({}), { badges: 0, drops: 0, since: 0 });
  assert.deepEqual(plusValueFrom({ [PLUS_VALUE_KEY]: { badges: 3, drops: "41", since: NOW } }), { badges: 3, drops: 41, since: NOW });
  // Une forme inattendue ne compte rien, mais ne lève jamais.
  assert.deepEqual(plusValueFrom({ [PLUS_VALUE_KEY]: "x" }), { badges: 0, drops: 0, since: 0 });
  assert.deepEqual(plusValueFrom({ [PLUS_VALUE_KEY]: { badges: -5, drops: 2.9 } }), { badges: 0, drops: 2, since: 0 });
});

test("plusValueAdd : additionne et date la première écriture", () => {
  const first = plusValueAdd(null, { badges: 2, drops: 1 }, NOW);
  assert.deepEqual(first, { badges: 2, drops: 1, since: NOW });
  // since reste celle du début, même si now avance.
  const next = plusValueAdd(first, { drops: 3 }, NOW + 5000);
  assert.deepEqual(next, { badges: 2, drops: 4, since: NOW });
  // Gains négatifs ou non numériques : ignorés, jamais de compteur qui décroit.
  assert.deepEqual(plusValueAdd(next, { badges: -10, drops: "x" }), { badges: 2, drops: 4, since: NOW });
});
