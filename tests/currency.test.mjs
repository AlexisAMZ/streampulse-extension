import test from "node:test";
import assert from "node:assert/strict";
import {
  convertUp,
  formatLocalEquivalent,
  loadRates,
  rateFrom,
  resolveCurrency,
} from "../js/currency.js";

test("la langue donne la devise par défaut", () => {
  assert.equal(resolveCurrency("fr", []), "EUR");
  assert.equal(resolveCurrency("en", []), "USD");
  assert.equal(resolveCurrency("pt-BR", []), "BRL");
  assert.equal(resolveCurrency("ja", []), "JPY");
  assert.equal(resolveCurrency("tr", []), "TRY");
});

test("la région du navigateur affine seulement si la langue correspond", () => {
  assert.equal(resolveCurrency("en", ["en-GB"]), "GBP");
  assert.equal(resolveCurrency("fr", ["fr-CH", "en-US"]), "CHF");
  assert.equal(resolveCurrency("ja", ["en-US"]), "JPY");
  assert.equal(resolveCurrency("ar", ["ar-AE"]), "AED");
  assert.equal(resolveCurrency("ar", ["ar"]), "EUR");
});

test("l'arrondi va toujours vers le haut", () => {
  assert.equal(convertUp(2.99, 1.16, "USD"), 3.47);
  assert.equal(convertUp(2.99, 1.1601, "USD"), 3.47);
  assert.equal(convertUp(19, 160.2, "JPY"), 3044);
  assert.equal(convertUp(2.99, 1.0, "USD"), 2.99);
});

test("jamais moins cher que l'euro, même pour une devise forte", () => {
  assert.ok(convertUp(2.99, 0.86, "GBP") >= 2.99 * 0.86);
  assert.ok(convertUp(19, 0.93, "CHF") >= 19 * 0.93);
});

test("pas d'équivalent pour l'euro ni sans taux", () => {
  assert.equal(formatLocalEquivalent(19, { currency: "EUR", rate: 1, locale: "fr" }), null);
  assert.equal(formatLocalEquivalent(19, { currency: "USD", rate: null, locale: "en" }), null);
  assert.match(formatLocalEquivalent(19, { currency: "USD", rate: 1.16, locale: "en" }), /^≈ \$22\.04$/);
});

test("rateFrom rejette les taux invalides", () => {
  assert.equal(rateFrom({ rates: { USD: 1.1 } }, "USD"), 1.1);
  assert.equal(rateFrom({ rates: { USD: 0 } }, "USD"), null);
  assert.equal(rateFrom(null, "USD"), null);
});

test("loadRates : cache frais, panne réseau, cache trop vieux", async () => {
  const day = 24 * 60 * 60 * 1000;
  const fresh = { savedAt: 1000, payload: { rates: { USD: 1.1 } } };
  const noFetch = () => assert.fail("pas de réseau");
  assert.deepEqual(await loadRates({ read: async () => fresh, write: async () => {}, fetcher: noFetch, now: 1000 + day - 1 }), fresh.payload);
  const down = async () => { throw new Error("hors ligne"); };
  assert.deepEqual(await loadRates({ read: async () => fresh, write: async () => {}, fetcher: down, now: 1000 + 3 * day }), fresh.payload);
  assert.equal(await loadRates({ read: async () => fresh, write: async () => {}, fetcher: down, now: 1000 + 8 * day }), null);
  let saved;
  const ok = async () => ({ ok: true, json: async () => ({ result: "success", rates: { USD: 1.2 } }) });
  const got = await loadRates({ read: async () => null, write: async (v) => { saved = v; }, fetcher: ok, now: 5 });
  assert.deepEqual(got, { rates: { USD: 1.2 } });
  assert.equal(saved.savedAt, 5);
});
