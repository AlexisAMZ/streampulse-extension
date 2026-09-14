/**
 * Publie le zip de la version courante sur Microsoft Edge Add-ons (Publish API v1.1).
 *
 *   npm run publish:edge                    envoie le zip puis soumet la publication
 *   npm run publish:edge -- --upload-only   envoie le zip dans le brouillon, sans soumettre
 *   npm run publish:edge -- --notes "texte" notes pour les testeurs Microsoft
 *
 * La clé API ne vit que dans le Trousseau macOS (service « streampulse-edge-api »),
 * ou dans la variable EDGE_API_KEY en CI. Elle n'est jamais écrite ni affichée.
 * Le Client ID et le Product ID ne sont pas secrets.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

/**
 * Lit .env à la racine (ignoré par git, exclu du zip). Les valeurs peuvent être
 * entre apostrophes : la clé Edge contient des # et des % qu'un parseur naïf couperait.
 */
function loadDotEnv() {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match || process.env[match[1]]) continue;
    let value = match[2];
    const quoted = /^'(.*)'$/.exec(value) || /^"(.*)"$/.exec(value);
    if (quoted) value = quoted[1];
    process.env[match[1]] = value;
  }
}
loadDotEnv();

const API = "https://api.addons.microsoftedge.microsoft.com/v1";
const KEYCHAIN_SERVICE = "streampulse-edge-api";
const CLIENT_ID = process.env.EDGE_CLIENT_ID || "4b2f6308-5803-4481-aba6-ceec7d63d964";
const PRODUCT_ID = process.env.EDGE_PRODUCT_ID || "";
const POLL_MS = 5000;
const POLL_LIMIT = 60;
const args = process.argv.slice(2);
const uploadOnly = args.includes("--upload-only");
const notesIndex = args.indexOf("--notes");
const version = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8")).version;
const notes = notesIndex !== -1 ? String(args[notesIndex + 1] || "") : `StreamPulse ${version}. No new permissions.`;
const zipDir = process.env.STREAMPULSE_ZIP_DIR || path.join(os.homedir(), "Desktop/dev/ZIPS");
const zipPath = path.join(zipDir, `StreamPulseExtension_${version}.zip`);

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function readApiKey() {
  if (process.env.EDGE_API_KEY) return process.env.EDGE_API_KEY;
  try {
    return execFileSync("security", ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function headers(apiKey, extra = {}) {
  return { Authorization: `ApiKey ${apiKey}`, "X-ClientID": CLIENT_ID, ...extra };
}

/** L'API renvoie l'identifiant de l'opération dans l'en-tête Location. */
function operationIdFrom(response) {
  const location = response.headers.get("location") || "";
  return location.split("/").filter(Boolean).pop() || "";
}

async function expectAccepted(response, step) {
  if (response.status === 202) return operationIdFrom(response);
  const body = await response.text().catch(() => "");
  fail(`${step} refusé (HTTP ${response.status}) ${body.slice(0, 400)}`);
  return "";
}

async function waitFor(url, apiKey, step) {
  for (let attempt = 0; attempt < POLL_LIMIT; attempt += 1) {
    const response = await fetch(url, { headers: headers(apiKey) });
    const payload = await response.json().catch(() => ({}));
    const status = payload.status || "";
    if (status === "Succeeded") return payload;
    if (status === "Failed") {
      const detail = (payload.errors || []).map((e) => e.message || JSON.stringify(e)).join(" · ");
      fail(`${step} en échec : ${payload.message || ""} ${detail}`.trim());
    }
    process.stdout.write(".");
    await sleep(POLL_MS);
  }
  fail(`${step} : pas de réponse finale après ${(POLL_LIMIT * POLL_MS) / 1000} s. Vérifier dans Partner Center.`);
  return null;
}

async function main() {
  if (!PRODUCT_ID) fail("EDGE_PRODUCT_ID manquant : Partner Center → Microsoft Edge → extension → Product ID.");
  if (!fs.existsSync(zipPath)) fail(`Zip introuvable : ${zipPath}. Lancer npm run build d'abord.`);
  const apiKey = readApiKey();
  if (!apiKey) fail(`Clé API absente du Trousseau (service ${KEYCHAIN_SERVICE}). Voir la commande d'ajout dans CHROMEWEBSTORE.md.`);

  console.log(`StreamPulse ${version} → Edge Add-ons`);
  process.stdout.write("Envoi du zip");
  const upload = await fetch(`${API}/products/${PRODUCT_ID}/submissions/draft/package`, {
    method: "POST",
    headers: headers(apiKey, { "Content-Type": "application/zip" }),
    body: fs.readFileSync(zipPath),
  });
  const uploadId = await expectAccepted(upload, "Envoi du zip");
  await waitFor(`${API}/products/${PRODUCT_ID}/submissions/draft/package/operations/${uploadId}`, apiKey, "Envoi du zip");
  console.log(" ✓");

  if (uploadOnly) {
    console.log("Brouillon mis à jour. Soumission à faire depuis Partner Center, ou relancer sans --upload-only.");
    return;
  }

  process.stdout.write("Soumission à la publication");
  const publish = await fetch(`${API}/products/${PRODUCT_ID}/submissions`, {
    method: "POST",
    headers: headers(apiKey, { "Content-Type": "application/json" }),
    body: JSON.stringify({ notes }),
  });
  const publishId = await expectAccepted(publish, "Soumission");
  await waitFor(`${API}/products/${PRODUCT_ID}/submissions/operations/${publishId}`, apiKey, "Soumission");
  console.log(" ✓\nEnvoyée en certification Microsoft. Suivi dans Partner Center.");
}

main().catch((error) => fail(error.message));
