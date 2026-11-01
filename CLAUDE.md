# StreamPulseExtension

Instructions du projet pour Claude Code.

## Assets

Avant d'ajouter, de déplacer ou de renommer un asset (image, vidéo, logo, icône, capture, visuel ou texte de fiche de store), lire `memory/ASSET_ORGANIZATION.md`.
Les ressources marketing indépendantes vont dans `~/dev/_Vault/StreamPulse/` (règles : `~/dev/_Vault/MEMORY.md`). Ce qui est utilisé par le code, servi par URL ou écrit par un script reste dans ce dépôt.

## Traductions

Avant d'ajouter ou de modifier un texte visible, ou d'ajouter une langue, lire `localization/README.md`. L'anglais (`i18n/lang/en.js`) est la source ; les pluriels passent par `tp()` (groupes CLDR), jamais par `count === 1 ? … : …`. `npm run i18n:check` et `npm run i18n:validate` disent ce qui manque ou casse ; `npm run i18n:translate` (DeepL, clé dans `DEEPL_API_KEY`) ne remplit que le manquant et l'obsolète.
