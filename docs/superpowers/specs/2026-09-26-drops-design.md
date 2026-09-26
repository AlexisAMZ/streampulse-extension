# Suivi des Drops Twitch : conception

- **Date** : 2026-09-26
- **Demandé par** : Alexis
- **Statut** : implémenté en 26.9.28 (approche A, maquettes H2, P1, P2) ; reste à vérifier sur un vrai compte Twitch
- **Maquettes** : `.impeccable/drops-mockups.html` (non versionné)

## Objectif

Montrer où en sont les Drops Twitch sans ouvrir `twitch.tv/drops/inventory` :
progression des Drops en cours, Drops prêts ou récupérés, campagnes disponibles,
et, en StreamPulse+, l'historique de tous les Drops obtenus. Remplacer au
passage le compteur « Drops aujourd'hui », masqué depuis qu'il comptait des
clics au lieu de vrais Drops.

## Périmètre

**Dans la v1**

- Twitch uniquement.
- **Accueil (maquette H2, gratuit)** : bande fine au-dessus de la grille des
  lives.
- **Panneau Drops (maquette P1, gratuit)** : nouvelle entrée des Réglages, juste
  après « Points ». Drops en cours, Drops prêts ou récupérés, campagnes avec
  filtres.
- **Historique (maquette P2, StreamPulse+)** : Drops obtenus, mois par mois.
  En gratuit, un encart StreamPulse+ prend sa place.
- Compteur « Drops du jour » de l'accueil rétabli, alimenté par les vrais
  événements `drop-claim`.
