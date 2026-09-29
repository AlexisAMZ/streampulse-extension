# DESIGN.md — StreamPulse

Décisions de design durables et assumées. Modifie ce fichier quand une décision change, pas quand une implémentation évolue dans son cadre.

## Modes par surface

| Surface | Mode | Pourquoi |
|---|---|---|
| Popup (tableau de bord des lives) | Operate | Le viewer vérifie qui est live et agit en deux secondes. |
| Onboarding | Operate | Configuration guidée, pas du marketing. |
| UI injectée Twitch/Kick (topbar, drawer, badges, prédictions) | Operate | Invitée chez la plateforme : discrète, fonctionnelle. |
| Récap | Experience | L'image produite est le produit ; l'interface s'efface. |
| Changelog | Read | Structuré pour la lecture. |

## Voix

Décision du propriétaire du 2026-09-29, valable pour tout texte français (extension, pages, fiches des stores).

- **Tutoiement partout.** Jamais « vous / votre / vos » adressé à l'utilisateur, ni d'impératif en « -ez ».
- **Accords neutres.** Pas de participe ou d'adjectif au masculin qui désigne l'utilisateur (« tu es prêt », « tu seras prévenu », « connecté ») : on reformule (« C'est prêt ! », « On te prévient dès que… », « nécessite une session Twitch ouverte »). Pas de point médian.
- **Réglages.** Libellé = ce que ça fait. Description = l'effet réel, la plateforme concernée (Twitch / Kick / YouTube) et les dépendances (« nécessite… », « au prochain chargement de la page »). Pas de jargon technique (codes d'erreur, noms d'API, anglicismes comme « overlay », « Wrapped »).
- **Erreurs.** Le problème, puis quoi faire (« {{platform}} ne répond pas. Vérifie ta connexion Internet et réessaie dans un instant. »). Jamais « Erreur » seul ni « Réessaie » sans contexte.

Glossaire FR :

| Terme | Emploi | À éviter |
|---|---|---|
| streamer | une personne ajoutée dans StreamPulse | « créateur », « chaîne » pour la personne |
| chaîne | la page Twitch / Kick / YouTube elle-même | |
| Ajouter à StreamPulse | ajouter un streamer à l'extension | « Suivre » (réservé au Follow de Twitch) |
| Compter / Historique | mesurer les points gagnés, garder la liste des Drops | « Suivre » au sens de mesurer, « Tracker » |
| Récupération auto | des Points de chaîne, Drops, Moments (pastille : « Récupération auto active ») | « Auto-claim » |
| Aperçus, Barre latérale, Répertoire | aperçus au survol et leurs emplacements | « Previews », « Sidebar » |
| chat | le chat d'une chaîne, comme l'interface française de Twitch | « tchat » |
| En direct / un live | statut / nom | |
| Récap | avec accent ; le récap annuel est « récap de l'année » | « Recap », « Wrapped » |
| Drops, Moments, Raids, Points de chaîne | majuscule quand c'est la fonction | |
| Notifications | les réglages d'alertes ; « alerte » reste pour un type (« alerte de catégorie ») | |

## Décisions verrouillées

### La popup est fixe 780×600
C'est le maximum autorisé par Chrome et nous l'utilisons intégralement, sans media queries. La popup ne doit **jamais** être rendue fluide ou rognée : les longues chaînes (allemand, russe) se tronquent par ellipses, jamais par débordement. Le responsive est traité sur les pages libres (onboarding, changelog, récap), pas sur la popup.

### L'UI injectée est dark-first, choix de marque
Les panneaux injectés (topbar, drawer de réglages, prédictions, badge) restent sombres (`#0b0c22` — le fond de la scène du popup) **même quand Twitch ou Kick est en thème clair**. C'est délibéré : StreamPulse doit se reconnaître d'un coup d'œil chez l'hôte, et l'écosystème Twitch est dark-first. Ne pas « adapter » ces panneaux au thème de l'hôte sans nouvelle décision explicite.

Les variables injectées sont préfixées `--sp-*` (css/inject/twitch-ui.css) pour ne jamais entrer en collision avec celles de l'hôte.

### Twitch et Kick ne sont pas la marque
`#9146FF`, `#53FC18` et `#FF0000` (YouTube) identifient les plateformes d'un streamer ; la couleur d'accent de StreamPulse vit dans `css/tokens.css` (`--violet`, 5 palettes). Les hexadécimaux de plateforme n'apparaissent que comme anneaux/étiquettes d'identification.

### Les cosmétiques Plus sont des fonctionnalités
Textes dégradés (`sp-paint`), glows, bounce et flicker des badges de chat sont des effets **choisis et payés par l'utilisateur Plus** pour son propre badge : ce sont des features, pas des anti-patterns de design. Ils sont dupliqués volontairement entre `css/inject/twitch-badge.css` (rendu réel) et l'aperçu de `css/popup.css` (préview popup) — garder les deux en synchro à chaque modification.

### Mouvement
`prefers-reduced-motion` est honoré dans chaque feuille de style, y compris injectée. Les animations d'interface (non cosmetiques) utilisent `--ease-out`, jamais de rebond.

### Aperçu des lives : capture pour Twitch, lecteur muet pour Kick, vignette rafraîchie pour YouTube
Sur la scène de la popup, Twitch affiche sa thumbnail (capture), disponible publiquement. Kick n'expose plus aucune thumbnail par son API (champ `thumbnail: null`, fichiers 403) : pour Kick uniquement, le lecteur `player.kick.com` **muet** (`muted=true`) est monté directement plein cadre dès l'affichage du streamer — pas de survol requis, pas de son. YouTube reste sur vignette : son lecteur refuse de se charger depuis une page d'extension (erreur 153, origine non web, testé avec et sans `youtube-nocookie`/`origin`/`widget_referrer`) ; sa vignette de stream étant rafraîchie côté YouTube, le cache-buster par minute du background la rend quasi live. Jamais de vidéo dans les cartes de la bande ni dans la liste. En cas d'absence d'image, le fond est l'avatar pré-flouté.

### Suppression accessible depuis le tableau de bord
Chaque carte de live porte sa corbeille (au survol, comme l'épingle) avec confirmation inline sur la carte (`mini-confirm`). La liste complète (sheet) garde sa corbeille par ligne. Ne jamais supprimer sans confirmation.

### Exceptions volontaires aux détecteurs d'anti-patterns
Constats assumés, à ne pas « corriger » : glows violets et textes dégradés des cosmétiques Plus (voir plus haut) ; rebond `sp-badge-bounce` des badges de chat (feature Plus) ; `#c4a3ff` (`--violet-text`) sur les titres (marque) ; groupes de réglages encadrés dans leur panneau (menu popup, insights du récap, aperçu du chat de l'onboarding) — boîtes dans boîtes assumées ; pills du stepper et champs compacts du popup (surface souris fixe, padding validé au rendu).

## Tokens

Source de vérité : `css/tokens.css`. Règle : toute couleur référencée plus d'une fois devient un token ; les hexadécimaux locaux ne sont tolérés que pour le shading du fond de scène sombre (`#0b0c22` et ses rgba dérivés).
