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
/** Attente maximale des vraies données dans la page avant d'abandonner une tentative. */
const READY_TIMEOUT_MS = 12_000;

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
 * réessaie, puis on abandonne en silence : c'est un dossier de /tmp, le laisser
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
 * @param {string} [options.htmlPath] fichier local à rendre
 * @param {string} [options.url]      ou page servie en http (modules ES, harness)
 * @param {string} options.outPath    PNG produit
 * @param {number} options.width      largeur CSS
 * @param {number} options.height     hauteur CSS
 * @param {number} [options.budgetMs] temps laissé à la page pour se dessiner
 */
export async function capture({ htmlPath, url, outPath, width, height, budgetMs }) {
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
      ...(budgetMs ? [`--virtual-time-budget=${budgetMs}`, "--run-all-compositor-stages-before-draw"] : []),
      url || `file://${htmlPath}`,
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
      `Chrome n'a produit aucune capture pour ${url || htmlPath} en ${CAPTURE_TIMEOUT_MS / 1000}s`,
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

/** Renvoie le mode PIL du fichier ("RGB", "RGBA"…) : vérification du 24 bits. */
export async function colorMode(filePath) {
  const { stdout } = await run("python3", [
    "-c",
    "import sys\nfrom PIL import Image\nprint(Image.open(sys.argv[1]).mode)",
    filePath,
  ]);
  return stdout.trim();
}

/** Renvoie `{width, height}` en pixels réels : sert de vérification finale. */
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

/**
 * Capture pilotée par le protocole DevTools, en temps réel.
 *
 * `--virtual-time-budget` fige l'horloge : le popup du banc, qui charge ses
 * données par des chaînes de promesses et de minuteries, sortait parfois vide
 * (squelette « Bonsoir. »). Ici on charge la page, on attend que `readyExpr`
 * soit vrai (vraies données à l'écran), puis on photographie.
 *
 * @param {object} options
 * @param {string} options.url        page servie en http
 * @param {string} options.outPath    PNG produit (largeur x SCALE)
 * @param {number} options.width      largeur CSS
 * @param {number} options.height     hauteur CSS
 * @param {string} options.readyExpr  expression JS qui vaut vrai quand la page est prête
 */
export async function captureWhenReady({ url, outPath, width, height, readyExpr }) {
  fs.rmSync(outPath, { force: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sp-shot-"));
  const port = 9300 + Math.floor(Math.random() * 600);

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
      `--remote-debugging-port=${port}`,
      `--window-size=${width},${height}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let socket;
  try {
    let target;
    for (let attempt = 0; attempt < 100 && !target; attempt += 1) {
      await sleep(150);
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        target = list.find((entry) => entry.type === "page");
      } catch {
        // Chrome démarre encore
      }
    }
    if (!target) throw new Error("Chrome n'a pas ouvert de page DevTools");

    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", () => reject(new Error("WebSocket DevTools refusée")), { once: true });
    });

    let nextId = 0;
    const pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
    });
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        nextId += 1;
        pending.set(nextId, { resolve, reject });
        socket.send(JSON.stringify({ id: nextId, method, params }));
      });

    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: SCALE,
      mobile: false,
    });
    await send("Page.navigate", { url });

    const deadline = Date.now() + READY_TIMEOUT_MS;
    let ready = false;
    while (Date.now() < deadline && !ready) {
      await sleep(250);
      try {
        const result = await send("Runtime.evaluate", { expression: `Boolean(${readyExpr})`, returnByValue: true });
        ready = result.result?.value === true;
      } catch {
        // la page navigue encore
      }
    }
    if (!ready) throw new Error(`La page n'est jamais devenue prête : ${url} (${readyExpr})`);

    // Les images (vignettes, avatars) et les transitions de 200 ms se posent.
    await sleep(1200);
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(outPath, Buffer.from(shot.data, "base64"));
  } finally {
    try {
      socket?.close();
    } catch {
      // déjà fermée
    }
    child.kill("SIGKILL");
    await removeProfile(profile);
  }
}
