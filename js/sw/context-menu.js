// Menu contextuel « Ajouter à StreamPulse » sur les liens de chaîne Twitch,
// Kick et YouTube. Le raccourci clavier (chrome.commands, Alt+Shift+S) ouvre
// le popup : déclaré dans le manifest, rien à gérer ici.

import { addStreamer } from "./add-streamer.js";
import { PREFERENCES_KEY } from "./constants.js";
import { translateWithPrefs } from "./i18n.js";
import { NotificationCenter } from "./notifications.js";
import { PreferenceStore } from "./stores.js";

const MENU_ID = "sp-add-streamer";
const TARGET_PATTERNS = [
  "https://www.twitch.tv/*",
  "https://kick.com/*",
  "https://www.youtube.com/*",
];

// Routes Twitch qui ne sont pas des chaînes (liste courte, côté page la liste
// canonique vit dans js/inject/dom.js, non importable depuis le SW).
const TWITCH_ROUTES = new Set([
  "directory", "settings", "videos", "downloads", "following", "search",
  "p", "u", "about", "turbo", "prime", "jobs", "legal", "privacy", "terms",
  "companies", "tags", "music", "dev", "twitch", "moderator", "team", "chat",
]);
// Kick : mêmes exclusions que le tracker (watchTimeTracker.js), plus le catalogue.
const KICK_ROUTES = new Set([
  "categories", "following", "search", "dashboard", "video", "browse", "community",
]);

/** Platform + handle d'un lien, ou null si ce n'est pas une page de chaîne. */
export function channelFromLink(linkUrl) {
  let url;
  try {
    url = new URL(String(linkUrl || ""));
  } catch {
    return null;
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (!parts.length) return null;
  const first = (parts[0] || "").toLowerCase();

  if (url.hostname === "www.twitch.tv" || url.hostname === "twitch.tv") {
    if (first.charAt(0) === "@" || TWITCH_ROUTES.has(first) || first.length > 60) return null;
    return { platform: "twitch", handle: first };
  }
  if (url.hostname.endsWith("kick.com")) {
    if (KICK_ROUTES.has(first) || first.length > 60) return null;
    return { platform: "kick", handle: first };
  }
  if (url.hostname === "www.youtube.com" || url.hostname === "youtube.com") {
    if (first.startsWith("@")) return { platform: "youtube", handle: first.slice(1).toLowerCase() };
    if (first === "channel" && parts[1]) return { platform: "youtube", handle: parts[1].toLowerCase() };
    return null;
  }
  return null;
}

async function rebuildMenu() {
  const prefs = await PreferenceStore.get();
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: MENU_ID,
    title: translateWithPrefs(prefs, "background.contextMenu.add"),
    contexts: ["link"],
    targetUrlPatterns: TARGET_PATTERNS,
  });
}

export function initContextMenu() {
  // Garde sur contextMenus : absent de certains environnements de test qui ne
  // moquent que le strict nécessaire.
  if (!chrome.contextMenus?.onClicked) return;
  rebuildMenu().catch((error) => console.warn("[SP] menu contextuel :", error?.message || error));
  // Le libellé suit la langue choisie dans les réglages.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[PREFERENCES_KEY]) {
      rebuildMenu().catch(() => {});
    }
  });
  chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId !== MENU_ID) return;
    const channel = channelFromLink(info.linkUrl);
    if (!channel) return;
    (async () => {
      const prefs = await PreferenceStore.get();
      const result = await addStreamer({ platform: channel.platform, handle: channel.handle });
      if (result?.success) {
        await NotificationCenter.show({
          title: translateWithPrefs(prefs, "background.contextMenu.add"),
          message: translateWithPrefs(prefs, "background.contextMenu.added", { name: channel.handle }),
        });
      } else if (result?.message) {
        // Doublon ou chaîne introuvable : le message du handler est déjà traduit.
        await NotificationCenter.show({
          title: translateWithPrefs(prefs, "background.contextMenu.add"),
          message: result.message,
        });
      }
    })().catch((error) => console.warn("[SP] ajout via menu contextuel :", error?.message || error));
  });
}
