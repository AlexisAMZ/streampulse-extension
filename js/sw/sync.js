// Synchro multi-appareils : streamers et réglages suivent le profil du
// navigateur via chrome.storage.sync. Opt-in (crossDeviceSync, désactivé par
// défaut) : rien ne quitte l'appareil sans elle. Le temps de visionnage, les
// points, les Drops et l'historique restent strictement locaux — leurs
// écritures continues feraient exploser les quotas de la zone sync
// (1 800 écritures/h, 100 Ko au total, 8 Ko par clé).

import {
  SYNC_META_KEY,
  SYNC_PINNED_KEY,
  SYNC_PREFS_KEY,
  SYNC_STATUS_KEY,
  SYNC_STREAMERS_PREFIX,
  chunkForSync,
  isRemoteSync,
  mergePinnedIds,
  mergePreferences,
  mergeStreamers,
} from "../sync-data.js";
import { PREFERENCES_KEY, STORAGE_KEYS } from "./constants.js";
import { warnWith } from "./log.js";
import { DataStore, PreferenceStore } from "./stores.js";

const DEVICE_KEY = "sp:sync:device";
const PUSH_DEBOUNCE_MS = 3_000;

let deviceId = "";
let pushTimer = 0;
// Ceinture et bretelles avec l'écho par deviceId : les écritures locales que
// la tirée vient de faire ne doivent pas repartir en poussée immédiate.
let applyingRemote = false;
// Révisions déjà tirées : sans ça, la poussée d'un nouvel appareil écraserait
// l'état du nuage avant de l'avoir jamais lu.
const pulledRevs = new Set();

function rememberDevice(id) {
  deviceId = id;
  return id;
}

