import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { translatePlural } from "../js/sw/i18n.js";
import { validate } from "../scripts/i18n/commands/validate.mjs";

// Pluriels CLDR à l'exécution : popup (tp), service worker (translatePlural)
// et content scripts (__SP_I18N__.plural) choisissent la même forme.

let instance = 0;
async function freshI18n() {
  instance += 1;
  globalThis.chrome = {
    runtime: { sendMessage: async () => ({ success: true }) },
    storage: { local: { get: async () => ({}), set: async () => {} } },
    i18n: { getUILanguage: () => "en-US" },
  };
  return import(`../js/i18n.js?plural=${instance}`);
}

async function inlineApi() {
  const sandbox = {};
  new Function("window", await readFile(new URL("../js/inject/i18n-inline.js", import.meta.url), "utf8"))(sandbox);
  return sandbox.__SP_I18N__;
}

test("tp() suit les catégories ukrainiennes : 1 et 21 au singulier, 3 et 5 au pluriel", async () => {
  const i18n = await freshI18n();
  await i18n.initI18n("uk");
  assert.equal(i18n.tp("inject.badge.months", 1), "Підписка: 1 місяць");
  assert.equal(i18n.tp("inject.badge.months", 21), "Підписка: 21 місяць");
  assert.equal(i18n.tp("inject.badge.months", 3), "Підписка: 3 міс.");
  assert.equal(i18n.tp("inject.badge.months", 5), "Підписка: 5 міс.");
});

test("tp() en anglais et en japonais (une seule forme)", async () => {
  const i18n = await freshI18n();
  await i18n.initI18n("en");
  assert.equal(i18n.tp("popup.history.count", 1), "1 live");
  assert.equal(i18n.tp("popup.history.count", 0), "0 lives");
  assert.equal(i18n.tp("popup.history.count", 2), "2 lives");
  await i18n.setLanguage("ja");
  assert.equal(i18n.tp("popup.history.count", 1), i18n.tp("popup.history.count", 1, {}, "ja"));
  assert.match(i18n.tp("popup.history.count", 7), /7/);
});

test("tp() garde les autres variables et retombe sur la clé si le groupe n'existe pas", async () => {
  const i18n = await freshI18n();
  await i18n.initI18n("en");
  assert.equal(i18n.tp("popup.drops.historyMonth", 2, { month: "March" }), "March · 2 Drops");
  assert.equal(i18n.tp("popup.nope.group", 2), "popup.nope.group");
  // t() sur un groupe rend la forme générale plutôt que « [object Object] ».
  assert.equal(i18n.t("popup.history.count", { count: 4 }), "4 lives");
});

test("service worker et content scripts choisissent la même forme que le popup", async () => {
  const i18n = await freshI18n();
  await i18n.initI18n("ru");
  const api = await inlineApi();
  for (const n of [1, 2, 5, 21, 22, 25]) {
    assert.equal(translatePlural("ru", "inject.badge.months", n), i18n.tp("inject.badge.months", n), `ru ${n}`);
    assert.equal(api.plural("ru", "badge.months", n), i18n.tp("inject.badge.months", n), `inline ru ${n}`);
  }
  assert.equal(translatePlural("xx", "inject.badge.months", 2), "Subscribed for 2 months", "langue inconnue → anglais");
});

test("i18n:validate ne trouve aucune erreur dans les fichiers du dépôt", async () => {
  const log = console.log;
  const lines = [];
  console.log = (line) => lines.push(line);
  try {
    const code = await validate({ quiet: true });
    assert.equal(code, 0, lines.join("\n"));
  } finally {
    console.log = log;
  }
});
