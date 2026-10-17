/**
 * Sons des notifications : catalogue, choix par type d'alerte et résolution.
 *
 * Module pur (aucun accès à chrome.*) partagé par le service worker, la popup
 * et le document audio hors écran. « classic » est le fichier historique
 * sons/notification.mp3 ; les autres sont synthétisés par Web Audio à partir
 * des notes ci-dessous : aucun fichier de plus dans le zip, aucun droit à gérer.
 */

export const SOUND_INHERIT = "inherit";
export const DEFAULT_SOUND = "classic";
export const CLASSIC_SOUND_FILE = "sons/notification.mp3";

/** Types d'alerte qui peuvent avoir leur propre son, avec la clé de préférence. */
export const SOUND_KINDS = ["live", "game", "title", "raid"];
export const SOUND_KIND_PREFERENCE = {
  live: "soundLive",
  game: "soundGame",
  title: "soundTitle",
  raid: "soundRaid",
};

export const SOUND_PRESETS = ["classic", "chime", "pulse", "bubble", "arpeggio", "drop"];

const note = (freq, start, dur, gain = 0.28, type = "sine") => ({ freq, start, dur, gain, type });

/** Partitions des sons synthétisés : fréquence (Hz), début et durée (s), gain, forme d'onde. */
export const SOUND_SYNTH = {
  chime: [note(1318.5, 0, 0.9, 0.26), note(1975.5, 0.02, 0.7, 0.12)],
  pulse: [note(523.25, 0, 0.14, 0.3, "triangle"), note(523.25, 0.2, 0.14, 0.3, "triangle"), note(783.99, 0.4, 0.3, 0.3, "triangle")],
  bubble: [note(440, 0, 0.12, 0.3), note(660, 0.07, 0.12, 0.28), note(990, 0.14, 0.2, 0.24)],
  arpeggio: [note(523.25, 0, 0.18, 0.26), note(659.25, 0.1, 0.18, 0.26), note(783.99, 0.2, 0.18, 0.26), note(1046.5, 0.3, 0.45, 0.26)],
  drop: [note(880, 0, 0.35, 0.3), note(587.33, 0.16, 0.5, 0.26)],
};

const isPreset = (value) => typeof value === "string" && SOUND_PRESETS.includes(value);

/** Son général : un son du catalogue, « classic » sinon. */
export function normalizeGeneralSound(value) {
  return isPreset(value) ? value : DEFAULT_SOUND;
}

/** Son d'un type : un son du catalogue, ou « inherit » (= le son général). */
export function normalizeKindSound(value) {
  return isPreset(value) ? value : SOUND_INHERIT;
}

/**
 * Son à jouer pour ce type d'alerte, ou null quand les sons sont coupés.
 * Le son par type est réservé à StreamPulse+ : sans abonnement, le choix reste
 * enregistré mais le son général s'applique partout.
 */
export function resolveSound(preferences, kind, { plus = false } = {}) {
  if (preferences?.soundsEnabled === false) return null;
  const own = plus ? normalizeKindSound(preferences?.[SOUND_KIND_PREFERENCE[kind]]) : SOUND_INHERIT;
  return own === SOUND_INHERIT ? normalizeGeneralSound(preferences?.notificationSound) : own;
}
