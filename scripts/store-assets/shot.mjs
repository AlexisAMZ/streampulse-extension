/**
 * Capture d'écran via Chrome headless, puis redimensionnement avec `sips`.
 *
 * Le rendu se fait à `SCALE`x la taille cible avant réduction : le texte et les
 * bordures 1px restent nets une fois ramenés aux dimensions imposées par le
 * Chrome Web Store.
 */

import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CHROME_BIN, SCALE } from "./config.mjs";

const run = promisify(execFile);

/** Délai maximal accordé à Chrome pour écrire une capture. */
const CAPTURE_TIMEOUT_MS = 45_000;
const POLL_INTERVAL_MS = 120;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sizeOrNull(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return null;
  }
}

/**
 * Supprime le profil temporaire de Chrome.
 *
 * Les processus auxiliaires survivent quelques instants au SIGKILL du parent et
 * continuent d'écrire dans le dossier : `rm -rf` échoue alors sur ENOTEMPTY. On
 * réessaie, puis on abandonne en silence — c'est un dossier de /tmp, le laisser
 * traîner est sans conséquence, alors qu'échouer interromprait la génération.
 */
async function removeProfile(profile) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.rmSync(profile, { recursive: true, force: true });
      return;
    } catch {
      await sleep(200);
    }
  }
}

export function assertChromeAvailable() {
  if (!fs.existsSync(CHROME_BIN)) {
    throw new Error(
      `Chrome introuvable : ${CHROME_BIN}\n` +
        "Définissez CHROME_BIN sur le binaire Chrome/Chromium à utiliser.",
    );
  }
}

/**
 * @param {object} options
 * @param {string} options.htmlPath  fichier local à rendre
 * @param {string} options.outPath   PNG produit
 * @param {number} options.width     largeur CSS
 * @param {number} options.height    hauteur CSS
 */
export async function capture({ htmlPath, outPath, width, height }) {
  fs.rmSync(outPath, { force: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sp-shot-"));

  const child = spawn(
    CHROME_BIN,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      `--user-data-dir=${profile}`,
      `--force-device-scale-factor=${SCALE}`,
      `--window-size=${width},${height}`,
      `--screenshot=${outPath}`,
      `file://${htmlPath}`,
    ],
    { stdio: "ignore" },
  );

  // Chrome écrit le PNG puis reste en vie plusieurs minutes sur ces pages
  // (animations CSS infinies du popup). On attend que le fichier soit complet,
  // taille stable sur deux relevés, puis on coupe le processus nous-mêmes.
  try {
    const deadline = Date.now() + CAPTURE_TIMEOUT_MS;
    let previousSize = null;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      const size = sizeOrNull(outPath);
      if (size !== null && size > 0 && size === previousSize) return;
      previousSize = size;
    }
    throw new Error(
      `Chrome n'a produit aucune capture pour ${htmlPath} en ${CAPTURE_TIMEOUT_MS / 1000}s`,
    );
  } finally {
    child.kill("SIGKILL");
    await removeProfile(profile);
  }
}

/** Réduit un PNG aux dimensions exactes demandées (sips, fourni avec macOS). */
export async function resizeExact(filePath, width, height) {
  await run("sips", [
    "--resampleHeightWidth",
    String(height),
    String(width),
    filePath,
    "--out",
    filePath,
  ]);
}

/**
 * Réécrit un PNG en RVB 24 bits sans canal alpha.
 *
 * Chrome produit toujours du RGBA (PNG type 6) ; la tuile promotionnelle du
 * Chrome Web Store doit être en 24 bits sans transparence. On compose sur du
 * noir opaque, ce qui est neutre puisque le fond du visuel est déjà opaque.
 */
export async function flattenToRgb(filePath) {
  await run("python3", [
    "-c",
    [
      "import sys",
      "from PIL import Image",
      "src = Image.open(sys.argv[1]).convert('RGBA')",
      "flat = Image.new('RGB', src.size, (0, 0, 0))",
      "flat.paste(src, mask=src.split()[3])",
      "flat.save(sys.argv[1], 'PNG')",
    ].join("\n"),
    filePath,
  ]);
}

/** Renvoie le mode PIL du fichier ("RGB", "RGBA"…) — vérification du 24 bits. */
export async function colorMode(filePath) {
  const { stdout } = await run("python3", [
    "-c",
    "import sys\nfrom PIL import Image\nprint(Image.open(sys.argv[1]).mode)",
    filePath,
  ]);
  return stdout.trim();
}

/** Renvoie `{width, height}` en pixels réels — sert de vérification finale. */
export async function pixelSize(filePath) {
  const { stdout } = await run("sips", [
    "-g",
    "pixelWidth",
    "-g",
    "pixelHeight",
    filePath,
  ]);
  const width = Number(/pixelWidth:\s*(\d+)/.exec(stdout)?.[1]);
  const height = Number(/pixelHeight:\s*(\d+)/.exec(stdout)?.[1]);
  return { width, height };
}
