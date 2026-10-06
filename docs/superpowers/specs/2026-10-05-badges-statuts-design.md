# Onglet Badges : statuts et dates des badges à gagner — conception

- **Date** : 2026-10-05
- **Demandé par** : Alexis
- **Statut** : conception validée (approche A, maquette 1) ; l'approche B
  (dates partagées par le site) viendra ensuite
- **Maquettes** : `.impeccable/badges-mockups.html` (non versionné, servi par le
  banc `scripts/dev` sur le port 5179)

## Objectif

Dire, pour chaque badge global Twitch, s'il est **en cours**, **à venir** ou
**terminé**, avec ses vraies dates, son coût, son objectif et sa date d'ajout,
sans que l'utilisateur ait rien à faire. Toutes les infos viennent de Twitch et
de streampulse.fr : aucun site tiers n'est lu ni cité (décision d'Alexis du
2026-10-05).

Aujourd'hui, l'onglet tient pour « obtenable » tout badge apparu depuis moins
de 30 jours, plus ceux reliés à une campagne par le nom du jeu. Conséquences
constatées le 2026-10-05 :

- des badges terminés restent proposés (Yellow Party Hat, RuneScape Shrimp) ;
- des badges à venir sont présentés comme obtenables (Vaultbreakers, DayZ
  Yellow King, FrekiFriend, TheDragonsDogma) ;
- des badges en cours n'ont ni date ni mode auto, faute de liaison
  (Ultramarine, ACE COMBAT 8 Nugget, Koromaru, d20) ;
- un badge encore actif disparaît au bout de 30 jours.

## Périmètre

**Dans la v1**

