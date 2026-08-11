import { readFile, writeFile } from "node:fs/promises";
import { translate } from "@vitalets/google-translate-api";

const FILE = new URL("../i18n/translations.js", import.meta.url);

async function run() {
  console.log("Loading translations.js...");
  const source = await readFile(FILE, "utf8");
  const { translations } = await import(FILE.href);

  const lang = 'hi';
  console.log("Translating to Hindi...");

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
  
  // Set language name
  const translatedObj = JSON.parse(JSON.stringify(translations.en));
  translatedObj.meta.languageName = "हिन्दी";

  console.log(`Found ${enKeys.length} strings to translate.`);

  const delimiter = " ||| ";
  let currentBatch = [];
  const batches = [];
  
  // Very small batches for Google Translate to avoid Rate Limit (Max 5 strings)
  for (let i = 0; i < enValues.length; i++) {
    const text = enValues[i];
    currentBatch.push({ key: enKeys[i], text });
    if (currentBatch.length === 5) {
      batches.push(currentBatch);
      currentBatch = [];
    }
  }
  if (currentBatch.length > 0) batches.push(currentBatch);
  
  console.log(`Divided into ${batches.length} batches.`);
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    // Instead of batching with delimiters which breaks easily, we just do Promise.all for 5 strings
    try {
        const results = await Promise.all(batch.map(b => translate(b.text, { to: lang })));
        for (let j = 0; j < batch.length; j++) {
            const keyParts = batch[j].key.split(".");
            let obj = translatedObj;
            for (let k = 0; k < keyParts.length - 1; k++) obj = obj[keyParts[k]];
            obj[keyParts[keyParts.length - 1]] = results[j].text;
        }
    } catch (err) {
        console.error(`Error in batch ${i+1}:`, err.message);
    }
    console.log(`Batch ${i+1}/${batches.length} done.`);
    await new Promise(r => setTimeout(r, 2500)); // 2.5s delay to avoid 429
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
  
  console.log("Writing translations.js...");
  const newTranslationsStr = "export const translations = " + JSON.stringify(translations, null, 2) + ";";
  const newSource = source.replace(/export const translations = {[\s\S]*};/, newTranslationsStr);
  
  await writeFile(FILE, newSource, "utf8");
  console.log("Done Hindi!");
}

run().catch(console.error);
