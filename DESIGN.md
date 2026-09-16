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

## Décisions verrouillées

### La popup est fixe 780×600
C'est le maximum autorisé par Chrome et nous l'utilisons intégralement, sans media queries. La popup ne doit **jamais** être rendue fluide ou rognée : les longues chaînes (allemand, russe) se tronquent par ellipses, jamais par débordement. Le responsive est traité sur les pages libres (onboarding, changelog, récap), pas sur la popup.

### L'UI injectée est dark-first, choix de marque
Les panneaux injectés (topbar, drawer de réglages, prédictions, badge) restent sombres (`#0b0c22` — le fond de la scène du popup) **même quand Twitch ou Kick est en thème clair**. C'est délibéré : StreamPulse doit se reconnaître d'un coup d'œil chez l'hôte, et l'écosystème Twitch est dark-first. Ne pas « adapter » ces panneaux au thème de l'hôte sans nouvelle décision explicite.

Les variables injectées sont préfixées `--sp-*` (css/inject/twitch-ui.css) pour ne jamais entrer en collision avec celles de l'hôte.

### Twitch et Kick ne sont pas la marque
`#9146FF` et `#53FC18` identifient les plateformes d'un streamer ; la couleur d'accent de StreamPulse vit dans `css/tokens.css` (`--violet`, 5 palettes). Les hexadécimaux de plateforme n'apparaissent que comme anneaux/étiquettes d'identification.

### Les cosmétiques Plus sont des fonctionnalités
Textes dégradés (`sp-paint`), glows, bounce et flicker des badges de tchat sont des effets **choisis et payés par l'utilisateur Plus** pour son propre badge : ce sont des features, pas des anti-patterns de design. Ils sont dupliqués volontairement entre `css/inject/twitch-badge.css` (rendu réel) et l'aperçu de `css/popup.css` (préview popup) — garder les deux en synchro à chaque modification.

### Mouvement
`prefers-reduced-motion` est honoré dans chaque feuille de style, y compris injectée. Les animations d'interface (non cosmetiques) utilisent `--ease-out`, jamais de rebond.

## Tokens

Source de vérité : `css/tokens.css`. Règle : toute couleur référencée plus d'une fois devient un token ; les hexadécimaux locaux ne sont tolérés que pour le shading du fond de scène sombre (`#0b0c22` et ses rgba dérivés).
