// Rappel de l'essai StreamPulse+ (règles dans js/trial-reminder.js), vérifié à
// chaque passage de l'alarme de sondage. Le clic ouvre le popup, où le bandeau
// « Débloquer les 7 jours » attend.

import { PLUS_KEY, isPlusActive } from "../plus.js";
import { POPUP_SEEN_KEY, TRIAL_REMINDER_KEY, planTrialReminder, reminderFrom } from "../trial-reminder.js";
import { translateWithPrefs } from "./i18n.js";
import { NotificationCenter, OPEN_POPUP_URL } from "./notifications.js";
import { PreferenceStore } from "./stores.js";
import { TRIAL_STATE_KEY, trialStateFrom, trialTakenOnAccount } from "./trial.js";

export async function maybeRemindTrial(now = Date.now()) {
  const stored = await chrome.storage.local.get([PLUS_KEY, TRIAL_STATE_KEY, POPUP_SEEN_KEY, TRIAL_REMINDER_KEY]);
  const trial = trialStateFrom(stored[TRIAL_STATE_KEY]);
  const { send, reminder } = planTrialReminder({
    now,
    // Une licence présente (même un essai en pause) : pas de rappel.
    plus: isPlusActive(stored[PLUS_KEY]) || Boolean(stored[PLUS_KEY]),
    trialUsed: trial.used || trial.pending,
    takenOnAccount: await trialTakenOnAccount(chrome.storage.sync),
    popupSeenAt: stored[POPUP_SEEN_KEY],
    reminder: reminderFrom(stored[TRIAL_REMINDER_KEY]),
  });
  const before = reminderFrom(stored[TRIAL_REMINDER_KEY]);
  if (send || before.firstSeenAt !== reminder.firstSeenAt) await chrome.storage.local.set({ [TRIAL_REMINDER_KEY]: reminder });
  if (!send) return false;
  const prefs = await PreferenceStore.get();
  await NotificationCenter.show({
    title: translateWithPrefs(prefs, "background.trialReminder.title"),
    message: translateWithPrefs(prefs, "background.trialReminder.message"),
    url: OPEN_POPUP_URL,
  });
  return true;
}
