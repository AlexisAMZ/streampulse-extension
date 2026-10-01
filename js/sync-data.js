// Synchro multi-appareils via chrome.storage.sync : fonctions pures pour le
// découpage en tranches et les fusions. Rien ici ne touche au navigateur.

import { DEFAULT_PREFERENCES } from "./preferences-data.js";

export const SYNC_META_KEY = "sp:sync:meta";
export const SYNC_PREFS_KEY = "sp:sync:prefs";
export const SYNC_STREAMERS_PREFIX = "sp:sync:streamers.";
export const SYNC_PINNED_KEY = "sp:sync:pinned";
export const SYNC_STATUS_KEY = "sp:sync:status";

/** Chrome refuse plus de 8 192 octets par clé : budget prudent pour le JSON d'une tranche. */
export const CHUNK_BUDGET_BYTES = 7000;

/**
 * Découpe la liste en tranches dont la sérialisation tient dans le budget.
 * Une entrée seule trop grosse pour le budget est impubliable : elle est
 * laissée de côté plutôt que de faire échouer toute la poussée.
 */
export function chunkForSync(streamers, budget = CHUNK_BUDGET_BYTES) {
  const chunks = [];
  let current = [];
  for (const streamer of Array.isArray(streamers) ? streamers : []) {
    const candidate = [...current, streamer];
    if (JSON.stringify(candidate).length <= budget) {
      current = candidate;
      continue;
    }
    if (current.length) chunks.push(current);
    current = JSON.stringify([streamer]).length <= budget ? [streamer] : [];
  }
  if (current.length) chunks.push(current);
  return chunks;
}

/**
 * Fusion des listes : union par identifiant. En cas de doublon, l'appareil
 * qui fusionne garde sa version — elle repartira vers l'autre à la poussée
 * suivante de l'état fusionné.
 */
export function mergeStreamers(local, remote) {
  const merged = Array.isArray(local) ? [...local] : [];
  const seen = new Set(merged.map((streamer) => streamer?.id).filter(Boolean));
  for (const streamer of Array.isArray(remote) ? remote : []) {
    if (streamer?.id && !seen.has(streamer.id)) {
      seen.add(streamer.id);
      merged.push(streamer);
    }
  }
  return merged;
}

/** Préférences qui restent propres à chaque appareil, même en synchro. */
const DEVICE_LOCAL_PREFS = new Set(["crossDeviceSync"]);

/**
 * Fusion des réglages : une clé locale encore à sa valeur d'usine suit
 * l'autre appareil ; une clé déjà personnalisée ici garde sa valeur ici.
 * crossDeviceSync ne voyage jamais : chaque appareil décide de participer.
 */
export function mergePreferences(local = {}, remote = {}) {
  const merged = { ...local };
  for (const [key, defaultValue] of Object.entries(DEFAULT_PREFERENCES)) {
    if (DEVICE_LOCAL_PREFS.has(key)) continue;
    const theirs = remote?.[key];
    if (theirs === undefined) continue;
    const mine = merged[key];
    const untouchedHere = mine === undefined || mine === defaultValue
      || (typeof mine === "object" && JSON.stringify(mine) === JSON.stringify(defaultValue));
    const theirsIsChoice = typeof theirs === "object"
      ? JSON.stringify(theirs) !== JSON.stringify(defaultValue)
      : theirs !== defaultValue;
    if (untouchedHere && theirsIsChoice) merged[key] = theirs;
  }
  return merged;
}

/** Épingles : union des deux appareils, à filtrer ensuite sur les streamers connus. */
export function mergePinnedIds(local, remote) {
  const merged = [];
  const seen = new Set();
  for (const id of [...(Array.isArray(local) ? local : []), ...(Array.isArray(remote) ? remote : [])]) {
    if (typeof id === "string" && id && !seen.has(id)) {
      seen.add(id);
      merged.push(id);
    }
  }
  return merged;
}

/**
 * Vrai quand un état sync vient d'un autre appareil. Nos propres écritures
 * re-déclenchent storage.onChanged : ce sont des échos, il faut les ignorer.
 */
export function isRemoteSync(meta, deviceId) {
  return Boolean(
    meta
    && typeof meta === "object"
    && meta.device
    && meta.device !== deviceId
    && Number(meta.rev) > 0,
  );
}
