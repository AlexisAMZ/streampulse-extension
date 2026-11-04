import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanCategoryQuery, normalizeKickCategories, normalizeTwitchCategories, rankCategories, searchCategories } from "../js/category-search.js";
import { explainRule, isKnownCategory, normalizeRule } from "../js/smart-alerts.js";

test("cleanCategoryQuery exige deux caractères", () => {
  assert.equal(cleanCategoryQuery(" g "), "");
  assert.equal(cleanCategoryQuery(" gta "), "gta");
});

test("normalisation Twitch et Kick", () => {
  const twitch = normalizeTwitchCategories({ data: [{ name: "Just Chatting", box_art_url: "https://x/{width}x{height}.jpg" }, { name: "" }] });
  assert.deepEqual(twitch, [{ platform: "twitch", name: "Just Chatting", image: "https://x/52x72.jpg" }]);
  const kick = normalizeKickCategories({ categories: [{ name: "Slots & Casino", banner: { srcset: "https://k/a.webp 408w, https://k/b.webp 800w" } }] });
  assert.equal(kick[0].name, "Slots & Casino");
  assert.equal(kick[0].image, "https://k/a.webp");
});

test("rankCategories : exact, préfixe, puis le reste, sans doublon", () => {
  const items = ["Grand Theft Auto V", "GTA", "Gta", "Mega GTA"].map((name) => ({ name }));
  assert.equal(rankCategories(items, "gta")[0].name, "GTA");
  assert.equal(rankCategories(items, "gta").length, 3);
});

test("searchCategories ignore les plateformes sans recherche", async () => {
  assert.deepEqual(await searchCategories("youtube", "gta", {}), []);
  const out = await searchCategories("twitch", "just", { twitch: async () => ({ data: [{ name: "Just Chatting" }] }) });
  assert.equal(out[0].name, "Just Chatting");
});

test("explainRule dit pourquoi la règle ne correspond pas", () => {
  const rule = normalizeRule({ games: ["GTA"], minViewers: 100 });
  const live = { isLive: true, game: "Grand Theft Auto V", title: "x", viewers: 500 };
  assert.deepEqual(explainRule(rule, live), { state: "mismatch", failed: ["games"] });
  assert.equal(explainRule({ ...rule, games: ["Grand Theft Auto V"] }, live).state, "match");
  assert.equal(explainRule(rule, { isLive: false }).state, "offline");
  assert.equal(explainRule({ ...rule, enabled: false }, live).state, "off");
});

test("isKnownCategory ignore casse et accents", () => {
  assert.equal(isKnownCategory("Poker", ["poker"]), true);
  assert.equal(isKnownCategory("", ["x"]), false);
});

test("l'alerte ciblée a son propre son, coupé avec les sons", async () => {
  const { SMART_SOUND, SOUND_PRESETS, SOUND_SYNTH, resolveSmartSound } = await import("../js/notification-sounds.js");
  assert.equal(resolveSmartSound({}), SMART_SOUND);
  assert.equal(resolveSmartSound({ soundsEnabled: false }), null);
  assert.ok(SOUND_SYNTH[SMART_SOUND].length > 0);
  assert.ok(!SOUND_PRESETS.includes(SMART_SOUND));
});

test("le son d'une règle est normalisé et peut être coupé", async () => {
  const { resolveSmartSound } = await import("../js/notification-sounds.js");
  assert.equal(normalizeRule({}).sound, "target");
  assert.equal(normalizeRule({ sound: "chime" }).sound, "chime");
  assert.equal(normalizeRule({ sound: "../hack" }).sound, "target");
  assert.equal(resolveSmartSound({}, "chime"), "chime");
  assert.equal(resolveSmartSound({}, "off"), null);
  assert.equal(resolveSmartSound({ soundsEnabled: false }, "chime"), null);
});

test("sons personnels : validation, plafond, suppression", async () => {
  const c = await import("../js/custom-sounds.js");
  assert.equal(c.checkSoundFile({ type: "audio/mpeg", size: 1000, seconds: 2 }), null);
  assert.equal(c.checkSoundFile({ type: "video/mp4", size: 1000, seconds: 2 }), "type");
  assert.equal(c.checkSoundFile({ type: "audio/wav", size: c.MAX_CUSTOM_BYTES + 1, seconds: 2 }), "size");
  assert.equal(c.checkSoundFile({ type: "audio/wav", size: 1000, seconds: 30 }), "length");
  assert.equal(c.checkSoundFile({ type: "audio/wav", size: 1000, seconds: 0 }), "length");
  const url = "data:audio/mpeg;base64,AAAA";
  let library = {};
  for (let i = 0; i < c.MAX_CUSTOM_SOUNDS; i += 1) {
    const added = c.addCustomSound(library, { name: `s${i}`, dataUrl: url, seconds: 1 }, `abcdef${i}0`);
    assert.ok(added.id);
    library = added.library;
  }
  assert.equal(c.addCustomSound(library, { name: "x", dataUrl: url, seconds: 1 }, "zzzzzz11").id, null);
  assert.equal(c.customSoundData(library, "custom:abcdef00").name, "s0");
  assert.equal(Object.keys(c.removeCustomSound(library, "custom:abcdef00")).length, 2);
  assert.equal(c.customSoundData({}, "custom:abcdef00"), null);
  // Une donnée qui n'est pas un audio base64 est écartée.
  assert.deepEqual(c.normalizeLibrary({ abcdef00: { name: "x", dataUrl: "javascript:alert(1)" } }), {});
});

test("une règle garde un son personnel valide, rejette un faux identifiant", () => {
  assert.equal(normalizeRule({ sound: "custom:abcdef12" }).sound, "custom:abcdef12");
  assert.equal(normalizeRule({ sound: "custom:../x" }).sound, "target");
});
