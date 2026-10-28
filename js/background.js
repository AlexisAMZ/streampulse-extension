// Service worker StreamPulse (Manifest V3, module ES).
//
// Ce fichier ne fait qu'assembler : la logique vit dans js/sw/*. Tous les
// listeners chrome.* sont posés ici, au top-level et de façon synchrone :
// MV3 peut livrer un événement dès l'évaluation du module, un listener posé
// après un await le raterait.
import { syncChzzkAccess } from "./sw/chzzk-access.js";
import { badgeAuto, scheduleDropsAlarm } from "./sw/drops.js";
import { PREFERENCES_KEY } from "./sw/constants.js";
import { PLUS_KEY, isPlusActive } from "./plus.js";
import { MISSED_KEY, missedFrom } from "./missed-alerts.js";
import { clearMissed, syncMissedDot } from "./sw/missed.js";
import { NotificationCenter } from "./sw/notifications.js";
import { handleAlarm, scheduleKeepAliveAlarm, scheduleWatchTimeFlushAlarm, scheduleWatcherAlarm } from "./sw/alarms.js";
import { handleInstalled, handleStartup, initOnWake } from "./sw/lifecycle.js";
import { onPlusRecordChanged, runPlusGuard } from "./sw/license-guard.js";
import { createMessageDispatcher } from "./sw/message-dispatch.js";
import { MESSAGE_HANDLERS } from "./sw/messages.js";
import { handleOpenPlusOnboarding } from "./sw/messages-app.js";
import { createPlusExternalListener } from "./sw/plus-external.js";
import { keepChannelTabLoaded, onPreferencesChangedForTabDiscard } from "./sw/tab-discard.js";
import { WatchTimeStore } from "./sw/watchtime.js";
import { initSync } from "./sw/sync.js";


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
// La permission CHZZK s'accorde ou se retire depuis les réglages du navigateur comme depuis la popup.
chrome.permissions?.onAdded?.addListener(syncChzzkAccess);
chrome.permissions?.onRemoved?.addListener(syncChzzkAccess);

// Un handler par type de message (js/sw/messages.js), après contrôle de
// l'expéditeur (js/sw/message-dispatch.js).
chrome.runtime.onMessage.addListener(
  createMessageDispatcher(MESSAGE_HANDLERS, () => ({
    runtimeId: chrome.runtime.id,
    extensionPrefix: chrome.runtime.getURL(""),
  }))
);

// Page /plus/merci du site : activation de la clé sans copier-coller.
chrome.runtime.onMessageExternal?.addListener(
  createPlusExternalListener({
    storage: chrome.storage.local,
    fetch: (...args) => fetch(...args),
    onActivated: () => {
      handleOpenPlusOnboarding({}, null, () => {});
    },
  })
);

scheduleWatcherAlarm();
scheduleKeepAliveAlarm();
scheduleDropsAlarm().catch((error) => console.warn("[StreamPulse] alarme des Drops :", error?.message || error));
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

// Licence StreamPulse+ : toute écriture du storage est vérifiée (signature du
// serveur, js/sw/license-guard.js) ; un enregistrement forgé est supprimé.
const plusGuardDeps = { storage: chrome.storage.local, fetch: (...args) => fetch(...args) };
chrome.storage.onChanged.addListener((changes, area) => onPlusRecordChanged(changes, area, plusGuardDeps));
runPlusGuard(plusGuardDeps);

// preventTabDiscard : pages de chaîne Twitch et Kick gardées chargées.
chrome.storage.onChanged.addListener(onPreferencesChangedForTabDiscard);
// Délai d'actualisation des badges et Drops : suit le réglage et la licence.
// Alertes manquées : point de l'icône, et liste vidée dès que StreamPulse+ (ou l'essai) s'active.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[PREFERENCES_KEY] || changes[PLUS_KEY]) {
    scheduleDropsAlarm().catch((error) => console.warn("[StreamPulse] alarme des Drops :", error?.message || error));
  }
  if (changes[PLUS_KEY] && isPlusActive(changes[PLUS_KEY].newValue)) {
    clearMissed().catch((error) => console.warn("[StreamPulse] alertes manquées :", error?.message || error));
  } else if (changes[MISSED_KEY]) {
    syncMissedDot(missedFrom(changes[MISSED_KEY].newValue)).catch(() => {});
  }
});
if (chrome.tabs?.onUpdated?.addListener) {
  chrome.tabs.onUpdated.addListener(keepChannelTabLoaded);
}
