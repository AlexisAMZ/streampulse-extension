import { test } from "node:test";
import assert from "node:assert/strict";
import { planTrialEnd, trialEndFrom } from "../js/trial-end.js";

const DAY = 86_400_000;
const SINCE = Date.parse("2026-10-28T12:00:00Z");
const END = SINCE + 7 * DAY;
const record = (extra = {}) => ({ plan: "trial", since: SINCE, ...extra });
const fresh = trialEndFrom(null);
const plan = (now, state = fresh, rec = record()) => planTrialEnd({ now, record: rec, endsAt: rec?.plan === "trial" ? END : 0, state });

test("rien pendant l'essai, veille à moins de 24 h, une seule fois", () => {
  assert.equal(plan(SINCE + DAY).notify, null);
  const soon = plan(END - DAY + 1000);
  assert.equal(soon.notify, "soon");
  assert.equal(plan(END - 1000, soon.state).notify, null);
});

test("fin annoncée une fois, même sans veille ; trop ancienne : rien", () => {
  const ended = plan(END + 1000);
  assert.equal(ended.notify, "ended");
  assert.equal(plan(END + DAY, ended.state).notify, null);
  assert.equal(plan(END + 4 * DAY).notify, null);
});

test("pas d'essai, abonné ou autre compte en pause : pas de veille", () => {
  assert.equal(plan(END - 1000, fresh, null).notify, null);
  assert.equal(plan(END - 1000, fresh, { plan: "monthly", since: SINCE }).notify, null);
  assert.equal(plan(END - 1000, fresh, record({ otherAccount: true })).notify, null);
});

test("nouvel essai (autre since) : l'état repart de zéro ; état illisible ramené", () => {
  const old = { since: SINCE - 30 * DAY, soon: true, ended: true };
  assert.equal(plan(END - 1000, old).notify, "soon");
  assert.deepEqual(trialEndFrom({ since: "x", soon: "yes", ended: 1 }), { since: 0, soon: false, ended: false });
});
