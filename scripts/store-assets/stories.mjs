/**
 * Stories Instagram / Snapchat : 1080x1920, PNG 24 bits, FR et EN.
 *
 *   node scripts/store-assets/stories.mjs [--sidebar-dir <dossier>] [--out <dossier>]
 *
 * --sidebar-dir contient sidebar-fr.png et sidebar-en.png (bloc favoris capturé en 4x).
 *
 * Deux stories par langue, même charte que la tuile promo (brand.mjs) :
 *   1. « Ne rate plus aucun live » : vraies cartes du popup en éventail.
 *   2. « Tes favoris en haut de Twitch » : capture de la barre latérale.
 *
 * Instagram couvre ~250px en haut (barre de progression, compte) et ~340px en
 * bas (réponse, lien) : rien d'important n'y est posé.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { capture, resizeExact, flattenToRgb } from "./shot.mjs";
import { ROOT } from "./config.mjs";
import { COLORS, FONT_CSS, DISPLAY, RESET, backdrop, LOGO_CSS, escapeHtml } from "./brand.mjs";

const STORY = { width: 1080, height: 1920 };
const args = process.argv.slice(2);
const argValue = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : "");
const OUT = argValue("--out") || path.join(os.homedir(), "Desktop/dev/ZIPS/launch/stories");
const SIDEBAR_DIR = argValue("--sidebar-dir");
const LOGO = path.join(ROOT, "images", "photos", "logosp.png");
const dashboardFor = (dir) => path.join(ROOT, "images", "cws_screenshots", dir, "source-dashboard.png");

const COPY = {
  fr: {
    dir: "FR",
    hook: ["Ne rate plus", "aucun live."],
    sub: "Tes streamers Twitch et Kick en direct, en un clic.",
    live: "En direct",
    points: "+250 pts",
    toast: ["jokaa45 est en live", "Just Chatting · il y a 1 min"],
    favHook: ["Tes favoris", "en haut de Twitch."],
    favSub: "Une étoile sur une chaîne, et elle passe devant toutes les autres.",
    favNote: "Épinglée",
    cta: "streampulse.fr",
    browsers: "Gratuit sur tous les navigateurs",
  },
  en: {
    dir: "EN",
    hook: ["Never miss", "a live again."],
    sub: "Your Twitch and Kick streamers live, one click away.",
    live: "Live now",
    points: "+250 pts",
    toast: ["jokaa45 is live", "Just Chatting · 1 min ago"],
    favHook: ["Your favorites,", "on top of Twitch."],
    favSub: "Star a channel and it jumps ahead of everything else.",
    favNote: "Pinned",
    cta: "streampulse.fr",
    browsers: "Free on every browser",
  },
};

const BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
const GEM = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 2h8l3 4-7 8-7-8z"/></svg>';
const STAR = '<svg viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M10 2.2l2.35 4.9 5.35.7-3.92 3.72 1 5.32L10 14.27l-4.78 2.57 1-5.32L2.3 7.8l5.35-.7z"/></svg>';
const LINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';


/** Glyphes Twitch et Kick simplifiés, dessinés en SVG pour rester nets à toute taille. */
const TWITCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4.3 2 3 5.3v13.4h4.6V22h2.6l3.3-3.3h3.9L22 14.1V2H4.3Zm15.4 11-2.6 2.6h-4.6l-3.3 3.3v-3.3H5.3V4.3h14.4V13Z"/><path fill="currentColor" d="M15.8 7.3h2.2v6h-2.2zM10.7 7.3h2.2v6h-2.2z"/></svg>';
const KICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 2h7v4h2V4h2V2h7v7h-2v2h-2v2h2v2h2v7h-7v-2h-2v-2h-2v4H3V2Z"/></svg>';

/** Pictogrammes de navigateurs monochromes (évoquent les marques sans reproduire les logos déposés). */
const BROWSER_MARKS = {
  chrome: '<circle cx="12" cy="12" r="9.4"/><circle cx="12" cy="12" r="3.7"/><path d="M12 8.3H21.1"/><path d="M8.8 13.9 4.2 5.9"/><path d="M15.2 13.9 10.6 21.9"/>',
  firefox: '<circle cx="12" cy="12" r="9.4"/><path d="M12.9 5.6c-.9 3.6 3 4.5 3 7.7 0 2.1-1.7 3.8-3.9 3.8-3.9 0-5.8-1.7-5.8-3.8 0-.7.1-1.3.3-1.8.3.6.9.9 1.5.9.9 0 1.5-.8 1.5-1.8 0-2.1 1.3-4.1 3.4-5Z"/>',
  edge: '<path d="M20.8 15.2A9 9 0 0 1 4 12.8C4 7.9 7.7 4.2 12.3 4.2c4 0 6.9 2.6 6.9 5.8H9.7"/><path d="M9.7 10c-2.6 2.9-1.5 7.1 2.6 8.9"/>',
  brave: '<path d="M12 21.4c3.6-1.5 6.4-4.6 6.4-8.6V6.2l-2.6-2.1-1.9.9h-3.8l-1.9-.9-2.6 2.1v6.6c0 4 2.8 7.1 6.4 8.6Z"/><path d="M12 10.4v6"/>',
  opera: '<circle cx="12" cy="12" r="9.4"/><ellipse cx="12" cy="12" rx="3.9" ry="7.3"/>',
  vivaldi: '<circle cx="12" cy="12" r="9.4"/><path d="m7.6 8.2 4.4 8 4.4-8"/>',
  arc: '<path d="M4.5 18.5 12 4l7.5 14.5"/><path d="M6.8 14c3.5-1.8 6.9-1.8 10.4 0"/>',
};

