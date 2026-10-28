# Essai StreamPulse+ de 7 jours et alertes manquées

Date : 2026-10-28. Objectif : convertir davantage d'utilisateurs gratuits en abonnés.

Deux leviers :

1. **Essai de 7 jours** à l'installation : tout StreamPulse+ débloqué, sans carte.
2. **Alertes manquées en aperçu** : sans abonnement, le popup montre les badges et les Drops que StreamPulse+ aurait signalés, avec un bouton Débloquer.

---

## 1. Essai de 7 jours

### Principe

- À la première installation, l'extension demande un essai au serveur de licences (streampulse.tech).
- Le serveur renvoie une licence **signée** avec le plan `trial`. La date de départ (`iat`) est signée elle aussi, donc impossible à prolonger en local.
- Pendant 7 jours, `isPlusActive` répond vrai : alertes, farm auto, délai d'actualisation, historique, etc.
- À la fin, retour au gratuit. Les réglages restent enregistrés, ils se remettent en marche si la personne s'abonne.

### Serveur (repo StreampulseSite, `api/streampulse-license.mjs`)

- Nouvelle action `{ action: "trial", device, version }`.
- Une seule fois par appareil : l'identifiant d'appareil est noté au premier essai, et toute nouvelle demande renvoie le même essai (même `iat`), jamais un nouveau.
- Réponse : `{ valid: true, plan: "trial", key: "TRIAL-<device>", iat, sig }`, signée comme une licence normale (`licenseMessage`).
- La revérification quotidienne d'une clé `TRIAL-…` renvoie la même réponse ; après 7 jours, `valid: false, error: "trial_ended"`.
- Limite de débit sur l'action, comme le reste de l'API.

### Extension

| Fichier | Changement |
|---|---|
| `js/inject/plus-rule.js` | `plan === "trial"` : actif si `now - iat <= 7 jours` (pas le délai de grâce de 30 jours). Exporter `TRIAL_MS` et une fonction `trialEndsAt(record)`. |
| `js/plus.js` | Ajouter `"trial"` aux plans acceptés, ajouter `startTrial(fetch, device)`. |
| `js/sw/lifecycle.js` | À l'installation (`reason === "install"`) : demander l'essai, sans bloquer le reste. En cas d'échec réseau, nouvel essai au prochain réveil (drapeau `streamPulseTrialPending`). |
| `js/sw/license-guard.js` | Une clé `TRIAL-…` refusée (`trial_ended`) est retirée, comme une licence invalide. |
| Popup (`popup-features.js`, en-tête) | Pendant l'essai : « Essai StreamPulse+ : encore N jours », avec le bouton S'abonner. Les 2 derniers jours, la mention passe en couleur d'alerte. |
| Fin de l'essai | Une seule notification Chrome : « Ton essai StreamPulse+ est terminé. Cette semaine, il t'a récupéré X badges et Y Drops. » (compteur `plus-value` existant), avec un clic vers l'offre. |
| Page d'onboarding | Une ligne : « 7 jours de StreamPulse+ offerts, sans carte. » |

### Ce qui n'a pas le droit de casser

- La licence à vie et les abonnements existants (aucun changement de leurs règles).
- Une vraie clé saisie pendant l'essai remplace l'essai immédiatement.
- Les utilisateurs déjà installés : pas d'essai automatique. Option : un bouton « Essayer 7 jours » dans l'offre, une seule fois par appareil (même action serveur).

### Risques

- **Réinstallation = nouvel identifiant d'appareil = nouvel essai.** Acceptable au début. Pour durcir plus tard : lier l'essai au compte Twitch connecté (hash du login) quand il existe.
- **Chrome Web Store** : l'essai doit être décrit clairement dans la fiche (« essai gratuit de 7 jours, puis fonctions de base gratuites »). Ne jamais bloquer une fonction gratuite existante à la fin de l'essai.

---

## 2. Alertes manquées en aperçu

### Principe

- Le service worker calcule déjà les alertes de badges (`planBadgeAlerts`) et de campagnes (`campaignAlerts`).
- Sans abonnement, au lieu de rien faire, il **note** ce qui aurait été signalé, **sans notification**.
- Le popup affiche ces alertes manquées dans les onglets Badges et Drops.

### Ce qui est noté comme « manqué »

- Les badges courts (une journée ou moins) qui ont démarré.
- Les nouveaux badges apparus au catalogue.
- Les nouvelles campagnes Drops (tous les jeux, puisque l'utilisateur gratuit n'a pas choisi de jeux).

### Données

- Nouvelle clé `streamPulseMissedAlerts` : liste `{ id, kind: "badge" | "drop", title, game, startsAt, endsAt, at }`.
- 20 entrées au plus, effacées après 7 jours, sans doublon par id.
- Module pur `js/missed-alerts.js` (`recordMissed`, `missedFrom`, `missedSummary`) avec ses tests.

### Interface (maquettes d'abord, 3 ou 4 propositions)

- En haut des onglets Badges et Drops : une bande « Cette semaine, tu as raté 3 badges et 2 campagnes ».
- Dessous, les 3 dernières alertes : nom, jeu, durée (« badge de 30 min, terminé il y a 2 h »).
- Bouton « Ne plus rien rater » qui ouvre l'offre (ou « Essayer 7 jours » si l'essai n'a jamais été utilisé).
- Un point sur l'icône de l'extension quand une nouvelle alerte manquée arrive ? À décider, peut-être trop insistant.

### Règles

- Jamais de notification Chrome pour un utilisateur gratuit : seulement dans le popup.
- Avec StreamPulse+ (ou pendant l'essai), la liste n'est ni remplie ni affichée.

---

## Ordre de travail

1. Serveur : action `trial` et ses tests, déployée sur streampulse.tech (CLI Vercel).
2. Extension : règle `trial` dans `plus-rule.js` et `plus.js`, avec tests (TDD).
3. Extension : demande de l'essai à l'installation et garde de la licence.
4. Maquettes de l'en-tête d'essai et de la bande des alertes manquées, choix d'une version.
5. Extension : `missed-alerts.js` et branchement dans `sw/drops.js`.
6. Extension : interface (en-tête d'essai, bande des alertes manquées, notification de fin d'essai).
7. Textes dans les 12 langues, changelog, fiche du Chrome Web Store.
8. Test de bout en bout avec une installation neuve (profil Chrome vierge).

## Questions ouvertes

- Les utilisateurs déjà installés : leur proposer aussi un essai, via un bouton ?
- Un point sur l'icône pour les alertes manquées : oui ou non ?
- À la fin de l'essai, proposer une remise (par exemple le premier mois à -50 %) ?
