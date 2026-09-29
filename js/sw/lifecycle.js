// Installation, mise à jour, démarrage : migrations, onboarding, notes de version.

import { DEFAULT_PREFERENCES } from "../preferences-data.js";
import { syncUpdateBadge } from "./action-badge.js";
import { scheduleKeepAliveAlarm, scheduleWatcherAlarm, setupAutoOpenInventoryAlarm } from "./alarms.js";
import { fetchRemoteConfig } from "./config.js";
import { scheduleDropsAlarm } from "./drops.js";
import { translateWithPrefs } from "./i18n.js";
import { NotificationCenter } from "./notifications.js";
import { pollStreamers } from "./polling.js";
import { refreshRaidWatcher } from "./raids.js";
import { DataStore, PreferenceStore } from "./stores.js";

let initDone = false;

export async function openOnboarding(mode = "") {
  const query = mode ? `?mode=${encodeURIComponent(mode)}` : "";
  const url = chrome.runtime.getURL(`html/onboarding.html${query}`);
  try {
    await chrome.tabs.create({ url });
  } catch (error) {
    console.warn("Failed to open onboarding:", error.message);
  }
}

export async function openPatchNotes() {
  const url = chrome.runtime.getURL("html/changelog.html");
  try {
    await chrome.tabs.create({ url });
  } catch (error) {
    console.warn("Failed to open patch notes:", error.message);
  }
}

// Le defaut de la frequence d'ouverture de l'inventaire est passe de 4h a 24h.
// sanitize() ecrit toujours l'objet complet : les installations existantes ont
// donc deja 4h en storage et ne verraient jamais le nouveau defaut. On les
// bascule une seule fois, marquee par un drapeau, pour qu'un retour manuel a 4h
// ne soit pas ecrase a la mise a jour suivante.
export const INVENTORY_INTERVAL_MIGRATION_KEY = "autoOpenInventoryIntervalMigratedTo24h";
export const LEGACY_AUTO_OPEN_INVENTORY_INTERVAL_HOURS = 4;

export async function migrateAutoOpenInventoryInterval() {
  try {
    const stored = await chrome.storage.local.get(INVENTORY_INTERVAL_MIGRATION_KEY);
    if (stored[INVENTORY_INTERVAL_MIGRATION_KEY]) return;

    const preferences = await PreferenceStore.get();
    if (
      Number(preferences.autoOpenInventoryIntervalHours) ===
      LEGACY_AUTO_OPEN_INVENTORY_INTERVAL_HOURS
    ) {
      await PreferenceStore.update({
        autoOpenInventoryIntervalHours:
          DEFAULT_PREFERENCES.autoOpenInventoryIntervalHours,
      });
    }
    await chrome.storage.local.set({ [INVENTORY_INTERVAL_MIGRATION_KEY]: true });
  } catch (error) {
    console.warn("Inventory interval migration failed:", error.message);
  }
}

// 26.9.18 : suivre un raid rapporte des points de chaine, donc l'annulation
// automatique passe a desactivee par defaut. L'ancien defaut (active) etait deja
// ecrit en storage chez tout le monde : on bascule une seule fois, marque par un
// drapeau, pour qu'un utilisateur qui la reactive ne soit pas ecrase ensuite.
export const RAID_CANCEL_MIGRATION_KEY = "autoCancelRaidsMigratedToOff";

export async function migrateAutoCancelRaidsOff() {
  try {
    const stored = await chrome.storage.local.get(RAID_CANCEL_MIGRATION_KEY);
    if (stored[RAID_CANCEL_MIGRATION_KEY]) return;
    await PreferenceStore.update({ autoCancelRaids: false });
    await chrome.storage.local.set({ [RAID_CANCEL_MIGRATION_KEY]: true });
  } catch (error) {
    console.warn("Raid cancel migration failed:", error.message);
  }
}

// Notification « StreamPulse a été mis à jour » : une seule fois par version.
// Le drapeau dédié survit à un éventuel double déclenchement de onInstalled,
// qui ne remet pas seenPatchNotesVersion à jour. Clic : ouvre la page des
// nouveautés. Désactivable dans les Réglages, onglet Alertes.
export const UPDATE_NOTICE_VERSION_KEY = "updateNoticeShownVersion";

