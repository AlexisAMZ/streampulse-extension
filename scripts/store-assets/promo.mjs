/**
 * Petite tuile promotionnelle du Chrome Web Store : 440x280, PNG 24 bits.
 *
 * Surface minuscule : logo, nom, une accroche courte, deux pastilles de
 * plateforme. Tout ce qui est plus long ne se lit pas à cette taille.
 */

export const PROMO_TILE = { width: 440, height: 280 };

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${PROMO_TILE.width}px; height: ${PROMO_TILE.height}px; overflow: hidden; }
body {
  background:
    radial-gradient(300px 220px at 4% -18%, rgba(145, 70, 255, 0.58), transparent 68%),
    radial-gradient(260px 200px at 100% 4%, rgba(83, 252, 24, 0.20), transparent 64%),
    radial-gradient(320px 230px at 46% 126%, rgba(145, 70, 255, 0.20), transparent 72%),
    #08080d;
  color: #f0f0f4;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  display: flex;
  flex-direction: column;
  padding: 24px 26px 22px;
  position: relative;
}
body::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
  background-size: 28px 28px;
  -webkit-mask-image: radial-gradient(ellipse 85% 75% at 50% 22%, black, transparent 84%);
}
body > * { position: relative; }

.brand { display: flex; align-items: center; gap: 9px; }
.brand img { width: 29px; height: 29px; display: block; }
.brand span { font-size: 24px; font-weight: 700; letter-spacing: -0.022em; }

.tagline {
  margin-top: 7px;
  font-family: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace;
  font-size: 8.5px;
  letter-spacing: 0.15em;
  color: #a97dff;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
}

.benefits {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 9px;
}
.benefit {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12.5px;
  line-height: 1.3;
  font-weight: 600;
  letter-spacing: -0.008em;
  color: #dcdce6;
}
.benefit::before {
  content: "";
  flex: 0 0 auto;
  width: 5px;
  height: 5px;
  margin-top: 6px;
  border-radius: 50%;
  background: #9146FF;
  box-shadow: 0 0 7px rgba(145, 70, 255, 0.9);
}
.benefit span {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.chips { display: flex; gap: 7px; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.09);
  font-size: 11px;
  font-weight: 600;
  color: #c4c4d2;
}
.chip::before { content: ""; width: 6px; height: 6px; border-radius: 50%; }
.chip.twitch::before { background: #9146FF; box-shadow: 0 0 7px #9146FF; }
.chip.kick::before { background: #53FC18; box-shadow: 0 0 7px #53FC18; }
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
