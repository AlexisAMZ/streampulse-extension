// Déroulé complet du mode auto des badges, avec chrome.* simulé.
import { test } from "node:test";
import assert from "node:assert/strict";

const HOUR = 3_600_000;
const now = Date.now();

function fakeChrome() {
  const store = {};
  const tabs = new Map();
  let nextTab = 100;
  const log = { created: [], updated: [], removed: [], scripts: [] };
  globalThis.chrome = {
    storage: {
      local: {
        get: async (keys) => {
          const list = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(list.filter((key) => key in store).map((key) => [key, structuredClone(store[key])]));
        },
        set: async (items) => Object.assign(store, structuredClone(items)),
        remove: async (key) => { delete store[key]; },
      },
    },
    tabs: {
      get: async (id) => {
        if (!tabs.has(id)) throw new Error("No tab");
        return tabs.get(id);
      },
      create: async ({ url }) => {
        const tab = { id: nextTab++, url };
        tabs.set(tab.id, tab);
        log.created.push(url);
        return tab;
      },
      update: async (id, patch) => {
        if (patch.url) {
          tabs.get(id).url = patch.url;
          log.updated.push(patch.url);
        }
        return tabs.get(id);
      },
      remove: async (id) => {
        tabs.delete(id);
        log.removed.push(id);
      },
    },
    scripting: { executeScript: async (details) => log.scripts.push(details.args?.[0]?.title || "player") },
    runtime: { sendMessage: async () => ({}) },
  };
  return { store, tabs, log };
}

// Deux jeux : VALORANT a trois paliers (30 min, 1 h, 90 min), LoL un badge et sa campagne finit plus tôt.
const campaigns = [
  { id: "c-valo", gameId: "516575", game: "VALORANT", owner: "Twitch Gaming", status: "ACTIVE", startsAt: now - HOUR, endsAt: now + 48 * HOUR },
  { id: "c-lol", gameId: "21779", game: "League of Legends", owner: "Twitch Gaming", status: "ACTIVE", startsAt: now - HOUR, endsAt: now + 5 * HOUR },
];
const badge = (id, game) => ({ id, title: `Badge ${id}`, description: `Watch ${game}`, image: "", url: "", game, firstSeen: 0 });
const badges = [badge("t30", "VALORANT"), badge("t60", "VALORANT"), badge("t90", "VALORANT"), badge("l1", "League of Legends"), { ...badge("sub", "VALORANT"), description: "Subscribe to a VALORANT streamer" }];

test("tous les badges : un jeu à la fois, paliers ensemble, puis fin", async () => {
  const { store, tabs, log } = fakeChrome();
  store.streamPulseDropsBadges = { updatedAt: now, syncedAt: now, badges, owned: [] };
  store.streamPulseDropsCampaigns = { updatedAt: now, campaigns };
  const notes = [];
  let liveGame = "21779";
  const { createBadgeAuto } = await import("../js/badge-auto-worker.js");
  const auto = createBadgeAuto({
    streamUrl: async ({ gameId }) => `https://www.twitch.tv/live${gameId}`,
    streamGameOf: async () => liveGame,
    notify: async (title, message, params) => notes.push([message, params?.name || ""]),
    translate: async (key) => key,
    onStart: () => {},
    lowPowerPlayer: () => {},
  });

  const result = await auto.start({ all: true });
  assert.deepEqual(result, { started: true, count: 4 }); // le badge payant n'entre pas dans la file
  assert.deepEqual(log.created, ["https://www.twitch.tv/live21779"]); // LoL finit plus tôt : il passe d'abord
  assert.equal(store.streamPulseBadgeAuto.mode, "all");
  assert.equal(store.streamPulseBadgeAuto.gameKey, "21779");
  assert.ok(log.scripts.includes("background.badgeAuto.bannerAll"));

  // LoL obtenu : l'onglet passe sur VALORANT.
  store.streamPulseDropsBadges.owned = ["l1"];
  liveGame = "21779";
  await auto.check();
  assert.deepEqual(log.updated, ["https://www.twitch.tv/live516575"]);
  assert.deepEqual(notes, [["background.badgeAuto.obtained", "Badge l1"]]);

  // Palier 30 min obtenu, le live est toujours sur VALORANT : l'onglet ne bouge pas.
  store.streamPulseDropsBadges.owned = ["l1", "t30"];
  liveGame = "516575";
  await auto.check();
  assert.equal(log.updated.length, 1);

  // Le streamer change de jeu : nouveau live de VALORANT.
  liveGame = "33214";
  await auto.check();
  assert.equal(log.updated.length, 2);

  // Helix ne répond pas : on garde l'onglet.
  liveGame = null;
  await auto.check();
  assert.equal(log.updated.length, 2);

  // Tous obtenus : file vide, onglet fermé, notification de fin.
  store.streamPulseDropsBadges.owned = ["l1", "t30", "t60", "t90"];
  liveGame = "516575";
  await auto.check();
  assert.equal(store.streamPulseBadgeAuto, undefined);
  assert.equal(tabs.size, 0);
  assert.deepEqual(notes.at(-1), ["background.badgeAuto.doneMessage", ""]);
});

test("un badge à la main, retrait d'un badge, onglet fermé par l'utilisateur", async () => {
  const { store, tabs } = fakeChrome();
  store.streamPulseDropsBadges = { updatedAt: now, syncedAt: now, badges, owned: [] };
  store.streamPulseDropsCampaigns = { updatedAt: now, campaigns };
  const { createBadgeAuto } = await import("../js/badge-auto-worker.js");
  const auto = createBadgeAuto({
    streamUrl: async ({ gameId }) => `https://www.twitch.tv/live${gameId}`,
    streamGameOf: async () => "516575",
    notify: async () => {},
    translate: async (key) => key,
    onStart: () => {},
    lowPowerPlayer: () => {},
  });
  const job = (id, campaign) => ({ badgeId: id, title: id, game: campaign.game, gameId: campaign.gameId, campaignId: campaign.id, endsAt: campaign.endsAt, addedAt: now });
  await auto.start({ job: job("t30", campaigns[0]) });
  await auto.start({ job: job("t60", campaigns[0]) });
  assert.equal(tabs.size, 1); // les deux paliers partagent l'onglet
  assert.deepEqual(store.streamPulseBadgeAuto.jobs.map((item) => item.badgeId), ["t30", "t60"]);

  await auto.stop("t30");
  assert.deepEqual(store.streamPulseBadgeAuto.jobs.map((item) => item.badgeId), ["t60"]);
  assert.equal(tabs.size, 1);

  const [tabId] = tabs.keys();
  auto.onTabRemoved(tabId);
  await auto.check();
  assert.equal(store.streamPulseBadgeAuto, undefined);
});
