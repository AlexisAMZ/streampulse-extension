import { test } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { generateKeyPairSync, sign, webcrypto } from "node:crypto";
import { licenseMessage, signatureState, LICENSE_PUBLIC_JWK } from "../js/license-sign.js";
import { PLUS_KEY, verifyLicense } from "../js/plus.js";
import { PLUS_UNSIGNED_UNTIL, guardPlusRecord } from "../js/sw/license-guard.js";

const NOW = Date.parse("2026-11-01T12:00:00Z");
const KEY = "SP-ABCD-EFGH-JKLM-NPQR";
const DEVICE = "a".repeat(32);
const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const crypto = { subtle: webcrypto.subtle, jwk: publicKey.export({ format: "jwk" }) };

function signed(fields = {}, iat = NOW) {
  const base = { licenseKey: KEY, plan: "monthly", role: "", since: 1700000000000, referrals: 2, ...fields };
  const message = licenseMessage({ key: base.licenseKey, device: DEVICE, ...base, iat });
  const sig = sign("sha256", Buffer.from(message), { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return { ...base, status: "active", verifiedAt: iat, iat, sig };
}

function memoryStorage(initial = {}) {
  const data = { streamPulseDeviceId: DEVICE, ...initial };
  return {
    data,
    async get(key) {
      return key in data ? { [key]: data[key] } : {};
    },
    async set(values) {
      Object.assign(data, values);
    },
    async remove(key) {
      delete data[key];
    },
  };
}

const fetchReturning = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const offline = async () => {
  throw new Error("offline");
};

test("la clé publique embarquée est une clé ECDSA P-256", () => {
  assert.equal(LICENSE_PUBLIC_JWK.kty, "EC");
  assert.equal(LICENSE_PUBLIC_JWK.crv, "P-256");
});

test("signatureState : valide, falsifiée ou absente", async () => {
  const record = signed();
  assert.equal(await signatureState(record, DEVICE, crypto), "valid");
  for (const patch of [{ role: "admin" }, { plan: "lifetime" }, { referrals: 99 }, { since: 5 }, { licenseKey: "SP-ZZZZ-ZZZZ-ZZZZ-ZZZZ" }, { iat: NOW + 1 }]) {
    assert.equal(await signatureState({ ...record, ...patch }, DEVICE, crypto), "invalid", JSON.stringify(patch));
  }
  assert.equal(await signatureState(record, "b".repeat(32), crypto), "invalid");
  assert.equal(await signatureState({ ...record, sig: undefined }, DEVICE, crypto), "missing");
  assert.equal(await signatureState({ ...record, sig: "%%%" }, DEVICE, crypto), "invalid");
});

test("signatureState : un champ device ou key glissé dans l'enregistrement ne remplace pas ceux du navigateur", async () => {
  const record = signed();
  // Enregistrement recopié sur un autre navigateur, avec l'identifiant d'origine ajouté à la main.
  assert.equal(await signatureState({ ...record, device: DEVICE }, "b".repeat(32), crypto), "invalid");
  // Clé affichée remplacée, clé signée gardée dans un champ « key ».
  assert.equal(await signatureState({ ...record, licenseKey: "SP-ZZZZ-ZZZZ-ZZZZ-ZZZZ", key: KEY }, DEVICE, crypto), "invalid");
});

test("verifyLicense conserve iat et sig de la réponse signée", async () => {
  const payload = { valid: true, plan: "monthly", since: 1700000000000, referrals: 2, role: "", iat: NOW, sig: "abc" };
  const result = await verifyLicense(KEY, fetchReturning(200, payload), NOW, DEVICE);
  assert.equal(result.record.iat, NOW);
  assert.equal(result.record.sig, "abc");
});

test("guard : une licence correctement signée n'est pas touchée", async () => {
  const storage = memoryStorage({ [PLUS_KEY]: signed() });
  assert.equal(await guardPlusRecord({ storage, fetch: offline, now: NOW, crypto }), "ok");
  assert.ok(storage.data[PLUS_KEY]);
});

test("guard : un enregistrement forgé (role admin sur une vraie signature) est supprimé", async () => {
  const storage = memoryStorage({ [PLUS_KEY]: { ...signed(), role: "admin" } });
  assert.equal(await guardPlusRecord({ storage, fetch: offline, now: NOW, crypto }), "removed");
  assert.equal(PLUS_KEY in storage.data, false);
});

test("guard : sans signature, la clé repasse par le serveur (transition) et reçoit sa signature", async () => {
  const unsigned = { status: "active", licenseKey: KEY, plan: "monthly", verifiedAt: NOW - 1000 };
  const storage = memoryStorage({ [PLUS_KEY]: unsigned });
  const payload = { valid: true, plan: "monthly", since: 0, referrals: 0, role: "", iat: NOW, sig: "s" };
  assert.equal(await guardPlusRecord({ storage, fetch: fetchReturning(200, payload), now: NOW, crypto }), "upgraded");
  assert.equal(storage.data[PLUS_KEY].sig, "s");
  assert.equal(storage.data[PLUS_KEY].checkedAt, NOW);
});

test("guard : sans signature, une clé bidon refusée par le serveur est supprimée aussitôt", async () => {
  const forged = { status: "active", licenseKey: KEY, plan: "lifetime", role: "admin", verifiedAt: NOW };
  const storage = memoryStorage({ [PLUS_KEY]: forged });
  assert.equal(await guardPlusRecord({ storage, fetch: fetchReturning(404, { valid: false }), now: NOW, crypto }), "removed");
  assert.equal(PLUS_KEY in storage.data, false);
});

test("guard : hors ligne pendant la transition, l'enregistrement est gardé", async () => {
  const unsigned = { status: "active", licenseKey: KEY, plan: "monthly", verifiedAt: NOW };
  const storage = memoryStorage({ [PLUS_KEY]: unsigned });
  assert.equal(await guardPlusRecord({ storage, fetch: offline, now: NOW, crypto }), "kept");
  assert.deepEqual(storage.data[PLUS_KEY], unsigned);
});

test("guard : serveur qui ne signe pas encore, aucune réécriture en boucle", async () => {
  const unsigned = { status: "active", licenseKey: KEY, plan: "monthly", verifiedAt: NOW };
  const storage = memoryStorage({ [PLUS_KEY]: unsigned });
  const payload = { valid: true, plan: "monthly", since: 0, referrals: 0, role: "" };
  assert.equal(await guardPlusRecord({ storage, fetch: fetchReturning(200, payload), now: NOW, crypto }), "kept");
  assert.deepEqual(storage.data[PLUS_KEY], unsigned);
});

test("guard : après la transition, sans signature obtenue, la licence passe en « unverified » sans perdre la clé", async () => {
  const unsigned = { status: "active", licenseKey: KEY, plan: "lifetime", verifiedAt: NOW };
  const storage = memoryStorage({ [PLUS_KEY]: unsigned });
  const late = PLUS_UNSIGNED_UNTIL + 1000;
  assert.equal(await guardPlusRecord({ storage, fetch: offline, now: late, crypto }), "unverified");
  assert.equal(storage.data[PLUS_KEY].status, "unverified");
  assert.equal(storage.data[PLUS_KEY].licenseKey, KEY);
  assert.equal(globalThis.StreamPulsePlusRule.isPlusActive(storage.data[PLUS_KEY], late), false);
});

test("guard : aucune licence, rien à faire", async () => {
  assert.equal(await guardPlusRecord({ storage: memoryStorage(), fetch: offline, now: NOW, crypto }), "ok");
});

test("verifyLicense annonce la version de l'extension au serveur", async () => {
  globalThis.chrome = { runtime: { getManifest: () => ({ version: "26.10.25" }) } };
  let body;
  const spy = async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ valid: false }) };
  };
  try {
    await verifyLicense(KEY, spy, NOW, DEVICE);
  } finally {
    delete globalThis.chrome;
  }
  assert.equal(body.version, "26.10.25");
  assert.equal(body.device, DEVICE);
});
