import { test } from "node:test";
import assert from "node:assert/strict";
import { applyStreamerOrder, sanitizePinnedIds } from "../js/streamers-data.js";

const streamers = [
  { id: "twitch:gotaga", handle: "gotaga" },
  { id: "kick:amine", handle: "amine" },
  { id: "youtube:UCabc", handle: "@abc" },
];

test("l'ordre reçu est appliqué au stockage courant, pas à une copie", () => {
  const reordered = applyStreamerOrder(streamers, ["kick:amine", "twitch:gotaga", "youtube:UCabc"]);
  assert.deepEqual(reordered.map((s) => s.id), ["kick:amine", "twitch:gotaga", "youtube:UCabc"]);
});

test("un streamer ajouté pendant le glisser est gardé, à la fin", () => {
  const withNew = [...streamers, { id: "twitch: nuovo", handle: "nuovo" }];
  const reordered = applyStreamerOrder(withNew, ["youtube:UCabc", "twitch:gotaga", "kick:amine"]);
  assert.deepEqual(reordered.map((s) => s.id), ["youtube:UCabc", "twitch:gotaga", "kick:amine", "twitch: nuovo"]);
});

test("identifiants inconnus, doublons et entrées invalides ignorés", () => {
  const reordered = applyStreamerOrder(streamers, ["kick:amine", "kick:amine", "twitch: fantome", null, 5]);
  assert.deepEqual(reordered.map((s) => s.id), ["kick:amine", "twitch:gotaga", "youtube:UCabc"]);
});

test("entrées non valides en entrée : liste inchangée ou vide", () => {
  assert.deepEqual(applyStreamerOrder(streamers, undefined).map((s) => s.id), streamers.map((s) => s.id));
  assert.deepEqual(applyStreamerOrder(null, ["twitch:gotaga"]), []);
});

test("les épinglés ne gardent que des streamers existants, sans doublon", () => {
  assert.deepEqual(sanitizePinnedIds(streamers, ["kick:amine", "kick:amine", "twitch: fantome"]), ["kick:amine"]);
  assert.deepEqual(sanitizePinnedIds(streamers, ["twitch:gotaga", "youtube:UCabc"]), ["twitch:gotaga", "youtube:UCabc"]);
  assert.deepEqual(sanitizePinnedIds(streamers, "n'importe quoi"), []);
});
