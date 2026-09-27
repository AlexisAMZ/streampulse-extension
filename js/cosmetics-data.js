// Effets StreamPulse+ du badge et du pseudo, et qui y a droit. Module pur.
//
// Source unique côté popup. js/inject/twitch-badge.js et
// js/inject/settings-drawer.js (scripts classiques, sans import) en gardent une
// copie, tout comme l'API du site (api/streampulse-badges.mjs) :
// tests/cosmetics-data.test.mjs vérifie que les copies de l'extension suivent.

/**
 * Nuancier commun au logo et au pseudo : dégradés puis textures, chacun avec sa
 * propre animation (css/fx-effects.css). Depuis 26.9.28, plus d'animation à
 * choisir à part : la couleur porte son mouvement.
 */
export const COLOR_FX = Object.freeze([
  "aurora", "sunset", "lcd", "gold", "rainbow", "fire", "frost",
  "galaxy", "holo", "lava", "marble", "chrome", "glitter", "candy", "toxic", "ocean",
]);

/** Textures du nuancier. */
export const TEXTURE_FX = Object.freeze(["galaxy", "holo", "lava", "marble", "chrome", "glitter", "candy", "toxic", "ocean"]);

// « tenure » (Jauge) et « pager » : badge d'ancienneté à la place du logo coloré.
// « halo » et « crown » : récompenses (parrainage, fondateur).
export const BADGE_FX = Object.freeze(["tenure", "pager", ...COLOR_FX, "halo", "crown"]);

// « ambassador » et « founder » : récompenses (parrainage, fondateur).
export const NAME_FX = Object.freeze([...COLOR_FX, "ambassador", "founder"]);

/** Effets retirés en 26.9.28 : repris par leur équivalent, les autres redeviennent classiques. */
export const LEGACY_FX = Object.freeze({ prism: "rainbow" });

const MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;

/**
 * Tuiles d'ancienneté StreamPulse+ (fond du logo, façon 7TV), du plus ancien
 * palier au plus récent : mois d'abonnement requis → clé de la tuile.
 */
export const TENURE_TIERS = Object.freeze([
  [48, "y4"], [36, "y3"], [24, "y2"], [18, "y1h"], [12, "y1"], [9, "m9"], [6, "m6"], [3, "m3"], [0, "m1"],
]);

/** Tuile d'un abonné : « life » pour la licence à vie, sinon selon les mois écoulés depuis `since`. */
export function tenureTier(plan, since, now = Date.now()) {
  if (plan === "lifetime") return "life";
  if (plan !== "monthly") return "";
  const months = Number(since) > 0 ? Math.max(0, Math.floor((now - Number(since)) / MONTH_MS)) : 0;
  return TENURE_TIERS.find(([min]) => months >= min)[1];
}

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

/** Styles du badge d'ancienneté : effet choisi → classe CSS (sp-tier--<style>). */
export const TENURE_STYLES = Object.freeze({ tenure: "gauge", pager: "pager" });

/** Effet du badge tant que l'abonné n'en a jamais choisi : son badge d'ancienneté. */
export const DEFAULT_BADGE_FX = "tenure";

/** Réglage rangé : un effet inconnu est oublié, jamais transmis. */
export function normalizeCosmetics(value) {
  const input = value && typeof value === "object" ? value : {};
  // Jamais choisi (absent) : ancienneté ; « Aucun » choisi est rangé comme "".
  if (input.badgeFx === undefined) return { badgeFx: DEFAULT_BADGE_FX, nameFx: NAME_FX.includes(input.nameFx) ? input.nameFx : "" };
  const badgeFx = LEGACY_FX[input.badgeFx] || input.badgeFx;
  return {
    badgeFx: BADGE_FX.includes(badgeFx) ? badgeFx : "",
    nameFx: NAME_FX.includes(input.nameFx) ? input.nameFx : "",
  };
}
