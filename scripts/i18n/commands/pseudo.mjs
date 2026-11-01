// pseudo : fabrique une fausse langue « en-XA » pour tester l'interface.
//
// Chaque texte est accentué (Ŝéţţîñĝš), allongé d'environ 40 % et encadré
// de ［ ］ : un crochet absent à l'écran = texte tronqué ; un texte sans
// crochet = texte qui ne passe pas par l'i18n. Variables, balises et marques
// restent intactes (même masquage que pour DeepL).
//
// Le fichier va dans localization/.cache/pseudo/ (jamais livré). Le banc
// scripts/dev/popup-harness.html?pseudo=1 le substitue à l'anglais.

import { mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { PATHS, isPluralGroup } from "../lib/core.mjs";
import { loadSource } from "../lib/catalog.mjs";
import { mapText } from "../lib/protect.mjs";

const ACCENTS = {
  a: "á", b: "ƀ", c: "ç", d: "đ", e: "é", f: "ƒ", g: "ĝ", h: "ĥ", i: "î", j: "ĵ", k: "ķ", l: "ľ", m: "ɱ",
  n: "ñ", o: "ö", p: "þ", q: "ǫ", r: "ŕ", s: "š", t: "ţ", u: "û", v: "ṽ", w: "ŵ", x: "ẋ", y: "ý", z: "ž",
  A: "Á", B: "Ɓ", C: "Ç", D: "Đ", E: "É", F: "Ƒ", G: "Ĝ", H: "Ĥ", I: "Î", J: "Ĵ", K: "Ķ", L: "Ľ", M: "Ṁ",
  N: "Ñ", O: "Ö", P: "Þ", Q: "Ǫ", R: "Ŕ", S: "Š", T: "Ţ", U: "Û", V: "Ṽ", W: "Ŵ", X: "Ẋ", Y: "Ý", Z: "Ž",
};

export const PSEUDO_OPEN = "［";
export const PSEUDO_CLOSE = "］";

/** Transforme un texte sans toucher aux fragments protégés. */
export function pseudoText(text, { expansion = 0.4 } = {}) {
  if (!String(text).trim()) return text;
  let letters = 0;
  const accented = mapText(text, (chunk) =>
    chunk.replace(/[A-Za-z]/g, (c) => {
      letters++;
      return ACCENTS[c] ?? c;
    }),
  );
  const pad = "·".repeat(Math.max(1, Math.round(letters * expansion)));
  return `${PSEUDO_OPEN}${accented}${pad}${PSEUDO_CLOSE}`;
}

function transformTree(node, keyPath = "") {
  const out = {};
  for (const [name, value] of Object.entries(node)) {
    const key = keyPath ? `${keyPath}.${name}` : name;
    if (key.endsWith("htmlLang")) out[name] = "en";
    else if (typeof value === "string") out[name] = pseudoText(value);
    else if (isPluralGroup(value) || (value && typeof value === "object")) out[name] = transformTree(value, key);
    else out[name] = value;
  }
  return out;
}

export async function pseudo(options) {
  const source = await loadSource();
  const tree = transformTree(source.tree);
  const dir = path.join(PATHS.cache, "pseudo");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "en-XA.js");
  await writeFile(file, `// Pseudo-langue générée par npm run i18n:pseudo. Ne pas livrer.\nexport default ${JSON.stringify(tree, null, 2)};\n`);
  console.log(`Pseudo-langue écrite : ${path.relative(process.cwd(), file)}`);
  if (!options.quiet) {
    console.log("Aperçu : servir la racine du dépôt puis ouvrir /scripts/dev/popup-harness.html?pseudo=1&tab=menu");
    console.log("Le banc liste dans la console les textes visibles qui ne passent pas par l'i18n.");
  }
  return 0;
}
