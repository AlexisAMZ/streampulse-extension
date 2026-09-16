import test from "node:test";
import assert from "node:assert/strict";
import { translations } from "../i18n/translations.js";

/** Chemins de feuilles d'un objet i18n, ex. ["popup.history.summary", …]. */
function leafPaths(node, prefix = "") {
  const paths = [];
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") paths.push(...leafPaths(value, path));
    else paths.push(path);
  }
  return paths;
}

test("toutes les locales exposent exactement les mêmes clés", () => {
  const locales = Object.keys(translations);
  assert.ok(locales.length >= 15, `au moins 15 locales attendues, trouvé ${locales.length}`);

  const reference = new Set(leafPaths(translations.fr)).difference(new Set(["fr.htmlLang"]));
  for (const locale of locales) {
    const keys = new Set(leafPaths(translations[locale])).difference(new Set([`${locale}.htmlLang`]));
    const missing = reference.difference(keys);
    assert.equal(
      missing.size,
      0,
      `${locale} manque des clés : ${[...missing].slice(0, 10).join(", ")}${missing.size > 10 ? " …" : ""}`,
    );
    const extra = keys.difference(reference);
    assert.equal(
      extra.size,
      0,
      `${locale} a des clés inconnues de fr : ${[...extra].slice(0, 10).join(", ")}${extra.size > 10 ? " …" : ""}`,
    );
  }
});
