# Tâche 1 — Instrumenter la demande d'avis

Date : 2026-09-28. Exécuté sur streampulse-extension, synchronisé vers streampulse-firefox.

## 1. Conditions d'affichage relevées (avant travail)

Tout le code vit dans `js/popup-review.js`, appelé à chaque ouverture de la
popup par `initReviewAsk()` (js/popup-features.js).

| Élément | Valeur relevée |
|---|---|
| Stockage de l'état | `chrome.storage.local`, clé `streamPulseReviewAsk` (`firstSeen`, `snoozedUntil`, `done`) |
| Premier affichage | 14 jours après `firstSeen` (`FIRST_ASK_MS`) |
| Accélération | Si l'utilisateur a déjà des streamers suivis **ou** du temps de visionnage enregistré, `firstSeen` est antidaté : le bandeau s'affiche à la première ouverture de popup |
| « Plus tard » | Nouvel essai après 30 jours (`LATER_MS`) |
| « Non merci » / « Laisser un avis » | Retrait définitif (`done: true`) |
| Moment | À l'ouverture de la popup, indépendamment de tout succès vécu |
| Lien | URL de reviews du store, selon le navigateur (Chrome / AMO / Edge) |
| Nombre d'affichages possibles | Un par ouverture de popup jusqu'à action de l'utilisateur |
| Mesure avant le 2026-09-28 | **Aucune** : ni affichages, ni clics, ni fermetures comptés |

Contexte important : la version 26.9.28 portant la demande d'avis n'est
publiée que le 28 septembre 2026. Les 4 avis actuels sont antérieurs ; **il
n'existe donc aucune donnée qui prouve que la demande convertit mal**. Le
point de mesure démarre maintenant.

## 2. Ce qui a été ajouté

### 2.1 Compteurs locaux (aucune donnée ne sort)

Chaque affichage, clic et fermeture incrémente des compteurs dans
`chrome.storage.local`, clé `streamPulseReviewMetrics` :

```json
{
  "shown": 12, "rate": 2, "later": 4, "never": 3,
  "byVariant": {
    "calendar": { "shown": 12, "rate": 2, "later": 4, "never": 3 }
  },
  "updatedAt": 1789...
}
```

Aucun identifiant, aucun envoi réseau, aucune donnée personnelle : ce sont
des compteurs, comme ceux du temps de visionnage. **Limite assumée** : la
lecture se fait à la main (ci-dessous), car la contrainte « données locales »
interdit tout ping de collecte.

### 2.2 Trois variantes de déclencheur, derrière un drapeau

La variante se choisit à distance, sans republier l'extension : l'API
`https://streampulse.fr/api/streampulse-config` renvoie désormais
`reviewAsk: { variant }`, mis en cache côté extension (TTL 30 min). La
variable d'environnement Vercel `STREAMPULSE_REVIEW_ASK_VARIANT` pilote la
valeur (`calendar` par défaut).

| Variante | Condition d'affichage | Intention |
|---|---|---|
| `calendar` (défaut) | 14 jours, comportement historique inchangé | Baseline du déploiement en cours |
| `momentum` | 7 jours **et** un succès vécu | Demander après une habitude prise |
| `firstSuccess` | 3 jours **et** un succès vécu | Demander au pic d'enthousiasme |

« Succès vécu » = temps de visionnage, points journaliers ou points par
chaîne non vides (compteurs déjà écrits par l'extension). Le booléen reste
local. Code : `js/popup-review.js` (`resolveVariant`, `shouldAsk` avec
`{ variant, hasSuccess }`). Tests : `tests/popup-review.test.mjs`
(208 tests verts, `npm run verify` OK, synchronisé vers Firefox).

### 2.3 Méthode de mesure conseillée

Avec 313 utilisateurs, trois variantes testées en même temps ne donneront
aucune significativité. Procéder **séquentiellement** :

1. Laisser `calendar` tourner jusqu'au 5-6 octobre (baseline du tout
   premier déploiement).
2. Lire les compteurs. Si le taux `rate / shown` est < 10 %, passer
   `momentum` via la variable d'environnement, laisser 2 semaines.
3. Comparer `rate / shown` entre les deux périodes avant de trancher.
   Seuil de décision réaliste : un déclencheur qui fait passer le clic de
   quelques % à deux chiffres.

### 2.4 Lire les compteurs

Console du service worker de l'extension (`chrome://extensions` → StreamPulse
→ inspector du service worker) :

```js
(await chrome.storage.local.get("streamPulseReviewMetrics"))["streamPulseReviewMetrics"]
```

Ou, pour une version future : une entrée « exporter un diagnostic » dans les
réglages qui copie ce JSON dans le presse-papier pour un ticket de support.
Décision laissée ouverte : tout envoi automatique, même agrégé, contredit la
contrainte « données locales » et demanderait une décision explicite.

## 3. Rappels de contrainte

Aucune contrepartie en échange d'un avis (le texte du bandeau le dit déjà, il
faut le conserver tel quel). Aucun nouveau domaine contacté : la variante
voyage par la config distante existante.
