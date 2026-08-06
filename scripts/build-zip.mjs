#!/usr/bin/env node
// Construit le zip livre au Chrome Web Store.
//
// La liste des fichiers vient de `git ls-files`, pas d'un parcours du disque :
// tout ce qui n'est pas versionne ne peut donc pas se retrouver dans l'archive
// par accident (.env, .git, node_modules, .DS_Store, backups). Les seules
// exceptions sont explicites : config.js est necessaire au service worker mais
// gitignore, et l'outillage de dev est versionne mais ne doit pas etre livre.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = process.env.STREAMPULSE_ZIP_DIR || path.join(os.homedir(), "Desktop/dev/ZIPS");

// Versionne mais reserve au developpement : jamais livre.
const DEV_ONLY = [/^README\.md$/, /^\.gitignore$/, /^package(-lock)?\.json$/, /^eslint\.config\.mjs$/, /^scripts\//];
// Necessaire a l'extension mais gitignore.
const EXTRA = ["config.js"];
// Filet de securite : si l'une de ces entrees apparait, on refuse de packager.
const NEVER_SHIP = [/(^|\/)\.env$/, /(^|\/)\.git(\/|$)/, /(^|\/)\.claude(\/|$)/, /(^|\/)\.agents(\/|$)/, /(^|\/)node_modules(\/|$)/, /(^|\/)\.DS_Store$/, /\.zip$/, /(^|\/)backups(\/|$)/];

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: REPO, encoding: "utf8", ...opts });

const version = JSON.parse(fs.readFileSync(path.join(REPO, "manifest.json"), "utf8")).version;
const outFile = path.join(OUT_DIR, `StreamPulseExtension_${version}.zip`);

const files = [
  ...run("git", ["ls-files"]).split("\n").filter(Boolean).filter((f) => !DEV_ONLY.some((re) => re.test(f))),
  ...EXTRA,
].sort();

for (const f of files) {
  if (NEVER_SHIP.some((re) => re.test(f))) {
    console.error(`REFUS : ${f} ne doit jamais etre packagé.`);
    process.exit(1);
  }
  if (!fs.existsSync(path.join(REPO, f))) {
    console.error(`REFUS : ${f} est liste mais absent du disque.`);
    process.exit(1);
  }
}

// 1. Verifier les sources avant de packager.
console.log("→ verification des sources");
run("node", ["scripts/verify.mjs"], { stdio: "inherit" });

// 2. Construire l'archive.
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.rmSync(outFile, { force: true });
const listFile = path.join(os.tmpdir(), `streampulse-files-${process.pid}.txt`);
fs.writeFileSync(listFile, files.join("\n"));
run("zip", ["-q", "-X", outFile, "-@"], { input: fs.readFileSync(listFile) });
fs.rmSync(listFile, { force: true });

// 3. Re-verifier le paquet reellement produit, pas seulement les sources.
console.log(`\n→ verification de l'archive (${files.length} fichiers)`);
const staging = fs.mkdtempSync(path.join(os.tmpdir(), "streampulse-zip-"));
run("unzip", ["-q", outFile, "-d", staging]);
const packaged = run("unzip", ["-Z1", outFile]).split("\n").filter(Boolean);
for (const entry of packaged) {
  if (NEVER_SHIP.some((re) => re.test(entry))) {
    console.error(`REFUS : l'archive contient ${entry}.`);
    process.exit(1);
  }
}
run("node", ["scripts/verify.mjs", staging], { stdio: "inherit" });
fs.rmSync(staging, { recursive: true, force: true });

// Taille en base 1000, comme l'affichent le Finder et ls, pour eviter toute
// confusion avec les Kio.
const bytes = fs.statSync(outFile).size;
console.log(`\nOK — ${outFile}`);
console.log(`     ${packaged.length} fichiers, ${(bytes / 1000).toFixed(0)} kB (${bytes} octets)`);
