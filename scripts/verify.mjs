#!/usr/bin/env node
// Pre-package verification for the StreamPulse extension.
// Checks the manifest, i18n parity, JS syntax, HTML asset references,
// MV3 CSP compliance and stray secrets before the zip is built.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

// Sans argument on verifie le depot lui-meme ; build-zip.mjs passe le dossier
// du zip decompresse pour verifier le paquet reellement livre.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : REPO;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spverify-"));

const errors = [];
const warnings = [];
const ok = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);
const pass = (m) => ok.push(m);

const abs = (p) => path.join(ROOT, p);
const exists = (p) => fs.existsSync(abs(p));
const readJson = (p) => JSON.parse(fs.readFileSync(abs(p), "utf8"));

// ── 1. manifest ─────────────────────────────────────────────────────────────
let manifest;
try {
  manifest = readJson("manifest.json");
  pass("manifest.json is valid JSON");
} catch (e) {
  fail(`manifest.json does not parse: ${e.message}`);
  process.exit(report());
}

if (manifest.manifest_version !== 3) fail(`manifest_version is ${manifest.manifest_version}, expected 3`);
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) fail(`version "${manifest.version}" is not a valid Chrome version string`);
else pass(`version ${manifest.version}`);

// Every path the manifest points at must exist.
const refs = new Set();
refs.add(manifest.background?.service_worker);
refs.add(manifest.action?.default_popup);
for (const cs of manifest.content_scripts ?? []) {
  (cs.js ?? []).forEach((f) => refs.add(f));
  (cs.css ?? []).forEach((f) => refs.add(f));
}
for (const icons of [manifest.icons, manifest.action?.default_icon]) {
  Object.values(icons ?? {}).forEach((f) => refs.add(f));
}
for (const war of manifest.web_accessible_resources ?? []) {
  (war.resources ?? []).forEach((f) => refs.add(f));
}
refs.delete(undefined);
const missing = [...refs].filter((f) => !exists(f));
if (missing.length) missing.forEach((f) => fail(`manifest references a missing file: ${f}`));
else pass(`all ${refs.size} manifest-referenced files exist`);

// ── 2. i18n ─────────────────────────────────────────────────────────────────
const locales = fs.readdirSync(abs("_locales")).filter((d) => fs.statSync(abs(`_locales/${d}`)).isDirectory());
const localeMsgs = {};
for (const loc of locales) {
  try {
    localeMsgs[loc] = readJson(`_locales/${loc}/messages.json`);
  } catch (e) {
    fail(`_locales/${loc}/messages.json does not parse: ${e.message}`);
  }
}
const base = manifest.default_locale;
if (!localeMsgs[base]) fail(`default_locale "${base}" has no messages.json`);
else {
  const baseKeys = Object.keys(localeMsgs[base]);
  for (const [loc, msgs] of Object.entries(localeMsgs)) {
    if (loc === base) continue;
    const absent = baseKeys.filter((k) => !(k in msgs));
    const extra = Object.keys(msgs).filter((k) => !baseKeys.includes(k));
    if (absent.length) fail(`_locales/${loc} is missing keys present in ${base}: ${absent.join(", ")}`);
    if (extra.length) warn(`_locales/${loc} has keys absent from ${base}: ${extra.join(", ")}`);
  }
  // __MSG_x__ placeholders used by the manifest must resolve in every locale.
  const placeholders = [...JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)].map((m) => m[1]);
  for (const key of new Set(placeholders)) {
    for (const [loc, msgs] of Object.entries(localeMsgs)) {
      if (!(key in msgs)) fail(`__MSG_${key}__ (manifest) is not defined in _locales/${loc}`);
    }
  }
  pass(`${locales.length} locales (${locales.join(", ")}) parse with matching key sets`);
}

// ── 3. JS syntax ────────────────────────────────────────────────────────────
// Each file must parse either as an ES module or as a classic script.
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(abs(dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
};
const jsFiles = [...walk("js"), "config.js", "i18n/translations.js"].filter((f) => f.endsWith(".js"));
const checkAs = (file, ext) => {
  const dest = path.join(tmp, `check.${ext}`);
  fs.copyFileSync(abs(file), dest);
  try {
    execFileSync(process.execPath, ["--check", dest], { stdio: "pipe" });
    return null;
  } catch (e) {
    return (e.stderr?.toString() || e.message).split("\n").slice(0, 4).join(" ").trim();
  }
};
let syntaxFails = 0;
for (const f of jsFiles) {
  const asModule = checkAs(f, "mjs");
  if (!asModule) continue;
  const asScript = checkAs(f, "cjs");
  if (!asScript) continue;
  syntaxFails++;
  fail(`${f} is not valid JS: ${asScript}`);
}
if (!syntaxFails) pass(`${jsFiles.length} JS files parse cleanly`);

// ── 4. HTML assets + MV3 CSP ────────────────────────────────────────────────
const htmlFiles = walk("html").filter((f) => f.endsWith(".html"));
let htmlIssues = 0;
for (const f of htmlFiles) {
  const src = fs.readFileSync(abs(f), "utf8");
  for (const m of src.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
    const url = m[1];
    if (/^(https?:|data:|mailto:|#|\/\/)/.test(url)) {
      if (/^(https?:|\/\/)/.test(url) && /src\s*=/.test(m[0])) {
        fail(`${f} loads a remote resource, which MV3 forbids: ${url}`);
        htmlIssues++;
      }
      continue;
    }
    const resolved = path.normalize(path.join(path.dirname(f), url.split(/[?#]/)[0]));
    if (!exists(resolved)) {
      fail(`${f} references a missing asset: ${url}`);
      htmlIssues++;
    }
  }
  for (const m of src.matchAll(/\son(click|load|error|change|input|submit)\s*=/gi)) {
    fail(`${f} uses an inline ${m[0].trim()} handler, which the MV3 CSP blocks`);
    htmlIssues++;
  }
}
if (!htmlIssues) pass(`${htmlFiles.length} HTML files reference only existing local assets, no inline handlers`);

// ── 5. secrets ──────────────────────────────────────────────────────────────
// Nothing from .env may leak into the packaged source, and no live token
// should be committed in config.js.
const envPath = abs(".env");
const packaged = [...jsFiles, ...htmlFiles, "manifest.json"];
if (fs.existsSync(envPath)) {
  const secrets = fs
    .readFileSync(envPath, "utf8")
    .split("\n")
    .map((l) => l.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, ""))
    .filter((v) => v.length >= 12);
  let leaks = 0;
  for (const f of packaged) {
    const src = fs.readFileSync(abs(f), "utf8");
    for (const s of secrets) if (src.includes(s)) { fail(`${f} contains a value from .env`); leaks++; }
  }
  if (!leaks) pass("no .env value appears in any packaged file");
}
const cfg = fs.readFileSync(abs("config.js"), "utf8");
const token = cfg.match(/accessToken:\s*["']([^"']*)["']/)?.[1];
if (token) fail(`config.js ships a non-empty accessToken (${token.length} chars) and would leak it in the zip`);
else pass("config.js ships no access token (credentials stay remote)");

function report() {
  console.log(ok.map((m) => `  PASS  ${m}`).join("\n"));
  if (warnings.length) console.log("\n" + warnings.map((m) => `  WARN  ${m}`).join("\n"));
  if (errors.length) console.log("\n" + errors.map((m) => `  FAIL  ${m}`).join("\n"));
  console.log(`\n${errors.length ? "FAILED" : "OK"} — ${ok.length} passed, ${warnings.length} warnings, ${errors.length} errors`);
  return errors.length ? 1 : 0;
}
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(report());
