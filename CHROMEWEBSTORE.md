# Chrome Web Store Listing : StreamPulse

> Dernière mise à jour : 2026-09-13

---

## 1. Informations Principales du Store (Store Listing)

### Nom de l'extension
**FR** : `StreamPulse : Alertes, Points & Drops Twitch & Kick` (51 / 75 caractères)  
**EN** : `StreamPulse: Twitch & Kick Alerts, Points & Drops` (49 / 75 caractères)

### Description Courte (Short Description)
**FR** : `Points de chaîne et Drops Twitch auto, alertes live, aperçus au survol, filtres de chat et récap de visionnage. Twitch & Kick.` (126 / 132 caractères)  
**EN** : `Auto-claim Twitch channel points & Drops, live alerts, hover previews, chat filters and watch time recaps for Twitch & Kick.` (124 / 132 caractères)

### Description Détaillée (Detailed Description - FR)
```text
StreamPulse réunit Twitch et Kick dans une seule extension légère. Elle surveille vos streamers préférés, automatise les clics répétitifs et garde votre navigateur rapide.

🌍 Entièrement traduite en 15 langues.

Fonctionnalités principales :
• Points de chaîne et Drops Twitch : StreamPulse récupère automatiquement vos bonus de points de chaîne et vos Drops Twitch pendant que vous regardez, et comptabilise les points gagnés sur Kick.
• Alertes live en temps réel : Recevez une notification sur votre bureau dès qu'un streamer suivi lance son direct, et, si vous le souhaitez, quand il change le titre de son stream.
• Bouton « Ajouter à StreamPulse » : Suivez un streamer en un clic depuis sa page de chaîne Twitch.
• Aperçus au survol : Prévisualisez un stream en direct en survolant le lien d'une chaîne sur Twitch, sans quitter l'onglet en cours.
• Anti-pause et récupération du lecteur : Le stream continue quand vous changez d'onglet, et le lecteur se relance tout seul après une erreur comme la #2000 de Twitch.
• Filtre de chat : Masquez les messages par mot-clé ou ceux de certains utilisateurs, sur Twitch et Kick.
• Temps de visionnage et récap : Suivez votre temps passé sur chaque chaîne, puis créez une image récap à partager sur les 7 ou 30 derniers jours ou sur un mois, au format PC (16:9) ou mobile (9:16).
• Badge communautaire : Repérez l'icône StreamPulse à côté des autres utilisateurs de l'extension dans le tchat Twitch. Désactivable à tout moment.
• Tableau de bord unifié : Un pop-up unique pour Twitch et Kick qui montre d'un coup d'œil qui est en direct.

Confidentialité :
StreamPulse ne demande aucun compte et ne contient ni publicité ni traceur. Vos streamers, vos réglages et votre temps de visionnage restent stockés sur votre appareil. Seul le badge communautaire envoie une donnée à notre serveur : une empreinte (hash) de votre pseudo Twitch (jamais le pseudo lui-même), au plus une fois par jour. Désactivez le badge dans les réglages pour l'arrêter.
```

