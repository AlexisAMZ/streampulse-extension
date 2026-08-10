# Reste à faire

État au commit `bbdf631` (16 langues + page de notes de version).
Chiffres mesurés sur le dépôt, pas estimés.

---

## 1. Traduire les 12 nouvelles langues — reporté, ne bloque pas la publication

Décision : on publie avec les 4 langues déjà traduites (`fr`, `en`, `es`,
`pt-BR`). Les 12 autres restent en `ready: false`, donc absentes du sélecteur —
un Chrome en allemand tombe sur `de` et voit de l'anglais, exactement comme
avant leur ajout. Rien de cassé côté utilisateur, rien qui bloque la soumission.

La structure est complète et `npm run verify` passe, mais les chaînes sont encore
de l'anglais recopié.

Part de chaînes identiques à l'anglais, sur 289 :

| Langue | Non traduit | | Langue | Non traduit |
|---|---|---|---|---|
| `de` Deutsch | 100 % | | `id` Indonesia | 100 % |
| `it` Italiano | 100 % | | `nl` Nederlands | 100 % |
| `pl` Polski | 100 % | | `sv` Svenska | 100 % |
| `cs` Čeština | 100 % | | `tr` Türkçe | 99 % |
| `ru` Русский | 99 % | | `ja` 日本語 | 99 % |
| `ko` 한국어 | 99 % | | `hi` हिन्दी | 99 % |

Les 4 langues d'origine sont saines : `fr` 11 %, `es` 7 %, `pt-BR` 7 % — et ce
résidu est normal (« StreamPulse », « Twitch », « OFFLINE », les termes qu'on ne
traduit pas).

Volume réel : **~86 500 caractères** pour les 12 langues (7 212 par langue). La
clé DeepL Free du `.env` couvre 500 000 caractères par mois, donc largement de
quoi faire.

Points de vigilance vérifiés en amont :

- **39 chaînes contiennent des placeholders** `{{count}}`, `{{name}}`,
  `{{platform}}`. DeepL les préserve avec `tag_handling: html`, mais ça doit être
  revalidé après coup.
- **5 chaînes contiennent du HTML** (`<strong>`, `<a href>`) — même paramètre.
- **9 chaînes font 3 caractères ou moins** (`Add`, `Yes`, `No`, `all`, `--`).
  Sans contexte, une traduction automatique se trompe facilement.
- `background.badge.live` est une **fonction** de pluralisation, pas une chaîne.
  Elle ne doit pas passer dans le traducteur.
- Utiliser `formality: prefer_less` (tutoiement) sur les 9 langues qui le
  supportent : `de it pl ru ja nl es pt-BR fr`. Les 7 autres l'ignorent.
- Normaliser les tirets cadratins `–` `—` en sortie : DeepL en insère, les règles
  du projet les interdisent.
- Verrouiller par glossaire : `StreamPulse`, `Twitch`, `Kick`, `Drops`, `raid`,
  `clip`, `bits`.

Après la passe, valider avec l'outil déjà en place :

```bash
node scripts/diff-translations.mjs <sauvegarde-avant.js>
npm run verify
```

`diff-translations.mjs` compare les fonctions sur leur **résultat** et non leur
source, donc un reformatage ne produit pas de faux positif.

---

## 2. Page de notes de version — fait

**Le cadre** (`js/changelog.js`, `html/changelog.html`) : les libellés passent par
un bloc `changelog.*` dans `translations.js`, et la date suit
`resolveLocale(getCurrentLanguage())` — donc la langue choisie dans StreamPulse,
pas celle du navigateur.

**Le contenu** (`js/changelog-data.js`) : question tranchée, chaque texte est une
carte par langue.

```js
title: { fr: "...", en: "...", es: "...", "pt-BR": "..." }
```

Concerne `title`, `subtitle`, `changes[].text` et `thanks[].for`. La lecture passe
par `pickLocalized(value, lang)`, qui retombe sur l'anglais quand la langue
demandée manque — c'est ce que voit un Chrome en allemand, qui résout vers `de`.

Un contrôle `verify.mjs` refuse désormais une release dont un texte ne couvre pas
les 4 langues publiées, ou qui serait restée en chaîne simple :

