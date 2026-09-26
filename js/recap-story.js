// Mise en page mobile : portrait 1080x1920 (9:16), adaptee aux stories Instagram et TikTok.

import { formatDuration } from "./recap-data.js";
import { DISPLAY,
  INK,
  LCD,
  MUTED,
  FAINT,
  MONO,
  drawAvatar,
  drawBackground,
  drawBar,
  drawBrand,
  drawEyebrow,
  drawPanel,
  drawPlatformSplit,
  fitText,
  setFont,
  setFittedFont,
} from "./recap-draw.js";

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

// Les stories sont rognees par l'interface en haut et en bas :
// tout le contenu utile reste dans la zone sure.
const SAFE_TOP = 250;
const LEFT = 84;
const RIGHT = STORY_WIDTH - 84;
const CONTENT_W = RIGHT - LEFT;
// 5 lignes : au-dela, le pied de page sortirait de la zone sure du bas.
const MAX_ROWS = 5;

function drawHeader(ctx, model) {
  const { labels } = model;
  const cx = STORY_WIDTH / 2;
  ctx.textAlign = "center";

  setFont(ctx, 700, 26, MONO);
  const eyebrow = labels.eyebrow.toUpperCase();
  drawEyebrow(ctx, eyebrow, cx, SAFE_TOP, 26);

  ctx.fillStyle = INK;
  setFittedFont(ctx, labels.heading, CONTENT_W, 800, 64, DISPLAY);
  ctx.fillText(fitText(ctx, labels.heading, CONTENT_W), cx, SAFE_TOP + 92);

  ctx.fillStyle = MUTED;
  setFont(ctx, 500, 32);
  ctx.fillText(fitText(ctx, labels.period, CONTENT_W), cx, SAFE_TOP + 146);

  ctx.fillStyle = FAINT;
  setFont(ctx, 700, 22, MONO);
  ctx.fillText(labels.statTime.toUpperCase(), cx, SAFE_TOP + 252);
  const totalText = formatDuration(model.totalSeconds);
  ctx.fillStyle = INK;
  setFittedFont(ctx, totalText, CONTENT_W, 800, 150, DISPLAY);
  ctx.fillText(totalText, cx, SAFE_TOP + 394);

  ctx.textAlign = "left";
}

function drawTiles(ctx, model, top) {
  const { labels } = model;
  const gap = 24;
  const h = 150;
  const tiles = [
    { label: labels.statChannels, value: String(model.streamerCount) },
    { label: labels.statTop, value: model.top[0]?.channel || "—" },
    ...(model.points ? [{ label: labels.statPoints, value: model.points.label, color: LCD }] : []),
  ];
  // Avec trois tuiles, le nom de la chaine favorite garde la place de s'afficher en entier.
  const weights = tiles.length === 3 ? [0.7, 1.4, 1] : tiles.map(() => 1);
  const unit = (CONTENT_W - gap * (tiles.length - 1)) / weights.reduce((sum, weight) => sum + weight, 0);
  let x = LEFT;
  tiles.forEach((tile, i) => {
    const w = unit * weights[i];
    drawPanel(ctx, x, top, w, h, 20);
    ctx.fillStyle = FAINT;
    setFont(ctx, 700, 20, MONO);
    ctx.fillText(fitText(ctx, tile.label.toUpperCase(), w - 56), x + 28, top + 50);
    ctx.fillStyle = tile.color || INK;
    setFittedFont(ctx, tile.value, w - 56, 800, 54, DISPLAY, 26);
    ctx.fillText(fitText(ctx, tile.value, w - 56), x + 28, top + 118);
    x += w + gap;
  });
  return top + h;
}

function drawTopList(ctx, model, avatars, top) {
  const rows = model.top.slice(0, MAX_ROWS);
  const rowH = 98;
  const h = 96 + rows.length * rowH + 12;
  drawPanel(ctx, LEFT, top, CONTENT_W, h, 24);
  drawEyebrow(ctx, model.labels.topTitle, LEFT + 40, top + 62, 22);

  const maxSeconds = rows[0]?.watchSeconds || 0;
  const avatar = 64;
  rows.forEach((entry, i) => {
    const y = top + 96 + i * rowH;
    ctx.fillStyle = FAINT;
    setFont(ctx, 700, 26, MONO);
    ctx.textAlign = "right";
    ctx.fillText(String(i + 1).padStart(2, "0"), LEFT + 82, y + 44);
    ctx.textAlign = "left";

    drawAvatar(ctx, LEFT + 102, y + 4, avatar, entry.channel, avatars.get(`${entry.platform}:${entry.channel}`), entry.platform);

    const timeText = formatDuration(entry.watchSeconds);
    setFont(ctx, 700, 30);
    const timeWidth = ctx.measureText(timeText).width;
    ctx.fillStyle = INK;
    ctx.textAlign = "right";
    ctx.fillText(timeText, RIGHT - 40, y + 40);
    ctx.textAlign = "left";

    const nameX = LEFT + 190;
    ctx.fillStyle = INK;
    setFont(ctx, 600, 32);
    ctx.fillText(fitText(ctx, entry.channel, RIGHT - 40 - nameX - timeWidth - 24), nameX, y + 40);

    const ratio = maxSeconds > 0 ? entry.watchSeconds / maxSeconds : 0;
    drawBar(ctx, nameX, y + 60, RIGHT - 40 - nameX, 12, ratio);
  });
  return top + h;
}

/**
 * Dessine la story complete.
 *
 * @param {CanvasRenderingContext2D} ctx contexte d'un canvas 1080x1920
 * @param {object} model recap (buildRecap) + `labels` deja traduits
 * @param {{avatars?: Map<string, CanvasImageSource>, logo?: CanvasImageSource}} [assets]
 */
export function drawRecapStory(ctx, model, assets = {}) {
  const avatars = assets.avatars || new Map();
  drawBackground(ctx, STORY_WIDTH, STORY_HEIGHT);
  drawHeader(ctx, model);

  let y = drawTiles(ctx, model, SAFE_TOP + 460);

  ctx.fillStyle = FAINT;
  setFont(ctx, 700, 20, MONO);
  ctx.fillText(model.labels.statPlatforms.toUpperCase(), LEFT, y + 70);
  drawPlatformSplit(ctx, LEFT, y + 92, CONTENT_W, 20, model.platforms, model.totalSeconds, { legendSize: 24 });

  y = drawTopList(ctx, model, avatars, y + 190);

  drawBrand(ctx, assets.logo, 0, y + 100, {
    size: 52,
    nameSize: 36,
    align: "center",
    width: STORY_WIDTH,
  });
}
