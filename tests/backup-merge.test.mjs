import test from "node:test";
import assert from "node:assert/strict";
import { mergeBackup } from "../js/backup.js";

test("mergeBackup ajoute les streamers absents sans créer de doublon", () => {
  const current = {
    betaGeneralStreamers: [
      { id: "twitch:anyme023", platform: "twitch", handle: "anyme023", notificationsEnabled: false },
      { id: "kick:teuf", platform: "kick", handle: "teuf" },
    ],
  };
  const incoming = {
    betaGeneralStreamers: [
      { id: "twitch:anyme023", platform: "twitch", handle: "anyme023", notificationsEnabled: true },
      { platform: "Kick", handle: "TEUF" },
      { id: "twitch:kamet0", platform: "twitch", handle: "kamet0" },
    ],
  };

  const { data, addedStreamers } = mergeBackup(current, incoming);

  assert.equal(addedStreamers, 1);
  assert.deepEqual(data.betaGeneralStreamers.map((s) => s.handle), ["anyme023", "teuf", "kamet0"]);
  assert.equal(data.betaGeneralStreamers[0].notificationsEnabled, false, "le streamer existant garde ses réglages");
});

test("mergeBackup garde le plus grand temps de visionnage par chaîne et par période", () => {
  const current = {
    betaWatchTimeData: {
      "2026-09": { "twitch:a": { channel: "a", platform: "twitch", watchSeconds: 900 } },
    },
  };
  const incoming = {
    betaWatchTimeData: {
      "2026-08": { "twitch:a": { channel: "a", platform: "twitch", watchSeconds: 3600 } },
      "2026-09": {
        "twitch:a": { channel: "a", platform: "twitch", watchSeconds: 600 },
        "twitch:b": { channel: "b", platform: "twitch", watchSeconds: 1200 },
      },
    },
  };

  const { data } = mergeBackup(current, incoming);

  assert.equal(data.betaWatchTimeData["2026-08"]["twitch:a"].watchSeconds, 3600);
  assert.equal(data.betaWatchTimeData["2026-09"]["twitch:a"].watchSeconds, 900);
  assert.equal(data.betaWatchTimeData["2026-09"]["twitch:b"].watchSeconds, 1200);
});

test("mergeBackup garde le maximum des compteurs sans additionner", () => {
  const { data } = mergeBackup(
    { betaGeneralStats: { channelPointsClaimed: 120, dropsClaimed: 4 } },
    { betaGeneralStats: { channelPointsClaimed: 12480, raidsCancelled: 2 } },
  );
  assert.deepEqual(data.betaGeneralStats, { channelPointsClaimed: 12480, dropsClaimed: 4, raidsCancelled: 2 });
});

test("mergeBackup conserve les réglages et le profil actuels et complète les manques", () => {
  const { data } = mergeBackup(
    {
      betaGeneralPreferences: { language: "fr", theme: "light" },
      userProfile: { handle: "alexisamz", displayName: "AlexisAMZ" },
    },
    {
      betaGeneralPreferences: { language: "en", sortOrder: "custom" },
      userProfile: { handle: "autre", displayName: "Autre" },
    },
  );
  assert.deepEqual(data.betaGeneralPreferences, { language: "fr", sortOrder: "custom", theme: "light" });
  assert.equal(data.userProfile.handle, "alexisamz");
});

test("mergeBackup prend le profil de la sauvegarde quand aucun n'est défini", () => {
  const { data } = mergeBackup({ userProfile: { handle: "" } }, { userProfile: { handle: "autre" } });
  assert.equal(data.userProfile.handle, "autre");
});

test("mergeBackup ne renvoie que les clés présentes dans la sauvegarde", () => {
  const { data } = mergeBackup(
    { betaGeneralStreamers: [{ id: "a", handle: "a" }], betaGeneralStats: { channelPointsClaimed: 5 } },
    { betaGeneralStats: { channelPointsClaimed: 1 } },
  );
  assert.deepEqual(Object.keys(data), ["betaGeneralStats"]);
});
