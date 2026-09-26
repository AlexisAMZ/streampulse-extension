# Suivi des points de chaîne : conception

- **Date** : 2026-09-26
- **Demandé par** : shiroa (mail du 2026-09-26), validé par Alexis
- **Statut** : conception validée, en attente de relecture de la spec

## Objectif

Enregistrer chaque gain de points de chaîne Twitch, et répondre pour chaque
streamer à trois questions : combien de points j'ai gagnés, d'où ils viennent
(regarder, bonus, raid, suivi, cheer, sub offert, série), et combien m'a
rapporté mon abonnement.

## Périmètre

**Dans la v1**

- Twitch uniquement, points **gagnés** uniquement.
- Capture pendant qu'au moins un onglet Twitch est ouvert. Un seul onglet suffit
  pour toutes les chaînes : l'événement est lié au compte, pas à la chaîne.
- Nouveau panneau **Points** dans les Réglages, juste après « Temps et données ».
- Section Points dans le récap existant.
- Gratuit : total par chaîne. StreamPulse+ : détail par raison, bonus
  d'abonné, jour par jour, fiche streamer, journal.
- Le suivi commence à l'installation de la version. Aucun historique rétroactif.

**Hors v1**

- Kick, points dépensés (récompenses, mises), points gagnés sans onglet Twitch
  ouvert.
- Fusion avec le compteur existant « Points de chaîne récupérés » (auto-clic des
  caisses) et la pastille ◆ du popup : ils restent tels quels. Ils mesurent ce
  que StreamPulse a cliqué, pas ce que Twitch a versé.

## Faits établis (vérifiés sur twitch.tv le 2026-09-26)

- L'application web s'abonne au sujet `community-points-user-v1.<userId>` et
  traite des messages de type `points-earned` (`CommunityPointsEarned`).
- Le transport est `wss://pubsub-edge.twitch.tv/v1`, en cours de migration vers
  `wss://hermes.twitch.tv/v1` (clé `twilight_hermes_rollout_*`). Les deux
  enveloppent le message `points-earned` dans une chaîne JSON, à des chemins
  différents.
- Codes de raison connus de Twitch (`reward_type`) : `CHEER`, `CLAIM`,
  `FOLLOW`, `PREDICTION`, `PRIME_SUB`, `RAID`, `REFUND`, `SUB_GIFT`, `WATCH`,
  `WATCH_STREAK`.
- Les multiplicateurs portent un `reason_code` (`SUB_T1`, `SUB_T2`, `SUB_T3`)
  et un `factor`.
- Forme attendue du message, **à confirmer par une capture réelle en étape 1** :

```json
{
  "type": "points-earned",
  "data": {
    "timestamp": "2026-09-26T19:47:12.3Z",
    "channel_id": "123456",
    "point_gain": {
      "user_id": "999", "channel_id": "123456",
      "total_points": 60, "baseline_points": 50,
      "reason_code": "CLAIM",
      "multipliers": [{ "reason_code": "SUB_T1", "factor": 0.2 }]
    },
    "balance": { "user_id": "999", "channel_id": "123456", "balance": 23410 }
  }
}
```

## Architecture

```
page Twitch (monde MAIN)            extension (monde isolé)          service worker                 pages
─────────────────────────           ───────────────────────          ──────────────                 ─────
js/inject/points-bridge.js  ──postMessage──▶  js/pointsRecorder.js ──sendMessage──▶  js/points-store.js ──▶ chrome.storage.local
  écoute les WebSocket                  valide, respecte la           « recordPointsGain »            │
  de Twitch, extrait                    préférence, relaie            dédoublonne, agrège             ├─▶ popup : js/popup-points.js
  « points-earned »                                                   (js/points-data.js)             └─▶ récap : recap.js / recap-draw.js
```

Un seul écrivain : le service worker. Les pages lisent le stockage et appellent
les fonctions pures de `js/points-data.js`.

### 1. Capture : `js/inject/points-bridge.js`

Script classique, monde `MAIN`, `document_start`, cadre principal seulement,
protégé contre la double injection (`window.__streamPulsePointsBridge`).

