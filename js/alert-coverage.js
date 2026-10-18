// Les trois alertes globales (live, catégorie, titre) s'appliquent à tous les
// streamers d'un clic. Cet état dit ce que les streamers ont réellement : tous,
// aucun, ou un mélange que l'interrupteur doit montrer au lieu de le masquer.

/** Valeur par défaut d'une alerte absente d'un streamer, comme dans le service worker. */
const ALERT_FIELDS = {
  live: { field: "notificationsEnabled", enabled: (value) => value !== false },
  game: { field: "gameNotificationsEnabled", enabled: (value) => value === true },
  title: { field: "titleNotificationsEnabled", enabled: (value) => value === true },
};

/**
 * @param {object[]} streamers
 * @param {"live"|"game"|"title"} kind
 * @returns {{ state: "on"|"off"|"mixed"|"empty", on: number, total: number }}
 */
export function alertCoverage(streamers, kind) {
  const alert = ALERT_FIELDS[kind];
  const roster = Array.isArray(streamers) ? streamers.filter((streamer) => streamer && typeof streamer === "object") : [];
  if (!alert || roster.length === 0) return { state: "empty", on: 0, total: roster.length };
  const on = roster.filter((streamer) => alert.enabled(streamer[alert.field])).length;
  return { state: on === roster.length ? "on" : on === 0 ? "off" : "mixed", on, total: roster.length };
}
