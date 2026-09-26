// Effets StreamPulse+ du badge et du pseudo, et qui y a droit. Module pur.
//
// Source unique côté popup. js/inject/twitch-badge.js et
// js/inject/settings-drawer.js (scripts classiques, sans import) en gardent une
// copie, tout comme l'API du site (api/streampulse-badges.mjs) :
// tests/cosmetics-data.test.mjs vérifie que les copies de l'extension suivent.

export const BADGE_FX = Object.freeze([
  "pulse", "shine", "rainbow", "glow", "bounce", "spin", "flicker",
  "heartbeat", "float", "wobble", "prism", "glitch", "fire", "frost",
  "halo", "crown",
]);

export const NAME_FX = Object.freeze([
  "aurora", "sunset", "lcd", "gold", "neon", "rainbow",
  "fire", "frost", "glitch",
  "ambassador", "founder",
]);

/** Effets d'ambassadeur : nombre de filleuls abonnés exigé (mêmes paliers que le serveur). */
export const REFERRAL_FX = Object.freeze({ ambassador: 1, halo: 3 });

/** Effets réservés au fondateur de StreamPulse (rôle « admin » posé sur sa licence). */
export const FOUNDER_FX = Object.freeze(["crown", "founder"]);

const isFounder = (access) => access?.role === "admin";

/** Rang affiché : fondateur, ambassadeur (au moins un filleul) ou aucun. */
export function rankOf(access) {
  if (isFounder(access)) return "founder";
  return Math.max(0, Number(access?.referrals) || 0) >= 1 ? "ambassador" : "";
}

/**
 * Pourquoi un effet est verrouillé : "" (libre), "plus" (StreamPulse+ requis),
 * "referrals" (pas assez de filleuls) ou "founder" (réservé au fondateur).
 * Le fondateur a tout.
 */
export function fxLock(value, access = {}) {
  if (!value) return "";
  if (!access.plus) return "plus";
  if (isFounder(access)) return "";
  if (FOUNDER_FX.includes(value)) return "founder";
  const needed = REFERRAL_FX[value] || 0;
  return needed > Math.max(0, Number(access.referrals) || 0) ? "referrals" : "";
}

/** Effets proposés : ceux du fondateur ne sont montrés qu'à lui. */
export function visibleFx(list, access = {}) {
  return isFounder(access) ? [...list] : list.filter((value) => !FOUNDER_FX.includes(value));
}

/** Réglage rangé : un effet inconnu est oublié, jamais transmis. */
export function normalizeCosmetics(value) {
  const input = value && typeof value === "object" ? value : {};
  return {
    badgeFx: BADGE_FX.includes(input.badgeFx) ? input.badgeFx : "",
    nameFx: NAME_FX.includes(input.nameFx) ? input.nameFx : "",
  };
}
