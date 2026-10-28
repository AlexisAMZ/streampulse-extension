// Fin de l'essai StreamPulse+ : deux notifications au plus, une la veille
// (« ton essai se termine demain ») et une à la fin (« c'est terminé »).
// Rien pour un abonné ni pour une licence autre qu'un essai. Module pur,
// testé par tests/trial-end.test.mjs.

export const TRIAL_END_KEY = "streamPulseTrialEnd";

const DAY_MS = 86_400_000;
/** Fenêtre de la notification de veille : moins d'un jour restant. */
const SOON_MS = DAY_MS;
/** Au-delà, la fin est trop ancienne pour être annoncée (navigateur fermé longtemps). */
const LATE_MS = 3 * DAY_MS;

/** État : { since, soon, ended } — since identifie l'essai annoncé. */
export function trialEndFrom(stored) {
  const value = stored && typeof stored === "object" ? stored : {};
  return { since: Number(value.since) || 0, soon: value.soon === true, ended: value.ended === true };
}

/**
 * @param {{ now: number, record: object|null, endsAt: number, state: { since: number, soon: boolean, ended: boolean } }} input
 * @returns {{ notify: "soon"|"ended"|null, state: object }}
 */
export function planTrialEnd({ now, record, endsAt, state }) {
  if (record?.plan !== "trial" || !endsAt) return { notify: null, state };
  const since = Number(record.since) || 0;
  // Nouvel essai (réinitialisation de dev) : on repart de zéro.
  const current = state.since === since ? state : { since, soon: false, ended: false };
  const left = endsAt - now;
  if (left <= 0) {
    if (current.ended || -left > LATE_MS) return { notify: null, state: current };
    return { notify: "ended", state: { ...current, soon: true, ended: true } };
  }
  // Sur un autre compte Twitch l'essai est en pause : pas d'annonce de veille.
  if (left <= SOON_MS && !current.soon && record.otherAccount !== true) {
    return { notify: "soon", state: { ...current, soon: true } };
  }
  return { notify: null, state: current };
}
