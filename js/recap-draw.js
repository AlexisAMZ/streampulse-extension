// Primitives de dessin partagees par les deux formats de recap (PC et mobile).
// Aucune mise en page ici : uniquement des briques reutilisables.

export const VIOLET = "#9146ff";
export const VIOLET_LIGHT = "#b98cff";
export const INK = "#efeff1";
export const MUTED = "#b9b6c4";
export const FAINT = "#8a8697";
export const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
export const MONO = "ui-monospace, Menlo, Consolas, monospace";

export const PLATFORM_COLORS = {
  twitch: "#9146ff",
  kick: "#53fc18",
};

export function platformColor(platform) {
  return PLATFORM_COLORS[platform] || FAINT;
}

/** Palette stable par pseudo : deux chaines n'ont pas la meme pastille. */
export function colorForChannel(channel) {
  let hash = 0;
  for (let i = 0; i < channel.length; i++) {
    hash = (hash * 31 + channel.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360} 58% 45%)`;
}

export function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function setFont(ctx, weight, size, family = SANS) {
  ctx.font = `${weight} ${size}px ${family}`;
}

/** Tronque avec une ellipse pour tenir dans maxWidth (police deja posee). */
export function fitText(ctx, text, maxWidth) {
  const value = String(text ?? "");
  if (ctx.measureText(value).width <= maxWidth) return value;
  let lo = 0;
  let hi = value.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${value.slice(0, mid)}…`).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return `${value.slice(0, lo)}…`;
}

/** Fond commun : halo violet en haut a gauche, halo plus discret en bas a droite. */
export function drawBackground(ctx, width, height) {
  ctx.fillStyle = "#0a0a0e";
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.12, 0, 0, width * 0.12, 0, Math.max(width, height) * 0.75);
  glow.addColorStop(0, "rgba(98, 38, 196, 0.85)");
  glow.addColorStop(0.45, "rgba(40, 18, 80, 0.55)");
  glow.addColorStop(1, "rgba(10, 10, 14, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(width, height, 0, width, height, Math.max(width, height) * 0.55);
  glow2.addColorStop(0, "rgba(145, 70, 255, 0.22)");
  glow2.addColorStop(1, "rgba(10, 10, 14, 0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  // Grille tres legere, rappel du design de l'extension.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.025)";
  ctx.lineWidth = 1;
  const step = 60;
  ctx.beginPath();
  for (let x = step; x < width; x += step) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
  }
  for (let y = step; y < height; y += step) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
  }
  ctx.stroke();
}

/** Panneau vitre : fond translucide et bordure fine. */
export function drawPanel(ctx, x, y, w, h, radius = 18) {
  ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
  roundRect(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.09)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/**
 * Pastille d'avatar : l'image si elle a pu etre chargee sans contaminer le
 * canvas, sinon l'initiale sur un fond colore. Liseré a la couleur de la plateforme.
 */
export function drawAvatar(ctx, x, y, size, channel, image, platform) {
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
    setFont(ctx, 700, Math.round(size * 0.46));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((channel[0] || "?").toUpperCase(), x + radius, y + radius + 1);
  }
  ctx.restore();

  if (platform) {
    ctx.beginPath();
    ctx.arc(x + radius, y + radius, radius + 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = platformColor(platform);
    ctx.lineWidth = Math.max(2, size * 0.05);
    ctx.stroke();
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

/** Barre de progression degradee. */
export function drawBar(ctx, x, y, width, height, ratio) {
  ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fill();

  const fill = ctx.createLinearGradient(x, 0, x + width, 0);
  fill.addColorStop(0, VIOLET);
  fill.addColorStop(1, VIOLET_LIGHT);
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, Math.max(height, width * Math.min(1, ratio)), height, height / 2);
  ctx.fill();
}

/** Barre segmentee de repartition par plateforme, avec legende dessous. */
export function drawPlatformSplit(ctx, x, y, width, height, platforms, totalSeconds, { legendSize = 20 } = {}) {
  const parts = Object.entries(platforms || {})
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);

  ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fill();

  ctx.save();
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.clip();
  let cursor = x;
  for (const [platform, seconds] of parts) {
    const w = totalSeconds > 0 ? (seconds / totalSeconds) * width : 0;
    ctx.fillStyle = platformColor(platform);
    ctx.fillRect(cursor, y, w, height);
    cursor += w;
  }
  ctx.restore();

  let legendX = x;
  const legendY = y + height + legendSize + 14;
  for (const [platform, seconds] of parts) {
    const pct = totalSeconds > 0 ? Math.round((seconds / totalSeconds) * 100) : 0;
    const label = `${platform.charAt(0).toUpperCase()}${platform.slice(1)} ${pct}%`;
    ctx.fillStyle = platformColor(platform);
    ctx.beginPath();
    ctx.arc(legendX + legendSize * 0.35, legendY - legendSize * 0.35, legendSize * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = MUTED;
    setFont(ctx, 600, legendSize);
    ctx.fillText(label, legendX + legendSize, legendY);
    legendX += legendSize + ctx.measureText(label).width + legendSize * 1.4;
  }
}

/** Petite etiquette en capitales, style console. */
export function drawEyebrow(ctx, text, x, y, size) {
  ctx.fillStyle = VIOLET_LIGHT;
  setFont(ctx, 700, size, MONO);
  ctx.fillText(String(text).toUpperCase(), x, y);
}

/** Logo + nom de marque + url. Renvoie la largeur occupee. */
export function drawBrand(ctx, logo, x, y, { size = 44, nameSize = 30, urlSize = 20, align = "left", width = 0 } = {}) {
  setFont(ctx, 800, nameSize);
  const nameWidth = ctx.measureText("StreamPulse").width;
  setFont(ctx, 400, urlSize);
  const urlWidth = ctx.measureText("streampulse.fr").width;
  const gap = 16;
  const total = (logo ? size + gap : 0) + nameWidth + gap + urlWidth;
  const startX = align === "center" ? x + (width - total) / 2 : x;

  if (logo) ctx.drawImage(logo, startX, y - size * 0.78, size, size);
  const textX = startX + (logo ? size + gap : 0);
  ctx.fillStyle = INK;
  setFont(ctx, 800, nameSize);
  ctx.fillText("StreamPulse", textX, y);
  ctx.fillStyle = FAINT;
  setFont(ctx, 400, urlSize);
  ctx.fillText("streampulse.fr", textX + nameWidth + gap, y);
  return total;
}
