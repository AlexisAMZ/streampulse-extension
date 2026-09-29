// Raids entrants détectés en arrière-plan (EventSub, repli IRC).

import { stopEventSubRaid, syncEventSubRaid } from "../eventsubRaid.js";
import { buildProfileUrl, formatHandleForDisplay, getHandleComparisonKey } from "../platforms.js";
import { normalizeLanguage } from "../preferences-data.js";
import { stopRaidWatcher, syncRaidWatcher } from "../raidWatcher.js";
import { CONFIG, ensureConfig, twitchHeaders } from "./config.js";
import { STORAGE_KEYS } from "./constants.js";
import { formatNumberForLanguage, translate } from "./i18n.js";
import { NotificationCenter } from "./notifications.js";
import { PreferenceStore } from "./stores.js";
import { resolveChannelAvatar } from "./watchtime.js";

// ─── Bêta : détection des raids entrants en arrière-plan ────────────────────
//
// Le watcher IRC est opt-in (backgroundRaidAlerts) : une fois activé, il
// maintient une connexion anonyme vers les chaînes Twitch favorites. Voir
// js/raidWatcher.js pour le détail du protocole et les limites de coût.

export async function refreshRaidWatcher() {
  try {
    const preferences = await PreferenceStore.get();
    if (preferences.backgroundRaidAlerts !== true) {
      stopEventSubRaid();
      stopRaidWatcher();
      return;
    }
    // EventSub d'abord : l'evenement channel.raid part au DEBUT du compte a
    // rebours (~90 s avant l'arrivee), la ou l'IRC n'entend le raid qu'a son
    // atterrissage. L'IRC reste le repli si l'Helix token n'est pas disponible.
    await ensureConfig();
    if (CONFIG.accessToken && CONFIG.clientId) {
      const active = await syncEventSubRaid(notifyIncomingRaid, twitchHeaders);
      if (active) {
        // Les deux en meme temps notifieraient chaque raid deux fois.
        stopRaidWatcher();
        return;
      }
    }
    await syncRaidWatcher(notifyIncomingRaid);
  } catch (error) {
    console.warn("Raid watcher sync failed:", error.message);
  }
}

export async function notifyIncomingRaid({ channel, raider, viewers }) {
  const preferences = await PreferenceStore.get();
  const lang = normalizeLanguage(preferences?.language);

  const displayName = await resolveChannelDisplayName(channel);
  const viewersText = formatNumberForLanguage(lang, viewers || 0);

  let iconUrl = null;
  try {
    iconUrl = await resolveChannelAvatar("twitch", channel);
  } catch (error) {
    // L'avatar est décoratif : la notification part sans icône dédiée.
    console.warn("[SP] avatar du raid :", error?.message || error);
  }

  await NotificationCenter.show({
    title: translate(lang, "background.notifications.raidIncomingTitle", {
      name: displayName,
    }),
    message: translate(lang, "background.notifications.raidIncomingMessage", {
      raider: raider || translate(lang, "common.unknown"),
      viewers: viewersText,
    }),
    platform: "twitch",
    // Les points de raid se gagnent en arrivant DEPUIS le stream du raid
    // partant : on ouvre chez {{raider}}, pas sur la chaîne raidée.
    url: buildProfileUrl("twitch", raider),
    iconUrl,
    requireInteraction: false,
    priority: 1,
    playSound: preferences?.soundsEnabled !== false,
  });
}

// Le handle IRC est en minuscules ; on récupère le nom d'affichage connu des
// données de l'extension avant de retomber sur le handle brut.
async function resolveChannelDisplayName(channel) {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.STREAMERS);
    const streamers = Array.isArray(stored[STORAGE_KEYS.STREAMERS])
      ? stored[STORAGE_KEYS.STREAMERS]
      : [];
    const match = streamers.find(
      (s) =>
        (s.platform || "twitch") === "twitch" &&
        getHandleComparisonKey("twitch", s.handle || s.twitch || s.id || "") ===
          getHandleComparisonKey("twitch", channel)
    );
    if (match?.displayName || match?.name) {
      return match.displayName || match.name;
    }
  } catch (error) {
    // Lecture de storage échouée : on retombe sur le handle.
    console.warn("[SP] nom de la chaîne raidée :", error?.message || error);
  }
  return formatHandleForDisplay("twitch", channel);
}
