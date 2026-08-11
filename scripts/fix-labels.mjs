import { readFile, writeFile } from "node:fs/promises";

const FILE = new URL("../i18n/translations.js", import.meta.url);

async function run() {
  const source = await readFile(FILE, "utf8");
  const { translations, ALL_LANGUAGES } = await import(FILE.href);

  for (const lang of ALL_LANGUAGES) {
    if (translations[lang.code] && translations[lang.code].meta) {
      translations[lang.code].meta.languageName = lang.label;
    }
  }

  const newTranslationsStr = "export const translations = " + JSON.stringify(translations, null, 2) + ";";
  const newSource = source.replace(/export const translations = {[\s\S]*};/, newTranslationsStr);
  
  await writeFile(FILE, newSource, "utf8");
  console.log("Fixed language names!");
}

run().catch(console.error);
