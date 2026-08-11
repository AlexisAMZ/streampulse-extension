# Chrome Web Store Listing : StreamPulse

> Dernière mise à jour : 2026-08-06

---

## 1. Informations Principales du Store (Store Listing)

### Nom de l'extension
**FR** : `StreamPulse : extension Twitch & Kick` (37 / 75 caractères)  
**EN** : `StreamPulse: Twitch & Kick extension` (36 / 75 caractères)

### Description Courte (Short Description)
**FR** : `Collecte auto des points de chaîne, alertes live, aperçus au survol et filtres chat Twitch & Kick. Dispo en 15 langues ! Gratuit.` (130 / 132 caractères)  
**EN** : `Auto-claim Channel Points, live alerts, hover previews & chat filters for Twitch & Kick. Available in 15 languages! Free.` (122 / 132 caractères)

### Description Détaillée (Detailed Description - FR)
```text
StreamPulse est l'extension incontournable pour révolutionner votre expérience sur Twitch et Kick. Conçue pour être ultra-légère et rapide, elle centralise vos notifications et automatise vos actions sans ralentir votre navigateur.

✨ NOUVEAUTÉ : L'extension est désormais entièrement traduite et disponible dans plus de 15 langues ! 

Fonctionnalités principales :
• Récolte automatique des Points de Chaîne : Ne laissez plus filer vos points Twitch et récompenses Kick ! StreamPulse les collecte automatiquement en arrière-plan pendant que vous regardez.
• Alertes Live en temps réel : Soyez le premier averti. Recevez une notification native sur votre bureau dès que vos streamers préférés lancent leur direct.
• Aperçus vidéo au survol : Gagnez du temps en prévisualisant n'importe quel stream en direct d'un simple survol de la souris, sans même quitter la page en cours.
• Anti-Pause & Faible Latence : Empêchez la mise en pause automatique de vos streams lorsque vous changez d'onglet, et profitez d'une correction automatique de l'erreur réseau #2000 sur Twitch.
• Filtre de Chat & Temps de visionnage : Bloquez le spam grâce à des filtres par mots-clés et suivez le temps total que vous passez sur vos chaînes favorites.
• Tableau de bord unifié : Un pop-up élégant regroupant Twitch et Kick pour voir tous vos streamers en direct d'un seul coup d'œil.

Respect absolu de la vie privée :
StreamPulse ne collecte AUCUNE donnée personnelle, ne nécessite AUCUN compte et ne contient AUCUNE publicité. Vos préférences restent stockées en toute sécurité, localement sur votre ordinateur.
```

### Detailed Description (EN)
```text
StreamPulse is the ultimate browser extension to elevate your Twitch and Kick viewing experience. Ultra-lightweight and lightning fast, it automates your workflow without slowing down your browser.

✨ NEW: The extension is now fully translated and available in over 15 languages!

Key Features:
• Auto-Collect Channel Points: Never miss out on Twitch channel points or Kick rewards! StreamPulse claims them automatically in the background while you enjoy the stream.
• Real-Time Live Alerts: Be the first in chat. Get instant desktop notifications the second your favorite streamers go live.
• Live Hover Previews: Save time by previewing any live stream just by hovering over a channel link—no need to leave your current tab.
• Anti-Pause & Player Optimization: Prevent streams from pausing automatically when you switch tabs, and enjoy auto-recovery from annoying network errors (like Twitch #2000).
• Chat Filtering & Watch Time Tracker: Hide unwanted spam using keyword filters, and track your exact watch time across your favorite channels.
• Unified Dashboard: A sleek, all-in-one pop-up that seamlessly brings Twitch and Kick together to show who's live at a glance.

Privacy First:
StreamPulse does NOT collect any personal data, requires NO account, and contains ZERO ads or trackers. All your settings are securely saved locally on your device.
```

### Catégorie
`Productivité` (Productivity) ou `Outils de recherche` (Search Tools / Developer Tools)

### Objectif Unique (Single Purpose)
**FR** : `Centraliser les alertes de direct, la collecte automatique de points de chaîne et le filtrage de chat pour Twitch et Kick dans une interface unique.`  
**EN** : `Provide live stream notifications, automatic channel points collection, and chat filtering for Twitch and Kick in a single extension.`

### Langue Principale
`Français` (Primary), `Anglais` (Secondary)

---

## 2. Visuels et Assets (Graphics & Assets)

| Asset | Dimensions | Statut | Fichier |
|-------|-----------|--------|---------|
| Icône du Store | 128×128 PNG | ✅ Prêt | `images/photos/128px.png` |
| Capture d'écran 1 (Popup Dashboard) | 1280×800 ou 640×400 | ✅ Prêt | `images/screenshots/dashboard.png` |
| Capture d'écran 2 (Aperçu au survol) | 1280×800 ou 640×400 | ✅ Prêt | `images/screenshots/preview.png` |
| Capture d'écran 3 (Points de chaîne) | 1280×800 ou 640×400 | ✅ Prêt | `images/screenshots/points.png` |
| Capture d'écran 4 (Filtres chat) | 1280×800 ou 640×400 | ✅ Prêt | `images/screenshots/chat_filter.png` |
| Petite tuile promotionnelle | 440×280 PNG | 🟡 À générer | `images/promo/small_tile.png` |
| Grande tuile promotionnelle | 1400×560 PNG | 🟡 À générer | `images/promo/marquee.png` |

