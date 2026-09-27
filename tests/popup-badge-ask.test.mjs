import test from "node:test";
import assert from "node:assert/strict";

globalThis.navigator ??= { userAgent: "" };
const { shouldAsk } = await import("../js/popup-badge-ask.js");
const DAY = 86_400_000;

test("la carte badge attend 7 jours, n'apparaît que badge désactivé, et respecte « Plus tard » et « Non merci »", () => {
  const now = 100 * DAY;
  assert.equal(shouldAsk({ firstSeen: now - 6 * DAY }, {}, now), false);
  assert.equal(shouldAsk({ firstSeen: now - 8 * DAY }, {}, now), true);
  assert.equal(shouldAsk({ firstSeen: now - 8 * DAY }, { communityBadge: true }, now), false);
  assert.equal(shouldAsk({ firstSeen: now - 8 * DAY, snoozedUntil: now + DAY }, {}, now), false);
  assert.equal(shouldAsk({ firstSeen: now - 8 * DAY, done: true }, {}, now), false);
  assert.equal(shouldAsk(null, {}, now), false);
});
