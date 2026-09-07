// Mise en page portrait 1080x1920 (story Instagram) de la carte de recap.

import { formatHours } from "./recap-data.js";
import {
  GREEN,
  INK,
  MUTED,
  FAINT,
  drawAvatar,
  drawBackground,
  drawBar,
  drawDonationBadge,
} from "./recap-draw.js";

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

// Les stories sont rognees par l'interface d'Instagram en haut et en bas :
// tout le contenu utile reste dans la zone sure.
const SAFE_TOP = 380;

const LEFT = 84;
const RIGHT = STORY_WIDTH - 84;
const MAX_ROWS = 6;
const ROW_HEIGHT = 108;
const AVATAR_SIZE = 64;

function drawZEventLogo(ctx, logo) {
  if (!logo) return;
  const w = 420;
  const h = (logo.height / logo.width) * w;
  ctx.drawImage(logo, (STORY_WIDTH - w) / 2, SAFE_TOP - h - 24, w, h);
}

function drawHeader(ctx, model) {
  ctx.textAlign = "center";

  ctx.fillStyle = GREEN;
  ctx.font = "700 26px ui-monospace, Menlo, monospace";
  ctx.fillText("MON ZEVENT 2026", STORY_WIDTH / 2, SAFE_TOP + 34);

  ctx.fillStyle = INK;
  ctx.font = "800 62px -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText(model.pseudo || "Mon récap", STORY_WIDTH / 2, SAFE_TOP + 116);

  // Le total est le chiffre que l'on retient : il occupe le haut de la story.
  ctx.fillStyle = INK;
  ctx.font = "800 132px -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText(formatHours(model.totalSeconds), STORY_WIDTH / 2, SAFE_TOP + 262);

  ctx.fillStyle = MUTED;
  ctx.font = "400 30px -apple-system, Segoe UI, Roboto, sans-serif";
  const plural = model.streamerCount > 1 ? "s" : "";
  ctx.fillText(
    `de stream chez ${model.streamerCount} streamer${plural} du ZEvent`,
    STORY_WIDTH / 2,
    SAFE_TOP + 312
  );

  ctx.textAlign = "left";
}

function drawRow(ctx, entry, index, maxSeconds, top, image) {
  const y = top + index * ROW_HEIGHT;

  ctx.fillStyle = FAINT;
  ctx.font = "700 30px ui-monospace, Menlo, monospace";
  ctx.textAlign = "right";
  ctx.fillText(String(index + 1).padStart(2, "0"), LEFT + 38, y + 42);
  ctx.textAlign = "left";

  drawAvatar(ctx, LEFT + 60, y + 8, AVATAR_SIZE, entry.channel, image);

  ctx.fillStyle = INK;
  ctx.font = "600 34px -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText(entry.channel, LEFT + 144, y + 40);

  ctx.fillStyle = INK;
  ctx.font = "700 32px -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(formatHours(entry.watchSeconds), RIGHT, y + 40);
  ctx.textAlign = "left";

  const ratio = maxSeconds > 0 ? entry.watchSeconds / maxSeconds : 0;
  drawBar(ctx, LEFT + 144, y + 60, RIGHT - LEFT - 144, 16, ratio);
}

function drawFooter(ctx, logo, y) {
  ctx.textAlign = "center";

  const label = "StreamPulse";
  ctx.font = "800 34px -apple-system, Segoe UI, Roboto, sans-serif";
  const textWidth = ctx.measureText(label).width;
  const logoSize = logo ? 44 : 0;
  const totalWidth = textWidth + (logo ? logoSize + 16 : 0);
  const startX = (STORY_WIDTH - totalWidth) / 2;

  if (logo) ctx.drawImage(logo, startX, y - 34, logoSize, logoSize);

  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.fillText(label, startX + (logo ? logoSize + 16 : 0), y);

  ctx.fillStyle = FAINT;
  ctx.font = "400 24px -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("streampulse.fr · septembre 2026", STORY_WIDTH / 2, y + 42);
  ctx.textAlign = "left";
}

/**
 * Dessine la story complete.
 *
 * @param {CanvasRenderingContext2D} ctx contexte d'un canvas 1080x1920
 * @param {object} model recap issu de buildRecap, plus `pseudo` et `donationLabel`
 * @param {{avatars?: Map<string, CanvasImageSource>, logo?: CanvasImageSource,
 *          zeventLogo?: CanvasImageSource}} [assets] images deja chargees
 */
export function drawRecapStory(ctx, model, assets = {}) {
  const avatars = assets.avatars || new Map();

  drawBackground(ctx, STORY_WIDTH, STORY_HEIGHT);
  drawZEventLogo(ctx, assets.zeventLogo);
  drawHeader(ctx, model);

  const rows = model.top.slice(0, MAX_ROWS);
  const rowsTop = SAFE_TOP + 396;
  const maxSeconds = rows.length > 0 ? rows[0].watchSeconds : 0;
  rows.forEach((entry, index) => {
    drawRow(ctx, entry, index, maxSeconds, rowsTop, avatars.get(entry.channel));
  });

  let bottom = rowsTop + rows.length * ROW_HEIGHT;

  if (model.donationLabel) {
    const w = 520;
    const h = 132;
    const y = bottom + 40;
    drawDonationBadge(ctx, (STORY_WIDTH - w) / 2, y, w, h, model.donationLabel, {
      labelSize: 20,
      valueSize: 52,
    });
    bottom = y + h;
  }

  drawFooter(ctx, assets.logo, bottom + 70);
}
