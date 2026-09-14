// StreamPulse+ : état de la licence. Module pur sauf verifyLicense, qui reçoit
// son fetch en paramètre pour rester testable.

export const PLUS_KEY = "streamPulsePlus";

/**
 * Serveur de licences sur streampulse.fr, adossé à Stripe. Il répond avec un
 * CORS ouvert : aucune permission d'hôte à ajouter au manifeste.
 * Il reçoit { key } et répond { valid, plan }.
 */
export const LICENSE_VERIFY_URL = "https://www.streampulse.fr/api/streampulse-license";

/** Libère la place de cet appareil (best effort, sans attendre la réponse). */
export function releaseDevice(licenseKey, device, fetchImpl) {
  if (!licenseKey || !device) return Promise.resolve();
  return fetchImpl(LICENSE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "release", key: licenseKey, device }),
  }).catch(() => {});
}

/** Lien vers le portail client Stripe pour la clé de ce navigateur. */
export async function portalUrl(licenseKey, fetchImpl) {
  const response = await fetchImpl(LICENSE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "portal", key: licenseKey }),
  });
  const payload = await response.json().catch(() => ({}));
  return response.ok && payload?.url ? payload.url : null;
}

/** Page d'achat ouverte par le bouton « Débloquer StreamPulse+ ». */
export const PLUS_CHECKOUT_URL = "https://www.streampulse.fr/plus";

/** Sans nouvelle vérification réussie, la licence reste active ce délai (hors ligne). */
export const PLUS_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

export const PLUS_PLANS = ["monthly", "lifetime"];

/** Identifiant de ce navigateur : une clé vaut pour 2 appareils. */
export const DEVICE_KEY = "streamPulseDeviceId";

/** Lit ou crée l'identifiant d'appareil (32 caractères hexadécimaux). */
export async function getDeviceId(storage) {
  const stored = await storage.get(DEVICE_KEY);
  if (/^[a-f0-9]{32}$/.test(stored[DEVICE_KEY] || "")) return stored[DEVICE_KEY];
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  await storage.set({ [DEVICE_KEY]: id });
  return id;
}

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
 * @returns {Promise<{ok: true, record: object} | {ok: false, error: "format"|"invalid"|"device_limit"|"network"}>}
 */
export async function verifyLicense(input, fetchImpl, now = Date.now(), device = "") {
  const licenseKey = normalizeLicenseKey(input);
  if (!licenseKey) return { ok: false, error: "format" };
  let payload;
  try {
    const response = await fetchImpl(LICENSE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: licenseKey, device }),
    });
    if (!response.ok && ![403, 404, 422].includes(response.status)) {
      return { ok: false, error: "network" };
    }
    payload = await response.json();
  } catch {
    return { ok: false, error: "network" };
  }
  if (payload?.error === "device_limit") return { ok: false, error: "device_limit" };
  if (!payload?.valid) return { ok: false, error: "invalid" };
  const plan = PLUS_PLANS.includes(payload.plan) ? payload.plan : "monthly";
  return { ok: true, record: { licenseKey, plan, status: "active", verifiedAt: now } };
}
