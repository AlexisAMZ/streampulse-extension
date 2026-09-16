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
 *   - la confidentialité décrit exactement ce qui part vers streampulse.fr.
 */

export const LISTING = {
  en: `StreamPulse brings Twitch and Kick together in one lightweight extension. See who's live at a glance, get an alert the moment a stream starts, and let the extension claim your channel points and Drops while you watch.

🌍 Fully translated into 15 languages. No account, no ads.

Know who's live
• One dashboard for Twitch and Kick: live channels first, with viewers, category and uptime.
• Desktop alerts when a streamer you follow goes live, and optionally when they change category or title.
• History tab: the lives you missed, with their length and a direct link to the Twitch replay.
• Hover previews: preview a live stream by hovering a channel link on Twitch.

Right inside Twitch
• Your StreamPulse favorites in the Twitch sidebar, above your followed channels, with live status.
• A settings panel right on Twitch, opened from the top bar without leaving the stream.
• An "Add to StreamPulse" button on every Twitch channel page.

Rewards on autopilot
• Channel points bonuses claimed automatically while you watch.
• Twitch Drops claimed as soon as they're ready, and points earned on Kick counted too.
• Raids stay on by default so you collect the channel points that come with them.
• Incoming raid alerts (beta, off by default): get notified when a channel you follow is raided, even with no tab open, so you don't miss the raid points. Automatic raid cancel is available in settings.

A smoother player
• Anti-pause: the stream keeps playing when you switch tabs.
• Player recovery after errors such as Twitch #2000: StreamPulse presses Try again for you, resumes playback and snaps back to the live edge.
• Picture-in-Picture button: watch the stream in a floating mini window while you do something else.
• Fast-forward button: jump back to the live edge when your stream falls behind.
• Optional: keep the video quality when the tab is in the background, instead of letting Twitch lower it.
• Optional: hide Twitch extension overlays on top of the video.
• Chat filters by keyword or user, on Twitch and Kick.

Your tabs, your way
• The streamer's avatar as the tab icon, and a red LIVE dot while they are on air.
• Keep Twitch and Kick tabs from being put to sleep by Chrome.
• Extension language: 15 languages, chosen independently from your browser language.
• A changelog screen that tells you what changed after each update.

Your watch time
• Time watched per channel and a shareable recap image for the last 7 or 30 days or any month, in 16:9 or 9:16.
• Backup and restore: move your streamers, favorites, channel groups, settings, history and watch time to another browser.

StreamPulse+ (optional, paid)
Everything above is free and stays free. StreamPulse+ is a monthly or lifetime plan that supports the project and adds: smart alerts (only for a game, a word in the title or a viewer threshold), an advanced recap with a yearly Wrapped, assisted predictions with a movable widget on the video, clip downloads as MP4 from any Twitch clip page, and custom popup themes with animated badge and name effects in Twitch chat.

Open source
The full code is public on GitHub under the GPL v3 license: github.com/AlexisAMZ/streampulse-extension

Privacy
StreamPulse needs no account and has no ads, trackers or analytics. Your streamers, settings, points and watch time stay on your device. Only two things reach our server, streampulse.fr: the optional community badge, off by default and turned on only if you choose to, sends a hashed version of your Twitch username (never the username itself) at most once a day; and a StreamPulse+ license key is checked there when you activate it. Streamer names are sent to the official Twitch and Kick APIs only to check who is live.`,

  fr: `StreamPulse réunit Twitch et Kick dans une seule extension légère. Voyez qui est en direct d'un coup d'œil, recevez une alerte dès qu'un live démarre, et laissez l'extension récupérer vos points de chaîne et vos Drops pendant que vous regardez.

🌍 Entièrement traduite en 15 langues. Sans compte, sans publicité.

Savoir qui est en live
• Un tableau de bord unique pour Twitch et Kick : les chaînes en direct d'abord, avec spectateurs, catégorie et durée.
• Des alertes sur le bureau quand un streamer suivi lance son live, et au choix quand il change de catégorie ou de titre.
• Onglet Historique : les lives manqués, avec leur durée et un lien direct vers la rediffusion Twitch.
• Aperçus au survol : prévisualisez un live en survolant le lien d'une chaîne sur Twitch.

Directement dans Twitch
• Vos favoris StreamPulse dans la barre latérale de Twitch, au-dessus des chaînes suivies, avec leur statut en direct.
• Un panneau de réglages directement sur Twitch, ouvert depuis la barre du haut sans quitter le stream.
• Un bouton « Ajouter à StreamPulse » sur chaque page de chaîne Twitch.

Récompenses en pilote automatique
• Les bonus de points de chaîne récupérés automatiquement pendant que vous regardez.
• Les Drops Twitch récupérés dès qu'ils sont prêts, et les points gagnés sur Kick comptabilisés aussi.
• Les raids restent actifs par défaut pour récupérer les points de chaîne qui vont avec.
• Alertes de raids entrants (bêta, désactivées par défaut) : soyez prévenu quand une chaîne suivie reçoit un raid, même sans onglet ouvert, pour ne pas manquer les points. L'annulation automatique des raids reste disponible dans les réglages.

Un lecteur plus fluide
• Anti-pause : le stream continue quand vous changez d'onglet.
• Récupération du lecteur après une erreur comme la #2000 de Twitch : StreamPulse appuie sur Réessayer à votre place, relance la lecture et recale sur le direct.
• Bouton Picture-in-Picture : regardez le live dans une mini-fenêtre flottante pendant que vous faites autre chose.
• Bouton d'avance rapide : rattrapez le direct quand votre flux a pris du retard.
• Au choix : garder la qualité vidéo quand l'onglet est en arrière-plan, au lieu de laisser Twitch la baisser.
• Au choix : masquer les incrustations d'extensions Twitch par-dessus la vidéo.
• Filtres de chat par mot-clé ou par utilisateur, sur Twitch et Kick.

Vos onglets, à votre façon
• L'avatar du streamer comme icône de l'onglet, et un point rouge LIVE quand il est en direct.
• Empêcher Chrome de mettre en veille vos onglets Twitch et Kick.
• Langue de l'extension : 15 langues, choisie indépendamment de celle du navigateur.
• Un écran de nouveautés qui vous dit ce qui a changé après chaque mise à jour.

Votre temps de visionnage
• Le temps passé sur chaque chaîne et une image récap à partager sur les 7 ou 30 derniers jours ou sur un mois, en 16:9 ou 9:16.
• Sauvegarde et restauration : retrouvez vos streamers, favoris, groupes de chaînes, réglages, historique et temps de visionnage dans un autre navigateur.

StreamPulse+ (optionnel, payant)
Tout ce qui précède est gratuit et le reste. StreamPulse+ est une formule mensuelle ou à vie qui soutient le projet et ajoute : des alertes intelligentes (seulement pour un jeu, un mot dans le titre ou un seuil de spectateurs), un récap avancé avec un bilan annuel, des prédictions assistées avec un widget déplaçable sur la vidéo, le téléchargement des clips en MP4 depuis n'importe quelle page de clip Twitch, et des thèmes pour le pop-up avec des effets animés de badge et de pseudo dans le tchat Twitch.

Open source
Tout le code est public sur GitHub sous licence GPL v3 : github.com/AlexisAMZ/streampulse-extension

Confidentialité
StreamPulse ne demande aucun compte et ne contient ni publicité, ni traceur, ni outil de mesure d'audience. Vos streamers, réglages, points et temps de visionnage restent sur votre appareil. Seules deux choses arrivent sur notre serveur, streampulse.fr : le badge communautaire, optionnel et désactivé par défaut, envoie une empreinte (hash) de votre pseudo Twitch, jamais le pseudo lui-même, au plus une fois par jour, seulement si vous l'activez ; et une clé de licence StreamPulse+ y est vérifiée quand vous l'activez. Les noms des streamers sont envoyés aux API officielles de Twitch et Kick uniquement pour savoir qui est en direct.`,
};
