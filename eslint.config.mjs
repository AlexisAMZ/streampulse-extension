import js from "@eslint/js";
import globals from "globals";

// L'extension melange deux types de fichiers que Node et ESLint ne parsent pas
// de la meme facon : le service worker et les pages HTML chargent des modules
// ES, alors que les content scripts sont injectes comme scripts classiques.
// Les parser dans le mauvais mode produit de faux positifs, d'ou la separation.
const ES_MODULES = [
  "config.js",
  "i18n/translations.js",
  "js/background.js",
  "js/i18n.js",
  "js/onboarding.js",
  "js/platforms.js",
  "js/popup.js",
  "js/ui.js",
  "js/utils.js",
  "scripts/**/*.mjs",
  "eslint.config.mjs",
];

export default [
  {
    ignores: ["js/vendor/**", "node_modules/**", "coverage/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
    },
    rules: {
      // Un catch vide avale une panne en silence : c'est exactement comme ca
      // qu'un selecteur Twitch mort passe inapercu. Signale sans bloquer le
      // build, le nettoyage se fait au fil de l'eau.
      "no-empty": ["warn", { allowEmptyCatch: false }],
      // Le code marque deja une erreur volontairement ignoree par `catch (_)`,
      // on respecte cette convention et on signale tous les autres cas.
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Erreurs de logique asynchrone, frequentes dans un service worker MV3.
      "no-async-promise-executor": "error",
      "require-atomic-updates": "warn",
      // Comparaisons et conversions accidentelles.
      eqeqeq: ["warn", "smart"],
      "no-implicit-coercion": "off",
    },
  },
  {
    files: ES_MODULES,
    languageOptions: { sourceType: "module" },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: { ...globals.node } },
  },
];
