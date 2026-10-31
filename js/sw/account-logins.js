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
  const user = await fetchKickUser();
  const login = kickLoginFromUser(user);
  if (!login) console.info("[SP] pseudo Kick : rien lu", user ? `champs reçus : ${Object.keys(user).join(", ")}` : "pas de session ou réponse refusée");
  return login;
}

async function fetchYoutubeHtml(url, credentials) {
  const response = await fetch(url, { credentials, signal: AbortSignal.timeout(YOUTUBE_TIMEOUT_MS) });
  // Mur de consentement européen : pas de page de chaîne, donc rien à lire.
  if (!response.ok || new URL(response.url).hostname === "consent.youtube.com") {
    console.info("[SP] pseudo YouTube : page refusée", new URL(response.url).hostname, response.status);
    return "";
  }
  return response.text();
}

/** @handle de la chaîne du compte YouTube connecté : page compte → ID → page de la chaîne (avec la session : sans elle, YouTube renvoie vers son mur de consentement en Europe). */
async function readYoutubeHandle() {
  try {
    const channelId = youtubeChannelIdFromAccountHtml(await fetchYoutubeHtml(YOUTUBE_ACCOUNT_URL, "include"));
    if (!channelId) {
      console.info("[SP] pseudo YouTube : pas de chaîne trouvée dans la page compte");
      return "";
    }
    const handle = youtubeHandleFromChannelHtml(await fetchYoutubeHtml(`https://www.youtube.com/channel/${channelId}`, "include"));
    if (!handle) console.info("[SP] pseudo YouTube : chaîne trouvée mais @handle illisible");
    return handle;
  } catch (error) {
    console.info("[SP] pseudo YouTube : échec", error?.message || error);
    return "";
  }
}

/** { twitch, kick, youtube } : un pseudo par plateforme où une session est ouverte. */
export async function readAccountLogins() {
  const [twitch, kick, youtube] = await Promise.all([readTwitchLogin(), readKickLogin(), readYoutubeHandle()]);
  return { twitch, kick, youtube };
}
