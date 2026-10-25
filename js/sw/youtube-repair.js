// Réparation des chaînes YouTube suivies dont le nom est resté un identifiant
// « UC… » (ajout depuis une page vidéo avant que le nom soit lu) : on retrouve
// le vrai nom et la photo, sans toucher au reste de la liste.

const CHANNEL_ID = /^UC[\w-]{10,32}$/;
const MAX_PER_PASS = 5;

/** Chaîne YouTube dont le nom affiché est vide ou n'est qu'un identifiant de chaîne. */
export function needsYoutubeRepair(streamer) {
  if (streamer?.platform !== "youtube") return false;
  const name = String(streamer.displayName || "");
  return !name || CHANNEL_ID.test(name);
}

const hasPhoto = (url) => /^https?:\/\//i.test(url || "");

/** Nouvelle liste avec les noms et photos réparés (repairs : id du suivi → { name, avatar }). */
export function applyYoutubeRepairs(streamers, repairs) {
  return streamers.map((streamer) => {
    const fix = repairs.get(streamer.id);
    if (!fix) return streamer;
    return {
      ...streamer,
      displayName: fix.name,
      avatarUrl: hasPhoto(streamer.avatarUrl) ? streamer.avatarUrl : fix.avatar || streamer.avatarUrl,
    };
  });
}

/**
 * Résout d'abord (réseau), relit ensuite la liste puis écrit : une chaîne ajoutée ou
 * retirée pendant la résolution n'est ni perdue ni ressuscitée.
 * @returns {Promise<number>} nombre de chaînes réparées
 */
export async function repairYoutubeNames({ getStreamers, saveStreamers, resolve, limit = MAX_PER_PASS }) {
  const stuck = (await getStreamers()).filter(needsYoutubeRepair).slice(0, limit);
  const repairs = new Map();
  for (const streamer of stuck) {
    const channel = await resolve(streamer.handle).catch(() => null);
    if (channel?.name && channel.name !== streamer.handle && !CHANNEL_ID.test(channel.name)) {
      repairs.set(streamer.id, { name: channel.name, avatar: channel.avatar || "" });
    }
  }
  if (!repairs.size) return 0;
  const current = await getStreamers();
  const next = applyYoutubeRepairs(current, repairs);
  const repaired = next.filter((streamer, index) => streamer !== current[index]).length;
  if (repaired) await saveStreamers(next);
  return repaired;
}
