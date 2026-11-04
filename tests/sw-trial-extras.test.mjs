// Modules du service worker autour de l'essai StreamPulse+ : compte Kick,
// réinitialisation de développement, alertes manquées, rappel par
// notification et ouverture du popup au clic. Chargés avec le faux `chrome`.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createFakeChrome } from "./helpers/fake-chrome.mjs";

const NOW = Date.parse("2026-10-28T12:00:00Z");
const DAY = 86_400_000;

function area(initial = {}) {
  let data = structuredClone(initial);
  return {
    get: async (keys) => {
      const list = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(data);
      return Object.fromEntries(list.filter((key) => key in data).map((key) => [key, structuredClone(data[key])]));
    },
    set: async (items) => { data = { ...data, ...structuredClone(items) }; },
    remove: async (keys) => {
      const list = typeof keys === "string" ? [keys] : keys;
      data = Object.fromEntries(Object.entries(data).filter(([key]) => !list.includes(key)));
    },
    dump: () => structuredClone(data),
  };
}

let fake;
beforeEach(() => {
  fake = createFakeChrome();
  fake.storage.sync = area();
  fake.action.setIcon = async (details) => { fake.calls.push(["action.setIcon", details]); };
  globalThis.chrome = fake;
});

const mods = {
  kick: () => import("../js/sw/kick-account.js"),
  missed: () => import("../js/sw/missed.js"),
  reminder: () => import("../js/sw/trial-reminder.js"),
  notifications: () => import("../js/sw/notifications.js"),
};

// ─── Compte Kick ──────────────────────────────────────────────────────────────

test("kick : pas de cookie de session, aucun appel réseau", async () => {
  const { kickViewerId } = await mods.kick();
  let fetched = false;
  globalThis.fetch = async () => { fetched = true; };
  fake.cookies.get = async () => null;
  assert.equal(await kickViewerId(), "");
  assert.equal(fetched, false);
});

test("kick : la session donne l'identifiant, le jeton est décodé et jamais envoyé en cookie", async () => {
  const { kickViewerId } = await mods.kick();
  let seen = null;
  fake.cookies.get = async ({ url, name }) => (url === "https://kick.com" && name === "session_token" ? { value: "abc%7C123" } : null);
  globalThis.fetch = async (url, init) => { seen = { url, init }; return { ok: true, json: async () => ({ id: 4242 }) }; };
  assert.equal(await kickViewerId(), "4242");
  assert.equal(seen.url, "https://kick.com/api/v1/user");
  assert.equal(seen.init.headers.Authorization, "Bearer abc|123");
  assert.equal(seen.init.credentials, "omit");
});

test("kick : réponse refusée, identifiant illisible ou panne : chaîne vide", async () => {
  const { kickViewerId } = await mods.kick();
  fake.cookies.get = async () => ({ value: "t" });
  globalThis.fetch = async () => ({ ok: false, json: async () => ({ id: 1 }) });
  assert.equal(await kickViewerId(), "");
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ id: "abc" }) });
  assert.equal(await kickViewerId(), "");
  globalThis.fetch = async () => { throw new Error("offline"); };
  assert.equal(await kickViewerId(), "");
});

// ─── Alertes manquées ─────────────────────────────────────────────────────────

const shortBadge = (id, extra = {}) => ({
  id, title: `Badge ${id}`, owned: false,
  event: { campaignId: `c-${id}`, game: "Rust", startsAt: NOW - 60_000, endsAt: NOW + 30 * 60_000 },
  ...extra,
});

test("manquées : badges courts notés, badges longs ou obtenus ignorés, point posé", async () => {
  const { recordMissedBadges } = await mods.missed();
  const long = shortBadge("long", { event: { campaignId: "x", startsAt: NOW, endsAt: NOW + 3 * DAY } });
  await recordMissedBadges({ liveBadges: [shortBadge("a"), shortBadge("own", { owned: true }), long], added: [{ id: "new1", title: "Tout neuf" }] }, NOW);
  const items = fake.storage.local.dump().streamPulseMissedAlerts.items;
  assert.deepEqual(items.map((item) => item.id).sort(), ["badge:a:c-a", "new:new1"]);
  assert.equal(items.find((item) => item.id === "badge:a:c-a").durationMs, 30 * 60_000 + 60_000);
});

