import test from "node:test";
import assert from "node:assert/strict";
import { extensionPage } from "./helpers/extension-page.mjs";

test("identity: all dynamic copy refreshes without losing drafts or binding twice", async (t) => {
  const result = await extensionPage("popup", async ({ $, module, calls, tick }) => {
    const { initI18n, setLanguage, applyTranslations, onLanguageChange, t } = await module("i18n.js");
    await initI18n("en");
    document.documentElement.lang = "en";
    applyTranslations(document);
    const { initIdentity } = await module("popup-identity.js");
    const options = {
      getRecord: () => ({ role: "admin", plan: "lifetime", referrals: 3 }), isPlus: () => true, openPlus: () => {},
      stored: { userProfile: { handle: "Viewer" }, streamPulseReferralCode: "TEST-CODE", streamPulseReferralEarnings: { earnedCents: 2400, paidCents: 1000, balanceCents: 1400, paypal: "stored@example.test", payoutMinCents: 1000, fetchedAt: Date.now() }, streamPulseCosmetics: { badgeFx: "tenure", nameFx: "fire" } },
    };
    initIdentity(options);
    initIdentity(options);
    // The parent's static translation pass may run after module subscribers.
    onLanguageChange(() => { applyTranslations(document); document.documentElement.lang = t("onboarding.htmlLang"); });
    const snapshot = () => ({
      effect: document.querySelector('#cosmetic-name-fx [data-value="fire"]').title,
      rank: $("identity-rank").textContent,
      tier: $("cosmetic-tenure").textContent,
      referral: $("referral-tiers").textContent,
      earnings: $("referral-earned").textContent,
      balance: $("referral-balance").textContent,
      status: $("referral-status").textContent,
    });
    const english = snapshot();
    const paypal = $("referral-paypal");
    paypal.value = "draft@example.test";
    paypal.dispatchEvent(new Event("input", { bubbles: true }));
    $("pref-pseudo-input").value = "Unsaved pseudo";
    $("referral-copy").click();
    await tick();
    await setLanguage("fr");
    await tick();
    const french = snapshot();
    const draft = paypal.value;
    const pseudo = $("pref-pseudo-input").value;
    const name = $("cosmetic-name").textContent;
    const copied = $("referral-status").textContent === t("popup.referral.copied");
    await setLanguage("en");
    await tick();
    const back = snapshot();
    const before = calls.filter((call) => call.type === "storage.set").length;
    document.querySelector('#cosmetic-name-fx [data-value="gold"]').click();
    await tick();
    return { english, french, back, draft, pseudo, name, copied, copyCalls: calls.filter((call) => call.type === "clipboard").length, effectWrites: calls.filter((call) => call.type === "storage.set").length - before };
  });
  await t.test("effects, ranks, tenure, referral, currency and status are retranslated", () => {
    for (const key of ["effect", "rank", "tier", "referral", "earnings", "balance"]) {
      assert.notEqual(result.english[key], result.french[key], key);
      assert.equal(result.back[key], result.english[key], key);
    }
    assert.equal(result.copied, true);
  });
  await t.test("blurred PayPal and pseudo drafts survive, actual preview name wins over static translation", () => {
    assert.equal(result.draft, "draft@example.test");
    assert.equal(result.pseudo, "Unsaved pseudo");
    assert.equal(result.name, "Viewer");
  });
  await t.test("one binding per action despite repeated initialization and translation", () => {
    assert.equal(result.copyCalls, 1);
    assert.equal(result.effectWrites, 1);
  });
});
