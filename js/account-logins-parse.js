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

// Où la page d'une chaîne donne son @handle (son lien canonique pointe sur /channel/UC…).
// Du plus propre à la chaîne affichée au plus général.
const HANDLE_PATTERNS = [
  /"ownerUrls"\s*:\s*\[\s*"https?:\\?\/\\?\/www\.youtube\.com\\?\/@([^"\\\/]{3,60})"/,
  /"vanityChannelUrl"\s*:\s*"https?:\\?\/\\?\/www\.youtube\.com\\?\/@([^"\\\/]{3,60})"/,
  /"canonicalBaseUrl"\s*:\s*"\\?\/@([^"\\\/]{3,60})"/,
];

/** @handle d'une page de chaîne ; "" si la chaîne n'en a pas. */
export function youtubeHandleFromChannelHtml(html) {
  if (typeof html !== "string") return "";
  for (const pattern of HANDLE_PATTERNS) {
    const raw = pattern.exec(html)?.[1];
    if (!raw) continue;
    try {
      const decoded = decodeURIComponent(raw);
      const handle = sanitizeHandle("youtube", decoded);
      // Le nettoyage retire les caractères qu'il ne gère pas (accents) : mieux vaut ne rien remplir qu'un faux pseudo.
      if (handle && handle.toLowerCase() === decoded.toLowerCase()) return handle;
    } catch {
      // Handle mal encodé : on essaie le motif suivant.
    }
  }
  return "";
}
