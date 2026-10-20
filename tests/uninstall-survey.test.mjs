import test from "node:test";
import assert from "node:assert/strict";
import { installAgeDays, uninstallSurveyUrl } from "../js/sw/uninstall-survey.js";

const NOW = Date.UTC(2026, 9, 20, 12);
const DAY = 24 * 60 * 60 * 1000;

test("ancienneté en jours entiers", () => {
  assert.equal(installAgeDays(NOW - 5 * DAY - 1000, NOW), 5);
  assert.equal(installAgeDays(NOW - 60 * 1000, NOW), 0);
});

test("date absente ou incohérente : pas d'ancienneté", () => {
  for (const bad of [undefined, null, "x", 0, -5, NaN, NOW + DAY]) assert.equal(installAgeDays(bad, NOW), null);
});

test("l'URL du sondage porte version, langue et ancienneté seulement", () => {
  const url = new URL(uninstallSurveyUrl("26.10.20", "pt-BR", NOW - 3 * DAY, NOW));
  assert.equal(url.origin + url.pathname, "https://streampulse.tech/bye");
  assert.deepEqual([...url.searchParams.keys()].sort(), ["d", "lang", "v"]);
  assert.equal(url.searchParams.get("lang"), "pt");
  assert.equal(url.searchParams.get("d"), "3");
});

test("sans date d'installation, pas de paramètre d", () => {
  const url = new URL(uninstallSurveyUrl("26.10.20", undefined, undefined, NOW));
  assert.equal(url.searchParams.get("lang"), "en");
  assert.equal(url.searchParams.has("d"), false);
});
