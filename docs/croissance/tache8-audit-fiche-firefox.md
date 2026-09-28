# Tâche 8 — Fiche Firefox (addons.mozilla.org) vs fiche Chrome

Date : 2026-09-28. Audit fait depuis l'API publique AMO v5, les pages AMO et
CWS, et les captures téléchargées. Le portage lui-même est à jour (26.9.29
sur AMO, en avance même sur CWS 26.9.28) : seul l'habillage de la fiche est
en retard. Voici les écarts, à corriger dans la console AMO (action manuelle).

## Écarts constatés, par impact décroissant

1. **Recherche AMO : quasi invisible sur ses propres mots-clés.**
   « twitch drops » → position ~14/25 (page 1). « channel points » →
   ~43 (page 2). « kick » → ~45 (page 2), alors que « Kick » est dans le nom
   de l'extension. Causes : tags AMO limités à `chat, social media,
   streaming, twitch` — ni `kick`, ni `youtube`, ni `drops`, ni
   `channel points` — et seulement 4 utilisateurs quotidiens (la popularité
   pèse dans le classement AMO).
   → Action console : ajouter les tags `kick`, `youtube`, `drops`,
   `channel points`, `notifications`. C'est gratuit et immédiat.

2. **Captures en anglais sur la fiche française.** CWS-fr montre 5 écrans en
   français ; AMO-fr montre les mêmes 5 écrans en anglais, badge « CHROME
   EXTENSION » en plus. → Action : générer des captures localisées sans le
   badge « Chrome » (`npm run store:assets` produit les écrans localisés ;
   un badge « Firefox » ou neutre est à faire, le pipeline actuel écrit
   « Chrome extension »).

3. **Locales à moitié vides : cs, nl, sv-SE.** Nom et résumé présents mais
   tronqués à la limite AMO de 50 caractères en plein mot (« …Punten & Dro »),
   description absente (retombe sur l'anglais). CWS, lui, ne propose pas ces
   langues du tout (repli anglais propre). → Action : soit compléter les 3
   langues (description traduite), soit les retirer de la fiche AMO pour
   éviter l'impression de chantier.

4. **Nom de la fiche moins riche que Chrome.** AMO-fr : « StreamPulse :
   Alertes Twitch, Kick & YouTube » (49 car., limite AMO 50). CWS-fr contient
   en plus « Points & Drops ». → Action : tester « StreamPulse : alertes,
   points & Drops Twitch » (48 car.) — garde le nom, ajoute deux mots-clés.

5. **Incohérence de licence.** Description = « tout le code est public sur
   GitHub sous licence GPL v3 » ; champ licence AMO = « Tous droits
   réservés ». → Action : mettre la fiche en cohérence avec la licence réelle
   du dépôt (LICENSE : GPL v3 si c'est confirmé, sinon corriger la
   description).

6. **Aucun avis, 1 note à 0.** Rien à faire côté fiche : la demande d'avis
   dans l'extension (tâche 1) couvre Firefox via l'URL AMO déjà ciblée par
   `popup-review.js`. Avec 4 utilisateurs quotidiens, le déclenchement des
   variantes `momentum`/`firstSuccess` est le seul levier réaliste ici.

7. **Identité développeur divergente.** AMO : « AlexisAMZ ». CWS : « AMZ
   CORPORATION » avec adresse. Pas un problème fonctionnel ; à savoir pour la
   cohérence de marque.

## Ce qui est déjà bon

- Version publiée à jour (26.9.29, 1,62 Mo, 2026-09-27) — le portage est
  maintenu, c'était le principal.
- 14 locales sur nom+résumé (cs, de, en-US, es-ES, fr, it, ja, ko, nl, pl,
  pt-BR, ru, sv-SE, tr) : plus que CWS qui en expose 11.
- 5 captures au bon format 1280×800, catégories pertinentes, description
  longue complète et traduite en 11 langues.

## Priorité

Les points 1 et 4 (tags + nom) sont les deux seuls à effet immédiat sur la
découverte, et prennent dix minutes dans la console. Le point 2 (captures
localisées) demande un ajustement du pipeline d'assets avant d'être utile.
La croissance réelle sur Firefox restera lente tant que le nombre
d'utilisateurs est de 4 — la fiche n'est pas le goulot principal, mais autant
qu'elle soit propre puisque le travail technique est payé.
