// Profil de l'utilisateur (onboarding, réglage du pseudo) : photo et nom
// affiché cherchés sur Twitch, puis Kick, puis YouTube.

import { sanitizeHandle } from "../platforms.js";
import { resolveKickAsset } from "./normalize.js";
import { PlatformChecker } from "./platform-checker.js";

async function twitchProfile(raw) {
  const handle = sanitizeHandle("twitch", raw);
  if (!handle) return null;
  const user = await PlatformChecker.getTwitchUser(handle).catch(() => null);
  if (!user || user._apiError || !user.profile_image_url) return null;
  return { platform: "twitch", display_name: user.display_name || handle, profile_image_url: user.profile_image_url };
}

async function kickProfile(raw) {
  const handle = sanitizeHandle("kick", raw);
  if (!handle) return null;
  const channel = await PlatformChecker.getKickChannelV2(handle).catch(() => null);
  const avatar = resolveKickAsset(channel?.user?.profile_pic) || "";
  if (!channel || channel._apiError || !avatar) return null;
  return { platform: "kick", display_name: channel.user?.username || handle, profile_image_url: avatar };
}

async function youtubeProfile(raw) {
  const handle = sanitizeHandle("youtube", raw);
  if (!handle) return null;
  const channel = await PlatformChecker.resolveYoutubeChannel(handle).catch(() => null);
  if (!channel?.avatar) return null;
  return { platform: "youtube", display_name: channel.name || handle, profile_image_url: channel.avatar };
}

/** Premier profil trouvé (Twitch d'abord : c'est la plateforme la plus courante), ou null. */
export async function lookupUserProfile(raw) {
  const twitch = await twitchProfile(raw);
  if (twitch) return twitch;
  const [kick, youtube] = await Promise.all([kickProfile(raw), youtubeProfile(raw)]);
  return kick || youtube || null;
}

/** Pseudo du compte Twitch connecté dans le navigateur (cookie « login »), ou "". */
export async function readTwitchLogin() {
  try {
    const cookie = await chrome.cookies.get({ url: "https://www.twitch.tv", name: "login" });
    return sanitizeHandle("twitch", decodeURIComponent(cookie?.value || ""));
  } catch (error) {
    console.warn("[SP] cookie Twitch illisible :", error?.message || error);
    return "";
  }
}
