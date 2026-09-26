import test from "node:test";
import assert from "node:assert/strict";

globalThis.navigator ??= { userAgent: "" };
const { shouldAsk, storeUrl } = await import("../js/popup-review.js");
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
