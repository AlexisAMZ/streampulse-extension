// Parrainage : gains renvoyés par l'API de licence, lien à partager et règle de
// la carte de l'onglet Streamers. Module pur.

import { plusPageUrl } from "./plus.js";

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

const REFERRAL_CODE_RE = /^AMI-[A-Z0-9]{6}$/;

/** Forme exacte des codes émis par le serveur : rien d'autre n'entre dans une URL. */
export const isReferralCode = (value) => typeof value === "string" && REFERRAL_CODE_RE.test(value);

/** Page Plus du site, dans la langue du parrain : l'ami n'a rien à saisir, le lien désigne le parrain (aucune remise). */
export function referralLink(code, lang) {
  return isReferralCode(code) ? `${plusPageUrl(lang)}?ref=${code}` : "";
}

/** La carte attend quelques jours après l'installation, et « Plus tard » la repousse d'un mois. */
export const REFERRAL_ASK_FIRST_MS = 3 * 86_400_000;
export const REFERRAL_ASK_LATER_MS = 30 * 86_400_000;

/** Faut-il proposer le parrainage sur l'onglet Streamers ? Pur, testé. */
export function shouldAskReferral(state, { hasCode = false } = {}, now = Date.now()) {
  if (!state?.firstSeen || state.done || hasCode) return false;
  if (now - state.firstSeen < REFERRAL_ASK_FIRST_MS) return false;
  return !state.snoozedUntil || now >= state.snoozedUntil;
}
