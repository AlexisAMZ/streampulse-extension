// add : déclare une langue. publish : l'ouvre dans le sélecteur quand elle
// est complète, relue et valide. Ce sont les deux seules étapes qui touchent
// au registre de l'extension (i18n/meta.js) et à l'agrégateur.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { PATHS, ROOT, at, langFile, loadConfig, readRegistry } from "../lib/core.mjs";
import { serializeLanguage, writeLanguageRegistry } from "../../lib/i18n-files.mjs";
import { writeStatus } from "../lib/state.mjs";
import { measure } from "./status.mjs";

const CODE_RE = /^[a-z]{2}(-[A-Z]{2})?$/;
const identifierFor = (code) => code.replace(/-([A-Za-z]+)/, (_, r) => r.toUpperCase());

/** Ajoute l'import et l'entrée de la langue dans i18n/translations.js. */
export function addToAggregator(source, code) {
  const id = identifierFor(code);
  if (source.includes(`./lang/${code}.js`)) return source;
  const imports = [...source.matchAll(/^import .+ from "\.\/lang\/.+\.js";$/gm)];
  const lastImport = imports.at(-1);
  if (!lastImport) throw new Error("i18n/translations.js : aucun import de langue trouvé");
  const afterImport = lastImport.index + lastImport[0].length;
  let out = `${source.slice(0, afterImport)}\nimport ${id} from "./lang/${code}.js";${source.slice(afterImport)}`;
  const close = out.lastIndexOf("\n};");
  if (close === -1) throw new Error("i18n/translations.js : objet translations introuvable");
  const prop = id === code ? `  ${code},` : `  ${JSON.stringify(code)}: ${id},`;
  out = `${out.slice(0, close)}\n${prop}${out.slice(close)}`;
  return out;
}

export async function add(options) {
  const code = options.locale?.[0];
  if (!code || !CODE_RE.test(code)) throw new Error("préciser --locale=xx ou --locale=xx-YY (ex. nl, zh-CN)");
  const registry = await readRegistry();
  if (registry.some((l) => l.code === code)) throw new Error(`${code} est déjà déclarée`);

  const { config } = loadConfig();
  const settings = {
    ...(config.planned?.[code] ?? {}),
    ...(options.label ? { label: options.label } : {}),
    ...(options.deepl ? { deepl: options.deepl } : {}),
    ...(options.chrome ? { chrome: options.chrome } : {}),
  };
  if (!settings.label) throw new Error(`${code} : préciser --label="Nom de la langue dans la langue"`);
  if (!settings.deepl) throw new Error(`${code} : préciser --deepl=CODE (codes cibles : https://developers.deepl.com/docs/getting-started/supported-languages)`);
  settings.chrome ??= code.replace("-", "_");

  // 1. Configuration de l'outillage.
  const { [code]: _planned, ...planned } = config.planned ?? {};
  const nextConfig = { ...config, locales: { ...config.locales, [code]: settings }, planned };
  await writeFile(PATHS.config, `${JSON.stringify(nextConfig, null, 2)}\n`);

  // 2. Fichier de langue vide : tout retombe sur l'anglais en attendant.
  if (!existsSync(langFile(code))) await writeFile(langFile(code), serializeLanguage(code, {}), "utf8");

  // 3. Agrégateur (service worker, outils) puis registre, langue masquée.
  const aggregator = await readFile(PATHS.aggregator, "utf8");
  await writeFile(PATHS.aggregator, addToAggregator(aggregator, code), "utf8");
  await writeLanguageRegistry([...registry, { code, label: settings.label, ready: false }]);
  await writeStatus(code, {}, []);
  // Les content scripts lisent js/inject/i18n-inline.js : il doit connaître la langue.
  execFileSync("node", ["scripts/build-inline-i18n.mjs"], { cwd: ROOT, stdio: "ignore" });

  console.log(`✓ ${code} (${settings.label}) déclarée, masquée dans le sélecteur.`);
  const currency = readFileSync(at("js", "currency.js"), "utf8");
  if (!new RegExp(`["']?${code}["']?\\s*:`).test(currency)) {
    console.log(`! js/currency.js n'associe aucune devise à « ${code} » : le prix de StreamPulse+ s'affichera dans la devise par défaut.`);
  }
  console.log(`Ensuite :\n  npm run i18n:translate -- --locale=${code} --dry-run   (chiffrer)\n  npm run i18n:translate -- --locale=${code}\n  npm run i18n:review -- --locale=${code}\n  npm run i18n:publish -- --locale=${code}`);
  return 0;
}

export async function publish(options) {
  const code = options.locale?.[0];
  if (!code) throw new Error("préciser --locale=…");
  const registry = await readRegistry();
  const entry = registry.find((l) => l.code === code);
  if (!entry) throw new Error(`${code} n'est pas déclarée (npm run i18n:add -- --locale=${code})`);
  if (options.unpublish) {
    await writeLanguageRegistry(registry.map((l) => (l.code === code ? { ...l, ready: false } : l)));
    console.log(`${code} retirée du sélecteur.`);
    return 0;
  }

  const m = await measure(code);
  const blockers = [];
  if (m.errors.length) blockers.push(`${m.errors.length} erreur(s) de validation`);
  if (m.counts.missing) blockers.push(`${m.counts.missing} clé(s) manquante(s)`);
  if (m.changelogMissing) blockers.push(`${m.changelogMissing} phrase(s) de changelog manquante(s)`);
  if (!options.force && (m.counts.pending || m.counts.outdated)) {
    blockers.push(`${m.counts.pending} en attente et ${m.counts.outdated} obsolète(s) à relire (ou --force)`);
  }
  if (blockers.length) {
    console.log(`✗ ${code} ne peut pas être publiée :\n  - ${blockers.join("\n  - ")}`);
    return 1;
  }
  await writeLanguageRegistry(registry.map((l) => (l.code === code ? { ...l, ready: true } : l)));
  execFileSync("node", ["scripts/build-inline-i18n.mjs"], { cwd: ROOT, stdio: "inherit" });
  console.log(`✓ ${code} publiée dans le sélecteur. Lancer npm run build pour produire le zip.`);
  return 0;
}
