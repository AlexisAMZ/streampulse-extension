import test from "node:test";
import assert from "node:assert/strict";
import { buildRecap, formatHours } from "../js/recap-data.js";

/** Fabrique un jeu de donnees au format `betaWatchTimeData`. */
function store(month, entries) {
  const data = {};
  data[month] = {};
  for (const [key, seconds] of Object.entries(entries)) {
    const [platform, channel] = key.split(":");
    data[month][key] = { watchSeconds: seconds, platform, channel, avatarUrl: "" };
  }
  return data;
}

test("ne garde que les participants ZEvent", () => {
  const data = store("2026-09", {
    "twitch:zerator": 7200,
    "twitch:squeezie": 99999, // pas participant
    "twitch:ponce": 3600,
  });
  const recap = buildRecap(data, "2026-09");
  assert.deepEqual(recap.top.map((e) => e.channel), ["zerator", "ponce"]);
  assert.equal(recap.streamerCount, 2);
  assert.equal(recap.totalSeconds, 10800);
});

test("exclut Kick, la liste ZEvent etant faite de logins Twitch", () => {
  const data = store("2026-09", { "kick:zerator": 3600, "twitch:zerator": 1800 });
  const recap = buildRecap(data, "2026-09");
  assert.equal(recap.top.length, 1);
  assert.equal(recap.top[0].platform, "twitch");
  assert.equal(recap.totalSeconds, 1800);
});

test("trie par duree decroissante et plafonne le top", () => {
  const data = store("2026-09", {
    "twitch:ponce": 1000, "twitch:zerator": 5000, "twitch:mistermv": 3000,
    "twitch:domingo": 4000, "twitch:etoiles": 2000, "twitch:mynthos": 900,
    "twitch:ultia": 800, "twitch:kenbogard": 700, "twitch:antoinedaniel": 600,
  });
  const recap = buildRecap(data, "2026-09", { limit: 8 });
  assert.equal(recap.top.length, 8);
  assert.deepEqual(recap.top.slice(0, 3).map((e) => e.channel), ["zerator", "domingo", "mistermv"]);
  assert.equal(recap.streamerCount, 9, "le compte porte sur tous les participants, pas sur le top");
  assert.equal(recap.totalSeconds, 18000, "le total aussi");
});

test("normalise la casse des logins", () => {
  const data = store("2026-09", { "twitch:ZeratoR": 3600 });
  const recap = buildRecap(data, "2026-09");
  assert.equal(recap.top.length, 1);
  assert.equal(recap.top[0].channel, "ZeratoR", "l'affichage garde la casse d'origine");
});

test("mois absent ou vide renvoie un recap vide, jamais une erreur", () => {
  for (const data of [{}, store("2026-08", { "twitch:zerator": 3600 }), null, undefined]) {
    const recap = buildRecap(data, "2026-09");
    assert.equal(recap.totalSeconds, 0);
    assert.equal(recap.streamerCount, 0);
    assert.deepEqual(recap.top, []);
    assert.equal(recap.isEmpty, true);
  }
});

test("ignore les entrees corrompues sans planter", () => {
  const data = { "2026-09": {
    "twitch:zerator": { watchSeconds: 3600, platform: "twitch", channel: "zerator" },
    "twitch:ponce": { watchSeconds: "beaucoup", platform: "twitch", channel: "ponce" },
    "casse": { watchSeconds: 100 },
    "twitch:mistermv": null,
  } };
  const recap = buildRecap(data, "2026-09");
  assert.equal(recap.top.length, 1);
  assert.equal(recap.totalSeconds, 3600);
});

test("part de chaque streamer dans le total", () => {
  const data = store("2026-09", { "twitch:zerator": 7200, "twitch:ponce": 2400 });
  const recap = buildRecap(data, "2026-09");
  assert.equal(recap.top[0].share, 0.75);
  assert.equal(recap.top[1].share, 0.25);
});

test("formatHours arrondit lisiblement", () => {
  assert.equal(formatHours(0), "0 min");
  assert.equal(formatHours(90), "2 min", "arrondi a la minute la plus proche");
  assert.equal(formatHours(3600), "1 h");
  assert.equal(formatHours(5400), "1 h 30");
  assert.equal(formatHours(45296), "12 h 35");
  assert.equal(formatHours(3599), "1 h", "59,98 min ne doit pas s'afficher \"60 min\"");
  assert.equal(formatHours(7199), "2 h");
});
