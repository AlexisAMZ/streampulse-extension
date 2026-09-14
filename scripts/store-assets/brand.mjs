/**
 * Charte partagée par tous les visuels promo (store, tuile, X) : la même que
 * streampulse.fr et que le popup. Navy profond, violet Twitch, vert LCD,
 * Unbounded pour les titres, Onest pour le texte, logo en blanc sans fond.
 *
 * Les polices sont celles embarquées dans font/, chargées en file:// par
 * Chrome headless : le rendu ne dépend donc pas des polices du système.
 */

import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "./config.mjs";

export const COLORS = {
  bg: "#0b0c22",
  surface: "#15173d",
  surface2: "#1e2150",
  line: "rgba(255, 255, 255, 0.08)",
  line2: "rgba(255, 255, 255, 0.14)",
  text: "#f4f3ff",
  text2: "#b9b7d6",
  text3: "#8583a8",
  violet: "#9146ff",
  violetText: "#c4a6ff",
  lcd: "#c6d4a0",
  lcdInk: "#1c2615",
  kick: "#53fc18",
};

const font = (name) => pathToFileURL(path.join(ROOT, "font", name)).href;

export const FONT_CSS = `
@font-face { font-family: "Unbounded"; font-weight: 400 900; src: url("${font("unbounded-latin-10.woff2")}") format("woff2"); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2212; }
@font-face { font-family: "Unbounded"; font-weight: 400 900; src: url("${font("unbounded-latin-ext-9.woff2")}") format("woff2"); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1E00-1E9F, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: "Unbounded"; font-weight: 400 900; src: url("${font("unbounded-cyrillic-8.woff2")}") format("woff2"); unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116; }
@font-face { font-family: "Onest"; font-weight: 400 700; src: url("${font("onest-latin-6.woff2")}") format("woff2"); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2212; }
@font-face { font-family: "Onest"; font-weight: 400 700; src: url("${font("onest-latin-ext-5.woff2")}") format("woff2"); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1E00-1E9F, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: "Onest"; font-weight: 400 700; src: url("${font("onest-cyrillic-4.woff2")}") format("woff2"); unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116; }
`;

/** Unbounded n'a pas de glyphes CJK : repli sur les polices système. */
export const DISPLAY = `"Unbounded", "Hiragino Sans", "Apple SD Gothic Neo", "PingFang SC", sans-serif`;
export const BODY = `"Onest", "Hiragino Sans", "Apple SD Gothic Neo", "PingFang SC", -apple-system, sans-serif`;

export const RESET = `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { overflow: hidden; }`;

/** Fond commun : navy, halo violet en haut à gauche, lueur verte LCD à droite. */
export function backdrop(width, height) {
  return `
html, body { width: ${width}px; height: ${height}px; }
body {
  overflow: hidden;
  position: relative;
  background:
    radial-gradient(${Math.round(width * 0.7)}px ${Math.round(height * 0.8)}px at 0% 0%, rgba(145, 70, 255, 0.34), transparent 64%),
    radial-gradient(${Math.round(width * 0.5)}px ${Math.round(height * 0.6)}px at 100% 100%, rgba(198, 212, 160, 0.10), transparent 62%),
    ${COLORS.bg};
  color: ${COLORS.text};
  font-family: ${BODY};
  -webkit-font-smoothing: antialiased;
}
body > * { position: relative; z-index: 1; }
`;
}

/** Logo blanc, sans pastille ni contour. */
export const LOGO_CSS = "filter: brightness(0) invert(1); object-fit: contain; display: block;";

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
