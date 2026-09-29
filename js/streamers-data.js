/**
 * Listes de streamers écrites de façon fiable : la popup n'envoie qu'une
 * intention (un ordre d'identifiants, une liste d'épinglés) et le service
 * worker l'applique au stockage COURANT. Avant, la popup réécrivait sa copie
 * chargée à l'ouverture et écrasait ce qui avait changé entre-temps.
 */

/**
 * Réordonne `streamers` selon `order` (identifiants). Un identifiant inconnu
 * est ignoré ; un streamer absent de l'ordre (ajouté entre-temps) est gardé,
 * à la fin, dans son ordre d'origine. Sans doublon.
 */
export function applyStreamerOrder(streamers, order) {
  const known = Array.isArray(streamers) ? streamers.filter(Boolean) : [];
  const byId = new Map(known.map((streamer) => [streamer.id, streamer]));
  const seen = new Set();
  const reordered = [];
  for (const id of Array.isArray(order) ? order : []) {
    const streamer = byId.get(String(id));
    if (streamer && !seen.has(streamer.id)) {
      reordered.push(streamer);
      seen.add(streamer.id);
    }
  }
  for (const streamer of known) {
    if (!seen.has(streamer.id)) reordered.push(streamer);
  }
  return reordered;
}

/**
 * Épinglages valides : seuls les identifiants de streamers existants sont
 * gardés, sans doublon, dans l'ordre reçu.
 */
export function sanitizePinnedIds(streamers, pinnedIds) {
  const known = new Set((Array.isArray(streamers) ? streamers : []).map((streamer) => streamer?.id));
  const result = [];
  for (const id of Array.isArray(pinnedIds) ? pinnedIds : []) {
    const key = String(id);
    if (known.has(key) && !result.includes(key)) result.push(key);
  }
  return result;
}
