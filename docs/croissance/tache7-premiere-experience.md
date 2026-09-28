# Tâche 7 — La première expérience : relevé et proposition

Date : 2026-09-28. Relevé fait dans le code (`js/background.js` `onInstalled`,
`html/onboarding.html`, `js/onboarding.js`), proposition de parcours pour
maximiser le passage « installé » → « utilisateur actif à 7 jours ».

## 1. Le parcours actuel, relevé

Déclencheur : `chrome.runtime.onInstalled`, raison `install` → ouvre
`html/onboarding.html` dans un onglet. Une mise à jour ouvre les notes de
version, pas l'onboarding.

| Étape | Contenu | Coût pour l'utilisateur |
|---|---|---|
| 0 | Ouverture automatique de l'onglet d'onboarding | nul |
| 1 | Choix de la langue (11) | faible |
| 2 | Pseudo + avatar + badge communautaire (opt-in) | moyen : décision de confidentialité dès la 2e étape |
| 3 | Streamers : ajout manuel, ou import des abonnements Twitch | moyen : c'est ici que se joue l'activation |
| 4 | Réglages groupés (préférences, dont raid auto désactivé par défaut) | élevé : 8 groupes de réglages avant d'avoir vu quoi que ce soit |
| 5 | « Lancement » | nul |

Diagnostic : cinq écrans avant le premier succès. L'utilisateur comprend ce
que fait l'extension mais ne l'a **pas vu agir** une seule fois avant
d'avoir traversé réglages et choix de confidentialité. Le taux de
désinstallation des sept premiers jours se joue là.

## 2. Proposition : « un succès en dix secondes, le reste après »

Principe : l'onboarding ne configure que ce qui est indispensable au premier
succès ; tout le reste passe en découverte progressive (badge « nouveau »
dans les réglages, déjà existant via popup-news.js).

### Parcours proposé (3 écrans)

1. **Langue** — détection automatique de la langue du navigateur
   pré-sélectionnée, un clic sur « C'est parti » (l'étape reste pour les
   cas limites mais n'exige plus de décision).
2. **Un clic pour tout importer** — proposer d'abord l'import des
   abonnements Twitch (un clic, OAuth), l'ajout manuel en repli. C'est
   l'étape qui crée la valeur : sans streamer suivi, l'extension ne
   notifie rien.
3. **Le premier succès, immédiat** — écran final qui montre, dès l'arrivée :
   - les chaînes suivies **en live en ce moment** (l'API est déjà
     interrogée par le poll) avec un bouton « ouvrir » ;
   - les Drops récupérables tout de suite, s'il y en a ;
   - un bouton « Tester la notification » qui envoie une vraie notification
     bureau (la permission est déjà déclarée) ;
   - le pseudo et le badge communautaire en option repliée, avec « plus
     tard » par défaut.

Les réglages disparaissent de l'onboarding : l'écran 4 est supprimé, les
préférences restent à leur valeur par défaut et un bandeau « Nouveau :
réglages » prend le relais (mécanisme `popup-news.js` déjà en place).

### Ce qui reste inchangé

- L'opt-in du badge communautaire : il ne doit jamais être pré-coché
  (cohérence avec la déclaration de confidentialité du store).
- Les notes de version à la mise à jour (déjà non intrusives).

## 3. Mesure

La métrique qui compte : **utilisateurs actifs à J+7 / installations**.
Le Chrome Web Store ne donne pas le taux de désinstallation ; l'estimer par :

- numérateur : compteur local d'utilisateurs ayant du temps de visionnage
  ou des points à J+7 (`streamPulseWatchTimeDaily`, rétention 400 jours) —
  même mécanisme que les compteurs de la tâche 1 ;
- dénominateur : installations CWS de la semaine (dashboard).

À instrumenter seulement après le déploiement du nouveau parcours, pour
comparer avant/après sur deux semaines chacune. Avec quelques centaines
d'utilisateurs, on mesure des tendances, pas des points de pourcentage.

## 4. Effort et ordre

1. Réordonner : import Twitch d'abord, réglages supprimés de l'onboarding
   (1 à 2 h de travail, `js/onboarding.js`).
2. Écran final « premier succès » : lister les chaînes en live + bouton test
   de notification (2-3 h, réutilise le poll et `chrome.notifications`).
3. Mesure J+7 (1 h, même pattern que `popup-review.js`).

Aucun de ces changements ne touche au manifest ni aux permissions.
