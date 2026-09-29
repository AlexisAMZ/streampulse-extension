// Handlers de messages runtime (voir messages.js pour la table).

import { sanitizeHandle } from "../platforms.js";
import { applyStreamerOrder, sanitizePinnedIds } from "../streamers-data.js";
import { translateWithPrefs } from "./i18n.js";
import { reply, respond } from "./message-dispatch.js";
import { addStreamer } from "./add-streamer.js";
import { PlatformChecker } from "./platform-checker.js";
import { pollStreamers } from "./polling.js";
import { streamerCache, streamerLiveState, streamerStates } from "./state.js";
import { DataStore, PreferenceStore } from "./stores.js";
import { suggestChannels } from "./suggest.js";

export function handleGetStreamers(request, sender, sendResponse) {
  (async () => {
    try {
      const [streamers, statuses, preferences, profileData] = await Promise.all([
        DataStore.getStreamers(),
        DataStore.getStatuses(),
        PreferenceStore.get(),
        chrome.storage.local.get("userProfile")
      ]);
      sendResponse({ streamers, statuses, preferences, userProfile: profileData.userProfile || null });
    } catch (error) {
      sendResponse({ error: error?.message || String(error) });
    }
  })();
  return true;
}

export function handleLookupTwitchUser(request, sender, sendResponse) {
  const handle = sanitizeHandle("twitch", request.handle || "");
  if (!handle) { sendResponse({ error: "invalid" }); return true; }
  PlatformChecker.getTwitchUser(handle)
    .then(user => {
      if (!user || user._apiError) {
        sendResponse({ user: null });
      } else {
        sendResponse({ user: { display_name: user.display_name, profile_image_url: user.profile_image_url, id: user.id } });
      }
    })
    .catch(() => sendResponse({ user: null }));
  return true;
}

export function handleSearchChannels(request, sender, sendResponse) {
  suggestChannels(String(request.platform || ""), String(request.query || ""))
    .then((items) => sendResponse({ items }))
    .catch((error) => {
      console.warn("[StreamPulse] suggestions de chaînes :", error?.message || error);
      sendResponse({ items: [], error: "unavailable" });
    });
  return true;
}

export function handleAddStreamer(request, sender, sendResponse) {
  reply(() => addStreamer(request), sendResponse, "addStreamer");
  return true;
}

export function handleRemoveStreamer(request, sender, sendResponse) {
  (async () => {
    try {
      const targetId = request.id;
      const streamers = await DataStore.getStreamers();
      const filtered = streamers.filter((s) => s.id !== targetId);
      await DataStore.saveStreamers(filtered);
      streamerStates.delete(targetId);
      streamerCache.delete(targetId);
      streamerLiveState.delete(targetId);
      await pollStreamers({ forceNotification: false });
      sendResponse({ success: true, streamers: filtered });
    } catch (error) {
      sendResponse({ error: error?.message || String(error) });
    }
  })();
  return true;
}

export function handleToggleNotificationFlag(request, sender, sendResponse) {
  // Trois messages jumeaux : le nom du flag decoule du type de message.
  const flagByType = {
    toggleNotifications: "notificationsEnabled",
    toggleGameNotifications: "gameNotificationsEnabled",
    toggleTitleNotifications: "titleNotificationsEnabled",
  };
  respond(async () => {
    const preferences = await PreferenceStore.get();
    const streamers = await DataStore.getStreamers();
    const idx = streamers.findIndex((s) => s.id === request.id);
    if (idx === -1) {
      throw new Error(translateWithPrefs(preferences, "background.errors.streamerNotFound", { platform: "" }));
    }
    streamers[idx][flagByType[request.type]] = Boolean(request.enabled);
    await DataStore.saveStreamers(streamers);
    return {};
  }, sendResponse, request.type);
  return true;
}

export function handleRefreshStatuses(request, sender, sendResponse) {
  respond(() => PlatformChecker.refreshAll(), sendResponse, "refreshStatuses");
  return true;
}

export function handleReorderStreamers(request, sender, sendResponse) {
  // { order: [id, …] } : la popup n'envoie qu'un ordre d'identifiants, le
  // service worker l'applique au stockage courant — un statut rafraîchi
  // pendant le glisser ne peut plus être écrasé par sa copie d'ouverture.
  respond(async () => {
    const streamers = await DataStore.getStreamers();
    const reordered = applyStreamerOrder(streamers, request.order);
    await DataStore.saveStreamers(reordered);
    return { streamers: reordered };
  }, sendResponse, "reorderStreamers");
  return true;
}

export function handleSetPinnedStreamers(request, sender, sendResponse) {
  // { pinnedIds: [id, …] } : même principe, écrit depuis le stockage
  // courant et nettoyé (ids inconnus, doublons).
  respond(async () => {
    const streamers = await DataStore.getStreamers();
    const pinnedIds = sanitizePinnedIds(streamers, request.pinnedIds);
    await chrome.storage.local.set({ betaPinnedIds: pinnedIds });
    return { pinnedIds };
  }, sendResponse, "setPinnedStreamers");
  return true;
}
