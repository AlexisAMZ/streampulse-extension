/**
 * Petite tuile promotionnelle du Chrome Web Store : 440x280, PNG 24 bits.
 *
 * Surface minuscule : logo, nom, une accroche courte, trois bénéfices, deux
 * pastilles de plateforme. Charte de brand.mjs.
 */

import { COLORS, FONT_CSS, DISPLAY, RESET, backdrop, LOGO_CSS, escapeHtml } from "./brand.mjs";

export const PROMO_TILE = { width: 440, height: 280 };

const CSS = `
${FONT_CSS}
${RESET}
${backdrop(PROMO_TILE.width, PROMO_TILE.height)}
body { padding: 22px 0 20px 24px; }

.copy { position: absolute; inset: 22px auto 20px 24px; width: 232px; display: flex; flex-direction: column; z-index: 2; }
.brand { display: flex; align-items: center; gap: 7px; }
.brand img { width: 18px; height: 18px; ${LOGO_CSS} }
.brand span { font-family: ${DISPLAY}; font-size: 13px; font-weight: 800; letter-spacing: -0.02em; }

h1 { margin-top: 20px; font-family: ${DISPLAY}; font-size: 26px; line-height: 1.02; font-weight: 800; letter-spacing: -0.045em; text-wrap: balance; }
h1 em { display: block; font-style: normal; color: ${COLORS.violetText}; }
.sub { margin-top: 11px; max-width: 192px; font-size: 12px; line-height: 1.35; font-weight: 500; color: ${COLORS.text2}; }

.chips { margin-top: auto; display: flex; gap: 6px; }
.chip { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px; background: ${COLORS.surface}; box-shadow: inset 0 0 0 1px ${COLORS.line2}; font-size: 10.5px; font-weight: 600; color: ${COLORS.text2}; }
.chip::before { content: ""; width: 6px; height: 6px; border-radius: 50%; }
.chip.twitch::before { background: ${COLORS.violet}; }
.chip.kick::before { background: ${COLORS.kick}; }
.chip.youtube::before { background: ${COLORS.youtube}; }

/* Vraies cartes du popup, découpées dans la capture et posées en éventail. */
.stage { position: absolute; top: 0; right: 0; width: 210px; height: 280px; z-index: 1; }
.card { position: absolute; width: 176px; height: 114px; border-radius: 12px; background-repeat: no-repeat; background-size: 671px auto; box-shadow: 0 18px 34px -10px rgba(0, 0, 0, 0.75), 0 0 0 1px ${COLORS.line2}; }
.card.back { top: 132px; right: -38px; background-position: -196px -331px; transform: rotate(7deg); opacity: 0.9; }
.card.front { top: 58px; right: 26px; background-position: -12px -331px; transform: rotate(-5deg); }
.live { position: absolute; top: 44px; right: 132px; z-index: 3; display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px 5px 9px; border-radius: 999px; background: ${COLORS.lcd}; color: ${COLORS.lcdInk}; font-size: 11px; font-weight: 700; transform: rotate(-5deg); box-shadow: 0 8px 18px -6px rgba(0, 0, 0, 0.6); white-space: nowrap; }
.live::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: ${COLORS.lcdInk}; }
.pts { position: absolute; top: 186px; right: 118px; z-index: 3; display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 999px; background: ${COLORS.surface2}; box-shadow: inset 0 0 0 1px ${COLORS.line2}, 0 8px 18px -6px rgba(0, 0, 0, 0.6); color: ${COLORS.text}; font-size: 11px; font-weight: 700; transform: rotate(3deg); white-space: nowrap; }
.pts svg { width: 11px; height: 11px; color: ${COLORS.violetText}; }
`;

const GEM = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 2h8l3 4-7 8-7-8z"/></svg>';

/**
 * Aucune mention de gratuité, de nouveauté ni de classement : le règlement du
 * Chrome Web Store les interdit sur les assets (cf. store-assets/policy.mjs).
 *
 * @param {object} options
 * @param {string} options.logoPath  chemin absolu du logo
 * @param {string} options.title     accroche, première ligne
 * @param {string} options.accent    accroche, seconde ligne en violet
 * @param {string} options.subtitle  phrase courte sous l'accroche
 * @param {string} options.liveLabel pastille « En direct »
 * @param {string} options.pointsLabel pastille des points récupérés
 * @param {string} options.shotPath  capture réelle du popup (source-dashboard.png)
 */
