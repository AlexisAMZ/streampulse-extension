// Écriture du compteur de valeur StreamPulse+ (js/plus-value.js), côté service
// worker. Read-modify-write séquencé comme StatsStore : deux gains quasi
// simultanés (badge farmé + Drop récupéré dans la même seconde) ne doivent pas
// s'écraser. Le popup ne fait que lire la clé.

import { PLUS_VALUE_KEY, plusValueAdd, plusValueFrom } from "../plus-value.js";

let queue = Promise.resolve();

/** Compte des badges farmés et/ou des Drops récupérés par une fonction Plus. */
export function recordPlusValue(gains = {}) {
  const run = queue.then(async () => {
    const stored = await chrome.storage.local.get(PLUS_VALUE_KEY);
    const next = plusValueAdd(plusValueFrom(stored), gains, Date.now());
    await chrome.storage.local.set({ [PLUS_VALUE_KEY]: next });
    return next;
  });
  // L'échec reste porté par `run`, rendu à l'appelant : la file, elle, continue.
  queue = run.catch(() => {});
  return run;
}
