import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BADGE_FX, NAME_FX, FOUNDER_FX, REFERRAL_FX, fxLock, normalizeCosmetics, rankOf, visibleFx } from "../js/cosmetics-data.js";

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
  for (const fx of BADGE_FX) assert.match(css, new RegExp(`sp-chat-badge--fx-${fx}\\b`), `badge ${fx}`);
  for (const fx of BADGE_FX) assert.match(css, new RegExp(`\\.cosmetic-badge\\.sp-fx-${fx}\\b`), `aperçu ${fx}`);
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
  assert.deepEqual(normalizeCosmetics(null), { badgeFx: "", nameFx: "" });
});
