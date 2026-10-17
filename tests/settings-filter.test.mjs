import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PLATFORM_BY_CONTROL, PLATFORM_FILTERS, matchesFilter, normalizeText, platformsOfIds } from "../js/settings-filter.js";

test("un réglage sans plateforme s'affiche pour tous les filtres", () => {
  for (const platform of PLATFORM_FILTERS) assert.equal(matchesFilter({ platforms: null, text: "heures calmes" }, { platform }), true);
});

test("un réglage Twitch seul disparaît sous Kick et YouTube, reste sous Toutes et Twitch", () => {
  const row = { platforms: ["twitch"], text: "drops" };
  assert.deepEqual(PLATFORM_FILTERS.filter((platform) => matchesFilter(row, { platform })), ["all", "twitch"]);
});

test("un réglage Twitch et Kick apparaît sous les deux", () => {
  const row = { platforms: ["twitch", "kick"], text: "bouton d'avance rapide" };
  assert.deepEqual(PLATFORM_FILTERS.filter((platform) => matchesFilter(row, { platform })), ["all", "twitch", "kick"]);
});

test("la recherche ignore accents et casse, et exige tous les mots", () => {
  const row = { platforms: null, text: normalizeText("Alertes changement de catégorie") };
  assert.equal(matchesFilter(row, { query: "CATEGORIE alertes" }), true);
  assert.equal(matchesFilter(row, { query: "catégorie raid" }), false);
  assert.equal(matchesFilter(row, { query: "   " }), true);
});

test("platformsOfIds réunit les plateformes des contrôles connus, null sinon", () => {
  assert.deepEqual(platformsOfIds(["pref-auto-claim-drops"]), ["twitch"]);
  assert.deepEqual(platformsOfIds(["x", "pref-fast-forward"]), ["twitch", "kick"]);
  assert.equal(platformsOfIds(["pref-quiet-hours", "inconnu"]), null);
});

test("chaque contrôle étiqueté existe dans la popup et n'a que des plateformes valides", async () => {
  const html = await readFile(new URL("../html/popup.html", import.meta.url), "utf8");
  for (const [id, platforms] of Object.entries(PLATFORM_BY_CONTROL)) {
    assert.ok(html.includes(`id="${id}"`), `${id} absent de popup.html`);
    assert.ok(platforms.length > 0 && platforms.every((p) => ["twitch", "kick", "youtube"].includes(p)), id);
  }
});
