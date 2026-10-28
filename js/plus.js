// StreamPulse+ : état de la licence. Module pur sauf verifyLicense, qui reçoit
// son fetch en paramètre pour rester testable.

import "./inject/plus-rule.js";

// Règle « Plus actif » : une seule source, js/inject/plus-rule.js, partagée
// avec les content scripts classiques.
const PLUS_RULE = globalThis.StreamPulsePlusRule;

export const PLUS_KEY = PLUS_RULE.PLUS_KEY;

/**
 * Serveur de licences sur streampulse.tech, adossé à Stripe. Il répond avec un
 * CORS ouvert : aucune permission d'hôte à ajouter au manifeste.
 * Il reçoit { key } et répond { valid, plan }.
 */
export const LICENSE_VERIFY_URL = "https://streampulse.tech/api/streampulse-license";

/** Libère la place de cet appareil (best effort, sans attendre la réponse). */
export function releaseDevice(licenseKey, device, fetchImpl) {
  if (!licenseKey || !device) return Promise.resolve();
  return fetchImpl(LICENSE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "release", key: licenseKey, device }),
  }).catch((error) => console.warn("[StreamPulse+] libération de l'appareil :", error?.message || error));
}

/**
 * Portail client Stripe pour la clé de ce navigateur.
 * `device` : un navigateur enregistré sur la clé ouvre le portail tout de suite ;
 * sinon le serveur envoie le lien à l'adresse de paiement (202 { emailed }).
 * @returns {Promise<{url: string} | {emailed: true} | null>}
 */
