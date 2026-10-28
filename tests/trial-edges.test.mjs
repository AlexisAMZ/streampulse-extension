// Cas limites autour de l'essai StreamPulse+ et des alertes : valeurs
// illisibles, pannes, bornes de temps.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PLUS_GRACE_MS, TRIAL_MS, isPlusActive, normalizeLicenseKey, plusActiveFrom, startTrial, trialPaused } from "../js/plus.js";
import { TRIAL_SYNC_KEY, trialStateFrom, trialTakenOnAccount } from "../js/sw/trial.js";
import { addMissed, missedFrom, unseenCount, weekSummary } from "../js/missed-alerts.js";
import { reminderFrom } from "../js/trial-reminder.js";
import { seenFrom as badgeSeenFrom, planBadgeAlerts, newBadgeAlerts } from "../js/badge-watch.js";

const NOW = Date.parse("2026-10-28T12:00:00Z");
const DAY = 86_400_000;
const DEVICE = "abcdef0123456789abcdef0123456789";
const trial = (extra = {}) => ({ status: "active", licenseKey: `TRIAL-${DEVICE}`, plan: "trial", since: NOW, iat: NOW, sig: "s", ...extra });

test("essai : bornes de temps et de signature", () => {
  assert.equal(isPlusActive(trial({ since: NOW - TRIAL_MS }), NOW), true, "dernier instant du 7e jour");
  assert.equal(isPlusActive(trial({ since: NOW - TRIAL_MS - 1 }), NOW), false);
  assert.equal(isPlusActive(trial({ iat: NOW - PLUS_GRACE_MS - 1 }), NOW), false, "signature trop ancienne");
  assert.equal(isPlusActive(trial({ since: "abc" }), NOW), false);
  assert.equal(isPlusActive(trial({ status: "unverified" }), NOW), false);
});

test("trialPaused : seulement un essai valide mis en pause sur un autre compte", () => {
  assert.equal(trialPaused(null, NOW), false);
  assert.equal(trialPaused(trial(), NOW), false);
  assert.equal(trialPaused(trial({ otherAccount: true }), NOW), true);
  assert.equal(trialPaused(trial({ otherAccount: true, since: NOW - TRIAL_MS - 1 }), NOW), false, "essai fini : plus en pause, fini");
  assert.equal(trialPaused({ ...trial({ otherAccount: true }), plan: "monthly" }, NOW), false);
});

test("normalizeLicenseKey : clés d'essai mal formées refusées", () => {
  assert.equal(normalizeLicenseKey("TRIAL-"), null);
  assert.equal(normalizeLicenseKey("TRIAL-zzzz0123456789abcdef"), null);
  assert.equal(normalizeLicenseKey(`TRIAL-${"a".repeat(41)}`), null);
  assert.equal(normalizeLicenseKey(null), null);
});

test("startTrial : n'envoie que les signaux présents, refuse un plan ou une clé inattendus", async () => {
  let sent;
  const reply = (body) => async (url, init) => { sent = JSON.parse(init.body); return { ok: true, status: 200, json: async () => body }; };
  await startTrial(reply({ valid: false }), DEVICE, NOW);
  assert.deepEqual(Object.keys(sent).filter((key) => key !== "version").sort(), ["action", "device"]);
  await startTrial(reply({ valid: false }), DEVICE, NOW, "42", { kick: "7", synced: true, lang: "fr" });
  assert.deepEqual({ twitch: sent.twitch, kick: sent.kick, synced: sent.synced, lang: sent.lang }, { twitch: "42", kick: "7", synced: true, lang: "fr" });
  assert.deepEqual(await startTrial(reply({ valid: true, plan: "monthly", key: `TRIAL-${DEVICE}`, since: NOW }), DEVICE, NOW), { ok: false, error: "invalid" });
  const signedTwitch = await startTrial(reply({ valid: true, plan: "trial", key: `TRIAL-${DEVICE}`, since: NOW, twitch: "pas-un-id" }), DEVICE, NOW);
  assert.equal(signedTwitch.ok, true);
  assert.equal("twitch" in signedTwitch.record, false, "un compte illisible n'est pas gardé");
});

test("plusActiveFrom : lit la licence dans le stockage", async () => {
  const storage = (value) => ({ get: async () => (value ? { streamPulsePlus: value } : {}) });
  assert.equal(await plusActiveFrom(storage(null)), false);
  assert.equal(await plusActiveFrom(storage({ ...trial(), since: Date.now(), iat: Date.now() })), true);
  assert.equal(await plusActiveFrom(storage({ ...trial(), since: Date.now(), iat: Date.now(), otherAccount: true })), false);
});

