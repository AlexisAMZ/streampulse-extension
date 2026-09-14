/** Outils communs aux scripts de publication : .env, zip de la version, attente. */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
export const ZIP_DIR = process.env.STREAMPULSE_ZIP_DIR || path.join(os.homedir(), "Desktop/dev/ZIPS");

/** Lit .env à la racine sans écraser l'environnement ; accepte les valeurs entre apostrophes. */
export function loadDotEnv() {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match || process.env[match[1]]) continue;
    const quoted = /^'(.*)'$/.exec(match[2]) || /^"(.*)"$/.exec(match[2]);
    process.env[match[1]] = quoted ? quoted[1] : match[2];
  }
}

export function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

export function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) fail(`Champs vides dans .env : ${missing.join(", ")}`);
  return Object.fromEntries(names.map((name) => [name, process.env[name]]));
}

export function readVersion(manifestDir = ROOT) {
  return JSON.parse(fs.readFileSync(path.join(manifestDir, "manifest.json"), "utf8")).version;
}

export function requireZip(fileName) {
  const zipPath = path.join(ZIP_DIR, fileName);
  if (!fs.existsSync(zipPath)) fail(`Zip introuvable : ${zipPath}. Lancer npm run build d'abord.`);
  return zipPath;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Répète check() jusqu'à ce qu'il renvoie une valeur non nulle, avec un point par essai. */
export async function poll(check, { every = 5000, tries = 60, step = "Opération" } = {}) {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const result = await check();
    if (result) return result;
    process.stdout.write(".");
    await sleep(every);
  }
  fail(`${step} : pas de réponse finale après ${(every * tries) / 1000} s.`);
  return null;
}
