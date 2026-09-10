import { readFile, writeFile } from "node:fs/promises";
import { translate } from "@vitalets/google-translate-api";
import {
  auditTranslations,
  protectText,
  restoreText,
  restorationIsIntact,
  expectedUrlSegment,
  LANG_CODE_KEYS,
} from "./lib/i18n-audit.mjs";

const FILE = new URL("../i18n/translations.js", import.meta.url);

// Publier une langue est une decision editoriale, pas une consequence du fait
// qu'une machine a produit du texte. Passer --publish pour lever le drapeau
// ready des langues traduites par ce run ; sans lui, elles restent masquees
// dans le selecteur tant qu'une relecture n'a pas eu lieu.
const PUBLISH_TRANSLATED = process.argv.includes("--publish");

async function run() {
  console.log("Loading translations.js...");
  const source = await readFile(FILE, "utf8");
  const { ALL_LANGUAGES, translations } = await import(FILE.href);

  const targetLangs = ALL_LANGUAGES.filter((l) => !l.ready).map((l) => l.code);
  console.log("Languages to translate:", targetLangs);

  const enKeys = [];
  const enValues = [];

  function flatten(obj, path = "") {
    for (const key in obj) {
      const p = path ? `${path}.${key}` : key;
      if (typeof obj[key] === "string") {
        enKeys.push(p);
        enValues.push(obj[key]);
      } else if (typeof obj[key] === "object") {
        flatten(obj[key], p);
      }
    }
  }

  flatten(translations.en);

  console.log(`Found ${enKeys.length} strings to translate.`);

  const losses = [];

  for (const lang of targetLangs) {
    console.log(`\nTranslating to ${lang}...`);
    
    const translatedObj = JSON.parse(JSON.stringify(translations.en));
    
    const delimiter = " ||| ";
    let currentBatch = [];
    let currentBatchLength = 0;
    const batches = [];
    
    for (let i = 0; i < enValues.length; i++) {
      const text = enValues[i];
      if (currentBatchLength + text.length + delimiter.length > 3000) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBatchLength = 0;
      }
      currentBatch.push({ key: enKeys[i], text });
      currentBatchLength += text.length + delimiter.length;
    }
    if (currentBatch.length > 0) batches.push(currentBatch);
    
    console.log(`Divided into ${batches.length} batches.`);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      // Chaque chaine part masquee : {{placeholders}} et noms de marque sont
      // remplaces par des jetons opaques, sinon le traducteur les traduit.
      const masked = batch.map((b) => protectText(b.text));
      const textToTranslate = masked.map((m) => m.masked).join(delimiter);

      const commit = (index, translated) => {
        const source = batch[index].text;
        const restored = restoreText(translated, masked[index].tokens);
        // Un jeton perdu en route donnerait une phrase amputee en production.
        // Mieux vaut garder l'anglais, visible et signale, qu'un texte casse.
        if (!restorationIsIntact(source, restored)) {
          losses.push(`${lang} ${batch[index].key}`);
          return;
        }
        const keyParts = batch[index].key.split(".");
        let obj = translatedObj;
        for (let k = 0; k < keyParts.length - 1; k++) obj = obj[keyParts[k]];
        obj[keyParts[keyParts.length - 1]] = restored;
      };

      try {
        const res = await translate(textToTranslate, { to: lang });
        const translatedTexts = res.text.split(delimiter).map(s => s.trim());

        if (translatedTexts.length !== batch.length) {
          console.warn(`Batch ${i+1}: Mismatch in returned array length! Fallback to individual requests`);
          for (let j = 0; j < batch.length; j++) {
            const indRes = await translate(masked[j].masked, { to: lang });
            commit(j, indRes.text);
          }
        } else {
          for (let j = 0; j < batch.length; j++) {
            commit(j, translatedTexts[j]);
          }
        }
      } catch (err) {
        console.error(`Error in batch ${i+1}:`, err.message);
      }
      console.log(`Batch ${i+1}/${batches.length} done.`);
      await new Promise(r => setTimeout(r, 1000));
    }
    
    // Il y a deux htmlLang, sous onboarding et sous popup. Seul le premier
    // etait remis : <html lang> valait « In » en allemand, « в » en russe.
    for (const dotted of LANG_CODE_KEYS) {
      const parts = dotted.split(".");
      let node = translatedObj;
      for (let i = 0; i < parts.length - 1; i++) node = node?.[parts[i]];
      if (node) node[parts[parts.length - 1]] = lang;
    }
    
    const replacer = (obj) => {
        for(const k in obj) {
            if(typeof obj[k] === 'string') {
                // Global et non positionnel : les deux replace() sur chaine
                // ne traitaient que la premiere occurrence, et le second
                // reecrivait ce que le premier venait de produire.
                const segment = expectedUrlSegment(lang);
                obj[k] = obj[k].replace(
                  /streampulse\.fr(\/[a-z-]{2,5})?\/support/g,
                  `streampulse.fr${segment}/support`
                );
            } else if (typeof obj[k] === 'object') {
                replacer(obj[k]);
            }
        }
    }
    replacer(translatedObj);
    
    translations[lang] = translatedObj;
  }
  
  if (losses.length) {
    console.warn(`\n${losses.length} string(s) kept in English, a token was lost in translation:`);
    for (const l of losses.slice(0, 20)) console.warn(`  ${l}`);
    if (losses.length > 20) console.warn(`  ... and ${losses.length - 20} more`);
  }

  // Dernier verrou : on n'ecrit pas un fichier qui casserait la production.
  const problems = auditTranslations(translations);
  const auditErrors = problems.filter((p) => p.level === "error");
  const auditWarnings = problems.filter((p) => p.level === "warning");
  if (auditErrors.length) {
    console.error(`\nAudit failed, translations.js NOT written. ${auditErrors.length} problem(s):`);
    for (const p of auditErrors.slice(0, 30)) console.error(`  ${p.message}`);
    if (auditErrors.length > 30) console.error(`  ... and ${auditErrors.length - 30} more`);
    process.exitCode = 1;
    return;
  }
  if (auditWarnings.length) {
    console.warn(`\n${auditWarnings.length} label(s) noticeably longer than English, check they still fit:`);
    for (const p of auditWarnings.slice(0, 10)) console.warn(`  ${p.message}`);
    if (auditWarnings.length > 10) console.warn(`  ... and ${auditWarnings.length - 10} more`);
  }
  console.log("Audit passed: placeholders, brand names, language codes and site URLs are intact.");

  console.log("Writing translations.js...");
  
  // Le script marquait ready: true toutes les langues sans distinction, y
  // compris celles volontairement retenues et jamais traduites par ce run.
  const translatedNow = new Set(targetLangs.filter((code) => !losses.some((l) => l.startsWith(`${code} `))));
  const newAllLangs = `export const ALL_LANGUAGES = [
${ALL_LANGUAGES.map((l) => {
  const ready = l.ready || (translatedNow.has(l.code) && PUBLISH_TRANSLATED);
  return `  { code: "${l.code}", label: "${l.label}", ready: ${ready} },`;
}).join("\n")}
];`;

  let newSource = source.replace(/export const ALL_LANGUAGES = \[[\s\S]*?\];/, newAllLangs);
  
  const newTranslationsStr = "export const translations = " + JSON.stringify(translations, null, 2) + ";";
  // Non gourmand et ancre sur un }; en debut de ligne : la version gourmande
  // s'etendait jusqu'au dernier }; du fichier, donc jusque dans les fonctions
  // exportees plus bas des que l'une d'elles declarerait un objet.
  const translationsBlock = /export const translations = \{[\s\S]*?\n\};/;
  if (!translationsBlock.test(newSource)) {
    console.error("Could not locate the translations block, file NOT written.");
    process.exitCode = 1;
    return;
  }
  newSource = newSource.replace(translationsBlock, newTranslationsStr);
  
  await writeFile(FILE, newSource, "utf8");
  console.log("Done!");
}

run().catch(console.error);
