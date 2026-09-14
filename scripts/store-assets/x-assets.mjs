/**
 * Visuels du compte X de StreamPulse.
 *
 *   node scripts/store-assets/x-assets.mjs
 *
 * Produit dans images/promo/x/ (exclu du zip par scripts/build-zip.mjs) :
 *   promo-fr-1600x900.png / promo-en-1600x900.png  visuel de tweet
 *   banner-1500x500.png                            banniere de profil X
 *   avatar-violet-400x400.png / avatar-sombre-...  photo de profil X
 *
 * Meme charte que les captures du store (scripts/store-assets/frames.mjs) :
 * fond #08080d, halo violet Twitch, halo vert Kick, grille ambiante, pile de
 * polices systeme. Rendu en 2x puis reduction, pour garder le texte net.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { capture, resizeExact, pixelSize, assertChromeAvailable } from "./shot.mjs";
import { ROOT } from "./config.mjs";
import { COLORS, FONT_CSS, DISPLAY, RESET, backdrop, LOGO_CSS } from "./brand.mjs";

const REPO = ROOT;
const OUT = path.join(REPO, "images", "promo", "x");
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "sp-x-"));
const LOGO = path.join(REPO, "images", "photos", "logosp.png");
const shotFor = (dir) => path.join(REPO, "images", "cws_screenshots", dir, "source-dashboard.png");

/**
 * Marques de navigateurs, monochromes et simplifiees : on ne reproduit pas les
 * logos officiels (couleurs et proportions deposees), on pose un pictogramme
 * qui les evoque a 26px.
 */
const BROWSER_MARKS = {
  chrome: `<circle cx="12" cy="12" r="9.4"/><circle cx="12" cy="12" r="3.7"/><path d="M12 8.3H21.1"/><path d="M8.8 13.9 4.2 5.9"/><path d="M15.2 13.9 10.6 21.9"/>`,
  firefox: `<circle cx="12" cy="12" r="9.4"/><path d="M12.9 5.6c-.9 3.6 3 4.5 3 7.7 0 2.1-1.7 3.8-3.9 3.8-3.9 0-5.8-1.7-5.8-3.8 0-.7.1-1.3.3-1.8.3.6.9.9 1.5.9.9 0 1.5-.8 1.5-1.8 0-2.1 1.3-4.1 3.4-5Z"/>`,
  brave: `<path d="M12 21.4c3.6-1.5 6.4-4.6 6.4-8.6V6.2l-2.6-2.1-1.9.9h-3.8l-1.9-.9-2.6 2.1v6.6c0 4 2.8 7.1 6.4 8.6Z"/><path d="M12 10.4v6"/>`,
  edge: `<path d="M20.8 15.2A9 9 0 0 1 4 12.8C4 7.9 7.7 4.2 12.3 4.2c4 0 6.9 2.6 6.9 5.8H9.7"/><path d="M9.7 10c-2.6 2.9-1.5 7.1 2.6 8.9"/>`,
  opera: `<circle cx="12" cy="12" r="9.4"/><ellipse cx="12" cy="12" rx="3.9" ry="7.3"/>`,
};

function browserRow(size = 26) {
  const items = ["chrome", "firefox", "brave", "edge", "opera"]
    .map(
      (id) =>
        `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${BROWSER_MARKS[id]}</svg>`,
    )
    .join("");
  return `<div class="browsers">${items}</div>`;
}

// ── 1. Visuel de tweet 1600x900 ───────────────────────────────────────────────

const PROMO = { width: 1600, height: 900 };