export function buildPromoTile({ logoPath, title, accent, subtitle, liveLabel, pointsLabel, shotPath }) {
  const shot = `background-image: url('${escapeHtml(shotPath)}')`;
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${CSS}</style></head>
<body>
  <div class="copy">
    <div class="brand"><img src="${escapeHtml(logoPath)}" alt=""><span>StreamPulse</span></div>
    <h1>${escapeHtml(title)}<em>${escapeHtml(accent)}</em></h1>
    <p class="sub">${escapeHtml(subtitle)}</p>
    <div class="chips"><span class="chip twitch">Twitch</span><span class="chip kick">Kick</span><span class="chip youtube">YouTube</span></div>
  </div>
  <div class="stage">
    <div class="card back" style="${shot}"></div>
    <div class="card front" style="${shot}"></div>
    <span class="live">${escapeHtml(liveLabel)}</span>
    <span class="pts">${GEM}${escapeHtml(pointsLabel)}</span>
  </div>
</body>
</html>`;
}

/** Grande image promotionnelle (« marquee ») en haut de la fiche : 1400x560. */
export const PROMO_MARQUEE = { width: 1400, height: 560 };

const MARQUEE_CSS = `
${FONT_CSS}
${RESET}
${backdrop(PROMO_MARQUEE.width, PROMO_MARQUEE.height)}
body { display: grid; grid-template-columns: 560px 1fr; align-items: center; padding-left: 72px; }
.brand { display: flex; align-items: center; gap: 12px; }
.brand img { width: 34px; height: 34px; ${LOGO_CSS} }
.brand span { font-family: ${DISPLAY}; font-size: 24px; font-weight: 800; letter-spacing: -0.03em; }
h1 { margin-top: 26px; font-family: ${DISPLAY}; font-size: 50px; line-height: 1.04; font-weight: 800; letter-spacing: -0.04em; }
h1 em { font-style: normal; color: ${COLORS.violetText}; }
.benefits { display: flex; flex-direction: column; gap: 11px; margin-top: 28px; }
.benefit { display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 600; color: ${COLORS.text}; }
.benefit::before {
  content: "✓"; flex: none; display: grid; place-items: center;
  width: 20px; height: 20px; border-radius: 50%;
  background: ${COLORS.lcd}; color: ${COLORS.lcdInk}; font-size: 12px; font-weight: 700;
}
.chips { display: flex; gap: 8px; margin-top: 30px; }
.chip {
  display: inline-flex; align-items: center; gap: 7px; padding: 6px 14px; border-radius: 999px;
  background: ${COLORS.surface}; box-shadow: inset 0 0 0 1px ${COLORS.line2};
  font-size: 14px; font-weight: 600; color: ${COLORS.text2};
}
.chip::before { content: ""; width: 7px; height: 7px; border-radius: 50%; }
.chip.twitch::before { background: ${COLORS.violet}; }
.chip.kick::before { background: ${COLORS.kick}; }
.chip.youtube::before { background: ${COLORS.youtube}; }
.stage { height: 560px; display: flex; align-items: center; justify-content: center; padding: 44px 64px 44px 20px; }
.stage img {
  max-width: 100%; max-height: 472px; display: block; border-radius: 18px;
  box-shadow: 0 0 0 1px ${COLORS.line2}, 0 40px 90px rgba(0,0,0,0.6), 0 0 120px rgba(145,70,255,0.3);
}
`;

/**
 * @param {object} options
 * @param {string} options.logoPath
 * @param {string} options.title      accroche (la dernière phrase passe en violet)
 * @param {string} options.accent     seconde ligne en violet
 * @param {string[]} options.benefits 3 bénéfices issus des puces du listing
 * @param {string} options.shotPath   capture réelle du popup
 */
export function buildPromoMarquee({ logoPath, title, accent, benefits, shotPath }) {
  const lines = benefits
    .slice(0, 3)
    .map((text) => `<div class="benefit">${escapeHtml(text)}</div>`)
    .join("");
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${MARQUEE_CSS}</style></head>
<body>
  <div>
    <div class="brand"><img src="${escapeHtml(logoPath)}" alt=""><span>StreamPulse</span></div>
    <h1>${escapeHtml(title)}<br><em>${escapeHtml(accent)}</em></h1>
    <div class="benefits">${lines}</div>
    <div class="chips"><span class="chip twitch">Twitch</span><span class="chip kick">Kick</span><span class="chip youtube">YouTube</span></div>
  </div>
  <div class="stage"><img src="${escapeHtml(shotPath)}" alt=""></div>
</body>
</html>`;
}
