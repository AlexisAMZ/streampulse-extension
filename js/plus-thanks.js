// Remerciement affiché une seule fois quand une clé StreamPulse+ est activée.

const THANKED_KEY = "streamPulsePlusThanked";

/**
 * Montre la notification de remerciement pour cette clé, une seule fois :
 * réactiver la même clé (réinstallation, second appareil) ne la répète pas.
 * @param {string} licenseKey
 * @param {(key: string) => string} translate
 */
export async function thankPlusSubscriber(licenseKey, translate) {
  if (!licenseKey || !chrome?.notifications?.create) return false;
  const stored = await chrome.storage.local.get(THANKED_KEY);
  if (stored[THANKED_KEY] === licenseKey) return false;
  await chrome.storage.local.set({ [THANKED_KEY]: licenseKey });
  return new Promise((resolve) => {
    chrome.notifications.create(
      `streampulse-plus-thanks-${Date.now()}`,
      {
        type: "basic",
        iconUrl: chrome.runtime.getURL("images/photos/logo.png"),
        title: translate("background.notifications.plusThanksTitle"),
        message: translate("background.notifications.plusThanksMessage"),
        requireInteraction: true,
        priority: 2,
      },
      () => resolve(!chrome.runtime.lastError)
    );
  });
}