### Detailed Description (EN)
```text
StreamPulse brings Twitch and Kick together in one lightweight extension. It keeps an eye on your favorite streamers, automates repetitive clicks and keeps your browser fast.

🌍 Fully translated into 15 languages.

Key Features:
• Twitch Channel Points & Drops: StreamPulse automatically claims your Twitch channel point bonuses and Drops while you watch, and counts the points you earn on Kick.
• Real-Time Live Alerts: Get a desktop notification as soon as a streamer you follow goes live and, if you want, when they change their stream title.
• "Add to StreamPulse" Button: Track a streamer in one click from their Twitch channel page.
• Live Hover Previews: Preview a live stream by hovering over a channel link on Twitch, without leaving your current tab.
• Anti-Pause & Player Recovery: Streams keep playing when you switch tabs, and the player restarts by itself after errors such as Twitch #2000.
• Chat Filtering: Hide messages by keyword or from specific users, on Twitch and Kick.
• Watch Time & Recap: Track the time you spend on each channel, then create a shareable recap image for the last 7 or 30 days or any month, in desktop (16:9) or mobile (9:16) format.
• Community Badge: Spot the StreamPulse icon next to other StreamPulse users in Twitch chat. You can turn it off at any time.
• Unified Dashboard: One pop-up for Twitch and Kick that shows who is live at a glance.

Privacy:
StreamPulse requires no account and contains no ads or trackers. Your streamers, settings and watch time are stored on your device. Only the community badge sends data to our server: a hashed version of your Twitch username (never the username itself), at most once a day. Turn the badge off in Settings to stop it.
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
| Capture 1 (Dashboard) × 15 langues | 1280×800 PNG | ✅ Prêt | `images/cws_screenshots/<LANGUE>/01-dashboard.png` |
| Capture 2 (Notifications & automatisation) × 15 langues | 1280×800 PNG | ✅ Prêt | `images/cws_screenshots/<LANGUE>/02-automation.png` |
| Capture 3 (Fonctionnalités) × 15 langues | 1280×800 PNG | ✅ Prêt | `images/cws_screenshots/<LANGUE>/03-features.png` |
| Petite tuile promotionnelle | 440×280 PNG 24 bits | ✅ Prêt | `images/promo/small_tile.png` |
| Grande tuile promotionnelle | 1400×560 PNG | 🟡 À générer | `images/promo/marquee.png` |

### Régénérer les captures localisées

```bash
npm run store:assets           # les 15 langues
npm run store:assets -- fr en  # seulement celles listées
```

Le script rend le vrai `html/popup.html` dans Chrome headless en 2×, applique les
traductions de `i18n/translations.js`, puis compose le cadre 1280×800. Les titres
viennent des traductions embarquées, la grille de fonctionnalités des puces de la
section 8 de ce document : aucun texte n'est produit à la volée.

Pour substituer une capture manuelle plutôt que le rendu automatique, déposer un
fichier `source-dashboard.png` (ou `source-automation.png`) dans le dossier de la
langue. Viser ~1640 px de large : en dessous, le script prévient que l'image sera
agrandie. Les 15 dossiers utilisent actuellement la même capture manuelle pour
`01-dashboard`, en anglais ; les textes du cadre restent traduits par langue.

Langues couvertes : CS, DE, EN, ES, FR, ID, IT, JA, KO, NL, PL, PT-BR, RU, SV, TR.
`hi` n'a pas de dossier tant que `ready: false` dans `i18n/translations.js`.

### Garde-fou « marketing responsable »

Refus du 2026-08-13, motif *Impersonation and Intellectual Property* : une capture
portait « 100% Free and Free forever ». Le règlement interdit sur les **assets**
tout badge ou texte du type « gratuit », « nouveau », « n° 1 », « premium »,
« recommandé ».

`scripts/store-assets/policy.mjs` tient la liste des termes interdits pour les 15
langues. Sur les textes marketing, que l'on maîtrise, la génération **échoue**
plutôt que de laisser repartir un asset fautif vers la validation. Sur les chaînes
d'interface, elle se contente d'**avertir** : le règlement vise les badges
promotionnels, pas le vocabulaire fonctionnel du produit (l'allemand
« Player neu laden » ou le turc « Yenile » ne sont pas des arguments de vente).

Corrections appliquées :
- tuile promotionnelle : pastille « Gratuit » retirée ;
- descriptions courtes : phrase finale de gratuité retirée dans les 15 langues ;
- descriptions longues : étiquette de nouveauté (`✨ NOUVEAUTÉ :`, `✨ NEW:`…)
  retirée, l'information sur les 15 langues est conservée ;
- descriptions longues : superlatif retiré en PL, TR, RU, KO, ID
  (« najlepsze », « en iyi », « лучшее », « 최고의 », « terbaik »).

**À faire côté console** : la capture portant « 100% Free and Free forever »
n'existe que dans le Chrome Web Store, pas dans ce dépôt. Elle doit être
supprimée à la main dans l'onglet Éléments graphiques : aucune régénération
locale ne la retire.

---

## 3. Justification des Permissions (Permissions Justification)

| Permission | Type | Justification explicite pour le Chrome Web Store |
|------------|------|--------------------------------------------------|
| `storage` | `permissions` | Permet d'enregistrer localement les préférences utilisateur, la liste des chaînes suivies, les filtres de chat et les statistiques sans serveur externe. |
| `alarms` | `permissions` | Permet d'exécuter des vérifications périodiques légères en arrière-plan pour détecter les prises de live Twitch/Kick et mettre à jour le statut des streams. |
| `notifications` | `permissions` | Permet d'afficher des notifications système natives à l'utilisateur lorsqu'un streamer suivi démarre son direct. |
| `offscreen` | `permissions` | Permet de créer un document hors écran dédié à la lecture des sons d'alerte et à la gestion audio sans bloquer le service worker. |
| `https://api.twitch.tv/*` | `host_permissions` | Permet d'interroger l'API officielle Twitch pour vérifier l'état en direct des chaînes et obtenir les métadonnées des streams. |
| `https://tmi.twitch.tv/*` | `host_permissions` | Permet de communiquer avec les serveurs de messagerie Twitch pour les fonctionnalités de chat et d'interaction. |
| `https://gql.twitch.tv/*` | `host_permissions` | Permet d'interagir avec l'API GraphQL Twitch pour la récupération automatique des Channel Points et l'affichage des prévisualisations. |
| `https://www.twitch.tv/*` | `host_permissions` | Permet d'injecter les scripts de prévisualisation au survol, l'anti-pause et le filtre de chat directement sur les pages Twitch. |
| `https://clips.twitch.tv/*` | `host_permissions` | Permet d'afficher les aperçus et lecteurs légers sur les clips Twitch. |
| `https://kick.com/*` | `host_permissions` | Permet d'injecter les scripts d'amélioration de lecteur, la récolte des points et le filtre de chat sur Kick.com. |
| `https://*.kick.com/*` | `host_permissions` | Couvre les sous-domaines Kick utilisés par l'extension : API officielle (statuts en direct), images et avatars des streamers, vignettes et flux de prévisualisation, et session pour la récolte des récompenses. |

---

## 4. Confidentialité et Utilisation des Données (Privacy & Data Use)

> À recopier tel quel dans l'onglet **Confidentialité** de la console. L'ancienne
> déclaration (« aucune donnée transmise ») était fausse : le badge communautaire
> envoie une empreinte du pseudo Twitch, et il est activé par défaut.

### Données collectées (cases à cocher)
- ☑ **Informations permettant d'identifier personnellement l'utilisateur** (*Personally identifiable information*) : empreinte pseudonyme du pseudo Twitch, pour le badge communautaire.
- ☐ Informations sur la santé, ☐ Informations financières et de paiement, ☐ Informations d'authentification, ☐ Communications personnelles, ☐ Localisation, ☐ Historique Web, ☐ Activité de l'utilisateur, ☐ Contenu des sites Web : **non**.

Pourquoi « Activité de l'utilisateur » et « Historique Web » restent décochés : le temps de visionnage, les streamers suivis et les points ne quittent jamais l'appareil (`chrome.storage.local`). Les pseudos des streamers ajoutés sont envoyés aux API publiques de Twitch et Kick uniquement pour obtenir leur statut en direct, ce qui relève du fonctionnement annoncé de l'extension.

### Détail à fournir si la console le demande
**FR** : `Le badge communautaire, activé par défaut et désactivable dans Réglages → Chat, envoie au plus une fois par jour une empreinte SHA-256 salée et tronquée du pseudo Twitch de l'utilisateur à streampulse.fr. Le pseudo en clair n'est jamais transmis ni stocké. Cette empreinte sert uniquement à afficher le badge StreamPulse dans le tchat Twitch des autres utilisateurs de l'extension.`
**EN** : `The community badge, enabled by default and turned off in Settings → Chat, sends a salted, truncated SHA-256 hash of the user's Twitch username to streampulse.fr at most once a day. The plain username is never sent or stored. The hash is only used to show the StreamPulse badge in Twitch chat for other extension users.`

