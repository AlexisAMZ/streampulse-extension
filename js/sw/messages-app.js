// Handlers de messages runtime (voir messages.js pour la table).

import { syncUpdateBadge } from "./action-badge.js";
import { CONFIG, ensureConfig } from "./config.js";
import { STORAGE_KEYS } from "./constants.js";
import { HistoryStore } from "./history-store.js";
import { translateWithPrefs } from "./i18n.js";
import { openPatchNotes } from "./lifecycle.js";
import { respond } from "./message-dispatch.js";
import { NotificationCenter } from "./notifications.js";
import { EventLogStore, PreferenceStore, StatsStore } from "./stores.js";
import { WatchTimeStore, currentGameOf, resolveChannelAvatar, watchTimeTabClaims } from "./watchtime.js";

export function handleOpenPatchNotes(request, sender, sendResponse) {
  (async () => {
    try {
      await chrome.storage.local.set({
        patchNotesUnread: false,
        seenPatchNotesVersion: chrome.runtime.getManifest().version,
      });
      await syncUpdateBadge();
      await openPatchNotes();
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ error: error?.message || String(error) });
    }
  })();
  return true;
}

export function handleOpenSettings(request, sender, sendResponse) {
  try {
    // Cible optionnelle : le popup lit ?menu=<panneau> et ouvre les
    // réglages sur cette rubrique (bouton « Page complète » du tiroir).
    const settingsPanel = String(request.panel || "");
    const settingsUrl =
      chrome.runtime.getURL("html/popup.html") +
      (settingsPanel ? "?menu=" + encodeURIComponent(settingsPanel) : "");
    chrome.tabs.create({ url: settingsUrl });
    sendResponse({ success: true });
  } catch (e) {
    sendResponse({ success: false, error: e?.message });
  }
  return true;
}

export function handleGetConfig(request, sender, sendResponse) {
  // Content scripts can no longer import config.js directly (it was removed
  // from web_accessible_resources for CWS compliance). They request the
  // resolved config here instead: which also gives them the live Vercel
  // credentials rather than the empty local fallback.
  //
  // Le jeton d'accès Twitch n'est PAS renvoyé : aucun content script n'en
  // a besoin (twitchPlayerEnhancer ne lit que features) et un jeton
  // diffusable à n'importe quelle page hôte serait un secret public.
  (async () => {
    try {
      await ensureConfig();
      sendResponse({
        clientId: CONFIG.clientId || "",
        features: CONFIG.features || {},
      });
    } catch (error) {
      console.warn("[SP] getConfig indisponible", error);
      sendResponse({ clientId: "", features: {} });
    }
  })();
  return true;
}

export function handleTrackWatchTime(request, sender, sendResponse) {
  // Un seul onglet compte par chaîne et par minute : deux fenêtres sur le
  // même live ne doivent pas doubler le temps de visionnage. Sans onglet
  // (popup, tests), compter normalement.
  const tabId = sender?.tab?.id;
  const claimedSeconds = (Number(request.seconds) || 0) > 0 && !watchTimeTabClaims(request.platform, request.channel, tabId);
  (async () => {
    try {
      const { channel, platform, seconds } = request;
      if (channel && platform) {
        const secs = claimedSeconds ? 0 : Number(seconds) || 0;
        const game = secs > 0 ? String(request.game || "") || (await currentGameOf(platform, channel)) : "";
        // Record immediately: never block on avatar resolution
        await WatchTimeStore.record(platform, channel, secs, "", game);
        HistoryStore.markWatched(platform, channel).catch(() => {});
        // Best-effort avatar update (fire-and-forget, doesn't block response)
        if (secs > 0) {
          resolveChannelAvatar(platform, channel)
            .then(async (avatar) => {
              if (avatar) {
                // RMW passe par la file du store, comme record().
                await WatchTimeStore._enqueue(async () => {
                  const data = await WatchTimeStore._getData();
                  const month = WatchTimeStore._getMonthKey();
                  const key = `${platform}:${channel}`;
                  if (data[month]?.[key] && !data[month][key].avatarUrl) {
                    data[month][key].avatarUrl = avatar;
                    await WatchTimeStore._saveData(data);
                  }
                });
              }
            })
            .catch(() => {});
        }
      }
      sendResponse({ success: true, counted: !claimedSeconds });
    } catch (error) {
      sendResponse({ error: error.message });
    }
  })();
  return true;
}

export function handleMarkHistorySeen(request, sender, sendResponse) {
  HistoryStore.markSeen(String(request.id || ""))
    .then(() => sendResponse({ success: true }))
    .catch((error) => sendResponse({ error: error.message }));
  return true;
}

export function handleRemoveHistoryEntry(request, sender, sendResponse) {
  HistoryStore.removeEntry(String(request.id || ""))
    .then(() => sendResponse({ success: true }))
    .catch((error) => sendResponse({ error: error.message }));
  return true;
}

export function handleIncrementStat(request, sender, sendResponse) {
  (async () => {
    try {
      const { stat, value, channel, text, raidTarget } = request;
      if (stat) {
        await StatsStore.increment(stat, Number(value) || 1);
        let type = "info";
        if (stat === "dropsClaimed") type = "drop";
        else if (stat === "momentsClaimed") type = "moment";
        else if (stat === "raidsCancelled") type = "raid";
        else if (stat === "channelPointsClaimed") type = "points";

        let logText = text || `${stat} (+${value || 1})`;
        if (!text && type === "raid" && raidTarget) {
          logText = `Raid → ${raidTarget} (annulé)`;
        }

        await EventLogStore.addLog({
          type,
          channel: channel || "",
          text: logText,
          value: value || 1,
        });

        // Alertes d'evenement. On passe par NotificationCenter comme partout
        // ailleurs : il resout l'icone en URL absolue, retombe sur l'icone
        // embarquee si le telechargement echoue, et attrape le rejet.
        //
        // Les deux appels directs qui vivaient ici passaient un chemin
        // relatif ("images/photos/128px.png"). Un service worker resout le
        // relatif contre sa propre URL, soit js/images/photos/128px.png, qui
        // n'existe pas : Chrome refusait la notification entiere avec
        // « Unable to download all specified images », et faute de callback
        // la promesse rejetee remontait en Uncaught (in promise).
        const prefs = await PreferenceStore.get();
        if (type === "drop" && prefs.dropAlerts) {
          await NotificationCenter.show({
            title: translateWithPrefs(prefs, "background.notifications.dropTitle"),
            message: text || translateWithPrefs(prefs, "background.notifications.dropMessage"),
          });
        } else if (type === "raid" && prefs.raidAlerts) {
          await NotificationCenter.show({
            title: translateWithPrefs(prefs, "background.notifications.raidTitle"),
            message: text || translateWithPrefs(prefs, "background.notifications.raidMessage"),
          });
        }
      }
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ error: error?.message || String(error) });
    }
  })();
  return true;
}

export function handleGetEventLogs(request, sender, sendResponse) {
  respond(async () => ({ logs: await EventLogStore.getLogs() }), sendResponse, "getEventLogs");
  return true;
}

export function handleClearEventLogs(request, sender, sendResponse) {
  respond(async () => ({ logs: await EventLogStore.clearLogs() }), sendResponse, "clearEventLogs");
  return true;
}

export function handleResetStat(request, sender, sendResponse) {
  (async () => {
    try {
      const { stat } = request;
      if (stat) {

        const current = await StatsStore.get();
        current[stat] = 0;
        await chrome.storage.local.set({ [STORAGE_KEYS.STATS]: current });
      }
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ error: error?.message || String(error) });
    }
  })();
  return true;
}
