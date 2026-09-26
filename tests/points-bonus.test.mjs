import test from "node:test";
import assert from "node:assert/strict";
import { CHEST_PATH, isBonusChest, pickBonusChest } from "../js/points-bonus.js";

// Descriptions relevées sur twitch.tv (compte connecté, SUBtember 2026).
const giftButtonFr = {
  label: "Cadeau : abonnements bonus",
  dataTarget: "gift-button",
  className: "ScCoreButton-sc-ocjdkq-0 iQpwXl InjectLayout-sc-1i43xsx-0",
  inPointsSummary: false,
};
const giftButtonEn = { ...giftButtonFr, label: "Gift Bonus Subs" };
const balanceButton = {
  label: "Soldes de Bits et de points",
  className: "ScCoreButton-sc-ocjdkq-0 FISKx",
  inPointsSummary: true,
};
const chest = {
  label: "Claim Bonus",
  className: "ScCoreButton-sc-ocjdkq-0 claimable-bonus",
  hasBonusIcon: true,
  inPointsSummary: true,
};

test("le bouton cadeau du SUBtember n'est jamais la caisse, en anglais comme en français", () => {
  assert.equal(isBonusChest(giftButtonEn), false);
  assert.equal(isBonusChest(giftButtonFr), false);
});

test("un bouton cadeau glissé dans la zone des points reste exclu", () => {
  assert.equal(isBonusChest({ ...giftButtonEn, inPointsSummary: true }), false);
});

test("un libellé « Bonus » hors de la zone des points ne suffit pas", () => {
  assert.equal(isBonusChest({ label: "Claim Bonus", inPointsSummary: false }), false);
});

test("le compteur de points n'est pas la caisse", () => {
  assert.equal(isBonusChest(balanceButton), false);
});

test("la caisse est reconnue par sa classe, son icône, son tracé ou son libellé", () => {
  assert.equal(isBonusChest(chest), true);
  assert.equal(isBonusChest({ className: "claimable-bonus", inPointsSummary: true }), true);
  assert.equal(isBonusChest({ hasBonusIcon: true, inPointsSummary: true }), true);
  assert.equal(isBonusChest({ hasChestPath: true, inPointsSummary: true }), true);
  assert.equal(isBonusChest({ label: "Récupérer le bonus", inPointsSummary: true }), true);
});

test("une caisse désactivée n'est pas cliquée", () => {
  assert.equal(isBonusChest({ ...chest, disabled: true }), false);
});

test("pickBonusChest saute le bouton cadeau placé avant la caisse dans la page", () => {
  const buttons = [giftButtonEn, balanceButton, chest];
  assert.equal(pickBonusChest(buttons), 2);
});

test("pickBonusChest renvoie -1 quand aucune caisse n'est présente", () => {
  assert.equal(pickBonusChest([giftButtonEn, balanceButton]), -1);
  assert.equal(pickBonusChest([]), -1);
});

test("le tracé du coffre reste celui que Twitch dessine", () => {
  assert.equal(CHEST_PATH, "M13 12h-2v2h2v-2Z");
});
