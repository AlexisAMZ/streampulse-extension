// Compte Kick connecté, lu avec la session du navigateur (cookie session_token
// de kick.com, permissions cookies et kick.com déjà présentes). Sert seulement
// à l'essai StreamPulse+ : un essai par compte Kick. "" si déconnecté ou si
// Kick refuse : l'essai se fait alors sans ce signal.

const KICK_USER_URL = "https://kick.com/api/v1/user";
const KICK_TIMEOUT_MS = 8_000;

export async function kickViewerId() {
  try {
    const cookie = await chrome.cookies.get({ url: "https://kick.com", name: "session_token" });
    if (!cookie?.value) return "";
    const response = await fetch(KICK_USER_URL, {
      headers: { Accept: "application/json", Authorization: `Bearer ${decodeURIComponent(cookie.value)}` },
      credentials: "omit",
      signal: AbortSignal.timeout(KICK_TIMEOUT_MS),
    });
    if (!response.ok) return "";
    const id = String((await response.json())?.id ?? "");
    return /^\d{1,20}$/.test(id) ? id : "";
  } catch {
    return "";
  }
}
