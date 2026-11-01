# Audit i18n et migration du 1er novembre 2026

## Architecture trouvée

StreamPulse est une extension Manifest V3 en JavaScript natif, sans framework ni bundler : les pages chargent des modules ES directement, les content scripts sont des scripts classiques, le service worker est un module.

| Partie | Mécanisme en place | État |
|---|---|---|
| Popup, onboarding, changelog, récap, restauration, ajout en masse | `js/i18n.js` : `t()`, `data-i18n`, chargement paresseux de la langue choisie + anglais en repli clé par clé | Sain, déjà centralisé |
| Service worker (notifications) | `js/sw/i18n.js` via l'agrégateur `i18n/translations.js` | Sain |
| Content scripts Twitch, Kick, YouTube | `js/inject/i18n-inline.js` généré depuis les clés `inject.*` | Sain, sauf `js/previews/card.js` (voir plus bas) |
| Manifeste, fiche du store | `_locales/<dossier>/messages.json`, 3 clés | 13 dossiers |
| Notes de version | `js/changelog-data.js`, objets par langue | 168 phrases × 13 langues, complet |
| Registre | `i18n/meta.js` (`ALL_LANGUAGES`, `ready`) | 13 langues publiées |

Source unique : `i18n/lang/<code>.js`, 1 351 clés, toutes des chaînes, 13 langues complètes (fr, en, es, pt-BR, de, it, pl, tr, ru, ja, ko, ar, uk).

### Problèmes relevés

1. **Pluriels binaires** : onze paires `…Singular` / `…Plural` choisies par `count === 1` dans le code. C'est faux pour l'ukrainien, le russe et le polonais (21 est au singulier, 2 à 4 ont leur forme), pour l'arabe (six formes) et pour le français (0 est au singulier). L'ukrainien contournait habilement le problème avec des tournures « Libellé : {{count}} ».
2. **Quatre outils de traduction parallèles**, sans protection commune :
   - `translate.mjs` passait par une API Google Translate non officielle ;
   - `translate-deepl.mjs` ne gérait que l'ukrainien et réécrivait tout le fichier ;
   - `translate-changelog.mjs` avait une liste de langues figée ;
   - `write-locales.mjs` aurait réécrit `_locales` avec l'ancien nom « Twitch & Kick » et recréé des langues retirées (id, nl, sv, cs).
3. **Aucun suivi d'état** : impossible de savoir quelle traduction est relue, laquelle vient d'une machine, laquelle est devenue fausse après un changement de l'anglais.
4. **Un mini-système de traduction caché** : `js/previews/card.js` choisissait « Chargement... » ou « Loading... » d'après la langue de la page Twitch, et affichait « LIVE » en anglais partout.
5. **Textes en dur** : `aria-label="Progression"` (onboarding) et `aria-label="Code créateur ou promo"` (popup) étaient en français pour tous les lecteurs d'écran ; l'unité « ms » était figée.
6. **Description ukrainienne du manifeste trop longue** : 159 caractères, alors que le Chrome Web Store en accepte 132.
7. **Terminologie incohérente** sur l'écran StreamPulse+ : « badge » au lieu du terme du reste de l'interface en portugais (emblema), espagnol (insignia), allemand (Abzeichen), turc (rozet) et russe (значок au lieu de бейдж).
8. **Contrôle d'URL inopérant** : `scripts/lib/i18n-audit.mjs` cherchait encore `streampulse.fr`, alors que tout est passé sur `.tech`.

## Choix d'architecture

- **On garde `i18n/lang/<code>.js` comme format source** plutôt que des fichiers JSON par espace de noms. Ces fichiers sont déjà du JSON (écrits par `JSON.stringify`) enveloppé d'un `export default`. C'est ce qui permet au popup de les charger par `import()` et au service worker de les importer statiquement, sans `import … with { type: "json" }` que Firefox ne garantit pas. Les découper aurait multiplié les requêtes du popup pour aucun gain : les espaces de noms existent déjà comme premier niveau de clés (`popup`, `onboarding`, `inject`, `background`…).
- **Pas de bibliothèque i18n externe** (i18next, intl-messageformat). Le moteur existant fait déjà le chargement, le repli et l'interpolation en 300 lignes, sans dépendance, dans les trois contextes MV3. Le seul manque réel était le pluriel, couvert par `Intl.PluralRules`, standard et natif, avec les catégories CLDR. Ajouter une bibliothèque aurait imposé un bundler ou une copie vendue dans trois contextes d'exécution.
- **L'outillage vit à côté** : `scripts/i18n/` et `localization/`, exclus du zip (`build-zip.mjs` ne prend que les dossiers d'exécution).

