import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RECAP_PLATFORMS, RECAP_PLATFORMS, filterByPlatforms, normalizeRecapPlatforms } from "../js/recap-platforms.js";
import { buildRecap, buildTimeline, collectEntries } from "../js/recap-data.js";
import { sanitizePreferences } from "../js/preferences-data.js";

const NOW = new Date(2026, 9, 20, 12);
const DAY = "2026-10-20";
const daily = {
  [DAY]: {
    "twitch:gotaga": { platform: "twitch", channel: "gotaga", watchSeconds: 3600 },
    "kick:amine": { platform: "kick", channel: "amine", watchSeconds: 1800 },
    "youtube:mrbeast": { platform: "youtube", channel: "mrbeast", watchSeconds: 7200 },
  },
};

test("par défaut le récap compte Twitch, Kick et CHZZK, pas YouTube", () => {
  assert.deepEqual(DEFAULT_RECAP_PLATFORMS, ["twitch", "kick", "chzzk"]);
  assert.deepEqual(normalizeRecapPlatforms(undefined), DEFAULT_RECAP_PLATFORMS);
  assert.deepEqual(normalizeRecapPlatforms("youtube"), DEFAULT_RECAP_PLATFORMS);
});

test("la liste est nettoyée : plateformes connues, sans doublon, ordre canonique", () => {
  assert.deepEqual(normalizeRecapPlatforms(["youtube", "twitch", "twitch", "nimo"]), ["twitch", "youtube"]);
  assert.deepEqual(normalizeRecapPlatforms([]), []);
  assert.deepEqual(normalizeRecapPlatforms(RECAP_PLATFORMS), RECAP_PLATFORMS);
});

test("filterByPlatforms garde les plateformes choisies, tout passe sans choix", () => {
  const entries = Object.values(daily[DAY]);
  assert.deepEqual(filterByPlatforms(entries, ["kick"]).map((e) => e.channel), ["amine"]);
  assert.equal(filterByPlatforms(entries, []).length, 0);
  assert.equal(filterByPlatforms(entries, undefined).length, 3);
});

test("le récap exclut YouTube avec le choix par défaut, l'inclut si on le coche", () => {
  const without = buildRecap(collectEntries({}, daily, "7d", NOW, DEFAULT_RECAP_PLATFORMS));
  assert.equal(without.totalSeconds, 5400);
  assert.equal(without.platforms.youtube, undefined);
  const withYoutube = buildRecap(collectEntries({}, daily, "7d", NOW, ["twitch", "kick", "youtube"]));
  assert.equal(withYoutube.totalSeconds, 12600);
  assert.equal(withYoutube.top[0].channel, "mrbeast");
});

test("la courbe du récap suit le même choix de plateformes", () => {
  const today = (platforms) => buildTimeline({}, daily, "7d", NOW, platforms).find((point) => point.key === DAY).seconds;
  assert.equal(today(DEFAULT_RECAP_PLATFORMS), 5400);
  assert.equal(today(["youtube"]), 7200);
  assert.equal(today(undefined), 12600);
});

test("les préférences gardent le choix et retombent sur le défaut si la valeur est invalide", () => {
  assert.deepEqual(sanitizePreferences({ recapPlatforms: ["youtube"] }).recapPlatforms, ["youtube"]);
  assert.deepEqual(sanitizePreferences({}).recapPlatforms, DEFAULT_RECAP_PLATFORMS);
  assert.deepEqual(sanitizePreferences({ recapPlatforms: "tout" }).recapPlatforms, DEFAULT_RECAP_PLATFORMS);
});
