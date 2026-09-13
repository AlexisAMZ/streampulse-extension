import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dayKey,
  listPeriods,
  collectEntries,
  buildRecap,
  formatDuration,
} from "../js/recap-data.js";

const NOW = new Date(2026, 8, 13, 20, 0, 0); // 13 septembre 2026, heure locale

const entry = (platform, channel, watchSeconds, avatarUrl = "") => ({
  platform,
  channel,
  watchSeconds,
  avatarUrl,
});

const monthly = {
  "2026-07": { "twitch:a": entry("twitch", "a", 3600) },
  "2026-09": {
    "twitch:a": entry("twitch", "a", 7200, "https://img/a.png"),
    "kick:b": entry("kick", "b", 1800),
  },
};

const daily = {
  "2026-09-13": { "twitch:a": entry("twitch", "a", 600) },
  "2026-09-10": {
    "twitch:a": entry("twitch", "a", 1200, "https://img/a.png"),
    "kick:b": entry("kick", "b", 300),
  },
  "2026-09-06": { "kick:b": entry("kick", "b", 900) }, // hors des 7 jours (7 au 13)
  "2026-08-10": { "twitch:c": entry("twitch", "c", 5000) }, // hors des 30 jours (15 aout au 13)
};

test("dayKey formate la date locale en AAAA-MM-JJ", () => {
  assert.equal(dayKey(new Date(2026, 0, 5)), "2026-01-05");
});

test("listPeriods propose 7 et 30 jours puis les mois, du plus recent au plus ancien", () => {
  const periods = listPeriods(monthly, daily, NOW);
  assert.deepEqual(
    periods.map((p) => p.id),
    ["7d", "30d", "month:2026-09", "month:2026-07"]
  );
  assert.equal(periods[0].days, 7);
  assert.equal(periods[2].month, "2026-09");
});

test("listPeriods reste utilisable sans aucune donnee", () => {
  assert.deepEqual(listPeriods(null, undefined, NOW).map((p) => p.id), ["7d", "30d"]);
});

test("collectEntries additionne les jours d'une periode glissante", () => {
  const entries = collectEntries(monthly, daily, "7d", NOW);
  const byKey = Object.fromEntries(entries.map((e) => [`${e.platform}:${e.channel}`, e]));
  assert.equal(byKey["twitch:a"].watchSeconds, 1800);
  assert.equal(byKey["twitch:a"].avatarUrl, "https://img/a.png");
  assert.equal(byKey["kick:b"].watchSeconds, 300);
  assert.equal(entries.length, 2);
});

test("collectEntries sur 30 jours inclut le debut de mois mais pas aout", () => {
  const entries = collectEntries(monthly, daily, "30d", NOW);
  const total = entries.reduce((s, e) => s + e.watchSeconds, 0);
  assert.equal(total, 600 + 1200 + 300 + 900);
});

test("collectEntries sur un mois lit le stockage mensuel", () => {
  const entries = collectEntries(monthly, daily, "month:2026-09", NOW);
  assert.equal(entries.reduce((s, e) => s + e.watchSeconds, 0), 9000);
});

test("collectEntries ignore les entrees corrompues", () => {
  const dirty = {
    "2026-09-13": {
      x: { platform: "twitch", channel: "", watchSeconds: 10 },
      y: { platform: "twitch", channel: "ok", watchSeconds: "nope" },
      z: null,
      w: entry("twitch", "neg", -5),
      v: entry("twitch", "good", 42),
    },
  };
  const entries = collectEntries({}, dirty, "7d", NOW);
  assert.deepEqual(entries.map((e) => e.channel), ["good"]);
});

test("collectEntries renvoie une liste vide pour une periode inconnue", () => {
  assert.deepEqual(collectEntries(monthly, daily, "bogus", NOW), []);
});

test("buildRecap classe, calcule les parts et la repartition par plateforme", () => {
  const recap = buildRecap(
    [entry("kick", "b", 1000), entry("twitch", "a", 3000), entry("twitch", "c", 0.5)],
    { limit: 2 }
  );
  assert.equal(recap.totalSeconds, 4000.5);
  assert.equal(recap.streamerCount, 3);
  assert.deepEqual(recap.top.map((e) => e.channel), ["a", "b"]);
  assert.equal(recap.top[0].share, 3000 / 4000.5);
  assert.equal(recap.platforms.twitch, 3000.5);
  assert.equal(recap.platforms.kick, 1000);
  assert.equal(recap.isEmpty, false);
});

test("buildRecap signale un recap vide", () => {
  const recap = buildRecap([]);
  assert.equal(recap.isEmpty, true);
  assert.equal(recap.totalSeconds, 0);
  assert.deepEqual(recap.top, []);
});

test("formatDuration arrondit proprement", () => {
  assert.equal(formatDuration(0), "0 min");
  assert.equal(formatDuration(45 * 60), "45 min");
  assert.equal(formatDuration(3600), "1 h");
  assert.equal(formatDuration(3599), "1 h");
  assert.equal(formatDuration(12 * 3600 + 35 * 60), "12 h 35");
});
