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
