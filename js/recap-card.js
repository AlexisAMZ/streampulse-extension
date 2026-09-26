// Mise en page PC : paysage 1600x900 (16:9), adaptee a X, Discord ou un fond d'ecran.

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

export const CARD_WIDTH = 1600;
export const CARD_HEIGHT = 900;

const PAD = 84;
const SPLIT_X = 760;
const MAX_ROWS = 7;

const TILE_H = 104;
const TILE_GAP = 20;

function drawTile(ctx, tile, x, y, w) {
  drawPanel(ctx, x, y, w, TILE_H, 16);
  ctx.fillStyle = FAINT;
  setFont(ctx, 700, 16, MONO);
  ctx.fillText(fitText(ctx, tile.label.toUpperCase(), w - 48), x + 24, y + 38);
  ctx.fillStyle = tile.color || INK;
  setFittedFont(ctx, tile.value, w - 48, 800, 40, DISPLAY, 22);
  ctx.fillText(fitText(ctx, tile.value, w - 48), x + 24, y + 84);
}

/**
 * Tuiles des chiffres. Avec les points : chaines et points cote a cote, la
 * chaine favorite seule sur toute la largeur (un pseudo Twitch va jusqu'a 25
 * caracteres). Sans points : une seule rangee. Renvoie le bas des tuiles.
 */
function drawTiles(ctx, model, top, width) {
  const { labels } = model;
  const channels = { label: labels.statChannels, value: String(model.streamerCount) };
  const favorite = { label: labels.statTop, value: model.top[0]?.channel || "—" };
  const rows = model.points
    ? [[[channels, 1], [{ label: labels.statPoints, value: model.points.label, color: LCD }, 1]], [[favorite, 1]]]
    : [[[channels, 0.55], [favorite, 1.45]]];
  let y = top;
  rows.forEach((row) => {
    const unit = (width - TILE_GAP * (row.length - 1)) / row.reduce((sum, [, weight]) => sum + weight, 0);
    let x = PAD;
    row.forEach(([tile, weight]) => {
      drawTile(ctx, tile, x, y, unit * weight);
      x += unit * weight + TILE_GAP;
    });
    y += TILE_H + 16;
  });
  return y - 16;
}

function drawLeftColumn(ctx, model) {
  const { labels } = model;
  const maxWidth = SPLIT_X - PAD - 60;

  drawEyebrow(ctx, labels.eyebrow, PAD, 104, 20);

  ctx.fillStyle = INK;
  setFittedFont(ctx, labels.heading, maxWidth, 800, 58, DISPLAY);
  ctx.fillText(fitText(ctx, labels.heading, maxWidth), PAD, 176);

  ctx.fillStyle = MUTED;
  setFont(ctx, 500, 26);
  ctx.fillText(fitText(ctx, labels.period, maxWidth), PAD, 220);

  // Le total est le chiffre que l'on retient. Au-dela de 100 h, il rapetisse
  // pour ne pas deborder sur le panneau des chaines.
  ctx.fillStyle = FAINT;
  setFont(ctx, 700, 18, MONO);
  ctx.fillText(labels.statTime.toUpperCase(), PAD, 296);
  const totalText = formatDuration(model.totalSeconds);
  ctx.fillStyle = INK;
  setFittedFont(ctx, totalText, maxWidth, 800, 124, DISPLAY);
  ctx.fillText(totalText, PAD - 4, 402);

  const tilesBottom = drawTiles(ctx, model, 436, maxWidth);

  const platformsY = tilesBottom + 48;
  ctx.fillStyle = FAINT;
  setFont(ctx, 700, 16, MONO);
  ctx.fillText(labels.statPlatforms.toUpperCase(), PAD, platformsY);
  drawPlatformSplit(ctx, PAD, platformsY + 18, maxWidth, 16, model.platforms, model.totalSeconds, { legendSize: 20 });
}

function drawTopList(ctx, model, avatars) {
  const x = SPLIT_X;
  const y = 84;
  const w = CARD_WIDTH - PAD - SPLIT_X;
  const h = 640;
  drawPanel(ctx, x, y, w, h, 22);

  drawEyebrow(ctx, model.labels.topTitle, x + 36, y + 56, 18);

  const rows = model.top.slice(0, MAX_ROWS);
  const maxSeconds = rows[0]?.watchSeconds || 0;
  const rowTop = y + 92;
  const rowH = 76;
  const avatar = 48;

  rows.forEach((entry, i) => {
    const ry = rowTop + i * rowH;
    ctx.fillStyle = FAINT;
    setFont(ctx, 700, 22, MONO);
    ctx.textAlign = "right";
    ctx.fillText(String(i + 1).padStart(2, "0"), x + 70, ry + 34);
    ctx.textAlign = "left";

    drawAvatar(ctx, x + 88, ry + 2, avatar, entry.channel, avatars.get(`${entry.platform}:${entry.channel}`), entry.platform);

    const timeText = formatDuration(entry.watchSeconds);
    setFont(ctx, 700, 24);
    const timeWidth = ctx.measureText(timeText).width;
    ctx.fillStyle = INK;
    ctx.textAlign = "right";
    ctx.fillText(timeText, x + w - 36, ry + 30);
    ctx.textAlign = "left";

    ctx.fillStyle = INK;
    setFont(ctx, 600, 26);
    const nameX = x + 156;
    ctx.fillText(fitText(ctx, entry.channel, w - 156 - 36 - timeWidth - 24), nameX, ry + 30);

    const ratio = maxSeconds > 0 ? entry.watchSeconds / maxSeconds : 0;
    drawBar(ctx, nameX, ry + 44, w - 156 - 36, 10, ratio);
  });
}

/**
 * Dessine la carte PC complete.
 *
 * @param {CanvasRenderingContext2D} ctx contexte d'un canvas 1600x900
 * @param {object} model recap (buildRecap) + `labels` deja traduits
 * @param {{avatars?: Map<string, CanvasImageSource>, logo?: CanvasImageSource}} [assets]
 */
export function drawRecapCard(ctx, model, assets = {}) {
  const avatars = assets.avatars || new Map();
  drawBackground(ctx, CARD_WIDTH, CARD_HEIGHT);
  drawLeftColumn(ctx, model);
  drawTopList(ctx, model, avatars);
  drawBrand(ctx, assets.logo, PAD, CARD_HEIGHT - 54, { size: 44, nameSize: 30 });
}
