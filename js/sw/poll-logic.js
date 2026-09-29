// Logique pure du sondage : aucune dépendance à chrome.*, testée par
// tests/poll-logic.test.mjs. polling.js s'en sert pour décider, à chaque tour,
// de l'état live à garder et des alertes à envoyer.

/**
 * Rattrapage : un stream détecté en direct alors qu'il a démarré depuis plus
 * de 10 minutes n'est pas un événement « vient de partir » (navigateur fermé,
 * SW endormi, extension rechargée). Ces streamers ne déclenchent pas une
 * notification chacun : ils alimentent une seule notification groupée.
 */
export const CATCHUP_THRESHOLD_MS = 10 * 60 * 1000;

export const EMPTY_LIVE_STATE = Object.freeze({
  isLive: false,
  platform: null,
  game: "",
  sessionId: null,
  title: "",
  supportsLiveStatus: false,
});

/** Entrée de LIVE_STATE relue du stockage, ramenée à une forme sûre (null si inutilisable). */
export function restoreLiveStateEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  return {
    isLive: Boolean(entry.isLive),
    platform: entry.platform || null,
    game: entry.game || "",
    sessionId: entry.sessionId || null,
    title: entry.title || "",
    lastTitle: entry.lastTitle || "",
    lastGame: entry.lastGame || "",
    avatarUrl: entry.avatarUrl || "",
    startedAt: entry.startedAt || null,
    thumbnailUrl: entry.thumbnailUrl || "",
    matchedRuleIds: Array.isArray(entry.matchedRuleIds) ? entry.matchedRuleIds : [],
    supportsLiveStatus: entry.supportsLiveStatus !== false,
    updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : undefined,
  };
}

/**
 * État live suivant d'un streamer. En cas d'erreur d'API, l'état précédent est
 * conservé (live, session, jeu, titre…) : ni bascule hors ligne / en direct, ni
 * fausse fin de live.
 */
export function nextLiveStateFrom(status, previous, streamer, now) {
  const active = status?.active || {};
  const next = {
    isLive: Boolean(active.isLive),
    platform: active.platform || null,
    game: active.game || "",
    sessionId: active.sessionId || null,
    title: active.title || "",
    // Persistés pour survivre aux sondages hors ligne successifs : `title`
    // et `game` repassent à vide dès que la chaîne n'est plus en direct.
    lastTitle: active.title || active.lastTitle || "",
    lastGame: active.game || active.lastGame || "",
    avatarUrl: status?.avatarUrl || streamer?.avatarUrl || null,
    startedAt: active.isLive ? active.startedAt || previous.startedAt || null : null,
    thumbnailUrl: active.isLive ? active.thumbnailUrl || previous.thumbnailUrl || "" : "",
    matchedRuleIds: [],
    supportsLiveStatus: active.supportsLiveStatus !== false,
    updatedAt: now,
    isError: Boolean(active.isError),
  };
  if (!next.isError) return next;
  return {
    ...next,
    isLive: previous.isLive,
    sessionId: previous.sessionId,
    game: previous.game,
    title: previous.title,
    startedAt: previous.startedAt || null,
    thumbnailUrl: previous.thumbnailUrl || "",
    matchedRuleIds: previous.matchedRuleIds || [],
  };
}

/** Fin de live réelle (pas une erreur d'API) : devient une entrée d'historique. */
export function didStreamEnd(previous, next) {
  return Boolean(previous.isLive && !next.isLive && !next.isError);
}

/**
 * Deux signaux, l'un couvre l'autre : l'âge de notre dernière observation
 * persistée (toutes plateformes, YouTube n'expose pas de startedAt) et le
 * startedAt de l'API quand il existe.
 */
export function isCatchUp(previous, next, now) {
  const stateAge = typeof previous.updatedAt === "number" ? now - previous.updatedAt : Number.POSITIVE_INFINITY;
  const startedAtMs = next.startedAt ? Date.parse(next.startedAt) : NaN;
  return stateAge > CATCHUP_THRESHOLD_MS || (Number.isFinite(startedAtMs) && now - startedAtMs > CATCHUP_THRESHOLD_MS);
}

function sameSession(previous, next) {
  return !previous.sessionId || !next.sessionId || previous.sessionId === next.sessionId;
}

function changeAlerts(streamer, previous, next) {
  const alerts = [];
  const gameChanged = previous.game && next.game && previous.game !== next.game;
  if (streamer.gameNotificationsEnabled !== false && previous.isLive && gameChanged && sameSession(previous, next)) {
    alerts.push({ type: "game", from: previous.game, to: next.game });
  }
  const titleChanged = previous.title && next.title && previous.title !== next.title;
  if (streamer.titleNotificationsEnabled !== false && previous.isLive && titleChanged && sameSession(previous, next)) {
    alerts.push({ type: "title", from: previous.title, to: next.title });
  }
  return alerts;
}

/**
 * Alertes d'un streamer pour ce tour de sondage. Le toggle du streamer est la
 * seule source de vérité (les réglages globaux sont des actions en masse).
 * Les règles intelligentes, quand elles s'appliquent, remplacent l'alerte
 * classique. Renvoie une liste d'actions : { type: "live" | "catchUp" | "game" | "title" }.
 */
export function planStreamerAlerts({ streamer, previous, next, smartDecision, forceNotification, now }) {
  const enabled = streamer.notificationsEnabled !== false;
  if (smartDecision) return enabled && smartDecision.notifyRule ? [{ type: "live" }] : [];
  if (!enabled || !next.isLive) return [];
  if (forceNotification) return [{ type: "live" }];
  const sessionChanged = previous.sessionId && next.sessionId && previous.sessionId !== next.sessionId;
  if (!previous.isLive || sessionChanged) {
    return [{ type: isCatchUp(previous, next, now) ? "catchUp" : "live" }];
  }
  return changeAlerts(streamer, previous, next);
}

/** « A, B, C +2 » pour la notification groupée de rattrapage. */
export function catchUpNames(names, max = 3) {
  const shown = names.slice(0, max).join(", ");
  const rest = names.length - max;
  return rest > 0 ? `${shown} +${rest}` : shown;
}

export function countLive(statuses) {
  return statuses.reduce((total, status) => total + (status.active?.isLive ? 1 : 0), 0);
}
