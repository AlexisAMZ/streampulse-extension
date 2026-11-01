import test from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import { setImmediate } from "node:timers";
import { expectedEntries, findDuplicateKeys, keyMatcher, pluralCategoriesFor, buildTree, flattenTree } from "../scripts/i18n/lib/core.mjs";
import { fragments, mask, unmask } from "../scripts/i18n/lib/protect.mjs";
import { isLanguageNeutral, validateValue } from "../scripts/i18n/lib/validate.mjs";
import { deriveStates, record } from "../scripts/i18n/lib/state.mjs";
import { selectCandidates } from "../scripts/i18n/commands/translate.mjs";
import { translateXml, DeeplError } from "../scripts/i18n/lib/deepl.mjs";
import { parseVerdicts } from "../scripts/i18n/lib/review.mjs";
import { pseudoText } from "../scripts/i18n/commands/pseudo.mjs";
import { addToAggregator } from "../scripts/i18n/commands/locale.mjs";
import { scanHtml, scanJs } from "../scripts/i18n/commands/extract.mjs";

// Outillage de localisation (scripts/i18n) : masquage pour DeepL, règles de
// validation, statuts, sélection des clés à traduire, client DeepL.

const rules = (issues) => issues.map((i) => `${i.level}:${i.rule}`);

// ── Masquage ────────────────────────────────────────────────────────────────

test("mask/unmask : variables, balises imbriquées, liens et marques reviennent à l'octet près", () => {
  const samples = [
    "{{count}} Drops today with StreamPulse Clips",
    "<strong>Click</strong> the puzzle<br>icon of StreamPulse+ on Twitch",
    'Created by <a href="https://www.instagram.com/alexisamz">@AlexisAMZ</a> & friends',
    "Use %s or ${name} or {value}",
  ];
  for (const text of samples) {
    const { xml, slots } = mask(text);
    assert.equal(unmask(xml, slots, text), text, text);
  }
});

test("mask laisse le texte libre au traducteur et ne masque que les fragments protégés", () => {
  const { xml } = mask("Your clip is ready on Twitch");
  assert.equal(xml, 'Your clip is ready on <x i="0"/>');
  const html = mask("<strong>Click</strong> here");
  assert.equal(html.xml, '<t i="0">Click</t> here');
});

test("unmask restaure les balises autour du texte traduit, même réordonné par DeepL", () => {
  const source = "<strong>Click</strong> the icon of {{name}}";
  const { slots } = mask(source);
  const out = unmask('l&apos;icône de <x i="2"/>, <t i="0">cliquez</t>', slots, source);
  assert.equal(out, "l'icône de {{name}}, <strong>cliquez</strong>");
});

test("« Kick » n'est protégé qu'avec sa majuscule : le verbe se traduit", () => {
  assert.equal(fragments("Kick it").terms.has("Kick"), true);
  assert.equal(fragments("kick it").terms.has("Kick"), false);
  assert.equal(fragments("TWITCH and twitch").terms.get("Twitch"), 2);
});

// ── Validation ──────────────────────────────────────────────────────────────

test("une variable perdue ou une balise cassée est une erreur", () => {
  const base = { code: "fr", key: "popup.x" };
  assert.deepEqual(rules(validateValue({ ...base, source: "{{count}} lives", value: "lives" })), ["error:variables"]);
  assert.ok(rules(validateValue({ ...base, source: "<strong>Hi</strong>", value: "Salut" })).includes("error:html"));
  assert.deepEqual(rules(validateValue({ ...base, source: "Hello", value: "" })), ["error:empty"]);
});

test("terme protégé disparu : avertissement pour un texte humain, erreur pour une sortie automatique", () => {
  const args = { code: "fr", key: "popup.x", source: "Open Twitch", value: "Ouvrir la plateforme" };
  assert.deepEqual(rules(validateValue(args)), ["warning:protected-term"]);
  assert.deepEqual(rules(validateValue({ ...args, strict: true })), ["error:protected-term"]);
  // Déclinaison polonaise et alias coréen officiel acceptés.
  assert.deepEqual(rules(validateValue({ code: "pl", key: "k", source: "Open Twitch", value: "Otwórz Twitcha" })), []);
  assert.deepEqual(rules(validateValue({ code: "ko", key: "k", source: "Open CHZZK", value: "치지직 열기" })), []);
});

