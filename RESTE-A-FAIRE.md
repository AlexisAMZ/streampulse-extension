# Reste à faire

État au commit `eba6094` (26.8.11), sections 1 à 5 mises à jour au 2026-10-01
(26.9.32). Chiffres mesurés sur le dépôt, pas estimés.

---

## 1. Traductions : FAIT

Les 11 langues sont complètes : 1079 clés chacune, 0 clé manquante, toutes
publiées (`ready: true`) : `fr`, `en`, `es`, `pt-BR`, `de`, `it`, `pl`, `tr`,
`ru`, `ja`, `ko`.

Les 5 langues du début (`id`, `nl`, `sv`, `cs`, `hi`) ont été retirées du
produit à la 26.9.30 : leurs traductions n'étaient pas assez complètes pour
être publiées. Pour ajouter une langue : créer `i18n/lang/<code>.js`,
l'importer dans `i18n/translations.js`, la déclarer (`ready: true`) dans
`i18n/meta.js`, puis `npm run verify`.

---

## 2. Page de notes de version : fait

Le cadre (`js/changelog.js`, `html/changelog.html`) est en place, les textes
sont des cartes par langue (les 11 langues publiées obligatoires), et `verify.mjs`
refuse une release avec des textes incomplets.

---

## 3. `_locales/` : fait

`_locales/` couvre les 11 langues de l'interface (2 clés chacune : nom et
description de la fiche Chrome Web Store), vérifié par `verify.mjs`
(`default_locale: "en"` reste le repli).

---

## 4. Vérifications non faites

Les trois points de la liste d'origine sont clos :

- la **page de notes de version** s'affiche à chaque release depuis la
  26.8.11 et accompagne chaque publication (`chrome-extension://<ID>/html/changelog.html`) ;
- les **langues non latines** (`ja`, `ko`, `ru`) sont rendues visuellement à
  chaque génération des captures store, et repassées à fond à la 26.9.30 ;
- le **correctif des notifications** (`createWithIconFallback`, aujourd'hui
  dans `js/sw/notifications.js`) est passé dans chaque release sans erreur
  signalée.

Reste à observer un jour, sur un vrai blocage d'avatar distant, que
`createWithIconFallback` supprime bien l'erreur « Unable to download all
specified images » — aucun signalement depuis sa mise en place.

---

## 5. Idées de features (analyse Claude de la 26.8.11, à revalider)

1. **Stats de session** (facile-moyen) : dashboard popup, points/heure, drops,
   temps par streamer. Données déjà collectées.
2. **Auto-clip sur événements** (moyen) : réactiver `autoClipDetector.js`
   (retiré) avec seuils configurables (raid, cheer, sub train).
3. **Alertes Discord/webhook** (moyen) : URL webhook pour notifs live/drop
   hors ligne.
4. **Multi-vues / mosaïque** (difficile) : plusieurs streams en grille.

L'idée « historique drops/points ratés » est réalisée depuis : onglet
Historique des lives ratés (26.9.15), panneau Points par chaîne et journal
des Drops (26.9.27).

---

## Commandes utiles

```bash
npm run verify   # 23 contrôles, dont complétude des 11 langues
npm run lint     # 0 erreur, 33 warnings préexistants
npm run build    # lint + zip depuis `git ls-files`

node scripts/build-inline-i18n.mjs   # après TOUTE modif des clés inject.*
node scripts/diff-translations.mjs <avant.js>
```

`build-zip.mjs` construit l'archive depuis `git ls-files` : un fichier non
committé n'est pas dans le zip, même s'il est référencé par le manifest.
`verify.mjs` détecte un `i18n-inline.js` périmé et fait échouer le build.
