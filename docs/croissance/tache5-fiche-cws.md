# Tâche 5 — Optimisation de la fiche Chrome Web Store

Date : 2026-09-28. Complément à `CHROMEWEBSTORE.md` (qui reste la référence ;
les textes ci-dessous s'y substituent champ par champ).

> Note (2026-10-01) : depuis la 26.9.30, le produit est en **11 langues**
> (`id`, `nl`, `sv`, `cs`, `hi` retirées). Les décomptes ci-dessous, écrits à
> la date du document, ont été actualisés pour décrire l'état courant.

Constat : la fiche est déjà traduite (15 langues à la date du document, 11
aujourd'hui) et bien structurée. Le
travail restant porte sur (1) la description courte, trop courte et liste de
fonctions plutôt que bénéfice, (2) la première capture, (3) la vérification
des langues dans la console.

## 1. Description courte — prête à copier (bénéfice d'abord, 132 caractères)

**FR** (131/132) — remplace l'actuelle (100/132) :

```text
Récupère tout seul tes Drops et points Twitch, t'alerte à chaque live, filtre le chat. Twitch, Kick & YouTube, une seule extension.
```

**EN** (129/132) — remplace l'actuelle (110/132) :

```text
Auto-claims your Twitch Drops & channel points, alerts you for every live, filters chat. Twitch, Kick & YouTube in one extension.
```

Pour les 13 autres langues : reprendre la structure « verbe d'action + Drops
/ points automatiques + alertes live + périmètre » dans la description courte
existante de chaque langue, en visant 125-132 caractères. Les descriptions
longues et les titres actuels restent valables (les titres FR et EN portent
déjà les mots recherchés : Twitch, Drops, Points, Alerts).

## 2. Captures — liste de ce qu'il faut reprendre

1. **À supprimer à la main dans la console** (onglet Éléments graphiques) :
   la capture portant « 100% Free and Free forever », motif du refus du
   2026-08-13 (Impersonation and Intellectual Property). Elle n'existe que
   dans le store, aucune régénération locale ne la retire.
2. **Première capture = tableau de bord**, car c'est l'écran le plus vu.
   Regénérer les captures localisées pour que la capture 1 ne soit plus la
   version anglaise manuelle partagée par les 11 dossiers :

   ```bash
   npm run store:assets   # les 11 langues
   ```

3. **Grande tuile promotionnelle** (`images/promo/marquee.png`, 1400×560) :
   toujours signalée « à générer » dans CHROMEWEBSTORE.md — à produire ou à
   retirer de la console si elle y est absente.
4. Vérifier qu'aucune capture ne porte de badge « gratuit / nouveau / n°1 »
   (liste interdite : `scripts/store-assets/policy.mjs`).

## 3. Langues de la fiche — checklist console

Le dépôt couvre 11 langues (DE, EN, ES, FR, IT, JA, KO, PL,
PT-BR, RU, TR). Dans la console, chaque langue doit avoir : nom,
description courte (nouvelle version), description longue, 3 captures. À
vérifier une par une, puis :

- [ ] aucune langue avec une description courte vide ou tronquée ;
- [ ] « hi » reste absent tant que `ready: false` dans `i18n/translations.js` ;
- [ ] la déclaration de confidentialité (section 4 de CHROMEWEBSTORE.md)
      reste inchangée.

## 4. Ce qui ne change pas

- Le titre FR/EN (60/75 et 58/75) : les mots recherchés y sont déjà, dans le
  bon ordre pour la marque d'abord.
- La justification des permissions (section 3) et la politique de
  confidentialité (section 5) : rien à modifier.
- Aucune contrepartie pour un avis, nulle part sur la fiche.
