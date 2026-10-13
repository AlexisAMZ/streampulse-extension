# Tâche 12 : conversion StreamPulse+ (compteur, écran clair, alertes Drops)

Date : 2026-10-13. Code exécuté sur streampulse-extension, synchronisé vers
streampulse-firefox. La facturation Stripe n'a pas été touchée (voir §4).

## 1. Ce qui existe déjà (constat avant travail)

L'essai gratuit existe déjà : le plan mensuel affiche « 7 jours gratuits,
sans engagement » (`popup.plus.monthlyNote`, popup et i18n). Rien à ajouter
côté extension ; le réglage réel se fait côté serveur de licences
(streampulse.tech) au moment de la création de l'abonnement Stripe.

## 2. Compteur de valeur (résiliation en moins)

Ce que Plus a rapporté, affiché aux abonnés dans le panneau « StreamPulse+
est actif » : badges farmés par le mode auto et Drops récupérés par la
récupération auto. Masqué tant que le total vaut zéro.

- `js/plus-value.js` : module pur (clé `streamPulsePlusValue`, formes
  normalisées, addition horodatée). Testé par `tests/plus-value.test.mjs`.
- `js/sw/plus-value.js` : écriture séquencée (même pattern que StatsStore).
- Comptage : `announceDrops` (js/sw/drops.js) compte les entrées d'historique
  avec `auto: true` quand Plus est actif ; le mode auto des badges
  (js/badge-auto-worker.js) compte chaque badge obtenu, hors badge gratuit
  du jour.
- Rendu : `renderPlusValue` (js/popup-features.js), rafraîchi sur
  `chrome.storage.onChanged`. Quatre clés i18n pour les pluriels
  (`popup.plus.value*`).

## 3. Écran Plus : comparaison Gratuit / Plus

La liste d'avantages est remplacée par un tableau : une ligne par fonction
(Drops, Badges, Alertes, Récap, Prédictions, Clips, Effets), colonnes
« Gratuit » et « StreamPulse+ ». Le strip des effets reste dans la dernière
ligne (`#plus-fx-strip`, alimenté par popup-identity.js ; `#plus-fx-count`
a disparu, son absence est prévue par le code). Ligne alertes mise à jour
pour citer les campagnes Drops. CSS : `.plus-compare*`, `.compare-*`,
`.plus-value`.

### 3 bis. La pastille Plus de la barre doit se comprendre d'un coup d'œil

Passe `clarify` du 2026-10-13 : la pastille fantôme « PLUS » ne se voyait ni
comme un bouton ni comme un abonnement. Elle devient un pill plein à
l'accent de marque (`var(--violet)`, survol `--violet-strong`) avec l'étoile
de la marque ; pour l'abonné, vert LCD (le « actif » du produit) et une
coche à la place de l'étoile. Infobulle et aria-label dynamiques :
« Découvrir l'abonnement StreamPulse+ » hors abonnement, « StreamPulse+ :
gérer mon abonnement » pour l'abonné (clés `popup.plus.open` /
`popup.plus.openActive`, 11 langues).

La barre était déjà saturée en allemand avec de gros compteurs (781/780 px
mesurés avant) : les espacements du cluster sont resserrés (gaps topbar 8,
onglets 9, cluster droit 4, marge du temps supprimée) pour absorber la
pastille plus large, et les deux valeurs de compteur sont plafonnées avec
ellipses (72 px) pour qu'un total qui s'allonge ne pousse jamais les boutons
d'action hors de la barre. Reste ouvert (décision produit, hors périmètre) :
en allemand ou en russe avec onglets longs ET compteurs chargés, la barre
reste trop juste ; compacter l'affichage des points dans la barre serait la
vraie réponse.

Vérifié sur le banc (scripts/dev/page-harness.html) : pas de débordement en
pire-cas onglets allemands et russes (780/780), pastille 64 px, états
inactif et actif contrôlés (is-active prouvé dans le DOM rendu). Le banc
rate parfois le chargement des modules (import dynamique) : relancer la
capture suffit.

### 3 ter. La colonne de droite de l'écran Plus défile

Signalement du 2026-10-13 : « on ne peut scroller qu'à gauche ». La rangée
du parrainage était bridée par `minmax(0, 1fr)` sans overflow et `.plus-view`
masquait le reste : le bas de l'offre et les récompenses de parrainage
étaient inatteignables. Correction : l'offre, ses variantes (appareil
saturé, abonné) et le parrainage sont regroupés dans un conteneur
`.plus-side` (colonne 2, une rangée) qui défile d'un bloc, scrollbar
masquée comme `.plus-main`. Mesuré sur sonde statique : contenu 519 px pour
502 visibles, le conteneur défile au lieu de couper.

