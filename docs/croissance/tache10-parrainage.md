# Tâche 10 — Rendre le parrainage visible

Date : 2026-09-28. Code exécuté sur streampulse-extension, synchronisé vers
streampulse-firefox. La facturation Stripe n'a pas été touchée.

## 1. Ce qui a été ajouté côté extension

1. **Réglages → Général** : nouvelle entrée « Parrainage » (titre, une ligne
   de bénéfice, bouton « Voir mon code ») qui bascule sur l'onglet
   StreamPulse+ des réglages et fait défiler jusqu'au bloc complet (code
   AMI, gains, paliers, PayPal). Le bloc existant reste la source de vérité.
   - `html/popup.html` (bloc `referral-general-open` dans `#menu-general`) ;
   - `js/popup.js` (listener : clic sur l'onglet plus + scrollIntoView).
2. **Écran « Mon récap »** : mention discrète en fin de page, visible
   seulement si un code est déjà en cache, avec bouton « Copier mon code »
   (le filleul saisit le code AMI en code promo au paiement Stripe).
   - `html/recap.html` (`#recap-referral`), `js/recap.js`
     (`wireReferral`, lecture de `streamPulseReferralCode`), `css/recap.css`.
3. **i18n** : clés ajoutées dans les 11 langues publiées
   (`popup.referral.generalBody`, `popup.referral.generalOpen`,
   `recap.referral.body`, `recap.referral.copy` ; le « Code copié ! »
   réutilise `popup.referral.copied`). `npm run verify` (parité des langues)
   et les 208 tests passent.

Côté site, le parrainage est déjà visible sur `/plus` et `/en/plus`
(section `#parrainage`, règles complètes) — c'était la seule présence
publique, elle est conservée telle quelle.

## 2. Garde-fous côté serveur — relevé de code

Sources : `api/_referral.mjs`, `api/streampulse-license.mjs`,
`api/stripe-webhook.mjs` (dépôt streampulse-site) et la section règles de
`/plus`.

| Garde-fou | État | Où |
|---|---|---|
| Un ami ne compte qu'une fois, à son premier achat | ✅ verrou `sp:referral:lock:{customerId}` dans le webhook | stripe-webhook.mjs:89 |
| Auto-parrainage exclu | ✅ le parrain lu depuis le code promo ne peut pas être le client lui-même | _referral.mjs `referrerFromDiscounts` |
| Seul un parrain encore abonné gagne | ✅ `referralCredit({ referrerActive }}` | _referral.mjs:37 |
| Remboursement / litige → gain retiré | ✅ `reversalCents`, plafonné à ce que le filleul a réellement rapporté | _referral.mjs:86 |
| Versement PayPal dès 10 €, adresse e-mail validée | ✅ `PAYOUT_MIN_CENTS`, `normalizePaypal` | _referral.mjs:20,52 |
| Versement manuel par le propriétaire (pas d'automatisation) | ✅ `sp_ref_paid` écrit par script de versement | _referral.mjs:13 |
| Limite d'appareils (2 par clé) | ✅ `MAX_DEVICES`, +1 appareil au palier 5 filleuls | streampulse-license.mjs:362 |
| Limite par adresse PayPal ou par moyen de paiement | ⚠️ **absente** : le verrou est par client Stripe. Un même particulier peut créer plusieurs comptes clients (e-mails différents) | — |

### Recommandation sur l'écart restant

Le risque « comptes créés pour l'occasion » est réel mais borné : les gains
ne sortent que par versement PayPal **manuel**, ce qui est de fait le
dernier garde-fou (l'abus se voit sur le tableau Stripe avant de payer).
Si le volume augmente : refuser le code promo AMI quand la carte utilisée a
déjà servi pour un autre code AMI (règle Radar Stripe), et verser seulement
les parrains dont le solde provient d'au moins deux filleuls distincts ou
après vérification manuelle. Aucune de ces mesures ne touche l'extension.

## 3. Ce qui reste à décider (produit)

- Mentionner le parrainage sur la page d'accueil du site (aujourd'hui :
  /plus uniquement) — choix marketing, non fait pour ne pas surcharger la
  page pendant la consolidation SEO en cours.
- Afficher le potentiel de gains dans la popup hors StreamPulse+ (aujourd'hui
  l'entrée Général mène au bloc ; les gains ne se remplissent qu'avec une
  clé active).
