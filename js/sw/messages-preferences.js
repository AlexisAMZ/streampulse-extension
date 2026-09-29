// Handlers de messages runtime (voir messages.js pour la table).

import { resetPreferencesFrom } from "../preferences-data.js";
import { translateWithPrefs } from "./i18n.js";
import { NotificationSystem } from "./notifications.js";
import { refreshRaidWatcher } from "./raids.js";
import { PreferenceStore, propagateNotificationPreferences } from "./stores.js";

export function handleUpdateUserProfile(request, sender, sendResponse) {
  const profile = request.profile || {};
  chrome.storage.local.set({ userProfile: profile })
    .then(() => sendResponse({ success: true }))
    .catch(err => sendResponse({ error: err.message }));
  return true;
}

export function handleUpdatePreferences(request, sender, sendResponse) {
  (async () => {
    try {
      const incomingUpdates = request.updates || {};
      // Coercion unique : PreferenceStore.sanitize() est la seule source de
      // verite (le bloc duplique qui vivait ici a fini par perdre des cles,
      // cf. le commentaire de sanitize()). On ne garde que les cles que
      // l'appelant a envoyees et que sanitize reconnait.
      const sanitized = PreferenceStore.sanitize(incomingUpdates);
      const updates = Object.fromEntries(
        Object.keys(incomingUpdates)
          .filter((key) => key in sanitized)
          .map((key) => [key, sanitized[key]])
      );
      if (Object.keys(updates).length === 0) {
        const preferences = await PreferenceStore.get();
        const incomingKeys = Object.keys(incomingUpdates);

        // Charge utile vide : il n'y a rien a faire, ce n'est pas une erreur.
        // Le bandeau rouge sortait ici, sans qu'aucun reglage n'ait echoue.
        // La serialisation de sendMessage supprime les proprietes valant
        // undefined, donc un appelant peut envoyer un objet qui arrive vide.
        if (incomingKeys.length === 0) {
          sendResponse({ success: true, preferences });
          return;
        }

        // Des cles sont bien arrivees mais aucune n'est reconnue : la, c'est
        // un vrai defaut. On les nomme dans la console du service worker,
        // faute de quoi le bandeau ne dit pas laquelle est en cause.
        console.warn(
          "[SP] updatePreferences: aucune cle reconnue parmi",
          incomingKeys
        );
        sendResponse({
          error: translateWithPrefs(
            preferences,
            "background.errors.noPreferencesUpdate"
          ),
        });
        return;
      }

      const preferences = await PreferenceStore.update(updates);
      // Les réglages d'alertes globales sont des actions en masse : la
      // valeur choisie s'applique aussi à tous les streamers existants.
      await propagateNotificationPreferences(updates);
      if ("backgroundRaidAlerts" in updates) {
        refreshRaidWatcher();
      }
      sendResponse({ success: true, preferences });
    } catch (error) {
      sendResponse({ error: error?.message || String(error) });
    }
  })();
  return true;
}

export function handleResetPreferences(request, sender, sendResponse) {
  (async () => {
    try {
      // Tout revient au défaut, sauf la langue et le thème choisis.
      const current = await PreferenceStore.get();
      const preferences = await PreferenceStore.set(resetPreferencesFrom(current));
      // Les alertes par streamer reprennent aussi leurs défauts.
      await propagateNotificationPreferences(preferences);
      refreshRaidWatcher();
      sendResponse({ success: true, preferences });
    } catch (error) {
      sendResponse({ error: error?.message || String(error) });
    }
  })();
  return true;
}

export function handleTestNotification(request, sender, sendResponse) {
  (async () => {
    try {
      const preferences = await PreferenceStore.get();
      try {
        await NotificationSystem.sendTest(preferences);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({
          error:
            error?.message ||
            translateWithPrefs(
              preferences,
              "background.errors.testNotificationFailed"
            ),
        });
      }
    } catch (error) {
      sendResponse({ error: error?.message || String(error) });
    }
  })();
  return true;
}
