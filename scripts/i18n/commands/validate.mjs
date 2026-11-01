// validate : contrôle d'intégrité de toutes les langues. Code 1 si une erreur.
// Lancé par npm test (tests/i18n-validate.test.mjs) et par le build.

import { readRegistry, targetLocales } from "../lib/core.mjs";
import { loadSource } from "../lib/catalog.mjs";

import { measure } from "./status.mjs";

export async function validate(options) {
  const source = await loadSource();
  let errors = 0;
  let warnings = 0;
  const say = (line) => options.quiet || console.log(line);

  for (const key of source.duplicates) {
    errors++;
    console.log(`✗ en ${key} : clé définie deux fois dans en.js`);
  }

  const registry = await readRegistry();
  for (const code of await targetLocales(options.locale)) {
    const m = await measure(code);
    const published = registry.find((l) => l.code === code)?.ready;
    errors += m.errors.length;
    warnings += m.warnings.length;
    if (published && m.changelogMissing) {
      errors++;
      console.log(`✗ ${code} : ${m.changelogMissing} phrase(s) des notes de version sans traduction (langue publiée)`);
    }
    say(`${m.errors.length ? "✗" : "✓"} ${code.padEnd(6)} ${m.errors.length} erreur(s), ${m.warnings.length} avertissement(s)`);
    for (const e of m.errors) console.log(`    ✗ ${e.key} [${e.rule}] ${e.message}`);
    if (options.verbose) for (const w of m.warnings) console.log(`    ! ${w.key} [${w.rule}] ${w.message}`);
  }
  say(`\n${errors ? "✗" : "✓"} ${errors} erreur(s), ${warnings} avertissement(s)${options.verbose ? "" : " (détail : --verbose)"}`);
  return errors ? 1 : 0;
}
