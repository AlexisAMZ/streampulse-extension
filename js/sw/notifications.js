// Notifications système : affichage, cibles de clic, alertes de live / catégorie / titre, son.

import { DEFAULT_LANGUAGE } from "../../i18n/translations.js";
import { DEFAULT_PLATFORM, buildProfileUrl, formatHandleForDisplay, getPlatformIcon, getPlatformLabelKey, normalizePlatform, platformSupportsLiveStatus, sanitizeHandle } from "../platforms.js";
import { DEFAULT_PREFERENCES, normalizeLanguage } from "../preferences-data.js";
import { CONFIG } from "./config.js";
import { NOTIFICATION_NAMESPACE } from "./constants.js";
import { formatNumberForLanguage, translate } from "./i18n.js";
import { streamerCache, streamerStates } from "./state.js";
import { DataStore } from "./stores.js";

export class NotificationCenter {
  static storageKey = `${NOTIFICATION_NAMESPACE}:scheduled`;
  static alarmPrefix = `${NOTIFICATION_NAMESPACE}:alarm:`;
  // Cible de chaque notification (URL a ouvrir / streamer a ouvrir),
  // persistee en storage.session : le SW peut etre tue entre l'affichage de
  // la notification et le clic, et le clic doit survivre a ce redemarrage.
  static targetsStorageKey = `${NOTIFICATION_NAMESPACE}:targets`;
  static targetsMaxEntries = 50;
  static clickMap = new Map();
  static initialized = false;

  static getDefaultIcon() {
    return chrome.runtime.getURL("images/photos/logo.png");
  }

  static resolveIcon(icon) {
    if (typeof icon === "string") {
      const trimmed = icon.trim();
      if (!trimmed) {
        return this.getDefaultIcon();
      }
      if (trimmed.startsWith("http://")) {
        return `https://${trimmed.slice(7)}`;
      }
      return trimmed;
    }
    return this.getDefaultIcon();
  }

  // Les listeners chrome.notifications.* sont poses au top-level du service
  // worker (synchrone) : les enregistrer ici, apres un await, laissait une
  // fenetre morte a chaque demarrage (clic perdu) — MV3 peut livrer l'evenement
  // avant la fin de init().
  static async init() {
    if (this.initialized) return;
    this.initialized = true;

    const entries = await this.getScheduled();
    entries.forEach((entry) => {
      chrome.alarms.create(entry.alarmName, {
        delayInMinutes: 0.1,
        periodInMinutes: entry.intervalMinutes,
      });
    });
  }

  static async persistTargets(targets) {
    try {
      await chrome.storage.session.set({
        [this.targetsStorageKey]: targets,
      });
    } catch (error) {
      console.warn("[SP] persistance de la cible de notification impossible", error);
    }
  }

  static async readStoredTargets() {
    try {
      const stored = await chrome.storage.session.get(this.targetsStorageKey);
      const targets = stored?.[this.targetsStorageKey];
      return targets && typeof targets === "object" ? targets : {};
    } catch (error) {
      console.warn("[SP] lecture des cibles de notification impossible", error);
      return {};
    }
  }

  static async rememberTarget(id, info) {
    // Cap memoire : les notifications d'il y a longtemps n'ont plus de cible.
    if (this.clickMap.size >= this.targetsMaxEntries) {
      const oldest = this.clickMap.keys().next().value;
      this.clickMap.delete(oldest);
    }
    this.clickMap.set(id, info);
    const stored = await this.readStoredTargets();
    const ids = Object.keys(stored);
    if (ids.length >= this.targetsMaxEntries) {
      delete stored[ids[0]];
    }
    stored[id] = info;
    await this.persistTargets(stored);
  }

  static async forgetTarget(id) {
    this.clickMap.delete(id);
    const stored = await this.readStoredTargets();
    if (id in stored) {
      delete stored[id];
      await this.persistTargets(stored);
    }
  }

