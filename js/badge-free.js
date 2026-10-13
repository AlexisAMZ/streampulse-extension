// Badge gratuit du jour : sans StreamPulse+, le mode auto récupère un badge
// par jour (date locale). Module pur, partagé par le service worker et le popup.

export const BADGE_FREE_KEY = "streamPulseBadgeFreeDay";

/** Jour local « AAAA-MM-JJ » : le quota repart à minuit chez l'utilisateur. */
export function dayKey(now = Date.now()) {
  const date = new Date(now);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Enregistrement du badge gratuit, ou null s'il est illisible. */
export function normalizeFree(raw) {
  if (!raw || typeof raw !== "object") return null;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(raw.day) ? raw.day : "";
  const badgeId = typeof raw.badgeId === "string" ? raw.badgeId : "";
  return day && badgeId ? { day, badgeId } : null;
}

/** Ce badge peut-il partir en gratuit ? Oui si le quota du jour est libre ou déjà pris par lui. */
export function freeAvailable(raw, badgeId, now = Date.now()) {
  const record = normalizeFree(raw);
  return !record || record.day !== dayKey(now) || record.badgeId === badgeId;
}

/** Le badge gratuit du jour est-il déjà pris (par n'importe quel badge) ? */
export function freeUsedToday(raw, now = Date.now()) {
  return normalizeFree(raw)?.day === dayKey(now);
}

/** Sans Plus, l'état du mode auto n'est valable que pour le seul badge gratuit. */
export function isFreeRun(state, raw) {
  const record = normalizeFree(raw);
  if (!state || !record || state.mode === "all") return false;
  return state.jobs.length === 1 && state.jobs[0].badgeId === record.badgeId;
}
