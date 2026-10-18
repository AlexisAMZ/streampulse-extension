// Donnees locales des outils de notification : aucune requete ni ecriture de preferences.
import { DEFAULT_PREFERENCES, sanitizePreferences } from "./preferences-data.js";
import { getNotificationSilence, normalizeNotificationPause, notificationPauseUntil } from "./quiet-hours.js";
import { decideSmartAlert, normalizeRules } from "./smart-alerts.js";
import { PREFERENCES_KEY } from "./sw/constants.js";
import { EMPTY_LIVE_STATE, explainStreamerAlerts, nextLiveStateFrom, restoreLiveStateEntry } from "./sw/poll-logic.js";

export const NOTIFICATION_PAUSE_KEY = "streamPulseNotificationPause";
export const NOTIFICATION_PINS_KEY = "betaPinnedIds";

export async function readNotificationControls(storage = chrome.storage.local) {
  const stored = await storage.get([NOTIFICATION_PAUSE_KEY, NOTIFICATION_PINS_KEY, PREFERENCES_KEY]);
  return {
    pause: normalizeNotificationPause(stored[NOTIFICATION_PAUSE_KEY]),
    pinnedIds: Array.isArray(stored[NOTIFICATION_PINS_KEY]) ? stored[NOTIFICATION_PINS_KEY] : [],
    preferences: { ...DEFAULT_PREFERENCES, ...sanitizePreferences(stored[PREFERENCES_KEY] || {}) },
  };
}

export async function pauseNotifications(duration, exceptPinned = false, storage = chrome.storage.local, now = Date.now()) {
  const pause = { until: notificationPauseUntil(duration, now), exceptPinned: exceptPinned === true };
  await storage.set({ [NOTIFICATION_PAUSE_KEY]: pause });
  return pause;
}

export async function resumeNotifications(storage = chrome.storage.local) {
  await storage.remove(NOTIFICATION_PAUSE_KEY);
}

export async function setNotificationPauseException(exceptPinned, storage = chrome.storage.local, now = Date.now()) {
  const stored = await storage.get(NOTIFICATION_PAUSE_KEY);
  const pause = normalizeNotificationPause(stored[NOTIFICATION_PAUSE_KEY]);
  if (pause.until <= now) return pause;
  const updated = { ...pause, exceptPinned: exceptPinned === true };
  await storage.set({ [NOTIFICATION_PAUSE_KEY]: updated });
  return updated;
}

export async function readNotificationPermission(notifications = globalThis.chrome?.notifications) {
  try {
    const level = await notifications?.getPermissionLevel?.();
    return level === "granted" || level === "denied" ? level : "unknown";
  } catch {
    return "unknown";
  }
}

/** Evalue le statut enregistre contre l'etat persiste, sans pretendre retrouver une ancienne alerte. */
export function diagnoseStreamerNotifications({
  streamer, status, liveState, preferences = {}, pause, pinnedIds = [],
  smartRules = {}, isPlus = false, permission = "unknown", now = Date.now(),
}) {
  const previous = restoreLiveStateEntry(liveState);
  const active = status?.active;
  const hasStatus = active && (typeof active.isLive === "boolean" || active.isError === true || active.supportsLiveStatus === false);
  const next = nextLiveStateFrom(status, previous || EMPTY_LIVE_STATE, streamer, now);
  const rules = (normalizeRules(smartRules)[streamer.id] || []).filter((rule) => rule.enabled);
  const smartDecision = isPlus && hasStatus && !next.isError
    ? decideSmartAlert(rules, active, previous?.isLive ? previous.matchedRuleIds : [])
    : null;
  let decision = explainStreamerAlerts({ streamer, previous: previous || EMPTY_LIVE_STATE, next, smartDecision, now });
  if (!hasStatus) decision = { alerts: [], reason: "noStatus" };
  else if (!previous && ["live", "catchUp", "smartMatch"].includes(decision.reason)) decision = { alerts: [], reason: "noBaseline" };
  return {
    permission,
    silence: getNotificationSilence({ now, pause, preferences, pinnedIds, streamerId: streamer.id }),
    settings: {
      live: streamer.notificationsEnabled !== false,
      game: streamer.gameNotificationsEnabled !== false,
      title: streamer.titleNotificationsEnabled !== false,
    },
    smart: { configured: rules.length, active: isPlus && rules.length > 0, matched: smartDecision?.matchedIds.length ?? null },
    decision,
    updatedAt: Number.isFinite(status?.updatedAt) ? status.updatedAt : null,
  };
}