- Remplace `window.WebSocket` par un `Proxy` du constructeur natif, pour que
  `instanceof` et les propriétés statiques restent intacts. Chaque socket créée
  reçoit un écouteur `message` en plus. Le comportement de Twitch n'est pas
  modifié.
- Filtre bon marché : on ignore tout message qui n'est pas une chaîne contenant
  `points-earned`. On ne parse le JSON que dans ce cas.
- Extraction générique : on parcourt l'objet parsé et chaque valeur chaîne qui
  est elle-même du JSON, jusqu'à trouver un objet `{ type: "points-earned", data }`.
  Ça couvre PubSub et Hermes sans dépendre de leur enveloppe.
- Envoie `window.postMessage({ source: "streampulse:points", v: 1, data }, location.origin)`.
- File d'attente de 50 événements au plus, tant que le relais n'a pas répondu
  `streampulse:points:ready`. Aucun événement n'est perdu au chargement.
- Tout est dans des `try/catch`. Le pont ne lève jamais d'exception dans le code
  de Twitch.

### 2. Relais : `js/pointsRecorder.js`

Content script isolé, `document_start`.

- N'accepte que `event.source === window` et `data.source === "streampulse:points"`.
- Lit la préférence `pointsTracking` (vraie par défaut) et suit ses changements.
  Si elle est fausse, rien n'est relayé.
- Envoie `chrome.runtime.sendMessage({ type: "recordPointsGain", data })`. Les
  erreurs (service worker endormi, contexte invalidé) sont avalées : l'événement
  est perdu sans effet de bord.

### 3. Données : `js/points-data.js` (module pur, testé)

Aucun accès à `chrome.*` ni au DOM, sur le modèle de `recap-data.js`.

**Catalogue des raisons** (`REASONS`, dans l'ordre d'affichage) :

| Code | Libellé (fr) | Règle Twitch affichée |
|---|---|---|
| `CLAIM` | Bonus spéciaux | +50 |
| `WATCH` | Regarder 5 minutes | +10 |
| `WATCH_STREAK` | Série de visionnage | jusqu'à +450 |
| `RAID` | Participer à un raid | +250 |
| `FOLLOW` | Suivre la chaîne | +300 |
| `CHEER` | 1er cheer du mois | +350 |
| `SUB_GIFT` | 1er sub offert du mois | +500 |
| `OTHER` | Autres gains | regroupe `PREDICTION`, `REFUND`, `PRIME_SUB` et tout code inconnu, avec son code d'origine gardé |

Multiplicateurs affichés : Tier 1 ×1,2, Tier 2 ×1,4, Tier 3 ×2.

**Fonctions**

- `normalizeGain(raw, now)` → `{ key, at, day, channelId, reason, rawReason, points, base, factor, balance }` ou `null`.
  - `channelId` : chaîne de 1 à 20 chiffres ; `points` : entier de 1 à 1 000 000 ;
    `base` : entier, par défaut égal à `points` ; `factor` : somme des facteurs
    des multiplicateurs, par défaut 0.
  - `at` vient de `timestamp`, et de `now` s'il est illisible. `day` est la
    clé de jour **locale** `AAAA-MM-JJ` (même règle que `recap-data.dayKey`).
  - `key` = `channelId|timestamp|reason|points`, pour le dédoublonnage.
- `addGain(state, gain)` → **nouvel** état (aucune mutation) :
  - `daily[day][channelId][reason]` : `{ count, points, base }`.
  - `journal` : gain ajouté en tête.
  - `channels[channelId]` : `balance`, `balanceAt`, `lastGainAt`, `factor` (vu
    sur le dernier gain `WATCH` ou `CLAIM`), `firsts.FOLLOW` / `CHEER` /
    `SUB_GIFT` : date du dernier gain de ce type.
  - Un gain dont la `key` est déjà dans le journal est ignoré.
- `summarize(state, periodId, now)` pour le panneau : `today`, `7d`, `30d`,
  `all` → `{ total, subBonus, byReason[], byChannel[] (triées), days[] }`.
  `subBonus` = somme de `points - base`.
- `summarizeDays(state, dayKeys)` pour le récap, qui fournit ses propres jours
  (7 j, 30 j, mois, année).