  // Renvoie la cible du clic (memoire d'abord, session ensuite) puis l'oublie :
  // une notification ne s'ouvre qu'une fois.
  static async consumeTarget(id) {
    let info = this.clickMap.get(id) || null;
    if (!info) info = (await this.readStoredTargets())[id] || null;
    await this.forgetTarget(id);
    return info;
  }

  static async handleClicked(notificationId) {
    const info = await this.consumeTarget(notificationId);
    if (!info) return;
    try {
      await chrome.notifications.clear(notificationId);
    } catch (error) {
      // La notification peut deja avoir disparu : l'ouverture, elle, reste valide.
      console.warn("[SP] notification deja fermee au clic", error);
    }
    if (info.streamerId) {
      openStreamerFromNotification(info.streamerId);
    } else if (info.url) {
      chrome.tabs.create({ url: info.url });
    }
  }

  /**
   * Create a notification, retrying with the bundled icon if the remote one
   * cannot be fetched.
   *
   * Chrome rejects the WHOLE notification with "Unable to download all
   * specified images" when `iconUrl` points at a remote avatar it can't load
   * (CDN hiccup, offline, or a content blocker intercepting the request). The
   * notification is the actual feature here and the avatar is decorative, so a
   * failed image must never cost the user the alert.
   */
  static async createWithIconFallback(id, notificationOptions) {
    const create = (options) =>
      new Promise((resolve, reject) => {
        try {
          chrome.notifications.create(id, options, () => {
            const err = chrome.runtime.lastError;
            if (err) reject(new Error(err.message));
            else resolve(true);
          });
        } catch (e) {
          reject(e);
        }
      });

    try {
      return await create(notificationOptions);
    } catch (_e) {
      const fallback = this.getDefaultIcon();
      if (notificationOptions.iconUrl === fallback) return false;
      try {
        return await create({ ...notificationOptions, iconUrl: fallback });
      } catch (_e2) {
        // Never let a cosmetic image failure reject into an unhandled promise.
        return false;
      }
    }
  }

