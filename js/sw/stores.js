// Stockage : streamers, préférences, statistiques et journal d'événements.

import { DEFAULT_PREFERENCES, detectInstallLanguage, notificationFieldsFromUpdates, sanitizePreferences } from "../preferences-data.js";
import { setupAutoOpenInventoryAlarm } from "./alarms.js";
import { CONFIG } from "./config.js";
import { PREFERENCES_KEY, STORAGE_KEYS } from "./constants.js";
import { normalizeStreamer } from "./normalize.js";

export const DEFAULT_STATS = {
  channelPointsClaimed: 0,
  dropsClaimed: 0,
  momentsClaimed: 0,
  raidsCancelled: 0,
};

export class DataStore {
  static async getStreamers() {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.STREAMERS);
    const streamers = stored[STORAGE_KEYS.STREAMERS] || [];
    return streamers.map(normalizeStreamer);
  }

  static async saveStreamers(streamers) {
    const normalized = streamers.map(normalizeStreamer);
    await chrome.storage.local.set({
      [STORAGE_KEYS.STREAMERS]: normalized,
    });
    return normalized;
  }

  static async getStatuses() {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.STATUSES);
    return stored[STORAGE_KEYS.STATUSES] || {};
  }

  static async saveStatuses(statuses) {
    // Chaque sondage réécrivait l'objet entier, même quand rien n'a bougé :
    // une écriture storage de moins par tour de sondage calme.
    const stored = await chrome.storage.local.get(STORAGE_KEYS.STATUSES);
    if (JSON.stringify(stored[STORAGE_KEYS.STATUSES] || {}) === JSON.stringify(statuses || {})) {
      return;
    }
    await chrome.storage.local.set({
      [STORAGE_KEYS.STATUSES]: statuses,
    });
  }

  // Live-state dedicated key: persistent across SW restarts. Used ONLY for
  // notification dedup (was-live / session-id tracking). Never wiped by the
  // poll loop, even if streamers list is transiently empty.
  static async getLiveState() {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.LIVE_STATE);
    return stored[STORAGE_KEYS.LIVE_STATE] || {};
  }

  static async saveLiveState(stateObject) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.LIVE_STATE]: stateObject,
    });
  }

  static async ensureDefaults() {
    const existing = await this.getStreamers();
    if (existing.length > 0) {
      return existing;
    }
    const defaults = (CONFIG.defaultStreamers || []).map(normalizeStreamer);
    await this.saveStreamers(defaults);
    return defaults;
  }

  static async updateStreamer(updatedStreamer) {
    const streamers = await this.getStreamers();
    const idx = streamers.findIndex((s) => s.id === updatedStreamer.id);
    if (idx === -1) {
      streamers.push(updatedStreamer);
    } else {
      streamers[idx] = normalizeStreamer({
        ...streamers[idx],
        ...updatedStreamer,
      });
    }
    await this.saveStreamers(streamers);
    return streamers[idx] || updatedStreamer;
  }
}

export class PreferenceStore {
  // Coercion unique : sanitizePreferences() vit dans js/preferences-data.js
  // (module pur, partage avec la popup, teste par tests/preferences-data.test.mjs).
  // Toute cle de DEFAULT_PREFERENCES y est coerce : la parite est verifiee
  // statiquement par scripts/verify.mjs.
  static sanitize(preferences = {}) {
    return sanitizePreferences(preferences);
  }

  static async get() {
    try {
      const stored = await chrome.storage.local.get(PREFERENCES_KEY);
      return {
        ...DEFAULT_PREFERENCES,
        ...this.sanitize(stored[PREFERENCES_KEY] || {}),
      };
    } catch (error) {
      console.warn("Preference load error:", error.message);
      return { ...DEFAULT_PREFERENCES };
    }
  }

  static async set(preferences) {
    const sanitized = {
      ...DEFAULT_PREFERENCES,
      ...this.sanitize(preferences),
    };
    await chrome.storage.local.set({
      [PREFERENCES_KEY]: sanitized,
    });
    setupAutoOpenInventoryAlarm(sanitized);
    return sanitized;
  }

  // Read-modify-write sequencé : deux bascules rapides (popup ouverte sur deux
  // surfaces, ou rafale de clics) s'ecrasaient sinon — meme pattern que
  // StatsStore et HistoryStore.
  static _queue = Promise.resolve();

  static _enqueue(task) {
    const run = this._queue.then(task, task);
    this._queue = run.catch(() => {});
    return run;
  }

  static update(updates) {
    return this._enqueue(async () => {
      const current = await this.get();
      const merged = { ...current, ...updates };
      return this.set(merged);
    });
  }

