// Mise en page paysage 1600x900 (format Twitter) de la carte de recap.

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

export const CARD_WIDTH = 1600;
export const CARD_HEIGHT = 900;

const ROW_TOP = 286;
const ROW_HEIGHT = 62;
const MAX_ROWS = 8;
const FOOTER_TOP = CARD_HEIGHT - 100;
const ROW_LEFT = 84;
const ROW_RIGHT = 1516;
const AVATAR_SIZE = 46;

function drawHeader(ctx, model) {
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  ctx.fillStyle = GREEN;
  ctx.font = "700 20px ui-monospace, Menlo, monospace";
  ctx.fillText("MON ZEVENT 2026", ROW_LEFT, 108);

  ctx.fillStyle = INK;
  ctx.font = "800 64px -apple-system, Segoe UI, Roboto, sans-serif";
  const heading = model.pseudo ? `${model.pseudo}, voici ton ZEvent.` : "Voici mon ZEvent.";
  ctx.fillText(heading, ROW_LEFT, 178);

  ctx.fillStyle = MUTED;
  ctx.font = "400 24px -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText(
    `${formatHours(model.totalSeconds)} de stream · ${model.streamerCount} streamer${model.streamerCount > 1 ? "s" : ""} du ZEvent · septembre 2026`,
    ROW_LEFT,
    222
  );
}

/** Bandeau de la cagnotte finale, a droite de l'en-tete. */
function drawHeaderDonation(ctx, amountLabel) {
  const w = 420;
  const h = 104;
  drawDonationBadge(ctx, ROW_RIGHT - w, 84, w, h, amountLabel);
}

function drawRow(ctx, entry, index, maxSeconds, image) {
  const y = ROW_TOP + index * ROW_HEIGHT;

  ctx.fillStyle = FAINT;
  ctx.font = "700 26px ui-monospace, Menlo, monospace";
  ctx.textAlign = "right";
  ctx.fillText(String(index + 1).padStart(2, "0"), ROW_LEFT + 34, y + 32);
  ctx.textAlign = "left";

  drawAvatar(ctx, ROW_LEFT + 52, y, AVATAR_SIZE, entry.channel, image);

  ctx.fillStyle = INK;
  ctx.font = "600 27px -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText(entry.channel, ROW_LEFT + 116, y + 32);

  // Barre proportionnelle au plus regarde, pour que le premier remplisse la ligne.
  const barLeft = 620;
  const barRight = ROW_RIGHT - 170;
  const barWidth = barRight - barLeft;
  const ratio = maxSeconds > 0 ? entry.watchSeconds / maxSeconds : 0;

  drawBar(ctx, barLeft, y + 14, barWidth, 18, ratio);

  ctx.fillStyle = INK;
  ctx.font = "700 25px -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(formatHours(entry.watchSeconds), ROW_RIGHT, y + 32);
  ctx.textAlign = "left";
}

function drawFooter(ctx, logo, zeventLogo) {
  const y = FOOTER_TOP;

  if (logo) ctx.drawImage(logo, ROW_LEFT, y, 44, 44);

  ctx.fillStyle = INK;
  ctx.font = "800 30px -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText("StreamPulse", ROW_LEFT + (logo ? 58 : 0), y + 32);

  ctx.fillStyle = FAINT;
  ctx.font = "400 20px -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText("streampulse.fr", ROW_LEFT + (logo ? 58 : 0) + 195, y + 32);

  if (zeventLogo) {
    const h = 96;
    const w = (zeventLogo.width / zeventLogo.height) * h;
    ctx.drawImage(zeventLogo, ROW_RIGHT - w, y - 26, w, h);
  }
}

/**
 * Dessine la carte complete.
 *
 * @param {CanvasRenderingContext2D} ctx contexte d'un canvas 1600x900
 * @param {object} model recap issu de buildRecap, plus `pseudo` et `donationLabel`
 * @param {{avatars?: Map<string, CanvasImageSource>, logo?: CanvasImageSource,
 *          zeventLogo?: CanvasImageSource}} [assets] images deja chargees
 */
export function drawRecapCard(ctx, model, assets = {}) {
  const avatars = assets.avatars || new Map();

  drawBackground(ctx, CARD_WIDTH, CARD_HEIGHT);
  drawHeader(ctx, model);
  if (model.donationLabel) drawHeaderDonation(ctx, model.donationLabel);

  const rows = model.top.slice(0, MAX_ROWS);
  const maxSeconds = rows.length > 0 ? rows[0].watchSeconds : 0;
  rows.forEach((entry, index) => {
    drawRow(ctx, entry, index, maxSeconds, avatars.get(entry.channel));
  });

  drawFooter(ctx, assets.logo, assets.zeventLogo);
}
