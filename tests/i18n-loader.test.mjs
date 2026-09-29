import test from "node:test";
import assert from "node:assert/strict";
import de from "../i18n/lang/de.js";
import en from "../i18n/lang/en.js";
import ja from "../i18n/lang/ja.js";

// js/i18n.js charge à la demande la langue choisie + l'anglais (repli), puis
// t() reste synchrone. Chaque test prend une instance neuve du module (URL
// différente) pour repartir d'un état vierge.

let instance = 0;
async function freshI18n() {
  instance += 1;
  return import(`../js/i18n.js?instance=${instance}`);
}

function stubChrome({ sendMessage = async () => ({ success: true }) } = {}) {
  const writes = [];
  globalThis.chrome = {
    runtime: { sendMessage },
    storage: {
      local: {
        get: async () => ({}),
        set: async (items) => {
          writes.push(items);
        },
      },
    },
    i18n: { getUILanguage: () => "en-US" },
  };
  return writes;
}

test("avant initI18n, t() rend la clé brute (aucune langue n'est chargée)", async () => {
  const i18n = await freshI18n();
  assert.deepEqual(i18n.getLoadedLanguages(), []);
  assert.equal(i18n.t("common.confirm"), "common.confirm");
});

test("initI18n charge seulement la langue choisie et l'anglais", async () => {
  const i18n = await freshI18n();
  assert.equal(await i18n.initI18n("de"), "de");
  assert.equal(i18n.getCurrentLanguage(), "de");
  assert.deepEqual(i18n.getLoadedLanguages().sort(), ["de", "en"]);
  assert.equal(i18n.t("common.confirm"), de.common.confirm);
  assert.equal(i18n.t("common.confirm", {}, "en"), en.common.confirm);
});

test("initI18n normalise la valeur stockée (pt_BR, EN-us)", async () => {
  const i18n = await freshI18n();
  assert.equal(await i18n.initI18n("pt_BR"), "pt-BR");
  const other = await freshI18n();
  assert.equal(await other.initI18n("EN-us"), "en");
  assert.deepEqual(other.getLoadedLanguages(), ["en"]);
});

test("une langue non chargée retombe sur l'anglais au lieu de la clé", async () => {
  const i18n = await freshI18n();
  await i18n.initI18n("fr");
  assert.equal(i18n.t("common.confirm", {}, "ko"), en.common.confirm);
  assert.equal(i18n.t("common.nope.missing"), "common.nope.missing");
});

test("setLanguage charge la langue avant de prévenir les abonnés", async () => {
  const writes = stubChrome();
  const i18n = await freshI18n();
  await i18n.initI18n("fr");
  const seen = [];
  i18n.onLanguageChange((lang) => seen.push([lang, i18n.t("common.confirm")]));
  assert.equal(await i18n.setLanguage("ja"), "ja");
  assert.deepEqual(seen, [["ja", ja.common.confirm]]);
  assert.equal(i18n.t("common.confirm"), ja.common.confirm);
  assert.deepEqual(writes, [], "le service worker a accepté : pas d'écriture de secours");
});

test("setLanguage ignore un code inconnu et la langue déjà active", async () => {
  stubChrome();
  const i18n = await freshI18n();
  await i18n.initI18n("fr");
  let calls = 0;
  i18n.onLanguageChange(() => {
    calls += 1;
  });
  assert.equal(await i18n.setLanguage("zz"), "fr");
  assert.equal(await i18n.setLanguage("fr"), "fr");
  assert.equal(calls, 0);
});

test("setLanguage écrit le stockage si le service worker ne répond pas", async () => {
  const writes = stubChrome({
    sendMessage: async () => {
      throw new Error("Receiving end does not exist");
    },
  });
  const i18n = await freshI18n();
  await i18n.initI18n("en");
  assert.equal(await i18n.setLanguage("de"), "de");
  assert.equal(writes.at(-1)?.betaGeneralPreferences?.language, "de");
});

test("deux changements rapides : le dernier clic gagne, même si l'autre langue charge plus lentement", async () => {
  stubChrome();
  const i18n = await freshI18n();
  await i18n.initI18n("es");
  const seen = [];
  i18n.onLanguageChange((lang) => seen.push(lang));
  // ko doit être importé, en est déjà en mémoire (repli) : en répond d'abord.
  const slow = i18n.setLanguage("ko");
  const fast = i18n.setLanguage("en");
  await Promise.all([slow, fast]);
  assert.equal(i18n.getCurrentLanguage(), "en");
  assert.deepEqual(seen, ["en"]);
});