test("compte Google : marque absente, présente, synchronisation en panne ou absente", async () => {
  assert.equal(await trialTakenOnAccount(undefined), false);
  assert.equal(await trialTakenOnAccount({ get: async () => ({}) }), false);
  assert.equal(await trialTakenOnAccount({ get: async () => ({ [TRIAL_SYNC_KEY]: true }) }), true);
  assert.equal(await trialTakenOnAccount({ get: async () => ({ [TRIAL_SYNC_KEY]: "true" }) }), false, "seul true compte");
  assert.equal(await trialTakenOnAccount({ get: async () => { throw new Error("quota"); } }), false);
});

test("états lus du stockage : valeurs illisibles ramenées à des valeurs sûres", () => {
  assert.deepEqual(trialStateFrom("n'importe quoi"), { pending: false, used: false, at: 0 });
  assert.deepEqual(trialStateFrom({ pending: "yes", used: 1, at: -5 }), { pending: false, used: false, at: 0 });
  assert.deepEqual(reminderFrom({ firstSeenAt: "x", count: 2.7, lastAt: -1 }), { firstSeenAt: 0, count: 2, lastAt: 0 });
  assert.deepEqual(badgeSeenFrom({ streamPulseBadgeAlertSeen: { a: 5, b: "x", c: -1 } }), { a: 5 });
  assert.deepEqual(badgeSeenFrom({ streamPulseBadgeAlertSeen: [1, 2] }), {});
});

test("alertes manquées : entrées illisibles écartées, textes tronqués, résumé de la semaine", () => {
  const state = missedFrom({ items: [{ id: "a", kind: "autre", at: NOW }, { id: "", kind: "badge", at: NOW }, { id: "b", kind: "badge", title: "x".repeat(500), at: NOW }], seenAt: NOW - 1 });
  assert.deepEqual(state.items.map((item) => item.id), ["b"]);
  assert.equal(state.items[0].title.length, 120);
  assert.equal(unseenCount(state), 1);
  const later = addMissed(state, [{ id: "d", kind: "drop", at: NOW + DAY }], NOW + DAY);
  assert.deepEqual(weekSummary(later, NOW + DAY), { badges: 1, drops: 1, total: 2 });
  assert.deepEqual(weekSummary(later, NOW + 9 * DAY), { badges: 0, drops: 0, total: 0 }, "au-delà de 7 jours, plus rien");
  assert.deepEqual(addMissed(state, "pas une liste", NOW).items.map((item) => item.id), ["b"]);
});

test("badges : portée Plus désactivée ou mal formée, aucune alerte de portée", () => {
  const badge = { id: "x", status: "live", owned: false, event: { campaignId: "c", dropId: "d", startsAt: NOW - 60_000, endsAt: NOW + 3 * DAY, game: "Rust" } };
  const plan = (scope) => planBadgeAlerts({ badges: [badge], watch: {}, seen: {}, shortMs: 0, now: NOW, scope }).alerts.length;
  assert.equal(plan({ enabled: false, mode: "all" }), 0);
  assert.equal(plan("n'importe quoi"), 0);
  assert.equal(plan({ enabled: true, mode: "games", games: [] }), 0);
  assert.equal(plan({ enabled: true, mode: "all", since: NOW }), 0, "badge démarré avant le réglage");
  assert.equal(plan({ enabled: true, mode: "all", since: NOW - DAY }), 1);
  assert.deepEqual(newBadgeAlerts(null, { freeAlerts: true, isPaid: () => false }), []);
  const many = Array.from({ length: 10 }, (_, i) => ({ id: `b${i}` }));
  assert.equal(newBadgeAlerts(many, { scope: { enabled: true, mode: "all" }, freeAlerts: false, isPaid: () => false }).length, 3, "trois au plus par passage");
});

test("plus.js : page de l'offre, portail client et libération d'appareil", async () => {
  const { plusPageUrl, portalUrl, releaseDevice } = await import("../js/plus.js");
  assert.equal(plusPageUrl("fr"), "https://streampulse.tech/plus");
  assert.equal(plusPageUrl("pt-BR", "monthly"), "https://streampulse.tech/pt-br/plus?plan=monthly");
  assert.equal(plusPageUrl("xx", "", "gotaga"), "https://streampulse.tech/en/plus?creator=gotaga");
  const reply = (status, body) => async () => ({ ok: status < 400, status, json: async () => body });
  assert.deepEqual(await portalUrl("SP-K", reply(200, { url: "https://billing.stripe.com/x" })), { url: "https://billing.stripe.com/x" });
  assert.deepEqual(await portalUrl("SP-K", reply(202, { emailed: true })), { emailed: true });
  assert.equal(await portalUrl("SP-K", reply(404, {})), null);
  let sent = null;
  await releaseDevice("SP-K", DEVICE, async (url, init) => { sent = JSON.parse(init.body); return {}; });
  assert.deepEqual(sent, { action: "release", key: "SP-K", device: DEVICE });
  let called = false;
  await releaseDevice("", DEVICE, async () => { called = true; });
  assert.equal(called, false, "sans clé, aucun appel");
  await assert.doesNotReject(releaseDevice("SP-K", DEVICE, async () => { throw new Error("offline"); }));
});
