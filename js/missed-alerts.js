// Alertes manquées (sans StreamPulse+) : les badges et campagnes Drops dont un
// abonné aurait été prévenu. Aucune notification : le service worker les note,
// le popup les montre (écran LCD des onglets Badges et Drops) et l'icône porte
// un point tant qu'elles n'ont pas été vues. Module pur, testé par
// tests/missed-alerts.test.mjs.

export const MISSED_KEY = "streamPulseMissedAlerts";
export const MAX_MISSED = 20;
export const MISSED_KEEP_MS = 7 * 86_400_000;
const KINDS = ["badge", "drop"];

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const whole = (value) => Math.max(0, Math.floor(Number(value) || 0));

/** Une entrée lisible : { id, kind, title, game, durationMs, endsAt, at }, ou null. */
function cleanItem(raw) {
  if (!isObject(raw) || typeof raw.id !== "string" || !raw.id || !KINDS.includes(raw.kind)) return null;
  return {
    id: raw.id.slice(0, 200),
    kind: raw.kind,
    title: String(raw.title || "").slice(0, 120),
    game: String(raw.game || "").slice(0, 80),
    durationMs: whole(raw.durationMs),
    endsAt: whole(raw.endsAt),
    at: whole(raw.at),
  };
}

/** État lu du stockage : { items (plus récent d'abord), seenAt }. */
export function missedFrom(stored) {
  const value = isObject(stored) ? stored : {};
  const items = (Array.isArray(value.items) ? value.items : []).map(cleanItem).filter(Boolean);
  return { items, seenAt: whole(value.seenAt) };
}

/** Ajoute des alertes manquées : un id déjà noté garde sa première date. Renvoie un nouvel état. */
export function addMissed(state, entries, now) {
  const known = new Set(state.items.map((item) => item.id));
  const fresh = (Array.isArray(entries) ? entries : []).map(cleanItem).filter((item) => item && !known.has(item.id) && known.add(item.id));
  const items = [...fresh, ...state.items]
    .filter((item) => now - item.at <= MISSED_KEEP_MS)
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_MISSED);
  return { ...state, items };
}

/** Alertes arrivées depuis la dernière ouverture des onglets Badges ou Drops. */
export function unseenCount(state) {
  return state.items.filter((item) => item.at > state.seenAt).length;
}

export function markSeen(state, now) {
  return { ...state, seenAt: Math.max(state.seenAt, now) };
}

/** Compte de la semaine, pour l'écran LCD. */
export function weekSummary(state, now) {
  const recent = state.items.filter((item) => now - item.at <= MISSED_KEEP_MS);
  const badges = recent.filter((item) => item.kind === "badge").length;
  const drops = recent.length - badges;
  return { badges, drops, total: recent.length };
}
