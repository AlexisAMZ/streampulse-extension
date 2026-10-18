import test from "node:test";
import assert from "node:assert/strict";
import "../js/inject/kick-claim-rules.js";

const {
  readLabels,
  isDropClaimButton,
  isDailyClaimButton,
  isDailyRewardReady,
  parseEarnedPoints,
} = globalThis.StreamPulseKickClaim;

// Extrait du payload next-intl relevé sur kick.com (compte connecté, français,
// octobre 2026) : les guillemets y sont échappés, la page les sert ainsi.
const FR_PAYLOAD =
  'opos de ce drop\\",\\"claim_reward\\":\\"Réclamer\\",\\"claim_reward_named\\":\\"Réclamer la récompense {name}\\",\\"claimed\\":\\"Réclamé\\"' +
  ' \\"gamification\\":{\\"claim_cta\\":\\"Récupérer\\",\\"claim_cta_claimed\\":\\"Réclamé\\",\\"claim_cta_not_ready\\":\\"Regardez encore {minutes} minutes\\"';
const FR = readLabels(FR_PAYLOAD);

const enabled = (over) => ({ aria: "", text: "", disabled: false, visible: true, ...over });

test("readLabels lit les libellés de la langue servie par Kick", () => {
  assert.equal(FR.dropNamed.prefix, "Réclamer la récompense");
  assert.equal(FR.dropNamed.suffix, "");
  assert.equal(FR.dailyClaim, "Récupérer");
});

test("readLabels ne confond pas claim_cta avec claim_cta_claimed", () => {
  const labels = readLabels('\\"claim_cta_claimed\\":\\"Réclamé\\",\\"claim_cta\\":\\"Récupérer\\"');
  assert.equal(labels.dailyClaim, "Récupérer");
});

test("readLabels accepte un JSON sans échappement et un nom placé en tête", () => {
  const labels = readLabels('"claim_reward_named":"{name}を受け取る","claim_cta":"受け取る"');
  assert.deepEqual(labels.dropNamed, { prefix: "", suffix: "を受け取る" });
  assert.equal(labels.dailyClaim, "受け取る");
});

test("readLabels sans payload rend des libellés vides", () => {
  assert.deepEqual(readLabels(""), { dropNamed: null, dailyClaim: "" });
});

test("le bouton de Drop se reconnaît à son aria-label nommé", () => {
  assert.equal(isDropClaimButton(enabled({ aria: "Réclamer la récompense MurlocJam Emote", text: "Réclamer" }), FR), true);
});

test("un bouton désactivé, caché ou sans nom de récompense n'est pas un Drop", () => {
  const aria = "Réclamer la récompense MurlocJam Emote";
  assert.equal(isDropClaimButton(enabled({ aria, disabled: true }), FR), false);
  assert.equal(isDropClaimButton(enabled({ aria, visible: false }), FR), false);
  assert.equal(isDropClaimButton(enabled({ aria: "Réclamer la récompense " }), FR), false);
  assert.equal(isDropClaimButton(enabled({ text: "Réclamer" }), FR), false);
});

test("sans libellés de Kick, le repli reconnaît « verbe + nom » en anglais", () => {
  const none = readLabels("");
  assert.equal(isDropClaimButton(enabled({ aria: "Claim reward MurlocJam Emote" }), none), true);
  assert.equal(isDropClaimButton(enabled({ aria: "Claimed" }), none), false);
  assert.equal(isDropClaimButton(enabled({ aria: "Fermer" }), none), false);
});

test("le bouton de la récompense quotidienne porte le libellé exact", () => {
  assert.equal(isDailyClaimButton(enabled({ text: "Récupérer" }), FR), true);
  assert.equal(isDailyClaimButton(enabled({ text: "Récupérer", disabled: true }), FR), false);
  assert.equal(isDailyClaimButton(enabled({ text: "Réclamé" }), FR), false);
  assert.equal(isDailyClaimButton(enabled({ text: "Fermer", aria: "Fermer" }), FR), false);
});

test("sans libellés de Kick, le repli reconnaît Claim mais pas Claimed", () => {
  const none = readLabels("");
  assert.equal(isDailyClaimButton(enabled({ text: "Claim" }), none), true);
  assert.equal(isDailyClaimButton(enabled({ text: "Claimed" }), none), false);
});

test("la récompense est prête quand l'animation d'appel est affichée", () => {
  const cta = "https://kick.com/static/rewards/reward-available-CTA.webm";
  assert.equal(isDailyRewardReady([cta]), true);
  assert.equal(isDailyRewardReady(["https://kick.com/static/rewards/daily-rewards/idle.webm"]), false);
  assert.equal(isDailyRewardReady([]), false);
});

test("parseEarnedPoints lit l'animation « +N » du compteur de points", () => {
  assert.equal(parseEarnedPoints("+10"), 10);
  assert.equal(parseEarnedPoints(" + 1 000 "), 1000);
  assert.equal(parseEarnedPoints("10"), 0);
  assert.equal(parseEarnedPoints("-50"), 0);
  assert.equal(parseEarnedPoints("+14,4 k"), 0);
  assert.equal(parseEarnedPoints("+999999999"), 0);
});
