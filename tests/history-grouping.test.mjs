import { test } from "node:test";
import assert from "node:assert/strict";
import { groupMissedEntries } from "../js/history-grouping.js";
import { summarize } from "../js/history-data.js";

const H = 3600_000;
const T0 = Date.parse("2026-10-19T18:00:00Z");
const roster = [
  { id: "ada", platform: "twitch", displayName: "Ada", handle: "ada", avatarUrl: "https://img/ada-tw.png" },
  { id: "kick:ada", platform: "kick", displayName: "ada_k", handle: "ada", avatarUrl: "https://img/ada-kick.png" },
  { id: "bea", platform: "twitch", displayName: "Bea", handle: "bea" },
];
const groups = [{ id: "g1", name: "Ada", streamerIds: ["ada", "kick:ada"], preferredId: "kick:ada" }];
const session = (streamerId, platform, start, hours, extra = {}) => ({
  id: `${streamerId}@${start}`,
  streamerId,
  platform,
  handle: streamerId.replace("kick:", ""),
  displayName: streamerId,
  avatarUrl: `https://img/${streamerId}.png`,
  startedAt: new Date(start).toISOString(),
  endedAt: start + hours * H,
  durationSec: hours * 3600,
  vodUrl: `https://${platform}/${streamerId}`,
  hasVod: false,
  seen: false,
  ...extra,
});

test("sans groupe, chaque session reste une carte à une seule plateforme", () => {
  const entries = [session("ada", "twitch", T0, 2), session("bea", "twitch", T0 - 5 * H, 1)];
  const items = groupMissedEntries(entries, [], roster);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0].variants.map((v) => v.platform), ["twitch"]);
  assert.equal(items[0].displayName, "ada");
});

test("deux sessions simultanées d'un groupe lié donnent une seule carte avec les deux liens", () => {
  const entries = [session("ada", "twitch", T0, 2), session("kick:ada", "kick", T0 + H / 2, 2)];
  const items = groupMissedEntries(entries, groups, roster);
  assert.equal(items.length, 1);
  const [item] = items;
  assert.equal(item.displayName, "Ada");
  assert.equal(item.streamerId, "kick:ada");
  assert.equal(item.avatarUrl, "https://img/ada-kick.png");
  assert.deepEqual(item.variants.map((v) => [v.platform, v.vodUrl]), [
    ["kick", "https://kick/kick:ada"],
    ["twitch", "https://twitch/ada"],
  ]);
});

test("des sessions séparées dans le temps restent distinctes mais portent l'identité du groupe", () => {
  const entries = [session("ada", "twitch", T0, 2), session("kick:ada", "kick", T0 - 10 * H, 2)];
  const items = groupMissedEntries(entries, groups, roster);
  assert.equal(items.length, 2);
  assert.ok(items.every((item) => item.displayName === "Ada" && item.avatarUrl === "https://img/ada-kick.png"));
  assert.ok(items.every((item) => item.variants.length === 1));
});

test("la carte fusionnée n'est « vue » que si toutes ses sessions le sont, et garde la durée la plus longue", () => {
  const entries = [session("ada", "twitch", T0, 3, { seen: true }), session("kick:ada", "kick", T0, 2)];
  const [item] = groupMissedEntries(entries, groups, roster);
  assert.equal(item.seen, false);
  assert.equal(item.durationSec, 3 * 3600);
  assert.deepEqual(item.ids.sort(), ["ada@" + T0, "kick:ada@" + T0].sort());
  const seen = groupMissedEntries(entries.map((e) => ({ ...e, seen: true })), groups, roster);
  assert.equal(seen[0].seen, true);
});

test("deux sessions de la même plateforme ne fusionnent jamais, et les entrées ne sont pas modifiées", () => {
  const entries = [session("ada", "twitch", T0, 2), session("ada", "twitch", T0 + H, 2, { id: "ada@other" })];
  const copy = structuredClone(entries);
  const items = groupMissedEntries(entries, groups, roster);
  assert.equal(items.length, 2);
  assert.deepEqual(entries, copy);
});

test("sans heure de début, la fin et la durée servent à détecter le chevauchement", () => {
  const a = session("ada", "twitch", T0, 2, { startedAt: null });
  const b = session("kick:ada", "kick", T0 + H, 2, { startedAt: null });
  assert.equal(groupMissedEntries([a, b], groups, roster).length, 1);
});

test("avatar : retombe sur l'avatar de la session quand le compte préféré est inconnu", () => {
  const lone = [{ ...groups[0], preferredId: "ada" }];
  const [item] = groupMissedEntries([session("kick:ada", "kick", T0, 2)], lone, roster.slice(1));
  assert.equal(item.avatarUrl, "https://img/kick:ada.png");
});

test("le compteur d'historique compte les cartes, pas les comptes", () => {
  const entries = [session("ada", "twitch", T0, 2), session("kick:ada", "kick", T0, 2)];
  assert.equal(summarize(groupMissedEntries(entries, groups, roster)).count, 1);
});