### Certifications (les trois à cocher)
- ☑ Je ne vends ni ne transfère les données des utilisateurs à des tiers, en dehors des cas d'utilisation approuvés.
- ☑ Je n'utilise ni ne transfère les données des utilisateurs à des fins sans rapport avec la fonctionnalité principale de l'extension.
- ☑ Je n'utilise ni ne transfère les données des utilisateurs pour déterminer leur solvabilité ou accorder des prêts.

### Déclaration d'utilisation des données
- Streamers suivis, préférences, filtres, points et temps de visionnage (mensuel et journalier) : stockés uniquement en local via `chrome.storage.local`.
- Envoyé à `streampulse.fr` : l'empreinte du pseudo Twitch (badge communautaire) et, seulement quand l'utilisateur active StreamPulse+, sa clé de licence avec un identifiant d'appareil aléatoire (limite de 2 navigateurs par clé). Les requêtes de configuration et de liste des badges ne contiennent aucune donnée utilisateur.
- Envoyé aux API publiques de Twitch et Kick : les pseudos des streamers ajoutés, pour vérifier leur statut en direct.
- Aucun serveur d'analyse, de tracking, de télémétrie ou de publicité.

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
| 26.9.18 | 2026-09-15 | Permissions minimales : retrait de `tabs` (plus d'avertissement « Lire l'historique de navigation »), ressources exposées limitées aux logos sur Twitch, permissions Kick regroupées. Captures du store avec des chaînes fictives. | Prêt pour publication |
| 26.9.17 | 2026-09-15 | Correctif : appels au serveur StreamPulse (badge, clé StreamPulse+, config Twitch) passés sur streampulse.fr sans www, remerciement à l'activation StreamPulse+, bandeau quand les notifications sont bloquées, avertissement quand une alerte intelligente coupe l'alerte classique, lien étoile GitHub dans les réglages. | Publiée |
| 26.9.16 | 2026-09-14 | Correctif : badge, couleur, effets et pseudo spécial StreamPulse+ absents des messages déjà affichés au chargement de Twitch. | Prêt pour publication |
| 26.9.15 | 2026-09-14 | Onglet Historique (lives ratés en vignettes avec rediffusion Twitch), StreamPulse+ (formule mensuelle ou à vie, clé de licence sur 2 navigateurs, gestion d'abonnement), alertes intelligentes par jeu, mot du titre ou seuil de viewers, menu StreamPulse+ (couleur d'accent, couleur et effets animés du badge, pseudos spéciaux visibles par tous et mis à jour en direct), récap avancé et Wrapped annuel, prédictions assistées, nom de chaîne entier dans le récap, onglet Nouveautés aligné, compteur de Drops du jour masqué, appels réseau migrés vers streampulse.fr et permission alexisamz.fr retirée. | Remplacée par 26.9.16 avant publication |
| 26.9.14 | 2026-09-14 | Nouveau design du popup (streamer en vedette, bandeau de lives, points et Drops du jour), épingles et groupes de chaînes, restyle du récap, des notes de version, de l'onboarding et des éléments Twitch, import de sauvegarde qui fusionne au lieu de remplacer, bouton « Partir » reconnu pour annuler les raids, nouvelles captures et visuels promo. | Prêt pour publication |
| 26.9.13 | 2026-09-13 | Alertes de changement de titre (réglage global et bouton par streamer), photo de profil Twitch en filigrane derrière les statistiques, infobulles au survol sur les boutons de carte, correction du nom de plateforme affiché deux fois, et grande passe de correction des traductions dans 12 langues, dernière catégorie et dernier titre conservés sur les cartes hors ligne, photo de profil qui suit le changement de pseudo, et disparition du bandeau « Aucune préférence à mettre à jour » injustifié. | Prêt pour publication |
| 26.8.11 | 2026-08-11 | Bouton « Ajouter à StreamPulse » sur les pages de chaîne Twitch, page de notes de version localisée, traductions dans 15 langues ajoutées, ajustements d'interface (indicateur de latence). | Prêt pour publication |
| 26.8.6 | 2026-08-06 | Amélioration des aperçus vidéo Twitch/Kick, optimisation anti-pause du lecteur et gestion i18n FR/EN. | Prêt pour publication |

---

## 8. Traductions pour le Chrome Web Store (Prêt à copier-coller)

Les textes suivants sont formatés en texte brut pur, sans tiret cadratin ni markdown incompatible avec le Chrome Web Store.

### 🇪🇸 Espagnol (ES)
**Short Description**:
`Puntos de canal y Drops de Twitch automáticos, alertas en directo, vistas previas, filtros de chat y resumen de visualización.`

**Detailed Description**:
```text
StreamPulse reúne Twitch y Kick en una sola extensión ligera. Vigila a tus streamers favoritos, automatiza los clics repetitivos y mantiene tu navegador rápido.

🌍 Totalmente traducida a 15 idiomas.

Características principales:
• Puntos de canal y Drops de Twitch: StreamPulse reclama automáticamente tus bonificaciones de puntos de canal y tus Drops de Twitch mientras miras, y cuenta los puntos que ganas en Kick.
• Alertas en directo: Recibe una notificación de escritorio en cuanto un streamer que sigues empieza a emitir y, si quieres, cuando cambia el título de su stream.
• Botón «Añadir a StreamPulse»: Sigue a un streamer con un clic desde su página de canal de Twitch.
• Vistas previas al pasar el cursor: Previsualiza un stream en directo pasando el ratón por el enlace de un canal en Twitch, sin salir de la pestaña actual.
• Antipausa y recuperación del reproductor: El stream sigue al cambiar de pestaña y el reproductor se reinicia solo tras errores como el #2000 de Twitch.
• Filtro de chat: Oculta mensajes por palabra clave o de ciertos usuarios, en Twitch y Kick.
• Tiempo de visualización y resumen: Controla el tiempo que pasas en cada canal y crea una imagen resumen para compartir de los últimos 7 o 30 días o de un mes, en formato PC (16:9) o móvil (9:16).
• Insignia comunitaria: Distingue el icono de StreamPulse junto a otros usuarios de la extensión en el chat de Twitch. Se puede desactivar en cualquier momento.
• Panel unificado: Una sola ventana para Twitch y Kick que muestra de un vistazo quién está en directo.

Privacidad:
StreamPulse no requiere cuenta y no contiene anuncios ni rastreadores. Tus streamers, ajustes y tiempo de visualización se guardan en tu dispositivo. Solo la insignia comunitaria envía un dato a nuestro servidor: un hash de tu nombre de usuario de Twitch (nunca el nombre en sí), como máximo una vez al día. Desactiva la insignia en los ajustes para detenerlo.
```



