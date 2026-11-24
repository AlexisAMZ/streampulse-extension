import test from "node:test";
import assert from "node:assert/strict";
import { badgeStatus, buildBadgeEvents, catalogBadges } from "../js/badges-data.js";

// Twitch traduit les titres du catalogue, pas les noms des récompenses d'une campagne (GTAVI Launch Celebration).
test("campagne de récompenses en anglais : le badge au titre traduit passe en cours", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");
  const catalog = [
    { id: "purple-chain", title: "Chaîne violette", description: "Ce badge a été obtenu en regardant GTA VI pendant 1 jour" },
    { id: "welcome-2-miami", title: "Bienvenue à Miami", description: "Ce badge a été obtenu en s'abonnant à une chaîne streamant GTA VI" },
  ];
  const rewards = [{
    id: "gtavi", name: "GTAVI Launch Celebration", brand: "Rockstar", startsAt: Date.parse("2026-11-18T11:00:00Z"), endsAt: Date.parse("2026-12-01T07:59:00Z"),
    rewards: [{ id: "a", name: "Purple Chain" }, { id: "b", name: "Welcome 2 Miami" }],
  }];
  const events = buildBadgeEvents({ rewards, catalog, now });
  for (const badge of catalog) {
    assert.equal(badgeStatus(badge, events, { now, addedAt: now - 3 * 86_400_000 }).status, "live", badge.id);
  }
});

// Cas réel du 24/11/2026 : la campagne ne liste que « GTA DVD Chest », les badges ne sont nommés nulle part.
test("campagne qui ne nomme que son coffre : les badges se relient par le mot GTAVI, sans toucher les autres", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");
  const catalog = [
    { id: "silver-chain", title: "Silver Chain", description: "This badge was earned for watching 3 days of GTAVI during launch week." },
    { id: "scored-big", title: "Scored Big", description: "This badge was earned by subbing to a GTAVI streamer during launch." },
    { id: "unrelated", title: "Autre", description: "This badge was earned for watching 30 minutes of PAYDAY 3." },
  ];
  const rewards = [{
    id: "g", name: "GTAVI Launch Celebration", summary: "Unlock six badges by watching GTAVI streamers for one hour each day.",
    startsAt: Date.parse("2026-11-18T11:00:00Z"), endsAt: Date.parse("2026-12-01T07:59:00Z"), rewards: [{ id: "c", name: "GTA DVD Chest" }],
  }];
  const events = buildBadgeEvents({ rewards, catalog, now });
  assert.equal(badgeStatus(catalog[0], events, { now, addedAt: now - 9 * 86_400_000 }).status, "live");
  assert.equal(badgeStatus(catalog[1], events, { now, addedAt: now - 9 * 86_400_000 }).status, "live");
  assert.equal(events.some((event) => event.badgeId === "unrelated"), false);
});

test("badges d'une campagne GTAVI : les badges de sub et le badge final sont payants, ceux de visionnage gratuits", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");
  const catalog = [
    { id: "silver-chain", title: "Silver Chain", description: "This badge was earned for watching 3 days of GTAVI during launch week." },
    { id: "scored-big", title: "Scored Big", description: "This badge was earned by subbing to a GTAVI streamer during launch." },
    { id: "golden-iguana", title: "Golden Iguana", description: "This badge was earned by securing all the Emotes and Badges from the GTAVI launch. " },
  ];
  const rewards = [{
    id: "g", name: "GTAVI Launch Celebration", summary: "Watch GTAVI streamers. Subscribe three times.", minutesGoal: 60,
    startsAt: Date.parse("2026-11-18T11:00:00Z"), endsAt: Date.parse("2026-12-01T07:59:00Z"), rewards: [{ id: "c", name: "GTA DVD Chest" }],
  }];
  const events = buildBadgeEvents({ rewards, catalog, now });
  const state = Object.fromEntries(catalogBadges({ badges: catalog, owned: [] }, { now, events, status: "live" }).map((badge) => [badge.id, badge.paid]));
  assert.deepEqual(state, { "silver-chain": false, "scored-big": true, "golden-iguana": true });
});

// Cas réel du 24/11/2026 : « Pokemon Evolutions » nomme Haunter ; les anciens badges Pokémon ne lui appartiennent pas.
test("campagne qui nomme déjà un badge : le mot de la marque n'attrape pas les anciens badges de la licence", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");
  const catalog = [
    { id: "haunter", title: "Haunter", description: "This badge was earned for watching 20 minutes of Pokemon." },
    { id: "pikachu", title: "Pikachu", description: "This badge was earned for watching 20 minutes of Pokemon." },
    { id: "pichu", title: "Pichu", description: "This badge was earned for watching 20 minutes of Pokemon." },
  ];
  const rewards = [{
    id: "p", name: "Pokemon Evolutions", summary: "Participating categories include: Pokemon FireRed, Pokemon Pokopia.", minutesGoal: 20,
    startsAt: Date.parse("2026-10-16T17:00:00Z"), endsAt: Date.parse("2027-01-30T22:59:00Z"), rewards: [{ id: "h", name: "Haunter" }],
  }];
  const events = buildBadgeEvents({ rewards, catalog, now });
  assert.deepEqual(events.map((event) => event.badgeId), ["haunter"]);
});

test("un faux lien déduit déjà enregistré disparaît à la lecture suivante", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");
  const catalog = [{ id: "haunter", title: "Haunter", description: "Pokemon" }, { id: "pikachu", title: "Pikachu", description: "Pokemon" }];
  const rewards = [{ id: "p", name: "Pokemon Evolutions", summary: "Pokemon", startsAt: now - 86_400_000, endsAt: now + 86_400_000, rewards: [{ id: "h", name: "Haunter" }] }];
  const previous = [{ badgeId: "pikachu", kind: "rewards", campaignId: "p", dropId: "", link: "game", startsAt: now - 86_400_000, endsAt: now + 86_400_000, seenAt: now }];
  const events = buildBadgeEvents({ rewards, catalog, previous, now });
  assert.deepEqual(events.map((event) => event.badgeId), ["haunter"]);
});

test("un lien déduit déjà enregistré (GTA VI) est refait, pas perdu, à la lecture suivante", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");
  const catalog = [{ id: "silver-chain", title: "Silver Chain", description: "This badge was earned for watching 3 days of GTAVI during launch week." }];
  const rewards = [{
    id: "g", name: "GTAVI Launch Celebration", summary: "Watch GTAVI streamers.", minutesGoal: 60,
    startsAt: now - 86_400_000, endsAt: now + 86_400_000, rewards: [{ id: "c", name: "GTA DVD Chest" }],
  }];
  const first = buildBadgeEvents({ rewards, catalog, now });
  const second = buildBadgeEvents({ rewards, catalog, previous: first, now: now + 1000 });
  assert.deepEqual(second.map((event) => event.badgeId), ["silver-chain"]);
});
