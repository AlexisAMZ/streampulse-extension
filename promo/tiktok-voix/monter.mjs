#!/usr/bin/env node
/**
 * Monte les 5 TikTok : voix ElevenLabs (sortie/NN-*.mp3) + capture du store
 * en zoom lent + sous-titres synchronisés, en 1080x1920, 30 fps, h264/aac.
 *
 *   node promo/tiktok-voix/monter.mjs            tous
 *   node promo/tiktok-voix/monter.mjs 03         un seul
 *
 * Les sous-titres sont rendus par Chrome headless avec les polices du dépôt
 * (Unbounded), puis incrustés par ffmpeg. Le découpage suit le texte parlé ;
 * la durée de chaque bloc est proportionnelle à son nombre de caractères.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "..", "..");
const SORTIE = path.join(DIR, "sortie");
const VIDEOS = path.join(DIR, "videos");
const CHROME = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const W = 1080;
const H = 1920;
const SHOT_Y = 520; // capture 1080x675, centrée sur la partie haute
const TAIL = 0.9; // secondes après la fin de la voix
const MAX_WORDS = 4;

/* Capture du store et zone sur laquelle le zoom lent se pose (en fractions). */
const SHOTS = {
  "01-live-rate": { img: "01-dashboard.png", focus: [0.35, 0.72] },
  "02-points-auto": { img: "01-dashboard.png", focus: [0.4, 0.58] },
  "03-drops": { img: "02-drops.png", focus: [0.6, 0.4] },
  "04-trois-plateformes": { img: "04-compat.png", focus: [0.5, 0.55] },
  "05-sans-compte": { img: "05-control.png", focus: [0.85, 0.45] },
};

const fontUrl = (name) => pathToFileURL(path.join(ROOT, "font", name)).href;
const FONTS = `
@font-face { font-family: "Unbounded"; font-weight: 400 900; src: url("${fontUrl("unbounded-latin-10.woff2")}") format("woff2"); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2212; }
@font-face { font-family: "Onest"; font-weight: 400 700; src: url("${fontUrl("onest-latin-6.woff2")}") format("woff2"); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2212; }
`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Découpe le texte parlé en blocs de sous-titre (phrases, puis 4 mots max). */
function decouper(texte) {
  const phrases = texte.match(/[^.!?]+[.!?]*/g).map((p) => p.trim()).filter(Boolean);
  const blocs = [];
  for (const phrase of phrases) {
    const mots = phrase.replace(/[.!?]+$/, "").split(/\s+/);
    const n = Math.ceil(mots.length / MAX_WORDS);
    const taille = Math.ceil(mots.length / n);
    for (let i = 0; i < mots.length; i += taille) blocs.push(mots.slice(i, i + taille).join(" "));
  }
  return blocs;
}

function duree(file) {
  return Number(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }),
  );
}

