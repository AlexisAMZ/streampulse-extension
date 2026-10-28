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

test("un jour plus tard, popup jamais ouvert : rappel, puis attente de 4 jours", () => {
  const seen = { firstSeenAt: T0, count: 0, lastAt: 0 };
  const one = planTrialReminder({ ...base, now: T0 + DAY, reminder: seen });
  assert.equal(one.send, true);
  assert.equal(planTrialReminder({ ...base, now: T0 + 3 * DAY, reminder: one.reminder }).send, false);
  const two = planTrialReminder({ ...base, now: T0 + 5 * DAY, reminder: one.reminder });
  assert.equal(two.send, true);
  assert.equal(two.reminder.count, MAX_REMINDERS);
  assert.equal(planTrialReminder({ ...base, now: T0 + 30 * DAY, reminder: two.reminder }).send, false, "jamais plus de deux");
});

test("jamais pour un abonné, un essai déjà pris, ou un popup ouvert récemment", () => {
  const seen = { firstSeenAt: T0, count: 0, lastAt: 0 };
  const now = T0 + 2 * DAY;
  assert.equal(planTrialReminder({ ...base, plus: true, now, reminder: seen }).send, false);
  assert.equal(planTrialReminder({ ...base, trialUsed: true, now, reminder: seen }).send, false);
  assert.equal(planTrialReminder({ ...base, takenOnAccount: true, now, reminder: seen }).send, false);
  assert.equal(planTrialReminder({ ...base, popupSeenAt: now - DAY, now, reminder: seen }).send, false);
});
