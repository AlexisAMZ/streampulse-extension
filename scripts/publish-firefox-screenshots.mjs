/**
 * Remplace les captures de la fiche Firefox Add-ons par celles du store.
 *
 *   npm run publish:firefox:screenshots              captures EN (défaut)
 *   npm run publish:firefox:screenshots -- --lang FR  captures d'un autre dossier
 *   npm run publish:firefox:screenshots -- --dry-run  affiche le plan, n'envoie rien
 *
 * Source : images/cws_screenshots/<LANG>/, dans l'ordre de la fiche Chrome.
 * AMO n'a qu'un jeu de captures par extension (pas une par langue) : on envoie
 * les nouvelles d'abord, puis on supprime les anciennes, pour que la fiche ne
 * reste jamais vide si un envoi échoue en route.
 *
 * Identifiants dans .env : AMO_JWT_ISSUER, AMO_JWT_SECRET. Jamais affichés.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fail, loadDotEnv, requireEnv } from "./lib/store-env.mjs";
import { SCREENSHOT_ORDER } from "./lib/listing-order.mjs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const lang = (args.includes("--lang") ? args[args.indexOf("--lang") + 1] : "EN").toUpperCase();

loadDotEnv();
const env = requireEnv(["AMO_JWT_ISSUER", "AMO_JWT_SECRET"]);
const API = "https://addons.mozilla.org/api/v5";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const FIREFOX_REPO = process.env.STREAMPULSE_FIREFOX_DIR || path.join(os.homedir(), "dev/StreampulseFirefox");
const firefoxManifest = JSON.parse(fs.readFileSync(path.join(FIREFOX_REPO, "manifest.json"), "utf8"));
const addonId = firefoxManifest.browser_specific_settings?.gecko?.id || fail("gecko.id absent du manifeste Firefox.");
const addonPath = `${API}/addons/addon/${encodeURIComponent(addonId)}`;

/** AMO veut un JWT HS256 neuf (jti unique, 5 min max) à chaque requête. */
function authHeader() {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = encode({ alg: "HS256", typ: "JWT" });
  const body = encode({ iss: env.AMO_JWT_ISSUER, jti: crypto.randomUUID(), iat: now, exp: now + 60 });
  const signature = crypto.createHmac("sha256", env.AMO_JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  return { Authorization: `JWT ${head}.${body}.${signature}` };
}

async function readJson(response, step) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) fail(`${step} refusé (HTTP ${response.status}) ${JSON.stringify(payload).slice(0, 400)}`);
  return payload;
}

function screenshotFiles() {
  const dir = path.join(ROOT, "images", "cws_screenshots", lang);
  if (!fs.existsSync(dir)) fail(`Dossier de captures introuvable : ${dir}`);
  const files = SCREENSHOT_ORDER.map((name) => path.join(dir, name));
  const missing = files.filter((file) => !fs.existsSync(file));
  if (missing.length) fail(`Captures manquantes : ${missing.map((f) => path.basename(f)).join(", ")}`);
  return files;
}

async function main() {
  const files = screenshotFiles();
  const addon = await readJson(await fetch(`${addonPath}/`, { headers: authHeader() }), "Lecture de la fiche");
  const oldPreviews = addon.previews || [];

  console.log(`Fiche Firefox ${addonId} : ${oldPreviews.length} capture(s) en ligne, ${files.length} à envoyer (${lang}).`);
  files.forEach((file, index) => console.log(`  ${index + 1}. ${path.basename(file)}`));
  if (dryRun) {
    console.log("--dry-run : rien n'a été envoyé.");
    return;
  }

  for (const [index, file] of files.entries()) {
    process.stdout.write(`Envoi ${path.basename(file)}`);
    const form = new FormData();
    form.append("image", new Blob([fs.readFileSync(file)], { type: "image/png" }), path.basename(file));
    form.append("position", String(index));
    await readJson(await fetch(`${addonPath}/previews/`, { method: "POST", headers: authHeader(), body: form }), "Envoi de capture");
    console.log(" ✓");
  }

  for (const preview of oldPreviews) {
    process.stdout.write(`Retrait de l'ancienne capture ${preview.id}`);
    const response = await fetch(`${addonPath}/previews/${preview.id}/`, { method: "DELETE", headers: authHeader() });
    if (!response.ok) fail(`Retrait refusé (HTTP ${response.status}) pour la capture ${preview.id}`);
    console.log(" ✓");
  }

  console.log("Captures Firefox à jour. Elles apparaissent sur la fiche après le passage de Mozilla.");
}

main().catch((error) => fail(error.message));