/** Deux colonnes de 7 : tout ce qui etait specifique au ZEvent est retire. */
const COPY = {
  fr: {
    chip: "Twitch &amp; Kick",
    h1: `Ne rate aucun live<br>de tes streamers.<br><span class="accent">Et bien plus que ça.</span>`,
    sub: "Une extension, tes streamers Twitch et Kick, et tout le confort de visionnage en prime.",
    free: "gratuit",
    left: [
      "Notifications de passage en live",
      "Alertes changement de catégorie",
      "Previews au survol (image ou vidéo)",
      "Récupération auto des points",
      "Auto-claim Drops &amp; Moments",
      "Annulation automatique des Raids",
      "Badge communautaire dans le tchat",
    ],
    right: [
      "Mots-clés masqués dans le tchat",
      "Bouton d'avance rapide",
      "Anti-mise en veille de l'onglet",
      "Avatar &amp; pastille LIVE sur l'onglet",
      "Masquer les extensions Twitch",
      "Récap de visionnage",
      "Twitch + Kick, 15 langues",
    ],
  },
  en: {
    chip: "Twitch &amp; Kick",
    h1: `Never miss a live<br>from your streamers.<br><span class="accent">And plenty more.</span>`,
    sub: "One extension for your Twitch and Kick streamers, plus every viewing comfort on top.",
    free: "free",
    left: [
      "Live notifications",
      "Category change alerts",
      "Hover previews (image or video)",
      "Automatic channel points",
      "Auto-claim Drops &amp; Moments",
      "Automatic raid opt-out",
      "Community badge in chat",
    ],
    right: [
      "Chat keyword filter",
      "Fast-forward button",
      "Keeps the tab awake",
      "Avatar &amp; LIVE dot on the tab",
      "Hide Twitch extensions",
      "Watch time recap",
      "Twitch + Kick, 15 languages",
    ],
  },
};


function promoHtml(copy, shot) {
  const col = (items) =>
    `<ul>${items.map((text) => `<li><span class="tick">✓</span><span>${text}</span></li>`).join("")}</ul>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
${FONT_CSS}
${RESET}
${backdrop(PROMO.width, PROMO.height)}
body { display: grid; grid-template-columns: 660px 1fr; align-items: center; padding-left: 64px; }
.chip {
  display: inline-flex; align-items: center; gap: 9px; padding: 7px 15px 7px 13px; border-radius: 999px;
  background: rgba(198,212,160,0.12); box-shadow: inset 0 0 0 1px rgba(198,212,160,0.32);
  font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: ${COLORS.lcd};
}
.chip::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: ${COLORS.lcd}; }
h1 { margin-top: 26px; font-family: ${DISPLAY}; font-size: 52px; line-height: 1.04; font-weight: 800; letter-spacing: -0.04em; }
h1 .accent { color: ${COLORS.violetText}; }
.sub { margin-top: 18px; font-size: 19px; line-height: 1.45; color: ${COLORS.text2}; max-width: 560px; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; margin-top: 34px; padding-right: 30px; }
ul { list-style: none; display: flex; flex-direction: column; gap: 11px; }
li { display: flex; align-items: flex-start; gap: 9px; font-size: 15.5px; line-height: 1.25; color: ${COLORS.text}; font-weight: 500; }
.tick { display: grid; place-items: center; flex: none; width: 17px; height: 17px; border-radius: 50%; background: ${COLORS.lcd}; color: ${COLORS.lcdInk}; font-size: 10px; font-weight: 700; margin-top: 1px; }
.foot { display: flex; align-items: center; gap: 16px; margin-top: 44px; }
.mark { display: flex; align-items: center; gap: 11px; }
.mark img { width: 30px; height: 30px; ${LOGO_CSS} }
.mark span { font-family: ${DISPLAY}; font-size: 22px; font-weight: 700; letter-spacing: -0.03em; }
.dot { width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,0.25); }
.browsers { display: flex; align-items: center; gap: 13px; color: ${COLORS.text3}; }
.site { font-size: 15px; font-weight: 600; color: ${COLORS.violetText}; }
.stage { height: 100%; display: flex; align-items: center; justify-content: center; padding: 60px 60px 60px 10px; }
.frame { width: 100%; border-radius: 20px; overflow: hidden; box-shadow: 0 0 0 1px ${COLORS.line2}, 0 50px 110px rgba(0,0,0,0.6), 0 0 140px rgba(145,70,255,0.3); }
.frame img { display: block; width: 100%; }
</style></head><body>
  <div>
    <div class="chip">${copy.chip}</div>
    <h1>${copy.h1}</h1>
    <div class="sub">${copy.sub}</div>
    <div class="cols">${col(copy.left)}${col(copy.right)}</div>
    <div class="foot">
      <div class="mark"><img src="${LOGO}" alt=""><span>StreamPulse</span></div>
      <div class="dot"></div>${browserRow(22)}<div class="dot"></div>
      <div class="site">streampulse.fr</div>
    </div>
  </div>
  <div class="stage"><div class="frame"><img src="${shot}" alt=""></div></div>
</body></html>`;
}

// ── 2. Banniere X 1500x500 ────────────────────────────────────────────────────

const BANNER = { width: 1500, height: 500 };

