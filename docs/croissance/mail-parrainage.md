# Mail « Parrainage » aux abonnés et aux acheteurs à vie

Date du brouillon : 2026-10-19. Rien n'a été envoyé.

Règles reprises de `/plus#parrainage` et de `api/_referral.mjs` (StreampulseSite) :
l'ami a 2,99 € de remise (1er mois offert, ou 1re année à 16,01 € au lieu de 19 €) ;
le parrain gagne 1 €/mois payé par un ami mensuel, 5 € par ami annuel (ou à vie),
versés par PayPal dès 10 €, 30 jours après le paiement de l'ami (délai ajouté le 2026-10-19 pour laisser passer les litiges : à reporter sur /plus#parrainage) ; chaque ami = 1 mois offert sur l'abonnement mensuel ;
1 ami = effet de pseudo Ambassadeur, 3 = halo doré, 5 = un appareil de plus.
Un ami ne compte qu'une fois, à son premier achat ; seuls les parrains encore
abonnés (ou à vie) gagnent ; versements réservés aux majeurs.

Deux variantes, car « 1 mois offert sur ton abonnement » ne s'applique pas à l'achat à vie.

---

## Variante A — abonnés (mensuel / annuel)

**Objet :** Ton code de parrainage StreamPulse+ : 1 mois offert par ami

Salut,

Petit rappel : en tant qu'abonné StreamPulse+, tu as un code de parrainage
(il commence par AMI). Tu le trouves dans l'extension : Réglages, onglet StreamPulse+.

Comment ça marche :
- ton ami saisit ton code au paiement : il a 2,99 € de remise (son premier mois offert, ou sa première année à 16,01 € au lieu de 19 €) ;
- toi, tu gagnes 1 mois offert sur ton abonnement mensuel pour chaque ami, plus de l'argent sur PayPal : 1 € par mois payé par un ami mensuel, 5 € par ami annuel, versés dès 10 €, 30 jours après le paiement de ton ami ;
- en bonus : 1 ami débloque l'effet de pseudo Ambassadeur, 3 amis le halo doré, 5 amis un appareil de plus.

Un ami compte une seule fois, à son premier achat. Les gains d'un achat remboursé sont retirés.

Tu retrouves ton code, tes gains et ton adresse PayPal dans l'extension (Réglages, StreamPulse+).

Merci de faire vivre StreamPulse.
Alexis

Une question ? Réponds simplement à ce mail.

---

## Variante B — achat à vie

**Objet :** Tu as un code de parrainage StreamPulse+ (et il rapporte)

Salut,

Merci d'avoir pris StreamPulse+ à vie. Ton achat te donne aussi un code de
parrainage (il commence par AMI), dans l'extension : Réglages, onglet StreamPulse+.

Comment ça marche :
- ton ami saisit ton code au paiement : il a 2,99 € de remise (son premier mois offert, ou sa première année à 16,01 € au lieu de 19 €) ;
- toi, tu gagnes de l'argent sur PayPal : 1 € par mois payé par un ami mensuel, 5 € par ami annuel, versés dès 10 €, 30 jours après le paiement de ton ami ;
- en bonus : 1 ami débloque l'effet de pseudo Ambassadeur, 3 amis le halo doré, 5 amis un appareil de plus.

Un ami compte une seule fois, à son premier achat. Les gains d'un achat remboursé sont retirés.

Merci de faire vivre StreamPulse.
Alexis

Une question ? Réponds simplement à ce mail.

---

## English versions

### A — subscribers
**Subject:** Your StreamPulse+ referral code: 1 free month per friend

Hi,

A quick reminder: as a StreamPulse+ subscriber you have a referral code (it starts with AMI). Find it in the extension: Settings, StreamPulse+ tab.

- Your friend enters your code at checkout and gets €2.99 off: their first month free, or their first year for €16.01 instead of €19.
- You get 1 free month on your monthly plan per friend, plus PayPal earnings: €1 for every month a monthly friend pays, €5 per yearly friend, paid out from €10, 30 days after your friend's payment.
- Bonus: 1 friend unlocks the Ambassador username effect, 3 the Golden halo, 5 one more device.

A friend counts once, on their first purchase. Earnings from refunded purchases are removed.

Thanks for supporting StreamPulse.
Alexis

### B — lifetime
**Subject:** You have a StreamPulse+ referral code (and it pays)

Hi,

Thanks for getting StreamPulse+ for life. It also comes with a referral code (it starts with AMI) in the extension: Settings, StreamPulse+ tab.

- Your friend enters your code at checkout and gets €2.99 off: their first month free, or their first year for €16.01 instead of €19.
- You earn PayPal money: €1 for every month a monthly friend pays, €5 per yearly friend, paid out from €10, 30 days after your friend's payment.
- Bonus: 1 friend unlocks the Ambassador username effect, 3 the Golden halo, 5 one more device.

A friend counts once, on their first purchase. Earnings from refunded purchases are removed.

Thanks for supporting StreamPulse.
Alexis

---

## Avant d'envoyer

- Liste des destinataires : clients Stripe avec `sp_license`, séparés par `sp_plan` (monthly/yearly vs lifetime). Claude ne peut pas lire Stripe en production : un script à lancer par Alexis dans le Terminal.
- Envoi depuis streampulse.tech (domaine Resend vérifié), avec un lien de désinscription : c'est un mail commercial, pas la remise d'une clé.
- Traduire selon la langue du client (les mails de clé existent déjà en 15 langues dans `api/streampulse-license.mjs`) ; sinon FR pour les francophones, EN pour les autres.
- Envoyer d'abord un test à soi-même.
