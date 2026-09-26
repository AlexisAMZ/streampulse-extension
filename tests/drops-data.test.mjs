import test from "node:test";
import assert from "node:assert/strict";
import {
  DROPS_HISTORY_KEY,
  DROPS_PROGRESS_KEY,
  applyClaim,
  applyEvent,
  applyInventory,
  bandModel,
  countFilters,
  currentDrops,
  dropsToday,
  emptyProgress,
  filterCampaigns,
  historyFrom,
  isStale,
  myGamesFrom,
  normalizeCampaigns,
  normalizeInventory,
  progressFrom,
  pruneCampaigns,
  pruneHistory,
  summarizeHistory,
} from "../js/drops-data.js";

const NOW = new Date(2026, 8, 26, 21, 50).getTime(); // 26 sept. 2026, 21 h 50, heure locale
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (at) => new Date(at).toISOString();

/** Drop tel que Twitch le renvoie dans `dropCampaignsInProgress`. */
function rawDrop({ id = "d1", name = "Vehicle XP Booster", minutes = 32, required = 60, instance = null, claimed = false, badge = false, start = NOW - DAY, end = NOW + DAY } = {}) {
  return {
    id,
    name: `${name} drop`,
    startAt: iso(start),
    endAt: iso(end),
    requiredMinutesWatched: required,
    benefitEdges: [{ benefit: { id: `b-${id}`, name, imageAssetURL: `https://static-cdn.jtvnw.net/${id}.png`, distributionType: badge ? "BADGE" : "DIRECT_ENTITLEMENT" } }],
    self: { currentMinutesWatched: minutes, dropInstanceID: instance, isClaimed: claimed },
  };
}

function rawInventory({ campaigns, awarded = [] } = {}) {
  return {
    currentUser: {
      id: "999",
      inventory: {
        dropCampaignsInProgress: campaigns ?? [
          {
            id: "c-wot",
            name: "HEAT launch",
            status: "ACTIVE",
            endAt: iso(NOW + DAY),
            game: { id: "g1", displayName: "World of Tanks: HEAT" },
            allow: { isEnabled: true, channels: [{ id: "123", name: "terracid", displayName: "Terracid" }] },
            timeBasedDrops: [rawDrop(), rawDrop({ id: "d2", name: "Premium Tank", minutes: 32, required: 180 })],
          },
        ],
        gameEventDrops: awarded,
      },
    },
  };
}

test("normalizeInventory garde un Drop par campagne, celui qui finit le premier", () => {
  const inventory = normalizeInventory(rawInventory(), NOW);
  assert.equal(inventory.drops.length, 1);
  const [drop] = inventory.drops;
  assert.equal(drop.id, "d1");
  assert.equal(drop.name, "Vehicle XP Booster");
  assert.equal(drop.game, "World of Tanks: HEAT");
  assert.equal(drop.channel, "Terracid");
  assert.equal(drop.minutes, 32);
  assert.equal(drop.required, 60);
  assert.equal(drop.image, "https://static-cdn.jtvnw.net/d1.png");
  assert.deepEqual(drop.benefitIds, ["b-d1"]);
  assert.equal(drop.anyChannel, false);
});

test("normalizeInventory montre tous les Drops prêts, et sépare les Drops déjà récupérés", () => {
  const inventory = normalizeInventory(rawInventory({
    campaigns: [{
      id: "c1",
      game: { displayName: "Goblin Cleanup" },
      allow: { isEnabled: false, channels: null },
      timeBasedDrops: [
        rawDrop({ id: "a", minutes: 60, required: 60, instance: "999#c1#a" }),
        rawDrop({ id: "b", minutes: 60, required: 120 }),
        rawDrop({ id: "c", minutes: 60, required: 60, claimed: true }),
        rawDrop({ id: "d", minutes: 0, required: 240 }),
      ],
    }],
  }), NOW);
  assert.deepEqual(inventory.drops.map((drop) => drop.id), ["a", "b"]);
  assert.equal(inventory.drops[0].instanceId, "999#c1#a");
  assert.equal(inventory.drops[1].anyChannel, true);
  assert.deepEqual(inventory.claimed.map((drop) => drop.id), ["c"]);
});

