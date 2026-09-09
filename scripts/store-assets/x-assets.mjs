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
 * polices systeme. Rendu en 2x puis reduction — le texte reste net.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { capture, resizeExact, pixelSize, assertChromeAvailable } from "./shot.mjs";
import { ROOT } from "./config.mjs";

const REPO = ROOT;
const OUT = path.join(REPO, "images", "promo", "x");
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "sp-x-"));
const LOGO = path.join(REPO, "images", "photos", "logosp.png");
const SHOT = path.join(REPO, "images", "cws_screenshots", "FR", "source-dashboard.png");

const FONT = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif`;
const MONO = `"SF Mono", ui-monospace, Menlo, monospace`;

/** Fond commun : halos + grille masquee, identique aux cadres du store. */
function backdrop(w, h) {
  return `
body {
  width: ${w}px; height: ${h}px; overflow: hidden;
  background:
    radial-gradient(${Math.round(w * 0.62)}px ${Math.round(h * 0.72)}px at 6% -14%, rgba(145, 70, 255, 0.38), transparent 64%),
    radial-gradient(${Math.round(w * 0.52)}px ${Math.round(h * 0.6)}px at 96% 2%, rgba(83, 252, 24, 0.12), transparent 62%),
    radial-gradient(${Math.round(w * 0.6)}px ${Math.round(h * 0.8)}px at 52% 122%, rgba(145, 70, 255, 0.16), transparent 70%),
    #08080d;
  color: #f0f0f4;
  font-family: ${FONT};
  -webkit-font-smoothing: antialiased;
  position: relative;
}
body::before {
  content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background-image:
    linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px);
  background-size: 40px 40px;
  -webkit-mask-image: radial-gradient(ellipse 85% 72% at 50% 20%, black, transparent 84%);
}
body > * { position: relative; z-index: 1; }
`;
}

const RESET = `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { overflow: hidden; }`;

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
      "Watch Time Tracker",
      "Twitch + Kick, 15 langues",
    ],
  },
  en: {
    chip: "Twitch &amp; Kick",
    h1: `Never miss a live<br>from your streamers.<br><span class="accent">And plenty more.</span>`,
    sub: "One extension for your Twitch and Kick streamers — plus every viewing comfort on top.",
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
      "Watch time tracker",
      "Twitch + Kick, 15 languages",
    ],
  },
};


function promoHtml(copy) {
  const col = (items) =>
    `<ul>${items
      .map((text) => `<li><span class="tick">✓</span><span>${text}</span></li>`)
      .join("")}</ul>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
${RESET}
${backdrop(PROMO.width, PROMO.height)}
body { display: grid; grid-template-columns: 632px 1fr; align-items: center; padding: 0 0 0 62px; }

.left { padding-right: 34px; }
.chip {
  display: inline-flex; align-items: center; gap: 9px;
  padding: 7px 15px 7px 13px; border-radius: 999px;
  background: rgba(83, 252, 24, 0.09);
  border: 1px solid rgba(83, 252, 24, 0.28);
  font-family: ${MONO}; font-size: 12px; letter-spacing: 0.17em;
  text-transform: uppercase; color: #7bf94a;
}
.chip::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #53FC18; box-shadow: 0 0 9px #53FC18; }

