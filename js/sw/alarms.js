// Alarmes périodiques (sondage, keep-alive, vidage du temps de visionnage, inventaire).

import { RAID_WATCHER_ALARM } from "../raidWatcher.js";
import { pollIntervalMinutes } from "./config.js";
import { AUTO_OPEN_INVENTORY_ALARM, DROPS_ALARM, KEEP_ALIVE_ALARM, WATCHER_ALARM } from "./constants.js";
import { refreshDropsFromWorker } from "./drops.js";
import { NotificationCenter } from "./notifications.js";
import { pollStreamers } from "./polling.js";
import { refreshRaidWatcher } from "./raids.js";
import { WatchTimeStore } from "./watchtime.js";

export async function setupAutoOpenInventoryAlarm(prefs = {}) {
  if (prefs.autoOpenInventory && Number(prefs.autoOpenInventoryIntervalHours) > 0) {
    const minutes = Number(prefs.autoOpenInventoryIntervalHours) * 60;
    chrome.alarms.create(AUTO_OPEN_INVENTORY_ALARM, {
      periodInMinutes: minutes,
    });
  } else {
    chrome.alarms.clear(AUTO_OPEN_INVENTORY_ALARM);
  }
}

// Idempotent: only create the alarm if it doesn't already exist. Otherwise
// every SW restart would call chrome.alarms.create() with the same name,
// CANCELLING the existing periodic alarm and replacing it with a fresh one
// using delayInMinutes: 0.1 (clamped to 1 min in production). This means the
// alarm phase keeps shifting forward by 1 min on every wake-up: the period
// is no longer the configured 10 min, polls bunch up, and notifications can
// re-fire on every wake if state restoration lags.
export function scheduleWatcherAlarm() {
  chrome.alarms.get(WATCHER_ALARM, (existing) => {
    if (existing) return;
    chrome.alarms.create(WATCHER_ALARM, {
      periodInMinutes: pollIntervalMinutes(),
      delayInMinutes: 0.1,
    });
  });
}

export function scheduleKeepAliveAlarm() {
  chrome.alarms.get(KEEP_ALIVE_ALARM, (existing) => {
    if (existing) return;
    chrome.alarms.create(KEEP_ALIVE_ALARM, {
      periodInMinutes: Math.max(pollIntervalMinutes() / 2, 0.5),
      delayInMinutes: 0.1,
    });
  });
}

const WATCH_TIME_FLUSH_ALARM = "streampulseWatchTimeFlush";

/** Vide le cumul du temps de visionnage au plus toutes les 5 minutes. */
export function scheduleWatchTimeFlushAlarm() {
  chrome.alarms.get(WATCH_TIME_FLUSH_ALARM, (existing) => {
    if (existing) return;
    chrome.alarms.create(WATCH_TIME_FLUSH_ALARM, {
      periodInMinutes: Math.ceil(WatchTimeStore.FLUSH_INTERVAL_MS / 60_000),
      delayInMinutes: Math.ceil(WatchTimeStore.FLUSH_INTERVAL_MS / 60_000),
    });
  });
}

/** Listener chrome.alarms.onAlarm (posé au top-level par background.js). */
export function handleAlarm(alarm) {
  if (alarm.name === WATCH_TIME_FLUSH_ALARM) {
    WatchTimeStore.flush().catch((error) => console.warn("[WatchTime] vidage :", error?.message || error));
  } else if (alarm.name === RAID_WATCHER_ALARM) {
    refreshRaidWatcher();
  } else if (alarm.name === WATCHER_ALARM) {
    pollStreamers({ forceNotification: false }).catch((error) => {
      console.warn("Polling error:", error.message);
    });
  } else if (alarm.name === KEEP_ALIVE_ALARM) {
    chrome.runtime.getPlatformInfo(() => {
      if (chrome.runtime.lastError) {
        console.debug(
          "KeepAlive alarm ping error:",
          chrome.runtime.lastError.message
        );
      }
    });
  } else if (alarm.name === DROPS_ALARM) {
    refreshDropsFromWorker().catch((error) => console.warn("[StreamPulse] Drops :", error?.message || error));
  } else if (alarm.name === AUTO_OPEN_INVENTORY_ALARM) {
    chrome.tabs.query({ url: "*://www.twitch.tv/drops/inventory*" }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.reload(tabs[0].id);
      } else {
        chrome.tabs.create({
          url: "https://www.twitch.tv/drops/inventory",
          active: false,
        });
      }
    });
  } else if (alarm.name.startsWith(NotificationCenter.alarmPrefix)) {
    NotificationCenter.handleAlarm(alarm.name).catch((error) => {
      console.warn("Scheduled alarm error:", error?.message || error);
    });
  }
}
