// Notifications de fin d'essai (règles dans js/trial-end.js), vérifiées à
// chaque passage de l'alarme de sondage. Le clic ouvre l'offre StreamPulse+.

import { PLUS_KEY, plusPageUrl, trialEndsAt } from "../plus.js";
import { TRIAL_END_KEY, planTrialEnd, trialEndFrom } from "../trial-end.js";
import { translateWithPrefs } from "./i18n.js";
import { NotificationCenter } from "./notifications.js";
import { PreferenceStore } from "./stores.js";

const COPY = {
  soon: { title: "background.trialEnd.soonTitle", message: "background.trialEnd.soonMessage" },
  ended: { title: "background.trialEnd.endedTitle", message: "background.trialEnd.endedMessage" },
};

export async function maybeNotifyTrialEnd(now = Date.now()) {
  const stored = await chrome.storage.local.get([PLUS_KEY, TRIAL_END_KEY]);
  const record = stored[PLUS_KEY] || null;
  const before = trialEndFrom(stored[TRIAL_END_KEY]);
  const { notify, state } = planTrialEnd({ now, record, endsAt: trialEndsAt(record), state: before });
  if (JSON.stringify(state) !== JSON.stringify(before)) await chrome.storage.local.set({ [TRIAL_END_KEY]: state });
  if (!notify) return null;
  const prefs = await PreferenceStore.get();
  await NotificationCenter.show({
    title: translateWithPrefs(prefs, COPY[notify].title),
    message: translateWithPrefs(prefs, COPY[notify].message),
    url: plusPageUrl(prefs?.language, "monthly"),
  });
  return notify;
}
