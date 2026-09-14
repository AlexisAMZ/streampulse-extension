/**
 * Publie le zip de la version courante sur le Chrome Web Store (API v1.1).
 *
 *   npm run publish:chrome                    envoie le zip puis soumet la publication
 *   npm run publish:chrome -- --upload-only   envoie le zip dans le brouillon, sans soumettre
 *
 * Identifiants dans .env : CWS_EXTENSION_ID, CWS_CLIENT_ID, CWS_CLIENT_SECRET,
 * CWS_REFRESH_TOKEN (généré par scripts/cws-refresh-token.mjs). Jamais affichés.
 */

import fs from "node:fs";
import { fail, loadDotEnv, poll, readVersion, requireEnv, requireZip } from "./lib/store-env.mjs";

loadDotEnv();
const env = requireEnv(["CWS_EXTENSION_ID", "CWS_CLIENT_ID", "CWS_CLIENT_SECRET", "CWS_REFRESH_TOKEN"]);
const uploadOnly = process.argv.includes("--upload-only");
const version = readVersion();
const zipPath = requireZip(`StreamPulseExtension_${version}.zip`);
const ITEM_URL = `https://www.googleapis.com/chromewebstore/v1.1/items/${env.CWS_EXTENSION_ID}`;
const UPLOAD_URL = `https://www.googleapis.com/upload/chromewebstore/v1.1/items/${env.CWS_EXTENSION_ID}`;

async function accessToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: env.CWS_CLIENT_ID,
      client_secret: env.CWS_CLIENT_SECRET,
      refresh_token: env.CWS_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!payload.access_token) fail(`Jeton Google refusé : ${payload.error || response.status}. Relancer scripts/cws-refresh-token.mjs.`);
  return payload.access_token;
}

function describeErrors(payload) {
  const items = payload.itemError || payload.error?.errors || [];
  return items.map((e) => e.error_detail || e.message || JSON.stringify(e)).join(" · ") || payload.error?.message || "";
}

async function main() {
  const token = await accessToken();
  const headers = { Authorization: `Bearer ${token}`, "x-goog-api-version": "2" };

  console.log(`StreamPulse ${version} → Chrome Web Store`);
  process.stdout.write("Envoi du zip");
  const upload = await fetch(UPLOAD_URL, { method: "PUT", headers, body: fs.readFileSync(zipPath) });
  const uploaded = await upload.json().catch(() => ({}));
  if (uploaded.uploadState === "FAILURE" || !upload.ok) fail(`Envoi refusé (HTTP ${upload.status}) ${describeErrors(uploaded)}`);
  if (uploaded.uploadState === "IN_PROGRESS") {
    await poll(
      async () => {
        const check = await (await fetch(`${ITEM_URL}?projection=DRAFT`, { headers })).json().catch(() => ({}));
        if (check.uploadState === "FAILURE") fail(`Envoi en échec : ${describeErrors(check)}`);
        return check.uploadState === "SUCCESS" ? check : null;
      },
      { step: "Envoi du zip" },
    );
  }
  console.log(" ✓");

  if (uploadOnly) {
    console.log("Brouillon mis à jour. Soumission à faire depuis la devconsole, ou relancer sans --upload-only.");
    return;
  }

  process.stdout.write("Soumission à la publication");
  const publish = await fetch(`${ITEM_URL}/publish`, { method: "POST", headers: { ...headers, "Content-Length": "0" } });
  const published = await publish.json().catch(() => ({}));
  const status = published.status || [];
  if (!publish.ok || !status.some((s) => s === "OK" || s === "ITEM_PENDING_REVIEW")) {
    fail(`Soumission refusée (HTTP ${publish.status}) ${status.join(", ")} ${(published.statusDetail || []).join(" · ")} ${describeErrors(published)}`.trim());
  }
  console.log(" ✓\nEnvoyée en review Google. Suivi dans la devconsole.");
}

main().catch((error) => fail(error.message));