test("codes de langue et noms de plateforme imposés, avec l'exception coréenne de CHZZK", () => {
  assert.deepEqual(rules(validateValue({ code: "uk", key: "popup.htmlLang", source: "en", value: "en" })), ["error:lang-code"]);
  assert.deepEqual(rules(validateValue({ code: "fr", key: "platforms.kick", source: "Kick", value: "Coup" })).slice(0, 1), ["error:identical-required"]);
  assert.deepEqual(rules(validateValue({ code: "ko", key: "platforms.chzzk", source: "CHZZK", value: "치지직" })), []);
});

test("dans une forme de pluriel, {{count}} peut s'écrire en toutes lettres", () => {
  const args = { code: "ar", key: "popup.drops.rewards.one", source: "{{count}} reward", value: "مكافأة واحدة" };
  assert.deepEqual(rules(validateValue(args)).filter((r) => r.startsWith("error")), ["error:variables"]);
  assert.deepEqual(rules(validateValue({ ...args, plural: true })).filter((r) => r.startsWith("error")), []);
});

test("le glossaire signale un terme hors norme, pas un nom de produit", () => {
  const hit = validateValue({ code: "ru", key: "k", source: "Your badges", value: "Ваши бейджи" });
  assert.ok(rules(hit).includes("warning:glossary"));
  assert.ok(rules(hit).includes("warning:glossary-forbidden"));
  const product = validateValue({ code: "uk", key: "k", source: "StreamPulse Clips", value: "StreamPulse Clips" });
  assert.ok(!rules(product).includes("warning:glossary"));
});

test("une chaîne faite seulement de marques et de variables n'est jamais « non traduite »", () => {
  assert.equal(isLanguageNeutral("Twitch · {{count}}"), true);
  assert.equal(isLanguageNeutral("Open Twitch"), false);
});

test("les clés JSON dupliquées sont détectées, à leur chemin complet", () => {
  assert.deepEqual(findDuplicateKeys('{"a":{"b":"1","b":"2"},"c":"x"}'), ["a.b"]);
  assert.deepEqual(findDuplicateKeys('{"a":{"b":"1"},"c":{"b":"2"}}'), []);
});

// ── Pluriels ────────────────────────────────────────────────────────────────

test("catégories CLDR par langue : jamais un simple singulier/pluriel anglais", () => {
  assert.deepEqual(pluralCategoriesFor("uk"), ["one", "few", "many", "other"]);
  assert.deepEqual(pluralCategoriesFor("ja"), ["other"]);
  assert.deepEqual(pluralCategoriesFor("ar"), ["zero", "one", "two", "few", "many", "other"]);
});

test("un groupe anglais one/other s'attend sous les catégories de la langue cible", () => {
  const en = { a: { count: { one: "{{count}} live", other: "{{count}} lives" } }, b: "Hi" };
  const uk = expectedEntries(en, "uk");
  assert.deepEqual([...uk.keys()], ["a.count.one", "a.count.few", "a.count.many", "a.count.other", "b"]);
  assert.equal(uk.get("a.count.few").source, "{{count}} lives");
  const tree = buildTree(en, "ja", new Map([["a.count.other", "{{count}}件"], ["b", "やあ"]]));
  assert.deepEqual(tree, { a: { count: { other: "{{count}}件" } }, b: "やあ" });
  assert.deepEqual(flattenTree(tree).map((e) => e.key), ["a.count.other", "b"]);
});

// ── Statuts ─────────────────────────────────────────────────────────────────

test("statut déduit : manquante, obsolète, modifiée à la main, inchangée", () => {
  const expected = new Map(["a", "b", "c", "d"].map((k) => [k, { source: `new ${k}` }]));
  const values = new Map([["b", "B"], ["c", "C edited"], ["d", "D"]]);
  const records = {
    b: record("approved", "old b", "B", "legacy"),
    c: record("reviewed", "new c", "C", "deepl"),
    d: record("reviewed", "new d", "D", "deepl"),
  };
  const s = deriveStates(expected, values, records);
  assert.equal(s.get("a").status, "missing");
  assert.equal(s.get("b").status, "outdated");
  assert.equal(s.get("b").was, "approved");
  assert.equal(s.get("c").status, "pending");
  assert.equal(s.get("c").by, "manual");
  assert.equal(s.get("d").status, "reviewed");
});

test("translate ne reprend jamais une traduction approuvée ni un texte humain devenu obsolète", () => {
  const state = (key, status, by, was) => [key, { key, status, by, was, source: "x", value: status === "missing" ? undefined : "y" }];
  const locale = {
    states: new Map([
      state("a", "missing", null),
      state("b", "outdated", "legacy", "approved"),
      state("c", "outdated", "legacy", "reviewed"),
      state("d", "outdated", "deepl", "pending"),
      state("e", "reviewed", "deepl"),
    ]),
  };
  const plain = selectCandidates(locale, {});
  assert.deepEqual(plain.todo.map((s) => s.key), ["a", "d"]);
  assert.deepEqual(plain.kept.map((s) => s.key), ["b", "c"]);
  const forced = selectCandidates(locale, { "include-human": true, "overwrite-approved": true });
  assert.deepEqual(forced.todo.map((s) => s.key), ["a", "b", "c", "d"]);
});

