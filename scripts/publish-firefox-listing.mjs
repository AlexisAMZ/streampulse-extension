/**
 * Met à jour les descriptions de la fiche Firefox sur addons.mozilla.org (API v5).
 *
 *   node scripts/publish-firefox-listing.mjs            # simulation, n'écrit rien
 *   node scripts/publish-firefox-listing.mjs --write    # écrit pour de bon
 *
 * Contrairement au Chrome Web Store, l'API AMO accepte les textes de fiche.
 * Les descriptions viennent de ~/Desktop/dev/ZIPS/chrome-kit/<LANGUE>/description.txt :
 * elles sont écrites pour Chrome, donc la ligne sur la mise en veille des
 * onglets dit « Chrome ». Une occurrence par langue, remplacée ici par
 * « Firefox ». Le script refuse d'écrire s'il n'en trouve pas exactement une,
 * plutôt que d'envoyer un texte faux sur une page publique.
 *
 * Identifiants dans .env : AMO_JWT_ISSUER, AMO_JWT_SECRET. Jamais affichés.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fail, loadDotEnv, requireEnv } from "./lib/store-env.mjs";

loadDotEnv();
const env = requireEnv(["AMO_JWT_ISSUER", "AMO_JWT_SECRET"]);
const API = "https://addons.mozilla.org/api/v5";
const WRITE = process.argv.includes("--write");

const FIREFOX_REPO =
  process.env.STREAMPULSE_FIREFOX_DIR || path.join(os.homedir(), "dev/StreampulseFirefox");
const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX_REPO, "manifest.json"), "utf8"));
const addonId =
  manifest.browser_specific_settings?.gecko?.id || fail("gecko.id absent du manifeste Firefox.");

const KIT = path.join(os.homedir(), "Desktop/dev/ZIPS/chrome-kit");

/** Dossier du kit → code de langue AMO. AMO refuse un code inconnu en 400. */
const LOCALES = {
  FR: "fr",
  EN: "en-US",
  ES: "es-ES",
  "PT-BR": "pt-BR",
  DE: "de",
  IT: "it",
  PL: "pl",
  TR: "tr",
  RU: "ru",
  JA: "ja",
  KO: "ko",
};

/** Repli quand AMO refuse le code principal (es-ES vs es selon les comptes). */
const FALLBACK = { "es-ES": "es" };

/** AMO veut un JWT HS256 neuf (jti unique) à chaque requête. */
function authHeader() {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = encode({ alg: "HS256", typ: "JWT" });
  const body = encode({ iss: env.AMO_JWT_ISSUER, jti: crypto.randomUUID(), iat: now, exp: now + 60 });
  const signature = crypto
    .createHmac("sha256", env.AMO_JWT_SECRET)
    .update(`${head}.${body}`)
    .digest("base64url");
  return { Authorization: `JWT ${head}.${body}.${signature}` };
}

/**
 * Le texte du kit parle de Chrome sur la ligne de mise en veille des onglets.
 * Exactement une occurrence attendue : zéro veut dire que le kit a changé de
 * forme, plus d'une veut dire qu'une autre phrase parle du navigateur et que la
 * substitution aveugle serait fausse. Les deux cas arrêtent le script.
 */
function toFirefox(text, folder) {
  const hits = text.match(/Chrome/g) || [];
  if (hits.length !== 1) {
    fail(`${folder}/description.txt : ${hits.length} occurrence(s) de « Chrome », 1 attendue. Kit à revoir.`);
  }
  return text.replace("Chrome", "Firefox");
}

async function patchDescription(locale, text) {
  const response = await fetch(`${API}/addons/addon/${encodeURIComponent(addonId)}/`, {
    method: "PATCH",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ description: { [locale]: text } }),
  });
  if (response.ok) return { ok: true };
  const payload = await response.text().catch(() => "");
  return { ok: false, status: response.status, payload: payload.slice(0, 300) };
}

async function main() {
  const prepared = Object.entries(LOCALES).map(([folder, locale]) => {
    const file = path.join(KIT, folder, "description.txt");
    if (!fs.existsSync(file)) fail(`description absente : ${file}`);
    return { folder, locale, text: toFirefox(fs.readFileSync(file, "utf8").trim(), folder) };
  });

  console.log(`StreamPulse → fiche Firefox (${addonId})`);
  console.log(`${prepared.length} langues, « Chrome » remplacé par « Firefox » dans chacune.`);

  if (!WRITE) {
    for (const { folder, locale, text } of prepared) {
      const line = text.split("\n").find((l) => l.includes("Firefox")) || "";
      console.log(`  ${folder.padEnd(6)} → ${locale.padEnd(6)} ${text.length} caractères | ${line.trim().slice(0, 70)}`);
    }
    console.log("\nSimulation : rien n'a été envoyé. Relancer avec --write pour publier.");
    return;
  }

  let failures = 0;
  for (const { folder, locale, text } of prepared) {
    let result = await patchDescription(locale, text);
    if (!result.ok && FALLBACK[locale]) {
      console.log(`  ${folder.padEnd(6)} ${locale} refusé, essai avec ${FALLBACK[locale]}`);
      result = await patchDescription(FALLBACK[locale], text);
    }
    if (result.ok) {
      console.log(`  ${folder.padEnd(6)} ✓`);
    } else {
      failures += 1;
      console.log(`  ${folder.padEnd(6)} ✗ HTTP ${result.status} ${result.payload}`);
    }
  }
  if (failures) fail(`${failures} langue(s) en échec. La fiche est partiellement à jour.`);
  console.log("\nFiche mise à jour. Vérifier sur addons.mozilla.org/developers.");
}

main().catch((error) => fail(error.message));
