// Mise en page PC : paysage 1600x900 (16:9), adaptee a X, Discord ou un fond d'ecran.

import { formatDuration } from "./recap-data.js";
import {
  INK,
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
} from "./recap-draw.js";

export const CARD_WIDTH = 1600;
export const CARD_HEIGHT = 900;

const PAD = 84;
const SPLIT_X = 760;
const MAX_ROWS = 7;

function drawLeftColumn(ctx, model) {
  const { labels } = model;
  const maxWidth = SPLIT_X - PAD - 60;

  drawEyebrow(ctx, labels.eyebrow, PAD, 112, 20);

  ctx.fillStyle = INK;
  setFont(ctx, 800, 58);
  ctx.fillText(fitText(ctx, labels.heading, maxWidth), PAD, 186);

  ctx.fillStyle = MUTED;
  setFont(ctx, 500, 26);
  ctx.fillText(fitText(ctx, labels.period, maxWidth), PAD, 232);

  // Le total est le chiffre que l'on retient.
  ctx.fillStyle = FAINT;
  setFont(ctx, 700, 18, MONO);
  ctx.fillText(labels.statTime.toUpperCase(), PAD, 330);
  ctx.fillStyle = INK;
  setFont(ctx, 800, 124);
  ctx.fillText(formatDuration(model.totalSeconds), PAD - 4, 450);

  // Deux tuiles : nombre de chaines et chaine favorite.
  const tileY = 500;
  const tileH = 128;
  const tileW = (maxWidth - 20) / 2;
  const tiles = [
    { label: labels.statChannels, value: String(model.streamerCount) },
    { label: labels.statTop, value: model.top[0]?.channel || "—" },
  ];
  tiles.forEach((tile, i) => {
    const x = PAD + i * (tileW + 20);
    drawPanel(ctx, x, tileY, tileW, tileH, 16);
    ctx.fillStyle = FAINT;
    setFont(ctx, 700, 16, MONO);
    ctx.fillText(fitText(ctx, tile.label.toUpperCase(), tileW - 48), x + 24, tileY + 42);
    ctx.fillStyle = INK;
    setFont(ctx, 800, 44);
    ctx.fillText(fitText(ctx, tile.value, tileW - 48), x + 24, tileY + 100);
  });

  ctx.fillStyle = FAINT;
  setFont(ctx, 700, 16, MONO);
  ctx.fillText(labels.statPlatforms.toUpperCase(), PAD, 690);
  drawPlatformSplit(ctx, PAD, 708, maxWidth, 16, model.platforms, model.totalSeconds, { legendSize: 20 });
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
  drawBrand(ctx, assets.logo, PAD, CARD_HEIGHT - 70, { size: 44, nameSize: 30, urlSize: 20 });
}
