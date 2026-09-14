/**
 * Cadres marketing 1280x800 (dimensions imposées par le Chrome Web Store).
 *
 * Charte de streampulse.fr et du popup (voir brand.mjs) : navy, halo violet,
 * titres en Unbounded, texte en Onest, logo blanc sans fond.
 */

import { CANVAS } from "./config.mjs";
import { COLORS, FONT_CSS, DISPLAY, RESET, backdrop, LOGO_CSS, escapeHtml } from "./brand.mjs";

const BASE_CSS = `
${FONT_CSS}
${RESET}
${backdrop(CANVAS.width, CANVAS.height)}
body { display: flex; flex-direction: column; }

.head { flex: 0 0 auto; padding: 44px 72px 0; }
.brand { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.brand img { width: 30px; height: 30px; ${LOGO_CSS} }
.brand .wordmark { font-family: ${DISPLAY}; font-size: 19px; font-weight: 700; letter-spacing: -0.02em; }
.brand .tagline {
  margin-left: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(198, 212, 160, 0.12);
  box-shadow: inset 0 0 0 1px rgba(198, 212, 160, 0.3);
  color: ${COLORS.lcd};
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
h1 {
  font-family: ${DISPLAY};
  font-size: 42px;
  line-height: 1.08;
  font-weight: 800;
  letter-spacing: -0.035em;
  max-width: 1080px;
}
.sub {
  margin-top: 12px;
  font-size: 18px;
  line-height: 1.45;
  color: ${COLORS.text2};
  max-width: 900px;
}
`;

const PRODUCT_CSS = `
.stage {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 28px 72px 0;
  overflow: hidden;
}
.stage img {
  width: 880px;
  height: auto;
  display: block;
  border-radius: 20px 20px 0 0;
  box-shadow:
    0 0 0 1px ${COLORS.line2},
    0 40px 90px rgba(0, 0, 0, 0.6),
    0 0 120px rgba(145, 70, 255, 0.28);
}
`;

const FEATURES_CSS = `
.grid {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: 1fr;
  gap: 16px;
  padding: 32px 72px 52px;
}
.feat {
  background: rgba(21, 23, 61, 0.72);
  box-shadow: inset 0 0 0 1px ${COLORS.line};
  border-radius: 20px;
  padding: 22px 22px 24px;
  overflow: hidden;
}
.feat .glyph {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: ${COLORS.lcd};
  color: ${COLORS.lcdInk};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}
.feat:nth-child(even) .glyph { background: ${COLORS.violet}; color: #fff; }
.feat .glyph svg { width: 19px; height: 19px; display: block; }
.feat h3 {
  font-family: ${DISPLAY};
  font-size: 15px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.02em;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.feat p {
  font-size: 14px;
  line-height: 1.5;
  color: ${COLORS.text2};
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
`;

function page({ css, body }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${BASE_CSS}${css}</style></head>
<body>${body}</body>
</html>`;
}

function head({ logoPath, tagline, title, subtitle }) {
  return `
<div class="head">
  <div class="brand">
    <img src="${escapeHtml(logoPath)}" alt="">
    <span class="wordmark">StreamPulse</span>
    <span class="tagline">${escapeHtml(tagline)}</span>
  </div>
  <h1>${escapeHtml(title)}</h1>
  <p class="sub">${escapeHtml(subtitle)}</p>
</div>`;
}

/** Cadre « produit » : bandeau de texte puis capture du popup, coupée en bas. */
export function buildProductFrame({ logoPath, tagline, title, subtitle, shotPath }) {
  return page({
    css: PRODUCT_CSS,
    body: `${head({ logoPath, tagline, title, subtitle })}
<div class="stage"><img src="${escapeHtml(shotPath)}" alt=""></div>`,
  });
}

/**
 * Icônes au trait, même facture que celles de l'extension (24px, stroke 2).
 * Ordre calé sur celui des puces de CHROMEWEBSTORE.md.
 */
const stroke = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const GLYPHS = [
  stroke('<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20"/><path d="M12 21 8 9l4-6 4 6-4 12"/>'),
  stroke('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
  stroke('<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>'),
  stroke('<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>'),
  stroke('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
  stroke('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>'),
];

/** Cadre « fonctionnalités » : grille 3x2 alimentée par CHROMEWEBSTORE.md. */
export function buildFeaturesFrame({ logoPath, tagline, title, subtitle, features }) {
  const cards = features
    .slice(0, 6)
    .map(
      (feature, index) => `
  <div class="feat">
    <div class="glyph">${GLYPHS[index]}</div>
    <h3>${escapeHtml(feature.title)}</h3>
    <p>${escapeHtml(feature.body)}</p>
  </div>`,
    )
    .join("");

  return page({
    css: FEATURES_CSS,
    body: `${head({ logoPath, tagline, title, subtitle })}
<div class="grid">${cards}</div>`,
  });
}
