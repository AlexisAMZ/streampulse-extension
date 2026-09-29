// preventTabDiscard : garder actives les pages de chaîne Twitch et Kick.

import { isChannelPageUrl } from "../platforms.js";
import { PREFERENCES_KEY } from "./constants.js";
import { PreferenceStore } from "./stores.js";

// --- preventTabDiscard ------------------------------------------------------
// Le réglage ne concerne que les pages de chaîne Twitch et Kick : ce sont les
// seules pages que l'extension maintient actives (lecteur, points, drops).
// YouTube et les pages hors chaîne (répertoire, réglages…) peuvent être
// déchargées par le navigateur sans rien casser.

// onUpdated pleut à chaque changement de titre ou d'URL : relire le stockage à
// chaque événement serait inutile, on garde une copie locale invalidée par
// storage.onChanged. null = pas encore lu (premier événement après réveil).
let preventTabDiscardEnabled = null;

/** Listener storage.onChanged (posé au top-level par background.js). */
export function onPreferencesChangedForTabDiscard(changes, area) {
  if (area !== "local" || !changes[PREFERENCES_KEY]) return;
  const previous = preventTabDiscardEnabled;
  const stored = changes[PREFERENCES_KEY].newValue || {};
  preventTabDiscardEnabled = stored.preventTabDiscard !== false;
  // En coupant le réglage, rendre leurs onglets au navigateur : sans ça, un
  // onglet marqué resterait non déchargeable pour toujours.
  if (previous === true && preventTabDiscardEnabled === false) {
    unmarkDiscardableTabs().catch((error) => {
      console.warn("[tabs] remise autoDiscardable impossible :", error?.message || error);
    });
  }
}

/** Onglets qu'on avait marqués (chaînes des trois plateformes) : on les relâche tous. */
export async function unmarkDiscardableTabs() {
  let tabs;
  try {
    tabs = await chrome.tabs.query({ autoDiscardable: false });
  } catch (error) {
    console.warn("[tabs] query autoDiscardable impossible :", error?.message || error);
    return;
  }
  const results = await Promise.allSettled(
    tabs
      .filter((tab) => {
        if (typeof tab.url !== "string") return false;
        try {
          const host = new URL(tab.url).hostname.toLowerCase().replace(/^www\./, "");
          return host === "twitch.tv" || host === "kick.com" || host === "youtube.com";
        } catch {
          return false;
        }
      })
      .map((tab) => chrome.tabs.update(tab.id, { autoDiscardable: true })),
  );
  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("[tabs] update autoDiscardable :", result.reason?.message || result.reason);
    }
  }
}

/** Listener tabs.onUpdated (posé au top-level par background.js). */
export async function keepChannelTabLoaded(tabId, changeInfo, tab) {
  const url = tab?.url || changeInfo?.url;
  if (!url || !isChannelPageUrl(url)) return;
  try {
    if (preventTabDiscardEnabled === null) {
      const prefs = await PreferenceStore.get();
      // Faux positif : storage.onChanged met la même valeur à jour, pas une
      // écriture concurrente obsolète ; le pire cas est une relecture.
      /* eslint-disable-next-line require-atomic-updates -- cache invalidé par storage.onChanged. */
      preventTabDiscardEnabled = prefs.preventTabDiscard !== false;
    }
    if (!preventTabDiscardEnabled || tab.autoDiscardable === false) return;
    await chrome.tabs.update(tabId, { autoDiscardable: false });
  } catch (error) {
    // L'onglet peut avoir été fermé entre l'événement et la mise à jour.
    console.warn("[tabs] preventTabDiscard :", error?.message || error);
  }
}
