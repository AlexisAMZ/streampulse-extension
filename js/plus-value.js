// Compteur de valeur de StreamPulse+ : badges farmés et Drops récupérés par
// les fonctions automatiques, depuis la première activation. Montrés aux
// abonnés dans l'écran Plus. Module pur : aucun accès à chrome.* ni au DOM.
// Testé par tests/plus-value.test.mjs.

export const PLUS_VALUE_KEY = "streamPulsePlusValue";

/** Valeur lue du storage, sans faire confiance à sa forme. */
export function plusValueFrom(stored = {}) {
  const value = (stored || {})[PLUS_VALUE_KEY];
  const ok = value !== null && typeof value === "object" && !Array.isArray(value);
  const count = (raw) => (ok ? Math.max(0, Math.floor(Number(raw) || 0)) : 0);
  return { badges: count(value?.badges), drops: count(value?.drops), since: count(value?.since) };
}

/**
 * Ajoute des gains au compteur. `since` garde la première écriture : il sert
 * plus tard à dater la promesse « depuis ton abonnement ».
 */
export function plusValueAdd(value, gains = {}, now = Date.now()) {
  const current = value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
  const add = (raw) => Math.max(0, Math.floor(Number(raw) || 0));
  return {
    badges: add(current.badges) + add(gains.badges),
    drops: add(current.drops) + add(gains.drops),
    since: add(current.since) || Math.max(0, Math.floor(Number(now) || 0)),
  };
}