h1 {
  margin-top: 30px;
  font-size: 55px; line-height: 1.06; font-weight: 800; letter-spacing: -0.033em;
}
h1 .accent { color: #53FC18; }
.sub { margin-top: 19px; font-size: 18.5px; line-height: 1.5; color: #9a9aab; max-width: 540px; }

.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0 26px; margin-top: 40px; }
ul { list-style: none; display: flex; flex-direction: column; gap: 12.5px; }
li { display: flex; align-items: flex-start; gap: 9px; font-size: 15px; line-height: 1.25; color: #dcdce6; font-weight: 500; }
.tick { color: #53FC18; font-size: 13.5px; font-weight: 700; line-height: 1.35; }

.foot { display: flex; align-items: center; gap: 17px; margin-top: 52px; }
.foot .mark { display: flex; align-items: center; gap: 11px; }
.foot .mark img { width: 30px; height: 30px; display: block; }
.foot .mark span { font-size: 23px; font-weight: 700; letter-spacing: -0.022em; }
.foot .dot { width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,0.22); }
.browsers { display: flex; align-items: center; gap: 13px; color: #8d8da0; }
.foot .free { font-family: ${MONO}; font-size: 12.5px; color: #7a7a8c; }

.stage { display: flex; align-items: center; justify-content: center; height: 100%; }
.frame {
  width: 884px; border-radius: 17px; overflow: hidden;
  border: 1px solid rgba(255,255,255,0.10);
  box-shadow:
    0 0 0 1px rgba(145,70,255,0.16),
    0 46px 110px rgba(0,0,0,0.68),
    0 0 130px rgba(145,70,255,0.26);
  background: #0e0e14;
}
.frame img { display: block; width: 100%; }
</style></head><body>
  <div class="left">
    <div class="chip">${copy.chip}</div>
    <h1>${copy.h1}</h1>
    <div class="sub">${copy.sub}</div>
    <div class="cols">${col(copy.left)}${col(copy.right)}</div>
    <div class="foot">
      <div class="mark"><img src="${LOGO}" alt=""><span>StreamPulse</span></div>
      <div class="dot"></div>
      ${browserRow(24)}
      <div class="dot"></div>
      <div class="free">${copy.free}</div>
    </div>
  </div>
  <div class="stage"><div class="frame"><img src="${SHOT}" alt=""></div></div>
</body></html>`;
}

// ── 2. Banniere X 1500x500 ────────────────────────────────────────────────────

const BANNER = { width: 1500, height: 500 };

/**
 * X superpose la photo de profil en bas a gauche et rogne les bords sur mobile :
 * le contenu reste dans une bande centrale, degagee du coin bas-gauche.
 */
function bannerHtml() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
${RESET}
${backdrop(BANNER.width, BANNER.height)}
body { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 120px; }

.mark { display: flex; align-items: center; gap: 19px; }
.mark img { width: 66px; height: 66px; display: block; filter: drop-shadow(0 0 26px rgba(145,70,255,0.55)); }
.mark span { font-size: 60px; font-weight: 800; letter-spacing: -0.035em; }

.tag { margin-top: 15px; font-size: 23px; font-weight: 500; color: #cfcfdd; letter-spacing: -0.012em; }
.tag .tw { color: #a97dff; font-weight: 600; }
.tag .kk { color: #53FC18; font-weight: 600; }

.chips { display: flex; gap: 9px; margin-top: 24px; flex-wrap: wrap; justify-content: center; }
.pill {
  padding: 7px 15px; border-radius: 999px;
  background: rgba(255,255,255,0.045);
  border: 1px solid rgba(255,255,255,0.09);
  font-size: 14px; font-weight: 500; color: #b6b6c6;
}

.foot { display: flex; align-items: center; gap: 15px; margin-top: 28px; }
.browsers { display: flex; align-items: center; gap: 14px; color: #7f7f92; }
.dot { width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,0.2); }
.site { font-family: ${MONO}; font-size: 14px; letter-spacing: 0.06em; color: #a97dff; }
</style></head><body>
  <div class="mark"><img src="${LOGO}" alt=""><span>StreamPulse</span></div>
  <div class="tag">Ne rate aucun live de tes streamers <span class="tw">Twitch</span> &amp; <span class="kk">Kick</span>.</div>
  <div class="chips">
    <span class="pill">Notifications live</span>
    <span class="pill">Previews au survol</span>
    <span class="pill">Points &amp; Drops auto</span>
    <span class="pill">Watch time</span>
    <span class="pill">Filtre de tchat</span>
  </div>
  <div class="foot">
    ${browserRow(22)}
    <div class="dot"></div>
    <div class="site">streampulse.fr</div>
  </div>
</body></html>`;
}

// ── 3. Photo de profil 400x400 ────────────────────────────────────────────────

const AVATAR = { width: 400, height: 400 };

/**
 * X rogne la photo en cercle et l'affiche jusqu'a 32px : la marque est centree,
 * large, sans texte, sur un fond assez contraste pour tenir a cette taille.
 */
function avatarHtml(theme) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
${RESET}
html, body { width: ${AVATAR.width}px; height: ${AVATAR.height}px; overflow: hidden; }
body {
  background: ${theme === "dark"
    ? `radial-gradient(300px 300px at 32% 10%, rgba(145,70,255,0.34), transparent 66%), linear-gradient(150deg, #14141c 0%, #0b0b11 60%, #07070b 100%)`
    : `radial-gradient(300px 300px at 30% 12%, rgba(168, 104, 255, 0.85), transparent 66%),
    radial-gradient(280px 280px at 82% 96%, rgba(76, 0, 210, 0.9), transparent 68%),
    linear-gradient(150deg, #7b21ff 0%, #4a0bb5 52%, #24064f 100%)`};
  display: flex; align-items: center; justify-content: center; position: relative;
}
body::after {
  content: ""; position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
  background-size: 26px 26px;
  opacity: ${theme === "dark" ? 0.55 : 1};
  -webkit-mask-image: radial-gradient(circle at 50% 50%, black 20%, transparent 74%);
}
.mark {
  position: relative; z-index: 1;
  width: 244px; display: block;
  filter: ${theme === "dark" ? "drop-shadow(0 0 34px rgba(145,70,255,0.55))" : "brightness(0) invert(1) drop-shadow(0 10px 26px rgba(0,0,0,0.34))"};
}
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

await render("promo-fr-1600x900", promoHtml(COPY.fr), PROMO);
await render("promo-en-1600x900", promoHtml(COPY.en), PROMO);
await render("banner-1500x500", bannerHtml(), BANNER);
await render("avatar-violet-400x400", avatarHtml("violet"), AVATAR);
await render("avatar-sombre-400x400", avatarHtml("dark"), AVATAR);
console.log(`\n-> ${OUT}`);
