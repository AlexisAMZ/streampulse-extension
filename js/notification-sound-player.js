// Lecture d'un son de notification : fichier historique ou synthèse Web Audio.
// Utilisé par le document hors écran (vraies notifications) et par la popup
// (bouton « Écouter »). Navigateur uniquement.
import { CLASSIC_SOUND_FILE, SOUND_SYNTH } from "./notification-sounds.js";

let sharedContext = null;

function audioContext() {
  const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Context) return null;
  if (!sharedContext || sharedContext.state === "closed") sharedContext = new Context();
  return sharedContext;
}

function playSynth(notes, volume) {
  const context = audioContext();
  if (!context) return Promise.reject(new Error("Web Audio indisponible"));
  const play = () => {
    const base = context.currentTime + 0.02;
    for (const { freq, start, dur, gain, type } of notes) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const peak = gain * volume;
      oscillator.type = type;
      oscillator.frequency.value = freq;
      // Attaque courte puis décroissance exponentielle : pas de clic en fin de note.
      envelope.gain.setValueAtTime(0.0001, base + start);
      envelope.gain.exponentialRampToValueAtTime(peak, base + start + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, base + start + dur);
      oscillator.connect(envelope).connect(context.destination);
      oscillator.start(base + start);
      oscillator.stop(base + start + dur + 0.05);
    }
  };
  return context.state === "suspended" ? context.resume().then(play) : Promise.resolve(play());
}

/** Joue un son du catalogue ; résout quand la lecture a démarré. */
export function playNotificationSound(preset, { volume = 1, getUrl = (path) => path } = {}) {
  const level = Math.min(Math.max(Number(volume) || 0, 0), 1);
  const notes = SOUND_SYNTH[preset];
  if (notes) return playSynth(notes, level);
  const audio = new Audio(getUrl(CLASSIC_SOUND_FILE));
  audio.volume = level;
  return audio.play();
}
