#!/usr/bin/env node
/**
 * Génère les voix off des TikTok StreamPulse avec ElevenLabs.
 *
 *   ELEVENLABS_API_KEY=... node promo/tiktok-voix/generer-voix.mjs --liste
 *       Affiche des voix françaises de la bibliothèque (nom, id, écoute).
 *   ELEVENLABS_API_KEY=... node promo/tiktok-voix/generer-voix.mjs --voix <voice_id>
 *       Génère les 5 mp3 dans promo/tiktok-voix/sortie/.
 *   Ajouter --seulement 03 pour ne refaire qu'une vidéo.
 *
 * La clé n'est lue que dans l'environnement, jamais écrite dans un fichier.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, "sortie");
const API = "https://api.elevenlabs.io/v1";
const MODEL = "eleven_multilingual_v2";

/* Réglages pensés pour une voix qui sonne parlée et non lue : stabilité basse
   (plus d'intonation), style modéré, speaker boost pour le rendu sur téléphone. */
const VOICE_SETTINGS = {
  stability: 0.35,
  similarity_boost: 0.8,
  style: 0.3,
  use_speaker_boost: true,
};

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : (args[i + 1] ?? true);
};

const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error("ELEVENLABS_API_KEY manquante dans l'environnement.");
  process.exit(1);
}

async function listerVoix() {
  const url = `${API}/shared-voices?language=fr&page_size=30&sort=trending`;
  const res = await fetch(url, { headers: { "xi-api-key": key } });
  if (!res.ok) throw new Error(`Liste des voix : HTTP ${res.status} ${await res.text()}`);
  const { voices } = await res.json();
  for (const v of voices) {
    console.log(`${v.name} | ${v.gender ?? "?"} | ${v.age ?? "?"} | ${v.use_case ?? "?"}`);
    console.log(`  public_owner_id=${v.public_owner_id} voice_id=${v.voice_id}`);
    console.log(`  écoute : ${v.preview_url}`);
  }
}

async function generer(voiceId) {
  const { videos } = JSON.parse(fs.readFileSync(path.join(DIR, "scripts.json"), "utf8"));
  const seulement = flag("--seulement");
  fs.mkdirSync(OUT, { recursive: true });

  for (const video of videos) {
    if (seulement && !video.id.startsWith(String(seulement))) continue;
    const res = await fetch(`${API}/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        text: video.texte,
        model_id: MODEL,
        language_code: "fr",
        voice_settings: VOICE_SETTINGS,
      }),
    });
    if (!res.ok) throw new Error(`${video.id} : HTTP ${res.status} ${await res.text()}`);
    const file = path.join(OUT, `${video.id}.mp3`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log(`OK ${file}`);
  }
}

try {
  if (flag("--liste")) await listerVoix();
  else if (typeof flag("--voix") === "string") await generer(flag("--voix"));
  else console.error("Utilisation : --liste, ou --voix <voice_id> [--seulement 03]");
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