  static async show(options = {}) {
    await this.init();
    const id = `${NOTIFICATION_NAMESPACE}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    await this.rememberTarget(id, {
      url: options.url || null,
      streamerId: options.streamerId || null,
      platform: options.platform || null,
    });
    await this.createWithIconFallback(id, {
      type: "basic",
      iconUrl: this.resolveIcon(options.iconUrl),
      title: options.title || translate(DEFAULT_LANGUAGE, "common.appName"),
      message: options.message || "",
      requireInteraction: Boolean(options.requireInteraction),
      priority:
        typeof options.priority === "number"
          ? options.priority
          : options.requireInteraction
          ? 2
          : 0,
    });
    if (options.playSound) {
      await SoundManager.play(CONFIG.notifications?.soundFile);
    }
    return id;
  }

  // Notifications programmées : plus aucune n'est créée, mais des alarmes
  // d'anciennes versions peuvent subsister ; elles s'affichent encore.
  static async handleAlarm(alarmName) {
    await this.init();
    if (!alarmName.startsWith(this.alarmPrefix)) return false;
    const entries = await this.getScheduled();
    const entry = entries.find((item) => item.alarmName === alarmName);
    if (!entry) return false;
    await this.show(entry);
    return true;
  }

  static async getScheduled() {
    const stored = await chrome.storage.local.get(this.storageKey);
    return stored[this.storageKey] || [];
  }
}


export class NotificationSystem {
  // Avatar du streamer si connu, icone de plateforme sinon — logique partagée
  // par les trois notifications (avant : copie-collé trois fois).
  static resolveNotificationIcon(streamer, platformKey) {
    const streamerStatus = streamerStates.get(streamer.id);
    const fallbackIcon =
      (chrome?.runtime && getPlatformIcon(platformKey)
        ? chrome.runtime.getURL(getPlatformIcon(platformKey))
        : null) || NotificationCenter.getDefaultIcon();
    return NotificationCenter.resolveIcon(
      streamerStatus?.avatarUrl || streamer.avatarUrl || fallbackIcon
    );
  }

  static async notifyLive(streamer, status, preferences = DEFAULT_PREFERENCES) {
    // Le verrou par streamer est dejà verifie par l'appelant : ici on ne
    // re-verifie pas la preference globale (modele « par streamer d'abord »).
    const lang = normalizeLanguage(preferences?.language);
    const platform = status.platform || streamer.platform || "twitch";
    const name =
      streamer.displayName ||
      formatHandleForDisplay(platform, streamer.handle || streamer.twitch);
    const title = translate(lang, "background.notifications.liveTitle", {
      name,
    });

    const detailParts = [];
    if (status.title) {
      detailParts.push(status.title);
    }
    if (status.game && Number.isFinite(status.viewers)) {
      detailParts.push(
        translate(lang, "background.notifications.liveMessage", {
          game: status.game,
          viewers: formatNumberForLanguage(lang, status.viewers),
        })
      );
    } else if (status.game) {
      detailParts.push(
        translate(lang, "background.notifications.liveMessageNoViewers", {
          game: status.game,
        })
      );
    } else if (Number.isFinite(status.viewers)) {
      detailParts.push(
        translate(lang, "background.notifications.liveMessageNoGame", {
          viewers: formatNumberForLanguage(lang, status.viewers),
        })
      );
    }

    const platformLabel = translate(lang, getPlatformLabelKey(platform));
    detailParts.push(platformLabel);
    const message = detailParts.filter(Boolean).join(" • ");

    const targetUrl = buildProfileUrl(
      platform,
      streamer.handle || streamer.twitch || streamer.id
    );

    await NotificationCenter.show({
      title,
      message,
      streamerId: streamer.id,
      platform: status.platform,
      url: status.url || targetUrl,
      iconUrl: this.resolveNotificationIcon(streamer, platform),
      requireInteraction: true,
      priority: 2,
      playSound: preferences?.soundsEnabled !== false,
    });
  }

  // Changement de catégorie ou de titre : mêmes garde-fous, même structure,
  // seuls les textes et les paramètres de traduction varient.
  static async notifyChangeEvent(
    streamer,
    preferences,
    { alertKey: _alertKey, titleKey, messageKey, messageParams, platform }
  ) {
    const lang = normalizeLanguage(preferences?.language);
    const platformKey = platform || streamer.platform || "twitch";
    if (!platformSupportsLiveStatus(platformKey)) {
      return;
    }
    const name =
      streamer.displayName ||
      formatHandleForDisplay(platformKey, streamer.handle || streamer.twitch);

    await NotificationCenter.show({
      title: translate(lang, titleKey, { name }),
      message: translate(lang, messageKey, messageParams(lang)),
      streamerId: streamer.id,
      platform: platformKey,
      url: buildProfileUrl(
        platformKey,
        streamer.handle || streamer.twitch || streamer.id
      ),
      iconUrl: this.resolveNotificationIcon(streamer, platformKey),
      requireInteraction: false,
      priority: 1,
      playSound: preferences?.soundsEnabled !== false,
    });
  }

  static async notifyGameChange(
    streamer,
    fromGame,
    toGame,
    preferences = DEFAULT_PREFERENCES,
    platform = null
  ) {
    await this.notifyChangeEvent(streamer, preferences, {
      alertKey: "gameNotifications",
      titleKey: "background.notifications.categoryChangeTitle",
      messageKey: "background.notifications.categoryChangeMessage",
      messageParams: (lang) => ({
        from:
          fromGame ||
          translate(lang, "background.notifications.unknownCategory"),
        to: toGame || translate(lang, "background.notifications.newCategory"),
      }),
      platform,
    });
  }

  static async notifyTitleChange(
    streamer,
    fromTitle,
    toTitle,
    preferences = DEFAULT_PREFERENCES,
    platform = null
  ) {
    await this.notifyChangeEvent(streamer, preferences, {
      alertKey: "titleNotifications",
      titleKey: "background.notifications.titleChangeTitle",
      // Le corps ne montre que le nouveau titre : un flux Twitch en fait souvent
      // plusieurs par session et le « avant apres » deborde de la notification.
      messageKey: "background.notifications.titleChangeMessage",
      messageParams: (lang) => ({
        to:
          toTitle ||
          translate(lang, "background.notifications.unknownTitle"),
      }),
      platform,
    });
  }

  // Chaque clic sur « Tester une notification » fait tourner un compteur :
  // 1er clic = live, 2e = changement de categorie, 3e = changement de titre.
  // Permet de verifier le pipeline complet des trois alertes sans attendre
  // qu'un streamer change reellement de jeu ou de titre.
  static _testStep = 0;

  static async sendTest(preferences = DEFAULT_PREFERENCES) {
    const lang = normalizeLanguage(preferences?.language);
    const step = this._testStep % 3;
    this._testStep += 1;

    if (step === 0) {
      await NotificationCenter.show({
        title: translate(lang, "common.appName"),
        message: translate(lang, "background.notifications.testSimpleMessage"),
        requireInteraction: true,
        priority: 2,
        playSound: preferences?.soundsEnabled !== false,
      });
      return;
    }

    // Bypass volontaire des preferences : l'objectif du bouton est de montrer
    // a quoi ressemble chaque type d'alerte, meme si elle est desactivee.
    const forcedPrefs = {
      ...preferences,
      liveNotifications: true,
      gameNotifications: true,
      titleNotifications: true,
    };
    const fakeStreamer = {
      id: "test",
      platform: "twitch",
      handle: "test",
      displayName: translate(lang, "common.appName"),
      notificationsEnabled: true,
      gameNotificationsEnabled: true,
      titleNotificationsEnabled: true,
    };
    if (step === 1) {
      await this.notifyGameChange(
        fakeStreamer,
        translate(lang, "background.notifications.unknownCategory"),
        translate(lang, "background.notifications.newCategory"),
        forcedPrefs
      );
    } else {
      await this.notifyTitleChange(
        fakeStreamer,
        "",
        translate(lang, "background.notifications.testTitleMessage"),
        forcedPrefs
      );
    }
  }
}

class SoundManager {
  static async play(filePath = "sons/notification.mp3") {
    if (!filePath) return;
    try {
      await chrome.offscreen.createDocument({
        url: "html/audio-handler.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Lecture d'une notification audio",
      });
    } catch (creationError) {
      if (
        !creationError?.message?.includes("Only a single offscreen") &&
        !creationError?.message?.includes("already created")
      ) {
        console.warn("Offscreen creation error:", creationError.message);
      }
    }

    try {
      await chrome.runtime.sendMessage({
        audioCommand: {
          action: "play",
          file: filePath,
          volume: 1.0,
        },
      });
    } catch (error) {
      console.warn("Audio playback error:", error.message);
    }
  }
}

async function openStreamerFromNotification(streamerId) {
  if (!streamerId) return;
  let streamer = streamerCache.get(streamerId);
  let states = streamerStates.get(streamerId);

  // Le clic peut arriver apres un redemarrage du SW : les caches memoires sont
  // alors vides, on relit le stockage (source de verite persistante).
  if (!streamer || !states) {
    try {
      const [streamers, statuses] = await Promise.all([
        DataStore.getStreamers(),
        DataStore.getStatuses(),
      ]);
      streamer = streamer || streamers.find((item) => item.id === streamerId) || null;
      states = states || statuses?.[streamerId] || null;
    } catch (error) {
      console.warn("[SP] relecture du streamer pour notification impossible", error);
    }
  }

  const platform = normalizePlatform(
    streamer?.platform || states?.active?.platform || DEFAULT_PLATFORM
  );
  const handle =
    streamer?.handle ||
    streamer?.twitch ||
    states?.active?.login ||
    (platform === "twitch"
      ? sanitizeHandle("twitch", streamerId)
      : streamerId);
  const targetUrl = buildProfileUrl(platform, handle);

  try {
    await chrome.tabs.create({
      url: targetUrl,
    });
  } catch (error) {
    console.warn("Failed to open streamer page:", error?.message || error);
  }
}
