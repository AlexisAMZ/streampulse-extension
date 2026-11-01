# Localisation de StreamPulse

Tout ce qu’il faut pour traduire, vérifier et publier une langue. Les commandes prêtes à copier pour chaque nouvelle langue sont dans [LANGUES.md](LANGUES.md). L'audit de départ et les choix d'architecture sont dans [AUDIT.md](AUDIT.md), l'état chiffré de chaque langue dans [REPORT.md](REPORT.md) (`npm run i18n:report -- --out=localization/REPORT.md`).

## En bref

- **Source de vérité** : `i18n/lang/en.js`. L'anglais est la langue de référence ; chaque autre langue a son fichier `i18n/lang/<code>.js`, avec les mêmes clés.
- **Une seule API par contexte**, branchée sur ces fichiers :
  - pages de l'extension (popup, onboarding, changelog…) : `t()` et `tp()` de `js/i18n.js`, attributs `data-i18n` dans le HTML ;
  - service worker (notifications) : `translate()` et `translatePlural()` de `js/sw/i18n.js` ;
  - content scripts (Twitch, Kick, YouTube) : `window.__SP_I18N__.get()` et `.plural()`, généré dans `js/inject/i18n-inline.js` (clés `inject.*`) ;
  - manifeste et fiche du store : `_locales/<dossier>/messages.json` (3 clés) ;
  - notes de version : `js/changelog-data.js` (une phrase = un objet par langue).
- **Repli** : une clé absente d'une langue s'affiche en anglais, jamais en clé brute. Une langue pas encore publiée (`ready: false` dans `i18n/meta.js`) n'apparaît pas dans le sélecteur.
- **Outillage** : `scripts/i18n/` (Node, local uniquement, jamais dans le zip). Point d'entrée : `node scripts/i18n/cli.mjs`.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run i18n:check` | État par langue : manquantes, obsolètes, en attente, relues, approuvées, erreurs. Lecture seule. `-- --locale=uk` détaille. |
| `npm run i18n:validate` | Contrôle d'intégrité de toutes les langues (code 1 en cas d'erreur). Lancé par `npm test` et `npm run verify`. `-- --verbose` montre les avertissements. |
| `npm run i18n:extract` | Clés utilisées mais absentes, clés jamais référencées, textes visibles écrits en dur. `-- --strict` échoue sur un texte en dur non listé dans `extract-allowlist.json`. |
| `npm run i18n:translate` | Traduit avec DeepL ce qui manque ou est devenu obsolète. `-- --locale=de,es`, `-- --dry-run` pour chiffrer sans rien envoyer. |
| `npm run i18n:review` | Relecture par Claude des traductions en attente. |
| `npm run i18n:apply-review` | Applique un fichier de verdicts de relecture (`-- --locale=uk --file=…`). |
| `npm run i18n:approve` | Passe des traductions en « approved » (validation humaine). |
| `npm run i18n:sync` | Enregistre l'état déduit après une édition à la main (optionnel : `check` le calcule déjà). |
| `npm run i18n:report` | Rapport de couverture en Markdown (`-- --out=localization/REPORT.md`) ou JSON (`-- --json`). |
| `npm run i18n:pseudo` | Génère la pseudo-langue de test visuel. |
| `npm run i18n:add` | Déclare une nouvelle langue (`-- --locale=nl`). |
| `npm run i18n:publish` | Ouvre une langue dans le sélecteur si elle est complète et relue (`-- --unpublish` pour la retirer). |

Options communes : `--locale=a,b` (langues), `--keys=a.b,c.d` ou `--prefix=popup.drops` (clés), `--scope=ui,manifest,changelog` (pour `translate`).

## Ajouter une langue

Exemple avec le néerlandais (déjà préconfiguré dans `config.json`, rubrique `planned`, comme `zh-CN`, `pt-PT`, `sv`, `cs`, `id`) :

```bash
npm run i18n:add -- --locale=nl
npm run i18n:translate -- --locale=nl --dry-run
npm run i18n:translate -- --locale=nl
npm run i18n:review -- --locale=nl
npm run i18n:publish -- --locale=nl
npm run build
```

