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
  align-items: center;
  padding: 26px 72px 40px;
}
.stage img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  display: block;
  border-radius: 18px;
  box-shadow:
    0 0 0 1px ${COLORS.line2},
    0 34px 80px rgba(0, 0, 0, 0.6),
    0 0 110px rgba(145, 70, 255, 0.26);
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

/** Cadre « produit » : bandeau de texte puis capture entière du popup. */
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

const COMPAT_CSS = `
.compat h1 { font-size: 58px; letter-spacing: -0.04em; }
.compat h1 .platform-twitch { color: ${COLORS.violet}; }
.compat h1 .platform-kick { color: ${COLORS.kick}; }
.compat h1 .platform-youtube { color: ${COLORS.youtube}; }
.compat .sub { margin-top: 14px; max-width: 980px; }

.stage-compat {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 64px;
  padding: 0 72px 0;
}
.platform-tile {
  width: 224px;
  height: 224px;
  border-radius: 52px;
  background: rgba(21, 23, 61, 0.72);
  box-shadow: inset 0 0 0 1px ${COLORS.line2}, 0 30px 70px rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
}
.platform-tile img { width: 114px; height: 114px; display: block; }
.platform-tile.twitch img { filter: drop-shadow(0 0 34px rgba(145, 70, 255, 0.55)); }
.platform-tile.kick img { filter: drop-shadow(0 0 34px rgba(83, 252, 24, 0.4)); }
.platform-tile.youtube img { filter: drop-shadow(0 0 34px rgba(255, 0, 0, 0.4)); }
.stage-compat .pulse {
  width: 252px;
  height: 252px;
  border-radius: 60px;
  background: ${COLORS.surface};
  box-shadow:
    inset 0 0 0 1px ${COLORS.line2},
    0 0 0 14px rgba(145, 70, 255, 0.1),
    0 36px 90px rgba(0, 0, 0, 0.6),
    0 0 130px rgba(145, 70, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}
.stage-compat .pulse img { width: 140px; height: 140px; ${LOGO_CSS} }

.emotes {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  padding: 0 72px 40px;
}
.emotes .row {
  display: flex;
  justify-content: center;
  gap: 20px;
}
.emotes { padding-top: 22px; }
.emote-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 22px;
  border-radius: 999px;
  background: rgba(21, 23, 61, 0.6);
  box-shadow: inset 0 0 0 1px ${COLORS.line};
  font-size: 14px;
  font-weight: 600;
  color: ${COLORS.text2};
}
.emote-chip img { width: 26px; height: 26px; display: block; }
.features {
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 0 72px;
  margin-top: 22px;
}
.feature-pill {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 10px 18px;
  border-radius: 999px;
  background: rgba(21, 23, 61, 0.72);
  box-shadow: inset 0 0 0 1px ${COLORS.line};
  font-size: 14.5px;
  font-weight: 600;
  color: ${COLORS.text};
}
.feature-pill::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: ${COLORS.violet}; }
.feature-pill:nth-child(even)::before { background: ${COLORS.lcd}; }

.tile-wrap { position: relative; }
.float-badge {
  position: absolute;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  box-shadow: 0 12px 26px -8px rgba(0, 0, 0, 0.65);
}
.float-badge.live {
  top: -16px;
  left: -34px;
  transform: rotate(-7deg);
  background: ${COLORS.lcd};
  color: ${COLORS.lcdInk};
}
.float-badge.live::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: ${COLORS.lcdInk}; }
.float-badge.points {
  bottom: -16px;
  right: -34px;
  transform: rotate(6deg);
  background: ${COLORS.surface2};
  box-shadow: inset 0 0 0 1px ${COLORS.line2}, 0 12px 26px -8px rgba(0, 0, 0, 0.65);
  color: ${COLORS.text};
  font-family: ${DISPLAY};
}
.float-badge.points svg { width: 14px; height: 14px; color: ${COLORS.violetText}; }

.emotes-note {
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  color: ${COLORS.text3};
  margin-bottom: 14px;
}
`;

/**
 * Cadre « compatibilité » : Twitch et Kick réunis par la marque, les
 * extensions d'émotes avec lesquelles StreamPulse cohabite (BetterTTV,
 * FrankerFaceZ, 7TV). Les noms de plateforme restent en clair dans toutes les
 * langues : le titre n'a pas besoin de traduction, et les couleurs des
 * plateformes servent uniquement à les identifier (cf. DESIGN.md).
 *
 * @param {object} options
 * @param {string} options.logoPath       chemin absolu du logo StreamPulse
 * @param {string} options.tagline        pill de la ligne de marque
 * @param {string} options.subtitle       phrase traduite sous le titre
 * @param {string} options.twitchIconPath chemin absolu du glyphe Twitch
 * @param {string} options.kickIconPath   chemin absolu du glyphe Kick
 * @param {string} options.youtubeIconPath chemin absolu du glyphe YouTube
 * @param {string[]} [options.emoteIcons] chemins des glyphes d'extensions d'émotes
 * @param {string[]} [options.emoteNames] libellés associés (noms propres)
 * @param {string} [options.compatNote]  phrase traduite « totalement compatible avec »
 * @param {string[]} [options.featurePills] pastilles de fonctions traduites
 * @param {string} [options.liveLabel]   pastille « En direct » (traduite)
 */
export function buildCompatibilityFrame({
  logoPath,
  tagline,
  subtitle,
  twitchIconPath,
  kickIconPath,
  youtubeIconPath,
  emoteIcons = [],
  emoteNames = [],
  compatNote = "",
  featurePills = [],
  liveLabel = "",
}) {
  const chips = emoteIcons
    .map(
      (icon, index) =>
        `<div class="emote-chip"><img src="${escapeHtml(icon)}" alt="">${escapeHtml(emoteNames[index] || "")}</div>`,
    )
    .join("");
  return page({
    css: COMPAT_CSS,
    body: `
<div class="head compat">
  <div class="brand">
    <img src="${escapeHtml(logoPath)}" alt="">
    <span class="wordmark">StreamPulse</span>
    <span class="tagline">${escapeHtml(tagline)}</span>
  </div>
  <h1><span class="platform-twitch">Twitch</span> <span>&amp;</span> <span class="platform-kick">Kick</span> <span>&amp;</span> <span class="platform-youtube">YouTube</span></h1>
  <p class="sub">${escapeHtml(subtitle)}</p>
</div>
<div class="stage-compat">
  <div class="tile-wrap">
    <div class="platform-tile twitch"><img src="${escapeHtml(twitchIconPath)}" alt=""></div>
    ${liveLabel ? `<div class="float-badge live">${escapeHtml(liveLabel)}</div>` : ""}
  </div>
  <div class="pulse"><img src="${escapeHtml(logoPath)}" alt="StreamPulse"></div>
  <div class="tile-wrap">
    <div class="platform-tile kick"><img src="${escapeHtml(kickIconPath)}" alt=""></div>
    <div class="platform-tile youtube"><img src="${escapeHtml(youtubeIconPath)}" alt=""></div>
    <div class="float-badge points"><svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 2h8l3 4-7 8-7-8z"/></svg>+250</div>
  </div>
</div>
${featurePills.length ? `<div class="features">${featurePills.map((pill) => `<div class="feature-pill">${escapeHtml(pill)}</div>`).join("")}</div>` : ""}
<div class="emotes">${compatNote ? `<p class="emotes-note">${escapeHtml(compatNote)}</p>` : ""}
  <div class="row">${chips}</div>
</div>`,
  });
}
