/**
 * Compare deux versions de i18n/translations.js et signale toute régression.
 *
 * Les valeurs fonction (pluralisation) sont comparées sur leur *résultat*, pas
 * sur leur source : le re-formatage change l'indentation sans changer le
 * comportement, et comparer le texte produit de faux positifs.
 *
 * Usage : node scripts/diff-translations.mjs <avant.js> [apres.js]
 */
const [beforePath, afterPath = "../i18n/translations.js"] = process.argv.slice(2);

if (!beforePath) {
  console.error("Usage: node scripts/diff-translations.mjs <avant.js> [apres.js]");
  process.exit(2);
}

const toUrl = (p) => (p.startsWith("/") ? `file://${p}` : new URL(p, import.meta.url).href);
const before = await import(toUrl(beforePath));
const after = await import(toUrl(afterPath));

/** Aplatit un objet imbriqué en paires [chemin, valeur]. */
function flatten(node, prefix = "") {
  return Object.entries(node ?? {}).flatMap(([key, value]) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? flatten(value, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value]],
  );
}

/** Jeu d'entrées couvrant singulier, pluriel et zéro. */
const PROBES = [{ count: 0 }, { count: 1 }, { count: 2 }, { count: 42 }];

/** Compare deux valeurs de traduction. Retourne null si équivalentes. */
function compare(expected, actual) {
  if (typeof expected === "function") {
    if (typeof actual !== "function") return "fonction devenue non-fonction";
    for (const probe of PROBES) {
      let a;
      let b;
      try {
        a = expected(probe);
      } catch {
        continue; // signature différente : non comparable
      }
      try {
        b = actual(probe);
      } catch (error) {
        return `lève une erreur sur ${JSON.stringify(probe)}: ${error.message}`;
      }
      if (a !== b) {
        return `résultat différent sur ${JSON.stringify(probe)}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`;
      }
    }
    return null;
  }
  return expected === actual ? null : `${JSON.stringify(expected)} → ${JSON.stringify(actual)}`;
}

const languages = after.AVAILABLE_LANGUAGES.map((l) => l.code);
const problems = [];
let addedTotal = 0;

for (const code of languages) {
  const oldMap = new Map(flatten(before.translations[code]));
  const newMap = new Map(flatten(after.translations[code]));

  for (const [key, value] of oldMap) {
    if (!newMap.has(key)) {
      problems.push(`${code}: clé supprimée — ${key}`);
      continue;
    }
    const issue = compare(value, newMap.get(key));
    if (issue) problems.push(`${code}: ${key} — ${issue}`);
  }

  const added = [...newMap.keys()].filter((k) => !oldMap.has(k));
  addedTotal += added.length;
  if (added.length) console.log(`${code}: +${added.length} clé(s)`);
}

const missingLang = before.AVAILABLE_LANGUAGES.map((l) => l.code).filter((c) => !languages.includes(c));
for (const code of missingLang) problems.push(`langue supprimée — ${code}`);

console.log(`\n${languages.length} langues, +${addedTotal} clés au total`);

if (problems.length) {
  console.error(`\n${problems.length} régression(s) :`);
  for (const p of problems.slice(0, 40)) console.error(`  ${p}`);
  if (problems.length > 40) console.error(`  … et ${problems.length - 40} de plus`);
  process.exit(1);
}

console.log("Aucune régression : toutes les clés préexistantes sont intactes.");