test("normalizeInventory refuse une réponse sans liste de campagnes et ignore les entrées cassées", () => {
  assert.equal(normalizeInventory(null, NOW), null);
  assert.equal(normalizeInventory({ currentUser: null }, NOW), null);
  const inventory = normalizeInventory(rawInventory({ campaigns: [null, { id: "x", timeBasedDrops: [null, { name: "sans id" }] }] }), NOW);
  assert.deepEqual(inventory.drops, []);
});

test("normalizeInventory repère les badges et les récompenses datées de l'inventaire", () => {
  const inventory = normalizeInventory(rawInventory({
    campaigns: [{ id: "c1", game: { displayName: "ELDEN RING" }, timeBasedDrops: [rawDrop({ id: "e", badge: true })] }],
    awarded: [{ id: "b-e", name: "Badge Tarnished", imageURL: "https://x/b.png", lastAwardedAt: iso(NOW - HOUR), game: { displayName: "ELDEN RING" } }, { id: "z" }],
  }), NOW);
  assert.equal(inventory.drops[0].isBadge, true);
  assert.deepEqual(inventory.awarded, [{ benefitId: "b-e", name: "Badge Tarnished", image: "https://x/b.png", game: "ELDEN RING", at: NOW - HOUR }]);
});

test("applyInventory remplace la progression et garde la chaîne apprise par les événements", () => {
  const first = applyInventory(emptyProgress(), [], normalizeInventory(rawInventory(), NOW), NOW, NOW - DAY);
  assert.equal(first.progress.updatedAt, NOW);
  assert.equal(first.added.length, 0);
  const withChannel = applyEvent(first.progress, { type: "drop-progress", data: { drop_id: "d1", channel_id: "123", current_progress_min: 33, required_progress_min: 60 } }, NOW + 60_000).progress;
  const again = applyInventory({ ...withChannel, channels: { 123: "Terracid" } }, [], normalizeInventory(rawInventory(), NOW + 120_000), NOW + 120_000, NOW - DAY);
  assert.equal(again.progress.drops[0].channelId, "123");
  assert.deepEqual(again.progress.channels, { 123: "Terracid" });
});

test("applyInventory ajoute à l'historique un Drop vu en cours puis récupéré, une seule fois", () => {
  const first = applyInventory(emptyProgress(), [], normalizeInventory(rawInventory(), NOW), NOW, NOW - DAY);
  const claimedRaw = rawInventory({
    campaigns: [{ id: "c-wot", game: { displayName: "World of Tanks: HEAT" }, allow: { isEnabled: true, channels: [{ id: "123", displayName: "Terracid" }] }, timeBasedDrops: [rawDrop({ minutes: 60, claimed: true }), rawDrop({ id: "d2", minutes: 60, required: 180 })] }],
    awarded: [{ id: "b-d1", name: "Vehicle XP Booster", lastAwardedAt: iso(NOW + 30 * 60_000) }],
  });
  const later = NOW + HOUR;
  const second = applyInventory(first.progress, first.history, normalizeInventory(claimedRaw, later), later, NOW - DAY);
  assert.equal(second.added.length, 1);
  assert.equal(second.added[0].key, "drop:d1");
  assert.equal(second.added[0].at, NOW + 30 * 60_000, "la date vient de l'inventaire");
  assert.equal(second.added[0].channel, "Terracid");
  assert.equal(second.progress.drops[0].id, "d2");

  const third = applyInventory(second.progress, second.history, normalizeInventory(claimedRaw, later + HOUR), later + HOUR, NOW - DAY);
  assert.equal(third.added.length, 0, "ni le Drop ni sa récompense ne sont comptés deux fois");
  assert.equal(third.history.length, 1);
});

