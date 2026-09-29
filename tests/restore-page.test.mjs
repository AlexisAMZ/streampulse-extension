import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { translations } from "../i18n/translations.js";

// La page de restauration a déjà planté d'un bloc : restore.js cherchait
// #drop-zone quand le HTML porte #restore-pick, l'erreur au chargement du
// module tuait aussi les traductions et le bouton de confirmation. Ces
// vérifications statiques croisent le HTML et le script pour que ça ne
// se reproduise plus.

const html = await readFile(new URL("../html/restore.html", import.meta.url), "utf8");
const script = await readFile(new URL("../js/restore.js", import.meta.url), "utf8");

function idsDuHtml(source) {
  return new Set([...source.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
}

function idsReferencesParLeScript(source) {
  return new Set([...source.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]));
}

test("restore.js ne référence que des identifiants présents dans restore.html", () => {
  const manquants = idsReferencesParLeScript(script).difference(idsDuHtml(html));
  assert.deepEqual([...manquants], [], "identifiants absents du HTML : le script planterait au chargement");
});

test("chaque chaîne visible de restore.html a sa clé de traduction", () => {
  const cles = [...html.matchAll(/data-i18n(?:-attr-[a-z-]+)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(cles.length >= 10, `des clés data-i18n sont attendues, trouvé ${cles.length}`);
  // Le repli du HTML est le texte FR ; les autres langues sont couvertes par
  // tests/translations-integrity.test.mjs.
  const absentes = cles.filter((cle) => cle.split(".").reduce((noeud, part) => noeud?.[part], translations.fr) === undefined);
  assert.deepEqual(absentes, [], "clés data-i18n absentes des traductions françaises");
});
