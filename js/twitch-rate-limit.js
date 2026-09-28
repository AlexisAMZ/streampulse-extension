/**
 * Gestion du 429 Helix (quota Twitch) : quand Twitch repond « Too Many
 * Requests », on met une pause persistee plutot que de marteler l'API a chaque
 * sondage. Pendant la pause, les streamers Twitch gardent leur etat precedent
 * (ni erreur affichee, ni bascule offline/on-line).
 *
 * La pause est bornee : une valeur farfelue de Twitch (ou un bug de parsing)
 * ne doit pas couper le sondage pendant des heures.
 */

export const RATE_LIMIT_PAUSE_MAX_MS = 10 * 60 * 1000;

/**
 * Renvoie l'instant (ms) jusqu'auquel attendre, ou 0 si les en-tetes ne
 * portent aucune consigne exploitable ou deja expiree. `headers` :
 * Headers-like (get(name) → string | null). `now` : horodatage ms.
 */
export function rateLimitResetAt(headers, now = Date.now()) {
  if (!headers || typeof headers.get !== "function") return 0;
  const resetHeader = Number(headers.get("ratelimit-reset"));
  const retryAfterHeader = Number(headers.get("retry-after"));
  let resetAt = 0;
  if (Number.isFinite(resetHeader) && resetHeader > 0) {
    // Ratelimit-Reset : epoch en secondes.
    resetAt = resetHeader * 1000;
  } else if (Number.isFinite(retryAfterHeader) && retryAfterHeader > 0) {
    // Retry-After : duree en secondes a compter de maintenant.
    resetAt = now + retryAfterHeader * 1000;
  }
  if (resetAt <= now) return 0;
  return Math.min(resetAt, now + RATE_LIMIT_PAUSE_MAX_MS);
}

/**
 * Vrai si l'erreur represente un 429 (message « 429 ... » tel que leve par
 * fetchJson, ou statusCode porte par l'erreur).
 */
export function isRateLimitError(error) {
  if (!error) return false;
  if (error.statusCode === 429) return true;
  return /^429 /.test(String(error?.message || ""));
}
