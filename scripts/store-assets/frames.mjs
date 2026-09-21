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
/* Le titre porte le bénéfice, pas la liste des marques : les trois tuiles la
   disent déjà, et les couleurs de plateforme restent des marqueurs
   d'identification (DESIGN.md). */
.compat h1 { font-size: 52px; max-width: 760px; }

.stage-compat {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 18px 72px 0;
}

/* Pivot : la marque au-dessus, les plateformes dessous, reliées. */
.hub {
  width: 108px;
  height: 108px;
  border-radius: 30px;
  background: ${COLORS.surface};
  box-shadow:
    inset 0 0 0 1px ${COLORS.line2},
    0 18px 44px -12px rgba(0, 0, 0, 0.7),
    0 10px 60px -20px rgba(145, 70, 255, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
}
.hub img { width: 58px; height: 58px; ${LOGO_CSS} }

/* Pleine largeur de la planche malgre le padding du bloc : le SVG travaille
   ainsi dans les coordonnees du canevas, sans conversion a faire. */
.wires { display: block; width: ${CANVAS.width}px; height: 46px; margin: 0 -72px; }

.platforms {
  display: grid;
  grid-template-columns: repeat(3, 240px);
  justify-content: center;
  column-gap: 20px;
}
.pf { display: flex; flex-direction: column; align-items: center; }
.pf-tile {
  width: 148px;
  height: 148px;
  border-radius: 38px;
  background: rgba(21, 23, 61, 0.72);
  box-shadow: inset 0 0 0 1px ${COLORS.line2}, 0 22px 50px -18px rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
}
.pf-tile img { width: 74px; height: 74px; display: block; }
.pf-name {
  margin-top: 16px;
  font-family: ${DISPLAY};
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
/* Le bloc est centre sous la tuile, mais ses lignes sont calees a gauche :
   sinon les coches se decalent d'une ligne a l'autre et le bord part en dents
   de scie. */
.caps {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 7px;
  width: fit-content;
  max-width: 100%;
}
.cap {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 600;
  color: ${COLORS.text2};
  line-height: 1.25;
  text-align: left;
}
.cap svg { flex: 0 0 auto; width: 13px; height: 13px; }

.emotes {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 72px 40px;
  margin-top: auto;
}
.emotes .row { display: flex; justify-content: center; gap: 20px; }
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
.emotes-note {
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  color: ${COLORS.text3};
  margin-bottom: 14px;
}
`;

/**
 * Cadre « compatibilité » : la marque en pivot, reliée aux trois plateformes
 * qu'elle réunit, et sous chacune ce qu'elle sait réellement y faire. YouTube
 * n'affiche ni points ni Drops parce qu'il n'en a pas : la capture arrête de
 * promettre à un acheteur YouTube ce que seul Twitch lui donnera.
 *
 * Les couleurs de plateforme ne servent qu'aux coches d'identification, jamais
 * au titre (cf. DESIGN.md, « Twitch et Kick ne sont pas la marque »).
 *
 * @param {object} options
 * @param {string} options.logoPath       chemin absolu du logo StreamPulse
 * @param {string} options.headline       titre traduit
 * @param {{name: string, icon: string, color: string, caps: string[]}[]} options.platforms
 * @param {string[]} [options.emoteIcons] chemins des glyphes d'extensions d'émotes
 * @param {string[]} [options.emoteNames] libellés associés (noms propres)
 * @param {string} [options.compatNote]  phrase traduite « totalement compatible avec »
 */
export function buildCompatibilityFrame({
  logoPath,
  headline,
  platforms = [],
  emoteIcons = [],
  emoteNames = [],
  compatNote = "",
}) {
  const chips = emoteIcons
    .map(
      (icon, index) =>
        `<div class="emote-chip"><img src="${escapeHtml(icon)}" alt="">${escapeHtml(emoteNames[index] || "")}</div>`,
    )
    .join("");

  /* Coche dessinee : un glyphe unicode ne tiendrait pas le meme trait que le
     reste de la planche, et le rendu depend de la police installee. */
  const check = (color) =>
    `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 6 9 17l-5-5" stroke="${escapeHtml(color)}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const columns = platforms
    .map(
      (pf) => `
  <div class="pf">
    <div class="pf-tile"><img src="${escapeHtml(pf.icon)}" alt=""></div>
    <div class="pf-name">${escapeHtml(pf.name)}</div>
    <div class="caps">${pf.caps
      .map((cap) => `<div class="cap">${check(pf.color)}<span>${escapeHtml(cap)}</span></div>`)
      .join("")}</div>
  </div>`,
    )
    .join("");

  /* Canevas fige a 1280x800 : la geometrie des liaisons est ecrite en dur, dans
     les coordonnees de la planche. Le pivot est en 640, les trois colonnes en
     380, 640 et 900 (grille de 3x240 avec 20 de gouttiere, centree). */
  const wires = `
<svg class="wires" viewBox="0 0 ${CANVAS.width} 46" fill="none" aria-hidden="true">
  <defs>
    <linearGradient id="wire" x1="0" y1="0" x2="0" y2="46" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${COLORS.violet}" stop-opacity="0.8"/>
      <stop offset="1" stop-color="${COLORS.violet}" stop-opacity="0.38"/>
    </linearGradient>
  </defs>
  <g stroke="url(#wire)" stroke-width="1.5" stroke-linecap="round">
    <path d="M640 0 V10 Q640 22 628 22 H392 Q380 22 380 34 V46"/>
    <path d="M640 22 V46"/>
    <path d="M640 0 V10 Q640 22 652 22 H888 Q900 22 900 34 V46"/>
  </g>
</svg>`;

  return page({
    css: COMPAT_CSS,
    body: `
<div class="head compat">
  <div class="brand">
    <img src="${escapeHtml(logoPath)}" alt="">
    <span class="wordmark">StreamPulse</span>
  </div>
  <h1>${escapeHtml(headline)}</h1>
</div>
<div class="stage-compat">
  <div class="hub"><img src="${escapeHtml(logoPath)}" alt="StreamPulse"></div>
  ${wires}
  <div class="platforms">${columns}</div>
</div>
<div class="emotes">${compatNote ? `<p class="emotes-note">${escapeHtml(compatNote)}</p>` : ""}
  <div class="row">${chips}</div>
</div>`,
  });
}
