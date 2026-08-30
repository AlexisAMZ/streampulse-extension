# Reste à faire

État au commit `eba6094` (26.8.11). Chiffres mesurés sur le dépôt, pas estimés.

---

## 1. Traductions — FAIT

Les 16 langues sont complètes : 357 clés chacune, 0 clé manquante.
15 langues sont publiées (`ready: true`), seul `hi` (hindi) reste en
`ready: false` (10 % de chaînes encore identiques à l'anglais).

| Langue | Prête | | Langue | Prête |
|---|---|---|---|---|
| `fr` | ✅ | | `id` | ✅ |
| `en` | ✅ | | `nl` | ✅ |
| `es` | ✅ | | `hi` | ❌ (ready:false) |
| `pt-BR` | ✅ | | `sv` | ✅ |
| `de` | ✅ | | `cs` | ✅ |
| `it` | ✅ | | `tr` | ✅ |
| `pl` | ✅ | | `ru` | ✅ |
| `ja` | ✅ | | `ko` | ✅ |

Pour publier `hi` une fois traduit : passer `ready: true` dans
`i18n/translations.js`, puis `npm run verify`.

---

## 2. Page de notes de version — fait

Le cadre (`js/changelog.js`, `html/changelog.html`) est en place, les textes
sont des cartes par langue (4 langues publiées obligatoires), et `verify.mjs`
refuse une release avec des textes incomplets.

---

## 3. `_locales/` limité à 4 langues — partiel

`_locales/` contient `en`, `es`, `fr`, `pt_BR` (2 clés : nom et description de
la fiche Chrome Web Store). Les 12 autres langues voient la fiche en anglais.

Rien ne casse (`default_locale: "en"`), mais la fiche Store ne suit pas les
15 langues publiées dans l'interface. 24 traductions à faire (2 × 12), texte
marketing à soigner.

---

## 4. Vérifications non faites

Ces choses sont codées et passent les contrôles automatiques, mais n'ont
jamais été observées en fonctionnement :

- **Page de notes de version** — jamais vue s'afficher. Pour la tester :
  ouvrir `chrome-extension://<ID>/html/changelog.html`.
- **Correctif des notifications** — `createWithIconFallback` dans
  `js/background.js` doit supprimer l'erreur `Unable to download all specified
  images` quand l'avatar distant est bloqué. Non confirmé.
- **Rendu dans les langues non latines** — `ja`, `ko`, `ru` pas regardées
  visuellement. Les libellés longs peuvent déborder dans le popup et la topbar.

---

## 5. Idées de features (analyse Claude, à valider)

1. **Stats de session** (facile-moyen) : dashboard popup, points/heure, drops,
   temps par streamer. Données déjà collectées.
2. **Auto-clip sur événements** (moyen) : réactiver `autoClipDetector.js`
   (retiré) avec seuils configurables (raid, cheer, sub train).
3. **Alertes Discord/webhook** (moyen) : URL webhook pour notifs live/drop
   hors ligne.
4. **Multi-vues / mosaïque** (difficile) : plusieurs streams en grille.
5. **Historique drops/points ratés** (facile) : journal filtrable + export CSV.

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
