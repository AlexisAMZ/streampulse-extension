import { test } from "node:test";
import assert from "node:assert/strict";
import { EARNINGS_REFRESH_MS, normalizeEarnings, shouldRefreshEarnings, isPaypalAddress } from "../js/referral-data.js";

test("gains renvoyés par le serveur : bornés et complétés", () => {
  assert.deepEqual(
    normalizeEarnings({ earnings: { earnedCents: 700, paidCents: 500, balanceCents: 200, paypal: "lea@mail.fr" }, payoutMinCents: 1000 }, 42),
    { earnedCents: 700, paidCents: 500, balanceCents: 200, paypal: "lea@mail.fr", payoutMinCents: 1000, fetchedAt: 42 },
  );
  assert.deepEqual(normalizeEarnings({}, 1), { earnedCents: 0, paidCents: 0, balanceCents: 0, paypal: "", payoutMinCents: 1000, fetchedAt: 1 });
  assert.equal(normalizeEarnings({ earnings: { earnedCents: -5, balanceCents: "x" } }, 1).earnedCents, 0);
  assert.equal(normalizeEarnings({ earnings: { paypal: 42 } }, 1).paypal, "");
});

test("rafraîchissement des gains : au plus toutes les 6 heures", () => {
  const now = 10 * EARNINGS_REFRESH_MS;
  assert.equal(shouldRefreshEarnings(null, now), true);
  assert.equal(shouldRefreshEarnings({ fetchedAt: now - 1000 }, now), false);
  assert.equal(shouldRefreshEarnings({ fetchedAt: now - EARNINGS_REFRESH_MS - 1 }, now), true);
  assert.equal(EARNINGS_REFRESH_MS, 6 * 60 * 60 * 1000);
});

test("adresse PayPal : forme d'un e-mail", () => {
  assert.equal(isPaypalAddress("lea@mail.fr"), true);
  assert.equal(isPaypalAddress(" lea@mail.fr "), true);
  assert.equal(isPaypalAddress("lea@"), false);
  assert.equal(isPaypalAddress(""), false);
});
