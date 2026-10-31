// Compte Kick connecté, lu avec la session du navigateur (cookie session_token
// de kick.com, permissions cookies et kick.com déjà présentes). Sert seulement
// à l'essai StreamPulse+ : un essai par compte Kick. "" si déconnecté ou si
// Kick refuse : l'essai se fait alors sans ce signal.

const KICK_USER_URL = "https://kick.com/api/v1/user";
const KICK_TIMEOUT_MS = 8_000;

/** Utilisateur Kick connecté (réponse brute de /api/v1/user), ou null. */
export async function fetchKickUser() {
  try {
    const cookie = await chrome.cookies.get({ url: "https://kick.com", name: "session_token" });
    if (!cookie?.value) {
      console.info("[SP] Kick : cookie session_token absent");
      return null;
    }
    const response = await fetch(KICK_USER_URL, {
      headers: { Accept: "application/json", Authorization: `Bearer ${decodeURIComponent(cookie.value)}` },
      credentials: "omit",
      signal: AbortSignal.timeout(KICK_TIMEOUT_MS),
    });
    if (!response.ok) console.info("[SP] Kick : API utilisateur refusée", response.status);
    return response.ok ? await response.json() : null;
  } catch (error) {
    console.info("[SP] Kick : API utilisateur injoignable", error?.message || error);
    return null;
  }
}

export async function kickViewerId() {
  const id = String((await fetchKickUser())?.id ?? "");
  return /^\d{1,20}$/.test(id) ? id : "";
}
