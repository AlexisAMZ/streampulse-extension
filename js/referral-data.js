// Gains du parrainage renvoyés par l'API de licence. Module pur.

/** Les gains changent au plus une fois par mois et par filleul : pas besoin d'appeler l'API à chaque ouverture. */
export const EARNINGS_REFRESH_MS = 6 * 60 * 60 * 1000;
const DEFAULT_PAYOUT_MIN_CENTS = 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const cents = (value) => {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : 0;
};

/** Réponse de l'action « referral » → gains à afficher et à garder en cache. */
export function normalizeEarnings(payload, now = Date.now()) {
  const earnings = payload?.earnings || {};
  return {
    earnedCents: cents(earnings.earnedCents),
    paidCents: cents(earnings.paidCents),
    balanceCents: cents(earnings.balanceCents),
    paypal: typeof earnings.paypal === "string" ? earnings.paypal : "",
    payoutMinCents: cents(payload?.payoutMinCents) || DEFAULT_PAYOUT_MIN_CENTS,
    fetchedAt: now,
  };
}

export function shouldRefreshEarnings(cached, now = Date.now()) {
  return !cached || now - (Number(cached.fetchedAt) || 0) > EARNINGS_REFRESH_MS;
}

export function isPaypalAddress(value) {
  return EMAIL_RE.test(String(value ?? "").trim());
}
