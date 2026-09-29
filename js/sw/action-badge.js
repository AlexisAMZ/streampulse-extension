// Badge de l'icône : nombre de streamers en direct ou pastille des notes de version.

import { translateWithPrefs } from "./i18n.js";
import { PreferenceStore } from "./stores.js";

const BADGE_COLOR_LIVE = "#f7f4e3";
const BADGE_COLOR_IDLE = "#6C5CE7";

const BADGE_LIVE_COUNT_KEY = "streampulse:badgeLiveCount";
/** Violet Twitch, comme la pastille inline des notes dans la popup. */
const BADGE_COLOR_UPDATE = "#9146ff";

export class ActionBadge {
  static formatBadgeCount(count) {
    if (!Number.isFinite(count) || count <= 0) {
      return "";
    }
    if (count >= 100) {
      return "99+";
    }
    return String(count);
  }

  static async setLive(count, preferences = null) {
    const prefs = preferences || (await PreferenceStore.get());
    try {
      await chrome.action.setBadgeText({ text: this.formatBadgeCount(count) });
      await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_LIVE });
      await chrome.action.setTitle({
        title: translateWithPrefs(prefs, "background.badge.live", {
          count,
        }),
      });
    } catch (error) {
      console.warn("Badge live update failed:", error.message);
    }
  }

  static async clear(preferences = null) {
    const prefs = preferences || (await PreferenceStore.get());
    try {
      await chrome.action.setBadgeText({ text: "" });
      await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_IDLE });
      await chrome.action.setTitle({
        title: translateWithPrefs(prefs, "background.badge.idle"),
      });
    } catch (error) {
      console.warn("Badge clear failed:", error.message);
    }
  }

  static async update(liveCount, preferences = null) {
    // Le compteur survit aux redemarrages du service worker : sans lui, le
    // rendu declenche par une autre source (notes de version, demarrage)
    // n'aurait aucun moyen de savoir combien de streamers sont en direct et
    // effacerait le badge.
    try {
      await chrome.storage.local.set({ [BADGE_LIVE_COUNT_KEY]: liveCount });
    } catch (error) {
      // Le rendu retombera sur 0.
      console.warn("[SP] badge : compteur non persisté", error?.message || error);
    }
    await this.render(preferences);
  }

  /**
   * Unique ecrivain du badge. Deux sources veulent l'ecrire : le nombre de
   * streamers en direct et la pastille « notes de version non lues ». Elles
   * s'ecrasaient mutuellement, et syncUpdateBadge() tournant a chaque
   * demarrage du service worker, le compteur disparaissait a des moments
   * arbitraires. Le direct l'emporte, puisque c'est la question a laquelle le
   * badge repond ; la pastille des notes n'apparait que quand personne n'est
   * en direct.
   */
  static async render(preferences = null) {
    const prefs = preferences || (await PreferenceStore.get());
    let stored = {};
    try {
      stored = await chrome.storage.local.get([BADGE_LIVE_COUNT_KEY, "patchNotesUnread"]);
    } catch (error) {
      // Valeurs par défaut ci-dessous.
      console.warn("[SP] badge : lecture du stockage impossible", error?.message || error);
    }
    const liveCount = Number(stored[BADGE_LIVE_COUNT_KEY]) || 0;
    if (liveCount > 0) {
      await this.setLive(liveCount, prefs);
      return;
    }
    if (stored.patchNotesUnread) {
      try {
        await chrome.action.setBadgeText({ text: "1" });
        await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_UPDATE });
        await chrome.action.setTitle({
          title: translateWithPrefs(prefs, "background.badge.idle"),
        });
      } catch (error) {
        console.warn("Badge update marker failed:", error.message);
      }
      return;
    }
    await this.clear(prefs);
  }
}

// Badge "nouveau" sur l'icone de l'extension : visible avant meme d'ouvrir la
// popup, pose a chaque mise a jour, retire quand les notes de version sont
// ouvertes. Violet Twitch, comme la pastille inline des notes dans la popup.
export async function syncUpdateBadge() {
  await ActionBadge.render();
}
