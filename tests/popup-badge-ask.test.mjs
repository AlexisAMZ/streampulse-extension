import test from "node:test";
import assert from "node:assert/strict";

const { shouldAsk } = await import("../js/popup-badge-ask.js");
const DAY = 24 * 60 * 60 * 1000;

test("la carte du badge ne s'affiche plus : il est actif par défaut", () => {
  const now = Date.now();
  assert.equal(shouldAsk({ firstSeen: now - 8 * DAY }, {}, now), false);
  assert.equal(shouldAsk({ firstSeen: now - 8 * DAY }, { communityBadge: false }, now), false);
  assert.equal(shouldAsk(null, {}, now), false);
});