---




### 🇧🇷 Portugais (PT-BR)
**Short Description**:
`Pontos do canal e Drops da Twitch automáticos, alertas ao vivo, prévias, filtros de chat e resumo do tempo assistido. Twitch e Kick.`

**Detailed Description**:
```text
O StreamPulse reúne Twitch e Kick em uma única extensão leve. Ele acompanha seus streamers favoritos, automatiza cliques repetitivos e mantém seu navegador rápido.

🌍 Totalmente traduzido para 15 idiomas.

Principais recursos:
• Pontos do canal e Drops da Twitch: O StreamPulse resgata automaticamente seus bônus de pontos do canal e seus Drops da Twitch enquanto você assiste, e contabiliza os pontos ganhos na Kick.
• Alertas ao vivo em tempo real: Receba uma notificação na área de trabalho assim que um streamer que você segue entrar ao vivo e, se quiser, quando ele mudar o título da transmissão.
• Botão "Adicionar ao StreamPulse": Acompanhe um streamer com um clique na página do canal na Twitch.
• Prévias ao passar o mouse: Veja uma prévia de uma live passando o mouse sobre o link de um canal na Twitch, sem sair da aba atual.
• Antipausa e recuperação do player: A live continua quando você troca de aba, e o player reinicia sozinho após erros como o #2000 da Twitch.
• Filtro de chat: Oculte mensagens por palavra-chave ou de usuários específicos, na Twitch e na Kick.
• Tempo assistido e resumo: Acompanhe o tempo gasto em cada canal e crie uma imagem de resumo para compartilhar dos últimos 7 ou 30 dias ou de um mês, no formato PC (16:9) ou celular (9:16).
• Distintivo comunitário: Identifique o ícone do StreamPulse ao lado de outros usuários da extensão no chat da Twitch. Pode ser desativado a qualquer momento.
• Painel unificado: Uma única janela para Twitch e Kick que mostra rapidamente quem está ao vivo.

Privacidade:
O StreamPulse não exige conta e não tem anúncios nem rastreadores. Seus streamers, configurações e tempo assistido ficam salvos no seu dispositivo. Somente o distintivo comunitário envia um dado ao nosso servidor: um hash do seu nome de usuário da Twitch (nunca o nome em si), no máximo uma vez por dia. Desative o distintivo nas configurações para interromper o envio.
```



---




### 🇩🇪 Allemand (DE)
**Short Description**:
`Twitch-Kanalpunkte & Drops automatisch, Live-Alarme, Vorschauen, Chatfilter und Rückblick deiner Zuschauzeit für Twitch & Kick.`

**Detailed Description**:
```text
StreamPulse vereint Twitch und Kick in einer schlanken Erweiterung. Sie behält deine Lieblingsstreamer im Blick, automatisiert wiederkehrende Klicks und hält deinen Browser schnell.

🌍 Vollständig in 15 Sprachen übersetzt.

Hauptfunktionen:
• Twitch-Kanalpunkte und Drops: StreamPulse holt deine Kanalpunkte-Boni und Twitch-Drops automatisch ab, während du zuschaust, und zählt die auf Kick gesammelten Punkte.
• Live-Benachrichtigungen in Echtzeit: Erhalte eine Desktop-Benachrichtigung, sobald ein gefolgter Streamer live geht, und auf Wunsch auch, wenn er den Titel seines Streams ändert.
• Button „Zu StreamPulse hinzufügen“: Folge einem Streamer mit einem Klick direkt auf seiner Twitch-Kanalseite.
• Vorschau beim Überfahren: Sieh dir einen Livestream an, indem du mit der Maus über einen Kanallink auf Twitch fährst, ohne den aktuellen Tab zu verlassen.
• Anti-Pause und Player-Wiederherstellung: Der Stream läuft beim Tabwechsel weiter, und der Player startet nach Fehlern wie Twitch #2000 automatisch wieder.
• Chatfilter: Blende Nachrichten nach Stichwörtern oder von bestimmten Nutzern aus, auf Twitch und Kick.
• Zuschauzeit und Rückblick: Verfolge deine Zeit pro Kanal und erstelle ein teilbares Rückblick-Bild für die letzten 7 oder 30 Tage oder einen Monat, im PC- (16:9) oder Mobilformat (9:16).
• Community-Abzeichen: Erkenne das StreamPulse-Symbol neben anderen Nutzern der Erweiterung im Twitch-Chat. Jederzeit abschaltbar.
• Einheitliches Dashboard: Ein Pop-up für Twitch und Kick, das auf einen Blick zeigt, wer live ist.

Datenschutz:
StreamPulse braucht kein Konto und enthält weder Werbung noch Tracker. Deine Streamer, Einstellungen und Zuschauzeit bleiben auf deinem Gerät gespeichert. Nur das Community-Abzeichen sendet Daten an unseren Server: einen Hash deines Twitch-Namens (nie den Namen selbst), höchstens einmal pro Tag. Schalte das Abzeichen in den Einstellungen aus, um das zu beenden.
```




---




### 🇮🇹 Italien (IT)
**Short Description**:
`Punti canale e Drops di Twitch automatici, avvisi live, anteprime, filtri chat e riepilogo del tempo di visione. Twitch e Kick.`

