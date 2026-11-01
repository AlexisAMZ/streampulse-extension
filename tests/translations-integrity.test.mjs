import test from "node:test";
import assert from "node:assert/strict";
import { translations } from "../i18n/translations.js";
import { expectedEntries } from "../scripts/i18n/lib/core.mjs";

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

test("toutes les locales exposent exactement les clés attendues pour leur langue", () => {
  const locales = Object.keys(translations);
  assert.ok(locales.length >= 11, `au moins 11 locales attendues, trouvé ${locales.length}`);

  // Même jeu de clés partout, sauf les groupes de pluriel : chaque langue y a
  // ses catégories CLDR (one/few/many/other en ukrainien, other en japonais).
  for (const locale of locales) {
    const reference = new Set(expectedEntries(translations.en, locale).keys());
    const keys = new Set(leafPaths(translations[locale]));
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
      `${locale} a des clés inconnues de l'anglais : ${[...extra].slice(0, 10).join(", ")}${extra.size > 10 ? " …" : ""}`,
    );
  }
});
