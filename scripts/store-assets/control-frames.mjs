/**
 * 5e capture du store, thème « Tu gardes la main » : trois colonnes (Badges,
 * réglages de notification, vie privée sans capture).
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
  lock: stroke('<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.1" fill="currentColor"/>'),
  badge: stroke('<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>'),
};

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

/** Trois colonnes égales, deux fragments du popup et un bloc vie privée. */
export function buildControlFrame({ logoPath, tagline, title, subtitle, columns, badgesShot, settingsShot }) {
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
