// Constantes partagées du service worker (clés de stockage, noms d'alarmes).

export const STORAGE_KEYS = {
  STREAMERS: "betaGeneralStreamers",
  STATUSES: "betaGeneralStatuses",
  STATS: "betaGeneralStats",
  WATCH_TIME: "betaWatchTimeData",
  // Meme forme que WATCH_TIME, mais par jour ("AAAA-MM-JJ") : alimente les
  // periodes glissantes de la page de recap (7 et 30 jours).
  WATCH_TIME_DAILY: "streamPulseWatchTimeDaily",
  // Dedicated key for live-state notification dedup. Separate from STATUSES
  // (which is the popup display data) so it survives even if statuses are
  // wiped/reset. This is critical for MV3: every SW restart wipes the
  // in-memory `streamerLiveState` Map, so we MUST restore from storage.
  LIVE_STATE: "streamPulseLiveState",
  EVENT_LOGS: "betaEventLogs",
};

export const PREFERENCES_KEY = "betaGeneralPreferences";
export const NOTIFICATION_NAMESPACE = "streampulse";
export const NETWORK_TIMEOUT_MS = 8000;

export const WATCHER_ALARM = "streampulseWatcher";
export const KEEP_ALIVE_ALARM = "streampulseKeepAlive";
export const AUTO_OPEN_INVENTORY_ALARM = "streamPulseAutoOpenInventoryAlarm";
export const DROPS_ALARM = "streampulse-drops";
