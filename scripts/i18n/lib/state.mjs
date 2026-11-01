// Statut de chaque traduction, clé par clé : localization/status/<code>.json.
//
// Un enregistrement { status, src, val, by } retient l'empreinte du texte
// anglais (src) et celle de la traduction (val) au moment où le statut a été
// posé. Le statut réel se déduit en comparant ces empreintes aux fichiers :
//   - valeur absente                           → missing
//   - anglais changé, traduction intacte       → outdated
//   - traduction changée hors outillage        → pending (by: manual)
//   - sinon                                    → le statut enregistré
// Rien n'est donc à déclarer à la main : modifier en.js suffit à rendre les
// traductions concernées « outdated », et elles seules.

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { appendFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PATHS, fingerprint } from "./core.mjs";

export const STATUSES = ["missing", "pending", "reviewed", "approved", "outdated"];

/** Origines d'une traduction : qui a produit le texte actuel. */
export const ORIGINS = ["legacy", "manual", "deepl", "tm", "claude", "copy"];

/** Origines humaines : jamais écrasées automatiquement sans --include-human. */
export const HUMAN_ORIGINS = new Set(["legacy", "manual"]);

const statusFile = (code) => path.join(PATHS.statusDir, `${code}.json`);

export function readStatus(code) {
  const file = statusFile(code);
  if (!existsSync(file)) return {};
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  return parsed.entries ?? {};
}

/**
 * Écrit le fichier de statut, une clé par ligne (diffs lisibles), dans
 * l'ordre des clés attendues.
 */
export async function writeStatus(code, records, order) {
  mkdirSync(PATHS.statusDir, { recursive: true });
  const keys = [...new Set([...order, ...Object.keys(records)])].filter((k) => records[k]);
  const lines = keys.map((k) => `    ${JSON.stringify(k)}: ${JSON.stringify(records[k])}`);
  const body =
    `{\n  "$comment": "Généré par scripts/i18n. Statut et provenance de chaque traduction ${code} ; à modifier via npm run i18n:approve / i18n:sync, pas à la main.",\n` +
    `  "locale": ${JSON.stringify(code)},\n  "entries": {\n${lines.join(",\n")}\n  }\n}\n`;
  await writeFile(statusFile(code), body, "utf8");
}

/** Enregistrement à poser pour une valeur produite maintenant. */
export function record(status, source, value, by) {
  return { status, src: fingerprint(source), val: fingerprint(value), by };
}

/**
 * Statut réel de chaque clé attendue.
 * @returns {Map<string, {status, by, record, source, value, reason?}>}
 */
export function deriveStates(expected, values, records) {
  const states = new Map();
  for (const [key, entry] of expected) {
    const value = values.get(key);
    const rec = records[key];
    const base = { key, source: entry.source, value, record: rec, by: rec?.by ?? null, category: entry.category ?? null };
    if (value === undefined) {
      states.set(key, { ...base, status: "missing" });
    } else if (!rec || rec.status === "missing") {
      states.set(key, { ...base, status: "pending", by: "manual", reason: "valeur sans historique (ajoutée à la main)" });
    } else if (rec.val !== fingerprint(value)) {
      states.set(key, { ...base, status: "pending", by: "manual", reason: `modifiée hors outillage (était ${rec.status})` });
    } else if (rec.src !== fingerprint(entry.source)) {
      const was = rec.status === "outdated" ? rec.was : rec.status;
      states.set(key, { ...base, status: "outdated", was, reason: `l'anglais a changé (était ${was})` });
    } else {
      states.set(key, { ...base, status: rec.status });
    }
  }
  return states;
}

/**
 * Enregistrements correspondant aux statuts déduits : ce que i18n:sync
 * écrit. Une clé outdated garde l'empreinte de l'ANCIEN anglais pour le
 * rester tant que personne ne l'a retraduite ou confirmée.
 */
export function recordsFromStates(states) {
  const out = {};
  for (const [key, s] of states) {
    if (s.status === "missing") continue;
    if (s.status === "outdated") {
      out[key] = { ...s.record, status: "outdated", was: s.was };
    } else if (s.by === "manual" && s.reason) {
      out[key] = record("pending", s.source, s.value, "manual");
    } else {
      out[key] = s.record;
    }
  }
  return out;
}

export function countStatuses(states) {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const s of states.values()) counts[s.status]++;
  return counts;
}

/** Ajoute des événements au journal localization/history.jsonl. */
export async function logHistory(events) {
  if (!events.length) return;
  const at = new Date().toISOString();
  const lines = events.map((e) => JSON.stringify({ at, ...e })).join("\n");
  await appendFile(PATHS.history, `${lines}\n`, "utf8");
}

/** Ajoute une ligne de consommation DeepL à localization/usage.jsonl. */
export async function logUsage(entry) {
  await appendFile(PATHS.usage, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`, "utf8");
}

export function readUsage() {
  if (!existsSync(PATHS.usage)) return [];
  return readFileSync(PATHS.usage, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