test("applyInventory ne compte jamais une récompense obtenue avant le début du suivi", () => {
  const since = NOW;
  const raw = rawInventory({
    campaigns: [],
    awarded: [
      { id: "old", name: "Ancienne", lastAwardedAt: iso(NOW - DAY) },
      { id: "new", name: "Capsule Hextech", lastAwardedAt: iso(NOW + HOUR), game: { displayName: "League of Legends" } },
    ],
  });
  const result = applyInventory(emptyProgress(), [], normalizeInventory(raw, NOW + 2 * HOUR), NOW + 2 * HOUR, since);
  assert.deepEqual(result.added.map((entry) => entry.name), ["Capsule Hextech"]);
  assert.equal(result.added[0].key, `benefit:new:${NOW + HOUR}`);
});

test("applyInventory ne double pas un Drop récupéré par StreamPulse que l'inventaire date ensuite", () => {
  const inventory = normalizeInventory(rawInventory({ campaigns: [{ id: "c1", game: { displayName: "G" }, timeBasedDrops: [rawDrop({ minutes: 60, instance: "i-1" })] }] }), NOW);
  const read = applyInventory(emptyProgress(), [], inventory, NOW, NOW - DAY);
  const claimed = applyClaim(read.progress, read.history, "i-1", NOW + 60_000, true);
  assert.equal(claimed.entry.auto, true);
  const after = normalizeInventory(rawInventory({ campaigns: [], awarded: [{ id: "b-d1", name: "Vehicle XP Booster", lastAwardedAt: iso(NOW + 50_000) }] }), NOW + 5 * 60_000);
  const next = applyInventory(claimed.progress, claimed.history, after, NOW + 5 * 60_000, NOW - DAY);
  assert.equal(next.added.length, 0);
  assert.equal(next.history.length, 1);
});

test("applyEvent fait avancer un Drop connu et signale un Drop inconnu", () => {
  const { progress } = applyInventory(emptyProgress(), [], normalizeInventory(rawInventory(), NOW), NOW, NOW);
  const moved = applyEvent(progress, { type: "drop-progress", data: { drop_id: "d1", channel_id: "123", current_progress_min: 40, required_progress_min: 60 } }, NOW + 1000);
  assert.equal(moved.known, true);
  assert.equal(moved.progress.drops[0].minutes, 40);
  assert.equal(moved.progress.drops[0].channelId, "123");
  assert.equal(moved.progress.eventAt, NOW + 1000);
  assert.equal(progress.drops[0].minutes, 32, "l'état d'origine n'est pas modifié");

  const unknown = applyEvent(progress, { type: "drop-progress", data: { drop_id: "zz", current_progress_min: 5 } }, NOW);
  assert.equal(unknown.known, false);
  assert.equal(applyEvent(progress, { type: "points-earned", data: {} }, NOW), null);
  assert.equal(applyEvent(progress, { type: "drop-progress", data: {} }, NOW), null);
});

test("applyEvent drop-claim rend le Drop prêt avec son identifiant de récupération", () => {
  const { progress } = applyInventory(emptyProgress(), [], normalizeInventory(rawInventory(), NOW), NOW, NOW);
  const ready = applyEvent(progress, { type: "drop-claim", data: { drop_id: "d1", drop_instance_id: "999#c-wot#d1", channel_id: "123" } }, NOW);
  assert.equal(ready.instanceId, "999#c-wot#d1");
  assert.equal(ready.progress.drops[0].instanceId, "999#c-wot#d1");
  assert.equal(ready.progress.drops[0].minutes, 60);
});

test("applyClaim retire le Drop de la progression et l'ajoute une fois à l'historique", () => {
  const inventory = normalizeInventory(rawInventory({ campaigns: [{ id: "c1", game: { displayName: "G" }, timeBasedDrops: [rawDrop({ minutes: 60, instance: "i-1" })] }] }), NOW);
  const { progress } = applyInventory(emptyProgress(), [], inventory, NOW, NOW);
  const first = applyClaim(progress, [], "i-1", NOW, false);
  assert.equal(first.progress.drops.length, 0);
  assert.equal(first.history.length, 1);
  assert.equal(first.entry.name, "Vehicle XP Booster");
  const second = applyClaim(progress, first.history, "i-1", NOW, false);
  assert.equal(second.entry, null);
  assert.equal(second.history.length, 1);
});

