import { before, test } from "node:test";
import assert from "node:assert/strict";
import { applyTranslations, initI18n } from "../js/i18n.js";

// Le parseur HTML minuscule les noms d'attributs : data-i18n-attr-ariaLabel
// (forme historique) arrive dans le dataset comme "i18nAttrArialabel", et le
// bug écrivait setAttribute("arialabel") — un attribut que rien ne lit, donc
// des boutons sans nom accessible dans toutes les pages. Ces tests simulent
// ce que le navigateur produit réellement pour les deux formes. Les chaînes se
// chargent à l'init : en anglais, t("common.confirm") => "Confirm".

before(async () => {
  await initI18n("en");
});

function fakeElement(dataset) {
  const attributes = {};
  return {
    dataset,
    value: "",
    setAttribute(name, val) {
      attributes[name] = val;
    },
    attributes,
  };
}

function fakeRoot(elements) {
  return { querySelectorAll: () => elements };
}

function applyDataset(dataset) {
  const element = fakeElement(dataset);
  applyTranslations(fakeRoot([element]));
  return element;
}

test("la forme lue data-i18n-attr-aria-label produit bien aria-label", () => {
  const element = applyDataset({ i18nAttrAriaLabel: "common.confirm" });
  assert.equal(element.attributes["aria-label"], "Confirm");
});

test("l'ancienne forme minuscule data-i18n-attr-arialabel produit aria-label aussi", () => {
  const element = applyDataset({ i18nAttrArialabel: "common.confirm" });
  assert.equal(element.attributes["arialabel"], undefined);
  assert.equal(element.attributes["aria-label"], "Confirm");
});

test("placeholder, title et value continuent de fonctionner", () => {
  const element = applyDataset({
    i18nAttrPlaceholder: "popup.placeholders.twitch",
    i18nAttrTitle: "common.confirm",
    i18nAttrValue: "common.confirm",
  });
  assert.ok(element.attributes["placeholder"]);
  assert.equal(element.attributes["title"], "Confirm");
  assert.equal(element.attributes["value"], "Confirm");
  assert.equal(element.value, "Confirm");
});

test("un élément avec data-i18n-attr-aria-label est bien sélectionné dans le code source", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../js/i18n.js", import.meta.url), "utf8");
  assert.ok(
    source.includes("[data-i18n-attr-aria-label]") && source.includes("[data-i18n-attr-arialabel]"),
    "le sélecteur doit couvrir les deux formes (valeur d'attribut CSS sensible à la casse)",
  );
  assert.ok(!source.includes("[data-i18n-attr-ariaLabel]"), "l'ancien sélecteur camelCase ne matchait jamais le HTML");
});