## Migration effectuée

1. **État de référence** : chaque traduction existante enregistrée avec son empreinte et sa provenance `legacy`. Le français passe en `approved` (langue de l'auteur, langue d'origine de l'interface), les 11 autres en `reviewed` (en production, sans validation par un locuteur natif).
2. **Pluriels** : les 11 paires deviennent des groupes CLDR (`popup.history.count`, `popup.drops.rewards`, `inject.badge.months`…). Chaque texte existant est conservé tel quel dans la forme correspondante. Seul un « 1 » écrit en dur devient `{{count}}`, là où la catégorie `one` couvre d'autres nombres (21 en ukrainien, 0 en français). Les nouvelles catégories (`few`, `many`…) reprennent la forme plurielle existante, puis ont été relues.
3. **Code** : `tp()` dans `js/i18n.js`, `translatePlural()` dans `js/sw/i18n.js`, `__SP_I18N__.plural()` dans les content scripts, et les 11 appels `count === 1 ? … : …` remplacés.
4. **Textes en dur** : 5 nouvelles clés (`onboarding.stepperLabel`, `popup.settings.unitMs`, `inject.previews.live`, `inject.previews.loading`) et un attribut traduit de plus. `card.js` passe par l'i18n central (langue choisie dans StreamPulse, sinon celle de Chrome). `i18n-inline.js` est désormais chargé dans l'entrée Twitch des aperçus.
5. **Relecture** de toutes les traductions en attente dans les 12 langues : 231 contrôlées, 46 corrigées (45 par `i18n:apply-review`, plus la description ukrainienne), chacune journalisée dans `history.jsonl` avec sa raison.
   - 30 corrections de terminologie (écran StreamPulse+ en pt-BR, es, de, tr, ru) ;
   - 14 formes de pluriel arabes (duel, 11-99) ;
   - 1 accord polonais ;
   - la description ukrainienne du manifeste ramenée à 127 caractères.
6. **Anciens outils retirés** (`translate.mjs`, `translate-deepl.mjs`, `translate-changelog.mjs`, `write-locales.mjs`, `lib/i18n-audit.mjs`) et dépendance `@vitalets/google-translate-api` désinstallée. Ils restent dans l'historique git.

## Ukrainien

Aucune traduction ukrainienne n'a été remplacée. Sur 1 380 clés, toutes sont `reviewed` :

- les tournures « Libellé : {{count}} » de la première traduction sont gardées comme formes `few` et `many`, valides pour tous les nombres ;
- les formes `one` prennent `{{count}}`, ce qui rend « 21 місяць » juste ;
- 6 nouvelles chaînes ont été écrites et relues ;
- la description du store a été raccourcie (159 → 127 caractères) pour respecter la limite de 132.

La relecture par un locuteur natif reste à faire avant de passer les clés en `approved`.

## Limites connues

- 11 formes `zero` de l'arabe sont recopiées du pluriel et attendent un arabophone. Elles ne servent que pour 0, et l'interface n'affiche le plus souvent rien dans ce cas.
- `popup.plus.value*` combine deux nombres dans une phrase (badges et Drops). Ces clés n'ont pas été converties en pluriel : quatre variantes couvrent les cas avec 1.
- Il reste 171 avertissements de glossaire et 88 marques omises, surtout des reformulations. Le japonais et le coréen omettent souvent « StreamPulse » dans la phrase. C'est à arbitrer au cas par cas (`npm run i18n:validate -- --verbose`).
- En pseudo-langue (+40 %), les chips du Drop en cours et le champ de recherche passent en points de suspension, et deux libellés allemands (`popup.alertScope.label`, `popup.badgeScope.title`) font plus du double de l'anglais. Ce sont des avertissements, pas des débordements cassants : le design n'a pas été modifié.
- `js/inject/topbar.js` formate un nombre avec la langue du navigateur et non celle de StreamPulse (`toLocaleString()` sans locale). C'est sans effet visible sur les chiffres latins.
- Pas de CI : le dépôt n'en a pas. La barrière est `npm run build`, qui lance `verify` et `npm test`.
- Le port Firefox (`DevKit`, `sync-from-chrome`) doit reprendre l'ajout de `js/inject/i18n-inline.js` dans l'entrée Twitch des aperçus du manifeste.