```
FAIL  js/changelog-data.js: 26.8.8 changes[0].text misses es
FAIL  js/changelog-data.js: 26.8.8 subtitle is a plain string, not a { fr, en, ... } map
```

Vérifié en déclenchant les deux cas volontairement. Conséquence pour les
prochaines releases : les notes se rédigent en 4 langues, sinon le build échoue.
Et si une 5ᵉ langue passe `ready: true`, toutes les entrées existantes deviennent
incomplètes tant qu'elles ne sont pas complétées.

---

## 3. `_locales/` limité à 4 langues

`_locales/` ne contient que `en`, `es`, `fr`, `pt_BR`, avec 2 clés chacun :
`appName` et `appDesc`. Ce sont le **nom et la description de la fiche Chrome Web
Store**, pas l'interface.

Rien ne casse — `default_locale: "en"` assure le repli — mais la fiche Store
s'affiche en anglais pour les 12 nouvelles langues, alors que l'extension se
présentera comme localisée.

Peu de travail : 2 chaînes × 12 langues = 24 traductions. C'est du texte
marketing, donc il vaut mieux le soigner ou le reprendre du site.

---

## 4. Publier les langues une par une

Résolu sur le plan technique. `i18n/translations.js` expose deux listes :

- `ALL_LANGUAGES` — les 16, chacune avec un drapeau `ready`
- `AVAILABLE_LANGUAGES` — les seules `ready: true`, c'est ce que lit le sélecteur

Aujourd'hui seules `fr`, `en`, `es`, `pt-BR` sont publiées. Les 12 autres restent
résolvables (un Chrome en allemand tombe bien sur `de`, qui affiche l'anglais),
mais ne sont pas proposées dans le sélecteur.

Pour publier une langue une fois traduite, une seule ligne à changer :

```js
{ code: "de", label: "Deutsch", ready: true },
```

Puis `npm run verify`. Un garde-fou refuse une langue marquée `ready` dont plus
de 50 % des chaînes sont encore identiques à l'anglais :

```
FAIL  translations.js "de" is marked ready but 100% of its strings
      are identical to English — set ready:false until it is translated
```

Rien d'autre à toucher : popup et onboarding lisent `getAvailableLanguages()`.

---

## 5. Vérifications non faites

Ces choses sont codées et passent les contrôles automatiques, mais n'ont **jamais
été observées en fonctionnement** :

- **Page de notes de version** — jamais vue s'afficher. Elle s'ouvre après une
  mise à jour. Pour la tester directement, relever l'ID sur `chrome://extensions`
  puis ouvrir `chrome-extension://<ID>/html/changelog.html`.
- **Correctif des notifications** — `createWithIconFallback` dans
  `js/background.js` doit supprimer l'erreur `Unable to download all specified
  images` quand l'avatar distant est bloqué. Non confirmé de ton côté.
- **Rendu dans les langues non latines** — `ja`, `ko`, `hi`, `ru` n'ont pas été
  regardées visuellement. Les libellés longs en allemand et les scripts non
  latins peuvent déborder dans le popup et la topbar.

---

## Ordre suggéré

Avant la soumission : point 5 uniquement (voir la page de notes s'afficher, et une
notification dont l'avatar échoue). C'est le seul risque réel de cette version.

Après, sans urgence : traduire les 12 langues (point 1), ce qui débloque le
point 4, puis compléter `_locales/` (point 3) pour les langues effectivement
publiées.

---

## Commandes utiles

```bash
npm run verify   # 11 contrôles, dont complétude des 16 langues
npm run lint     # 0 erreur, 33 warnings préexistants
npm run build    # lint + zip depuis `git ls-files`

node scripts/build-inline-i18n.mjs   # après TOUTE modif des clés inject.*
node scripts/diff-translations.mjs <avant.js>
```

`build-zip.mjs` construit l'archive depuis `git ls-files` : un fichier non
committé n'est pas dans le zip, même s'il est référencé par le manifest.
`verify.mjs` détecte un `i18n-inline.js` périmé et fait échouer le build.