test("currentDrops garde un Drop fini s'il reste à récupérer", () => {
  const progress = { ...emptyProgress(), drops: [
    { id: "a", minutes: 10, required: 60, endsAt: NOW - 1 },
    { id: "b", minutes: 60, required: 60, instanceId: "i", endsAt: NOW - 1 },
    { id: "c", minutes: 50, required: 60, endsAt: NOW + DAY },
  ] };
  assert.deepEqual(currentDrops(progress, NOW).map((drop) => drop.id), ["b", "c"]);
});

test("bandModel montre le Drop le plus proche, puis le dernier récupéré pendant une heure", () => {
  const { progress } = applyInventory(emptyProgress(), [], normalizeInventory(rawInventory(), NOW), NOW, NOW);
  const band = bandModel(progress, [], NOW);
  assert.equal(band.kind, "progress");
  assert.equal(band.drop.id, "d1");
  assert.equal(band.others, 0);
  assert.equal(band.stale, false);
  assert.equal(isStale(progress, NOW + 31 * 60_000), true);

  const history = [{ key: "drop:x", name: "Skin Goblin doré", at: NOW - 10 * 60_000 }];
  assert.equal(bandModel(emptyProgress(), history, NOW).kind, "claimed");
  assert.equal(bandModel(emptyProgress(), history, NOW + 2 * HOUR), null);
});

test("dropsToday compte les Drops depuis minuit, heure locale", () => {
  const midnight = new Date(NOW);
  midnight.setHours(0, 0, 0, 0);
  const history = [{ at: NOW - HOUR }, { at: midnight.getTime() + 1 }, { at: midnight.getTime() - 1 }];
  assert.equal(dropsToday(history, NOW), 2);
});

test("summarizeHistory groupe par mois et regroupe une même récompense du même jour", () => {
  const at = (month, day, hour) => new Date(2026, month, day, hour).getTime();
  const history = [
    { key: "1", name: "Skin Goblin doré", game: "Goblin Cleanup", channel: "Crisalu", at: at(8, 26, 21) },
    { key: "2", name: "Vehicle XP Booster", game: "World of Tanks", channel: "Terracid", at: at(7, 28, 22) },
    { key: "3", name: "Vehicle XP Booster", game: "World of Tanks", channel: "Terracid", at: at(7, 28, 20) },
    { key: "4", name: "Pack de polychromes", game: "Zenless Zone Zero", channel: "Maxcraft", at: at(7, 30, 16) },
  ];
  const summary = summarizeHistory(history);
  assert.equal(summary.total, 4);
  assert.deepEqual(summary.months.map((month) => [month.key, month.count, month.rows.length]), [["2026-09", 1, 1], ["2026-08", 3, 2]]);
  assert.equal(summary.months[1].rows[1].times, 2);
});

test("pruneHistory garde 400 jours et trie du plus récent au plus ancien", () => {
  const history = [{ key: "a", name: "a", at: NOW - 401 * DAY }, { key: "b", name: "b", at: NOW - DAY }, { key: "c", name: "c", at: NOW }];
  assert.deepEqual(pruneHistory(history, NOW).map((entry) => entry.key), ["c", "b"]);
});

const rawCampaign = (id, game, { start = NOW - 10 * DAY, end = NOW + 10 * DAY, status = "ACTIVE", drops } = {}) => ({
  id, name: `${game} campaign`, status, startAt: iso(start), endAt: iso(end),
  game: { id: `g-${id}`, displayName: game, boxArtURL: "https://static-cdn.jtvnw.net/ttv-boxart/1-{width}x{height}.jpg" },
  owner: { id: "o", name: "Wargaming" },
  accountLinkURL: "https://link.example/connect",
  self: { isAccountConnected: false },
  ...(drops ? { timeBasedDrops: drops } : {}),
});

