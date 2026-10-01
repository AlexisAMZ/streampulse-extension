// Service worker StreamPulse (Manifest V3, module ES).
//
// Ce fichier ne fait qu'assembler : la logique vit dans js/sw/*. Tous les
// listeners chrome.* sont posés ici, au top-level et de façon synchrone :
// MV3 peut livrer un événement dès l'évaluation du module, un listener posé
// après un await le raterait.
import { installDebugTools } from "./sw/debug.js";
import { badgeAuto, scheduleDropsAlarm } from "./sw/drops.js";
import { NotificationCenter } from "./sw/notifications.js";
import { handleAlarm, scheduleKeepAliveAlarm, scheduleWatchTimeFlushAlarm, scheduleWatcherAlarm } from "./sw/alarms.js";
import { handleInstalled, handleStartup, initOnWake } from "./sw/lifecycle.js";
import { createMessageDispatcher } from "./sw/message-dispatch.js";
import { MESSAGE_HANDLERS } from "./sw/messages.js";
import { keepChannelTabLoaded, onPreferencesChangedForTabDiscard } from "./sw/tab-discard.js";
import { WatchTimeStore } from "./sw/watchtime.js";
import { initSync } from "./sw/sync.js";

// Diagnostic : exposé tôt, même si une erreur survient plus bas.
installDebugTools();

// Le repli OAuth côté client a été supprimé (le secret client ne doit jamais
// vivre dans le navigateur) : on efface les credentials Kick que les versions
// précédentes pouvaient stocker. Idempotent, fire-and-forget.
chrome.storage.local.remove("streampulse:kickCreds").catch((error) => {
  console.warn("[kick] nettoyage des credentials locales impossible", error);
});

// Mode auto des badges : suit l'onglet qu'il a ouvert.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => badgeAuto.onTabUpdated(tabId, changeInfo));
chrome.tabs.onRemoved.addListener((tabId) => badgeAuto.onTabRemoved(tabId));

// Clic et fermeture de notification : posés au top-level, synchrones dès le
// démarrage du SW. Les enregistrer dans init(), après un await, laissait une
// fenêtre sans listener à chaque redémarrage du worker (clic perdu).
chrome.notifications.onClicked.addListener((notificationId) => {
  NotificationCenter.handleClicked(notificationId).catch((error) => {
    console.warn("[SP] clic de notification non traite", error);
  });
});
chrome.notifications.onClosed.addListener((notificationId) => {
  NotificationCenter.forgetTarget(notificationId).catch((error) => {
    console.warn("[SP] nettoyage de la cible de notification impossible", error);
  });
});

chrome.runtime.onInstalled.addListener(handleInstalled);
chrome.runtime.onStartup.addListener(handleStartup);
chrome.alarms.onAlarm.addListener(handleAlarm);

// Un handler par type de message (js/sw/messages.js), après contrôle de
// l'expéditeur (js/sw/message-dispatch.js).
chrome.runtime.onMessage.addListener(
  createMessageDispatcher(MESSAGE_HANDLERS, () => ({
    runtimeId: chrome.runtime.id,
    extensionPrefix: chrome.runtime.getURL(""),
  }))
);

scheduleWatcherAlarm();
scheduleKeepAliveAlarm();
scheduleDropsAlarm();
scheduleWatchTimeFlushAlarm();
// Synchro multi-appareils : listeners posés au top-level (voir l'en-tête du
// fichier), la poussée/tirée ne part que si le réglage est activé.
initSync();

// Le SW peut s'arrêter entre deux vidages : reprendre le cumul laissé en
// storage.session, et vider au moment où le navigateur suspend le SW.
WatchTimeStore.restorePending().catch((error) => {
  console.warn("[WatchTime] reprise du cumul au démarrage :", error?.message || error);
});
if (chrome.runtime.onSuspend?.addListener) {
  chrome.runtime.onSuspend.addListener(() => {
    WatchTimeStore.flush().catch((error) => console.warn("[WatchTime] vidage à la suspension :", error?.message || error));
  });
}

initOnWake().catch((error) => console.warn("[SP] initialisation au réveil :", error?.message || error));

// preventTabDiscard : pages de chaîne Twitch et Kick gardées chargées.
chrome.storage.onChanged.addListener(onPreferencesChangedForTabDiscard);
if (chrome.tabs?.onUpdated?.addListener) {
  chrome.tabs.onUpdated.addListener(keepChannelTabLoaded);
}
