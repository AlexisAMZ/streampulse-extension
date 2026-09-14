/**
 * Génère le refresh token de l'API Chrome Web Store et l'écrit dans .env.
 *
 *   node scripts/cws-refresh-token.mjs
 *
 * Lit CWS_CLIENT_ID et CWS_CLIENT_SECRET dans .env, ouvre la page de consentement
 * Google, récupère le code sur un serveur local éphémère, puis remplace la ligne
 * CWS_REFRESH_TOKEN. Aucun secret n'est affiché.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ENV_FILE = path.join(ROOT, ".env");
const SCOPE = "https://www.googleapis.com/auth/chromewebstore";

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function readEnv() {
  if (!fs.existsSync(ENV_FILE)) fail(".env introuvable.");
  const values = {};
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const quoted = /^'(.*)'$/.exec(match[2]) || /^"(.*)"$/.exec(match[2]);
    values[match[1]] = (quoted ? quoted[1] : match[2]).trim();
  }
  return values;
}

function writeRefreshToken(token) {
  const lines = fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/);
  const index = lines.findIndex((line) => /^\s*CWS_REFRESH_TOKEN\s*=/.test(line));
  const entry = `CWS_REFRESH_TOKEN='${token}'`;
  const next = index === -1 ? [...lines, entry] : lines.map((line, i) => (i === index ? entry : line));
  fs.writeFileSync(ENV_FILE, next.join("\n"));
}

const env = readEnv();
const clientId = env.CWS_CLIENT_ID;
const clientSecret = env.CWS_CLIENT_SECRET;
if (!clientId || !clientSecret) fail("CWS_CLIENT_ID ou CWS_CLIENT_SECRET vide dans .env.");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(code ? "<h2>C'est bon, tu peux fermer cet onglet.</h2>" : `<h2>Refusé : ${error || "aucun code"}</h2>`);
  server.close();
  if (!code) fail(`Autorisation refusée (${error || "aucun code"}).`);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!payload.refresh_token) fail(`Google n'a pas renvoyé de refresh token : ${payload.error || response.status} ${payload.error_description || ""}`);
  writeRefreshToken(payload.refresh_token);
  console.log(`✓ CWS_REFRESH_TOKEN écrit dans .env (${payload.refresh_token.length} caractères).`);
});

let redirectUri = "";
server.listen(0, "127.0.0.1", () => {
  redirectUri = `http://127.0.0.1:${server.address().port}/callback`;
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  })}`;
  console.log("Ouverture de Google… connecte-toi avec le compte du Chrome Web Store et accepte.");
  execFileSync("open", [authUrl]);
});