- Le suivi commence à l'installation de la version. Aucun historique
  rétroactif (l'inventaire Twitch ne date pas les récompenses de façon fiable).

**Hors v1**

- Kick (ses Drops passent par un autre système).
- Maquette H1 (pastille) : écartée au profit de H2.
- Campagnes annoncées avant leur début : Twitch n'en envoie aucune, le filtre
  « À venir » n'affiche que ce que Twitch expose déjà (souvent 0).
- Changer de chaîne tout seul pour faire avancer un Drop (« farming ») : hors
  de l'esprit de l'extension et contraire aux conditions de Twitch.
- Liaison de compte éditeur (« Connecter le compte ») : on affiche le lien
  Twitch, on ne l'automatise pas.

## Faits établis (vérifiés sur twitch.tv le 2026-09-26)

- **Temps réel** : Twitch pousse sur Hermes (même WebSocket que les points) des
  messages `drop-progress` (minutes regardées, `drop_id`,
  `current_progress_min`, `required_progress_min`) et `drop-claim`
  (`drop_instance_id`, `drop_id`, `channel_id`) sur le sujet
  `user-drop-events.<userId>`. `drop-claim` annonce qu'un Drop est **prêt** à
  récupérer (avec l'identifiant à envoyer), pas qu'il a été récupéré. **Forme
  exacte à confirmer par une capture réelle**, comme pour `points-earned`.
- **Inventaire** : la requête GraphQL brute
  `currentUser.inventory.dropCampaignsInProgress` (avec `timeBasedDrops`,
  `self.currentMinutesWatched`, `self.dropInstanceID`, `self.isClaimed`,
  `benefitEdges.benefit.distributionType`) est **acceptée** avec les en-têtes
  de la page (`Client-Id`, `Authorization: OAuth`) **sans** `Client-Integrity`.
- **Liste des campagnes** : `currentUser.dropCampaigns` est **refusée**
  (« failed integrity check ») sans `Client-Integrity`. Deux sources possibles :
  1. l'en-tête `Client-Integrity` capté sur une requête GraphQL de Twitch ;
  2. le cache Apollo `window.__APOLLO_CLIENT__.cache` sur `/drops/campaigns`
     (177 campagnes lues : 150 `ACTIVE`, 27 `EXPIRED`).
- **Récupération** : mutation `claimDropRewards` avec `dropInstanceID`.
- **Existant** :
  - `js/channelPointsClaimer.js` clique déjà les boutons « Réclamer » visibles
    (préférence `autoClaimDrops`) et envoie `incrementStat dropsClaimed`. Ce
    compte vient d'un clic DOM, pas d'une confirmation Twitch.
  - `background.js` rouvre `twitch.tv/drops/inventory` à intervalle
    (`autoOpenInventory`) pour faire apparaître ces boutons.
  - `js/inject/points-bridge.js` écoute déjà les WebSocket de Twitch dans le
    monde `MAIN`.

## Architecture

```
page Twitch (monde MAIN)                 extension (isolé)            service worker                 pages
─────────────────────────                ─────────────────            ──────────────                 ─────
js/inject/points-bridge.js  ─┐                                                                      popup :
  + marqueurs drop-progress  ├─postMessage─▶ js/dropsRecorder.js ─▶ js/drops-store.js ──▶ storage ──▶ js/popup-drops.js
    et drop-claim            │                 valide, relaie        (js/drops-data.js)              (bande H2 + panneau)
js/inject/drops-bridge.js  ──┘                                        + GraphQL inventaire
  capte Client-Integrity,                                             + claimDropRewards
  lit le cache Apollo
```

Un seul écrivain : le service worker. Les pages lisent le stockage et appellent
les fonctions pures de `js/drops-data.js`.

### 1. Capture temps réel : extension du pont existant

On ne crée pas un deuxième `Proxy` de `WebSocket` : `points-bridge.js` gagne
une liste de marqueurs (`points-earned`, `drop-progress`, `drop-claim`). Même
filtre bon marché, même extraction générique, même file de 50 événements. Les
messages drops sortent avec `source: "streampulse:drops"`.

### 2. Accès GraphQL : `js/inject/drops-bridge.js`

Script monde `MAIN`, `document_start`, cadre principal, protégé contre la double
injection.

- Enveloppe `window.fetch` : pour chaque requête vers `gql.twitch.tv/gql`, lit
  (sans le modifier) l'en-tête `Client-Integrity` et le `Client-Id`, et les
  garde en mémoire de page. Ils ne sont jamais écrits dans le stockage.
- Sur `/drops/campaigns` et `/drops/inventory`, lit le cache Apollo une fois la
  page chargée et transmet les campagnes (`streampulse:drops`, `kind:
  "campaigns"`).
- Sur demande du relais (`kind: "fetchCampaigns"`), rejoue
  `currentUser.dropCampaigns` avec l'en-tête capté. En cas de refus
  d'intégrité, on ne réessaie pas : la source Apollo reste la seule.
- Tout est dans des `try/catch` : le pont ne lève jamais d'exception dans le
  code de Twitch.

Pourquoi dans la page : `Client-Integrity` et le jeton OAuth appartiennent à la
page. Les sortir vers le service worker ferait voyager un secret de session ;
on préfère faire les requêtes depuis la page et ne transmettre que les
résultats.

### 3. Relais : `js/dropsRecorder.js`

Content script isolé, `document_start`.

- N'accepte que `event.source === window` et `data.source === "streampulse:drops"`.
- Lit la préférence `dropsTracking` (vraie par défaut). Fausse : rien n'est
  relayé.
- `drop-progress` et `drop-claim` → `recordDropEvent`. Campagnes →
  `recordDropCampaigns`. Inventaire → `recordDropInventory`.
- Déclenche une lecture d'inventaire (`inventory` dans le pont) au chargement
  d'un onglet Twitch, puis toutes les 5 minutes tant que l'onglet est visible,
  et à chaque `drop-claim`.

### 4. Données : `js/drops-data.js` (module pur, testé)

Aucun accès à `chrome.*` ni au DOM.

- `normalizeInventory(raw, now)` → Drops en cours :
  `{ dropId, instanceId, campaignId, name, game, channel, image, minutes, required, endsAt, claimed, claimable }`.
  `claimable` = `minutes >= required && !claimed && instanceId`.
- `normalizeCampaign(raw)` → `{ id, name, game, gameBoxArt, owner, startsAt, endsAt, status, rewardCount, isBadge, channels, accountLinkUrl }`.
  `isBadge` si toutes les récompenses ont `distributionType: "BADGE"`.
- `applyProgress(state, event)` : met à jour `minutes` d'un Drop en cours à
  partir de `drop-progress`, sans attendre la prochaine lecture d'inventaire.
- `applyEvent(progress, event, now)` : `drop-progress` fait avancer le Drop,
  `drop-claim` le rend prêt (`instanceId`). Un Drop inconnu (`known: false`)
  relance la lecture de l'inventaire, au plus une fois toutes les 2 minutes.
- `applyClaim(progress, history, instanceId, now, auto)` : le Drop récupéré
  quitte la progression et entre dans l'historique (clé `drop:<dropId>`).
- `applyInventory(...)` : un Drop vu en cours puis récupéré (hors
  StreamPulse, par exemple sur mobile), ou une récompense datée
  (`gameEventDrops.lastAwardedAt`) postérieure au début du suivi, entre dans
  l'historique. Une récompense déjà comptée par une récupération (même
  récompense à moins de 2 h) n'est pas ajoutée deux fois.
- `filterCampaigns(campaigns, filterId, now, myGames)` :
  - `all` : campagnes `ACTIVE` ;
  - `new` : commencées depuis moins de 3 jours ;
  - `ending` : se terminent dans moins de 48 h ;
  - `upcoming` : `startsAt > now` ;
  - tri : jeux de `myGames` d'abord (liseré violet), puis fin la plus proche.
- `countFilters(...)` : compteurs affichés sur les filtres.
- `summarizeHistory(history)` → mois (`AAAA-MM`, heure locale) avec total et
  lignes `{ name, game, channel, at }`, plus le total depuis l'installation.
- `dropsToday(history, now)` : nombre de Drops obtenus ce jour (heure locale),
  pour le compteur de l'accueil.
- `prune(state, now)` : campagnes `EXPIRED` depuis plus de 7 jours retirées ;
  historique gardé 400 jours et 2 000 entrées au plus.

**« Tes jeux »** : catégories regardées ces 30 derniers jours, tirées des
données de temps de visionnage déjà agrégées par `recap-data.js` (`games`).
Aucune nouvelle collecte.

**Stockage** (`chrome.storage.local`) :

- `streamPulseDropsProgress` : `{ updatedAt, drops: [...] }` (état courant, non sauvegardé).
- `streamPulseDropsCampaigns` : `{ updatedAt, source: "apollo" | "gql", campaigns: [...] }` (cache, non sauvegardé).
- `streamPulseDropsHistory` : `[{ key, instanceId, dropId, benefitIds, name, game, channel, image, at, auto }]`, le plus récent en tête. **Ajouté à `BACKUP_KEYS`**.
- `streamPulseDropsSince` : début du suivi ; aucune récompense antérieure n'entre dans l'historique.

### 5. Service worker : `js/drops-store.js`

Module importé par `background.js`, sur le modèle de `points-store.js`.

- File sérialisée pour toutes les écritures.
- `recordDropEvent`, `recordDropCampaigns`, `recordDropInventory` →
  fonctions de `drops-data.js`, puis écriture.
- **Récupération automatique** : si `autoClaimDrops` est actif et qu'un Drop
  devient prêt, la réponse du store à l'onglet qui a relayé l'inventaire (ou
  l'événement) contient son `instanceId` ; un verrou de 2 minutes empêche un
  second onglet de le récupérer aussi. Le relais demande alors au pont
  d'appeler `claimDropRewards`. Succès (`ELIGIBLE_FOR_ALL` ou
  `DROP_INSTANCE_ALREADY_CLAIMED`) : entrée d'historique avec `auto: true`,
  compteur `dropsClaimed`, journal d'événements et notification (`dropAlerts`,
  3 au plus par lecture, jamais pour un Drop de plus d'une heure). L'auto-clic
  DOM de `channelPointsClaimer.js` reste en secours, mais **n'incrémente plus
  `dropsClaimed`** : il demande une relecture de l'inventaire de l'onglet
  (message `dropClaimedByClick`), qui compte le Drop avec son nom. Sans le
  suivi des Drops, l'ancien compteur fondé sur le clic est conservé.
- `autoOpenInventory` reste disponible mais devient inutile quand un onglet
  Twitch est ouvert ; son libellé l'indique.

### 6. Écrans

Code dans le nouveau `js/popup-drops.js` (et non `popup.js`), initialisé comme
`popup-points.js` (`initDrops({ isPlus, onPlusChange, openPlus })`).

**Bande « Drops en cours » (H2)**, au-dessus de la grille des lives :

- Icône de la récompense, nom, « jeu · sur chaîne · finit dans N j », barre
  `32 / 60 min`, temps restant, « +N autre(s) › » s'il y a plusieurs Drops en
  cours. Un clic ouvre le panneau Drops.
- Drop le plus proche de la fin affiché en premier.
- Masquée s'il n'y a aucun Drop en cours ni récupéré dans l'heure. Juste après
  une récupération : « 🎁 1 Drop récupéré · <nom> » pendant 1 h.
- Progression mise à jour par `drop-progress` ; si aucune donnée depuis plus de
  30 min, le temps restant n'est plus décompté et la bande indique « ouvre
  Twitch pour mettre à jour ».

**Panneau Drops (P1)** : entrée de menu entre « Points » et « StreamPulse+ ».

- En-tête : titre et état « Récupération auto » (reflète `autoClaimDrops`,
  cliquable vers le réglage).
- **En cours** : « mis à jour il y a N min », une ligne par Drop (image, nom,
  jeu · chaîne ou « toute chaîne avec Drops », temps restant, `minutes /
  requis · finit dans N j`). Drops prêts : bouton « Récupérer » si
  l'auto-claim est coupé ; sinon « Récupéré automatiquement à HH h MM » et
  « Dans l'inventaire ». Un Drop prêt garde toujours son bouton
  « Récupérer » : si Twitch refuse la récupération automatique, on peut
  relancer à la main.
- **Campagnes** : « N actives · lues sur Twitch il y a N min », filtres
  Toutes / Nouvelles / Finissent bientôt / À venir avec compteurs, lignes
  (jaquette, jeu, éditeur · N récompenses, tag BADGE, « nouvelle · dates » ou
  « finit dans N j »), liseré violet pour tes jeux. Un clic ouvre la campagne
  sur Twitch.
- **État vide** : aucune donnée lue. On explique qu'il faut ouvrir un onglet
  Twitch (lien direct vers `twitch.tv/drops/campaigns`, qui remplit aussi la
  liste des campagnes).

**Historique (P2, StreamPulse+)**, sous les campagnes :

- « N Drops obtenus depuis l'installation », puis mois par mois
  (« SEPTEMBRE 2026 · 9 DROPS ») : récompense (×N si répétée), jeu · sur
  chaîne, date et heure.
- Gratuit : encart StreamPulse+ à la place.

**Compteur « Drops du jour »** de l'accueil : réaffiché, alimenté par
`dropsToday(history)`.

### 7. Textes, préférences, Firefox

- Chaînes dans `i18n/translations.js`, 11 langues. `npm run verify` fait autorité.
- Préférence `dropsTracking: true` dans `DEFAULT_PREFERENCES`
  (`js/preferences-data.js`) et `PreferenceStore.sanitize()` (`js/background.js`).
- Note de version `new` dans les 11 langues ; note `fix` pour le compteur
  « Drops du jour » réactivé.
- Firefox : manifeste Firefox mis à jour à la main pour les nouveaux content
  scripts (`js/inject/drops-bridge.js` dans le monde `MAIN`,
  `js/dropsRecorder.js` isolé, tous deux à `document_start`), pas d'`import()`
  dans un content script. À faire dans le dépôt Firefox.

## Erreurs et cas limites

| Cas | Traitement |
|---|---|
| Aucun onglet Twitch ouvert | données figées, « mis à jour il y a N min » visible |
| `Client-Integrity` absent ou refusé | campagnes lues via Apollo sur `/drops/campaigns` uniquement |
| Deux onglets Twitch | dédoublonnage par `instanceId`, un seul claim (verrou dans le store) |
| `claimDropRewards` en erreur | Drop laissé `claimable`, bouton manuel, nouvel essai à la lecture suivante |
| Compte éditeur non lié | ligne de campagne avec lien « Lier le compte » vers Twitch, pas de claim |
| Drop récupéré hors extension | vu dans l'inventaire comme `claimed` sans événement : ajouté à l'historique avec la date de lecture |
| Forme GraphQL changée par Twitch | normalisation tolérante, champs manquants ignorés ; « mis à jour il y a » rend la panne visible |
| Préférence désactivée | plus rien n'est relayé ni récupéré par l'API ; les données restent |

Les données restent sur l'appareil. Aucun nouvel appel réseau depuis le service
worker : toutes les requêtes GraphQL partent de la page Twitch, avec la session
de l'utilisateur.

## Tests

- `tests/drops-data.test.mjs` : normalisation inventaire et campagnes, tag
  BADGE, `applyProgress`, `applyClaim` sans mutation et dédoublonné, filtres
  (bornes 3 jours et 48 h), tri « tes jeux », `summarizeHistory` par mois
  locaux, `dropsToday`, `prune`.
- `tests/points-bridge.test.mjs` étendu : `drop-progress` et `drop-claim`
  extraits, `points-earned` inchangé.
- `tests/drops-bridge.test.mjs` : faux `fetch`, en-tête capté sans modifier la
  requête, lecture d'un faux cache Apollo.
- `tests/drops-store.test.mjs` : file sérialisée, claim unique avec deux
  onglets, claim non déclenché si `autoClaimDrops` est faux.
- Tests de sauvegarde mis à jour pour `streamPulseDropsHistory`.
- Vérification réelle : campagne en cours (ex. World of Tanks: HEAT), bande et
  panneau à jour, claim automatique, historique, compteur du jour ; puis Firefox.
- Banc du popup : données de démo à 780×600, deux thèmes.

## Ordre de livraison

1. Marqueurs drops dans `points-bridge.js`, capture réelle de `drop-progress`
   et `drop-claim` pour confirmer leur forme.
2. `drops-bridge.js` : inventaire, en-tête, cache Apollo.
3. `drops-data.js` et ses tests.
4. `drops-store.js`, claim automatique, sauvegarde, compteur du jour.
5. Panneau P1, puis bande H2, puis historique P2.
6. Textes, notes de version, `verify`, port Firefox.
7. Release.
