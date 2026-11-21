/**
 * Filtre des réglages : plateforme concernée par chaque contrôle + recherche.
 * Module pur (aucun DOM) : la table ci-dessous est la seule source de vérité des
 * pastilles Twitch / Kick / YouTube. Un contrôle absent de la table s'applique à
 * toutes les plateformes (notifications, heures calmes, langue…) et reste visible
 * quel que soit le filtre.
 */

export const PLATFORM_FILTERS = ["all", "twitch", "kick", "youtube", "chzzk"];

const TWITCH = ["twitch"];
const TWITCH_KICK = ["twitch", "kick"];

/** id du contrôle → plateformes où le réglage agit. */
export const PLATFORM_BY_CONTROL = {
  "pref-drop-alerts": TWITCH,
  "pref-badge-alerts": TWITCH,
  "pref-raid-alerts": TWITCH,
  "pref-background-raid-alerts": TWITCH,
  "pref-points-tracking": TWITCH,
  "pref-auto-claim": TWITCH_KICK,
  "pref-auto-claim-drops": TWITCH,
  "pref-drops-tracking-panel": TWITCH,
  "pref-auto-cancel-raids": TWITCH,
  "pref-predictions-popup": TWITCH,
  "pred-locked": TWITCH,
  "pred-editor": TWITCH,
  "pref-auto-open-inventory": TWITCH,
  "pref-auto-open-inventory-interval": TWITCH,
  "pref-fast-forward": TWITCH_KICK,
  "pref-pip-button": TWITCH_KICK,
  "pref-volume-boost": TWITCH_KICK,
  "pref-clip-download": TWITCH,
  "pref-player-quality": TWITCH,
  "pref-keep-quality": TWITCH,
  "pref-latency-placement": TWITCH_KICK,
  "pref-hide-twitch-extensions": TWITCH,
  "pref-auto-refresh": TWITCH,
  "pref-previews-enabled": TWITCH,
  "pref-chat-keywords": TWITCH_KICK,
  "pref-watch-time": TWITCH_KICK,
  "pref-prevent-tab-discard": TWITCH_KICK,
};

/** Minuscules sans accents : « Catégorie » se trouve en tapant « categorie ». */
export function normalizeText(value) {
  return String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Plateformes réunies des contrôles connus parmi `ids`, ou null si aucun n'est étiqueté. */
export function platformsOfIds(ids) {
  const found = new Set();
  for (const id of ids) for (const platform of PLATFORM_BY_CONTROL[id] || []) found.add(platform);
  return found.size ? [...found] : null;
}

/** `row` = { platforms: string[] | null, text: string normalisé }. */
export function matchesFilter(row, { platform = "all", query = "" } = {}) {
  if (platform !== "all" && row.platforms && !row.platforms.includes(platform)) return false;
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  return words.every((word) => row.text.includes(word));
}
