// Lecture pure des pseudos de comptes connectés (sans API Chrome, testable seule).

import { sanitizeHandle } from "./platforms.js";

/** Pseudo Kick d'une réponse /api/v1/user : slug de la chaîne, sinon nom d'utilisateur. */
export function kickLoginFromUser(user) {
  const raw = user?.streamer_channel?.slug || user?.username || "";
  return typeof raw === "string" ? sanitizeHandle("kick", raw) : "";
}

/**
 * ID de la chaîne du compte connecté, lu dans youtube.com/account : le bloc
 * « Votre chaîne » (channelOptionsRenderer) porte son lien /channel/UC… ; la page
 * ne contient pas le @handle. "" si déconnecté ou sans chaîne.
 */
export function youtubeChannelIdFromAccountHtml(html) {
  if (typeof html !== "string" || !/"LOGGED_IN"\s*:\s*true/.test(html)) return "";
  const start = html.indexOf('"channelOptionsRenderer"');
  if (start < 0) return "";
  const block = html.slice(start);
  return /\/channel\/(UC[\w-]{10,32})/.exec(block)?.[1] || "";
}

/** @handle d'une page de chaîne, lu dans son lien canonique ; "" si la chaîne n'en a pas. */
export function youtubeHandleFromChannelHtml(html) {
  if (typeof html !== "string") return "";
  const raw = /<link rel="canonical" href="https:\/\/www\.youtube\.com\/@([^"\/]{3,30})"/.exec(html)?.[1] || "";
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return "";
  }
  return decoded ? sanitizeHandle("youtube", decoded) : "";
}
