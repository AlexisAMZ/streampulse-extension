// StreamPulse+ : état de la licence. Module pur sauf verifyLicense, qui reçoit
// son fetch en paramètre pour rester testable.

export const PLUS_KEY = "streamPulsePlus";

/**
 * Serveur de licences sur streampulse.fr, adossé à Stripe. Il répond avec un
 * CORS ouvert : aucune permission d'hôte à ajouter au manifeste.
 * Il reçoit { key } et répond { valid, plan }.
 */
export const LICENSE_VERIFY_URL = "https://www.streampulse.fr/api/streampulse-license";

/** Page d'achat ouverte par le bouton « Débloquer StreamPulse+ ». */
export const PLUS_CHECKOUT_URL = "https://www.streampulse.fr/plus";

/** Sans nouvelle vérification réussie, la licence reste active ce délai (hors ligne). */
export const PLUS_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

export const PLUS_PLANS = ["monthly", "lifetime"];

const KEY_PATTERN = /^SP-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}$/;

export function normalizeLicenseKey(input) {
  const compact = String(input ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const body = compact.startsWith("SP") ? compact.slice(2) : compact;
  if (body.length !== 16) return null;
  const key = `SP-${body.match(/.{4}/g).join("-")}`;
  return KEY_PATTERN.test(key) ? key : null;
}

/** Revérification quotidienne : une résiliation ou un remboursement se voit sous 24 h. */
export const PLUS_RECHECK_MS = 24 * 60 * 60 * 1000;

export function needsRecheck(record, now = Date.now()) {
  if (!record || record.status !== "active" || !record.licenseKey) return false;
  return now - (Number(record.checkedAt || record.verifiedAt) || 0) >= PLUS_RECHECK_MS;
}

export function isPlusActive(record, now = Date.now()) {
  if (!record || record.status !== "active" || !record.licenseKey) return false;
  const verifiedAt = Number(record.verifiedAt) || 0;
  if (record.plan === "lifetime") return true;
  return now - verifiedAt <= PLUS_GRACE_MS;
}

/**
 * @returns {Promise<{ok: true, record: object} | {ok: false, error: "format"|"invalid"|"network"}>}
 */
export async function verifyLicense(input, fetchImpl, now = Date.now()) {
  const licenseKey = normalizeLicenseKey(input);
  if (!licenseKey) return { ok: false, error: "format" };
  let payload;
  try {
    const response = await fetchImpl(LICENSE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: licenseKey }),
    });
    if (!response.ok && response.status !== 404 && response.status !== 422) {
      return { ok: false, error: "network" };
    }
    payload = await response.json();
  } catch {
    return { ok: false, error: "network" };
  }
  if (!payload?.valid) return { ok: false, error: "invalid" };
  const plan = PLUS_PLANS.includes(payload.plan) ? payload.plan : "monthly";
  return { ok: true, record: { licenseKey, plan, status: "active", verifiedAt: now } };
}