test("sélection par préfixe de clé", () => {
  const match = keyMatcher(["popup.drops*", "bulk.title"]);
  assert.equal(match("popup.drops.rewards.one"), true);
  assert.equal(match("bulk.title"), true);
  assert.equal(match("bulk.titleX"), false);
});

// ── Client DeepL (fetch simulé) ─────────────────────────────────────────────

function fakeFetch(responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, body: init.body ? JSON.parse(init.body) : null, headers: init.headers });
    const next = responses.shift() ?? { status: 200 };
    const body = next.body ?? { translations: (JSON.parse(init.body).text ?? []).map((t) => ({ text: `T:${t}` })) };
    return {
      ok: next.status === 200,
      status: next.status,
      headers: { get: () => "0" },
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  };
  return { impl, calls };
}

test("DeepL : lots, glossaire, registre, et nouvelle tentative après un 429", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  process.env.DEEPL_API_KEY = "secret-test-key:fx";
  const { impl, calls } = fakeFetch([{ status: 429 }]);
  const texts = Array.from({ length: 45 }, (_, i) => `text ${i}`);
  const pending = translateXml(texts, { target: "UK", formality: "prefer_more", glossaryId: "g1", fetchImpl: impl });
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    t.mock.timers.tick(60000);
  }
  const out = await pending;
  assert.equal(out.length, 45);
  assert.equal(out[44], "T:text 44");
  assert.equal(calls.length, 3, "un 429 puis deux lots (40 + 5)");
  assert.ok(calls[0].url.startsWith("https://api-free.deepl.com/v2/translate"), "clé :fx → api-free");
  assert.equal(calls[1].body.glossary_id, "g1");
  assert.equal(calls[1].body.formality, "prefer_more");
  assert.equal(calls[1].body.tag_handling, "xml");
  delete process.env.DEEPL_API_KEY;
});

test("DeepL : quota épuisé = arrêt net, sans jamais exposer la clé", async () => {
  process.env.DEEPL_API_KEY = "secret-test-key:fx";
  const { impl } = fakeFetch([{ status: 456 }]);
  await assert.rejects(
    translateXml(["hello"], { target: "DE", fetchImpl: impl }),
    (error) => error instanceof DeeplError && error.fatal && !error.message.includes("secret-test-key"),
  );
  delete process.env.DEEPL_API_KEY;
  await assert.rejects(translateXml(["hello"], { target: "DE", fetchImpl: impl }), /DEEPL_API_KEY absent/);
});

// ── Relecture, pseudo-langue, ajout de langue, détection ────────────────────

test("les verdicts de relecture se lisent même entourés de texte", () => {
  const verdicts = parseVerdicts('Voici :\n[{"key":"a","verdict":"ok"},{"key":"b","verdict":"fix","suggestion":"B"},{"key":"c","verdict":"?"}]\nFin.');
  assert.deepEqual(verdicts.map((v) => v.key), ["a", "b"]);
});

test("pseudo-langue : texte accentué, allongé, encadré ; variables et marques intactes", () => {
  const out = pseudoText("Hello {{name}} on Twitch");
  assert.match(out, /^［Ĥéľľö \{\{name\}\} öñ Twitch·+］$/);
  assert.equal(pseudoText(""), "");
});

test("ajouter une langue : import et entrée dans l'agrégateur", () => {
  const source = 'import uk from "./lang/uk.js";\n\nexport const translations = {\n  uk,\n};\n';
  const out = addToAggregator(source, "zh-CN");
  assert.match(out, /import zhCN from "\.\/lang\/zh-CN\.js";/);
  assert.match(out, /"zh-CN": zhCN,\n\};/);
  assert.equal(addToAggregator(out, "zh-CN"), out, "idempotent");
});

test("détection des textes en dur : hors data-i18n seulement", () => {
  const html = '<p data-i18n="a.b">Texte <strong>gras</strong></p><button>Valider</button><input title="Aide" data-i18n-attr-title="x.y"><img alt="Logo du site">';
  assert.deepEqual(scanHtml(html).map((h) => h.text), ["Valider", 'alt="Logo du site"']);
  assert.deepEqual(scanJs('el.textContent = "Chargement";\nel.title = t("a.b");').map((h) => h.text), ["Chargement"]);
});
