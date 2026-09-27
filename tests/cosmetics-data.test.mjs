import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BADGE_FX, NAME_FX, FOUNDER_FX, REFERRAL_FX, COLOR_FX, LEGACY_FX, TENURE_STYLES, TENURE_TIERS, TEXTURE_FX, fxLock, normalizeCosmetics, rankOf, tenureTier, visibleFx } from "../js/cosmetics-data.js";

/** Tableau littéral `var NOM = [...]` d'un script classique. */
function arrayIn(file, name) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const match = new RegExp(`var ${name} = \\[([^\\]]*)\\]`).exec(source);
  assert.ok(match, `${name} introuvable dans ${file}`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

for (const file of ["js/inject/twitch-badge.js", "js/inject/settings-drawer.js"]) {
  test(`${file} connaît les mêmes effets que le popup`, () => {
    assert.deepEqual(arrayIn(file, "BADGE_FX"), [...BADGE_FX]);
    assert.deepEqual(arrayIn(file, "NAME_FX"), [...NAME_FX]);
  });
}

test("chaque effet a son rendu CSS", () => {
  const css = ["css/popup.css", "css/fx-effects.css", "css/inject/twitch-badge.css"]
    .map((file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8"))
    .join("\n");
  // « tenure » et « pager » ne sont pas des effets mais les styles d'ancienneté (voir le test des tuiles).
  const effects = BADGE_FX.filter((fx) => !TENURE_STYLES[fx]);
  for (const fx of effects) assert.match(css, new RegExp(`sp-chat-badge--fx-${fx}\\b`), `badge ${fx}`);
  for (const fx of effects) assert.match(css, new RegExp(`\\.cosmetic-badge\\.sp-fx-${fx}\\b`), `aperçu ${fx}`);
  for (const fx of NAME_FX) assert.match(css, new RegExp(`\\.sp-paint--${fx}\\b`), `pseudo ${fx}`);
});

test("sans StreamPulse+, tout effet est verrouillé", () => {
  assert.equal(fxLock("pulse", {}), "plus");
  assert.equal(fxLock("", {}), "");
});

test("les effets d'ambassadeur suivent le nombre de filleuls", () => {
  assert.equal(fxLock("ambassador", { plus: true, referrals: 0 }), "referrals");
  assert.equal(fxLock("ambassador", { plus: true, referrals: 1 }), "");
  assert.equal(fxLock("halo", { plus: true, referrals: 2 }), "referrals");
  assert.equal(fxLock("halo", { plus: true, referrals: 3 }), "");
  assert.equal(REFERRAL_FX.halo, 3);
});

test("le fondateur a tout, les autres jamais ses effets", () => {
  const founder = { plus: true, role: "admin", referrals: 0 };
  for (const fx of [...BADGE_FX, ...NAME_FX]) assert.equal(fxLock(fx, founder), "", fx);
  for (const fx of FOUNDER_FX) assert.equal(fxLock(fx, { plus: true, referrals: 99 }), "founder", fx);
});

test("les effets du fondateur ne sont proposés qu'à lui", () => {
  assert.ok(!visibleFx(BADGE_FX, { plus: true }).includes("crown"));
  assert.ok(!visibleFx(NAME_FX, { plus: true, role: "partner" }).includes("founder"));
  assert.ok(visibleFx(NAME_FX, { role: "admin" }).includes("founder"));
});

test("rang : fondateur, puis ambassadeur dès un filleul", () => {
  assert.equal(rankOf({ role: "admin" }), "founder");
  assert.equal(rankOf({ referrals: 1 }), "ambassador");
  assert.equal(rankOf({ referrals: 0 }), "");
  assert.equal(rankOf(undefined), "");
});

test("un effet inconnu est oublié", () => {
  assert.deepEqual(normalizeCosmetics({ badgeFx: "crown", nameFx: "nope" }), { badgeFx: "crown", nameFx: "" });
  // Jamais choisi : badge d'ancienneté par défaut ; « Aucun » choisi reste "".
  assert.deepEqual(normalizeCosmetics(null), { badgeFx: "tenure", nameFx: "" });
  assert.deepEqual(normalizeCosmetics({ nameFx: "gold" }), { badgeFx: "tenure", nameFx: "gold" });
  assert.deepEqual(normalizeCosmetics({ badgeFx: "", nameFx: "" }), { badgeFx: "", nameFx: "" });
});

const MONTH = 30.44 * 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

test("tuile d'ancienneté : paliers de 1 mois à 4 ans, à vie à part", () => {
  const at = (months) => tenureTier("monthly", NOW - months * MONTH - 1000, NOW);
  assert.equal(at(0), "m1");
  assert.equal(at(2), "m1");
  assert.equal(at(3), "m3");
  assert.equal(at(8), "m6");
  assert.equal(at(11), "m9");
  assert.equal(at(12), "y1");
  assert.equal(at(18), "y1h");
  assert.equal(at(30), "y2");
  assert.equal(at(47), "y3");
  assert.equal(at(80), "y4");
  assert.equal(tenureTier("monthly", 0, NOW), "m1"); // date inconnue : premier palier
  assert.equal(tenureTier("lifetime", NOW, NOW), "life");
  assert.equal(tenureTier("", NOW, NOW), "");
});

for (const file of ["js/inject/twitch-badge.js", "js/inject/settings-drawer.js"]) {
  test(`${file} calcule les tuiles comme le popup`, () => {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const match = /var TENURE_TIERS = (\[.*?\]\]);/.exec(source);
    assert.ok(match, `TENURE_TIERS introuvable dans ${file}`);
    assert.deepEqual(JSON.parse(match[1]), TENURE_TIERS.map((tier) => [...tier]));
    const styles = /var TENURE_STYLES = (\{[^}]*\});/.exec(source);
    assert.ok(styles, `TENURE_STYLES introuvable dans ${file}`);
    assert.deepEqual(JSON.parse(styles[1].replace(/(\w+):/g, '"$1":')), { ...TENURE_STYLES });
  });
}

test("chaque tuile et chaque texture a son rendu CSS", () => {
  const css = readFileSync(new URL("../css/fx-effects.css", import.meta.url), "utf8");
  for (const style of Object.values(TENURE_STYLES)) {
    for (const key of [...TENURE_TIERS.map(([, tier]) => tier), "life"]) {
      assert.match(css, new RegExp(`\\.sp-tier--${style}\\.sp-tier-${key}\\b`), `${style} ${key}`);
    }
  }
  for (const fx of TEXTURE_FX) {
    assert.ok(BADGE_FX.includes(fx) && NAME_FX.includes(fx), fx);
    assert.match(css, new RegExp(`\\.sp-paint--${fx}\\b`), `texture ${fx}`);
  }
});

test("un seul nuancier pour le logo et le pseudo, chaque couleur rendue des deux côtés", () => {
  const css = readFileSync(new URL("../css/fx-effects.css", import.meta.url), "utf8");
  for (const fx of COLOR_FX) {
    assert.ok(BADGE_FX.includes(fx) && NAME_FX.includes(fx), fx);
    assert.match(css, new RegExp(`\\.cosmetic-badge\\.sp-fx-${fx}\\b`), `logo ${fx}`);
    assert.match(css, new RegExp(`\\.sp-paint--${fx}\\b`), `pseudo ${fx}`);
  }
  for (const gone of ["pulse", "bounce", "spin", "neon", "glitch", "prism"]) {
    assert.ok(!BADGE_FX.includes(gone) && !NAME_FX.includes(gone), gone);
  }
});

test("effets retirés : Prisme devient Arc-en-ciel, les animations redeviennent classiques", () => {
  assert.equal(LEGACY_FX.prism, "rainbow");
  assert.deepEqual(normalizeCosmetics({ badgeFx: "prism", nameFx: "neon" }), { badgeFx: "rainbow", nameFx: "" });
  assert.deepEqual(normalizeCosmetics({ badgeFx: "pulse", nameFx: "gold" }), { badgeFx: "", nameFx: "gold" });
});
