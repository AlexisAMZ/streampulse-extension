/**
 * Génère js/inject/i18n-inline.js depuis i18n/translations.js.
 *
 * POURQUOI CE FICHIER EXISTE
 * Les content scripts sont injectés comme scripts classiques (manifest.json),
 * ils ne peuvent donc pas `import` le module ES i18n/translations.js. Chacun
 * embarquait sa propre petite table de traductions, limitée à 4 langues et
 * dupliquée — impossible à maintenir sur 16 langues.
 *
 * Ce script extrait le sous-ensemble de clés dont les content scripts ont
 * besoin et l'émet en script classique exposant window.__SP_I18N__.
 * translations.js reste la source unique de vérité.
 *
 * Relancer après toute modification des clés `inject.*` :
 *   node scripts/build-inline-i18n.mjs
 */
import { writeFile } from "node:fs/promises";
import { translations, AVAILABLE_LANGUAGES } from "../i18n/translations.js";

const OUT = new URL("../js/inject/i18n-inline.js", import.meta.url);

/** Espace de noms exporté vers les content scripts. */
const NAMESPACE = "inject";

const payload = {};
for (const { code } of AVAILABLE_LANGUAGES) {
  const block = translations[code]?.[NAMESPACE];
  if (!block) {
    throw new Error(`translations.${code}.${NAMESPACE} manquant — lancer expand-languages d'abord.`);
  }
  payload[code] = block;
}

const banner = `/**
 * FICHIER GÉNÉRÉ — NE PAS ÉDITER À LA MAIN.
 * Source : i18n/translations.js (clés "${NAMESPACE}.*")
 * Régénérer : node scripts/build-inline-i18n.mjs
 *
 * Expose window.__SP_I18N__ pour les content scripts, qui sont injectés comme
 * scripts classiques et ne peuvent pas importer de module ES.
 */`;

const body = `(function () {
  "use strict";
  if (typeof window === "undefined") return;
  // Déclaré dans plusieurs entrées content_scripts (l'ordre entre entrées n'est
  // pas garanti par Chrome, chacune doit donc pouvoir le charger). On sort tôt
  // si une autre entrée l'a déjà installé.
  if (window.__SP_I18N__) return;

  var STRINGS = ${JSON.stringify(payload, null, 2)};
  var DEFAULT_LANG = ${JSON.stringify("en")};

  /**
   * Résout une préférence stockée ("pt_BR", "EN", "de-DE") vers une langue
   * disponible. Exact d'abord, puis sous-étiquette de base.
   */
  function resolve(value) {
    if (typeof value !== "string" || !value.trim()) return DEFAULT_LANG;
    var raw = value.trim().replace(/_/g, "-").toLowerCase();
    var codes = Object.keys(STRINGS);
    for (var i = 0; i < codes.length; i++) {
      if (codes[i].toLowerCase() === raw) return codes[i];
    }
    var base = raw.split("-")[0];
    for (var j = 0; j < codes.length; j++) {
      if (codes[j].toLowerCase() === base) return codes[j];
      if (codes[j].toLowerCase().split("-")[0] === base) return codes[j];
    }
    return DEFAULT_LANG;
  }

  /** Lit une clé "a.b.c", avec repli sur l'anglais puis sur la clé brute. */
  function get(lang, key, params) {
    var value = dig(STRINGS[lang], key);
    if (value == null) value = dig(STRINGS[DEFAULT_LANG], key);
    if (typeof value !== "string") return key;
    if (params) {
      value = value.replace(/{{\\s*([^}\\s]+)\\s*}}/g, function (match, name) {
        return Object.prototype.hasOwnProperty.call(params, name) ? params[name] : match;
      });
    }
    return value;
  }

  function dig(root, key) {
    if (!root) return null;
    var parts = String(key).split(".");
    var node = root;
    for (var i = 0; i < parts.length; i++) {
      if (node == null || typeof node !== "object") return null;
      node = node[parts[i]];
    }
    return node;
  }

  window.__SP_I18N__ = {
    resolve: resolve,
    get: get,
    languages: Object.keys(STRINGS),
    defaultLanguage: DEFAULT_LANG,
  };
})();
`;

await writeFile(OUT, `${banner}\n${body}`, "utf8");

const langCount = Object.keys(payload).length;
const keyCount = JSON.stringify(payload[Object.keys(payload)[0]]).match(/":/g)?.length ?? 0;
console.log(`js/inject/i18n-inline.js généré — ${langCount} langues, ~${keyCount} clés`);
