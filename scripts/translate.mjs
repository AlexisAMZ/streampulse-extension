import { readFile, writeFile } from "node:fs/promises";
import { translate } from "@vitalets/google-translate-api";

const FILE = new URL("../i18n/translations.js", import.meta.url);

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
      const textToTranslate = batch.map(b => b.text).join(delimiter);
      
      try {
        const res = await translate(textToTranslate, { to: lang });
        const translatedTexts = res.text.split(delimiter).map(s => s.trim());
        
        if (translatedTexts.length !== batch.length) {
          console.warn(`Batch ${i+1}: Mismatch in returned array length! Fallback to individual requests`);
          for (let j = 0; j < batch.length; j++) {
            const indRes = await translate(batch[j].text, { to: lang });
            const keyParts = batch[j].key.split(".");
            let obj = translatedObj;
            for (let k = 0; k < keyParts.length - 1; k++) obj = obj[keyParts[k]];
            obj[keyParts[keyParts.length - 1]] = indRes.text;
          }
        } else {
          for (let j = 0; j < batch.length; j++) {
            const keyParts = batch[j].key.split(".");
            let obj = translatedObj;
            for (let k = 0; k < keyParts.length - 1; k++) obj = obj[keyParts[k]];
            obj[keyParts[keyParts.length - 1]] = translatedTexts[j];
          }
        }
      } catch (err) {
        console.error(`Error in batch ${i+1}:`, err.message);
      }
      console.log(`Batch ${i+1}/${batches.length} done.`);
      await new Promise(r => setTimeout(r, 1000));
    }
    
    translatedObj.onboarding.htmlLang = lang;
    
    const replacer = (obj) => {
        for(const k in obj) {
            if(typeof obj[k] === 'string') {
                obj[k] = obj[k].replace('streampulse.fr/en/support', `streampulse.fr/${lang}/support`);
                obj[k] = obj[k].replace('streampulse.fr/support', `streampulse.fr/${lang}/support`);
                obj[k] = obj[k].replace('{{handle}}', '{{handle}}');
            } else if (typeof obj[k] === 'object') {
                replacer(obj[k]);
            }
        }
    }
    replacer(translatedObj);
    
    translations[lang] = translatedObj;
  }
  
  console.log("Writing translations.js...");
  
  const newAllLangs = `export const ALL_LANGUAGES = [
${ALL_LANGUAGES.map(l => `  { code: "${l.code}", label: "${l.label}", ready: true },`).join("\n")}
];`;

  let newSource = source.replace(/export const ALL_LANGUAGES = \[[\s\S]*?\];/, newAllLangs);
  
  const newTranslationsStr = "export const translations = " + JSON.stringify(translations, null, 2) + ";";
  newSource = newSource.replace(/export const translations = {[\s\S]*};/, newTranslationsStr);
  
  await writeFile(FILE, newSource, "utf8");
  console.log("Done!");
}

run().catch(console.error);