test("manquées : un même badge n'est noté qu'une fois, rien à écrire sans nouveauté", async () => {
  const { recordMissedBadges } = await mods.missed();
  await recordMissedBadges({ liveBadges: [shortBadge("a")] }, NOW);
  const before = fake.storage.local.dump().streamPulseMissedAlerts;
  await recordMissedBadges({ liveBadges: [shortBadge("a")] }, NOW + 60_000);
  assert.deepEqual(fake.storage.local.dump().streamPulseMissedAlerts, before);
  await recordMissedBadges({}, NOW);
  assert.deepEqual(fake.storage.local.dump().streamPulseMissedAlerts, before);
});

test("manquées : campagnes Drops, premier passage silencieux puis nouvelles campagnes", async () => {
  const { recordMissedCampaigns } = await mods.missed();
  const campaign = (id, startsAt) => ({ id, game: "Valorant", name: `Campagne ${id}`, status: "ACTIVE", startsAt, endsAt: NOW + 5 * DAY });
  await recordMissedCampaigns([campaign("old", NOW - DAY)], NOW);
  assert.equal(fake.storage.local.dump().streamPulseMissedAlerts, undefined, "le catalogue existant n'est pas « manqué »");
  await recordMissedCampaigns([campaign("old", NOW - DAY), campaign("new", NOW + 1000)], NOW + 2000);
  const items = fake.storage.local.dump().streamPulseMissedAlerts.items;
  assert.deepEqual(items.map((item) => [item.id, item.kind, item.title]), [["drop:new", "drop", "Campagne new"]]);
});

test("manquées : vues puis effacées quand StreamPulse+ s'active", async () => {
  const { recordMissedBadges, markMissedSeen, clearMissed } = await mods.missed();
  await recordMissedBadges({ liveBadges: [shortBadge("a")] }, NOW);
  await markMissedSeen(NOW + 1000);
  assert.equal(fake.storage.local.dump().streamPulseMissedAlerts.seenAt, NOW + 1000);
  await clearMissed();
  assert.equal(fake.storage.local.dump().streamPulseMissedAlerts, undefined);
});

test("manquées : sans canvas hors écran (Node, vieux navigateur), l'icône n'est jamais touchée", async () => {
  const { syncMissedDot } = await mods.missed();
  await syncMissedDot({ items: [{ id: "x", at: NOW }], seenAt: 0 });
  assert.equal(fake.calls.some(([name]) => name === "action.setIcon"), false);
});

// ─── Rappel de l'essai ────────────────────────────────────────────────────────

test("rappel : premier passage noté, puis une seule notification au bout de trois jours", async () => {
  const { maybeRemindTrial } = await mods.reminder();
  assert.equal(await maybeRemindTrial(NOW), false);
  assert.equal(fake.storage.local.dump().streamPulseTrialReminder.firstSeenAt, NOW);
  assert.equal(await maybeRemindTrial(NOW + DAY), false, "pas avant trois jours");
  assert.equal(await maybeRemindTrial(NOW + 3 * DAY), true);
  const created = fake.calls.filter(([name]) => name === "notifications.create");
  assert.equal(created.length, 1);
  assert.equal(fake.storage.local.dump().streamPulseTrialReminder.count, 1);
});

test("rappel : jamais avec une licence, un essai pris, la marque Google ou un popup ouvert", async () => {
  const { maybeRemindTrial } = await mods.reminder();
  const seen = { streamPulseTrialReminder: { firstSeenAt: NOW - 3 * DAY, count: 0, lastAt: 0 } };
  const cases = [
    { streamPulsePlus: { plan: "trial", otherAccount: true } },
    { streamPulseTrial: { used: true } },
    { streamPulsePopupSeenAt: NOW - 60_000 },
  ];
  for (const extra of cases) {
    fake = createFakeChrome({ local: { ...seen, ...extra } });
    fake.storage.sync = area();
    globalThis.chrome = fake;
    assert.equal(await maybeRemindTrial(NOW), false, JSON.stringify(extra));
  }
  fake = createFakeChrome({ local: seen });
  fake.storage.sync = area({ streamPulseTrialTaken: true });
  globalThis.chrome = fake;
  assert.equal(await maybeRemindTrial(NOW), false, "essai déjà pris sur le compte Google");
});

