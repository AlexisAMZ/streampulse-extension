import { readFile, writeFile } from "node:fs/promises";

const FILE = new URL("../js/changelog-data.js", import.meta.url);
const DEEPL_API_KEY = "848d800e-c396-4a25-b26d-9e6c52a42446:fx";

async function translateDeepl(texts, targetLang) {
    const url = "https://api-free.deepl.com/v2/translate";
    const langMap = {
        "pt-br": "PT-BR", "es": "ES", "de": "DE", "it": "IT",
        "pl": "PL", "tr": "TR", "ru": "RU", "ja": "JA",
        "ko": "KO", "id": "ID", "nl": "NL", "sv": "SV", "cs": "CS"
    };
    const target = langMap[targetLang.toLowerCase()] || targetLang.toUpperCase();
    
    const body = {
        text: texts,
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
    if (!res.ok) throw new Error(`DeepL error: ${res.status}`);
    const data = await res.json();
    return data.translations.map(t => t.text);
}

async function run() {
    // The changelog is a JS file exporting RELEASES. We will just rewrite it via AST or regex.
    // Instead of parsing it, we can just import it, build a translated object, and write it out.
    // But rewriting the exact file with comments is hard.
    // Let's just do a regex replace on the file contents!
    const source = await readFile(FILE, "utf8");
    const { RELEASES } = await import(FILE.href);
    
    const langs = ['de', 'it', 'pl', 'tr', 'ru', 'ja', 'ko', 'id', 'nl', 'sv', 'cs'];
    
    // We only need to process the latest release (26.8.9) or all of them.
    // Actually the linter might complain about ALL releases missing translations if we just added langs.
    // Let's check which releases need translation.
    
    let newSource = source;
    for (const release of RELEASES) {
        // Find the release block string in newSource
        const versionStr = `version: "${release.version}"`;
        
        let releaseStart = newSource.indexOf(versionStr);
        if (releaseStart === -1) continue;
        
        // Let's just do a naive translation for all i18n objects in this release
        const allTextNodes = [];
        
        if (release.title) allTextNodes.push(release.title);
        if (release.subtitle) allTextNodes.push(release.subtitle);
        for (const change of (release.changes || [])) {
            if (change.text) allTextNodes.push(change.text);
        }
        for (const thanks of (release.thanks || [])) {
            if (thanks.for) allTextNodes.push(thanks.for);
        }
        
        for (const lang of langs) {
            const textsToTranslate = allTextNodes.map(n => n.en || n.fr || "Missing");
            const translated = await translateDeepl(textsToTranslate, lang);
            
            for (let i = 0; i < allTextNodes.length; i++) {
                allTextNodes[i][lang] = translated[i];
            }
        }
    }
    
    // Reconstruct the file string... wait, reconstructing JS with comments is hard.
    // A simpler way: we know it's just plain JS. We can write a new js/changelog-data.js 
    // with the comments from the top, and JSON.stringify the RELEASES.
    
    const header = source.substring(0, source.indexOf("export const RELEASES = ["));
    
    // Formatting RELEASES back to JS:
    // We need to output the exact structure.
    const releasesJS = "export const RELEASES = " + JSON.stringify(RELEASES, null, 2) + ";\n";
    
    await writeFile(FILE, header + releasesJS, "utf8");
    console.log("Changelog translated!");
}

run().catch(console.error);
