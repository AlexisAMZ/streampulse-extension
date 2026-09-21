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
 * AMO limite severement les ecritures (429, fenetre longue de ~1 h). Les 11
 * langues partent donc dans UN SEUL PATCH : l'API fusionne les traductions,
 * elle ne les remplace pas. Une requete par langue epuisait le quota au bout
 * de trois.
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

/**
 * Nom de la fiche AMO, par langue. Il ne peut pas etre recopie du manifeste :
 * AMO plafonne ce champ a 50 caracteres et les noms du paquet montent a 67.
 * On garde donc la marque, les trois plateformes (c'est ce que les gens
 * cherchent) et le mot « alertes ». Points, Drops, apercus et filtres de tchat
 * vivent dans le resume, qui a 250 caracteres et est indexe lui aussi.
 * L'allemand dit « Live-Alerts » parce que c'est deja le mot employe par la
 * description allemande de l'extension.
 */
const NAMES = {
  fr: "StreamPulse : Alertes Twitch, Kick & YouTube",
  "en-US": "StreamPulse: Twitch, Kick & YouTube Alerts",
  "es-ES": "StreamPulse: Alertas Twitch, Kick y YouTube",
  "pt-BR": "StreamPulse: Alertas Twitch, Kick e YouTube",
  de: "StreamPulse: Live-Alerts Twitch, Kick & YouTube",
  it: "StreamPulse: Avvisi Twitch, Kick e YouTube",
  pl: "StreamPulse: Alerty Twitch, Kick i YouTube",
  tr: "StreamPulse: Twitch, Kick ve YouTube Bildirimleri",
  ru: "StreamPulse: Уведомления Twitch, Kick и YouTube",
  ja: "StreamPulse: Twitch・Kick・YouTube 通知",
  ko: "StreamPulse: Twitch, Kick, YouTube 알림",
};

const NAME_MAX = 50;
const SUMMARY_MAX = 250;

/** Code de langue AMO → dossier _locales du port (Chrome ecrit pt_BR, AMO pt-BR). */
const LOCALE_DIRS = {
  fr: "fr",
  "en-US": "en",
  "es-ES": "es",
  "pt-BR": "pt_BR",
  de: "de",
  it: "it",
  pl: "pl",
  tr: "tr",
  ru: "ru",
  ja: "ja",
  ko: "ko",
};

/**
 * Le resume vient de appDesc du port : une seule source pour la description
 * courte, celle que le navigateur affiche et celle que la fiche affiche.
 */
function summaryFor(locale) {
  const dir = LOCALE_DIRS[locale] || fail(`pas de dossier _locales pour ${locale}`);
  const file = path.join(FIREFOX_REPO, "_locales", dir, "messages.json");
  if (!fs.existsSync(file)) fail(`messages.json absent : ${file}`);
  const messages = JSON.parse(fs.readFileSync(file, "utf8"));
  const text = messages.appDesc?.message || fail(`appDesc absent dans ${file}`);
  if (text.includes("Chrome")) fail(`appDesc ${dir} parle de Chrome : a corriger dans le port.`);
  if (!text.includes("YouTube")) fail(`appDesc ${dir} ne mentionne pas YouTube : port incomplet.`);
  return text;
}

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

async function patchDescriptions(descriptions, name, summary) {
  const response = await fetch(`${API}/addons/addon/${encodeURIComponent(addonId)}/`, {
    method: "PATCH",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ description: descriptions, name, summary }),
  });
  if (response.ok) return { ok: true };
  const payload = await response.text().catch(() => "");
  return { ok: false, status: response.status, payload: payload.slice(0, 400) };
}

/** Relit la fiche langue par langue : seule preuve que l'ecriture a pris. */
async function readBack(locales) {
  const pick = (value, locale) => (typeof value === "string" ? value : (value || {})[locale] || "");
  const state = [];
  for (const locale of locales) {
    const response = await fetch(
      `${API}/addons/addon/${encodeURIComponent(addonId)}/?lang=${encodeURIComponent(locale)}`,
      { headers: authHeader() },
    );
    const payload = await response.json().catch(() => ({}));
    const description = pick(payload.description, locale);
    const name = pick(payload.name, locale);
    const summary = pick(payload.summary, locale);
    state.push({
      locale,
      // Le seul marqueur fiable des trois : la description doit parler de
      // Firefox, le nom et le resume doivent nommer YouTube.
      description: description.includes("Firefox"),
      name: name.includes("YouTube"),
      summary: summary.includes("YouTube"),
      length: description.length,
    });
  }
  return state;
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
      const name = NAMES[locale] || "(aucun)";
      const summary = summaryFor(locale);
      const flag = name.length > NAME_MAX || summary.length > SUMMARY_MAX ? "  ⚠ HORS LIMITE" : "";
      console.log(`  ${folder.padEnd(6)} → ${locale}`);
      console.log(`     nom      ${String(name.length).padStart(3)}/${NAME_MAX}   ${name}${flag}`);
      console.log(`     résumé   ${String(summary.length).padStart(3)}/${SUMMARY_MAX}  ${summary.slice(0, 60)}…`);
      console.log(`     descr.   ${String(text.length).padStart(3)}       ${text.includes("Firefox") ? "Firefox ✓" : "Chrome ✗"}`);
    }
    console.log("\nSimulation : rien n'a été envoyé. Relancer avec --write pour publier.");
    return;
  }

  const descriptions = Object.fromEntries(prepared.map(({ locale, text }) => [locale, text]));
  const names = {};
  const summaries = {};
  for (const { locale } of prepared) {
    const name = NAMES[locale] || fail(`pas de nom de fiche pour ${locale}`);
    if (name.length > NAME_MAX) fail(`nom ${locale} : ${name.length} caractères, AMO en accepte ${NAME_MAX}.`);
    if (!name.includes("YouTube")) fail(`nom ${locale} : YouTube manquant.`);
    const summary = summaryFor(locale);
    if (summary.length > SUMMARY_MAX) fail(`résumé ${locale} : ${summary.length} caractères, AMO en accepte ${SUMMARY_MAX}.`);
    names[locale] = name;
    summaries[locale] = summary;
  }

  const result = await patchDescriptions(descriptions, names, summaries);

  if (!result.ok) {
    if (result.status === 429) {
      const seconds = Number(/available in (\d+)/.exec(result.payload)?.[1]) || 0;
      const minutes = Math.ceil(seconds / 60);
      fail(
        `AMO limite les écritures : réessayer dans ${minutes} minute(s). ` +
          `Rien n'a été envoyé, la fiche est inchangée.`,
      );
    }
    fail(`Écriture refusée (HTTP ${result.status}) ${result.payload}`);
  }

  const state = await readBack(prepared.map(({ locale }) => locale));
  for (const entry of state) {
    const mark = (ok) => (ok ? "✓" : "✗");
    console.log(
      `  ${entry.locale.padEnd(6)} nom ${mark(entry.name)}  résumé ${mark(entry.summary)}  description ${mark(entry.description)} (${entry.length} car.)`,
    );
  }
  const missing = state.filter((e) => !(e.name && e.summary && e.description));
  if (missing.length) {
    fail(`${missing.length} langue(s) non confirmée(s) à la relecture : ${missing.map((e) => e.locale).join(", ")}`);
  }
  console.log("\nFiche mise à jour et relue. Vérifier sur addons.mozilla.org/developers.");
}

main().catch((error) => fail(error.message));
