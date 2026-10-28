// Outil de développement : remet l'essai StreamPulse+ à zéro sur ce navigateur
// pour retester « Débloquer les 7 jours » (bandeau, confettis). Refusé hors
// extension non empaquetée (une version des stores a toujours update_url).
// Le serveur garde l'essai du compte Twitch : un nouveau clic redonne le même
// essai (même début), tant que ses 7 jours ne sont pas écoulés.

import { MISSED_KEY } from "../missed-alerts.js";
import { PLUS_KEY } from "../plus.js";
import { POPUP_SEEN_KEY, TRIAL_REMINDER_KEY } from "../trial-reminder.js";
import { TRIAL_STATE_KEY, TRIAL_SYNC_KEY } from "./trial.js";

/** Extension chargée depuis un dossier (mode développeur) : pas d'update_url. */
export const isDevInstall = () => !chrome.runtime.getManifest().update_url;

export async function resetTrialForDev() {
  if (!isDevInstall()) return { reset: false, reason: "not-dev" };
  const record = (await chrome.storage.local.get(PLUS_KEY))[PLUS_KEY];
  // Une vraie licence (achetée, à vie) n'est jamais effacée par cet outil.
  const keys = [TRIAL_STATE_KEY, TRIAL_REMINDER_KEY, POPUP_SEEN_KEY, MISSED_KEY, ...(record?.plan === "trial" ? [PLUS_KEY] : [])];
  await chrome.storage.local.remove(keys);
  await chrome.storage.sync.remove(TRIAL_SYNC_KEY).catch(() => {});
  return { reset: true, removedLicense: record?.plan === "trial" };
}
