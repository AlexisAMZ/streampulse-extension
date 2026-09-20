#!/usr/bin/env node
/**
 * Rendu déterministe 60 FPS pour CapCut & TikTok (StreamPulse).
 * Génère 750 images fluides (12.5s à 60 FPS) sans aucune saccade ni freeze de la barre de progression.
 * Fond vert Chroma Key pur (#00FF00) sans aucun halo d'ombre.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROMO_DIR = path.join(ROOT, "promo", "tiktok-capcut");
const OUT_DIR = path.join(PROMO_DIR, "output");
const AUDIO_FILE = path.join(PROMO_DIR, "assets", "notification.mp3");

const CHROME_BIN =
  process.env.CHROME_BIN ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const PORT = 8765;

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".woff2": "font/woff2",
};

async function main() {
  console.log("🚀 Lancement du rendu déterministe 60 FPS (750 frames)...");
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sp-frames-"));

  let framesReceived = 0;
  let doneResolver;
  const donePromise = new Promise((resolve) => {
    doneResolver = resolve;
  });

  // Serveur HTTP local pour streaming des frames et fichiers statiques
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

    if (url.pathname === "/frame" && req.method === "POST") {
      const isDone = url.searchParams.get("done") === "true";
      if (isDone) {
        res.writeHead(200);
        res.end("ok");
        doneResolver();
        return;
      }

      const frameIdx = parseInt(url.searchParams.get("f"), 10);
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const buf = Buffer.concat(chunks);
        const fileName = `frame_${String(frameIdx).padStart(4, "0")}.jpg`;
        fs.writeFileSync(path.join(tempDir, fileName), buf);
        framesReceived++;
        if (framesReceived % 150 === 0) {
          console.log(`⏱ Rendu : ${framesReceived} / 750 frames (${((framesReceived / 750) * 100).toFixed(0)}%)...`);
        }
        res.writeHead(200);
        res.end("ok");
      });
      return;
    }

    // Servir les fichiers de PROMO_DIR ou ROOT (fontes)
    let filePath = path.join(PROMO_DIR, url.pathname);
    if (url.pathname.startsWith("/font/")) {
      filePath = path.join(ROOT, url.pathname);
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));

  // Lancer Chrome headless pour exécuter le rendu
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sp-chrome-"));
  const chromeProcess = spawn(
    CHROME_BIN,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profile}`,
      `http://127.0.0.1:${PORT}/render-canvas.html?auto=true&port=${PORT}`,
    ],
    { stdio: "ignore" }
  );

  // Attendre la fin des 750 frames
  await donePromise;

  chromeProcess.kill("SIGKILL");
  server.close();
  try {
    fs.rmSync(profile, { recursive: true, force: true });
  } catch (err) {
    void err;
  }

  console.log(`🎬 Encodage MP4 à partir de ${framesReceived} frames réelles à 60 FPS...`);
  const outMp4 = path.join(OUT_DIR, "streampulse_overlay_greenscreen_12s.mp4");
  fs.rmSync(outMp4, { force: true });

  const ffmpegArgs = [
    "-y",
    "-framerate", "60",
    "-i", path.join(tempDir, "frame_%04d.jpg"),
    "-i", AUDIO_FILE,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-t", "12.5",
    "-c:a", "aac",
    "-b:a", "192k",
    outMp4,
  ];

  await run("/opt/homebrew/bin/ffmpeg", ffmpegArgs);

  // Nettoyage temporaire
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (err) {
    void err;
  }

  console.log("✅ Vidéo MP4 60 FPS générée avec succès, 100% fluide, sans freeze de la barre !");
  console.log(`Livrable : ${outMp4}`);
}

main().catch((err) => {
  console.error("❌ Erreur pendant le rendu :", err);
  process.exit(1);
});