**Detailed Description**:
```text
StreamPulse riunisce Twitch e Kick in un'unica estensione leggera. Tiene d'occhio i tuoi streamer preferiti, automatizza i clic ripetitivi e mantiene veloce il tuo browser.

🌍 Tradotta interamente in 15 lingue.

Funzionalità principali:
• Punti canale e Drops di Twitch: StreamPulse riscatta automaticamente i bonus dei punti canale e i Drops di Twitch mentre guardi, e conteggia i punti guadagnati su Kick.
• Avvisi live in tempo reale: Ricevi una notifica sul desktop appena uno streamer che segui va in diretta e, se vuoi, quando cambia il titolo della sua live.
• Pulsante "Aggiungi a StreamPulse": Segui uno streamer con un clic dalla sua pagina del canale Twitch.
• Anteprime al passaggio del mouse: Guarda l'anteprima di una live passando il mouse sul link di un canale su Twitch, senza lasciare la scheda attuale.
• Anti-pausa e ripristino del player: La live continua quando cambi scheda e il player si riavvia da solo dopo errori come il #2000 di Twitch.
• Filtro chat: Nascondi i messaggi per parola chiave o di determinati utenti, su Twitch e Kick.
• Tempo di visione e riepilogo: Tieni traccia del tempo passato su ogni canale e crea un'immagine di riepilogo da condividere per gli ultimi 7 o 30 giorni o per un mese, in formato PC (16:9) o mobile (9:16).
• Badge della comunità: Riconosci l'icona di StreamPulse accanto agli altri utenti dell'estensione nella chat di Twitch. Disattivabile in qualsiasi momento.
• Dashboard unificata: Un unico pop-up per Twitch e Kick che mostra a colpo d'occhio chi è in diretta.

Privacy:
StreamPulse non richiede alcun account e non contiene pubblicità né tracker. I tuoi streamer, le impostazioni e il tempo di visione restano salvati sul tuo dispositivo. Solo il badge della comunità invia un dato al nostro server: un hash del tuo nome utente Twitch (mai il nome stesso), al massimo una volta al giorno. Disattiva il badge nelle impostazioni per interromperlo.
```



---




### 🇵🇱 Polonais (PL)
**Short Description**:
`Automatyczne punkty kanału i dropy na Twitchu, alerty live, podglądy, filtry czatu i podsumowanie czasu oglądania. Twitch i Kick.`

**Detailed Description**:
```text
StreamPulse łączy Twitcha i Kicka w jednym lekkim rozszerzeniu. Śledzi ulubionych streamerów, automatyzuje powtarzalne kliknięcia i nie spowalnia przeglądarki.

🌍 W pełni przetłumaczone na 15 języków.

Główne funkcje:
• Punkty kanału i dropy na Twitchu: StreamPulse automatycznie odbiera bonusy punktów kanału i dropy na Twitchu podczas oglądania oraz liczy punkty zdobyte na Kicku.
• Powiadomienia o transmisjach na żywo: Otrzymuj powiadomienie na pulpicie, gdy obserwowany streamer rozpocznie transmisję, a jeśli chcesz, także gdy zmieni jej tytuł.
• Przycisk „Dodaj do StreamPulse”: Śledź streamera jednym kliknięciem na jego stronie kanału na Twitchu.
• Podgląd po najechaniu: Zobacz podgląd transmisji, najeżdżając kursorem na link kanału na Twitchu, bez opuszczania bieżącej karty.
• Antypauza i przywracanie odtwarzacza: Transmisja gra dalej po zmianie karty, a odtwarzacz sam się restartuje po błędach takich jak #2000 na Twitchu.
• Filtr czatu: Ukrywaj wiadomości według słów kluczowych lub od wybranych użytkowników, na Twitchu i Kicku.
• Czas oglądania i podsumowanie: Śledź czas spędzony na każdym kanale i twórz obraz podsumowania do udostępnienia za ostatnie 7 lub 30 dni albo za miesiąc, w formacie PC (16:9) lub telefonu (9:16).
• Odznaka społeczności: Rozpoznawaj ikonę StreamPulse przy innych użytkownikach rozszerzenia na czacie Twitcha. Można ją wyłączyć w każdej chwili.
• Wspólny panel: Jedno okienko dla Twitcha i Kicka, które od razu pokazuje, kto nadaje na żywo.

Prywatność:
StreamPulse nie wymaga konta i nie zawiera reklam ani trackerów. Twoi streamerzy, ustawienia i czas oglądania są przechowywane na Twoim urządzeniu. Tylko odznaka społeczności wysyła dane na nasz serwer: skrót (hash) Twojej nazwy użytkownika na Twitchu (nigdy samą nazwę), najwyżej raz dziennie. Wyłącz odznakę w ustawieniach, aby to zatrzymać.
```



---




### 🇹🇷 Turc (TR)
**Short Description**:
`Twitch kanal puanları ve Drops otomatik, canlı yayın bildirimleri, önizlemeler, sohbet filtreleri ve izleme özeti. Twitch ve Kick.`

