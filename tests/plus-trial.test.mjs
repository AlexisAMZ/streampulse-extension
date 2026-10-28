import { test } from "node:test";
import assert from "node:assert/strict";
import { TRIAL_MS, isPlusActive, normalizeLicenseKey, startTrial, trialEndsAt, verifyLicense } from "../js/plus.js";

const NOW = Date.parse("2026-10-28T12:00:00Z");
const DEVICE = "abcdef0123456789abcdef0123456789";
const DAY = 86_400_000;
const trialRecord = (since, extra = {}) => ({ status: "active", licenseKey: `TRIAL-${DEVICE}`, plan: "trial", since, iat: NOW, verifiedAt: NOW, sig: "sig", ...extra });

test("essai : actif 7 jours après since, puis plus rien", () => {
  assert.equal(TRIAL_MS, 7 * DAY);
  assert.equal(isPlusActive(trialRecord(NOW - DAY), NOW), true);
  assert.equal(isPlusActive(trialRecord(NOW - TRIAL_MS), NOW), true);
  assert.equal(isPlusActive(trialRecord(NOW - TRIAL_MS - 1), NOW), false);
});

test("essai : sans début, début dans le futur ou sans signature, inactif", () => {
  assert.equal(isPlusActive(trialRecord(0), NOW), false);
  assert.equal(isPlusActive(trialRecord(NOW + DAY), NOW), false);
  assert.equal(isPlusActive(trialRecord(NOW - DAY, { sig: "" }), NOW), false);
});

test("trialEndsAt : fin de l'essai, 0 hors essai", () => {
  assert.equal(trialEndsAt(trialRecord(NOW)), NOW + TRIAL_MS);
  assert.equal(trialEndsAt({ plan: "monthly", since: NOW }), 0);
  assert.equal(trialEndsAt(null), 0);
});

test("normalizeLicenseKey : clé d'essai acceptée telle quelle, minuscules corrigées", () => {
  assert.equal(normalizeLicenseKey(`TRIAL-${DEVICE}`), `TRIAL-${DEVICE}`);
  assert.equal(normalizeLicenseKey(`trial-${DEVICE.toUpperCase()}`), `TRIAL-${DEVICE}`);
  assert.equal(normalizeLicenseKey("TRIAL-xyz"), null);
  assert.equal(normalizeLicenseKey("SP-AAAA-BBBB-CCCC-DDDD"), "SP-AAAA-BBBB-CCCC-DDDD");
});

const reply = (status, body) => async () => ({ ok: status < 400, status, json: async () => body });

test("startTrial : licence d'essai signée enregistrée telle que le serveur la renvoie", async () => {
  let sent = null;
  const fetchImpl = async (url, init) => {
    sent = JSON.parse(init.body);
    return reply(200, { valid: true, plan: "trial", key: `TRIAL-${DEVICE}`, since: NOW - 1000, iat: NOW, sig: "abc" })();
  };
  const result = await startTrial(fetchImpl, DEVICE, NOW);
  assert.equal(sent.action, "trial");
  assert.equal(sent.device, DEVICE);
  assert.equal(result.ok, true);
  assert.deepEqual(
    { key: result.record.licenseKey, plan: result.record.plan, since: result.record.since, sig: result.record.sig },
    { key: `TRIAL-${DEVICE}`, plan: "trial", since: NOW - 1000, sig: "abc" },
  );
});

test("startTrial : essai déjà fini, clé d'un autre appareil, panne", async () => {
  assert.deepEqual(await startTrial(reply(404, { valid: false, error: "trial_ended" }), DEVICE, NOW), { ok: false, error: "trial_ended" });
  assert.deepEqual(await startTrial(reply(200, { valid: true, plan: "trial", key: "TRIAL-ffffffffffffffff", since: NOW }), DEVICE, NOW), { ok: false, error: "invalid" });
  assert.deepEqual(await startTrial(reply(503, { error: "unavailable" }), DEVICE, NOW), { ok: false, error: "network" });
  assert.deepEqual(await startTrial(async () => { throw new Error("offline"); }, DEVICE, NOW), { ok: false, error: "network" });
});

test("verifyLicense : la revérification d'un essai garde le plan trial", async () => {
  const result = await verifyLicense(`TRIAL-${DEVICE}`, reply(200, { valid: true, plan: "trial", since: NOW - DAY, iat: NOW, sig: "s" }), NOW, DEVICE);
  assert.equal(result.ok, true);
  assert.equal(result.record.plan, "trial");
});

test("trialOnOtherAccount : seulement un essai lié, avec un autre compte connecté", async () => {
  const { trialOnOtherAccount } = await import("../js/plus.js");
  assert.equal(trialOnOtherAccount({ plan: "monthly", twitch: "42" }, "7"), false);
  assert.equal(trialOnOtherAccount(trialRecord(NOW, { twitch: "42" }), "42"), false);
  assert.equal(trialOnOtherAccount(trialRecord(NOW, { twitch: "42" }), "7"), true);
  assert.equal(trialOnOtherAccount(trialRecord(NOW, { twitch: "42" }), ""), false);
  assert.equal(trialOnOtherAccount(trialRecord(NOW), "7"), false);
});

test("startTrial : envoie le compte Twitch, garde le compte signé, refuse la connexion pleine", async () => {
  let sent = null;
  const fetchImpl = async (url, init) => {
    sent = JSON.parse(init.body);
    return reply(200, { valid: true, plan: "trial", key: `TRIAL-${DEVICE}`, since: NOW, twitch: "42", iat: NOW, sig: "s" })();
  };
  const result = await startTrial(fetchImpl, DEVICE, NOW, "42");
  assert.equal(sent.twitch, "42");
  assert.equal(result.record.twitch, "42");
  assert.deepEqual(await startTrial(reply(403, { valid: false, error: "trial_limit" }), DEVICE, NOW), { ok: false, error: "trial_limit" });
});

test("licenseMessage : la ligne twitch n'apparaît que pour un essai lié", async () => {
  const { licenseMessage } = await import("../js/license-sign.js");
  const base = { key: "K", device: "D", plan: "trial", since: 1, iat: 2 };
  assert.equal(licenseMessage(base).includes("twitch"), false);
  assert.equal(licenseMessage({ ...base, twitch: "42" }).endsWith("\ntwitch:42"), true);
});
