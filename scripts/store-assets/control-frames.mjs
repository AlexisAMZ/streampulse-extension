/**
 * Trois compositions de la 5e capture du store, thème « Tu gardes la main » :
 * Badges, réglages de notification et vie privée.
 *
 *   V1  une capture Badges pleine scène, trois engagements en pastilles
 *   V2  trois colonnes : Badges, Notifications, vie privée (sans capture)
 *   V3  Badges en grand, carte flottante des interrupteurs, bandeau d'engagement
 *
 * Mêmes polices, mêmes couleurs et même en-tête que les quatre autres cadres
 * (frames.mjs). Les textes viennent de `control-copy.mjs` : aucun n'est produit
 * à la volée, et aucun ne promet plus que la déclaration de confidentialité.
 */

import { COLORS, DISPLAY, escapeHtml } from "./brand.mjs";
import { page, head } from "./frames.mjs";

/** Pictogrammes au trait, 24px, trait 2 : même facture que le popup. */
const stroke = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const ICONS = {
  sliders: stroke(
    '<line x1="4" y1="7" x2="20" y2="7"/><circle cx="9" cy="7" r="2.4" fill="#0b0c22"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="15" cy="17" r="2.4" fill="#0b0c22"/>',
  ),
  lock: stroke('<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.1" fill="currentColor"/>'),
  device: stroke('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
  badge: stroke('<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>'),
};

const CHIP_ICONS = [ICONS.sliders, ICONS.lock, ICONS.device];

/** Fragment du popup : zone (x, y, largeur) de la capture 780x600, mise à l'échelle. */
function crop({ src, x, y, width, height, scale }) {
  return `<div class="crop" style="width:${width * scale}px;height:${height * scale}px">
  <img src="${escapeHtml(src)}" alt="" style="width:${780 * scale}px;left:${-x * scale}px;top:${-y * scale}px">
</div>`;
}

const SHARED_CSS = `
.crop { position: relative; overflow: hidden; border-radius: 16px;
  box-shadow: 0 0 0 1px ${COLORS.line2}, 0 26px 60px rgba(0, 0, 0, 0.55); background: ${COLORS.bg}; }
.crop img { position: absolute; display: block; max-width: none; height: auto; }
`;

/** V1 : la capture Badges en grand, les trois engagements juste au-dessus. */
export function buildControlV1({ logoPath, tagline, title, subtitle, chips, badgesShot }) {
  const css = `${SHARED_CSS}
.chips { display: flex; gap: 12px; padding: 22px 72px 0; flex: 0 0 auto; }
.chip { display: inline-flex; align-items: center; gap: 10px; padding: 9px 18px 9px 13px; border-radius: 999px;
  background: rgba(255, 255, 255, 0.05); box-shadow: inset 0 0 0 1px ${COLORS.line2};
  font-size: 14.5px; font-weight: 600; color: ${COLORS.text}; }
.chip svg { width: 19px; height: 19px; color: ${COLORS.lcd}; flex: none; }
.stage1 { flex: 1 1 auto; min-height: 0; display: flex; justify-content: center; align-items: center; padding: 24px 72px 38px; }
.stage1 img { max-width: 100%; max-height: 100%; display: block; border-radius: 18px;
  box-shadow: 0 0 0 1px ${COLORS.line2}, 0 34px 80px rgba(0, 0, 0, 0.6), 0 0 110px rgba(145, 70, 255, 0.26); }
`;
  const items = chips
    .map((text, index) => `<span class="chip">${CHIP_ICONS[index]}${escapeHtml(text)}</span>`)
    .join("");
  return page({
    css,
    body: `${head({ logoPath, tagline, title, subtitle })}
<div class="chips">${items}</div>
<div class="stage1"><img src="${escapeHtml(badgesShot)}" alt=""></div>`,
  });
}

/** V2 : trois colonnes égales, deux fragments du popup et un bloc vie privée. */
export function buildControlV2({ logoPath, tagline, title, subtitle, columns, badgesShot, settingsShot }) {
  const css = `${SHARED_CSS}
.cols { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: repeat(3, 1fr); column-gap: 30px; align-content: center; padding: 20px 72px 36px; }
.col { display: flex; flex-direction: column; min-width: 0; }
.col .slot { height: 340px; display: flex; align-items: flex-start; }
.col h3 { margin-top: 24px; font-family: ${DISPLAY}; font-size: 19px; font-weight: 700; line-height: 1.25; letter-spacing: -0.02em; }
.col p { margin-top: 10px; font-size: 15.5px; line-height: 1.5; color: ${COLORS.text2}; }
.privacy { width: 100%; height: 340px; display: flex; flex-direction: column; justify-content: flex-start; gap: 56px; }
.privacy .glyph { width: 88px; height: 88px; border-radius: 26px; display: flex; align-items: center; justify-content: center;
  background: rgba(145, 70, 255, 0.14); box-shadow: inset 0 0 0 1px rgba(145, 70, 255, 0.34); color: ${COLORS.violetText}; }
.privacy .glyph svg { width: 44px; height: 44px; }
.privacy ul { list-style: none; display: grid; gap: 14px; }
.privacy li { display: flex; align-items: center; gap: 12px; font-size: 15px; font-weight: 600; color: ${COLORS.text}; }
.privacy li svg { width: 20px; height: 20px; color: ${COLORS.lcd}; flex: none; }
`;
  const region = { x: 196, y: 46, width: 584, height: 552, scale: 0.616 };
  const [first, second, third] = columns;
  const rows = third.points
    .map((point) => `<li>${ICONS.badge}<span>${escapeHtml(point)}</span></li>`)
    .join("");
  return page({
    css,
    body: `${head({ logoPath, tagline, title, subtitle })}
<div class="cols">
  <div class="col"><div class="slot">${crop({ src: badgesShot, ...region })}</div><h3>${escapeHtml(first.title)}</h3><p>${escapeHtml(first.body)}</p></div>
  <div class="col"><div class="slot">${crop({ src: settingsShot, ...region })}</div><h3>${escapeHtml(second.title)}</h3><p>${escapeHtml(second.body)}</p></div>
  <div class="col"><div class="slot"><div class="privacy"><div class="glyph">${ICONS.lock}</div><ul>${rows}</ul></div></div><h3>${escapeHtml(third.title)}</h3><p>${escapeHtml(third.body)}</p></div>
</div>`,
  });
}

/** V3 : Badges en grand, carte des interrupteurs au premier plan, bandeau d'engagement. */
export function buildControlV3({ logoPath, tagline, title, subtitle, banner, badgesShot, settingsShot }) {
  const css = `${SHARED_CSS}
.stage3 { position: relative; flex: 1 1 auto; min-height: 0; }
.main { position: absolute; left: 72px; top: 22px; height: 468px; border-radius: 18px; display: block;
  box-shadow: 0 0 0 1px ${COLORS.line2}, 0 34px 80px rgba(0, 0, 0, 0.6), 0 0 110px rgba(145, 70, 255, 0.26); }
.float { position: absolute; right: 90px; top: 150px;
  filter: drop-shadow(0 30px 40px rgba(0, 0, 0, 0.5)); }
.float .crop { box-shadow: 0 0 0 1px rgba(145, 70, 255, 0.55), 0 0 60px rgba(145, 70, 255, 0.28); }
.band { position: absolute; left: 0; right: 0; bottom: 0; height: 66px; display: flex; align-items: center; justify-content: center; gap: 14px;
  background: rgba(198, 212, 160, 0.09); box-shadow: inset 0 1px 0 rgba(198, 212, 160, 0.22);
  font-size: 17px; font-weight: 600; color: ${COLORS.text}; }
.band svg { width: 22px; height: 22px; color: ${COLORS.lcd}; }
`;
  return page({
    css,
    body: `${head({ logoPath, tagline, title, subtitle })}
<div class="stage3">
  <img class="main" src="${escapeHtml(badgesShot)}" alt="">
  <div class="float">${crop({ src: settingsShot, x: 196, y: 60, width: 584, height: 250, scale: 1 })}</div>
  <div class="band">${ICONS.lock}<span>${escapeHtml(banner)}</span></div>
</div>`,
  });
}