- Twitch uniquement (Kick et YouTube n'ont pas de badges globaux à gagner).
- Liaison exacte badge ↔ campagne par le nom de la récompense BADGE, avec un
  secours par nom de jeu normalisé.
- Statuts En cours / À venir / Terminé, calculés sur l'appareil.
- Date d'ajout fournie par streampulse.fr, croisée avec celle de l'appareil.
- Écran : maquette 1 (filtres par statut sur la grille actuelle).
- Mise à jour automatique, sans action de l'utilisateur : le détail des
  campagnes est lu en arrière-plan dans tout onglet Twitch ouvert.

**Hors v1**

- **Approche B** : les extensions envoient au site les campagnes lues, le site
  publie le calendrier à tous. Le journal des événements (section 2) est conçu
  pour être envoyé tel quel.
- Nombre d'utilisateurs par badge (comptage du chat public) : faisable, testé,
  non retenu pour cette version.
- Badges toujours disponibles (Prime Gaming, Turbo…) et badges de chaîne.
- Récupérer les dates d'un événement avant que Twitch publie sa campagne : rien
  ne les expose.

## Faits établis (vérifiés le 2026-10-05)

- **Catalogue** : la requête GraphQL `badges` est lisible sans compte (400 sets,
  520 versions). Le type `Badge` n'a aucun champ de date, de coût, de compteur
  ni de catégorie (21 noms sondés, seul `onClickAction` existe, toujours vide).
- **Tous les badges d'événement, gratuits et payants, sont des campagnes de
  Drops dont l'organisateur est « Twitch Gaming »** : REMATCH, Dungeons &
  Dragons, PAYDAY 3, cinq jeux ATLUS, CONTROL Resonant, Rainbow Six Siege,
  ELDEN RING, The Witcher 3, Space Marine II, Alien: Isolation, ACE COMBAT 8…
- **Détail d'une campagne** : chaque Drop a ses propres dates, une condition
  (minutes regardées, ou abonnements : le champ `requiredSubs` existe dans le
  schéma) et ses récompenses. Une récompense badge porte
  `distributionType: BADGE` et un nom **identique au titre du badge** :
  « Bloody Finger ELDEN RING » (« Achetez 1 nouvel abonnement récurrent ou
  abonnement-cadeau », Prime exclu), « Rematch Blue Lock » (« Regardez le stream
  pendant 30 minutes »), « Ultramarine ».
- Une campagne peut mêler badge et objets en jeu (Space Marine II), et le Drop
  du badge peut finir avant la campagne (08:59 contre 09:59).
- **Twitch ne publie aucune campagne future.** Les badges à venir sont déjà
  dans le catalogue, avec leur description, mais sans campagne.
- La liste garde les **campagnes fermées récemment** avec leur fin exacte
  (RuneScape ×3, fermées le 2026-10-05 à 00:59).
- `rewardCampaignsAvailableToUser` : 2 campagnes (CONTROL Resonant launch,
  Pokémon) dont les récompenses ne sont pas des badges du catalogue.
- Accès : `game.activeDropCampaigns` renvoie `null` même connecté ;
  `dropCampaign(id)` existe mais exige l'intégrité ; `__APOLLO_CLIENT__`
  n'est plus exposé sur `/drops/campaigns` (le repli Apollo de
  `drops-bridge.js` est mort) ; les requêtes GraphQL de la page portent
  toujours `Client-Integrity` (noms d'en-têtes observés), donc la capture du
  pont fonctionne.
- Liaison actuelle par nom de jeu ratée : « Space Marine 2 » contre
  « Warhammer 40,000: Space Marine II », « ACE COMBAT 8 » contre « ACE COMBAT 8:
  WINGS OF THEVE », « Persona 3 Reload » contre « PERSONA3 RELOAD » ; d20 ne
  cite aucun jeu (« earned by watching Dungeon Masters on Twitch »).
- **Site** : `api/twitch-badges.mjs` note déjà la première apparition de chaque
  badge (`sp:tbadges:first`, premier relevé vers le 2026-09-28), à quelques
  minutes ou une heure près, mais seulement quand l'API de traduction est
  appelée. CORS `*`, cache CDN en place. Projet Vercel en plan Hobby (cron
  quotidien au plus), déploiement par push sur `main`.

## Architecture

```
page Twitch (monde MAIN)            extension (isolé)        service worker                    popup
────────────────────────            ─────────────────        ──────────────                    ─────
js/inject/drops-bridge.js ─postMessage─▶ js/dropsRecorder.js ─▶ js/drops-store.js ─▶ storage ─▶ js/popup-drops.js
  liste des campagnes                     relaie                  campagnes + détail            filtres par statut,
  + détail des campagnes                                          journal des badges            cartes (maquette 1)
    Twitch Gaming (nouveau)                                       (js/drops-data.js, pur)
                                                                        ▲
                                          js/sw/drops.js ── GET ?added=1 ┘  dates d'ajout
                                                                │
                                                     streampulse.fr/api/twitch-badges
                                                     (catalogue Helix + 1re apparition, cron quotidien)
```

### 1. Détail des campagnes : `js/inject/drops-bridge.js`

- Après chaque lecture de la liste (toutes les 30 min, dans n'importe quel
  onglet Twitch), le pont lit le détail des campagnes dont l'organisateur est
  « Twitch Gaming » (`BADGE_OWNER`), en cours ou fermées depuis moins de
  7 jours, et dont le détail gardé a plus de 24 h ou manque.
- Premier essai : la liste elle-même avec ses Drops (`timeBasedDrops { id name
  startAt endAt requiredMinutesWatched requiredSubs benefitEdges { benefit { id
  name distributionType imageAssetURL } } }`). Si Twitch ne renvoie pas les
  Drops dans la liste, requête de détail par campagne, avec les en-têtes de la
  page. La forme exacte est à confirmer sur twitch.tv : `dropCampaign(id)` à la
  racine ou sous `currentUser`.
- Au plus 5 requêtes de détail par minute ; jamais de requête pour une
  campagne d'éditeur (Riot, Ubisoft…).
- Le résultat repart par l'action `campaigns` existante, chaque campagne
  portant ses `timeBasedDrops`. Le jeton et l'en-tête d'intégrité ne quittent
  jamais la page, comme aujourd'hui.
- Le repli Apollo mort est retiré.

### 2. Journal des badges : `js/drops-data.js` (pur, testé)

Nouvelle clé `streamPulseBadgeEvents` : `{ updatedAt, events: Event[] }`.

```
Event = {
  badgeId,            // setID du catalogue
  campaignId, dropId,
  game, gameId, owner,
  startsAt, endsAt,   // dates du Drop, sinon de la campagne
  minutes, subs,      // condition du Drop (0 si inconnue)
  link: "reward" | "game",
  seenAt,             // dernière lecture
}
```

`buildBadgeEvents(campaigns, catalog, previous, now)` :

1. **Liaison par la récompense** : pour chaque Drop d'une campagne détaillée,
   chaque récompense `BADGE` dont le nom replié (minuscules, sans accents)
   égale le titre replié d'un badge du catalogue → événement `link: "reward"`.
2. **Secours par le jeu** : seulement pour une campagne Twitch Gaming **sans
   détail**, et seulement pour les badges qui n'ont aucun événement `reward`.
   Le jeu du badge (lien de catégorie, « in the X category », description) est
   comparé au jeu de la campagne par `sameGame()` → `link: "game"`. Dès que
   le détail d'une campagne est connu, seuls les badges qu'elle nomme s'y
   rattachent : les anciens badges ELDEN RING (Recluse, Wylder…) ne seront plus
   pris pour celui en cours.
3. **Fusion** : un événement (badgeId, campaignId, dropId) remplace l'ancien ;
   un événement `reward` remplace un `game` du même badge et de la même
   campagne ; les autres sont gardés jusqu'à `endsAt + 60 jours`.

`sameGame(a, b)` : repli, chiffres romains isolés convertis (ii → 2, iii → 3,
iv → 4, v → 5), tout caractère non alphanumérique retiré, puis égalité ou
inclusion de l'un dans l'autre (6 caractères minimum). Exemples à couvrir :
« PERSONA3 RELOAD » = « Persona 3 Reload » ; « ACE COMBAT 8: WINGS OF THEVE »
contient « ACE COMBAT 8 » ; « Warhammer 40,000: Space Marine II » contient
« Space Marine 2 ».

`RETIRED_BADGES` reste comme garde-fou du seul secours par le jeu.

### 3. Statuts : `js/drops-data.js` (pur, testé)

`badgeStatus(badge, events, { now, addedAt })` renvoie `{ status, event }` :

| Statut | Règle |
|---|---|
| `live` | un événement avec `startsAt ≤ now < endsAt` ; s'il y en a plusieurs, celui qui finit le plus tard |
| `soon` daté | aucun en cours, un événement avec `startsAt > now` (Drop qui démarre plus tard) |
| `ended` | tous ses événements finis ; affiché 7 jours après la fin la plus récente, puis masqué |
| `soon` sans date | aucun événement, `addedAt` connu et de moins de 30 jours, et `viewerEarnable(description)` |
| `null` | sinon : le badge n'apparaît pas dans l'onglet |

- `viewerEarnable(description)` : vrai si la description parle de regarder,
  de s'abonner, d'offrir ou de Bits (`watch`, `viewed`, `subscrib`, `gift`,
  `cheer`, `bits`), faux si elle vise un créateur, un billet ou un salon
  (`creator`, `streamers? who`, `ticket`, `attend`, `DJ Program`, `partner`,
  `affiliate`). Clipped That et les badges TwitchCon ne sont donc jamais
  annoncés « à venir ».
- **Coût** : `subs > 0` → payant, `minutes > 0` → gratuit, sinon
  `isPaidBadge(description)` comme aujourd'hui.
- **Objectif** : `minutes` du Drop → « regarder {time} » ; sinon le texte tiré
  de la description (`badgeCondition`, inchangé).
- **Date d'ajout** : `addedAt` = la plus ancienne valeur positive entre la date
  du site et le `firstSeen` de l'appareil ; 0 si aucune.
- La règle des 30 jours (`NEW_BADGE_MS` dans `catalogBadges`) disparaît : plus
  aucun badge n'est dit obtenable sans campagne.
- `catalogBadges` ajoute à chaque badge `status`, `addedAt` et l'événement
  retenu, filtre par statut et par coût, et garde `campaign: { id, game,
  gameId, endsAt }` pour que le mode auto (`js/badge-auto.js`) continue de
  marcher sans changement : `campaign` vient désormais de l'événement en cours.

### 4. Service worker : `js/drops-store.js`, `js/sw/drops.js`

- `recordCampaigns` : fusionne le détail reçu avec celui déjà gardé (une liste
  relue sans Drops ne l'efface pas), puis reconstruit le journal avec le
  catalogue en mémoire (`streamPulseDropsBadges`) et l'écrit dans la même
  file sérialisée.
- `recordBadges` : si de nouveaux badges arrivent, le journal est relié de
  nouveau (une récompense déjà vue peut enfin trouver son badge).
- Dates d'ajout : `refreshBadgeAdded()` lit
  `https://streampulse.fr/api/twitch-badges?added=1` quand la dernière lecture
  a plus de 6 h, ou tout de suite si `recordBadges` vient de voir un nouveau
  badge. Rangé dans l'état des badges (`added`, `addedFetchedAt`). En cas
  d'échec, l'ancienne valeur reste et on réessaie au cycle suivant. Pas de
  permission d'hôte à ajouter : le site répond avec CORS `*`.
- Le journal n'entre pas dans les sauvegardes : il se reconstruit depuis
  Twitch.

### 5. Site : `StreampulseSite/api/twitch-badges.mjs`, `vercel.json`

- `GET ?added=1` → `{ added: { setID: ms } }` (dates connues seulement),
  `Cache-Control: public, s-maxage=600, stale-while-revalidate=86400`. Les
  appels des extensions sont servis par le CDN de Vercel ; la fonction ne
  tourne qu'à l'expiration.
- `GET /api/twitch-badges-refresh` (route dédiée, sans paramètre : Vercel ne
  garantit pas les paramètres dans le chemin d'un cron) → relit le catalogue
  Helix s'il a plus de 10 min, renvoie `{ ok, count, at }`,
  `Cache-Control: no-store`. Sans effet s'il est frais, donc sans risque
  d'abus.
- `CATALOG_MAX_AGE_MS` passe de 30 à 10 min.
- `vercel.json` : cron quotidien sur `/api/twitch-badges-refresh` (plafond du
  plan Hobby), pour un relevé garanti même sans visite.
- Déploiement : push sur `main`, jamais `vercel deploy` depuis le dossier local.

### 6. Écran : maquette 1 (`html/popup.html`, `js/popup-drops.js`, `css/popup.css`)

- **Écran vert** : « {n} EN COURS » (badges en cours + récompenses en cours),
  méta « À venir : {n} » et « Gratuits : {n} ».
- **Filtres** :
  - statut : En cours (par défaut) / À venir / Terminés / Obtenus, avec leurs
    compteurs. « En cours » compte aussi les récompenses en cours, comme
    l'écran vert ; « Obtenus » liste les badges possédés parmi ceux qui ont un
    statut (en cours, à venir, ou terminés depuis moins de 7 jours) ;
  - coût : Tous / Gratuits / Payants, appliqué dans le statut choisi ;
  - recherche inchangée.
- **Ordre et ligne d'aide** sous les filtres :
  - En cours : fin la plus proche d'abord ;
  - À venir : datés d'abord, puis ajoutés récemment d'abord ;
  - Terminés : fin la plus récente d'abord ;
  - Obtenus : par statut, puis par titre.
- **Carte** (`badgeCard`, même structure qu'aujourd'hui) :
  - troisième ligne « Ajouté le {date} » si la date est connue ;
  - pied : pastille de coût (ou « obtenu »), puis le statut : « finit dans
    {time} » (rouge sous 48 h), pastille « À venir » (ou « dès le {date} » si
    datée), « Terminé le {date} » ;
  - à venir : contour pointillé violet ; terminé : opacité 60 %, image en
    niveaux de gris ; obtenu : inchangé (coche, teinte de l'écran vert).
- Les récompenses de campagne (Great Ball…) restent dans « En cours », comme
  aujourd'hui. Le bouton « Obtenir en auto » garde sa règle : en cours,
  gratuit, pas obtenu.
- **Notes** :
  - `catalogNote` réécrite : « Les dates viennent des campagnes Twitch, relues
    dès qu'un onglet Twitch est ouvert. Clique sur un badge pour ouvrir un live
    où le gagner. »
  - si la dernière lecture des campagnes a plus de 12 h : « Campagnes relues le
    {date} » ;
  - si elles n'ont jamais été lues : « Ouvre Twitch une fois pour charger les
    dates des campagnes. »
- **États vides** : un texte par filtre (« Aucun badge en cours », « Aucun
  badge à venir pour l'instant », « Aucun badge terminé ces 7 derniers
  jours », « Aucun badge obtenu parmi ceux-ci »).
- **Gratuit (sans StreamPulse+)** : l'aperçu « {n} EN COURS » reste visible,
  le détail reste réservé à StreamPulse+.

### 7. Textes, notes de version, Firefox

- Nouvelles chaînes dans `i18n/lang/*.js`, 11 langues : filtres, « Terminé le
  {date} », « Ajouté le {date} », « dès le {date} », pastille « À venir »,
  lignes d'aide, écran vert, notes, états vides. Voix de DESIGN.md
  (tutoiement, accords neutres). `npm run verify` fait autorité.
- Note de version dans `js/changelog-data.js`, 11 langues, même commit :
  `new` (statuts, vraies dates, date d'ajout) et `fix` (badges terminés plus
  présentés comme obtenables ; Ultramarine, ACE COMBAT 8 Nugget, Koromaru et d20
  enfin reliés à leur campagne).
- Firefox : aucun `import()` ajouté dans un content script ; mise à jour du
  port par `node scripts/sync-from-chrome.mjs --write`.

## Erreurs et cas limites

| Cas | Traitement |
|---|---|
| Aucun onglet Twitch ouvert | données gardées, statuts qui avancent avec l'horloge ; note « Campagnes relues le… » après 12 h |
| Campagnes jamais lues (déconnecté de Twitch, nouvelle installation) | seuls « À venir » sans date et « Obtenus » ; note « Ouvre Twitch une fois… » |
| Détail refusé (intégrité absente ou refusée) | secours par le jeu pour les campagnes Twitch Gaming ; nouvel essai à la lecture suivante |
| Nom de récompense différent du titre du badge | comparaison tolérante (ponctuation, espaces, accents) ; sinon, pas de lien |
| Badge ajouté sans campagne lancée | « À venir » 30 jours, puis masqué |
| Badge de créateur, de salon ou de billet | jamais « À venir » |
| Plusieurs Drops donnent le même badge | le Drop en cours qui finit le plus tard |
| Site injoignable | date d'ajout de l'appareil, nouvel essai au cycle suivant |
| Forme GraphQL changée par Twitch | normalisation tolérante, champs manquants ignorés ; la note de lecture rend la panne visible |

## Tests

- `tests/drops-data.test.mjs` (ou `tests/badge-events.test.mjs`), avec les vrais
  cas du 2026-10-05 :
  - liaison par la récompense : Bloody Finger ELDEN RING, Rematch Blue Lock,
    Ultramarine dans « Warhammer 40,000: Space Marine II », d20 sans jeu dans sa
    description, Dallas / Hoxton / Wolf dans une même campagne PAYDAY 3 ;
  - secours par le jeu (campagnes sans détail) : PERSONA3 RELOAD ↔ Koromaru,
    ACE COMBAT 8: WINGS OF THEVE ↔ ACE COMBAT 8 Nugget ;
  - aucun faux positif : elden-ring-recluse jamais relié au ELDEN RING en cours
    une fois le détail connu ;
  - statuts : en cours, à venir daté et sans date (Vaultbreakers), terminé
    affiché 7 jours (Yellow Party Hat) puis masqué, `null` pour Clipped That et
    les badges TwitchCon ;
  - dates du Drop prioritaires sur celles de la campagne ; rétention à
    60 jours ; `addedAt` = plus ancienne valeur positive ; coût par `subs` et
    `minutes` avec repli sur la description ; aucune mutation.
- `tests/drops-bridge.test.mjs` : détail demandé seulement pour Twitch Gaming,
  au plus 5 par minute, cache de 24 h, en-tête capté sans modifier la requête
  de Twitch.
- `tests/drops-store.test.mjs` : détail conservé quand la liste revient sans
  Drops, journal relié de nouveau à l'arrivée d'un badge, dates du site
  fusionnées.
- `tests/badge-auto*.test.mjs` : inchangés et verts (la forme de `campaign` ne
  change pas).
- Banc du popup : données de démo mises à jour (en cours, à venir, terminés,
  obtenus), 780×600, thèmes sombre et clair.
- Vérification réelle sur twitch.tv : détail lu en arrière-plan, Ultramarine
  et Koromaru datés, Vaultbreakers « À venir », RuneScape « Terminé le 5 oct. ».

## Ordre de livraison

1. Sur twitch.tv : confirmer la requête de détail (liste avec Drops, sinon par
   campagne) par une capture réelle.
2. `drops-data.js` : `sameGame`, `buildBadgeEvents`, `badgeStatus`,
   `viewerEarnable`, `addedAt`, et leurs tests.
3. `drops-bridge.js` : détail des campagnes Twitch Gaming, retrait du repli
   Apollo, tests.
4. `drops-store.js`, `sw/drops.js` : journal, nouvelle liaison, dates du site,
   tests.
5. Site : `?added=1`, route `/api/twitch-badges-refresh` (CRON_SECRET), cache 10 min, cron quotidien ; push sur
   `main`.
6. Écran (maquette 1), banc à 780×600 dans les deux thèmes.
7. Textes en 11 langues, note de version, `npm run verify`, port Firefox,
   release (Edge publiée par `npm run publish:edge`).

## Questions ouvertes (à trancher pendant l'implémentation)

- La liste `currentUser.dropCampaigns` renvoie-t-elle les Drops quand on les
  demande, ou faut-il une requête par campagne ?
- Twitch expose-t-il l'exclusion des abonnements Prime ? Si oui, afficher
  « hors Prime » sur les badges payants ; sinon, rien.