**Detailed Description**:
```text
StreamPulse, Twitch ve Kick'i tek bir hafif eklentide birleştirir. Sevdiğin yayıncıları takip eder, tekrarlayan tıklamaları otomatikleştirir ve tarayıcını hızlı tutar.

🌍 15 dile tamamen çevrildi.

Başlıca özellikler:
• Twitch kanal puanları ve Drops: StreamPulse, sen izlerken Twitch kanal puanı bonuslarını ve Drops ödüllerini otomatik olarak alır, Kick'te kazandığın puanları da sayar.
• Anlık canlı yayın bildirimleri: Takip ettiğin bir yayıncı yayına başlar başlamaz masaüstü bildirimi al; istersen yayın başlığını değiştirdiğinde de haberdar ol.
• "StreamPulse'a ekle" düğmesi: Bir yayıncıyı Twitch kanal sayfasından tek tıkla takip et.
• Üzerine gelince önizleme: Twitch'te bir kanal bağlantısının üzerine gelerek canlı yayını önizle, bulunduğun sekmeden çıkmadan.
• Duraklatma önleme ve oynatıcı kurtarma: Sekme değiştirdiğinde yayın durmaz, oynatıcı Twitch #2000 gibi hatalardan sonra kendiliğinden yeniden başlar.
• Sohbet filtresi: Mesajları anahtar kelimeye göre ya da belirli kullanıcılardan gizle, Twitch ve Kick'te.
• İzleme süresi ve özet: Her kanalda geçirdiğin süreyi takip et, ardından son 7 veya 30 gün ya da bir ay için PC (16:9) veya mobil (9:16) formatında paylaşılabilir bir özet görseli oluştur.
• Topluluk rozeti: Twitch sohbetinde diğer StreamPulse kullanıcılarının yanındaki StreamPulse simgesini gör. İstediğin zaman kapatabilirsin.
• Birleşik panel: Twitch ve Kick için tek bir açılır pencere, kimin yayında olduğunu bir bakışta gösterir.

Gizlilik:
StreamPulse hesap gerektirmez, reklam veya izleyici içermez. Yayıncıların, ayarların ve izleme süren cihazında saklanır. Sunucumuza yalnızca topluluk rozeti veri gönderir: Twitch kullanıcı adının bir hash değeri (asla adın kendisi değil), günde en fazla bir kez. Bunu durdurmak için rozeti ayarlardan kapat.
```



---




### 🇷🇺 Russe (RU)
**Short Description**:
`Автосбор баллов канала и дропсов Twitch, оповещения о стримах, превью, фильтры чата и итоги времени просмотра. Twitch и Kick.`

**Detailed Description**:
```text
StreamPulse объединяет Twitch и Kick в одном лёгком расширении. Оно следит за любимыми стримерами, автоматизирует однообразные клики и не замедляет браузер.

🌍 Полностью переведено на 15 языков.

Основные возможности:
• Баллы канала и дропсы Twitch: StreamPulse автоматически забирает бонусы баллов канала и дропсы Twitch, пока вы смотрите, и считает баллы, заработанные на Kick.
• Оповещения о трансляциях: Получайте уведомление на рабочем столе, как только отслеживаемый стример выходит в эфир, а по желанию и когда он меняет название трансляции.
• Кнопка «Добавить в StreamPulse»: Отслеживайте стримера в один клик прямо со страницы его канала на Twitch.
• Превью при наведении: Смотрите превью трансляции, наведя курсор на ссылку канала на Twitch, не покидая текущую вкладку.
• Антипауза и восстановление плеера: Трансляция не останавливается при переключении вкладок, а плеер сам перезапускается после ошибок вроде #2000 на Twitch.
• Фильтр чата: Скрывайте сообщения по ключевым словам или от определённых пользователей на Twitch и Kick.
• Время просмотра и итоги: Следите за временем на каждом канале и создавайте изображение с итогами за последние 7 или 30 дней или за месяц в формате ПК (16:9) или телефона (9:16).
• Значок сообщества: Узнавайте значок StreamPulse рядом с другими пользователями расширения в чате Twitch. Его можно отключить в любой момент.
• Единая панель: Одно всплывающее окно для Twitch и Kick, где сразу видно, кто в эфире.

Конфиденциальность:
StreamPulse не требует аккаунта и не содержит рекламы и трекеров. Ваши стримеры, настройки и время просмотра хранятся на вашем устройстве. На наш сервер данные отправляет только значок сообщества: хеш вашего имени пользователя Twitch (никогда само имя), не чаще раза в день. Чтобы прекратить отправку, отключите значок в настройках.
```



---




### 🇯🇵 Japonais (JA)
**Short Description**:
`Twitchのチャンネルポイントとドロップを自動取得。配信通知、ホバープレビュー、チャットフィルター、視聴時間のまとめ。Twitch・Kick対応。`

**Detailed Description**:
```text
StreamPulseは、TwitchとKickをひとつの軽量な拡張機能にまとめます。お気に入りの配信者を見守り、繰り返しのクリックを自動化し、ブラウザを快適に保ちます。

🌍 15言語に完全対応。

主な機能：
• Twitchのチャンネルポイントとドロップ：視聴中にTwitchのチャンネルポイントのボーナスとドロップを自動で受け取り、Kickで獲得したポイントも集計します。
• リアルタイム配信通知：フォロー中の配信者が配信を始めるとすぐにデスクトップ通知が届きます。配信タイトルの変更も通知できます。
• 「StreamPulseに追加」ボタン：Twitchのチャンネルページからワンクリックで配信者を追加できます。
• ホバープレビュー：Twitchでチャンネルのリンクにカーソルを合わせるだけで、今のタブを離れずに配信をプレビューできます。
• 一時停止防止とプレーヤー復旧：タブを切り替えても配信は止まらず、Twitchの#2000などのエラー後もプレーヤーが自動で再起動します。
• チャットフィルター：TwitchとKickで、キーワードや特定ユーザーのメッセージを非表示にできます。
• 視聴時間とまとめ：チャンネルごとの視聴時間を記録し、過去7日間・30日間または月単位のまとめ画像をPC（16:9）かモバイル（9:16）形式で作成してシェアできます。
• コミュニティバッジ：Twitchチャットで、ほかのStreamPulseユーザーの横にStreamPulseのアイコンが表示されます。いつでもオフにできます。
• 統合ダッシュボード：TwitchとKickをひとつのポップアップにまとめ、誰が配信中かをひと目で確認できます。

プライバシー：
StreamPulseはアカウント不要で、広告もトラッカーも含みません。配信者リスト、設定、視聴時間はお使いの端末に保存されます。サーバーにデータを送るのはコミュニティバッジのみで、Twitchユーザー名をハッシュ化した値（ユーザー名そのものは送りません）を1日に最大1回送信します。停止するには設定でバッジをオフにしてください。
```



---




### 🇰🇷 Coréen (KO)
**Short Description**:
`트위치 채널 포인트와 드롭 자동 수령, 방송 알림, 미리보기, 채팅 필터, 시청 시간 결산. 트위치와 Kick 지원.`

