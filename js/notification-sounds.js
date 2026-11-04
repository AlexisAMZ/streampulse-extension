/**
 * Sons des notifications : catalogue, choix par type d'alerte et résolution.
 *
 * Module pur (aucun accès à chrome.*) partagé par le service worker, la popup
 * et le document audio hors écran. « classic » est le fichier historique
 * sons/notification.mp3 ; les autres sont synthétisés par Web Audio à partir
 * des notes ci-dessous : aucun fichier de plus dans le zip, aucun droit à gérer.
 */

import { isCustomSound } from "./custom-sounds.js";

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

export const SOUND_PRESETS = ["classic", "chime", "pulse", "bubble", "arpeggio", "drop", "punch", "airhorn", "siren", "laser"];

// `to` : fréquence d'arrivée d'un glissando (coups, sirène, laser) ; type "noise" : souffle.
const note = (freq, start, dur, gain = 0.28, type = "sine", to = null) => ({ freq, start, dur, gain, type, to });

/** Partitions des sons synthétisés : fréquence (Hz), début et durée (s), gain, forme d'onde. */
export const SOUND_SYNTH = {
  chime: [note(1318.5, 0, 0.9, 0.26), note(1975.5, 0.02, 0.7, 0.12)],
  pulse: [note(523.25, 0, 0.14, 0.3, "triangle"), note(523.25, 0.2, 0.14, 0.3, "triangle"), note(783.99, 0.4, 0.3, 0.3, "triangle")],
  bubble: [note(440, 0, 0.12, 0.3), note(660, 0.07, 0.12, 0.28), note(990, 0.14, 0.2, 0.24)],
  arpeggio: [note(523.25, 0, 0.18, 0.26), note(659.25, 0.1, 0.18, 0.26), note(783.99, 0.2, 0.18, 0.26), note(1046.5, 0.3, 0.45, 0.26)],
  drop: [note(880, 0, 0.35, 0.3), note(587.33, 0.16, 0.5, 0.26)],
  // Sons percutants : attaque franche, glissandos, souffle de frappe.
  punch: [note(160, 0, 0.22, 0.5, "sine", 42), note(1200, 0, 0.05, 0.34, "noise"), note(420, 0.16, 0.1, 0.32, "square", 300), note(630, 0.28, 0.35, 0.3, "square")],
  airhorn: [
    note(466.2, 0, 0.42, 0.2, "sawtooth"), note(587.3, 0, 0.42, 0.18, "sawtooth"), note(698.5, 0, 0.42, 0.16, "sawtooth"),
    note(466.2, 0.5, 0.7, 0.2, "sawtooth"), note(587.3, 0.5, 0.7, 0.18, "sawtooth"), note(698.5, 0.5, 0.7, 0.16, "sawtooth"),
  ],
  siren: [note(700, 0, 0.3, 0.3, "square", 1150), note(1150, 0.3, 0.3, 0.3, "square", 700), note(700, 0.6, 0.3, 0.3, "square", 1150), note(1150, 0.9, 0.3, 0.3, "square", 700)],
  laser: [note(2600, 0, 0.2, 0.32, "sawtooth", 220), note(2600, 0.22, 0.2, 0.32, "sawtooth", 220), note(2600, 0.44, 0.35, 0.32, "sawtooth", 160)],
};

/**
 * Son réservé aux alertes ciblées (règles intelligentes) : montée en deux
 * paliers que les autres sons n'ont pas, pour reconnaître sans regarder que
 * c'est une alerte choisie. Hors du catalogue : on ne le choisit pas, on ne
 * peut donc pas le confondre avec l'alerte classique.
 */
export const SMART_SOUND = "target";
SOUND_SYNTH[SMART_SOUND] = [
  note(150, 0, 0.2, 0.5, "sine", 40),
  note(1100, 0, 0.04, 0.32, "noise"),
  note(659.25, 0.12, 0.14, 0.3, "square"),
  note(987.77, 0.24, 0.14, 0.3, "square"),
  note(1318.5, 0.36, 0.14, 0.3, "square"),
  note(1975.5, 0.5, 0.75, 0.28, "triangle"),
];

/** Valeur d'une règle qui coupe le son de son alerte (la notification reste). */
export const SMART_SOUND_OFF = "off";

/** Son choisi sur une règle : le son d'alerte ciblée, un son du catalogue, ou aucun. */
export function normalizeRuleSound(value) {
  return value === SMART_SOUND_OFF || value === SMART_SOUND || SOUND_PRESETS.includes(value) || isCustomSound(value) ? value : SMART_SOUND;
}

/** Son d'une alerte ciblée, ou null : sons coupés dans les réglages, ou coupé sur la règle. */
export function resolveSmartSound(preferences, ruleSound = SMART_SOUND) {
  if (preferences?.soundsEnabled === false) return null;
  const sound = normalizeRuleSound(ruleSound);
  return sound === SMART_SOUND_OFF ? null : sound;
}

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
