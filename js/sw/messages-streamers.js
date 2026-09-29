// Handlers de messages runtime (voir messages.js pour la table).

import { DEFAULT_PLATFORM, formatHandleForDisplay, getHandleComparisonKey, getPlatformLabelKey, normalizePlatform, sanitizeHandle } from "../platforms.js";
import { applyStreamerOrder, sanitizePinnedIds } from "../streamers-data.js";
import { translateWithPrefs } from "./i18n.js";
import { respond } from "./message-dispatch.js";
import { normalizeStreamer, resolveExternalUrl } from "./normalize.js";
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
  (async () => {
    try {
      const preferences = await PreferenceStore.get();
      const requestedPlatform = request.platform || "twitch";
      const platform = normalizePlatform(
        requestedPlatform || DEFAULT_PLATFORM
      );
      const rawHandle =
        request.handle ??
        request.twitch ??
        request.login ??
        request.url ??
        "";
      const handle = sanitizeHandle(platform, rawHandle);

      if (!handle) {
        const platformLabel = translateWithPrefs(
          preferences,
          getPlatformLabelKey(platform)
        );
        sendResponse({
          error: translateWithPrefs(
            preferences,
            "background.errors.invalidHandle",
            { platform: platformLabel }
          ),
        });
        return;
      }

      const streamers = await DataStore.getStreamers();
      const incomingKey = getHandleComparisonKey(platform, handle);
      const alreadyExists = streamers.some((streamer) => {
        const existingKey = getHandleComparisonKey(
          streamer.platform || "twitch",
          streamer.handle || streamer.twitch || streamer.id
        );
        return existingKey === incomingKey;
      });

      if (alreadyExists) {
        const platformLabel = translateWithPrefs(
          preferences,
          getPlatformLabelKey(platform)
        );
        sendResponse({
          error: translateWithPrefs(
            preferences,
            "background.errors.streamerExistsPlatform",
            { platform: platformLabel }
          ),
        });
        return;
      }

      let sourceData = {
        id: `${platform}:${handle}`,
        platform,
        handle,
        // Défauts des nouveaux streamers : les réglages globaux du moment,
        // pas un true en dur (les réglages globaux ne sont pas des verrous).
        notificationsEnabled: preferences.liveNotifications,
        gameNotificationsEnabled: preferences.gameNotifications,
        titleNotificationsEnabled: preferences.titleNotifications,
        socials: {},
      };

      if (platform === "twitch") {
        const user = await PlatformChecker.getTwitchUser(handle);
        if (!user || user._apiError) {
          const errorKey = user?._apiError
            ? "background.errors.apiError"
            : "background.errors.streamerNotFound";
          sendResponse({
            error: translateWithPrefs(
              preferences,
              errorKey,
              {
                platform: translateWithPrefs(
                  preferences,
                  getPlatformLabelKey(platform)
                ),
              }
            ),
          });
          return;
        }

        sourceData = {
          ...sourceData,
          id: handle,
          twitch: handle,
          displayName: user.display_name || handle,
          avatarUrl: user.profile_image_url || "",
          twitchId: user.id,
        };
      } else if (platform === "kick") {
        const channel = await PlatformChecker.getKickChannel(handle);
        if (!channel || channel._apiError) {
          const errorKey = channel?._apiError
            ? "background.errors.apiError"
            : "background.errors.streamerNotFound";
          sendResponse({
            error: translateWithPrefs(
              preferences,
              errorKey,
              {
                platform: translateWithPrefs(
                  preferences,
                  getPlatformLabelKey(platform)
                ),
              }
            ),
          });
          return;
        }

        sourceData = {
          ...sourceData,
          displayName:
            channel?.user?.display_name ||
            channel?.user?.username ||
            channel?.slug ||
            formatHandleForDisplay(platform, handle),
          avatarUrl: resolveExternalUrl(
            channel?.user?.profile_pic,
            "https://files.kick.com"
          ),
          handle: channel?.slug || handle,
        };
      } else if (platform === "youtube") {
        // La chaîne doit exister : on résout handle → channelId (et on
        // garde l'avatar et le nom au passage). Échec = chaîne inconnue.
        const channel = await PlatformChecker.resolveYoutubeChannel(handle);
        if (!channel?.id) {
          sendResponse({
            error: translateWithPrefs(
              preferences,
              "background.errors.streamerNotFound",
              {
                platform: translateWithPrefs(
                  preferences,
                  getPlatformLabelKey(platform)
                ),
              }
            ),
          });
          return;
        }
        sourceData = {
          ...sourceData,
          displayName: channel.name || formatHandleForDisplay(platform, handle),
          avatarUrl: channel.avatar || "",
        };
      } else {
        sourceData = {
          ...sourceData,
          displayName:
            request.displayName ||
            formatHandleForDisplay(platform, handle),
          avatarUrl: request.avatarUrl || "",
        };
      }

      if (platform === "twitch") {
        sourceData.id = sourceData.twitch;
      } else {
        sourceData.id = `${platform}:${sanitizeHandle(
          platform,
          sourceData.handle
        )}`;
      }

      const newStreamer = normalizeStreamer(sourceData);

      const updated = await DataStore.saveStreamers([
        ...streamers,
        newStreamer,
      ]);

      await pollStreamers({ forceNotification: false });

      sendResponse({
        success: true,
        streamers: updated,
      });
    } catch (error) {
      sendResponse({ error: error?.message || String(error) });
    }
  })();
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
