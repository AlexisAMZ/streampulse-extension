/**
 * Cadres marketing 1280x800 (dimensions imposées par le Chrome Web Store).
 *
 * La charte reprend celle du popup : fond #08080d, grille ambiante, halo violet
 * Twitch et halo vert Kick, typographie système identique.
 */

import { CANVAS } from "./config.mjs";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BASE_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: ${CANVAS.width}px;
  height: ${CANVAS.height}px;
  overflow: hidden;
}
body {
  background:
    radial-gradient(880px 520px at 10% -12%, rgba(145, 70, 255, 0.32), transparent 64%),
    radial-gradient(760px 460px at 94% 4%, rgba(83, 252, 24, 0.13), transparent 60%),
    radial-gradient(900px 620px at 50% 118%, rgba(145, 70, 255, 0.12), transparent 70%),
    #08080d;
  color: #f0f0f4;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  display: flex;
  flex-direction: column;
  position: relative;
}
body::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.022) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.022) 1px, transparent 1px);
  background-size: 40px 40px;
  -webkit-mask-image: radial-gradient(ellipse 85% 70% at 50% 20%, black, transparent 82%);
}
body > * { position: relative; z-index: 1; }

.head { flex: 0 0 auto; padding: 42px 76px 0; }
.brand { display: flex; align-items: center; gap: 11px; margin-bottom: 16px; }
.brand img { width: 30px; height: 30px; display: block; }
.brand .wordmark { font-size: 19px; font-weight: 700; letter-spacing: -0.015em; }
.brand .divider { width: 1px; height: 15px; background: rgba(255, 255, 255, 0.16); }
.brand .tagline {
  font-family: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace;
  font-size: 11px;
  letter-spacing: 0.16em;
  color: #a97dff;
  text-transform: uppercase;
}
h1 {
  font-size: 40px;
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: -0.028em;
  max-width: 1000px;
}
.sub {
  margin-top: 11px;
  font-size: 17px;
  line-height: 1.48;
  color: #9a9aab;
  max-width: 880px;
}
`;

const PRODUCT_CSS = `
.stage {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 26px 76px 36px;
}
.stage img {
  height: 100%;
  width: auto;
  display: block;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  box-shadow:
    0 34px 80px rgba(0, 0, 0, 0.66),
    0 0 100px rgba(145, 70, 255, 0.16);
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
  padding: 30px 76px 48px;
}
.feat {
  background: rgba(255, 255, 255, 0.032);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 14px;
  padding: 20px 20px 22px;
  overflow: hidden;
}
.feat .glyph {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: rgba(145, 70, 255, 0.15);
  border: 1px solid rgba(145, 70, 255, 0.34);
  color: #c2a0ff;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}
.feat .glyph svg { width: 17px; height: 17px; display: block; }
.feat h3 {
  font-size: 15.5px;
  font-weight: 700;
  line-height: 1.28;
  letter-spacing: -0.012em;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.feat p {
  font-size: 13px;
  line-height: 1.55;
  color: #8d8d9e;
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
    <span class="divider"></span>
    <span class="tagline">${escapeHtml(tagline)}</span>
  </div>
  <h1>${escapeHtml(title)}</h1>
  <p class="sub">${escapeHtml(subtitle)}</p>
</div>`;
}

/** Cadre « produit » : bandeau de texte puis capture du popup. */
export function buildProductFrame({ logoPath, tagline, title, subtitle, shotPath }) {
  return page({
    css: PRODUCT_CSS,
    body: `${head({ logoPath, tagline, title, subtitle })}
<div class="stage"><img src="${escapeHtml(shotPath)}" alt=""></div>`,
  });
}

/**
 * Icônes au trait, même facture que celles de l'extension (24px, stroke 2).
 * Ordre calé sur celui des puces de CHROMEWEBSTORE.md : points de chaîne,
 * alertes live, intégration Twitch, aperçus au survol, lecteur, filtre chat.
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