1. `add` déclare la langue partout où il faut (config de l'outillage, `i18n/meta.js` en `ready: false`, `i18n/translations.js`, fichier vide, i18n des content scripts). Pour une langue absente de `planned` : `-- --locale=xx --label="Nom natif" --deepl=XX` ([codes DeepL](https://developers.deepl.com/docs/getting-started/supported-languages)).
2. `translate --dry-run` donne le nombre de caractères à envoyer et le coût. Une langue complète représente environ 55 000 caractères, notes de version comprises (≈ 1,10 € au tarif payant, ou 11 % du quota gratuit mensuel).
3. `translate` remplit l'interface, le manifeste et le changelog. Tout arrive en statut « pending ».
4. `review` fait relire (voir plus bas), puis les corrections validées passent en « reviewed ».
5. `publish` refuse tant qu'il reste une clé manquante, une erreur de validation, une phrase de changelog absente ou une traduction en attente (`--force` pour passer outre l'attente seulement).
6. À vérifier à la main : la devise dans `js/currency.js` (`add` prévient si elle manque), les liens d'aide du site (`/xx/support` existe-t-il ?), les captures du store.

Aucun composant n'est à modifier : les pages lisent la langue choisie dans le registre.

## Ajouter ou modifier un texte

- **Nouveau texte** : ajouter la clé dans `i18n/lang/en.js`, l'utiliser via `t("namespace.cle")` ou `data-i18n="namespace.cle"`. Les autres langues retombent sur l'anglais en attendant. Puis `npm run i18n:translate` (ou écrire les traductions à la main), et `npm run i18n:review`.
- **Texte anglais modifié** : rien à déclarer. Les traductions de cette clé passent toutes seules en « outdated » (l'outillage compare l'empreinte de l'anglais). `translate` retraduit celles qui venaient d'une machine et **garde** celles écrites par un humain ou approuvées (`--include-human`, `--overwrite-approved` pour forcer). Si le changement anglais ne touche pas le sens (coquille), `npm run i18n:approve -- --locale=fr --keys=la.cle` confirme la traduction existante.
- **Traduction corrigée à la main** : éditer `i18n/lang/<code>.js`. `check` la verra « pending (modifiée hors outillage) » jusqu'à la relecture ou l'approbation. Rien n'est écrasé.
- **Pluriel** : écrire un groupe CLDR au lieu de deux clés.

  ```js
  // en.js
  rewards: { one: "{{count}} reward", other: "{{count}} rewards" },
  // uk.js : les catégories de la langue (Intl.PluralRules)
  rewards: { one: "{{count}} винагорода", few: "Нагород: {{count}}", many: "Нагород: {{count}}", other: "Нагород: {{count}}" },
  ```

  Et dans le code : `tp("popup.drops.rewards", n)` (pages), `translatePlural(lang, key, n)` (service worker), `__SP_I18N__.plural(lang, key, n)` (content scripts). Jamais `count === 1 ? … : …`. La forme `one` contient `{{count}}`, pas un « 1 » écrit en dur : en ukrainien elle sert aussi à 21, 31…
- **Dates, nombres, devises** : `Intl.DateTimeFormat`, `Intl.NumberFormat` avec `resolveLocale(getCurrentLanguage())`, pas de format écrit à la main.

## Statuts

Chaque traduction a un statut dans `localization/status/<code>.json` (généré, une ligne par clé) :

| Statut | Sens |
|---|---|
| `missing` | Absente : l'anglais s'affiche. |
| `pending` | Produite (DeepL, mémoire de traduction, édition à la main) et pas encore relue. |
| `reviewed` | Contrôlée : relue par Claude, ou traduction historique déjà en production. |
| `approved` | Validée par un humain. Jamais remplacée sans `--overwrite-approved`. |
| `outdated` | L'anglais a changé depuis. |

La provenance (`by`) dit qui a écrit le texte actuel : `legacy` (avant l'outillage), `manual`, `deepl`, `tm` (mémoire de traduction), `claude` (correction de relecture), `copy` (forme de pluriel recopiée, à accorder). Tout changement de statut ou de texte fait par l'outillage est consigné dans `localization/history.jsonl` (date, clé, ancien et nouveau texte, raison).

## Glossaire et termes protégés

- `protected-terms.json` : ce qui ne passe **jamais** au traducteur (marques, plateformes, sigles techniques, variables, balises, URL, e-mails, pseudos). Seuls ces fragments sont masqués : « Download your clip » se traduit en entier, « Twitch » reste « Twitch ». Un terme peut avoir des alias locaux (CHZZK = « 치지직 » en coréen) et des clés exemptées (« chrome » l'effet cosmétique).
- `glossary.json` : les termes du streaming qui **se traduisent**, mais toujours de la même façon dans une langue (badge → « emblema » en portugais, « значок » en ukrainien). Chaque entrée : définition, contexte, traduction validée, variantes acceptées (déclinaisons), traductions interdites. Il sert trois fois : glossaire DeepL envoyé avec chaque traduction, contrôle `glossary` de la validation, contexte donné à Claude en relecture.
- `rules.md` : registre et conventions par langue (tutoiement, vouvoiement, termes officiels de Twitch).

Modifier une traduction validée du glossaire : changer `glossary.json` avec une note qui dit pourquoi, puis `npm run i18n:validate -- --verbose` liste les chaînes qui ne suivent plus le glossaire.

## DeepL

- La clé se lit **uniquement** dans la variable d'environnement `DEEPL_API_KEY`. Elle n'est jamais écrite dans le dépôt, un fichier généré, un journal ni un message d'erreur, et n'atteint jamais l'extension (les scripts tournent en local, sous Node).

  ```bash
  export DEEPL_API_KEY="…:fx"
  ```

  Une clé qui finit par `:fx` passe par l'API gratuite, une autre par l'API payante.
- Coûts maîtrisés :
  - seules les clés manquantes ou obsolètes partent ;
  - une phrase anglaise déjà traduite dans la langue est reprise de la mémoire de traduction, gratuitement ;
  - chaque réponse est mise en cache dans `localization/.cache/deepl/`, donc un passage interrompu reprend là où il s'est arrêté ;
  - envoi par lots de 40 textes ;
  - `--dry-run` chiffre avant d'envoyer, et `--max-chars=N` plafonne un passage ;
  - chaque envoi est compté dans `localization/usage.jsonl`, repris par le rapport.
- Robustesse :
  - délai maximal par requête ;
  - nouvelles tentatives avec attente croissante sur 429 et 5xx ;
  - arrêt net, en gardant ce qui est fait, sur quota épuisé (456) ou clé refusée (403).
- Avant écriture, chaque traduction est revalidée. Une variable perdue, une balise cassée ou une marque traduite, et la traduction est rejetée : la clé reste manquante.

## Relecture par Claude

`npm run i18n:review -- --locale=uk` envoie les traductions en attente avec le glossaire et les règles de la langue :

- **avec `ANTHROPIC_API_KEY`** dans l'environnement : appel direct de l'API, par lots (modèle réglable dans `config.json` ou via `I18N_REVIEW_MODEL`) ;
- **sans clé** : un dossier `localization/.cache/review/<code>-<date>.json` est écrit. Demander à Claude Code de le relire et d'écrire les verdicts (`[{key, verdict: "ok" | "fix", suggestion, reason}]`), puis `npm run i18n:apply-review -- --locale=uk --file=…`.

Une suggestion n'est appliquée qu'après la même validation que DeepL. Une traduction approuvée n'est jamais modifiée : la suggestion est seulement affichée.

## Pseudo-localisation

```bash
npm run i18n:pseudo
```

Elle produit `localization/.cache/pseudo/en-XA.js` : chaque texte est accentué (Ŝéţţîñĝš), allongé de 40 % et encadré de ［ ］, sans toucher aux variables ni aux marques. Ensuite, servir la racine du dépôt (Portly : `StreamPulseMain/harness`) et ouvrir `/scripts/dev/popup-harness.html?pseudo=1&lang=en` (ajouter `&tab=menu` pour les réglages). Le banc affiche dans la console, et dans `window.__pseudoReport`, chaque texte visible sans crochet, c'est-à-dire qui ne passe pas par l'i18n. Un crochet coupé à l'écran signale un texte tronqué.

Ne pas « corriger » un débordement en rétrécissant le design pour une langue : vérifier d'abord l'effet sur toutes les autres.

## Arabe et droite-à-gauche

`ar` est déjà publiée. La page passe en `dir="rtl"` (`syncDocumentLanguage`), les chiffres restent latins (`ar-AE`), et le pluriel a six formes. Les formes `zero` de l'arabe sont en attente de relecture par un arabophone.

## Intégration continue

Le dépôt n'a pas de CI (GitHub suspendu, GitLab sans pipeline). Les contrôles tournent là où ils comptent : `npm test` (dont `tests/i18n-*.test.mjs`, qui lance `i18n:validate`) et `npm run verify`, tous deux exécutés par `npm run build` avant chaque zip. Aucun appel DeepL n'a lieu dans ces contrôles.