## 4. Offre de reconquête : À FAIRE dans le Dashboard Stripe

Le compte Stripe connecté à la session est un environnement de test
(« AlexisAMZ.com ») sans prix StreamPulse+ ni configuration de portail :
le compte live n'était pas branché. La manipulation reste à faire à la main
(5 minutes) ou en me confiant l'accès au compte live :

1. Dashboard live > Produits > Coupons : créer un coupon, par exemple
   `RECONQUETE-ANNUEL`, 30 % de réduction, une seule utilisation par client,
   applicable au prix annuel.
2. Dashboard > Settings > Billing > Customer portal : rubrique
   « Cancellations », champ « Retention Coupon » : sélectionner ce coupon.
   Résultat : au moment de résilier leur mensuel, les clients voient une
   offre avant que la résiliation soit définitive.
3. Option plus fine (si le compte y a accès) : Billing > Retention rules
   pour cibler par motif de résiliation ou ancienneté.
4. Le portail étant ouvert par le serveur de licences
   (`action: "portal"`, js/plus.js), aucune modification d'extension :
   la configuration du portail s'applique à toutes les sessions.

## 5. Alertes de campagnes Drops (StreamPulse+)

« Préviens-moi quand une campagne démarre sur Valorant, CS2… »

- `js/drop-alerts.js` : module pur, testé (`tests/drop-alerts.test.mjs`).
  Réglages `{ enabled, games }` (clé `streamPulseDropAlerts`, 12 jeux au
  plus) et campagnes déjà signalées (clé `streamPulseDropAlertsSeen`,
  400 au plus, purge quand une campagne sort de la liste).
  Premier passage muet : les campagnes en cours au moment du réglage sont
  notées sans alerte. Une campagne démarrée depuis plus de 7 jours n'est
  jamais une actu. Correspondance des jeux : mêmes règles que les badges
  (`sameGame` : accents, casse, jeu englobé).
- Service worker : `checkDropCampaignAlerts` (js/sw/drops.js), appelé à
  chaque liste de campagnes enregistrée (`recordDropsCampaigns`). La liste
  des campagnes est relue par les onglets Twitch (Twitch refuse la liste au
  service worker sans en-tête Client-Integrity) : l'alerte part quand la
  liste se rafraîchit, au plus 3 d'un coup, une seule fois par campagne,
  notification cliquable vers le répertoire Drops du jeu.
- Popup : bloc « Alertes Drops » dans l'onglet Drops, sous les Drops en
  cours : verrouillé hors Plus (bouton Débloquer), sinon interrupteur plus
  chips de jeux (classes smart-terms réutilisées). js/popup-drops.js.

## 6. Non retenu pour l'instant (backlog)

Par ordre de demande : farm auto des Drops sur plusieurs jeux à la suite ;
statistiques de visionnage poussées (par streamer et par jeu, classement du
mois, image partageable) ; synchronisation entre navigateurs et appareils.
Chacune est un chantier lourd, à chiffrer avant de promettre.

## 6 bis. Notes de version : ne pas annoncer ce qui passe en payant

Sur décision du 2026-10-13, l'entrée qui annonçait « la récupération auto
des Drops et l'ouverture auto de l'inventaire rejoignent StreamPulse+ » a
été retirée du changelog 26.10.11 (11 langues, les deux dépôts) : ne pas
mettre en avant ce qui était gratuit et devient payant évite les désaccords
et les mauvaises notes. L'information reste visible là où elle doit l'être :
le toggle porte son étiquette PLUS et l'écran Plus compare gratuit / Plus.
L'entrée sur l'écran comparatif a été adoucie dans la foulée
(« ce qui reste gratuit » : « ce qui est gratuit »).

## 7. Vérifications

Chrome : `npm run verify` (23 contrôles), `npm test` (417), `npm run lint`,
`npm run build` (zip 26.10.11 régénéré). Firefox : mêmes scripts (21
contrôles, 427 tests), zip 26.10.11 régénéré. Version inchangée
(26.10.11) : la publication n'était pas encore partie, les entrées sont
rajoutées en tête de sa liste de changements.
