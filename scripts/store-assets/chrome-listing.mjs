/**
 * Description détaillée de la fiche Chrome Web Store, source de vérité.
 *
 * FR et EN sont rédigés à la main. Les 13 autres langues sont traduites depuis
 * l'anglais par scripts/make-chrome-kit.mjs (DeepL) puis mises en cache dans
 * chrome-listing.i18n.json, à relire et corriger à la main si besoin : une
 * relance ne retraduit que les langues dont le texte anglais a changé.
 *
 * Règles de la fiche (politique Chrome Web Store) :
 *   - aucune fonction payante sans le dire : StreamPulse+ est nommé comme optionnel ;
 *   - aucune promesse fausse : pas de blocage de pubs, pas de qualité forcée ;
 *   - la confidentialité décrit exactement ce qui part vers streampulse.tech.
 */

export const LISTING = {
  en: `StreamPulse is a live notifier for Twitch, Kick and YouTube: get an alert the moment a streamer you follow goes live, auto-claim your Twitch Channel Points to earn points while you watch, never miss a Twitch Drop, and track every chat badge, with a direct link to each live, all from one lightweight extension.

🌍 Translated into 11 languages. No account.

Live notifications for Twitch, Kick and YouTube
• One dashboard for Twitch, Kick and YouTube: live channels first, with viewers, category and uptime.
• Desktop alerts when a streamer you follow goes live, and optionally when they change category or title.
• Notification sounds: six sounds you can preview, plus quiet hours.
• Alert pause: silence notifications for 1 hour or until tomorrow morning, and a “Why no alert?” check that shows what is blocking one.
• Add a channel in a few letters: matching Twitch and Kick channels show up as you type, live ones first.
• Bulk add: paste up to 50 usernames or channel links, check the list, and add them all at once.
• Linked accounts: link a streamer's Twitch, Kick and YouTube accounts to get one tile and one notification when both are live.
• History tab: the lives you missed, with their length and a direct link to the Twitch replay.
• Hover previews: preview a live stream by hovering a channel link on Twitch.
• Watch later tab: keep Twitch, Kick and YouTube links with a personal note.

Twitch Drops, badges and Channel Points
• Drops panel: your Twitch Drops in progress with their progress and time left, the ones ready to claim, and Twitch campaigns filtered by new, ending soon and upcoming, your games first.
• Drops planner: pick Drops, say how much time you have and see what can finish before the deadline. It's an estimate: Twitch decides what counts.
• Badges tab: chat badge campaigns and new Twitch global badges as soon as they appear, free or paid, with the ones you already own. A notification tells you about new free badges. Without StreamPulse+, the auto mode still claims one free badge a day.
• Channel Points panel: every channel point you earn on Twitch, channel by channel.
• Auto-claim for the Channel Points bonus chest on Twitch and the daily reward on Kick, and points earned on Kick counted too.
• Incoming raid alerts (beta, off by default): get notified when a channel you follow is raided, even with no tab open. Automatic raid cancel is available in settings.

Right inside Twitch
• Your StreamPulse favorites in the Twitch sidebar, above your followed channels, with live status.
• A settings panel right on Twitch, opened from the top bar without leaving the stream.
• An "Add to StreamPulse" button on every Twitch channel page.

A smoother player
• Anti-pause: the stream keeps playing when you switch tabs.
• Player recovery after errors such as Twitch #2000: StreamPulse presses Try again for you and reloads the tab if the player still won't start, never on a background tab. Can be switched off in settings.
• Picture-in-Picture button, fast-forward button to jump back to the live edge, and a volume boost up to 200%.
• Optional: keep the video quality when the tab is in the background, and hide Twitch extension overlays on top of the video.
• Chat filters by keyword or user, on Twitch and Kick.

Your tabs, your way
• The streamer's avatar as the tab icon, and a red LIVE dot while they are on air.
• Keep Twitch, Kick and YouTube tabs from being put to sleep by Chrome.
• Layout: reorder the top bar tabs and the settings sections, and hide the ones you don't use.
• Search your settings and filter them by platform.
• Alt+Shift+S opens the pop-up, editable in chrome://extensions/shortcuts.
• Extension language: 11 languages, chosen independently from your browser language.

Your watch time
• Time watched per channel and a shareable recap image for the last 7 or 30 days or any month, in 16:9 or 9:16.
• Time spent watching YouTube lives is counted too.
• Backup and restore: move your streamers, favorites, channel groups, settings, history, points, Drops and watch time to another browser.
• CSV export of your points and Drops history.
• Optional sync of your streamers and settings across your devices through your browser profile, no account.

StreamPulse+ (optional, paid)
Everything above is free and stays free. StreamPulse+ is a monthly (7 days free) or yearly plan that supports the project and adds:
• Automatic Drops: claimed as soon as they're ready, even with no Twitch tab open — StreamPulse checks them every 10 minutes, so it works while you watch on your phone or TV.
• Smart alerts: only for a game, a word in the title or a viewer threshold.
• Drops campaign alerts: a notification when a campaign starts on a game you follow.
• A different notification sound for lives, category changes, title changes and raids.
• Advanced recap with a yearly Wrapped.
• Assisted predictions with a movable widget on the video.
• Where your points come from (watching, bonuses, raids, streaks…) with a sheet per streamer, and the history of every Drop you earned.
• The full list of badges you can earn right now, with a live to open in one click and an auto mode that watches in a pinned, muted tab and closes it once the badge is yours.
• 25 username and badge effects in Twitch chat, seen by every StreamPulse user.
• Clip downloads as MP4 from any Twitch clip page.
• Referrals: your friends get their first month free, and you unlock free months and exclusive effects.

Source code
The full code is public on GitHub so you can read it and check how it works. It is all rights reserved: it may not be copied, modified or reused: github.com/AlexisAMZ/streampulse-extension

Privacy
StreamPulse needs no account and has no trackers or analytics. Your streamers, settings, points, Drops and watch time stay on your device. Your Drops and badges are read from Twitch with your own Twitch session, directly between your browser and Twitch. Only three things reach our server, streampulse.tech: the optional community badge, off by default, sends a hashed version of your Twitch username (never the username itself) at most once a day, with the effects you picked if you have StreamPulse+; a StreamPulse+ license key is checked there when you activate it; and your referral code is created there when you ask for it. If you uninstall StreamPulse, an optional anonymous survey page opens on streampulse.tech with only the extension version and language. Streamer names, and what you type to add a channel, are sent only to Twitch, Kick and YouTube to find channels and check who is live.`,

  fr: `StreamPulse est un notificateur de live pour Twitch, Kick et YouTube : recevez une alerte dès qu'un streamer suivi lance son live, récupérez automatiquement vos points de chaîne Twitch pour gagner des points en regardant, ne ratez plus aucun Drop Twitch et suivez chaque badge de chat, avec un lien direct vers chaque live, dans une seule extension légère.

🌍 Traduite en 11 langues. Sans compte.

Notifications de live pour Twitch, Kick et YouTube
• Un tableau de bord unique pour Twitch, Kick et YouTube : les chaînes en direct d'abord, avec spectateurs, catégorie et durée.
• Des alertes sur le bureau quand un streamer suivi lance son live, et au choix quand il change de catégorie ou de titre.
• Sons de notification : six sons à écouter avant de choisir, et des heures calmes.
• Pause des alertes : couper les notifications une heure ou jusqu'à demain matin, et un diagnostic « Pourquoi aucune alerte ? » qui montre ce qui en bloque une.
• Ajoutez une chaîne en quelques lettres : les chaînes Twitch et Kick correspondantes s'affichent pendant la saisie, celles en direct d'abord.
• Ajout en lot : coller jusqu'à 50 pseudos ou liens de chaînes, vérifier la liste, puis tout ajouter d'un coup.
• Comptes liés : relier les comptes Twitch, Kick et YouTube d'un même streamer pour n'avoir qu'une tuile et qu'une notification quand les deux sont en direct.
• Onglet Historique : les lives manqués, avec leur durée et un lien direct vers la rediffusion Twitch.
• Aperçus au survol : prévisualisez un live en survolant le lien d'une chaîne sur Twitch.
• Onglet À regarder plus tard : garder des liens Twitch, Kick et YouTube avec une note personnelle.

Drops Twitch, badges et points de chaîne
• Panneau Drops : vos Drops Twitch en cours avec leur progression et le temps restant, ceux prêts à récupérer, et les campagnes de Twitch filtrées par nouvelles, finissent bientôt et à venir, celles de vos jeux en premier.
• Planificateur de Drops : choisir des Drops, indiquer le temps disponible et voir ce qui peut se terminer avant la date limite. C'est une estimation : c'est Twitch qui décide de ce qui compte.
• Onglet Badges : les campagnes de badges de chat et les nouveaux badges globaux de Twitch dès leur apparition, gratuits ou payants, avec ceux que vous avez déjà. Une notification vous prévient d'un nouveau badge gratuit. Sans StreamPulse+, le mode auto décroche quand même un badge gratuit par jour.
• Panneau Points de chaîne : chaque point de chaîne gagné sur Twitch, chaîne par chaîne.
• Récupération automatique du coffre bonus de points de chaîne sur Twitch et de la récompense quotidienne sur Kick, et points gagnés sur Kick comptabilisés aussi.
• Alertes de raids entrants (bêta, désactivées par défaut) : soyez prévenu quand une chaîne suivie reçoit un raid, même sans onglet ouvert. L'annulation automatique des raids reste disponible dans les réglages.

Directement dans Twitch
• Vos favoris StreamPulse dans la barre latérale de Twitch, au-dessus des chaînes suivies, avec leur statut en direct.
• Un panneau de réglages directement sur Twitch, ouvert depuis la barre du haut sans quitter le stream.
• Un bouton « Ajouter à StreamPulse » sur chaque page de chaîne Twitch.

Un lecteur plus fluide
• Anti-pause : le stream continue quand vous changez d'onglet.
• Récupération du lecteur après une erreur comme la #2000 de Twitch : StreamPulse appuie sur Réessayer à votre place et recharge l'onglet si le lecteur ne repart pas, jamais sur un onglet en arrière-plan. Désactivable dans les réglages.
• Bouton Picture-in-Picture, bouton d'avance rapide pour rattraper le direct, et amplification du volume jusqu'à 200 %.
• Au choix : garder la qualité vidéo quand l'onglet est en arrière-plan, et masquer les incrustations d'extensions Twitch par-dessus la vidéo.
• Filtres de chat par mot-clé ou par utilisateur, sur Twitch et Kick.

Vos onglets, à votre façon
• L'avatar du streamer comme icône de l'onglet, et un point rouge LIVE quand il est en direct.
• Empêcher Chrome de mettre en veille vos onglets Twitch, Kick et YouTube.
• Disposition : changez l'ordre des onglets du haut et des rubriques des réglages, et masquez ceux dont vous ne vous servez pas.
• Recherche dans les réglages, avec un filtre par plateforme.
• Alt+Shift+S ouvre la popup, modifiable dans chrome://extensions/shortcuts.
• Langue de l'extension : 11 langues, choisie indépendamment de celle du navigateur.

Votre temps de visionnage
• Le temps passé sur chaque chaîne et une image récap à partager sur les 7 ou 30 derniers jours ou sur un mois, en 16:9 ou 9:16.
• Le temps regardé sur les lives YouTube est aussi comptabilisé.
• Sauvegarde et restauration : retrouvez vos streamers, favoris, groupes de chaînes, réglages, historique, points, Drops et temps de visionnage dans un autre navigateur.
• Export de l'historique des points et des Drops en CSV.
• Synchronisation facultative des streamers et des réglages entre appareils via le profil du navigateur, sans compte.

StreamPulse+ (optionnel, payant)
Tout ce qui précède est gratuit et le reste. StreamPulse+ est une formule mensuelle (7 jours gratuits) ou annuelle qui soutient le projet et ajoute :
• Des Drops récupérés automatiquement dès qu'ils sont prêts, même sans onglet Twitch ouvert : StreamPulse les vérifie toutes les 10 minutes, ça marche aussi quand vous regardez sur votre téléphone ou votre télé.
• Des alertes intelligentes : seulement pour un jeu, un mot dans le titre ou un seuil de spectateurs.
• Alertes de campagnes de Drops : une notification quand une campagne démarre sur un jeu suivi.
• Un son de notification différent pour les lives, les changements de catégorie, de titre et les raids.
• Un récap avancé avec un bilan annuel (Wrapped).
• Des prédictions assistées avec un widget déplaçable sur la vidéo.
• D'où viennent vos points (regarder, bonus, raids, séries…) avec une fiche par streamer, et l'historique de tous vos Drops obtenus.
• La liste complète des badges obtenables en ce moment, avec un live à ouvrir en un clic et un mode auto qui regarde dans un onglet épinglé et muet, puis le ferme dès que le badge est à vous.
• 25 effets de pseudo et de badge dans le tchat Twitch, vus par tous les utilisateurs de StreamPulse.
• Le téléchargement des clips en MP4 depuis n'importe quelle page de clip Twitch.
• Le parrainage : vos amis ont leur premier mois offert, et vous gagnez des mois gratuits et des effets exclusifs.

Code source
Tout le code est public sur GitHub pour que tu puisses le lire et vérifier son fonctionnement. Il est sous tous droits réservés : interdit de le copier, de le modifier ou de le réutiliser : github.com/AlexisAMZ/streampulse-extension

Confidentialité
StreamPulse ne demande aucun compte et ne contient aucun traceur ni outil de mesure d'audience. Vos streamers, réglages, points, Drops et temps de visionnage restent sur votre appareil. Vos Drops et vos badges sont lus sur Twitch avec votre propre session Twitch, directement entre votre navigateur et Twitch. Seules trois choses arrivent sur notre serveur, streampulse.tech : le badge communautaire, optionnel et désactivé par défaut, envoie une empreinte (hash) de votre pseudo Twitch, jamais le pseudo lui-même, au plus une fois par jour, avec les effets choisis si vous avez StreamPulse+ ; une clé de licence StreamPulse+ y est vérifiée quand vous l'activez ; et votre code de parrainage y est créé quand vous le demandez. Si vous désinstallez StreamPulse, une page de sondage anonyme et facultative s'ouvre sur streampulse.tech, avec seulement la version et la langue de l'extension. Les noms des streamers, et ce que vous tapez pour ajouter une chaîne, sont envoyés uniquement à Twitch, Kick et YouTube pour trouver les chaînes et savoir qui est en direct.`,
};
