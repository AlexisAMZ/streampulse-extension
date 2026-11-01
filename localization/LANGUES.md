# Ajouter une langue : commandes prêtes

Six langues sont déjà préconfigurées dans `config.json` (rubrique `planned`) : il suffit de copier leurs commandes. Détails et explications : [README.md](README.md).

Avant de commencer, une seule fois par terminal :

```bash
export DEEPL_API_KEY="ta-clé-deepl"
```

Chaque langue suit les mêmes 6 étapes : déclarer, chiffrer, traduire, relire, publier, construire. Coût d'une langue complète : environ 55 000 caractères DeepL (≈ 1,10 € en payant, ou 11 % du quota gratuit du mois).

## Néerlandais (nl)

```bash
npm run i18n:add -- --locale=nl
npm run i18n:translate -- --locale=nl --dry-run
npm run i18n:translate -- --locale=nl
npm run i18n:review -- --locale=nl
npm run i18n:publish -- --locale=nl
npm run build
```

## Chinois simplifié (zh-CN)

```bash
npm run i18n:add -- --locale=zh-CN
npm run i18n:translate -- --locale=zh-CN --dry-run
npm run i18n:translate -- --locale=zh-CN
npm run i18n:review -- --locale=zh-CN
npm run i18n:publish -- --locale=zh-CN
npm run build
```

## Portugais du Portugal (pt-PT)

```bash
npm run i18n:add -- --locale=pt-PT
npm run i18n:translate -- --locale=pt-PT --dry-run
npm run i18n:translate -- --locale=pt-PT
npm run i18n:review -- --locale=pt-PT
npm run i18n:publish -- --locale=pt-PT
npm run build
```

À savoir : tant que pt-PT n'existe pas, un navigateur réglé en portugais du Portugal reçoit le brésilien (pt-BR).

## Suédois (sv)

```bash
npm run i18n:add -- --locale=sv
npm run i18n:translate -- --locale=sv --dry-run
npm run i18n:translate -- --locale=sv
npm run i18n:review -- --locale=sv
npm run i18n:publish -- --locale=sv
npm run build
```

## Tchèque (cs)

```bash
npm run i18n:add -- --locale=cs
npm run i18n:translate -- --locale=cs --dry-run
npm run i18n:translate -- --locale=cs
npm run i18n:review -- --locale=cs
npm run i18n:publish -- --locale=cs
npm run build
```

## Indonésien (id)

```bash
npm run i18n:add -- --locale=id
npm run i18n:translate -- --locale=id --dry-run
npm run i18n:translate -- --locale=id
npm run i18n:review -- --locale=id
npm run i18n:publish -- --locale=id
npm run build
```

## Une langue qui n'est pas dans la liste

Donner son nom dans la langue et son code DeepL ([liste des codes](https://developers.deepl.com/docs/getting-started/supported-languages)). Exemple en hongrois :

```bash
npm run i18n:add -- --locale=hu --label="Magyar" --deepl=HU
```

Puis les mêmes étapes que ci-dessus, avec `--locale=hu`.

## Plusieurs langues d'un coup

`translate`, `review`, `check` et `report` acceptent une liste :

```bash
npm run i18n:translate -- --locale=nl,sv,cs --dry-run
npm run i18n:translate -- --locale=nl,sv,cs
```

`add` et `publish` se lancent une langue à la fois.

## Ce que chaque étape fait

| Étape | Effet |
|---|---|
| `add` | Déclare la langue partout, masquée dans le sélecteur (tout s'affiche en anglais en attendant). |
| `translate --dry-run` | Compte les caractères et le coût. N'envoie rien, n'écrit rien. |
| `translate` | Traduit l'interface, la fiche du store et les notes de version. Tout arrive « en attente ». |
| `review` | Relecture par Claude. Sans `ANTHROPIC_API_KEY`, écrit un fichier à me faire relire en session, puis `npm run i18n:apply-review -- --locale=xx --file=<verdicts>`. |
| `publish` | Rend la langue visible, mais refuse s'il reste une clé manquante, une erreur ou une traduction non relue. |
| `build` | Lint, tests, vérifications et zip. |

## Après publication, à faire à la main

- `js/currency.js` : associer la devise du pays (`add` prévient si elle manque).
- Site streampulse.tech : vérifier que la page d'aide `/xx/support` existe, sinon les liens pointent vers l'anglais.
- Captures du store dans la langue (DevKit).
- Une entrée dans `js/changelog-data.js` pour annoncer la nouvelle langue, dans toutes les langues publiées.

## Pour suivre où on en est

```bash
npm run i18n:check
npm run i18n:report -- --out=localization/REPORT.md
```
