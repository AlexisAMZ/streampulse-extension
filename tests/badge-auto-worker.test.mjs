// Déroulé complet du mode auto des badges, avec chrome.* simulé.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBadgeEvents } from "../js/badges-data.js";
import { BADGE_AUTO_ALARM } from "../js/sw/constants.js";

const HOUR = 3_600_000;
const now = Date.now();

function fakeChrome() {
  const store = {};
  const tabs = new Map();
  const alarms = new Map();
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
    alarms: {
      get: (name, callback) => callback(alarms.get(name) || null),
      create: (name, info) => alarms.set(name, info),
      clear: (name, callback) => {
        alarms.delete(name);
        callback?.();
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
    scripting: {
      executeScript: async (details) => {
        // Bannière : args[0] est la vue (objet avec title) ; lecteur réinjecté :
        // args[0] est la hauteur cible, en monde MAIN.
        const first = details.args?.[0];
        log.scripts.push(first && typeof first === "object" ? String(first.title) : details.world === "MAIN" ? `player:${first}` : "player");
        return [];
      },
    },
    runtime: { sendMessage: async () => ({}) },
  };
  return { store, tabs, alarms, log };
}

// Deux jeux : VALORANT a trois paliers (30 min, 1 h, 90 min), LoL un badge et sa campagne finit plus tôt.
const campaigns = [
  { id: "c-valo", gameId: "516575", game: "VALORANT", owner: "Twitch Gaming", status: "ACTIVE", startsAt: now - HOUR, endsAt: now + 48 * HOUR },
  { id: "c-lol", gameId: "21779", game: "League of Legends", owner: "Twitch Gaming", status: "ACTIVE", startsAt: now - HOUR, endsAt: now + 5 * HOUR },
];
const badge = (id, game) => ({ id, title: `Badge ${id}`, description: `Watch ${game}`, image: "", url: "", game, firstSeen: 0 });
const badges = [badge("t30", "VALORANT"), badge("t60", "VALORANT"), badge("t90", "VALORANT"), badge("l1", "League of Legends"), { ...badge("sub", "VALORANT"), description: "Subscribe to a VALORANT streamer" }];

// Licence Plus active : le mode auto des badges est une fonctionnalité Plus.
const plusRecord = () => ({ status: "active", licenseKey: "SP-AAAA-BBBB-CCCC-DDDD", plan: "monthly", verifiedAt: now, checkedAt: now });

test("tous les badges : un jeu à la fois, paliers ensemble, puis fin", async () => {
  const { store, tabs, alarms, log } = fakeChrome();
  store.streamPulsePlus = plusRecord();
  store.streamPulseDropsBadges = { updatedAt: now, syncedAt: now, badges, owned: [] };
  store.streamPulseDropsCampaigns = { updatedAt: now, campaigns };
  store.streamPulseBadgeEvents = { updatedAt: now, events: buildBadgeEvents({ campaigns, catalog: badges, now }) };
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
  // LoL finit plus tôt : il passe d'abord. L'onglet naît muet (création, mute,
  // puis navigation) : la première URL live est dans updated.
  assert.deepEqual(log.updated, ["https://www.twitch.tv/live21779"]);
  assert.equal(store.streamPulseBadgeAuto.mode, "all");
  assert.equal(store.streamPulseBadgeAuto.gameKey, "21779");
  assert.ok(log.scripts.includes("background.badgeAuto.bannerAll"));
  // L'alarme dédiée tourne pendant le mode auto.
  assert.equal(alarms.get(BADGE_AUTO_ALARM)?.periodInMinutes, 2);

  // LoL obtenu : l'onglet passe sur VALORANT.
  store.streamPulseDropsBadges.owned = ["l1"];
  liveGame = "21779";
  await auto.check();
  assert.deepEqual(log.updated, ["https://www.twitch.tv/live21779", "https://www.twitch.tv/live516575"]);
  assert.deepEqual(notes, [["background.badgeAuto.obtained", "Badge l1"]]);

  // Palier 30 min obtenu, le live est toujours sur VALORANT : l'onglet ne bouge pas.
  store.streamPulseDropsBadges.owned = ["l1", "t30"];
  liveGame = "516575";
  await auto.check();
  assert.equal(log.updated.length, 2);

  // Le streamer change de jeu : nouveau live de VALORANT.
  liveGame = "33214";
  await auto.check();
  assert.equal(log.updated.length, 3);

  // Helix ne répond pas : on garde l'onglet.
  liveGame = null;
  await auto.check();
  assert.equal(log.updated.length, 3);

  // Tous obtenus : file vide, onglet fermé, notification de fin, alarme éteinte.
  store.streamPulseDropsBadges.owned = ["l1", "t30", "t60", "t90"];
  liveGame = "516575";
  await auto.check();
  assert.equal(store.streamPulseBadgeAuto, undefined);
  assert.equal(tabs.size, 0);
  assert.equal(alarms.has(BADGE_AUTO_ALARM), false);
  assert.deepEqual(notes.at(-1), ["background.badgeAuto.doneMessage", ""]);
});

test("un badge à la main, retrait d'un badge, onglet fermé par l'utilisateur", async () => {
  const { store, tabs } = fakeChrome();
  store.streamPulsePlus = plusRecord();
  store.streamPulseDropsBadges = { updatedAt: now, syncedAt: now, badges, owned: [] };
  store.streamPulseDropsCampaigns = { updatedAt: now, campaigns };
  store.streamPulseBadgeEvents = { updatedAt: now, events: buildBadgeEvents({ campaigns, catalog: badges, now }) };
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

test("sans StreamPulse+ actif, « tous les badges » est refusé", async () => {
  const { store, tabs } = fakeChrome();
  store.streamPulseDropsBadges = { updatedAt: now, syncedAt: now, badges, owned: [] };
  store.streamPulseDropsCampaigns = { updatedAt: now, campaigns };
  store.streamPulseBadgeEvents = { updatedAt: now, events: buildBadgeEvents({ campaigns, catalog: badges, now }) };
  const { createBadgeAuto } = await import("../js/badge-auto-worker.js");
  const auto = createBadgeAuto({
    streamUrl: async ({ gameId }) => `https://www.twitch.tv/live${gameId}`,
    streamGameOf: async () => "516575",
    notify: async () => {},
    translate: async (key) => key,
    onStart: () => {},
    lowPowerPlayer: () => {},
  });
  const result = await auto.start({ all: true });
  assert.deepEqual(result, { started: false, plusRequired: true });
  assert.equal(store.streamPulseBadgeAuto, undefined);
  assert.equal(tabs.size, 0);
});

test("la licence Plus qui expire arrête une récupération en cours", async () => {
  const { store, tabs } = fakeChrome();
  store.streamPulsePlus = plusRecord();
  store.streamPulseDropsBadges = { updatedAt: now, syncedAt: now, badges, owned: [] };
  store.streamPulseDropsCampaigns = { updatedAt: now, campaigns };
  store.streamPulseBadgeEvents = { updatedAt: now, events: buildBadgeEvents({ campaigns, catalog: badges, now }) };
  const notes = [];
  const { createBadgeAuto } = await import("../js/badge-auto-worker.js");
  const auto = createBadgeAuto({
    streamUrl: async ({ gameId }) => `https://www.twitch.tv/live${gameId}`,
    streamGameOf: async () => "516575",
    notify: async (title, message) => notes.push(message),
    translate: async (key) => key,
    onStart: () => {},
    lowPowerPlayer: () => {},
  });
  await auto.start({ all: true });
  assert.equal(tabs.size, 1);

  // Résiliation puis délai de grâce dépassé (verifiedAt ancien) : le passage
  // suivant du mode auto doit tout arrêter et prévenir.
  store.streamPulsePlus = { ...plusRecord(), verifiedAt: now - 40 * 24 * HOUR, checkedAt: now - 40 * 24 * HOUR };
  await auto.check();
  assert.equal(store.streamPulseBadgeAuto, undefined);
  assert.equal(tabs.size, 0);
  assert.deepEqual(notes, ["background.badgeAuto.stoppedPlus"]);
});

function vigieSetup(store) {
  store.streamPulsePlus = plusRecord();
  store.streamPulseDropsBadges = { updatedAt: now, syncedAt: now, badges, owned: [] };
  store.streamPulseDropsCampaigns = { updatedAt: now, campaigns };
  store.streamPulseBadgeEvents = { updatedAt: now, events: buildBadgeEvents({ campaigns, catalog: badges, now }) };
}

const manualJob = (id, campaign) => ({ badgeId: id, title: id, game: campaign.game, gameId: campaign.gameId, campaignId: campaign.id, endsAt: campaign.endsAt, addedAt: now });

const vigieDeps = (probeGetter) => ({
  streamUrl: async ({ gameId }) => `https://www.twitch.tv/live${gameId}`,
  streamGameOf: async () => "516575",
  notify: async () => {},
  translate: async (key) => key,
  onStart: () => {},
  lowPowerPlayer: () => {},
  probeTab: async () => probeGetter(),
});

test("vigie : lecture en pause réinjectée, temps figé ou pause persistante → page neuve", async () => {
  const { store, log } = fakeChrome();
  vigieSetup(store);
  const { createBadgeAuto } = await import("../js/badge-auto-worker.js");
  let probe = { paused: false, t: 10 };
  const auto = createBadgeAuto(vigieDeps(() => probe));

  await auto.start({ job: manualJob("t30", campaigns[0]) });
  assert.equal(log.updated.length, 1);

  // Le temps de lecture avance : rien ne bouge. (Le passage inclus dans start
  // a déjà vu t=10 ; on avance la sonde avant de revérifier.)
  probe = { paused: false, t: 130 };
  await auto.check();
  assert.equal(store.streamPulseBadgeAuto.video.t, 130);
  assert.equal(log.updated.length, 1);
  assert.equal(log.scripts.filter((entry) => entry.startsWith("player:")).length, 0);

  // Temps inchangé entre deux passages : onglet figé, page neuve.
  await auto.check();
  assert.equal(log.updated.length, 2);
  assert.equal(store.streamPulseBadgeAuto.video, null);

  // Pause ponctuelle : le lecteur est réinjecté (hauteur par défaut 360p), pas de navigation.
  probe = { paused: true, t: 0 };
  await auto.check();
  assert.equal(log.updated.length, 2);
  assert.ok(log.scripts.includes("player:360"));

  // Encore en pause au passage suivant : page neuve.
  await auto.check();
  assert.equal(log.updated.length, 3);
});

test("vigie : un onglet déchargé par le navigateur est repris comme un live à rouvrir", async () => {
  const { store, tabs, log } = fakeChrome();
  vigieSetup(store);
  const { createBadgeAuto } = await import("../js/badge-auto-worker.js");
  const auto = createBadgeAuto(vigieDeps(() => ({ paused: false, t: 5 })));
  await auto.start({ job: manualJob("t30", campaigns[0]) });
  assert.equal(log.updated.length, 1);

  const [tabId] = tabs.keys();
  tabs.get(tabId).discarded = true;
  await auto.check();
  assert.equal(log.updated.length, 2); // rechargé, pas considéré vivant
});

test("le lecteur est réinjecté à la hauteur choisie (160p en économie de bande passante)", async () => {
  const { store, tabs, log } = fakeChrome();
  vigieSetup(store);
  const { createBadgeAuto } = await import("../js/badge-auto-worker.js");
  let target = 360;
  const deps = vigieDeps(() => ({ paused: false, t: 1 }));
  deps.videoHeight = async () => target;
  const auto = createBadgeAuto(deps);
  await auto.start({ job: manualJob("t30", campaigns[0]) });
  const [tabId] = tabs.keys();

  await auto.onTabUpdated(tabId, { status: "complete" });
  assert.ok(log.scripts.includes("player:360"));
  target = 160;
  await auto.onTabUpdated(tabId, { status: "complete" });
  assert.ok(log.scripts.includes("player:160"));
});

test("autoFarm : sans file, « tous » démarre ; avec une file, les nouveaux s'ajoutent sans changer le mode", async () => {
  const { store, tabs, alarms } = fakeChrome();
  vigieSetup(store);
  const { createBadgeAuto } = await import("../js/badge-auto-worker.js");
  const auto = createBadgeAuto(vigieDeps({ paused: false, t: 1 }));

  // Rien de nouveau : rien ne démarre, aucun onglet ouvert.
  assert.deepEqual(await auto.autoFarm([]), { started: false });
  assert.deepEqual(await auto.autoFarm(["inconnu"]), { started: false });
  assert.equal(tabs.size, 0);
  assert.equal(alarms.has(BADGE_AUTO_ALARM), false);

  // Nouveaux badges sans file : « tous les badges possibles » démarre.
  assert.deepEqual(await auto.autoFarm(["t30", "l1"]), { started: true, count: 4 });
  assert.equal(tabs.size, 1);
  assert.equal(store.streamPulseBadgeAuto.mode, "all");
  assert.equal(alarms.has(BADGE_AUTO_ALARM), true);

  // File manuelle : les nouveaux badges s'ajoutent, le mode ne bouge pas.
  await auto.stop();
  assert.equal(store.streamPulseBadgeAuto, undefined);
  assert.equal(alarms.has(BADGE_AUTO_ALARM), false);
  await auto.start({ job: manualJob("t60", campaigns[0]) });
  assert.deepEqual(await auto.autoFarm(["t90"]), { started: true, count: 1 });
  assert.deepEqual(store.streamPulseBadgeAuto.jobs.map((item) => item.badgeId), ["t60", "t90"]);
  assert.equal(store.streamPulseBadgeAuto.mode, "manual");
});
