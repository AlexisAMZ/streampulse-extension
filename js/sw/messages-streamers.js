// Handlers de messages runtime (voir messages.js pour la table).

import { IMPORTED_FOLLOWS_KEY, planImportedRemoval } from "../imported-follows.js";
import { sanitizeHandle } from "../platforms.js";
import { applyStreamerOrder, pruneStreamerRefs, sanitizePinnedIds } from "../streamers-data.js";
import { translateWithPrefs } from "./i18n.js";
import { reply, respond } from "./message-dispatch.js";
import { readAccountLogins } from "./account-logins.js";
import { addStreamer } from "./add-streamer.js";
import { PlatformChecker } from "./platform-checker.js";
import { pollStreamers } from "./polling.js";
import { PROFILE_PLATFORMS, lookupUserProfile, readTwitchLogin } from "./profile-lookup.js";
import { streamerCache, streamerLiveState, streamerStates } from "./state.js";
import { DataStore, PreferenceStore } from "./stores.js";
import { suggestCategories, suggestChannels } from "./suggest.js";

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
  const raw = String(request.handle || "").trim().replace(/^@/, "");
  if (!sanitizeHandle("twitch", raw) && !sanitizeHandle("youtube", raw)) { sendResponse({ error: "invalid" }); return true; }
  const platform = PROFILE_PLATFORMS.includes(request.platform) ? request.platform : "";
  lookupUserProfile(raw, platform)
    .then((user) => sendResponse({ user }))
    .catch(() => sendResponse({ user: null }));
  return true;
}

export function handleGetTwitchLogin(request, sender, sendResponse) {
  readTwitchLogin().then((login) => sendResponse({ login }));
  return true;
}

export function handleGetAccountLogins(request, sender, sendResponse) {
  readAccountLogins()
    .then((logins) => sendResponse({ logins }))
    .catch(() => sendResponse({ logins: { twitch: "", kick: "", youtube: "" } }));
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

export function handleSearchCategories(request, sender, sendResponse) {
  suggestCategories(String(request.platform || ""), String(request.query || ""))
    .then((items) => sendResponse({ items }))
    .catch((error) => {
      console.warn("[StreamPulse] suggestions de catégories :", error?.message || error);
      sendResponse({ items: [], error: "unavailable" });
    });
  return true;
}

export function handleAddStreamer(request, sender, sendResponse) {
  reply(() => addStreamer(request), sendResponse, "addStreamer");
  return true;
}

async function pruneRemovedStreamerRefs(targetId) {
  // Épingle et groupe : sinon l'id reste orphelin (l'Annuler du popup les
  // restaure depuis sa propre photo, prise avant la suppression).
  const stored = await chrome.storage.local.get(["betaPinnedIds", "betaChannelGroups"]);
  const pruned = pruneStreamerRefs({ pinnedIds: stored.betaPinnedIds, groups: stored.betaChannelGroups }, targetId);
  if (!pruned.changed) return;
  await chrome.storage.local.set({ betaPinnedIds: pruned.pinnedIds, betaChannelGroups: pruned.groups });
}

export function handleRemoveStreamer(request, sender, sendResponse) {
  (async () => {
    try {
      const targetId = request.id;
      const streamers = await DataStore.getStreamers();
      const filtered = streamers.filter((s) => s.id !== targetId);
      await DataStore.saveStreamers(filtered);
      await pruneRemovedStreamerRefs(targetId);
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

// Retrait groupé des chaînes importées : un seul sondage à la fin, et réservé aux
// pages de l'extension (un content script n'a aucune raison de vider une liste).
export function handleRemoveImportedFollows(request, sender, sendResponse) {
  respond(async () => {
    if (sender?.id !== chrome.runtime.id || !String(sender?.url || "").startsWith(chrome.runtime.getURL(""))) {
      throw new Error("forbidden");
    }
    const stored = await chrome.storage.local.get([IMPORTED_FOLLOWS_KEY, "betaPinnedIds", "betaChannelGroups"]);
    const plan = planImportedRemoval({
      registry: stored[IMPORTED_FOLLOWS_KEY],
      streamers: await DataStore.getStreamers(),
      pinnedIds: stored.betaPinnedIds,
      groups: stored.betaChannelGroups,
    });
    const streamers = await DataStore.saveStreamers(plan.streamers);
    await chrome.storage.local.set({ betaPinnedIds: plan.pinnedIds, betaChannelGroups: plan.groups, [IMPORTED_FOLLOWS_KEY]: [] });
    for (const id of plan.removedIds) {
      streamerStates.delete(id);
      streamerCache.delete(id);
      streamerLiveState.delete(id);
    }
    await pollStreamers({ forceNotification: false });
    return { removed: plan.removedIds.length, streamers };
  }, sendResponse, request.type);
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