  static async ensureDefaults() {
    const stored = await chrome.storage.local.get(PREFERENCES_KEY);
    if (!stored[PREFERENCES_KEY]) {
      // Nouvelle installation : la langue de Chrome, jamais un choix stocké
      // (il n'y en a pas encore) ni le défaut du produit.
      const language = detectInstallLanguage(
        typeof chrome.i18n?.getUILanguage === "function" ? chrome.i18n.getUILanguage() : undefined
      );
      await this.set({ ...DEFAULT_PREFERENCES, language });
      return { ...DEFAULT_PREFERENCES, language };
    }
    return {
      ...DEFAULT_PREFERENCES,
      ...this.sanitize(stored[PREFERENCES_KEY]),
    };
  }
}

/**
 * Les réglages d'alertes globales ne sont jamais des verrous : changer
 * liveNotifications / gameNotifications / titleNotifications applique la
 * valeur à tous les streamers existants (et sert de défaut aux nouveaux,
 * cf. addStreamer).
 */
export async function propagateNotificationPreferences(preferences) {
  const fields = notificationFieldsFromUpdates(preferences);
  if (fields.length === 0) return null;
  const streamers = await DataStore.getStreamers();
  if (streamers.length === 0) return [];
  const updated = streamers.map((streamer) => {
    const next = { ...streamer };
    for (const [field, value] of fields) next[field] = value;
    return next;
  });
  return DataStore.saveStreamers(updated);
}

export class StatsStore {
  static async get() {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEYS.STATS);
      return {
        ...DEFAULT_STATS,
        ...(stored[STORAGE_KEYS.STATS] || {}),
      };
    } catch (error) {
      console.warn("Stats load error:", error);
      return { ...DEFAULT_STATS };
    }
  }

  static async update(updates) {
    const current = await this.get();
    const merged = { ...current, ...updates };
    await chrome.storage.local.set({
      [STORAGE_KEYS.STATS]: merged,
    });
    return merged;
  }

  // Read-modify-write sequencé : deux increments quasi simultanes (points +
  // drop dans la meme seconde) s'ecrasaient sinon — meme pattern que HistoryStore.
  static _queue = Promise.resolve();

  static _enqueue(task) {
    const run = this._queue.then(task, task);
    this._queue = run.catch(() => {});
    return run;
  }

  static increment(stat, value = 1) {
    return this._enqueue(async () => {
      const current = await this.get();
      const newValue = (current[stat] || 0) + value;
      return this.update({ [stat]: newValue });
    });
  }
}

export class EventLogStore {
  // Before the EVENT_LOGS key existed, getLogs() read the whole storage and
  // addLog() wrote under the literal "undefined" key. Recover those logs once.
  static LEGACY_KEY = "undefined";

  // File d'attente : addLog fait un lire-modifier-ecrire ; deux appels
  // concurrents (alerte de Drop + clic de point de chaîne) s'écrasaient
  // l'un l'autre et perdaient des entrées. Les opérations passent par la
  // file, une seule écriture à la fois.
  static _queue = Promise.resolve();

  static _enqueue(operation) {
    const run = this._queue.then(operation);
    // La file ne doit jamais rester rejetée : on journalise et on enchaîne.
    this._queue = run.catch((error) => {
      console.warn("[SP] journal d'événements :", error?.message || error);
    });
    return run;
  }

  static async getLogs() {
    try {
      const stored = await chrome.storage.local.get([
        STORAGE_KEYS.EVENT_LOGS,
        this.LEGACY_KEY,
      ]);
      const current = stored[STORAGE_KEYS.EVENT_LOGS];
      if (current) {
        return current;
      }
      const legacy = stored[this.LEGACY_KEY];
      if (Array.isArray(legacy) && legacy.length > 0) {
        await chrome.storage.local.set({ [STORAGE_KEYS.EVENT_LOGS]: legacy });
        await chrome.storage.local.remove(this.LEGACY_KEY);
        return legacy;
      }
      return [];
    } catch (error) {
      console.warn("[SP] lecture du journal d'événements impossible", error);
      return [];
    }
  }

  static addLog(entry = {}) {
    return this._enqueue(() => this._writeLog(entry));
  }

  static async _writeLog(entry = {}) {
    const logs = await this.getLogs();
    const newLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      type: entry.type || "info", // "drop", "moment", "raid", "prediction", "points"
      channel: entry.channel || "",
      text: entry.text || "",
      value: entry.value || 0,
    };
    logs.unshift(newLog);
    if (logs.length > 100) logs.pop();
    await chrome.storage.local.set({ [STORAGE_KEYS.EVENT_LOGS]: logs });
    return newLog;
  }

  static async clearLogs() {
    await chrome.storage.local.set({ [STORAGE_KEYS.EVENT_LOGS]: [] });
    return [];
  }
}
