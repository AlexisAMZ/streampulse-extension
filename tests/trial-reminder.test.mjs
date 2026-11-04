import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_REMINDERS, planTrialReminder, reminderFrom } from "../js/trial-reminder.js";

const DAY = 86_400_000;
const T0 = Date.parse("2026-10-28T12:00:00Z");
const base = { plus: false, trialUsed: false, takenOnAccount: false, popupSeenAt: 0 };

test("premier passage : on note la date, pas de rappel le jour même", () => {
  const first = planTrialReminder({ ...base, now: T0, reminder: reminderFrom(null) });
  assert.equal(first.send, false);
  assert.equal(first.reminder.firstSeenAt, T0);
});

test("pas de rappel avant trois jours, même popup jamais ouvert", () => {
  const seen = { firstSeenAt: T0, count: 0, lastAt: 0 };
  assert.equal(planTrialReminder({ ...base, now: T0 + DAY, reminder: seen }).send, false);
  assert.equal(planTrialReminder({ ...base, now: T0 + 2 * DAY, reminder: seen }).send, false);
});

test("trois jours plus tard, popup jamais ouvert : un seul rappel, jamais un second", () => {
  const seen = { firstSeenAt: T0, count: 0, lastAt: 0 };
  const one = planTrialReminder({ ...base, now: T0 + 3 * DAY, reminder: seen });
  assert.equal(one.send, true);
  assert.equal(one.reminder.count, MAX_REMINDERS);
  assert.equal(MAX_REMINDERS, 1);
  assert.equal(planTrialReminder({ ...base, now: T0 + 30 * DAY, reminder: one.reminder }).send, false, "jamais plus d'un");
});

test("jamais pour un abonné, un essai déjà pris, ou un popup ouvert récemment", () => {
  const seen = { firstSeenAt: T0, count: 0, lastAt: 0 };
  const now = T0 + 2 * DAY;
  assert.equal(planTrialReminder({ ...base, plus: true, now, reminder: seen }).send, false);
  assert.equal(planTrialReminder({ ...base, trialUsed: true, now, reminder: seen }).send, false);
  assert.equal(planTrialReminder({ ...base, takenOnAccount: true, now, reminder: seen }).send, false);
  assert.equal(planTrialReminder({ ...base, popupSeenAt: now - DAY, now, reminder: seen }).send, false);
});
