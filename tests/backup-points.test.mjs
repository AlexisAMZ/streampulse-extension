import test from "node:test";
import assert from "node:assert/strict";
import { BACKUP_KEYS, buildBackup, mergeBackup, parseBackup } from "../js/backup.js";
import { POINTS_CHANNELS_KEY, POINTS_DAILY_KEY, POINTS_JOURNAL_KEY } from "../js/points-data.js";

const daily = { "2026-09-26": { 123: { WATCH: { count: 2, points: 24, base: 20 } } } };
const journal = [{ key: "123|1|WATCH|12", at: 1, channelId: "123", reason: "WATCH", rawReason: "WATCH", points: 12, base: 10, factor: 0.2 }];
const channels = { 123: { login: "novastream", displayName: "Novastream", balance: 900, lastGainAt: 1 } };

test("les trois clés de points font partie de la sauvegarde", () => {
  assert.ok(BACKUP_KEYS.includes(POINTS_DAILY_KEY));
  assert.ok(BACKUP_KEYS.includes(POINTS_JOURNAL_KEY));
  assert.ok(BACKUP_KEYS.includes(POINTS_CHANNELS_KEY));
  const file = buildBackup({ [POINTS_DAILY_KEY]: daily, [POINTS_JOURNAL_KEY]: journal, [POINTS_CHANNELS_KEY]: channels }, { version: "26.9.27" });
  const parsed = parseBackup(file);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.data[POINTS_DAILY_KEY], daily);
  assert.deepEqual(parsed.data[POINTS_JOURNAL_KEY], journal);
  assert.deepEqual(parsed.data[POINTS_CHANNELS_KEY], channels);
});

test("la restauration écarte les entrées de points mal formées", () => {
  const parsed = parseBackup({
    [POINTS_DAILY_KEY]: { "pas-un-jour": {}, "2026-09-26": { abc: { WATCH: { count: 1, points: 1, base: 1 } }, 123: { WATCH: { count: "x" } } } },
    [POINTS_JOURNAL_KEY]: [...journal, { key: 5 }, null],
    [POINTS_CHANNELS_KEY]: { 123: channels[123], abc: {} },
  });
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.data[POINTS_DAILY_KEY], { "2026-09-26": {} });
  assert.deepEqual(parsed.data[POINTS_JOURNAL_KEY], journal);
  assert.deepEqual(Object.keys(parsed.data[POINTS_CHANNELS_KEY]), ["123"]);
});

test("la fusion garde le plus grand compte par jour, l'union du journal et la fiche locale", () => {
  const current = {
    [POINTS_DAILY_KEY]: { "2026-09-26": { 123: { WATCH: { count: 3, points: 36, base: 30 } } } },
    [POINTS_JOURNAL_KEY]: [{ ...journal[0], key: "123|2|WATCH|12", at: 2 }],
    [POINTS_CHANNELS_KEY]: { 123: { login: "novastream", balance: 1200 } },
  };
  const merged = mergeBackup(current, { [POINTS_DAILY_KEY]: daily, [POINTS_JOURNAL_KEY]: journal, [POINTS_CHANNELS_KEY]: channels }).data;
  assert.deepEqual(merged[POINTS_DAILY_KEY]["2026-09-26"][123].WATCH, { count: 3, points: 36, base: 30 });
  assert.deepEqual(merged[POINTS_JOURNAL_KEY].map((entry) => entry.at), [2, 1]);
  assert.equal(merged[POINTS_CHANNELS_KEY][123].balance, 1200);
  assert.equal(merged[POINTS_CHANNELS_KEY][123].displayName, "Novastream");
});
