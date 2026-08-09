/**
 * Ajoute le bloc `inject.*` à i18n/translations.js.
 *
 * Ces clés alimentent les content scripts (topbar, quickFollow, player, chat),
 * qui embarquaient jusqu'ici leurs propres tables inline limitées à 4 langues.
 * Les valeurs fr/en/es/pt-BR sont reprises telles quelles depuis ces tables :
 * elles ont été rédigées à la main, on ne les repasse pas à la machine.
 *
 * Les 12 autres langues reçoivent l'anglais et seront traduites par
 * scripts/translate-i18n.mjs.
 *
 * Idempotent : relancer ne duplique rien.
 */
import { readFile, writeFile } from "node:fs/promises";

const FILE = new URL("../i18n/translations.js", import.meta.url);

/** Valeurs déjà rédigées à la main dans les content scripts. */
const CURATED = {
  fr: {
    topbar: {
      previews: "Previews au survol",
      tip: "Offrir un Bubble Tea",
      settings: "Tous les réglages",
    },
    quickFollow: {
      add: "Ajouter à StreamPulse",
      tracked: "Suivi",
      remove: "Retirer de StreamPulse",
      added: "{{name}} ajouté à StreamPulse",
      removed: "{{name}} retiré de StreamPulse",
      error: "Action impossible. Réessayez.",
    },
    player: {
      skipToLive: "Rattraper le direct",
      holdToFastForward: "Maintenir pour avance x2",
      latencyEmpty: "Latence : --",
      latencyValue: "Latence : {{value}}s",
    },
  },
  en: {
    topbar: {
      previews: "Hover previews",
      tip: "Offer a Bubble Tea",
      settings: "All settings",
    },
    quickFollow: {
      add: "Add to StreamPulse",
      tracked: "Tracked",
      remove: "Remove from StreamPulse",
      added: "{{name}} added to StreamPulse",
      removed: "{{name}} removed from StreamPulse",
      error: "Action failed. Try again.",
    },
    player: {
      skipToLive: "Skip to live",
      holdToFastForward: "Hold to fast-forward x2",
      latencyEmpty: "Latency: --",
      latencyValue: "Latency: {{value}}s",
    },
  },
  es: {
    topbar: {
      previews: "Vistas previas",
      tip: "Invitar a un Bubble Tea",
      settings: "Ajustes",
    },
    quickFollow: {
      add: "Añadir a StreamPulse",
      tracked: "Siguiendo",
      remove: "Quitar de StreamPulse",
      added: "{{name}} añadido a StreamPulse",
      removed: "{{name}} eliminado de StreamPulse",
      error: "Acción fallida. Inténtalo de nuevo.",
    },
    player: {
      skipToLive: "Volver al directo",
      holdToFastForward: "Mantén pulsado para avanzar x2",
      latencyEmpty: "Latencia: --",
      latencyValue: "Latencia: {{value}}s",
    },
  },
  "pt-BR": {
    topbar: {
      previews: "Prévias ao passar",
      tip: "Pagar um Bubble Tea",
      settings: "Configurações",
    },
    quickFollow: {
      add: "Adicionar ao StreamPulse",
      tracked: "Seguindo",
      remove: "Remover do StreamPulse",
      added: "{{name}} adicionado ao StreamPulse",
      removed: "{{name}} removido do StreamPulse",
      error: "Falha na ação. Tente novamente.",
    },
    player: {
      skipToLive: "Voltar ao ao vivo",
      holdToFastForward: "Segure para avançar x2",
      latencyEmpty: "Latência: --",
      latencyValue: "Latência: {{value}}s",
    },
  },
};

const source = await readFile(FILE, "utf8");
const { translations, AVAILABLE_LANGUAGES } = await import(FILE.href);

let added = 0;
for (const { code } of AVAILABLE_LANGUAGES) {
  const block = translations[code];
  if (!block) throw new Error(`Bloc de langue manquant : ${code}`);
  if (block.inject) continue;
  // Repli sur l'anglais pour les langues pas encore rédigées à la main.
  block.inject = structuredClone(CURATED[code] ?? CURATED.en);
  added += 1;
}

/** Sérialise en littéral JS, en préservant les valeurs fonction. */
function serialize(value, depth = 1) {
  const pad = "  ".repeat(depth);
  const padEnd = "  ".repeat(depth - 1);
  if (typeof value === "function") {
    const src = value.toString().trim();
    return src
      .split("\n")
      .map((line, index) => (index === 0 ? line : `${padEnd}${line.replace(/^\s{0,10}/, "")}`))
      .join("\n");
  }
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[\n${value.map((v) => `${pad}${serialize(v, depth + 1)},`).join("\n")}\n${padEnd}]`;
  }
  const entries = Object.entries(value).map(([key, val]) => {
    const safeKey = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
    return `${pad}${safeKey}: ${serialize(val, depth + 1)},`;
  });
  return `{\n${entries.join("\n")}\n${padEnd}}`;
}

const marker = "export const translations = {";
const start = source.indexOf(marker);
if (start === -1) throw new Error("Objet translations introuvable.");

let depth = 0;
let end = -1;
for (let i = start + marker.length - 1; i < source.length; i += 1) {
  const char = source[i];
  if (char === "{") depth += 1;
  else if (char === "}") {
    depth -= 1;
    if (depth === 0) {
      end = i + 1;
      break;
    }
  }
}
if (end === -1) throw new Error("Accolade fermante introuvable.");

const ordered = {};
for (const { code } of AVAILABLE_LANGUAGES) ordered[code] = translations[code];

const output = `${source.slice(0, start)}export const translations = ${serialize(ordered, 1)};${source.slice(end)}`;
await writeFile(FILE, output, "utf8");

console.log(`Bloc inject.* ajouté à ${added} langue(s)`);