export async function notifyUpdateOnce(version) {
  try {
    const preferences = await PreferenceStore.get();
    if (preferences.updateNotifications === false) return;
    const stored = await chrome.storage.local.get(UPDATE_NOTICE_VERSION_KEY);
    if (stored[UPDATE_NOTICE_VERSION_KEY] === version) return;
    await chrome.storage.local.set({ [UPDATE_NOTICE_VERSION_KEY]: version });
    await NotificationCenter.show({
      title: translateWithPrefs(preferences, "background.notifications.updateTitle"),
      message: translateWithPrefs(preferences, "background.notifications.updateMessage"),
      url: chrome.runtime.getURL("html/changelog.html"),
    });
  } catch (error) {
    console.warn("Update notice failed:", error?.message || error);
  }
}

/** Listener chrome.runtime.onInstalled. */
export async function handleInstalled(details) {
  initDone = true;
  await fetchRemoteConfig(); // load credentials before first poll
  const streamers = await DataStore.ensureDefaults();
  await PreferenceStore.ensureDefaults();
  await migrateAutoOpenInventoryInterval();
  await migrateAutoCancelRaidsOff();
  await NotificationCenter.init();
  scheduleWatcherAlarm();
  scheduleKeepAliveAlarm();
  scheduleDropsAlarm();

  await pollStreamers({ forceNotification: false });
  const installReason = details?.reason || "install";
  const currentVersion = chrome.runtime.getManifest().version;

  const { onboardingShown, seenPatchNotesVersion } = await chrome.storage.local.get([
    "onboardingShown",
    "seenPatchNotesVersion",
  ]);

  if (
    installReason === chrome.runtime.OnInstalledReason?.INSTALL ||
    installReason === "install"
  ) {
    // Fresh install: onboarding covers the feature tour, so patch notes would be
    // redundant. Mark this version seen to avoid showing them on the next update.
    if (!onboardingShown && !streamers.length) {
      await chrome.storage.local.set({
        onboardingShown: true,
        seenPatchNotesVersion: currentVersion,
      });
      await openOnboarding();
    } else {
      await chrome.storage.local.set({ seenPatchNotesVersion: currentVersion });
    }
  } else if (
    installReason === chrome.runtime.OnInstalledReason?.UPDATE ||
    installReason === "update"
  ) {
    // Les notes ne s'ouvrent plus d'elles-memes : ouvrir un onglet sans que
    // l'utilisateur l'ait demande est intrusif. On memorise seulement la
    // version vue, pour signaler la nouveaute sur le bouton du popup, et la
    // notification de mise a jour (si active) prend le relais.
    if (seenPatchNotesVersion !== currentVersion) {
      await chrome.storage.local.set({ patchNotesUnread: true });
      await notifyUpdateOnce(currentVersion);
    }
  }
  await syncUpdateBadge();
}

/** Listener chrome.runtime.onStartup. */
export async function handleStartup() {
  initDone = true;
  await fetchRemoteConfig(); // refresh credentials on browser startup
  scheduleWatcherAlarm();
  scheduleKeepAliveAlarm();
  scheduleDropsAlarm();

  const prefs = await PreferenceStore.ensureDefaults();
  setupAutoOpenInventoryAlarm(prefs);
  await NotificationCenter.init();
  await pollStreamers({ forceNotification: false });
  // Le texte de badge peut survivre a un redemarrage du navigateur avec une
  // valeur perimee : on le resynchronise avec l'etat reel du stockage.
  await syncUpdateBadge();
}

/** Réveil du service worker (import du module) : préférences, notifications, sondage si périmé. */
export async function initOnWake() {
  if (initDone) return;
  initDone = true;
  await PreferenceStore.ensureDefaults();
  await NotificationCenter.init();
  refreshRaidWatcher();

  // Only poll on SW wake if cached statuses are stale (>60s old).
  // Avoids triggering a full poll every time the popup is reopened.
  try {
    const statuses = await DataStore.getStatuses();
    const updatedAts = Object.values(statuses || {})
      .map((s) => s?.updatedAt || 0)
      .filter(Boolean);
    const newest = updatedAts.length ? Math.max(...updatedAts) : 0;
    const staleness = Date.now() - newest;
    if (newest === 0 || staleness > 60_000) {
      pollStreamers({ forceNotification: false }).catch((err) => {
        console.warn("Initial poll failed:", err?.message || err);
      });
    }
  } catch (err) {
    console.warn("Init staleness check failed:", err?.message || err);
  }
}
