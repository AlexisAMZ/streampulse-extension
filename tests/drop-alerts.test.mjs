import { test } from "node:test";
import assert from "node:assert/strict";
import { DROP_ALERTS_KEY, MAX_SEEN, campaignAlerts, gameMatches, normalizeDropAlerts, seenFrom } from "../js/drop-alerts.js";

const NOW = new Date(2026, 9, 13, 15, 0).getTime();
const HOUR = 3_600_000;

const campaign = (id, game, extra = {}) => ({ id, game, startsAt: NOW - HOUR, endsAt: NOW + 10 * 24 * HOUR, status: "ACTIVE", name: `Campagne ${game}`, ...extra });

test("normalizeDropAlerts : réglages nettoyés, dédupliqués, plafonnés", () => {
  assert.deepEqual(normalizeDropAlerts(null), { enabled: false, games: [] });
  assert.deepEqual(normalizeDropAlerts({ enabled: true, games: [" Valorant ", "valorant", "", "CS2"] }), { enabled: true, games: ["Valorant", "CS2"] });
  const many = normalizeDropAlerts({ enabled: true, games: Array.from({ length: 30 }, (_, i) => `Jeu ${i}`) });
  assert.equal(many.games.length, 12);
});

test("gameMatches : mêmes règles que les badges (accents, casse, jeu englobé)", () => {
  assert.equal(gameMatches("VALORANT", ["valorant"]), true);
  assert.equal(gameMatches("Counter-Strike 2", ["Counter Strike 2"]), true);
  assert.equal(gameMatches("Warhammer 40,000: Space Marine II", ["Space Marine 2"]), true);
  assert.equal(gameMatches("Valorant", ["League of Legends"]), false);
  assert.equal(gameMatches("", ["Valorant"]), false);
});

test("campaignAlerts : premier passage muet, puis alerte une seule fois par campagne", () => {
  const settings = { enabled: true, games: ["Valorant"] };
  const list = [campaign("c1", "VALORANT"), campaign("c2", "League of Legends"), campaign("c3", "Valorant")];
  // Premier passage : on note, sans alerte (pas d'inondation au réglage).
  const seed = campaignAlerts(list, settings, seenFrom(null), NOW);
  assert.deepEqual(seed.alerts, []);
  assert.equal(seed.seen.at, NOW);
  assert.deepEqual([...seed.seen.ids].sort(), ["c1", "c3"]);
  // Passage suivant : rien de nouveau, rien de nouveau à signaler.
  const quiet = campaignAlerts(list, settings, seenFrom(seed.seen), NOW + HOUR);
  assert.deepEqual(quiet.alerts, []);
  // Une campagne qui démarre : une seule alerte, puis plus jamais.
  const list2 = [...list, campaign("c4", "valorant")];
  const fresh = campaignAlerts(list2, settings, seenFrom(seed.seen), NOW + 2 * HOUR);
  assert.deepEqual(fresh.alerts.map((c) => c.id), ["c4"]);
  const again = campaignAlerts(list2, settings, seenFrom(fresh.seen), NOW + 3 * HOUR);
  assert.deepEqual(again.alerts, []);
});

test("campaignAlerts : ignore campagnes finies, à venir lointaines et démarrées depuis trop longtemps", () => {
  const settings = { enabled: true, games: ["Valorant"] };
  const seen = { at: NOW - 30 * 24 * HOUR, ids: [] };
  const list = [
    campaign("ended", "Valorant", { endsAt: NOW - HOUR }),
    campaign("upcoming", "Valorant", { startsAt: NOW + 90 * 24 * HOUR }),
    campaign("old", "Valorant", { startsAt: NOW - 30 * 24 * HOUR }),
    campaign("fresh", "Valorant", { startsAt: NOW - 2 * HOUR }),
  ];
  const result = campaignAlerts(list, settings, seen, NOW);
  assert.deepEqual(result.alerts.map((c) => c.id), ["fresh"]);
});

test("campaignAlerts : coupe quand le réglage est off ou sans jeu", () => {
  const list = [campaign("c1", "Valorant")];
  assert.deepEqual(campaignAlerts(list, { enabled: false, games: ["Valorant"] }, { at: NOW, ids: [] }, NOW).alerts, []);
  assert.deepEqual(campaignAlerts(list, { enabled: true, games: [] }, { at: NOW, ids: [] }, NOW).alerts, []);
});

test("campaignAlerts : purge des déjà-vues sorties de la liste, plafonnées", () => {
  const settings = { enabled: true, games: ["Valorant"] };
  const seen = { at: NOW, ids: ["gone1", "gone2", "c1"] };
  const list = [campaign("c1", "Valorant")];
  const result = campaignAlerts(list, settings, seen, NOW);
  assert.deepEqual(result.seen.ids, ["c1"]);
  const flood = Array.from({ length: MAX_SEEN + 50 }, (_, i) => campaign(`x${i}`, "Valorant"));
  const seeded = campaignAlerts(flood, settings, seenFrom(null), NOW);
  assert.equal(seeded.seen.ids.length <= MAX_SEEN, true);
});

test("DROP_ALERTS_KEY : la clé de stockage ne bouge pas", () => {
  assert.equal(DROP_ALERTS_KEY, "streamPulseDropAlerts");
});
