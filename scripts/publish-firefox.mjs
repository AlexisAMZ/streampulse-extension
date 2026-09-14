/**
 * Publie le zip Firefox de la version courante sur addons.mozilla.org (API v5, canal listed).
 *
 *   npm run publish:firefox
 *
 * Le zip vient du dépôt ~/dev/StreampulseFirefox (npm run build là-bas).
 * Identifiants dans .env : AMO_JWT_ISSUER, AMO_JWT_SECRET. Jamais affichés.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fail, loadDotEnv, poll, readVersion, requireEnv, requireZip } from "./lib/store-env.mjs";

loadDotEnv();
const env = requireEnv(["AMO_JWT_ISSUER", "AMO_JWT_SECRET"]);
const API = "https://addons.mozilla.org/api/v5";
const FIREFOX_REPO = process.env.STREAMPULSE_FIREFOX_DIR || path.join(os.homedir(), "dev/StreampulseFirefox");
const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX_REPO, "manifest.json"), "utf8"));
const addonId = manifest.browser_specific_settings?.gecko?.id || fail("gecko.id absent du manifeste Firefox.");
const version = readVersion(FIREFOX_REPO);
const zipPath = requireZip(`StreampulseFirefox_${version}.zip`);

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

async function main() {
  console.log(`StreamPulse ${version} → Firefox Add-ons (${addonId})`);
  process.stdout.write("Envoi du zip");
  const form = new FormData();
  form.append("upload", new Blob([fs.readFileSync(zipPath)], { type: "application/zip" }), path.basename(zipPath));
  form.append("channel", "listed");
  const upload = await readJson(await fetch(`${API}/addons/upload/`, { method: "POST", headers: authHeader(), body: form }), "Envoi du zip");

  process.stdout.write(" validation");
  const validated = await poll(
    async () => {
      const check = await readJson(await fetch(`${API}/addons/upload/${upload.uuid}/`, { headers: authHeader() }), "Validation");
      return check.processed ? check : null;
    },
    { step: "Validation Mozilla" },
  );
  if (!validated.valid) {
    const messages = (validated.validation?.messages || []).filter((m) => m.type === "error").map((m) => m.message);
    fail(`Validation Mozilla en échec : ${messages.join(" · ") || "voir addons.mozilla.org"}`);
  }
  console.log(" ✓");

  process.stdout.write("Création de la version");
  await readJson(
    await fetch(`${API}/addons/addon/${encodeURIComponent(addonId)}/versions/`, {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ upload: upload.uuid }),
    }),
    "Création de la version",
  );
  console.log(" ✓\nEnvoyée en review Mozilla. Suivi sur addons.mozilla.org/developers.");
}

main().catch((error) => fail(error.message));