function browserRow() {
  return `<div class="browsers">${Object.values(BROWSER_MARKS)
    .map((d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`)
    .join("")}</div>`;
}

const BASE_CSS = `
${FONT_CSS}
${RESET}
${backdrop(STORY.width, STORY.height)}
body {
  background:
    radial-gradient(900px 1100px at 0% 0%, rgba(145, 70, 255, 0.42), transparent 62%),
    radial-gradient(800px 900px at 100% 78%, rgba(198, 212, 160, 0.12), transparent 60%),
    ${COLORS.bg};
}
.page { position: absolute; top: 262px; left: 84px; right: 84px; display: flex; flex-direction: column; }
.brand { display: flex; align-items: center; gap: 16px; }
.brand img { width: 48px; height: 48px; ${LOGO_CSS} }
.brand span { font-family: ${DISPLAY}; font-size: 34px; font-weight: 800; letter-spacing: -0.03em; }
h1 { margin-top: 58px; font-family: ${DISPLAY}; font-size: 112px; line-height: 0.98; font-weight: 800; letter-spacing: -0.04em; }
h1 em { display: block; font-style: normal; color: ${COLORS.violetText}; }
.sub { margin-top: 34px; width: 760px; font-size: 42px; line-height: 1.28; font-weight: 500; color: ${COLORS.text2}; text-wrap: balance; }
.foot { position: absolute; left: 84px; right: 84px; top: 1432px; display: flex; flex-direction: column; align-items: flex-start; gap: 20px; }
.cta { display: inline-flex; align-items: center; gap: 16px; padding: 24px 44px 24px 38px; border-radius: 999px; background: ${COLORS.violet}; color: #ffffff; font-family: ${DISPLAY}; font-size: 40px; font-weight: 700; letter-spacing: -0.02em; box-shadow: 0 22px 50px -14px rgba(145, 70, 255, 0.75); }
.cta svg { width: 40px; height: 40px; }
.meta { display: flex; align-items: center; gap: 14px; font-size: 32px; font-weight: 600; color: ${COLORS.text2}; }
.chip { display: inline-flex; align-items: center; gap: 10px; padding: 9px 20px; border-radius: 999px; background: ${COLORS.surface}; box-shadow: inset 0 0 0 1.5px ${COLORS.line2}; font-size: 28px; }
.chip svg { width: 30px; height: 30px; }
.chip.twitch svg { color: ${COLORS.violet}; }
.chip.kick svg { color: ${COLORS.kick}; }
.browsers { display: flex; align-items: center; gap: 22px; color: ${COLORS.text2}; }
.browsers svg { width: 44px; height: 44px; }
`;

/** Découpe une zone de la capture 1240x948 du popup, agrandie d'un facteur k. */
function crop(shot, { x, y, w, h }, k) {
  return `width:${w * k}px;height:${h * k}px;background-image:url('${escapeHtml(shot)}');background-size:${1240 * k}px auto;background-position:${-x * k}px ${-y * k}px;background-repeat:no-repeat;`;
}

function liveStory(copy) {
  const shot = dashboardFor(copy.dir);
  const k = 2.35;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
${BASE_CSS}
.stage { position: relative; margin: 48px -84px 0; height: 640px; }
.card { position: absolute; border-radius: 34px; box-shadow: 0 46px 80px -24px rgba(0, 0, 0, 0.85), 0 0 0 2px ${COLORS.line2}; }
.card.back { top: 150px; right: -120px; transform: rotate(8deg); opacity: 0.92; }
.card.front { top: 70px; left: 84px; transform: rotate(-5deg); }
.live { position: absolute; top: 34px; left: 130px; z-index: 3; display: inline-flex; align-items: center; gap: 14px; padding: 14px 30px 14px 26px; border-radius: 999px; background: ${COLORS.lcd}; color: ${COLORS.lcdInk}; font-size: 36px; font-weight: 700; transform: rotate(-5deg); box-shadow: 0 16px 34px -10px rgba(0, 0, 0, 0.7); }
.live::before { content: ""; width: 16px; height: 16px; border-radius: 50%; background: ${COLORS.lcdInk}; }
.pts { position: absolute; top: 560px; left: 470px; z-index: 3; display: inline-flex; align-items: center; gap: 12px; padding: 14px 28px; border-radius: 999px; background: ${COLORS.surface2}; box-shadow: inset 0 0 0 2px ${COLORS.line2}, 0 16px 34px -10px rgba(0, 0, 0, 0.7); font-size: 36px; font-weight: 700; transform: rotate(3deg); }
.pts svg { width: 30px; height: 30px; color: ${COLORS.violetText}; }
.toast { position: absolute; top: 360px; right: 60px; z-index: 4; width: 560px; display: flex; align-items: center; gap: 22px; padding: 24px 30px 24px 24px; border-radius: 30px; background: rgba(21, 23, 61, 0.96); box-shadow: inset 0 0 0 2px ${COLORS.line2}, 0 34px 60px -18px rgba(0, 0, 0, 0.85); transform: rotate(2deg); }
.toast .ic { flex: none; display: grid; place-items: center; width: 76px; height: 76px; border-radius: 22px; background: ${COLORS.violet}; color: #ffffff; }
.toast .ic svg { width: 38px; height: 38px; }
.toast b { display: block; font-size: 34px; font-weight: 700; letter-spacing: -0.01em; }
.toast small { display: block; margin-top: 4px; font-size: 27px; color: ${COLORS.text2}; }
</style></head><body>
  <div class="page">
  <div class="brand"><img src="${LOGO}" alt=""><span>StreamPulse</span></div>
  <h1>${escapeHtml(copy.hook[0])}<em>${escapeHtml(copy.hook[1])}</em></h1>
  <p class="sub">${escapeHtml(copy.sub)}</p>
  <div class="stage">
    <div class="card back" style="${crop(shot, { x: 362, y: 608, w: 330, h: 150 }, k)}"></div>
    <div class="card front" style="${crop(shot, { x: 22, y: 610, w: 326, h: 210 }, k)}"></div>
    <span class="live">${escapeHtml(copy.live)}</span>
    <span class="pts">${GEM}${escapeHtml(copy.points)}</span>
    <div class="toast"><span class="ic">${BELL}</span><span><b>${escapeHtml(copy.toast[0])}</b><small>${escapeHtml(copy.toast[1])}</small></span></div>
  </div>
  </div>
  <div class="foot">
    <span class="cta">${LINK}${escapeHtml(copy.cta)}</span>
    <div class="meta"><span class="chip twitch">${TWITCH}Twitch</span><span class="chip kick">${KICK}Kick</span><span>${escapeHtml(copy.browsers)}</span></div>
    ${browserRow()}
  </div>
</body></html>`;
}

