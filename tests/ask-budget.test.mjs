import test from "node:test";
import assert from "node:assert/strict";
import { ASK_BUDGET_KEY, ASK_GAP_MS, canShowAsk, claimAskSlot, resetAskBudget } from "../js/ask-budget.js";

const fakeStorage = (initial = {}) => {
  const data = { ...initial };
  return { data, async get(key) { return { [key]: data[key] }; }, async set(values) { Object.assign(data, values); } };
};
const DAY = 24 * 60 * 60 * 1000;
const t0 = Date.parse("2026-11-24T12:00:00Z");

test("budget : aucune demande récente, tout le monde peut passer", () => {
  assert.equal(canShowAsk(null, "review", t0), true);
  assert.equal(canShowAsk({ id: "badge", at: t0 - ASK_GAP_MS }, "review", t0), true);
});

test("budget : une autre demande vue il y a moins de 48 h bloque, la même reste visible", () => {
  const last = { id: "badge", at: t0 - DAY };
  assert.equal(canShowAsk(last, "review", t0), false);
  assert.equal(canShowAsk(last, "badge", t0), true);
  assert.equal(canShowAsk({ id: "badge", at: t0 + DAY }, "review", t0), true, "horloge reculée : on ne bloque pas");
});

test("budget : une seule demande gagne par ouverture, les autres perdent même en concurrence", async () => {
  resetAskBudget();
  const storage = fakeStorage();
  const results = await Promise.all([
    claimAskSlot("review", { storage, now: () => t0 }),
    claimAskSlot("badge", { storage, now: () => t0 }),
    claimAskSlot("promo-plus", { storage, now: () => t0 }),
  ]);
  assert.deepEqual(results, [true, false, false]);
  assert.deepEqual(storage.data[ASK_BUDGET_KEY], { id: "review", at: t0 });
  assert.equal(await claimAskSlot("review", { storage, now: () => t0 }), true, "le gagnant le reste");
});

test("budget : le lendemain, une autre demande est refusée, et la même reste possible", async () => {
  const storage = fakeStorage({ [ASK_BUDGET_KEY]: { id: "review", at: t0 } });
  resetAskBudget();
  assert.equal(await claimAskSlot("referral", { storage, now: () => t0 + DAY }), false);
  resetAskBudget();
  assert.equal(await claimAskSlot("review", { storage, now: () => t0 + DAY }), true);
  assert.equal(storage.data[ASK_BUDGET_KEY].at, t0, "la fenêtre ne glisse pas quand la même demande revient");
});

test("budget : après 48 h, la place est libre et la date se met à jour", async () => {
  const storage = fakeStorage({ [ASK_BUDGET_KEY]: { id: "review", at: t0 } });
  resetAskBudget();
  assert.equal(await claimAskSlot("promo-plus", { storage, now: () => t0 + 2 * DAY }), true);
  assert.deepEqual(storage.data[ASK_BUDGET_KEY], { id: "promo-plus", at: t0 + 2 * DAY });
});

test("budget : stockage illisible, la demande passe", async () => {
  resetAskBudget();
  const storage = { async get() { throw new Error("boom"); }, async set() { throw new Error("boom"); } };
  assert.equal(await claimAskSlot("review", { storage, now: () => t0, warn() {} }), true);
});
