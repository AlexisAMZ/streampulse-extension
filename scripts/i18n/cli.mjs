#!/usr/bin/env node
// Point d'entrée unique de l'outillage de localisation.
//
//   node scripts/i18n/cli.mjs <commande> [--locale=de,es] [options]
//
// Les scripts npm (i18n:check, i18n:translate…) appellent ce fichier. La
// documentation complète est dans localization/README.md.

const COMMANDS = {
  check: ["./commands/status.mjs", "check", "État des traductions (manquantes, à revoir, obsolètes). Lecture seule."],
  sync: ["./commands/status.mjs", "sync", "Enregistre l'état déduit dans localization/status (après une édition à la main)."],
  report: ["./commands/status.mjs", "report", "Rapport de couverture par langue (--out=fichier.md, --json)."],
  approve: ["./commands/status.mjs", "approve", "Passe des traductions en « approved » (--keys, --prefix, --from=reviewed)."],
  validate: ["./commands/validate.mjs", "validate", "Contrôle d'intégrité de toutes les langues ; code 1 en cas d'erreur."],
  extract: ["./commands/extract.mjs", "extract", "Clés utilisées/inutilisées et textes codés en dur dans html/ et js/."],
  translate: ["./commands/translate.mjs", "translate", "Traduit le manquant et l'obsolète avec DeepL (--dry-run pour chiffrer)."],
  review: ["./commands/review.mjs", "review", "Relecture par Claude (API si ANTHROPIC_API_KEY, sinon dossier à relire)."],
  "apply-review": ["./commands/review.mjs", "applyReview", "Applique un fichier de verdicts de relecture (--file=…)."],
  pseudo: ["./commands/pseudo.mjs", "pseudo", "Génère la pseudo-langue de test visuel (textes allongés et accentués)."],
  add: ["./commands/locale.mjs", "add", "Déclare une nouvelle langue (--locale=nl [--label=… --deepl=NL])."],
  publish: ["./commands/locale.mjs", "publish", "Publie une langue dans le sélecteur si elle est complète (--locale=nl)."],
};

/** --locale=de,es → { locale: ["de","es"] } ; --dry-run → { "dry-run": true }. */
export function parseArgs(argv) {
  const options = { _: [] };
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (!match) {
      options._.push(arg);
      continue;
    }
    const [, name, value] = match;
    options[name] = value === undefined ? true : value;
  }
  for (const listOption of ["locale", "keys", "prefix", "scope", "status", "from"]) {
    if (typeof options[listOption] === "string") {
      options[listOption] = options[listOption].split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return options;
}

function help() {
  console.log("Commandes de localisation StreamPulse :\n");
  for (const [name, [, , text]] of Object.entries(COMMANDS)) console.log(`  ${name.padEnd(13)} ${text}`);
  console.log("\nExemple : npm run i18n:translate -- --locale=de,es --dry-run");
}

const [name, ...rest] = process.argv.slice(2);
if (!name || name === "help" || !COMMANDS[name]) {
  help();
  process.exit(name && name !== "help" ? 2 : 0);
}
const [modulePath, exportName] = COMMANDS[name];
try {
  const module = await import(modulePath);
  const code = await module[exportName](parseArgs(rest));
  process.exit(typeof code === "number" ? code : 0);
} catch (error) {
  console.error(`\n✗ i18n ${name} : ${error.message}`);
  if (process.env.I18N_DEBUG) console.error(error.stack);
  process.exit(1);
}
