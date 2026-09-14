// Historique des lives : sessions terminées des streamers suivis, pour l'onglet
// « Historique » du popup. Module pur (aucun appel chrome.*), testé à part.

export const HISTORY_KEY = "streamPulseHistory";

/** Au-delà, les sessions les plus anciennes sont oubliées. */
export const HISTORY_MAX_ENTRIES = 60;
export const HISTORY_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/** Une session plus courte ne mérite pas d'entrée (coupure réseau, test de stream). */
export const HISTORY_MIN_DURATION_SEC = 5 * 60;

export function emptyHistory() {
  return { entries: [] };
}

function toTime(value) {
  const time = typeof value === "number" ? value : Date.parse(value || "");
  return Number.isFinite(time) ? time : null;
}

export function sessionDurationSec(startedAt, endedAt) {
  const start = toTime(startedAt);
  const end = toTime(endedAt);
  if (start === null || end === null || end <= start) return 0;
  return Math.round((end - start) / 1000);
}

export function sessionId(streamerId, startedAt, endedAt) {
  return `${streamerId}@${toTime(startedAt) ?? toTime(endedAt) ?? 0}`;
}

function sanitizeHistory(history) {
  const entries = Array.isArray(history?.entries) ? history.entries : [];
  return entries.filter((entry) => entry && typeof entry.id === "string" && typeof entry.streamerId === "string");
}

/**
 * Ajoute une session terminée. Une session déjà connue (même streamer, même
 * début) est mise à jour sans perdre son état « vu ». Renvoie un nouvel objet.
 */
export function addSession(history, session, now = Date.now()) {
  const endedAt = toTime(session.endedAt) ?? now;
  const durationSec = session.durationSec || sessionDurationSec(session.startedAt, endedAt);
  const current = sanitizeHistory(history);
  if (durationSec > 0 && durationSec < HISTORY_MIN_DURATION_SEC) return { entries: current };

  const id = sessionId(session.streamerId, session.startedAt, endedAt);
  const previous = current.find((entry) => entry.id === id);
  const entry = {
    ...previous,
    ...session,
    id,
    endedAt,
    durationSec,
    watched: Boolean(session.watched || previous?.watched),
    seen: Boolean(previous?.seen),
  };

  const entries = [entry, ...current.filter((item) => item.id !== id)]
    .filter((item) => now - (toTime(item.endedAt) ?? 0) <= HISTORY_MAX_AGE_MS)
    .sort((a, b) => (toTime(b.endedAt) ?? 0) - (toTime(a.endedAt) ?? 0))
    .slice(0, HISTORY_MAX_ENTRIES);
  return { entries };
}

/** Complète une session déjà enregistrée (VOD trouvée après coup, par exemple). */
export function patchSession(history, id, patch) {
  return {
    entries: sanitizeHistory(history).map((entry) => (entry.id === id ? { ...entry, ...patch, id } : entry)),
  };
}

export function markSeen(history, id) {
  return patchSession(history, id, { seen: true });
}

/**
 * Lives ratés : sessions que l'utilisateur n'a pas regardées, filtrées par
 * plateforme. Les sessions déjà ouvertes depuis l'historique restent listées
 * (estompées dans l'interface) pour ne pas disparaître sous les doigts.
 */
export function selectMissed(history, { platform = "all" } = {}) {
  return sanitizeHistory(history).filter(
    (entry) => !entry.watched && (platform === "all" || entry.platform === platform),
  );
}

export function summarize(entries) {
  return {
    count: entries.length,
    unseen: entries.filter((entry) => !entry.seen).length,
    totalSeconds: entries.reduce((total, entry) => total + (entry.durationSec || 0), 0),
  };
}

/** « 3:12:04 » pour une vignette de VOD. */
export function formatClock(seconds) {
  const safe = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
