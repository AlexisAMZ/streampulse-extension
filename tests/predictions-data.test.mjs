import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RULE,
  addBet,
  chooseOutcome,
  decideBet,
  normalizeRule,
  parseEvent,
  resolveBet,
  settle,
  stakeFor,
  summarize,
} from "../js/predictions-data.js";

const NOW = Date.parse("2026-09-14T20:00:00Z");
const rule = (over = {}) => normalizeRule({ ...DEFAULT_RULE, enabled: true, ...over });
const rawEvent = (over = {}) => ({
  id: "evt-1",
  title: "Top 1 ?",
  status: "ACTIVE",
  createdAt: new Date(NOW - 100_000).toISOString(),
  predictionWindowSeconds: 115, // fin dans 15 s
  outcomes: [
    { id: "yes", title: "Oui", totalPoints: 8000 },
    { id: "no", title: "Non", totalPoints: 2000 },
  ],
  ...over,
});
const bet = (over = {}) => ({ eventId: "evt-1", channel: "kamet0", points: 100, balanceAfter: 900, status: "pending", seenAt: NOW, payout: 0, ...over });

test("normalizeRule borne les valeurs saisies", () => {
  const r = normalizeRule({ enabled: true, strategy: "all-in", percent: 99, maxPoints: 1, reserve: -5, secondsBeforeEnd: 1 });
  assert.deepEqual(r, { enabled: true, strategy: "majority", percent: 50, maxPoints: 10, reserve: 0, secondsBeforeEnd: 5 });
  assert.equal(normalizeRule(null).enabled, false);
});

test("parseEvent calcule la fin et refuse un événement incomplet", () => {
  const event = parseEvent(rawEvent());
  assert.equal(event.endsAt, NOW + 15_000);
  assert.equal(event.outcomes[1].totalPoints, 2000);
  assert.equal(parseEvent({ id: "x", outcomes: [{ id: "a" }] }), null);
});

test("chooseOutcome : la plus jouée, la meilleure cote, ou rien sans mise", () => {
  const event = parseEvent(rawEvent());
  assert.equal(chooseOutcome(event, rule()).id, "yes");
  assert.equal(chooseOutcome(event, rule({ strategy: "underdog" })).id, "no");
  const empty = parseEvent(rawEvent({ outcomes: [{ id: "a", totalPoints: 0 }, { id: "b", totalPoints: 0 }] }));
  assert.equal(chooseOutcome(empty, rule()), null);
});

test("stakeFor respecte le pourcentage, le plafond et la réserve", () => {
  assert.equal(stakeFor(10_000, rule({ percent: 5, maxPoints: 1000, reserve: 1000 })), 500);
  assert.equal(stakeFor(100_000, rule({ percent: 5, maxPoints: 1000, reserve: 0 })), 1000);
  assert.equal(stakeFor(1_050, rule({ percent: 50, reserve: 1000 })), 50);
  assert.equal(stakeFor(1_005, rule({ reserve: 1000 })), 0);
});

test("decideBet mise seulement dans la fenêtre de fin, une fois par événement", () => {
  const event = parseEvent(rawEvent());
  assert.deepEqual(decideBet(event, 10_000, rule(), [], NOW), { outcome: event.outcomes[0], points: 500 });
  assert.equal(decideBet(event, 10_000, rule({ secondsBeforeEnd: 10 }), [], NOW), null);
  assert.equal(decideBet(event, 10_000, rule(), [bet()], NOW), null);
  assert.equal(decideBet(event, 10_000, rule({ enabled: false }), [], NOW), null);
  assert.equal(decideBet({ ...event, status: "LOCKED" }, 10_000, rule(), [], NOW), null);
});

test("resolveBet distingue gain, perte et remboursement d'après le solde", () => {
  assert.equal(resolveBet(bet(), 900).status, "lost");
  assert.equal(resolveBet(bet(), 1000).status, "refunded");
  const won = resolveBet(bet(), 1250);
  assert.equal(won.status, "won");
  assert.equal(won.payout, 350);
});

test("settle suit le solde tant que l'événement est visible puis estime le résultat", () => {
  let history = [bet(), bet({ eventId: "other", channel: "autre" })];
  history = settle(history, "kamet0", ["evt-1"], 950, NOW + 1000);
  assert.equal(history[0].balanceAfter, 950);
  assert.equal(history[0].status, "pending");
  history = settle(history, "kamet0", [], 1300, NOW + 2000);
  assert.equal(history[0].status, "won");
  assert.equal(history[1].status, "pending");
  const stale = settle([bet()], "kamet0", [], 2000, NOW + 11 * 60 * 1000);
  assert.equal(stale[0].status, "unknown");
});

test("addBet remplace la mise d'un même événement et plafonne l'historique", () => {
  const history = addBet([bet({ points: 10 })], bet({ points: 20 }));
  assert.equal(history.length, 1);
  assert.equal(history[0].points, 20);
});

test("summarize calcule taux de réussite et gain net", () => {
  const stats = summarize([
    bet({ status: "won", points: 100, payout: 300 }),
    bet({ status: "lost", points: 50 }),
    bet({ status: "refunded" }),
    bet({ status: "failed" }),
  ]);
  assert.equal(stats.bets, 3);
  assert.equal(stats.rate, 0.5);
  assert.equal(stats.net, 150);
  assert.equal(summarize([]).rate, null);
});