---

## 3. Justification des Permissions (Permissions Justification)

| Permission | Type | Justification explicite pour le Chrome Web Store |
|------------|------|--------------------------------------------------|
| `storage` | `permissions` | Permet d'enregistrer localement les préférences utilisateur, la liste des chaînes suivies, les filtres de chat et les statistiques sans serveur externe. |
| `alarms` | `permissions` | Permet d'exécuter des vérifications périodiques légères en arrière-plan pour détecter les prises de live Twitch/Kick et mettre à jour le statut des streams. |
| `notifications` | `permissions` | Permet d'afficher des notifications système natives à l'utilisateur lorsqu'un streamer suivi démarre son direct. |
| `offscreen` | `permissions` | Permet de créer un document hors écran dédié à la lecture des sons d'alerte et à la gestion audio sans bloquer le service worker. |
| `tabs` | `permissions` | Permet de détecter si des onglets Twitch ou Kick sont ouverts afin d'appliquer l'anti-pause vidéo et la synchronisation du lecteur. |
| `https://api.twitch.tv/*` | `host_permissions` | Permet d'interroger l'API officielle Twitch pour vérifier l'état en direct des chaînes et obtenir les métadonnées des streams. |
| `https://tmi.twitch.tv/*` | `host_permissions` | Permet de communiquer avec les serveurs de messagerie Twitch pour les fonctionnalités de chat et d'interaction. |
| `https://gql.twitch.tv/*` | `host_permissions` | Permet d'interagir avec l'API GraphQL Twitch pour la récupération automatique des Channel Points et l'affichage des prévisualisations. |
| `https://www.twitch.tv/*` | `host_permissions` | Permet d'injecter les scripts de prévisualisation au survol, l'anti-pause et le filtre de chat directement sur les pages Twitch. |
| `https://clips.twitch.tv/*` | `host_permissions` | Permet d'afficher les aperçus et lecteurs légers sur les clips Twitch. |
| `https://kick.com/*` | `host_permissions` | Permet d'injecter les scripts d'amélioration de lecteur, la récolte des points et le filtre de chat sur Kick.com. |
| `https/*.kick.com/*` | `host_permissions` | Permet de prendre en compte l'ensemble des sous-domaines Kick pour le monitoring et la prévisualisation. |
| `https://files.kick.com/*` | `host_permissions` | Permet de charger les images de profil, avatars et badges des streamers Kick. |
| `https://images.kick.com/*` | `host_permissions` | Permet d'afficher les vignettes et captures de couverture des lives Kick dans la pop-up. |
| `https://stream.kick.com/*` | `host_permissions` | Permet de récupérer les flux vidéo et prévisualisations de stream Kick. |
| `https://id.kick.com/*` | `host_permissions` | Permet de vérifier l'état de session utilisateur pour la récolte des récompenses Kick. |
| `https://api.kick.com/*` | `host_permissions` | Permet d'interroger l'API Kick pour obtenir les statuts en direct des streamers suivis. |

---

## 4. Confidentialité et Utilisation des Données (Privacy & Data Use)

### Collecte de données
- **L'extension collecte-t-elle des données utilisateur ?** : **Non**
- **Données transmises hors de l'appareil ?** : **Non**
- **Vente à des tiers ?** : **Non**
- **Utilisation à des fins publicitaires / crédit ?** : **Non**

### Déclaration d'utilisation des données
- Toutes les données (options, filtres, streamers enregistrés) sont conservées exclusivement en local via `chrome.storage.local`.
- Aucun serveur tiers d'analyse, de tracking ou de télémétrie n'est utilisé.

---

## 5. Politique de Confidentialité (Privacy Policy)

**URL de la politique de confidentialité** : `https://streampulse.fr/privacy` (ou via la page support `https://streampulse.fr/support.html`)

---

## 6. Informations Développeur & Support

- **Editeur** : `AlexisAMZ`
- **Email de contact** : `contact@streampulse.fr`
- **Site web officiel** : `https://streampulse.fr`
- **Support / Feedback** : `https://streampulse.fr/support.html`

---

## 7. Historique des Versions (Version History)

| Version | Date | Description des changements | Statut CWS |
|---------|------|-----------------------------|------------|
| 26.8.9 | 2026-08-10 | Bouton « Ajouter à StreamPulse » sur les pages de chaîne Twitch, page de notes de version localisée, anneau LIVE autour de l'avatar de l'onglet avec clignotement au raid, correction des libellés restés en français quelle que soit la langue. | Prêt pour publication |
| 26.8.6 | 2026-08-06 | Amélioration des aperçus vidéo Twitch/Kick, optimisation anti-pause du lecteur et gestion i18n FR/EN. | Prêt pour publication |
