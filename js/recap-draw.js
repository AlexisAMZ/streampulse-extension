// Primitives de dessin partagees par les deux formats de recap (PC et mobile).
// Aucune mise en page ici : uniquement des briques reutilisables.

export const VIOLET = "#9146ff";
export const VIOLET_LIGHT = "#c4a3ff";
export const INK = "#f4f2f7";
export const MUTED = "#c0b9d2";
export const FAINT = "#8f88a6";
export const LCD = "#c6d4a0";
// Fonts of streampulse.fr, bundled with the extension (css/tokens.css).
export const SANS = "Onest, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
export const DISPLAY = "Unbounded, Onest, -apple-system, 'Segoe UI', sans-serif";
export const MONO = SANS;

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
/** Reduit la police jusqu'a ce que le texte tienne (le nom d'une chaine longue), sans descendre sous minSize. */
export function setFittedFont(ctx, text, maxWidth, weight, size, family = SANS, minSize = Math.round(size * 0.55)) {
  let current = size;
  setFont(ctx, weight, current, family);
  while (current > minSize && ctx.measureText(String(text)).width > maxWidth) {
    current -= 2;
    setFont(ctx, weight, current, family);
  }
  return current;
}

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

/** Fond commun : bleu nuit du site, halo violet en haut a gauche, reflet vert LCD en bas a droite. */
export function drawBackground(ctx, width, height) {
  ctx.fillStyle = "#0b0c22";
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.1, 0, 0, width * 0.1, 0, Math.max(width, height) * 0.8);
  glow.addColorStop(0, "rgba(145, 70, 255, 0.55)");
  glow.addColorStop(0.5, "rgba(70, 30, 150, 0.22)");
  glow.addColorStop(1, "rgba(11, 12, 34, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(width, height, 0, width, height, Math.max(width, height) * 0.5);
  glow2.addColorStop(0, "rgba(198, 212, 160, 0.12)");
  glow2.addColorStop(1, "rgba(11, 12, 34, 0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);
}

/** Panneau vitre : fond translucide et bordure fine. */
export function drawPanel(ctx, x, y, w, h, radius = 18) {
  ctx.fillStyle = "rgba(21, 23, 61, 0.86)";
  roundRect(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
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
  fill.addColorStop(1, LCD);
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
  ctx.fillStyle = LCD;
  setFont(ctx, 700, size, SANS);
  ctx.fillText(String(text).toUpperCase(), x, y);
}

/** Logo + nom de marque + url. Renvoie la largeur occupee. */
export function drawBrand(ctx, logo, x, y, { size = 44, nameSize = 30, align = "left", width = 0 } = {}) {
  // Logo + adresse du site : le nom StreamPulse n'est ecrit qu'une fois sur la carte.
  const name = "streampulse.fr";
  setFont(ctx, 700, nameSize, DISPLAY);
  const nameWidth = ctx.measureText(name).width;
  const gap = 16;
  const total = (logo ? size + gap : 0) + nameWidth;
  const startX = align === "center" ? x + (width - total) / 2 : x;

  if (logo) ctx.drawImage(logo, startX, y - size * 0.78, size, size);
  ctx.fillStyle = INK;
  ctx.fillText(name, startX + (logo ? size + gap : 0), y);
  return total;
}