**Detailed Description**:
```text
StreamPulse는 트위치와 Kick을 하나의 가벼운 확장 프로그램으로 묶어 줍니다. 좋아하는 스트리머를 지켜보고, 반복적인 클릭을 자동화하며, 브라우저를 빠르게 유지합니다.

🌍 15개 언어로 완전히 번역되었습니다.

주요 기능:
• 트위치 채널 포인트와 드롭: 시청하는 동안 트위치 채널 포인트 보너스와 드롭을 자동으로 받고, Kick에서 얻은 포인트도 집계합니다.
• 실시간 방송 알림: 팔로우한 스트리머가 방송을 시작하면 바로 데스크톱 알림을 받고, 원하면 방송 제목이 바뀔 때도 알림을 받을 수 있습니다.
• "StreamPulse에 추가" 버튼: 트위치 채널 페이지에서 한 번의 클릭으로 스트리머를 추가하세요.
• 마우스오버 미리보기: 트위치에서 채널 링크에 마우스를 올려 현재 탭을 벗어나지 않고 방송을 미리 볼 수 있습니다.
• 일시정지 방지와 플레이어 복구: 탭을 바꿔도 방송이 멈추지 않으며, 트위치 #2000 같은 오류 후에도 플레이어가 자동으로 다시 시작됩니다.
• 채팅 필터: 트위치와 Kick에서 키워드나 특정 사용자의 메시지를 숨길 수 있습니다.
• 시청 시간과 결산: 채널별 시청 시간을 기록하고, 최근 7일·30일 또는 한 달 단위의 결산 이미지를 PC(16:9)나 모바일(9:16) 형식으로 만들어 공유하세요.
• 커뮤니티 배지: 트위치 채팅에서 다른 StreamPulse 사용자 옆에 StreamPulse 아이콘이 표시됩니다. 언제든지 끌 수 있습니다.
• 통합 대시보드: 트위치와 Kick을 하나의 팝업에 모아 누가 방송 중인지 한눈에 보여 줍니다.

개인정보:
StreamPulse는 계정이 필요 없으며 광고나 추적기가 없습니다. 스트리머 목록, 설정, 시청 시간은 사용자의 기기에 저장됩니다. 서버로 데이터를 보내는 기능은 커뮤니티 배지뿐이며, 트위치 사용자 이름의 해시값(이름 자체는 보내지 않음)을 하루에 최대 한 번 전송합니다. 중단하려면 설정에서 배지를 끄세요.
```



---




### 🇮🇩 Indonésien (ID)
**Short Description**:
`Klaim otomatis poin channel dan Drops Twitch, notifikasi live, pratinjau, filter obrolan, dan rekap waktu menonton. Twitch & Kick.`

**Detailed Description**:
```text
StreamPulse menyatukan Twitch dan Kick dalam satu ekstensi yang ringan. Ekstensi ini memantau streamer favoritmu, mengotomatiskan klik berulang, dan menjaga browser tetap cepat.

🌍 Diterjemahkan sepenuhnya ke dalam 15 bahasa.

Fitur utama:
• Poin channel dan Drops Twitch: StreamPulse otomatis mengklaim bonus poin channel dan Drops Twitch saat kamu menonton, serta menghitung poin yang kamu dapatkan di Kick.
• Notifikasi live real-time: Dapatkan notifikasi desktop begitu streamer yang kamu ikuti mulai live, dan jika mau, saat mereka mengganti judul siaran.
• Tombol "Tambahkan ke StreamPulse": Ikuti streamer dengan satu klik dari halaman channel Twitch mereka.
• Pratinjau saat kursor diarahkan: Lihat pratinjau siaran live dengan mengarahkan kursor ke tautan channel di Twitch, tanpa meninggalkan tab saat ini.
• Anti-jeda dan pemulihan pemutar: Siaran tetap berjalan saat kamu berpindah tab, dan pemutar dimulai ulang sendiri setelah galat seperti #2000 di Twitch.
• Filter obrolan: Sembunyikan pesan berdasarkan kata kunci atau dari pengguna tertentu, di Twitch dan Kick.
• Waktu menonton dan rekap: Pantau waktu yang kamu habiskan di setiap channel, lalu buat gambar rekap untuk dibagikan dari 7 atau 30 hari terakhir atau satu bulan, dalam format PC (16:9) atau ponsel (9:16).
• Lencana komunitas: Kenali ikon StreamPulse di samping pengguna StreamPulse lain di obrolan Twitch. Bisa dimatikan kapan saja.
• Dasbor terpadu: Satu pop-up untuk Twitch dan Kick yang langsung menunjukkan siapa yang sedang live.

Privasi:
StreamPulse tidak memerlukan akun dan tidak berisi iklan atau pelacak. Daftar streamer, pengaturan, dan waktu menontonmu disimpan di perangkatmu. Hanya lencana komunitas yang mengirim data ke server kami: hash dari nama pengguna Twitch-mu (tidak pernah nama itu sendiri), paling banyak sekali sehari. Matikan lencana di pengaturan untuk menghentikannya.
```



---




### 🇳🇱 Néerlandais (NL)
**Short Description**:
`Kanaalpunten en Drops op Twitch automatisch, live-meldingen, previews, chatfilters en een overzicht van je kijktijd. Twitch & Kick.`

