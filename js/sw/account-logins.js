// Pseudos des comptes connectés dans le navigateur, pour préremplir l'onboarding
// sans rien taper : Twitch (cookie « login »), Kick (session_token → /api/v1/user)
// et YouTube (page « compte » lue avec la session). Chaque lecture renvoie "" au
// moindre doute : le champ reste alors vide et se saisit à la main.

import { kickLoginFromUser, youtubeChannelIdFromAccountHtml, youtubeHandleFromChannelHtml } from "../account-logins-parse.js";
import { fetchKickUser } from "./kick-account.js";
import { readTwitchLogin } from "./profile-lookup.js";

const YOUTUBE_ACCOUNT_URL = "https://www.youtube.com/account";
const YOUTUBE_TIMEOUT_MS = 8_000;

async function readKickLogin() {
  return kickLoginFromUser(await fetchKickUser());
}

async function fetchYoutubeHtml(url, credentials) {
  const response = await fetch(url, { credentials, signal: AbortSignal.timeout(YOUTUBE_TIMEOUT_MS) });
  // Mur de consentement européen : pas de page de chaîne, donc rien à lire.
  if (!response.ok || new URL(response.url).hostname === "consent.youtube.com") return "";
  return response.text();
}

/** @handle de la chaîne du compte YouTube connecté : page compte → ID → page de la chaîne (avec la session : sans elle, YouTube renvoie vers son mur de consentement en Europe). */
async function readYoutubeHandle() {
  try {
    const channelId = youtubeChannelIdFromAccountHtml(await fetchYoutubeHtml(YOUTUBE_ACCOUNT_URL, "include"));
    if (!channelId) return "";
    return youtubeHandleFromChannelHtml(await fetchYoutubeHtml(`https://www.youtube.com/channel/${channelId}`, "include"));
  } catch {
    return "";
  }
}

/** { twitch, kick, youtube } : un pseudo par plateforme où une session est ouverte. */
export async function readAccountLogins() {
  const [twitch, kick, youtube] = await Promise.all([readTwitchLogin(), readKickLogin(), readYoutubeHandle()]);
  return { twitch, kick, youtube };
}