// ─── Clic sur le rappel : ouverture du popup ─────────────────────────────────

test("clic sur le rappel : ouvre le popup, et à défaut le popup dans un onglet", async () => {
  const { NotificationCenter, OPEN_POPUP_URL } = await mods.notifications();
  let opened = 0;
  fake.action.openPopup = async () => { opened += 1; };
  await NotificationCenter.rememberTarget("n1", { url: OPEN_POPUP_URL });
  await NotificationCenter.handleClicked("n1");
  assert.equal(opened, 1);
  assert.equal(fake.calls.some(([name]) => name === "tabs.create"), false);

  fake.action.openPopup = async () => { throw new Error("pas de fenêtre active"); };
  await NotificationCenter.rememberTarget("n2", { url: OPEN_POPUP_URL });
  await NotificationCenter.handleClicked("n2");
  await new Promise((resolve) => setTimeout(resolve, 0));
  const tab = fake.calls.find(([name]) => name === "tabs.create");
  assert.equal(tab[1].url, "chrome-extension://test-extension-id/html/popup.html");
});

// ─── Point sur l'icône (canvas hors écran simulé) ────────────────────────────

test("point : dessiné sur l'icône 16 et 32 px quand des alertes ne sont pas vues, retiré ensuite", async () => {
  const drawn = [];
  globalThis.OffscreenCanvas = class {
    constructor(w, h) { this.w = w; this.h = h; }
    getContext() {
      const size = this.w;
      return {
        drawImage: () => drawn.push(["image", size]),
        beginPath() {}, arc: (x, y, r) => drawn.push(["dot", size, r]), fill() {}, stroke() {},
        getImageData: () => ({ size }),
        set fillStyle(v) { drawn.push(["fill", v]); }, set strokeStyle(v) {}, set lineWidth(v) {},
      };
    }
  };
  globalThis.createImageBitmap = async () => ({});
  globalThis.fetch = async () => ({ blob: async () => new Blob() });
  try {
    const { syncMissedDot } = await mods.missed();
    await syncMissedDot({ items: [{ id: "x", at: NOW }], seenAt: 0 });
    const withDot = fake.calls.filter(([name]) => name === "action.setIcon").at(-1)[1];
    assert.deepEqual(Object.keys(withDot.imageData), ["16", "32"]);
    assert.ok(drawn.some(([kind, , r]) => kind === "dot" && r > 0));
    assert.ok(drawn.some(([kind, v]) => kind === "fill" && v === "#c6d4a0"), "point vert LCD");
    await syncMissedDot({ items: [{ id: "x", at: NOW }], seenAt: NOW });
    const dots = drawn.filter(([kind]) => kind === "dot").length;
    await syncMissedDot({ items: [{ id: "x", at: NOW }], seenAt: NOW + 1 });
    const plain = fake.calls.filter(([name]) => name === "action.setIcon").at(-1)[1];
    assert.deepEqual(Object.keys(plain.imageData), ["16", "32"], "icône redessinée sans passer par path");
    assert.equal(drawn.filter(([kind]) => kind === "dot").length, dots, "aucun point ajouté");
  } finally {
    delete globalThis.OffscreenCanvas;
    delete globalThis.createImageBitmap;
  }
});

test("point : une panne de dessin est rattrapée, sans exception", async () => {
  globalThis.OffscreenCanvas = class { getContext() { throw new Error("pas de contexte"); } };
  globalThis.createImageBitmap = async () => ({});
  globalThis.fetch = async () => ({ blob: async () => new Blob() });
  try {
    const { syncMissedDot } = await mods.missed();
    await assert.doesNotReject(syncMissedDot({ items: [{ id: "y", at: NOW }], seenAt: 0 }));
  } finally {
    delete globalThis.OffscreenCanvas;
    delete globalThis.createImageBitmap;
  }
});
