// Primitives de dessin partagees par les deux formats de carte de recap.
// Aucune mise en page ici : uniquement des briques reutilisables.

export const PURPLE = "#7d2fe0";
export const GREEN = "#00e676";
export const INK = "#efeff1";
export const MUTED = "#b9b6c4";
export const FAINT = "#8a8697";

/** Palette stable par pseudo : deux personnes n'ont pas la meme pastille. */
export function colorForChannel(channel) {
  let hash = 0;
  for (let i = 0; i < channel.length; i++) {
    hash = (hash * 31 + channel.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360} 58% 45%)`;
}

export function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Fond commun : violet en haut a gauche, fondu vers le noir. */
export function drawBackground(ctx, width, height) {
  ctx.fillStyle = "#0a0a0e";
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.15, 0, 0, width * 0.15, 0, height * 0.9);
  glow.addColorStop(0, "rgba(42, 19, 82, 0.95)");
  glow.addColorStop(0.55, "rgba(20, 16, 28, 0.6)");
  glow.addColorStop(1, "rgba(10, 10, 14, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Pastille d'avatar : l'image si elle a pu etre chargee sans contaminer le
 * canvas, sinon l'initiale sur un fond colore.
 */
export function drawAvatar(ctx, x, y, size, channel, image) {
  const radius = size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (image) {
    ctx.drawImage(image, x, y, size, size);
  } else {
    ctx.fillStyle = colorForChannel(channel);
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${Math.round(size * 0.46)}px -apple-system, Segoe UI, Roboto, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((channel[0] || "?").toUpperCase(), x + radius, y + radius + 1);
  }
  ctx.restore();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

/** Barre de progression degradee, commune aux deux formats. */
export function drawBar(ctx, x, y, width, height, ratio) {
  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fill();

  const fill = ctx.createLinearGradient(x, 0, x + width, 0);
  fill.addColorStop(0, GREEN);
  fill.addColorStop(1, PURPLE);
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, Math.max(height, width * ratio), height, height / 2);
  ctx.fill();
}

/** Encadre "cagnotte finale", dimensionne par l'appelant. */
export function drawDonationBadge(ctx, x, y, w, h, amountLabel, { labelSize = 15, valueSize = 40 } = {}) {
  ctx.fillStyle = "rgba(0, 230, 118, 0.1)";
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 230, 118, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = FAINT;
  ctx.font = `700 ${labelSize}px ui-monospace, Menlo, monospace`;
  ctx.fillText("CAGNOTTE FINALE", x + w / 2, y + h * 0.36);

  ctx.fillStyle = GREEN;
  ctx.font = `800 ${valueSize}px -apple-system, Segoe UI, Roboto, sans-serif`;
  ctx.fillText(amountLabel, x + w / 2, y + h * 0.8);
  ctx.textAlign = "left";
}