test("normalizeCampaigns lit les champs utiles, dédoublonne et ignore les entrées cassées", () => {
  const campaigns = normalizeCampaigns([
    rawCampaign("1", "PAYDAY 3", { drops: [{ benefitEdges: [{ benefit: { id: "x", distributionType: "BADGE" } }, { benefit: { id: "y", distributionType: "BADGE" } }] }] }),
    rawCampaign("1", "Doublon"),
    rawCampaign("2", "League of Legends"),
    null,
    { id: "3" },
  ]);
  assert.equal(campaigns.length, 2);
  assert.equal(campaigns[0].boxArt, "https://static-cdn.jtvnw.net/ttv-boxart/1-52x72.jpg");
  assert.equal(campaigns[0].owner, "Wargaming");
  assert.equal(campaigns[0].rewardCount, 2);
  assert.equal(campaigns[0].badgeOnly, true);
  assert.equal(campaigns[0].connected, false);
  assert.equal(campaigns[1].rewardCount, null, "sans détail des Drops, le nombre reste inconnu");
});

test("filterCampaigns : nouvelles, finissent bientôt, à venir, et tes jeux en premier", () => {
  const campaigns = normalizeCampaigns([
    rawCampaign("lol", "League of Legends", { end: NOW + 7 * DAY }),
    rawCampaign("pay", "PAYDAY 3", { start: NOW - 2 * DAY, end: NOW + 14 * DAY }),
    rawCampaign("wot", "World of Tanks: HEAT", { end: NOW + DAY }),
    rawCampaign("eld", "ELDEN RING", { end: NOW + 2 * DAY - HOUR }),
    rawCampaign("up", "Soon", { start: NOW + DAY, end: NOW + 5 * DAY, status: "UPCOMING" }),
    rawCampaign("old", "Old", { start: NOW - 30 * DAY, end: NOW - DAY, status: "EXPIRED" }),
  ]);
  const mine = new Set(["league of legends"]);
  assert.deepEqual(filterCampaigns(campaigns, "all", NOW, mine).map((c) => c.id), ["lol", "wot", "eld", "pay"]);
  assert.deepEqual(filterCampaigns(campaigns, "new", NOW, mine).map((c) => c.id), ["pay"]);
  assert.deepEqual(filterCampaigns(campaigns, "ending", NOW, mine).map((c) => c.id), ["wot", "eld"]);
  assert.deepEqual(filterCampaigns(campaigns, "upcoming", NOW, mine).map((c) => c.id), ["up"]);
  assert.deepEqual(countFilters(campaigns, NOW), { all: 4, new: 1, ending: 2, upcoming: 1 });
  assert.deepEqual(pruneCampaigns(campaigns, NOW).map((c) => c.id), ["lol", "pay", "wot", "eld", "up", "old"]);
  assert.deepEqual(pruneCampaigns(campaigns, NOW + 9 * DAY).map((c) => c.id), ["lol", "pay", "up"]);
});

test("myGamesFrom lit les catégories regardées ces 30 derniers jours", () => {
  const day = (offset) => {
    const d = new Date(NOW - offset * DAY);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const games = myGamesFrom({
    [day(0)]: { "twitch:terracid": { watchSeconds: 60, games: { "World of Tanks: HEAT": 60 } } },
    [day(40)]: { "twitch:old": { watchSeconds: 60, games: { Minecraft: 60 } } },
  }, NOW);
  assert.deepEqual([...games], ["world of tanks: heat"]);
});

test("les états lus du storage résistent à des valeurs inattendues", () => {
  assert.deepEqual(progressFrom({ [DROPS_PROGRESS_KEY]: "x" }), emptyProgress());
  assert.deepEqual(progressFrom({ [DROPS_PROGRESS_KEY]: { drops: [null, { id: "a" }] } }).drops, [{ id: "a" }]);
  assert.deepEqual(historyFrom({ [DROPS_HISTORY_KEY]: [{ key: "a", name: "A", at: 1 }, { key: 1 }, null] }), [{ key: "a", name: "A", at: 1 }]);
});

test("isBadgeCampaign reconnaît les organisations de badges sans liste de récompenses", async () => {
  const { isBadgeCampaign } = await import("../js/drops-data.js");
  assert.equal(isBadgeCampaign({ owner: "BadgesLibrary", badgeOnly: null }), true);
  assert.equal(isBadgeCampaign({ owner: "Twitch Gaming" }), true);
  assert.equal(isBadgeCampaign({ owner: "Riot Games", badgeOnly: null }), false);
});