**Detailed Description**:
```text
StreamPulse brengt Twitch en Kick samen in één lichte extensie. Hij houdt je favoriete streamers in de gaten, automatiseert herhaalde klikken en houdt je browser snel.

🌍 Volledig vertaald in 15 talen.

Belangrijkste functies:
• Kanaalpunten en Drops op Twitch: StreamPulse haalt je bonussen voor kanaalpunten en je Twitch-Drops automatisch op terwijl je kijkt, en telt de punten die je op Kick verdient.
• Live-meldingen in realtime: Krijg een bureaubladmelding zodra een streamer die je volgt live gaat en, als je wilt, wanneer hij de titel van zijn stream wijzigt.
• Knop "Toevoegen aan StreamPulse": Volg een streamer met één klik vanaf zijn Twitch-kanaalpagina.
• Preview bij aanwijzen: Bekijk een preview van een livestream door met je muis over een kanaallink op Twitch te gaan, zonder je huidige tabblad te verlaten.
• Anti-pauze en spelerherstel: De stream blijft spelen als je van tabblad wisselt, en de speler herstart vanzelf na fouten zoals Twitch #2000.
• Chatfilter: Verberg berichten op trefwoord of van bepaalde gebruikers, op Twitch en Kick.
• Kijktijd en overzicht: Houd bij hoeveel tijd je op elk kanaal doorbrengt en maak een deelbare overzichtsafbeelding van de laatste 7 of 30 dagen of van een maand, in pc- (16:9) of mobiel formaat (9:16).
• Community-badge: Herken het StreamPulse-pictogram naast andere gebruikers van de extensie in de Twitch-chat. Op elk moment uit te schakelen.
• Eén dashboard: Eén pop-up voor Twitch en Kick die in één oogopslag laat zien wie er live is.

Privacy:
StreamPulse vraagt geen account en bevat geen advertenties of trackers. Je streamers, instellingen en kijktijd worden op je apparaat opgeslagen. Alleen de community-badge stuurt gegevens naar onze server: een hash van je Twitch-gebruikersnaam (nooit de naam zelf), maximaal één keer per dag. Schakel de badge uit in de instellingen om dit te stoppen.
```



---




### 🇸🇪 Suédois (SV)
**Short Description**:
`Kanalpoäng och Drops på Twitch automatiskt, livenotiser, förhandsvisningar, chattfilter och översikt av tittartid. Twitch & Kick.`

**Detailed Description**:
```text
StreamPulse samlar Twitch och Kick i ett lätt tillägg. Det håller koll på dina favoritstreamers, automatiserar upprepade klick och håller webbläsaren snabb.

🌍 Helt översatt till 15 språk.

Huvudfunktioner:
• Kanalpoäng och Drops på Twitch: StreamPulse hämtar automatiskt dina bonusar för kanalpoäng och dina Twitch-Drops medan du tittar, och räknar poängen du tjänar på Kick.
• Livenotiser i realtid: Få en skrivbordsnotis så fort en streamer du följer går live och, om du vill, när hen byter titel på sin stream.
• Knappen "Lägg till i StreamPulse": Följ en streamer med ett klick från hens kanalsida på Twitch.
• Förhandsvisning vid hovring: Förhandsgranska en livestream genom att hålla muspekaren över en kanallänk på Twitch, utan att lämna fliken.
• Antipaus och spelaråterställning: Streamen fortsätter när du byter flik, och spelaren startar om av sig själv efter fel som Twitch #2000.
• Chattfilter: Dölj meddelanden efter nyckelord eller från vissa användare, på Twitch och Kick.
• Tittartid och sammanfattning: Följ tiden du lägger på varje kanal och skapa en sammanfattningsbild att dela för de senaste 7 eller 30 dagarna eller en månad, i datorformat (16:9) eller mobilformat (9:16).
• Gemenskapsmärke: Känn igen StreamPulse-ikonen bredvid andra användare av tillägget i Twitch-chatten. Kan stängas av när som helst.
• Samlad panel: Ett popup-fönster för Twitch och Kick som direkt visar vem som är live.

Integritet:
StreamPulse kräver inget konto och innehåller varken annonser eller spårare. Dina streamers, inställningar och din tittartid sparas på din enhet. Endast gemenskapsmärket skickar data till vår server: en hash av ditt Twitch-användarnamn (aldrig själva namnet), högst en gång per dag. Stäng av märket i inställningarna för att stoppa det.
```



---




### 🇨🇿 Tchèque (CS)
**Short Description**:
`Automatické body kanálu a dropy na Twitchi, upozornění na vysílání, náhledy, filtry chatu a přehled doby sledování. Twitch a Kick.`

**Detailed Description**:
```text
StreamPulse spojuje Twitch a Kick v jednom lehkém rozšíření. Hlídá tvé oblíbené streamery, automatizuje opakované klikání a nezpomaluje prohlížeč.

🌍 Kompletně přeloženo do 15 jazyků.

Hlavní funkce:
• Body kanálu a dropy na Twitchi: StreamPulse během sledování automaticky vybírá bonusy bodů kanálu a dropy na Twitchi a počítá body získané na Kicku.
• Upozornění na živé vysílání: Dostaneš upozornění na ploše, jakmile sledovaný streamer začne vysílat, a pokud chceš, i když změní název streamu.
• Tlačítko „Přidat do StreamPulse“: Sleduj streamera jedním kliknutím přímo z jeho stránky kanálu na Twitchi.
• Náhled po najetí myší: Prohlédni si živé vysílání najetím myší na odkaz kanálu na Twitchi, aniž bys opustil aktuální kartu.
• Proti pozastavení a obnova přehrávače: Stream běží dál i po přepnutí karty a přehrávač se sám restartuje po chybách jako #2000 na Twitchi.
• Filtr chatu: Skryj zprávy podle klíčových slov nebo od vybraných uživatelů, na Twitchi i Kicku.
• Doba sledování a přehled: Sleduj čas strávený na každém kanálu a vytvoř obrázek s přehledem ke sdílení za posledních 7 nebo 30 dní nebo za měsíc, ve formátu PC (16:9) nebo mobil (9:16).
• Komunitní odznak: Poznej ikonu StreamPulse u ostatních uživatelů rozšíření v chatu Twitche. Lze ji kdykoli vypnout.
• Jednotný panel: Jedno vyskakovací okno pro Twitch a Kick, které hned ukáže, kdo vysílá.

Soukromí:
StreamPulse nevyžaduje účet a neobsahuje reklamy ani sledovací prvky. Tvoji streameři, nastavení a doba sledování zůstávají uložené v tvém zařízení. Data na náš server posílá jen komunitní odznak: hash tvého uživatelského jména na Twitchi (nikdy jméno samotné), nejvýše jednou denně. Pro zastavení odznak vypni v nastavení.
```
