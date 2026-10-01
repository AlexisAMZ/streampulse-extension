// Export et import CSV de l'historique : journal des points et Drops obtenus.
// Pur : aucune dépendance au navigateur, tout est testable.

import { dayKey } from "./recap-data.js";

const BOM = "\uFEFF"; // Excel lit les accents avec le BOM UTF-8.

/** Échappe une valeur pour CSV : guillemets doublés si séparateur, quote ou fin de ligne. */
function escapeField(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Analyse un CSV complet : guillemets, virgules dans les champs, CRLF. Retourne
 * un tableau de lignes (tableaux de cellules) ; la première ligne est l'en-tête.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const source = String(text ?? "").replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  row.push(field);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

/** Lignes CSV d'un historique de Drops : date,nom,jeu,chaîne,récupération. */
export function dropsHistoryCsv(history) {
  const rows = [...(Array.isArray(history) ? history : [])].sort((a, b) => b.at - a.at)
    .map((entry) => [new Date(entry.at).toISOString(), entry.name || "", entry.game || "", entry.channel || "", entry.auto ? "auto" : "manuel"]);
  return BOM + [["date", "name", "game", "channel", "claim"], ...rows].map((row) => row.map(escapeField).join(",")).join("\n");
}

/** Lignes CSV du journal de points : date,chaîne,raison,points. */
export function pointsJournalCsv(journal, channels = {}) {
  const nameOf = (channelId) => String((channels[channelId] || {}).name || channelId || "");
  const rows = [...(Array.isArray(journal) ? journal : [])].sort((a, b) => b.at - a.at)
    .map((entry) => [new Date(entry.at).toISOString(), nameOf(entry.channelId), entry.reason || "OTHER", Number(entry.points) || 0]);
  return BOM + [["date", "channel", "reason", "points"], ...rows].map((row) => row.map(escapeField).join(",")).join("\n");
}

function rowToObject(header, row) {
  const entry = {};
  header.forEach((key, index) => { entry[key] = row[index]; });
  return entry;
}

const dateOf = (value) => {
  const at = Date.parse(String(value || ""));
  return Number.isFinite(at) ? at : 0;
};

/**
 * Relit un CSV exporté (points, Drops ou mêlé) en entrées prêtes à fusionner :
 * { drops: historyEntry[], gains: gain[] }. Les lignes invalides sont jetées
 * silencieusement : un CSV est une copie, pas une source de vérité.
 */
export function importFromCsv(text) {
  const rows = parseCsv(text);
  const result = { drops: [], gains: [] };
  if (!rows.length) return result;
  const header = rows[0].map((key) => key.trim().toLowerCase());
  const claimIndex = header.indexOf("claim");
  for (const row of rows.slice(1)) {
    const entry = rowToObject(header, row);
    if (header.includes("points")) {
      const at = dateOf(entry.date);
      const points = Number(entry.points);
      if (!at || !Number.isFinite(points) || points < 0) continue;
      result.gains.push({
        key: `csv:${at}:${entry.channel || "?"}:${entry.reason || "OTHER"}:${points}`,
        at,
        day: dayKey(new Date(at)),
        channelId: "",
        reason: "OTHER",
        rawReason: entry.reason || "",
        points: Math.round(points),
        base: Math.round(points),
        factor: 1,
        channelName: entry.channel || "",
      });
      continue;
    }
    const at = dateOf(entry.date);
    if (!at || !entry.name) continue;
    result.drops.push({
      key: `csv:${at}:${entry.name}`,
      dropId: "",
      instanceId: "",
      benefitIds: [],
      name: entry.name,
      game: entry.game || "",
      image: "",
      channel: entry.channel || "",
      at,
      auto: claimIndex >= 0 ? entry.claim === "auto" : false,
    });
  }
  return result;
}