- `channelDetail(state, channelId, periodId, now)` → lignes par raison
  (`count`, `points`, `base`), `subBonus`, `days[]`, `journal` (20 derniers
  gains de la chaîne), `factor`, `balance`, et les états mensuels :
  - `CHEER` et `SUB_GIFT` : « fait le JJ mois » s'il y a un gain dans le mois
    civil en cours, sinon « pas encore ce mois-ci ». On n'affiche jamais
    « disponible » : on ne sait rien de ce qui s'est passé avant l'installation.
  - `FOLLOW` : « fait le JJ mois » si un gain a été vu, sinon « — ».
- `prune(state, now)` : `daily` garde 400 jours (récap annuel), `journal` garde
  60 jours et 1 000 gains au plus.

**Stockage** (`chrome.storage.local`, ajoutés à `BACKUP_KEYS` de `backup.js`) :

- `streamPulsePointsDaily` : `{ "AAAA-MM-JJ": { "<channelId>": { "<REASON>": { count, points, base } } } }`
- `streamPulsePointsJournal` : `[{ key, at, channelId, reason, rawReason, points, base, factor }]`, le plus récent en tête
- `streamPulsePointsChannels` : `{ "<channelId>": { login, displayName, avatar, balance, balanceAt, lastGainAt, factor, firsts } }`

Ordre de grandeur pour un gros spectateur (5 h par jour, 5 chaînes) : environ
150 Ko pour le journal de 60 jours, et environ 400 Ko par an pour `daily`.

### 4. Service worker : `js/points-store.js`

Module importé par `background.js`, qui compte déjà plus de 3 500 lignes : on
ne l'alourdit pas.

- Traite `recordPointsGain` : `normalizeGain`, puis lecture, `addGain`, `prune`
  (au plus une fois par jour) et écriture, dans une **file sérialisée**. Deux
  gains simultanés ne s'écrasent jamais.
- Résolution des noms : un `channelId` sans `login` est mis en file. On fait
  un appel Helix `users?id=` groupé (100 identifiants au plus), en réutilisant
  les identifiants et `ensureConfig` déjà utilisés pour les avatars. Le
  résolveur est passé en dépendance, pour que le store se teste sans réseau. En
  cas d'échec, on réessaie au gain suivant. L'affichage montre `#<id>` en
  attendant.
- Un échec d'écriture est journalisé (`console.warn`) et le gain est perdu,
  sans rien casser d'autre.

### 5. Écrans

**Panneau « Points »** : entrée de menu après « Temps et données », icône
losange, code dans le nouveau `js/popup-points.js` (et non `popup.js`, qui
compte déjà 2 100 lignes). Sélecteur de période : Aujourd'hui, 7 jours,
30 jours, Tout.

- **Vue gratuite (maquette A)** : écran LCD du total, liste des chaînes avec
  leur total (non cliquables), encart StreamPulse+, interrupteur « Suivre les
  points gagnés », mention « Actif tant qu'un onglet Twitch est ouvert »,
  bouton « Remettre à zéro » avec confirmation.
