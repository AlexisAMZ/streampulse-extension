// Ajout d'un streamer (message addStreamer) : validation du pseudo, doublon,
// résolution de la chaîne auprès de la plateforme, puis écriture et sondage.

import { formatHandleForDisplay, getHandleComparisonKey, getPlatformLabelKey, normalizePlatform, sanitizeHandle } from "../platforms.js";
import { translateWithPrefs } from "./i18n.js";
import { normalizeStreamer, resolveExternalUrl } from "./normalize.js";
import { PlatformChecker } from "./platform-checker.js";
import { pollStreamers } from "./polling.js";
import { DataStore, PreferenceStore } from "./stores.js";

/** Message d'erreur traduit, avec le nom de la plateforme en paramètre. */
function platformError(preferences, key, platform) {
  const label = translateWithPrefs(preferences, getPlatformLabelKey(platform));
  return { error: translateWithPrefs(preferences, key, { platform: label }) };
}

function lookupErrorKey(result) {
  return result?._apiError ? "background.errors.apiError" : "background.errors.streamerNotFound";
}

function findFollowed(streamers, platform, handle) {
  const incomingKey = getHandleComparisonKey(platform, handle);
  return streamers.find(
    (streamer) => getHandleComparisonKey(streamer.platform || "twitch", streamer.handle || streamer.twitch || streamer.id) === incomingKey
  );
}

async function twitchSource(handle) {
  const user = await PlatformChecker.getTwitchUser(handle);
  if (!user || user._apiError) return { errorKey: lookupErrorKey(user) };
  return {
    data: { id: handle, twitch: handle, displayName: user.display_name || handle, avatarUrl: user.profile_image_url || "", twitchId: user.id },
  };
}

async function kickSource(handle) {
  const channel = await PlatformChecker.getKickChannel(handle);
  if (!channel || channel._apiError) return { errorKey: lookupErrorKey(channel) };
  return {
    data: {
      displayName: channel?.user?.display_name || channel?.user?.username || channel?.slug || formatHandleForDisplay("kick", handle),
      avatarUrl: resolveExternalUrl(channel?.user?.profile_pic, "https://files.kick.com"),
      handle: channel?.slug || handle,
    },
  };
}

/** La chaîne YouTube doit exister : handle → channelId (avatar et nom au passage). */
async function youtubeSource(handle) {
  const channel = await PlatformChecker.resolveYoutubeChannel(handle);
  if (!channel?.id) return { errorKey: "background.errors.streamerNotFound" };
  return { data: { displayName: channel.name || formatHandleForDisplay("youtube", handle), avatarUrl: channel.avatar || "" } };
}

/** Données propres à la plateforme : { data } ou { errorKey }. */
function platformSource(platform, handle, request) {
  if (platform === "twitch") return twitchSource(handle);
  if (platform === "kick") return kickSource(handle);
  if (platform === "youtube") return youtubeSource(handle);
  return { data: { displayName: request.displayName || formatHandleForDisplay(platform, handle), avatarUrl: request.avatarUrl || "" } };
}

/** Résultat renvoyé tel quel à la popup : { success, streamers } ou { error }. */
export async function addStreamer(request) {
  const preferences = await PreferenceStore.get();
  const platform = normalizePlatform(request.platform || "twitch");
  const handle = sanitizeHandle(platform, request.handle ?? request.twitch ?? request.login ?? request.url ?? "");
  if (!handle) return platformError(preferences, "background.errors.invalidHandle", platform);

  const streamers = await DataStore.getStreamers();
  const existing = findFollowed(streamers, platform, handle);
  // Déjà suivie avec une photo saine : doublon, refus. Déjà suivie avec un
  // avatar cassé (vide, ou chemin du logo de la plateforme stocké par un
  // ancien ajout) : la ré-ajout répare l'entrée au lieu de la refuser —
  // c'est exactement le flux « je vois la vraie photo dans les suggestions,
  // je clique, et rien ne change ».
  if (existing && /^https?:\/\//i.test(existing.avatarUrl || "")) {
    return platformError(preferences, "background.errors.streamerExistsPlatform", platform);
  }

  const source = await platformSource(platform, handle, request);
  if (source.errorKey) return platformError(preferences, source.errorKey, platform);

  const sourceData = {
    platform,
    handle,
    // Défauts des nouveaux streamers : les réglages globaux du moment,
    // pas un true en dur (les réglages globaux ne sont pas des verrous).
    notificationsEnabled: preferences.liveNotifications,
    gameNotificationsEnabled: preferences.gameNotifications,
    titleNotificationsEnabled: preferences.titleNotifications,
    socials: {},
    ...source.data,
  };

  if (existing) {
    // Réparation : photo et nom rafraîchis sur l'entrée existante, aucune
    // duplication. Le sondage suivant recable statut et vignettes.
    const index = streamers.indexOf(existing);
    streamers[index] = normalizeStreamer({
      ...existing,
      avatarUrl: sourceData.avatarUrl || existing.avatarUrl,
      displayName: sourceData.displayName || existing.displayName,
    });
    const updated = await DataStore.saveStreamers(streamers);
    await pollStreamers({ forceNotification: false });
    return { success: true, streamers: updated };
  }

  const id = platform === "twitch" ? sourceData.twitch : `${platform}:${sanitizeHandle(platform, sourceData.handle)}`;
  const updated = await DataStore.saveStreamers([...streamers, normalizeStreamer({ ...sourceData, id })]);
  await pollStreamers({ forceNotification: false });
  return { success: true, streamers: updated };
}