function favoritesStory(copy, sidebar) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
${BASE_CSS}
h1.fav { font-size: 92px; line-height: 1; }
.stage { position: relative; margin-top: 84px; width: 760px; transform: rotate(-3deg); transform-origin: top left; }
.panel { position: relative; overflow: hidden; border-radius: 40px; background: #1f1f23; box-shadow: 0 50px 90px -26px rgba(0, 0, 0, 0.9), 0 0 0 2px ${COLORS.line2}; }
.panel img { display: block; width: 760px; }
.tag { position: absolute; top: 204px; right: -26px; z-index: 3; display: inline-flex; align-items: center; gap: 12px; padding: 14px 28px 14px 22px; border-radius: 999px; background: ${COLORS.lcd}; color: ${COLORS.lcdInk}; font-size: 36px; font-weight: 700; transform: rotate(6deg); box-shadow: 0 16px 34px -10px rgba(0, 0, 0, 0.7); }
.tag svg { width: 32px; height: 32px; }
</style></head><body>
  <div class="page">
  <div class="brand"><img src="${LOGO}" alt=""><span>StreamPulse</span></div>
  <h1 class="fav">${escapeHtml(copy.favHook[0])}<em>${escapeHtml(copy.favHook[1])}</em></h1>
  <p class="sub">${escapeHtml(copy.favSub)}</p>
  <div class="stage">
    <div class="panel"><img src="${escapeHtml(sidebar)}" alt=""></div>
    <span class="tag">${STAR}${escapeHtml(copy.favNote)}</span>
  </div>
  </div>
  <div class="foot">
    <span class="cta">${LINK}${escapeHtml(copy.cta)}</span>
    <div class="meta"><span class="chip twitch">${TWITCH}Twitch</span><span>${escapeHtml(copy.browsers)}</span></div>
    ${browserRow()}
  </div>
</body></html>`;
}

async function render(name, html) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "sp-story-"));
  const htmlPath = path.join(work, `${name}.html`);
  const outPath = path.join(OUT, `${name}.png`);
  fs.writeFileSync(htmlPath, html);
  await capture({ htmlPath, outPath, width: STORY.width, height: STORY.height });
  await resizeExact(outPath, STORY.width, STORY.height);
  await flattenToRgb(outPath);
  fs.rmSync(work, { recursive: true, force: true });
  console.log(`✓ ${outPath}`);
}

fs.mkdirSync(OUT, { recursive: true });
for (const [lang, copy] of Object.entries(COPY)) {
  await render(`story-live-${lang}`, liveStory(copy));
  const sidebar = SIDEBAR_DIR && path.join(SIDEBAR_DIR, `sidebar-${lang}.png`);
  if (sidebar && fs.existsSync(sidebar)) await render(`story-favoris-${lang}`, favoritesStory(copy, sidebar));
}
