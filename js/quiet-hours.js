/**
 * Heures calmes : plage horaire « HH:MM » pendant laquelle les notifications
 * sont mises en pause. La plage peut passer minuit (23:00 → 08:00).
 * Module partagé popup / service worker, sans dépendance : la logique est
 * testée dans tests/quiet-hours.test.mjs.
 */

export const DEFAULT_QUIET_START = "23:00";
export const DEFAULT_QUIET_END = "08:00";

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

/** « 8:05 » → « 08:05 » ; toute entrée invalide retombe sur `fallback`. */
export function normalizeQuietTime(value, fallback) {
  const match = TIME_RE.exec(String(value ?? "").trim());
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return fallback;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function minutesOfDay(time, fallback) {
  const normalized = normalizeQuietTime(time, fallback);
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Vrai si `now` (epoch ms) tombe dans la plage [start, end). Début = fin : jamais. */
export function isQuietNow(now, start = DEFAULT_QUIET_START, end = DEFAULT_QUIET_END) {
  const from = minutesOfDay(start, DEFAULT_QUIET_START);
  const to = minutesOfDay(end, DEFAULT_QUIET_END);
  if (from === to) return false;
  const date = new Date(now);
  const current = date.getHours() * 60 + date.getMinutes();
  if (from < to) return current >= from && current < to;
  // Plage passant minuit : le soir depuis `from`, le matin jusqu'à `to`.
  return current >= from || current < to;
}