/** X pose l'avatar en bas a gauche et rogne les bords sur mobile : contenu centre. */
function bannerHtml() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
${FONT_CSS}
${RESET}
${backdrop(BANNER.width, BANNER.height)}
body { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 120px; }
.mark { display: flex; align-items: center; gap: 20px; }
.mark img { width: 64px; height: 64px; ${LOGO_CSS} }
.mark span { font-family: ${DISPLAY}; font-size: 58px; font-weight: 800; letter-spacing: -0.045em; }
.tag { margin-top: 16px; font-size: 24px; font-weight: 500; color: ${COLORS.text2}; }
.tag .tw { color: ${COLORS.violetText}; font-weight: 700; }
.tag .kk { color: ${COLORS.kick}; font-weight: 700; }
.chips { display: flex; gap: 9px; margin-top: 24px; flex-wrap: wrap; justify-content: center; }
.pill { padding: 8px 16px; border-radius: 999px; background: ${COLORS.surface}; box-shadow: inset 0 0 0 1px ${COLORS.line2}; font-size: 15px; font-weight: 600; color: ${COLORS.text}; }
.pill.lcd { background: ${COLORS.lcd}; color: ${COLORS.lcdInk}; box-shadow: none; }
.foot { display: flex; align-items: center; gap: 15px; margin-top: 26px; }
.browsers { display: flex; align-items: center; gap: 14px; color: ${COLORS.text3}; }
.dot { width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,0.25); }
.site { font-size: 16px; font-weight: 600; color: ${COLORS.violetText}; }
</style></head><body>
  <div class="mark"><img src="${LOGO}" alt=""><span>StreamPulse</span></div>
  <div class="tag">Ne rate aucun live de tes streamers <span class="tw">Twitch</span> &amp; <span class="kk">Kick</span>.</div>
  <div class="chips">
    <span class="pill lcd">Notifications live</span>
    <span class="pill">Previews au survol</span>
    <span class="pill">Points &amp; Drops auto</span>
    <span class="pill">Mon récap</span>
    <span class="pill">Filtre de tchat</span>
  </div>
  <div class="foot">${browserRow(22)}<div class="dot"></div><div class="site">streampulse.fr</div></div>
</body></html>`;
}

// ── 3. Photo de profil 400x400 ────────────────────────────────────────────────

const AVATAR = { width: 400, height: 400 };

/** Rognee en cercle et affichee jusqu'a 32px : logo blanc centre, fond contraste. */
function avatarHtml(theme) {
  const bg = theme === "dark"
    ? `radial-gradient(320px 320px at 20% 0%, rgba(145,70,255,0.45), transparent 66%), ${COLORS.bg}`
    : `radial-gradient(300px 300px at 25% 10%, #b07bff, transparent 66%), linear-gradient(150deg, #9146ff 0%, #5a1fd1 60%, #2e0f7a 100%)`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
${RESET}
html, body { width: ${AVATAR.width}px; height: ${AVATAR.height}px; overflow: hidden; }
body { background: ${bg}; display: flex; align-items: center; justify-content: center; }
.mark { width: 230px; ${LOGO_CSS} }
</style></head><body><img class="mark" src="${LOGO}" alt=""></body></html>`;
}

// ── Rendu ─────────────────────────────────────────────────────────────────────

async function render(name, html, size) {
  const htmlPath = path.join(WORK, `${name}.html`);
  fs.writeFileSync(htmlPath, html, "utf8");
  const outPath = path.join(OUT, `${name}.png`);
  await capture({ htmlPath, outPath, width: size.width, height: size.height });
  await resizeExact(outPath, size.width, size.height);
  const actual = await pixelSize(outPath);
  if (actual.width !== size.width || actual.height !== size.height) {
    throw new Error(`${name}: ${actual.width}x${actual.height}, attendu ${size.width}x${size.height}`);
  }
  console.log(`  OK  ${name}.png  ${actual.width}x${actual.height}`);
}

assertChromeAvailable();
for (const dir of [OUT, WORK]) fs.mkdirSync(dir, { recursive: true });

await render("promo-fr-1600x900", promoHtml(COPY.fr, shotFor("FR")), PROMO);
await render("promo-en-1600x900", promoHtml(COPY.en, shotFor("EN")), PROMO);
await render("banner-1500x500", bannerHtml(), BANNER);
await render("avatar-violet-400x400", avatarHtml("violet"), AVATAR);
await render("avatar-sombre-400x400", avatarHtml("dark"), AVATAR);
console.log(`\n-> ${OUT}`);
