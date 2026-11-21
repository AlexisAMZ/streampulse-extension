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

test("lien de parrainage : page Plus de la langue, le lien désigne le parrain", async () => {
  const { isReferralCode, referralLink } = await import("../js/referral-data.js");
  assert.equal(isReferralCode("AMI-AB12CD"), true);
  for (const bad of ["", "ami-ab12cd", "AMI-AB12C", "AMI-AB12CDE", "AMI-AB 2CD", "AMI-AB12CD&x=1", null, undefined]) assert.equal(isReferralCode(bad), false, String(bad));
  assert.equal(referralLink("AMI-AB12CD", "fr"), "https://streampulse.tech/plus?ref=AMI-AB12CD");
  assert.equal(referralLink("AMI-AB12CD", "pt-BR"), "https://streampulse.tech/pt-br/plus?ref=AMI-AB12CD");
  assert.equal(referralLink("AMI-AB12CD", "de"), "https://streampulse.tech/de/plus?ref=AMI-AB12CD");
  assert.equal(referralLink("AMI-AB12CD", "zz"), "https://streampulse.tech/en/plus?ref=AMI-AB12CD");
  // Un code qui n'a pas la forme attendue ne finit jamais dans une URL.
  assert.equal(referralLink("AMI-AB12CD&evil=1", "fr"), "");
  assert.equal(referralLink("", "fr"), "");
});

test("carte parrainage de l'onglet Streamers : sobre et jamais insistante", async () => {
  const { shouldAskReferral, REFERRAL_ASK_FIRST_MS, REFERRAL_ASK_LATER_MS } = await import("../js/referral-data.js");
  const now = 100 * 86_400_000;
  const fresh = { firstSeen: now - REFERRAL_ASK_FIRST_MS };
  assert.equal(shouldAskReferral(fresh, { hasCode: false }, now), true);
  assert.equal(shouldAskReferral(fresh, { hasCode: false, plusUser: false }, now), false, "réservé aux abonnés Plus ou ayant testé l'essai");
  assert.equal(shouldAskReferral(fresh, { hasCode: false, plusUser: true }, now), true);
  assert.equal(shouldAskReferral({ firstSeen: now - REFERRAL_ASK_FIRST_MS + 1 }, { hasCode: false }, now), false, "trop tôt après l'installation");
  assert.equal(shouldAskReferral(null, { hasCode: false }, now), false);
  assert.equal(shouldAskReferral({ ...fresh, done: true }, { hasCode: false }, now), false, "« Non merci » est définitif");
  assert.equal(shouldAskReferral(fresh, { hasCode: true }, now), false, "déjà un code : plus besoin de la carte");
  assert.equal(shouldAskReferral({ ...fresh, snoozedUntil: now + 1 }, { hasCode: false }, now), false);
  assert.equal(shouldAskReferral({ ...fresh, snoozedUntil: now }, { hasCode: false }, now), true);
  assert.equal(REFERRAL_ASK_LATER_MS, 30 * 86_400_000);
});
