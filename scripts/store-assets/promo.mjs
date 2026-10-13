/**
 * Tuiles promotionnelles du Chrome Web Store : petite (440x280) et grande
 * (1400x560), PNG 24 bits sans alpha. Une seule langue (l'anglais) : le store
 * ne stocke qu'un jeu pour toute la fiche.
 *
 * Pensées pour la vitrine, pas pour la page de détail : dans une grille de
 * résultats la petite tuile s'affiche à ~175 px de large (échelle 0,4). Le texte
 * doit rester lisible à cette taille : un seul message de quatre mots, imprimé
 * en très gros, sur un aplat violet qui se détache du gris sombre des cartes
 * voisines, et les trois plateformes en logos plutôt qu'en phrases.
 *
 * Aucune mention de gratuité, de nouveauté ni de classement : le règlement du
 * Chrome Web Store les interdit sur les assets (cf. policy.mjs).
 */

import { COLORS, FONT_CSS, DISPLAY, RESET, LOGO_CSS, escapeHtml } from "./brand.mjs";

export const PROMO_TILE = { width: 440, height: 280 };
export const PROMO_MARQUEE = { width: 1400, height: 560 };

/** Aplat violet de la marque, un peu plus profond vers le coin bas-droit. */
const violetBackdrop = (width, height) => `
html, body { width: ${width}px; height: ${height}px; }
body {
  overflow: hidden;
  position: relative;
  color: #fff;
  font-family: "Onest", -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  background:
    radial-gradient(${Math.round(width * 0.7)}px ${Math.round(height * 1.1)}px at 12% 0%, rgba(200, 170, 255, 0.35), transparent 62%),
    radial-gradient(${Math.round(width * 0.8)}px ${Math.round(height * 1.2)}px at 100% 110%, rgba(30, 14, 90, 0.7), transparent 60%),
    ${COLORS.violet};
}
body > * { position: relative; z-index: 1; }
`;

/** Pastille « live » : le mot du titre sur un aplat vert LCD, comme le badge du popup. */
const HIGHLIGHT_CSS = `
mark {
  display: inline-block;
  padding: 0 0.16em 0.04em;
  margin: 0 0.02em;
  border-radius: 0.2em;
  background: ${COLORS.lcd};
  color: ${COLORS.lcdInk};
}
`;

/** Une plateforme : pastille navy, logo dans sa couleur de marque. */
const platformTile = (iconPath, size) =>
  `<span class="plat" style="width:${size}px;height:${size}px"><img src="${escapeHtml(iconPath)}" alt=""></span>`;

const PLATFORM_CSS = `
.plats { display: flex; gap: 10px; }
.plat { display: grid; place-items: center; border-radius: 28%; background: ${COLORS.bg}; box-shadow: 0 8px 18px -6px rgba(10, 4, 40, 0.55); }
.plat img { width: 58%; height: 58%; display: block; }
`;


