// Sons personnels des alertes ciblées : l'utilisateur importe un fichier audio
// court, il reste sur l'appareil (stockage local, jamais envoyé). Module pur :
// la lecture du fichier et le stockage sont faits par l'appelant.

export const CUSTOM_SOUNDS_KEY = "streamPulseCustomSounds";
export const CUSTOM_PREFIX = "custom:";
export const MAX_CUSTOM_SOUNDS = 3;
export const MAX_CUSTOM_BYTES = 250 * 1024;
export const MAX_CUSTOM_SECONDS = 8;

export const isCustomSound = (value) => /^custom:[a-z0-9]{6,16}$/.test(String(value || ""));

const isAudioDataUrl = (value) => /^data:audio\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(String(value || ""));

/** { [id]: { name, dataUrl, seconds } } nettoyé, plafonné. */
export function normalizeLibrary(stored) {
  const out = {};
  if (!stored || typeof stored !== "object") return out;
  for (const [id, sound] of Object.entries(stored)) {
    if (!isCustomSound(`${CUSTOM_PREFIX}${id}`) || !isAudioDataUrl(sound?.dataUrl)) continue;
    out[id] = {
      name: String(sound.name || "").trim().slice(0, 40) || id,
      dataUrl: sound.dataUrl,
      seconds: Math.max(0, Number(sound.seconds) || 0),
    };
    if (Object.keys(out).length >= MAX_CUSTOM_SOUNDS) break;
  }
  return out;
}

/** Pourquoi un fichier est refusé : "type" | "size" | "length", ou null s'il convient. */
export function checkSoundFile({ type, size, seconds }) {
  if (!String(type || "").startsWith("audio/")) return "type";
  if (!(size > 0) || size > MAX_CUSTOM_BYTES) return "size";
  if (!(seconds > 0) || seconds > MAX_CUSTOM_SECONDS) return "length";
  return null;
}

export function addCustomSound(library, sound, id = Math.random().toString(36).slice(2, 10).padEnd(6, "0")) {
  const current = normalizeLibrary(library);
  if (Object.keys(current).length >= MAX_CUSTOM_SOUNDS) return { library: current, id: null };
  return { library: normalizeLibrary({ ...current, [id]: sound }), id };
}

export function removeCustomSound(library, value) {
  const id = String(value || "").slice(CUSTOM_PREFIX.length);
  const { [id]: _removed, ...rest } = normalizeLibrary(library);
  return rest;
}

/** Données à jouer pour une valeur « custom:id », ou null si le son a disparu. */
export function customSoundData(library, value) {
  if (!isCustomSound(value)) return null;
  return normalizeLibrary(library)[value.slice(CUSTOM_PREFIX.length)] || null;
}
