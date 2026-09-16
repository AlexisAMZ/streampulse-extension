import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BACKUP_FORMAT,
  BACKUP_KEYS,
  buildBackup,
  mergeBackup,
  parseBackup,
  backupFileName,
} from "../js/backup.js";

const NOW = new Date("2026-09-13T20:15:00Z");

const storage = {
  betaGeneralStreamers: [
    { id: "twitch:gotaga", platform: "twitch", handle: "gotaga" },
    { id: "kick:amine", platform: "kick", handle: "amine" },
  ],
  betaGeneralPreferences: { language: "fr", communityBadge: true },
  betaGeneralStats: { channelPointsClaimed: 4200, dropsClaimed: 3 },
  betaWatchTimeData: {
    "2026-08": { "twitch:gotaga": { platform: "twitch", channel: "gotaga", watchSeconds: 3600, avatarUrl: "" } },
    "2026-09": { "kick:amine": { platform: "kick", channel: "amine", watchSeconds: 1800, avatarUrl: "" } },
  },
  streamPulseWatchTimeDaily: {
    "2026-09-12": { "kick:amine": { platform: "kick", channel: "amine", watchSeconds: 1800, avatarUrl: "" } },
  },
  userProfile: { handle: "alexisamz", displayName: "AlexisAMZ", avatarUrl: "" },
  betaPinnedIds: ["twitch:gotaga", "kick:amine"],
  betaChannelGroups: { amis: ["twitch:gotaga"] },
  streamPulseHistory: { "2026-09-12": [{ channel: "gotaga", minutes: 42 }] },
  streamPulseSmartAlerts: [{ handle: "gotaga", game: "Just Chatting" }],
  streamPulseCosmetics: { badgeFx: "glow", nameFx: "" },
  streamPulseAccent: "violet",
  streamPulsePredictionRule: { percent: 10, maxPoints: 5000 },
  // Lie a cette installation : jamais dans une sauvegarde.
  streamPulsePlus: { status: "active", licenseKey: "SP-XXXX", plan: "lifetime" },
  streamPulseDeviceId: "device-123",
  // Caches et secrets : jamais dans une sauvegarde.
  betaGeneralStatuses: { "twitch:gotaga": { isLive: true } },
  "streampulse:kickToken": "secret",
  "streampulse:remoteConfig": { data: { clientId: "x" } },
};

test("buildBackup ne garde que les donnees de l'utilisateur, avec des metadonnees", () => {
  const backup = buildBackup(storage, { version: "26.9.13", now: NOW });
  assert.equal(backup.app, "StreamPulse");
  assert.equal(backup.format, BACKUP_FORMAT);
  assert.equal(backup.version, "26.9.13");
  assert.equal(backup.exportedAt, "2026-09-13T20:15:00.000Z");
  assert.deepEqual(Object.keys(backup.data).sort(), [...BACKUP_KEYS].sort());
  assert.equal("betaGeneralStatuses" in backup.data, false);
  assert.equal("streampulse:kickToken" in backup.data, false);
  assert.equal("streamPulsePlus" in backup.data, false);
  assert.equal("streamPulseDeviceId" in backup.data, false);
});

test("les favoris epingles sont sauvegardes, relus et fusionnes sans doublon", () => {
  const backup = buildBackup(storage, { version: "26.9.19", now: NOW });
  assert.deepEqual(backup.data.betaPinnedIds, ["twitch:gotaga", "kick:amine"]);

  const parsed = parseBackup(backup);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.data.betaPinnedIds, ["twitch:gotaga", "kick:amine"]);
  assert.deepEqual(parsed.data.betaChannelGroups, { amis: ["twitch:gotaga"] });

  const merged = mergeBackup({ betaPinnedIds: ["twitch:squeezie", "kick:amine"] }, parsed.data);
  assert.deepEqual(merged.data.betaPinnedIds, ["twitch:squeezie", "kick:amine", "twitch:gotaga"]);
});

test("un favori epingle invalide fait refuser la sauvegarde plutot que de la salir", () => {
  const result = parseBackup({ betaPinnedIds: "twitch:gotaga" });
  assert.equal(result.ok, false);
  assert.equal(result.error, "invalid-betaPinnedIds");
});

