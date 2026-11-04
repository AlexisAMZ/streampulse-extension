// Rappel de l'essai StreamPulse+ pour qui n'ouvre pas le popup : une
// notification Chrome « 7 jours offerts, sans carte bancaire ». Une seule, trois
// jours après la première vérification (adouci le 2026-11-04 : les pics de
// désinstallations des 29 octobre et 2 novembre tombaient sur les dates les plus
// tôt des deux rappels). Jamais à un abonné ni à qui a déjà pris l'essai. Module pur, testé par
// tests/trial-reminder.test.mjs.

export const TRIAL_REMINDER_KEY = "streamPulseTrialReminder";
/** Dernière ouverture du popup (ms), écrite par le popup. */
export const POPUP_SEEN_KEY = "streamPulsePopupSeenAt";

const DAY_MS = 86_400_000;
export const MAX_REMINDERS = 1;
/** Rappel au plus tôt trois jours après la première vérification (installation ou mise à jour). */
const FIRST_DELAY_MS = 3 * DAY_MS;
/** Écart minimal entre deux rappels. */
const GAP_MS = 4 * DAY_MS;
/** Popup ouvert récemment : la personne voit déjà le bandeau, pas besoin de rappel. */
const RECENT_POPUP_MS = 2 * DAY_MS;

const whole = (value) => Math.max(0, Math.floor(Number(value) || 0));

/** État du rappel : { firstSeenAt, count, lastAt }. */
export function reminderFrom(stored) {
  const value = stored && typeof stored === "object" ? stored : {};
  return { firstSeenAt: whole(value.firstSeenAt), count: whole(value.count), lastAt: whole(value.lastAt) };
}

/**
 * @param {{ now: number, plus: boolean, trialUsed: boolean, takenOnAccount: boolean,
 *   popupSeenAt: number, reminder: { firstSeenAt: number, count: number, lastAt: number } }} input
 * @returns {{ send: boolean, reminder: object }} le nouvel état à enregistrer
 */
export function planTrialReminder({ now, plus, trialUsed, takenOnAccount, popupSeenAt, reminder }) {
  const state = { ...reminder, firstSeenAt: reminder.firstSeenAt || now };
  const eligible = !plus && !trialUsed && !takenOnAccount;
  const due = state.count < MAX_REMINDERS
    && now - state.firstSeenAt >= FIRST_DELAY_MS
    && now - state.lastAt >= GAP_MS
    && now - whole(popupSeenAt) >= RECENT_POPUP_MS;
  if (!eligible || !due) return { send: false, reminder: state };
  return { send: true, reminder: { ...state, count: state.count + 1, lastAt: now } };
}
