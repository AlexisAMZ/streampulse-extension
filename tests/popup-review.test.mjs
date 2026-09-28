import test from "node:test";
import assert from "node:assert/strict";

globalThis.navigator ??= { userAgent: "" };
const { shouldAsk, storeUrl, resolveVariant } = await import("../js/popup-review.js");
const DAY = 86_400_000;

test("la demande d'avis attend 14 jours, respecte « Plus tard » et « Non merci »", () => {
  const now = 100 * DAY;
  assert.equal(shouldAsk({ firstSeen: now - 13 * DAY }, now), false);
  assert.equal(shouldAsk({ firstSeen: now - 15 * DAY }, now), true);
  assert.equal(shouldAsk({ firstSeen: now - 15 * DAY, snoozedUntil: now + DAY }, now), false);
  assert.equal(shouldAsk({ firstSeen: now - 15 * DAY, done: true }, now), false);
  assert.equal(shouldAsk(null, now), false);
});

test("le bon store selon le navigateur", () => {
  assert.match(storeUrl("Mozilla/5.0 Firefox/130.0"), /addons\.mozilla\.org/);
  assert.match(storeUrl("Mozilla/5.0 Chrome/130 Safari Edg/130.0"), /microsoftedge/);
  assert.match(storeUrl("Mozilla/5.0 Chrome/130 Safari"), /chromewebstore/);
});

test("resolveVariant : drapeau inconnu ou absent → calendar", () => {
  assert.equal(resolveVariant(undefined), "calendar");
  assert.equal(resolveVariant({}), "calendar");
  assert.equal(resolveVariant({ variant: "nimportequoi" }), "calendar");
  assert.equal(resolveVariant({ variant: "momentum" }), "momentum");
  assert.equal(resolveVariant({ variant: "firstSuccess" }), "firstSuccess");
});

test("variante calendar : comportement historique intact", () => {
  const now = 100 * DAY;
  assert.equal(shouldAsk({ firstSeen: now - 13 * DAY }, now, { variant: "calendar" }), false);
  assert.equal(shouldAsk({ firstSeen: now - 15 * DAY }, now, { variant: "calendar", hasSuccess: false }), true);
});

test("variante momentum : 7 jours et un succès vécu exigé", () => {
  const now = 100 * DAY;
  assert.equal(shouldAsk({ firstSeen: now - 6 * DAY }, now, { variant: "momentum", hasSuccess: true }), false);
  assert.equal(shouldAsk({ firstSeen: now - 8 * DAY }, now, { variant: "momentum", hasSuccess: false }), false);
  assert.equal(shouldAsk({ firstSeen: now - 8 * DAY }, now, { variant: "momentum", hasSuccess: true }), true);
});

test("variante firstSuccess : 3 jours et un succès vécu exigé", () => {
  const now = 100 * DAY;
  assert.equal(shouldAsk({ firstSeen: now - 2 * DAY }, now, { variant: "firstSuccess", hasSuccess: true }), false);
  assert.equal(shouldAsk({ firstSeen: now - 4 * DAY }, now, { variant: "firstSuccess", hasSuccess: false }), false);
  assert.equal(shouldAsk({ firstSeen: now - 4 * DAY }, now, { variant: "firstSuccess", hasSuccess: true }), true);
});

test("les variantes respectent toujours « Plus tard » et « Non merci »", () => {
  const now = 100 * DAY;
  assert.equal(shouldAsk({ firstSeen: now - 8 * DAY, snoozedUntil: now + DAY }, now, { variant: "momentum", hasSuccess: true }), false);
  assert.equal(shouldAsk({ firstSeen: now - 8 * DAY, done: true }, now, { variant: "firstSuccess", hasSuccess: true }), false);
});
