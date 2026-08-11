import { readFile, writeFile } from "node:fs/promises";

const FILE = new URL("../i18n/translations.js", import.meta.url);
const DEEPL_API_KEY = "848d800e-c396-4a25-b26d-9e6c52a42446:fx";

async function translateDeepl(texts, targetLang) {
    const url = "https://api-free.deepl.com/v2/translate";
    
    // DeepL uses specific target lang codes
    const langMap = {
        "pt-br": "PT-BR",
        "es": "ES",
        "de": "DE",
        "it": "IT",
        "pl": "PL",
        "tr": "TR",
        "ru": "RU",
        "ja": "JA",
        "ko": "KO",
        "id": "ID",
        "nl": "NL",
        "sv": "SV",
        "cs": "CS"
    };
    
    const target = langMap[targetLang.toLowerCase()] || targetLang.toUpperCase();
    
    // Batches of 50 texts
    const batches = [];
    for(let i = 0; i < texts.length; i += 50) {
        batches.push(texts.slice(i, i + 50));
    }
    
    let allTranslated = [];
    
    for(const batch of batches) {
        const body = {
            text: batch,
            target_lang: target,
            preserve_formatting: true
        };
        
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `DeepL-Auth-Key ${DEEPL_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
        
        if (!res.ok) {
            throw new Error(`DeepL API Error: ${res.status} ${await res.text()}`);
        }
        
        const data = await res.json();
        allTranslated = allTranslated.concat(data.translations.map(t => t.text));
    }
    
    return allTranslated;
}

async function run() {
  console.log("Loading translations.js...");
  const source = await readFile(FILE, "utf8");
  const { translations, ALL_LANGUAGES } = await import(FILE.href);

  const targetLangs = ['tr', 'ru', 'ja', 'ko', 'id', 'nl', 'sv', 'cs'];
  console.log("Languages to translate via DeepL:", targetLangs);

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
    
    try {
        const translatedTexts = await translateDeepl(enValues, lang);
        
        for (let j = 0; j < enKeys.length; j++) {
            const keyParts = enKeys[j].split(".");
            let obj = translatedObj;
            for (let k = 0; k < keyParts.length - 1; k++) obj = obj[keyParts[k]];
            obj[keyParts[keyParts.length - 1]] = translatedTexts[j];
        }
    } catch (err) {
        console.error(`Error for ${lang}:`, err.message);
        continue;
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
  const newTranslationsStr = "export const translations = " + JSON.stringify(translations, null, 2) + ";";
  const newSource = source.replace(/export const translations = {[\s\S]*};/, newTranslationsStr);
  
  await writeFile(FILE, newSource, "utf8");
  console.log("Done DeepL!");
}

run().catch(console.error);
