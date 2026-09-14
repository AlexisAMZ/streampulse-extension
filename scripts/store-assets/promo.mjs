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
body { display: flex; flex-direction: column; padding: 24px 26px 22px; }

.brand { display: flex; align-items: center; gap: 10px; }
.brand img { width: 28px; height: 28px; ${LOGO_CSS} }
.brand span { font-family: ${DISPLAY}; font-size: 22px; font-weight: 800; letter-spacing: -0.03em; }

.tagline {
  margin-top: 8px;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: ${COLORS.lcd};
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
}

.benefits { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: 8px; }
.benefit { display: flex; align-items: flex-start; gap: 9px; font-size: 13px; line-height: 1.3; font-weight: 600; color: ${COLORS.text}; }
.benefit::before {
  content: "✓";
  flex: 0 0 auto;
  display: grid; place-items: center;
  width: 16px; height: 16px; margin-top: 0;
  border-radius: 50%;
  background: ${COLORS.lcd};
  color: ${COLORS.lcdInk};
  font-size: 10px; font-weight: 700;
}
.benefit span { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.chips { display: flex; gap: 7px; }
.chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 11px; border-radius: 999px;
  background: ${COLORS.surface};
  box-shadow: inset 0 0 0 1px ${COLORS.line2};
  font-size: 11px; font-weight: 600; color: ${COLORS.text2};
}
.chip::before { content: ""; width: 6px; height: 6px; border-radius: 50%; }
.chip.twitch::before { background: ${COLORS.violet}; }
.chip.kick::before { background: ${COLORS.kick}; }
`;

/**
 * Aucune mention de gratuité, de nouveauté ni de classement : le règlement du
 * Chrome Web Store les interdit sur les assets (cf. store-assets/policy.mjs).
 *
 * @param {object} options
 * @param {string} options.logoPath   chemin absolu du logo
 * @param {string} options.tagline    accroche courte sous le nom
 * @param {string[]} options.benefits 3 bénéfices, issus des puces du listing
 */
export function buildPromoTile({ logoPath, tagline, benefits }) {
  const lines = benefits
    .slice(0, 3)
    .map((text) => `<div class="benefit"><span>${escapeHtml(text)}</span></div>`)
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${CSS}</style></head>
<body>
  <div>
    <div class="brand">
      <img src="${escapeHtml(logoPath)}" alt="">
      <span>StreamPulse</span>
    </div>
    <div class="tagline">${escapeHtml(tagline)}</div>
  </div>
  <div class="benefits">${lines}</div>
  <div class="chips">
    <span class="chip twitch">Twitch</span>
    <span class="chip kick">Kick</span>
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
    <div class="chips"><span class="chip twitch">Twitch</span><span class="chip kick">Kick</span></div>
  </div>
  <div class="stage"><img src="${escapeHtml(shotPath)}" alt=""></div>
</body>
</html>`;
}