- **Vue StreamPulse+, écran 1 (maquette B+C, vue d'ensemble)** : écran LCD
  (total, nombre de chaînes, bonus d'abonné), 8 tuiles (les 7 raisons plus
  « Bonus d'abonné »), chacune avec son nombre d'occurrences, puis les chaînes
  avec une barre empilée par raison. Les chaînes sont cliquables.
- **Vue StreamPulse+, écran 2 (maquette B+C, fiche streamer)** : retour vers
  toutes les chaînes ; en-tête (avatar, nom, palier d'abonné déduit de
  `factor`, solde actuel) ; écran LCD (total de la période, bonus d'abonné) ;
  tableau « D'où viennent tes points » (raison, règle Twitch, nombre de fois,
  points, barre ou état mensuel, ligne « dont bonus d'abonné », total) ;
  graphique jour par jour ; « Derniers gains » (heure, type, ×facteur, points).
- **État vide** : aucun gain encore enregistré. On explique qu'il faut regarder
  un live Twitch avec l'extension active.
- **Santé de la capture** : « Dernier gain capté : il y a N min ». Si Twitch
  change son transport et que la capture casse, ça se voit au lieu de mentir
  par un zéro.

**Récap** (maquette R) :

- **Carte partageable (gratuit)** : chiffre « Points gagnés » à côté du temps
  regardé, et ligne « Meilleure chaîne en points ». Dessinés par
  `recap-draw.js` en 16:9 et en 9:16. Masqués si la période ne compte aucun
  point.
- **Récap avancé (StreamPulse+)** : « Points par raison », barres au format
  « Heures par catégorie », « Tes points jour par jour », jour le plus
  rentable et bonus d'abonné de la période.

### 6. Textes, notes de version, Firefox

- Toutes les chaînes dans `i18n/translations.js`, dans les 11 langues publiées.
  `npm run verify` fait autorité.
- Préférence `pointsTracking: true` ajoutée à `DEFAULT_PREFERENCES`
  (`js/preferences-data.js`) et à `PreferenceStore.sanitize()`
  (`js/background.js`). Sinon, le réglage retombe sur son défaut à chaque
  écriture : c'est le contrôle 3bis de `verify.mjs`.
- Note de version `new` dans les 11 langues, et crédit à shiroa (« idée du
  suivi des points »).
- Firefox : `sync-from-chrome.mjs` recopie les fichiers. Le manifeste Firefox
  déclare à la main les deux nouveaux content scripts. Aucun `import()` dans un
  content script, donc pas de jumeau classique à générer (voir la mémoire
  « Port Firefox et import() »). Le monde `MAIN` est pris en charge (Firefox
  128 minimum, déjà utilisé).

## Erreurs et cas limites

| Cas | Traitement |
|---|---|
| Deux onglets Twitch ouverts | même `key`, dédoublonné par le store |
| Transport changé par Twitch | extraction générique ; sinon « dernier gain capté » le rend visible |
| Code de raison inconnu | rangé dans `OTHER`, code d'origine conservé |
| Nom de chaîne inconnu | `#<id>`, résolu au prochain gain |
| Faux message posté par la page | forme et bornes validées ; au pire, des statistiques locales faussées |
| Changement de jour | jour tiré du `timestamp` de l'événement, en heure locale |
| Préférence désactivée | le relais ne transmet plus rien ; les données restent |
| Stockage plein ou en erreur | `console.warn`, gain perdu |

Les données restent sur l'appareil. Seul appel réseau nouveau : la résolution
Helix des identifiants de chaîne, sur l'API déjà utilisée.

## Tests

- `tests/points-data.test.mjs` : `normalizeGain` (valide, invalide, code
  inconnu, multiplicateurs), `addGain` sans mutation, dédoublonnage,
  `summarize` pour chaque période, `channelDetail` (états mensuels, bonus
  d'abonné), `prune`.
- `tests/points-bridge.test.mjs` : le pont chargé dans un bac à sable avec un
  faux `WebSocket`. Enveloppe PubSub, enveloppe Hermes, message sans rapport ;
  un seul `postMessage` par gain ; les écouteurs de Twitch reçoivent toujours
  leurs messages.
- `tests/points-store.test.mjs` : file sérialisée (deux gains simultanés, aucun
  perdu), résolveur de noms simulé.
- Tests de sauvegarde mis à jour pour les trois nouvelles clés.
- Vérification réelle sur un compte Twitch : 10 minutes de live donnent deux
  gains `WATCH`, une caisse donne un `CLAIM`, deux onglets ne donnent aucun
  doublon, le panneau et le récap s'affichent. Puis la même chose sur Firefox.
- Banc du popup et du récap : données de démo pour vérifier les écrans à
  780×600 et dans les deux thèmes.

## Ordre de livraison

1. Pont et relais, puis capture d'un vrai `points-earned` pour confirmer la
   forme du message.
2. `points-data.js` et ses tests.
3. `points-store.js`, résolution des noms, sauvegarde.
4. Panneau : vue gratuite, puis vues StreamPulse+.
5. Récap : carte, puis section avancée.
6. Textes, note de version, `verify`, port Firefox.
7. Release.