export async function portalUrl(licenseKey, fetchImpl, device = "") {
  const response = await fetchImpl(LICENSE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "portal", key: licenseKey, ...(device ? { device } : {}) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return null;
  if (payload?.url) return { url: payload.url };
  return payload?.emailed ? { emailed: true } : null;
}

/** Page d'achat ouverte par le bouton « Débloquer StreamPulse+ ». */
const PLUS_CHECKOUT_URL = "https://streampulse.tech/plus";

/** Dossier de langue du site (le français est à la racine). */
const SITE_DIRS = { fr: "", "pt-BR": "pt-br" };
const SITE_LANGS = ["fr", "en", "es", "pt-BR", "de", "it", "pl", "tr", "ru", "ja", "ko", "id", "nl", "sv", "cs"];

/** Page StreamPulse+ dans la langue de l'extension (anglais par défaut). */
export function plusPageUrl(lang, plan, creator) {
  const code = SITE_LANGS.includes(lang) ? lang : "en";
  const dir = code in SITE_DIRS ? SITE_DIRS[code] : code;
  const base = dir ? `https://streampulse.tech/${dir}/plus` : PLUS_CHECKOUT_URL;
  const params = new URLSearchParams();
  if (plan) params.set("plan", plan);
  if (creator) params.set("creator", creator);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Sans nouvelle vérification réussie, la licence reste active ce délai (hors ligne). */
export const PLUS_GRACE_MS = PLUS_RULE.PLUS_GRACE_MS;

const PLUS_PLANS = ["monthly", "yearly", "lifetime", "trial"];

/** Essai StreamPulse+ de 7 jours (une fois par appareil, accordé par le serveur). */
export const TRIAL_MS = PLUS_RULE.TRIAL_MS;
export const trialEndsAt = (record) => PLUS_RULE.trialEndsAt(record);
export const trialPaused = (record, now = Date.now()) => PLUS_RULE.trialPaused(record, now);

/** Licence lue dans le stockage, puis isPlusActive. */
export async function plusActiveFrom(storage) {
  return isPlusActive((await storage.get(PLUS_KEY))[PLUS_KEY]);
}
const TRIAL_KEY_PATTERN = /^TRIAL-[a-f0-9]{16,40}$/;

/** Identifiant de ce navigateur : une clé vaut pour 2 appareils. */
const DEVICE_KEY = "streamPulseDeviceId";

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
  const trial = String(input ?? "").trim();
  if (/^trial-/i.test(trial)) {
    const key = `TRIAL-${trial.slice(6).toLowerCase()}`;
    return TRIAL_KEY_PATTERN.test(key) ? key : null;
  }
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
  if (!record || !["active", "unverified"].includes(record.status) || !record.licenseKey) return false;
  // Une date dans le futur ne doit jamais repousser la revérification (licence forgée).
  if (PLUS_RULE.isFuture(record.checkedAt, now) || PLUS_RULE.isFuture(record.verifiedAt, now)) return true;
  return now - (Number(record.checkedAt || record.verifiedAt) || 0) >= PLUS_RECHECK_MS;
}

export function isPlusActive(record, now = Date.now()) {
  return PLUS_RULE.isPlusActive(record, now);
}

/**
 * @returns {Promise<{ok: true, record: object} | {ok: false, error: "format"|"invalid"|"device_limit"|"network"}>}
 */
const LICENSE_VERIFY_TIMEOUT_MS = 15_000;

/** POST au serveur de licences : la réponse JSON, ou null (réseau, serveur en panne). */
async function postLicense(body, fetchImpl) {
  try {
    const response = await fetchImpl(LICENSE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // `version` : le serveur refuse les versions périmées (STREAMPULSE_MIN_VERSION).
      body: JSON.stringify({ ...body, version: globalThis.chrome?.runtime?.getManifest?.().version }),
      // Un serveur qui ne répond jamais (paquets jetés) ne doit pas bloquer le garde.
      signal: AbortSignal.timeout(LICENSE_VERIFY_TIMEOUT_MS),
    });
    if (!response.ok && ![403, 404, 422].includes(response.status)) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/** Réponse valide du serveur → enregistrement de licence (signature comprise). */
function licenseRecord(payload, licenseKey, now) {
  const plan = PLUS_PLANS.includes(payload.plan) ? payload.plan : "monthly";
  const referrals = Math.max(0, Math.floor(Number(payload.referrals) || 0));
  // Rôle posé à la main sur la licence (métadonnée Stripe sp_role) : « admin » pour le fondateur,
  // « bughunter » pour qui a trouvé un bug.
  const role = ["admin", "bughunter"].includes(payload.role) ? payload.role : "";
  // Début de l'abonnement (tuile d'ancienneté), ou de l'essai.
  const since = Math.max(0, Number(payload.since) || 0);
  // Signature du serveur : `iat` (date serveur) et `sig`, vérifiées par js/sw/license-guard.js.
  const signature = payload.sig && payload.iat ? { iat: Math.floor(Number(payload.iat)), sig: String(payload.sig) } : {};
  // Essai : compte Twitch auquel il est lié (Drops, badges et points seulement sur ce compte).
  const twitch = /^\d{1,20}$/.test(String(payload.twitch ?? "")) ? String(payload.twitch) : "";
  return { licenseKey, plan, status: "active", verifiedAt: now, referrals, role, since, ...(twitch ? { twitch } : {}), ...signature };
}

export async function verifyLicense(input, fetchImpl, now = Date.now(), device = "") {
  const licenseKey = normalizeLicenseKey(input);
  if (!licenseKey) return { ok: false, error: "format" };
  const payload = await postLicense({ key: licenseKey, device }, fetchImpl);
  if (!payload) return { ok: false, error: "network" };
  if (payload.error === "device_limit") return { ok: false, error: "device_limit" };
  if (!payload.valid) return { ok: false, error: "invalid" };
  return { ok: true, record: licenseRecord(payload, licenseKey, now) };
}

/**
 * Demande l'essai de 7 jours pour cet appareil. Le serveur renvoie toujours le
 * même essai pour un appareil donné, jamais un nouveau.
 * @returns {Promise<{ok: true, record: object} | {ok: false, error: "trial_ended"|"invalid"|"network"}>}
 */
export async function startTrial(fetchImpl, device, now = Date.now(), twitch = "", { kick = "", synced = false } = {}) {
  const signals = { ...(twitch ? { twitch } : {}), ...(kick ? { kick } : {}), ...(synced ? { synced: true } : {}) };
  const payload = await postLicense({ action: "trial", device, ...signals }, fetchImpl);
  if (!payload) return { ok: false, error: "network" };
  if (payload.error === "trial_ended") return { ok: false, error: "trial_ended" };
  const licenseKey = normalizeLicenseKey(payload.key);
  if (payload.error === "trial_limit") return { ok: false, error: "trial_limit" };
  if (!payload.valid || payload.plan !== "trial" || licenseKey !== `TRIAL-${device}`) return { ok: false, error: "invalid" };
  return { ok: true, record: licenseRecord(payload, licenseKey, now) };
}

/** Essai lié à un compte Twitch, et un autre compte est connecté. Déconnecté ou essai pas encore lié : non. */
export function trialOnOtherAccount(record, viewerId) {
  return record?.plan === "trial" && Boolean(record.twitch) && Boolean(viewerId) && String(viewerId) !== record.twitch;
}