function chromeShot(html, out, w, h, transparent) {
  const page = out.replace(/\.png$/, ".html");
  fs.writeFileSync(page, html);
  execFileSync(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--window-size=${w},${h}`,
    ...(transparent ? ["--default-background-color=00000000"] : []),
    `--screenshot=${out}`,
    pathToFileURL(page).href,
  ], { stdio: "ignore" });
}

const fond = () => `<!doctype html><meta charset="utf-8"><style>${FONTS}
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}
body{background:
  radial-gradient(900px 900px at 10% 0%, rgba(145,70,255,.38), transparent 62%),
  radial-gradient(1000px 1000px at 100% 100%, rgba(60,30,150,.45), transparent 60%), #0b0c22;
  font-family:"Onest",sans-serif;color:#f4f3ff}
.top{position:absolute;top:150px;left:0;right:0;text-align:center}
.top img{width:84px;vertical-align:middle;margin-right:18px}
.top b{font:800 52px "Unbounded";vertical-align:middle}
.pill{display:inline-block;margin-top:30px;padding:12px 26px;border-radius:99px;background:rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.14);font:600 26px "Onest";letter-spacing:.08em;color:#c6d4a0}
</style><div class="top"><img src="${pathToFileURL(path.join(ROOT, "images/photos/logosp.png")).href}"><b>StreamPulse</b><br>
<span class="pill">EXTENSION CHROME · TWITCH · KICK · YOUTUBE</span></div>`;

const sousTitre = (texte) => `<!doctype html><meta charset="utf-8"><style>${FONTS}
html,body{margin:0;width:${W}px;height:420px;background:transparent;overflow:hidden}
body{display:flex;align-items:center;justify-content:center;padding:0 60px;box-sizing:border-box}
p{margin:0;text-align:center;font:800 82px/1.12 "Unbounded";color:#fff;
  text-shadow:0 6px 0 #5b21b6,0 0 40px rgba(10,4,40,.9);-webkit-text-stroke:2px #5b21b6;paint-order:stroke fill}
</style><p>${esc(texte)}</p>`;

function monter(id, texte, tmp) {
  const mp3 = path.join(SORTIE, `${id}.mp3`);
  const dur = duree(mp3);
  const total = dur + TAIL;
  const shot = SHOTS[id];

  const bg = path.join(tmp, `${id}-fond.png`);
  chromeShot(fond(), bg, W, H, false);

  /* Minutage : proportionnel aux caractères entre 0,15 s et la fin de la voix. */
  const blocs = decouper(texte);
  const poids = blocs.map((b) => b.length + 4);
  const somme = poids.reduce((a, b) => a + b, 0);
  const debutVoix = 0.15;
  const finVoix = dur - 0.1;
  let t = debutVoix;
  const lignes = blocs.map((b, i) => {
    const d = ((finVoix - debutVoix) * poids[i]) / somme;
    const ligne = { texte: b, de: t, a: i === blocs.length - 1 ? total : t + d };
    t += d;
    return ligne;
  });

  const pngs = lignes.map((l, i) => {
    const out = path.join(tmp, `${id}-st${String(i).padStart(2, "0")}.png`);
    chromeShot(sousTitre(l.texte), out, W, 420, true);
    return out;
  });

  /* Zoom lent de 1,0 à 1,22 vers la zone d'intérêt, sur l'image agrandie x2. */
  const frames = Math.ceil(total * 30);
  const [fx, fy] = shot.focus;
  const zoom = `zoompan=z='1+0.22*on/${frames}':x='(iw-iw/zoom)*${fx}':y='(ih-ih/zoom)*${fy}':d=${frames}:s=${W}x675:fps=30`;

  const inputs = ["-loop", "1", "-i", bg, "-loop", "1", "-i", path.join(ROOT, "images/cws_screenshots/FR", shot.img)];
  for (const p of pngs) inputs.push("-loop", "1", "-i", p);
  inputs.push("-i", mp3);

  const audioIdx = 2 + pngs.length;
  let chain = `[1:v]scale=${W * 2}:-1:flags=lanczos,${zoom}[shot];[0:v][shot]overlay=0:${SHOT_Y}:shortest=1[v0]`;
  lignes.forEach((l, i) => {
    chain += `;[v${i}][${2 + i}:v]overlay=0:1270:enable='between(t,${l.de.toFixed(3)},${l.a.toFixed(3)})'[v${i + 1}]`;
  });

  fs.mkdirSync(VIDEOS, { recursive: true });
  const sortie = path.join(VIDEOS, `${id}.mp4`);
  execFileSync("ffmpeg", [
    "-y", "-v", "error", ...inputs,
    "-filter_complex", `${chain};[${audioIdx}:a]apad=pad_dur=${TAIL}[a]`,
    "-map", `[v${lignes.length}]`, "-map", "[a]",
    "-t", total.toFixed(3), "-r", "30",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", sortie,
  ], { stdio: "inherit" });
  console.log(`OK ${path.relative(ROOT, sortie)} (${total.toFixed(1)} s, ${blocs.length} sous-titres)`);
}

const { videos } = JSON.parse(fs.readFileSync(path.join(DIR, "scripts.json"), "utf8"));
const filtre = process.argv[2];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sp-tiktok-"));
try {
  for (const v of videos) {
    if (filtre && !v.id.startsWith(filtre)) continue;
    monter(v.id, v.texte, tmp);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
