// Lecture et écriture des fichiers source de traduction : un fichier par
// langue, i18n/lang/<code>.js (`export default { … };`).
//
// Les outils qui réécrivent des traductions (scripts/translate.mjs…) passent
// par ici : i18n/translations.js n'est plus qu'un agrégateur qui importe ces
// fichiers, le réécrire d'un bloc le transformerait de nouveau en monolithe.

import { readFile, writeFile } from "node:fs/promises";

export const LANG_DIR = new URL("../../i18n/lang/", import.meta.url);
export const META_FILE = new URL("../../i18n/meta.js", import.meta.url);

export function langFileUrl(code) {
  if (typeof code !== "string" || !/^[a-z]{2}(-[A-Z]{2})?$/.test(code)) {
    throw new Error(`Code de langue invalide : ${JSON.stringify(code)}`);
  }
  return new URL(`${code}.js`, LANG_DIR);
}

/** Source JS d'un fichier de langue, stable d'un run à l'autre. */
export function serializeLanguage(code, block) {
  if (!block || typeof block !== "object" || Array.isArray(block)) {
    throw new Error(`Bloc de traduction invalide pour ${code}`);
  }
  const header = `// StreamPulse, langue « ${code} ». Fichier source à éditer (i18n/translations.js ne fait que regrouper les langues).\n`;
  return `${header}export default ${JSON.stringify(block, null, 2)};\n`;
}

export async function writeLanguageFile(code, block) {
  await writeFile(langFileUrl(code), serializeLanguage(code, block), "utf8");
}

/** Réécrit chaque langue de `translations` dans son propre fichier. */
export async function writeLanguageFiles(translations) {
  for (const [code, block] of Object.entries(translations)) {
    await writeLanguageFile(code, block);
  }
}

/** Remplace le littéral ALL_LANGUAGES de i18n/meta.js. */
export async function writeLanguageRegistry(languages) {
  const source = await readFile(META_FILE, "utf8");
  const pattern = /export const ALL_LANGUAGES = \[[\s\S]*?\n\];/;
  if (!pattern.test(source)) {
    throw new Error("ALL_LANGUAGES introuvable dans i18n/meta.js : fichier non écrit.");
  }
  const lines = languages.map(
    ({ code, label, ready }) =>
      `  { code: ${JSON.stringify(code)}, label: ${JSON.stringify(label)}, ready: ${Boolean(ready)} },`,
  );
  const registry = `export const ALL_LANGUAGES = [\n${lines.join("\n")}\n];`;
  await writeFile(META_FILE, source.replace(pattern, registry), "utf8");
}
