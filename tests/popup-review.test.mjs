import test from "node:test";
import assert from "node:assert/strict";

globalThis.navigator ??= { userAgent: "" };
const { shouldAsk, storeUrl, resolveVariant, hasRecentSuccess } = await import("../js/popup-review.js");
const { rollingDayKeys } = await import("../js/recap-data.js");
const DAY = 86_400_000;

test("la demande d'avis attend la fenêtre de la variante, respecte « Plus tard » et « Non merci »", () => {
  const now = 100 * DAY;
  assert.equal(shouldAsk({ firstSeen: now - 6 * DAY }, now, { hasSuccess: true }), false);
  assert.equal(shouldAsk({ firstSeen: now - 8 * DAY }, now, { hasSuccess: true }), true);
  assert.equal(shouldAsk({ firstSeen: now - 8 * DAY, snoozedUntil: now + DAY }, now, { hasSuccess: true }), false);
  assert.equal(shouldAsk({ firstSeen: now - 8 * DAY, done: true }, now, { hasSuccess: true }), false);
  assert.equal(shouldAsk(null, now), false);
});

test("le bon store selon le navigateur", () => {
  assert.match(storeUrl("Mozilla/5.0 Firefox/130.0"), /addons\.mozilla\.org/);
  assert.match(storeUrl("Mozilla/5.0 Chrome/130 Safari Edg/130.0"), /microsoftedge/);
  assert.match(storeUrl("Mozilla/5.0 Chrome/130 Safari"), /chromewebstore/);
});

test("resolveVariant : défaut et drapeau inconnu → momentum, calendar reste choisi à distance", () => {
  assert.equal(resolveVariant(undefined), "momentum");
  assert.equal(resolveVariant({}), "momentum");
  assert.equal(resolveVariant({ variant: "nimportequoi" }), "momentum");
  assert.equal(resolveVariant({ variant: "calendar" }), "calendar");
  assert.equal(resolveVariant({ variant: "momentum" }), "momentum");
  assert.equal(resolveVariant({ variant: "firstSuccess" }), "firstSuccess");
});

test("défaut momentum : 7 jours et un succès récent exigé", () => {
  const now = 100 * DAY;
  assert.equal(shouldAsk({ firstSeen: now - 6 * DAY }, now), false);
  assert.equal(shouldAsk({ firstSeen: now - 8 * DAY }, now), false);
  assert.equal(shouldAsk({ firstSeen: now - 8 * DAY }, now, { hasSuccess: true }), true);
});

test("variante calendar : comportement historique intact, sans condition de succès", () => {
  const now = 100 * DAY;
  assert.equal(shouldAsk({ firstSeen: now - 13 * DAY }, now, { variant: "calendar" }), false);
  assert.equal(shouldAsk({ firstSeen: now - 15 * DAY }, now, { variant: "calendar", hasSuccess: false }), true);
});

test("variante momentum : 7 jours et un succès récent exigé", () => {
  const now = 100 * DAY;
  assert.equal(shouldAsk({ firstSeen: now - 6 * DAY }, now, { variant: "momentum", hasSuccess: true }), false);
  assert.equal(shouldAsk({ firstSeen: now - 8 * DAY }, now, { variant: "momentum", hasSuccess: false }), false);
  assert.equal(shouldAsk({ firstSeen: now - 8 * DAY }, now, { variant: "momentum", hasSuccess: true }), true);
});

test("variante firstSuccess : 3 jours et un succès récent exigé", () => {
  const now = 100 * DAY;
  assert.equal(shouldAsk({ firstSeen: now - 2 * DAY }, now, { variant: "firstSuccess", hasSuccess: true }), false);
  assert.equal(shouldAsk({ firstSeen: now - 4 * DAY }, now, { variant: "firstSuccess", hasSuccess: false }), false);
  assert.equal(shouldAsk({ firstSeen: now - 4 * DAY }, now, { variant: "firstSuccess", hasSuccess: true }), true);
});

test("les variantes respectent toujours « Plus tard » et « Non merci »", () => {
  const now = 100 * DAY;
  assert.equal(shouldAsk({ firstSeen: now - 8 * DAY, snoozedUntil: now + DAY }, now, { variant: "momentum", hasSuccess: true }), false);
  assert.equal(shouldAsk({ firstSeen: now - 4 * DAY, done: true }, now, { variant: "firstSuccess", hasSuccess: true }), false);
});

test("plafond : au plus trois affichages, même éligible", () => {
  const now = 100 * DAY;
  assert.equal(shouldAsk({ firstSeen: now - 8 * DAY, askCount: 2 }, now, { hasSuccess: true }), true);
  assert.equal(shouldAsk({ firstSeen: now - 8 * DAY, askCount: 3 }, now, { hasSuccess: true }), false);
  assert.equal(shouldAsk({ firstSeen: now - 15 * DAY, askCount: 3 }, now, { variant: "calendar" }), false);
});

test("hasRecentSuccess : une activité d'aujourd'hui ou d'hier compte, pas plus vieille", () => {
  const now = new Date(2026, 9, 6, 12, 0, 0);
  const [today, yesterday] = rollingDayKeys(2, now);
  const old = rollingDayKeys(4, now)[3];
  assert.equal(hasRecentSuccess([{ [today]: { "twitch:chaine": {} } }], now), true);
  assert.equal(hasRecentSuccess([{ [yesterday]: { "twitch:chaine": {} } }], now), true);
  assert.equal(hasRecentSuccess([{ [old]: { "twitch:chaine": {} } }], now), false);
  assert.equal(hasRecentSuccess([{ [today]: {} }], now), false);
  assert.equal(hasRecentSuccess([{}, { [today]: { CLAIM: 50 } }], now), true);
  assert.equal(hasRecentSuccess([], now), false);
  assert.equal(hasRecentSuccess([undefined], now), false);
});

test("hasRecentSuccess : la fenêtre se règle (2 jours par défaut)", () => {
  const now = new Date(2026, 9, 6, 12, 0, 0);
  const threeDaysAgo = rollingDayKeys(4, now)[3];
  assert.equal(hasRecentSuccess([{ [threeDaysAgo]: { CLAIM: 50 } }], now), false);
  assert.equal(hasRecentSuccess([{ [threeDaysAgo]: { CLAIM: 50 } }], now, { withinDays: 4 }), true);
});