async function ensureDevice() {
  if (deviceId) return deviceId;
  const stored = await chrome.storage.local.get(DEVICE_KEY);
  const next = stored[DEVICE_KEY]
    || `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  if (next !== stored[DEVICE_KEY]) await chrome.storage.local.set({ [DEVICE_KEY]: next });
  return rememberDevice(next);
}

async function syncEnabled() {
  const prefs = await PreferenceStore.get();
  return prefs.crossDeviceSync === true;
}

async function setStatus(patch) {
  const stored = await chrome.storage.local.get(SYNC_STATUS_KEY);
  await chrome.storage.local.set({ [SYNC_STATUS_KEY]: { ...(stored[SYNC_STATUS_KEY] || {}), ...patch } });
}

/**
 * Poussée : écrit l'état local (streamers en tranches, réglages, méta) dans la
 * zone sync. Si le nuage porte un état d'un autre appareil jamais tiré, on
 * tire d'abord — sinon un nouvel appareil écraserait la liste du premier avec
 * la sienne, vide.
 */
export async function pushToSync() {
  if (!(await syncEnabled())) return;
  const device = await ensureDevice();
  const metaStored = await chrome.storage.sync.get(SYNC_META_KEY);
  const cloudMeta = metaStored[SYNC_META_KEY];
  if (isRemoteSync(cloudMeta, device) && !pulledRevs.has(Number(cloudMeta.rev))) {
    await pullFromSync(cloudMeta);
    return;
  }
  const [streamers, localStored] = await Promise.all([
    DataStore.getStreamers(),
    chrome.storage.local.get(PREFERENCES_KEY),
  ]);
  const rev = (Number(cloudMeta?.rev) || 0) + 1;
  const chunks = chunkForSync(streamers);
  const data = {
    [SYNC_META_KEY]: { rev, updatedAt: Date.now(), device, chunks: chunks.length },
    [SYNC_PREFS_KEY]: localStored[PREFERENCES_KEY] || {},
    [SYNC_PINNED_KEY]: localStored.betaPinnedIds || [],
  };
  chunks.forEach((chunk, index) => { data[`${SYNC_STREAMERS_PREFIX}${index}`] = chunk; });
  const staleKeys = [];
  for (let index = chunks.length; index < (Number(cloudMeta?.chunks) || 0); index += 1) {
    staleKeys.push(`${SYNC_STREAMERS_PREFIX}${index}`);
  }
  try {
    if (staleKeys.length) await chrome.storage.sync.remove(staleKeys);
    await chrome.storage.sync.set(data);
    pulledRevs.add(rev);
    await setStatus({ lastPushAt: Date.now(), lastError: "" });
  } catch (error) {
    console.warn("[Sync] poussée impossible :", error?.message || error);
    await setStatus({ lastError: error?.message || String(error) });
  }
}

function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushToSync().catch(warnWith("[Sync] poussée différée"));
  }, PUSH_DEBOUNCE_MS);
}

/** Tirée : fusionne l'état d'un autre appareil dans le stockage local. */
async function pullFromSync(meta) {
  const device = await ensureDevice();
  if (!isRemoteSync(meta, device)) return;
  applyingRemote = true;
  try {
    const chunkCount = Number(meta.chunks) || 0;
    const keys = [SYNC_PREFS_KEY];
    for (let index = 0; index < chunkCount; index += 1) keys.push(`${SYNC_STREAMERS_PREFIX}${index}`);
    const stored = await chrome.storage.sync.get(keys);
    const remoteStreamers = [];
    for (let index = 0; index < chunkCount; index += 1) {
      remoteStreamers.push(...(stored[`${SYNC_STREAMERS_PREFIX}${index}`] || []));
    }
    const [localStreamers, localStored] = await Promise.all([
      DataStore.getStreamers(),
      chrome.storage.local.get(PREFERENCES_KEY),
    ]);
    const streamers = mergeStreamers(localStreamers, remoteStreamers);
    const preferences = mergePreferences(localStored[PREFERENCES_KEY] || {}, stored[SYNC_PREFS_KEY] || {});
    // Épingles : union des deux appareils, bornée aux streamers qui existent.
    const knownIds = new Set(streamers.map((streamer) => streamer?.id).filter(Boolean));
    const pinnedIds = mergePinnedIds(localStored.betaPinnedIds, stored[SYNC_PINNED_KEY]).filter((id) => knownIds.has(id));
    if (JSON.stringify(streamers) !== JSON.stringify(localStreamers)) {
      await DataStore.saveStreamers(streamers);
    }
    if (JSON.stringify(preferences) !== JSON.stringify(localStored[PREFERENCES_KEY] || {})) {
      await PreferenceStore.set(preferences);
    }
    if (JSON.stringify(pinnedIds) !== JSON.stringify(localStored.betaPinnedIds || [])) {
      await chrome.storage.local.set({ betaPinnedIds: pinnedIds });
    }
    pulledRevs.add(Number(meta.rev));
    await setStatus({ lastPullAt: Date.now(), lastError: "" });
  } catch (error) {
    console.warn("[Sync] tirée impossible :", error?.message || error);
    await setStatus({ lastError: error?.message || String(error) });
  } finally {
    applyingRemote = false;
  }
}

/** Désactivation : l'utilisateur ne veut plus synchroniser, on vide le nuage. */
async function clearSync() {
  const stored = await chrome.storage.sync.get(null);
  const keys = Object.keys(stored).filter(
    (key) => key === SYNC_META_KEY || key === SYNC_PREFS_KEY || key === SYNC_PINNED_KEY || key.startsWith(SYNC_STREAMERS_PREFIX),
  );
  if (keys.length) await chrome.storage.sync.remove(keys);
  await chrome.storage.local.remove(SYNC_STATUS_KEY);
  pulledRevs.clear();
}

export function initSync() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes[SYNC_META_KEY]) {
      pullFromSync(changes[SYNC_META_KEY].newValue).catch(warnWith("[Sync] tirée"));
      return;
    }
    if (area !== "local" || applyingRemote) return;
    if (!(changes[STORAGE_KEYS.STREAMERS] || changes[PREFERENCES_KEY])) return;
    (async () => {
      if (!(await syncEnabled())) {
        // Le réglage vient de repasser à faux : ne plus rien laisser dans le nuage.
        if (changes[PREFERENCES_KEY]?.oldValue?.crossDeviceSync === true) await clearSync();
        return;
      }
      schedulePush();
    })().catch(warnWith("[Sync] réaction locale"));
  });
  // Réveil du SW : rattraper une poussée manquée et tirer ce qui a changé
  // ailleurs. Garde sur storage.sync : absent de certains environnements de
  // test qui ne moquent que storage.local.
  if (chrome.storage.sync?.get) {
    chrome.storage.sync
      .get(SYNC_META_KEY)
      .then((stored) => pullFromSync(stored[SYNC_META_KEY]))
      .catch(() => {});
  }
}
