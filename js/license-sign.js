// Vérification de la signature des licences StreamPulse+ (ECDSA P-256 / SHA-256).
// Le serveur (api/_license-sign.mjs du site) signe chaque réponse valide ; la
// clé privée n'est jamais dans l'extension. Le message ci-dessous doit rester
// identique à celui du serveur.

/** Clé publique de signature des licences (jamais secrète). */
export const LICENSE_PUBLIC_JWK = Object.freeze({
  kty: "EC",
  crv: "P-256",
  x: "hrp7FOdhTuo_E-hrz6MQhg9tKLJ6y0TNqaQa0D9tPAU",
  y: "ywZexCeFUOXG2JokLWkpQ4uXOZCwKgJrTn1n6HKiSWc",
});

const whole = (value) => Math.max(0, Math.floor(Number(value) || 0));

export function licenseMessage({ key, device, plan, role, since, referrals, iat, twitch }) {
  const lines = ["sp-license-v1", key, device, plan || "", role || "", whole(since), whole(referrals), whole(iat)];
  // Compte Twitch de l'essai : seulement quand il existe (même message qu'avant sinon).
  if (twitch) lines.push(`twitch:${twitch}`);
  return lines.join("\n");
}

function fromBase64Url(text) {
  const padded = String(text).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/**
 * @returns {Promise<"valid"|"invalid"|"missing">} « missing » : licence d'avant
 * la signature (transition) ; « invalid » : signature présente mais fausse.
 */
export async function signatureState(record, device, { subtle = globalThis.crypto?.subtle, jwk = LICENSE_PUBLIC_JWK } = {}) {
  if (!record?.sig || !record?.iat) return "missing";
  try {
    const publicKey = await subtle.importKey("jwk", { ...jwk }, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    // Clé et appareil posés après l'enregistrement : un champ « key » ou
    // « device » ajouté au stockage ne doit pas remplacer ceux de ce navigateur.
    const message = licenseMessage({ ...record, key: record.licenseKey, device });
    const ok = await subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      fromBase64Url(record.sig),
      new TextEncoder().encode(message),
    );
    return ok ? "valid" : "invalid";
  } catch {
    return "invalid";
  }
}