const stroke = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const STICKER_ICONS = {
  bell: stroke('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
  gem: stroke('<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20"/>'),
  gift: stroke('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>'),
  shield: stroke('<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>'),
  eye: stroke('<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>'),
};

/** Vignettes d'arrière-plan : [icône, libellé, gauche, haut, rotation]. */
const STICKERS = [
  ["bell", "stickers.live", 250, 16, 4],
  ["gem", "stickers.points", 246, 128, -5],
  ["gift", "stickers.drops", 336, 166, 6],
  ["shield", "stickers.badges", 214, 208, -3],
  ["eye", "stickers.previews", 322, 234, 3],
];

/** Même jeu de vignettes sur la grande image, posées sur les bords du popup. */
const MARQUEE_STICKERS = [
  ["bell", "live", 790, 16, -3],
  ["gem", "points", 1100, 20, 3],
  ["gift", "drops", 790, 490, 2],
  ["shield", "badges", 958, 494, -2],
  ["eye", "previews", 1172, 488, 3],
];

const TILE_CSS = `
${FONT_CSS}
${RESET}
${violetBackdrop(PROMO_TILE.width, PROMO_TILE.height)}
${HIGHLIGHT_CSS}
${PLATFORM_CSS}
body { padding: 22px 24px 24px; display: flex; flex-direction: column; }
.brand { display: flex; align-items: center; gap: 9px; }
.brand img { width: 26px; height: 26px; ${LOGO_CSS} }
.brand span { font-family: ${DISPLAY}; font-size: 20px; font-weight: 800; letter-spacing: -0.03em; }
h1 { margin-top: 22px; font-family: ${DISPLAY}; font-size: 47px; line-height: 1.06; font-weight: 800; letter-spacing: -0.045em; }
h1 span { display: block; white-space: nowrap; }
.plats { margin-top: auto; }

/* Les autres fonctions, en vignettes semi-transparentes derrière le titre : la
   tuile ne doit pas se lire comme une simple alerte de live. Des icônes d'abord,
   le mot ensuite : à l'échelle d'une carte, c'est l'icône qui parle. */
.sticker { position: absolute; z-index: 1; display: inline-flex; align-items: center; gap: 7px; padding: 7px 13px 7px 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.2); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4), 0 10px 22px -10px rgba(20, 8, 70, 0.6); color: #fff; font-size: 15px; font-weight: 700; white-space: nowrap; }
.sticker svg { width: 18px; height: 18px; flex: none; }
.mark { position: absolute; right: -34px; bottom: -40px; width: 190px; opacity: 0.16; ${LOGO_CSS} z-index: 0; }
`;

/**
 * @param {object} options
 * @param {string} options.logoPath    logo blanc de la marque
 * @param {string[]} options.platformIcons  chemins des logos Twitch, Kick, YouTube
 * @param {string} options.lineOne     « Never miss »
 * @param {string} options.lineLead    début de la 2e ligne (« a »)
 * @param {string} options.highlight   mot sur pastille verte (« live »)
 * @param {{live:string,points:string,drops:string,badges:string,previews:string}} options.stickers
 */
export function buildPromoTile({ logoPath, platformIcons, lineOne, lineLead, highlight, stickers }) {
  const bubbles = STICKERS.map(
    ([icon, key, left, top, rotate]) =>
      `<span class="sticker" style="left:${left}px;top:${top}px;transform:rotate(${rotate}deg)">${STICKER_ICONS[icon]}${escapeHtml(stickers[key.split('.')[1]])}</span>`,
  ).join("");
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${TILE_CSS}</style></head>
<body>
  <img class="mark" src="${escapeHtml(logoPath)}" alt="">
  ${bubbles}
  <div class="brand"><img src="${escapeHtml(logoPath)}" alt=""><span>StreamPulse</span></div>
  <h1><span>${escapeHtml(lineOne)}</span><span>${escapeHtml(lineLead)} <mark>${escapeHtml(highlight)}</mark>.</span></h1>
  <div class="plats">${platformIcons.map((icon) => platformTile(icon, 52)).join("")}</div>
</body>
</html>`;
}

const MARQUEE_CSS = `
${FONT_CSS}
${RESET}
${violetBackdrop(PROMO_MARQUEE.width, PROMO_MARQUEE.height)}
${HIGHLIGHT_CSS}
${PLATFORM_CSS}
body { display: grid; grid-template-columns: 700px 1fr; align-items: center; padding-left: 80px; }
.brand { display: flex; align-items: center; gap: 14px; }
.brand img { width: 40px; height: 40px; ${LOGO_CSS} }
.brand span { font-family: ${DISPLAY}; font-size: 28px; font-weight: 800; letter-spacing: -0.03em; }
h1 { margin-top: 30px; font-family: ${DISPLAY}; font-size: 82px; line-height: 1.05; font-weight: 800; letter-spacing: -0.045em; }
h1 span { display: block; white-space: nowrap; }
.sub { margin-top: 26px; max-width: 560px; font-size: 26px; line-height: 1.35; font-weight: 500; color: rgba(255, 255, 255, 0.92); }
.plats { margin-top: 34px; gap: 14px; }
.stage { height: 560px; display: flex; align-items: center; justify-content: center; padding: 84px 60px 84px 0; }
.sticker { position: absolute; z-index: 2; display: inline-flex; align-items: center; gap: 12px; padding: 12px 22px 12px 16px; border-radius: 999px; background: rgba(255, 255, 255, 0.22); box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.45), 0 18px 36px -14px rgba(20, 8, 70, 0.6); color: #fff; font-size: 26px; font-weight: 700; white-space: nowrap; }
.sticker svg { width: 30px; height: 30px; flex: none; }
.stage img { max-width: 100%; max-height: 390px; display: block; border-radius: 18px; box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.22), 0 40px 90px rgba(10, 4, 40, 0.6); }
`;

/**
 * @param {object} options
 * @param {string} options.logoPath
 * @param {string[]} options.platformIcons
 * @param {string} options.lineOne
 * @param {string} options.lineLead
 * @param {string} options.highlight
 * @param {string} options.subtitle  une phrase : ce que fait l'extension
 * @param {string} options.shotPath  capture réelle du popup
 * @param {{live:string,points:string,drops:string,badges:string,previews:string}} options.stickers
 */
export function buildPromoMarquee({ logoPath, platformIcons, lineOne, lineLead, highlight, subtitle, shotPath, stickers }) {
  const bubbles = MARQUEE_STICKERS.map(
    ([icon, key, left, top, rotate]) =>
      `<span class="sticker" style="left:${left}px;top:${top}px;transform:rotate(${rotate}deg)">${STICKER_ICONS[icon]}${escapeHtml(stickers[key])}</span>`,
  ).join("");
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${MARQUEE_CSS}</style></head>
<body>
  <div>
    <div class="brand"><img src="${escapeHtml(logoPath)}" alt=""><span>StreamPulse</span></div>
    <h1><span>${escapeHtml(lineOne)}</span><span>${escapeHtml(lineLead)} <mark>${escapeHtml(highlight)}</mark>.</span></h1>
    <p class="sub">${escapeHtml(subtitle)}</p>
    <div class="plats">${platformIcons.map((icon) => platformTile(icon, 64)).join("")}</div>
  </div>
  <div class="stage"><img src="${escapeHtml(shotPath)}" alt=""></div>
  ${bubbles}
</body>
</html>`;
}