test("buildBackup omet les cles absentes du stockage", () => {
  const backup = buildBackup({ betaGeneralStreamers: [] }, { version: "1", now: NOW });
  assert.deepEqual(Object.keys(backup.data), ["betaGeneralStreamers"]);
});

test("parseBackup relit une sauvegarde produite par buildBackup", () => {
  const backup = JSON.parse(JSON.stringify(buildBackup(storage, { version: "26.9.13", now: NOW })));
  const result = parseBackup(backup);
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.betaGeneralStreamers, storage.betaGeneralStreamers);
  assert.deepEqual(result.summary, {
    streamers: 2,
    months: 2,
    days: 1,
    exportedAt: "2026-09-13T20:15:00.000Z",
    version: "26.9.13",
  });
});

test("parseBackup accepte l'ancien format a plat et ignore les cles inconnues", () => {
  const legacy = {
    betaGeneralStreamers: storage.betaGeneralStreamers,
    betaWatchTimeData: storage.betaWatchTimeData,
    betaGeneralStatuses: storage.betaGeneralStatuses,
    "streampulse:thumbCache": {},
  };
  const result = parseBackup(legacy);
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.data).sort(), ["betaGeneralStreamers", "betaWatchTimeData"]);
  assert.equal(result.summary.exportedAt, null);
});

test("parseBackup refuse ce qui n'est pas une sauvegarde", () => {
  assert.deepEqual(parseBackup(null), { ok: false, error: "not-object" });
  assert.deepEqual(parseBackup([1, 2]), { ok: false, error: "not-object" });
  assert.deepEqual(parseBackup({ foo: 1 }), { ok: false, error: "empty" });
  assert.deepEqual(parseBackup({ app: "Autre", format: 1, data: {} }), { ok: false, error: "wrong-app" });
  assert.deepEqual(parseBackup({ app: "StreamPulse", format: 99, data: {} }), { ok: false, error: "unsupported-format" });
});

test("parseBackup refuse un type invalide sur une cle connue", () => {
  const bad = { app: "StreamPulse", format: BACKUP_FORMAT, data: { betaGeneralStreamers: "pas une liste" } };
  assert.deepEqual(parseBackup(bad), { ok: false, error: "invalid-betaGeneralStreamers" });
  const badPrefs = { app: "StreamPulse", format: BACKUP_FORMAT, data: { betaGeneralPreferences: [] } };
  assert.deepEqual(parseBackup(badPrefs), { ok: false, error: "invalid-betaGeneralPreferences" });
});

test("parseBackup ecarte les streamers et les entrees de temps corrompus", () => {
  const dirty = {
    app: "StreamPulse",
    format: BACKUP_FORMAT,
    data: {
      betaGeneralStreamers: [{ id: "twitch:ok", handle: "ok" }, null, 42, { platform: "twitch" }],
      betaWatchTimeData: {
        "2026-09": {
          good: { platform: "twitch", channel: "ok", watchSeconds: 10 },
          bad: { platform: "twitch", channel: "x", watchSeconds: "nope" },
        },
        "pas-un-mois": { a: { platform: "twitch", channel: "y", watchSeconds: 5 } },
      },
      streamPulseWatchTimeDaily: { "2026-09-13": "corrompu" },
    },
  };
  const result = parseBackup(dirty);
  assert.equal(result.ok, true);
  assert.equal(result.data.betaGeneralStreamers.length, 1);
  assert.deepEqual(Object.keys(result.data.betaWatchTimeData), ["2026-09"]);
  assert.deepEqual(Object.keys(result.data.betaWatchTimeData["2026-09"]), ["good"]);
  assert.deepEqual(result.data.streamPulseWatchTimeDaily, {});
  assert.equal(result.summary.streamers, 1);
});

test("backupFileName date le fichier en heure locale", () => {
  assert.equal(backupFileName(new Date(2026, 8, 13, 23, 30)), "streampulse-backup-2026-09-13.json");
});
