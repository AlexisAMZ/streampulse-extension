// Registre des chaînes ajoutées par l'import des follows Twitch, pour pouvoir
// les retirer d'un coup sans toucher à ce que l'utilisateur avait déjà.
// Module pur, partagé entre les pages et le service worker.

import { pruneStreamerRefs } from "./streamers-data.js";

export const IMPORTED_FOLLOWS_KEY = "streampulse:importedFollows";

/** @returns {{id: string, createdAt: number}[]} */
export function sanitizeImportedRegistry(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => typeof entry?.id === "string" && entry.id && Number.isFinite(entry.createdAt))
    .map(({ id, createdAt }) => ({ id, createdAt }));
}

/** Nouveau registre avec cette chaîne ; la dernière entrée d'un même id l'emporte. */
export function addImportedEntry(registry, streamer) {
  const entries = sanitizeImportedRegistry(registry);
  const [entry] = sanitizeImportedRegistry([streamer]);
  return entry ? [...entries.filter((item) => item.id !== entry.id), entry] : entries;
}

/**
 * Entrées dont la chaîne est toujours là, avec la même date d'ajout : une chaîne
 * retirée puis remise à la main a une autre date, elle appartient à l'utilisateur.
 */
export function stillImported(registry, streamers) {
  const list = Array.isArray(streamers) ? streamers : [];
  return sanitizeImportedRegistry(registry).filter((entry) =>
    list.some((streamer) => streamer?.id === entry.id && streamer.createdAt === entry.createdAt));
}

/** État après retrait des chaînes importées. Ne modifie rien de ce qu'il reçoit. */
export function planImportedRemoval({ registry, streamers, pinnedIds, groups }) {
  const removedIds = stillImported(registry, streamers).map((entry) => entry.id);
  const removed = new Set(removedIds);
  const refs = removedIds.reduce(
    (state, id) => pruneStreamerRefs(state, id),
    { pinnedIds, groups },
  );
  return {
    removedIds,
    streamers: (Array.isArray(streamers) ? streamers : []).filter((streamer) => !removed.has(streamer?.id)),
    pinnedIds: refs.pinnedIds,
    groups: refs.groups,
  };
}
