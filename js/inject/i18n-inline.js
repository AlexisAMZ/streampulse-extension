/**
 * FICHIER GÉNÉRÉ : NE PAS ÉDITER À LA MAIN.
 * Source : i18n/translations.js (clés "inject.*")
 * Régénérer : node scripts/build-inline-i18n.mjs
 *
 * Expose window.__SP_I18N__ pour les content scripts, qui sont injectés comme
 * scripts classiques et ne peuvent pas importer de module ES.
 */
(function () {
  "use strict";
  if (typeof window === "undefined") return;
  // Déclaré dans plusieurs entrées content_scripts (l'ordre entre entrées n'est
  // pas garanti par Chrome, chacune doit donc pouvoir le charger). On sort tôt
  // si une autre entrée l'a déjà installé.
  if (window.__SP_I18N__) return;

  var STRINGS = {
  "fr": {
    "enhancer": {
      "jumpToLive": "Aller au direct (StreamPulse)"
    },
    "twitchUi": {
      "favorites": "Favoris StreamPulse",
      "pin": "Ajouter aux favoris StreamPulse",
      "unpin": "Retirer des favoris StreamPulse",
      "offline": "Hors ligne",
      "emptyFavorites": "Survole une chaîne suivie et clique sur l'étoile.",
      "drawerTitle": "Réglages",
      "tabGeneral": "Général",
      "tabPreviews": "Aperçus",
      "tabAlerts": "Alertes",
      "close": "Fermer",
      "fullPage": "Page complète",
      "plusOnly": "Réservé à StreamPulse+",
      "discoverPlus": "Découvrir StreamPulse+",
      "chatRow": "Effets StreamPulse+",
      "chatRowNote": "Vu par les autres utilisateurs de StreamPulse."
    },
    "badge": {
      "lifetime": "Membre à vie",
      "months": "Abonné depuis {{count}} mois",
      "monthOne": "Abonné depuis 1 mois",
      "newMember": "Nouvel abonné",
      "freeLine": "Utilisateur de l'extension"
    },
    "topbar": {
      "previews": "Previews au survol",
      "thisChannel": "Cette chaîne",
      "badgeColor": "Couleur du badge",
      "badgeAuthor": "Pseudo",
      "badgeTheme": "Thème",
      "badgeCustom": "Perso",
      "liveNow": "En direct",
      "noneLive": "Personne en direct",
      "watchedHere": "Regardé ici",
      "follow": "Suivre",
      "followed": "Suivi",
      "autoClaim": "Points automatiques",
      "fastForward": "Avance rapide",
      "more": "+{{count}} autres",
      "tip": "Offrir un Bubble Tea",
      "settings": "Tous les réglages"
    },
    "quickFollow": {
      "add": "Ajouter à StreamPulse",
      "tracked": "Suivi",
      "remove": "Retirer de StreamPulse",
      "added": "{{name}} ajouté à StreamPulse",
      "removed": "{{name}} retiré de StreamPulse",
      "error": "Action impossible. Réessayez."
    },
    "player": {
      "skipToLive": "Rattraper le direct",
      "holdToFastForward": "Maintenir pour avance x2",
      "volumeBoostLabel": "Amplifier le volume",
      "volumeBoostHint": "Clic : marche arrêt · molette ou flèches : régler, jusqu'à 200 %",
      "pictureInPicture": "Picture-in-Picture",
      "clipDownload": "Télécharger le clip (MP4)",
      "clipDownloading": "Téléchargement du clip…",
      "clipDownloadFailed": "Échec du téléchargement, réessayez",
      "latencyEmpty": "Latence : --",
      "latencyValue": "Latence : {{value}}s",
      "offline": "HORS LIGNE"
    },
    "chatFilter": {
      "replacement": "Message supprimé par StreamPulse"
    },
    "shared": {
      "settings": {
        "groupAutomation": "Automatisation",
        "groupPreviews": "Previews au survol",
        "groupNotifications": "Notifications",
        "groupChat": "Chat",
        "autoClaimTitle": "Récupération auto des points",
        "autoClaimDropsTitle": "Auto-claim Drops Twitch",
        "autoClaimMomentsTitle": "Auto-claim Moments Twitch",
        "autoCancelRaidsTitle": "Annulation automatique des Raids",
        "autoRefreshTitle": "Relancer le lecteur en cas d'erreur",
        "keepQualityTitle": "Garder la qualité en arrière-plan",
        "fastForwardTitle": "Bouton d'avance rapide",
        "pipButtonTitle": "Bouton Picture-in-Picture",
        "hideTwitchExtensionsTitle": "Masquer les extensions Twitch",
        "communityBadgeTitle": "Badge communautaire",
        "previewsEnableTitle": "Previews au survol",
        "previewsModeTitle": "Mode d'aperçu",
        "previewsModeImage": "Image",
        "previewsModeVideo": "Vidéo",
        "previewsSurfaceDirectory": "Répertoire",
        "previewsSurfaceSidebar": "Sidebar",
        "previewsAudioTitle": "Audio (mode vidéo)",
        "liveNotificationsTitle": "Notifications Chrome",
        "gameAlertsTitle": "Alertes changement de catégorie",
        "titleAlertsTitle": "Alertes changement de titre",
        "soundsTitle": "Son des notifications"
      },
      "cosmetics": {
        "badgeTitle": "Effet du badge",
        "badgeBody": "Anime le logo StreamPulse à côté de ton pseudo.",
        "nameTitle": "Pseudo spécial",
        "nameBody": "Un dégradé ou un effet sur ton pseudo, vu par les utilisateurs de StreamPulse.",
        "none": "Aucun",
        "pulse": "Pulsation",
        "shine": "Reflet",
        "rainbow": "Arc-en-ciel",
        "glow": "Halo",
        "bounce": "Rebond",
        "spin": "Rotation",
        "flicker": "Néon clignotant",
        "aurora": "Aurore",
        "sunset": "Coucher de soleil",
        "lcd": "Écran LCD",
        "gold": "Or",
        "neon": "Néon",
        "preview": "Aperçu dans le tchat",
        "sampleName": "TonPseudo"
      }
    }
  },
  "en": {
    "enhancer": {
      "jumpToLive": "Jump to Live (StreamPulse)"
    },
    "twitchUi": {
      "favorites": "StreamPulse favorites",
      "pin": "Add to StreamPulse favorites",
      "unpin": "Remove from StreamPulse favorites",
      "offline": "Offline",
      "emptyFavorites": "Hover a followed channel and click the star.",
      "drawerTitle": "Settings",
      "tabGeneral": "General",
      "tabPreviews": "Previews",
      "tabAlerts": "Alerts",
      "close": "Close",
      "fullPage": "Full page",
      "plusOnly": "StreamPulse+ only",
      "discoverPlus": "Discover StreamPulse+",
      "chatRow": "StreamPulse+ effects",
      "chatRowNote": "Seen by other StreamPulse users."
    },
    "badge": {
      "lifetime": "Lifetime member",
      "months": "Subscribed for {{count}} months",
      "monthOne": "Subscribed for 1 month",
      "newMember": "New subscriber",
      "freeLine": "Extension user"
    },
    "topbar": {
      "previews": "Hover previews",
      "thisChannel": "This channel",
      "badgeColor": "Badge colour",
      "badgeAuthor": "Username",
      "badgeTheme": "Theme",
      "badgeCustom": "Custom",
      "liveNow": "Live now",
      "noneLive": "Nobody live right now",
      "watchedHere": "Watched here",
      "follow": "Follow",
      "followed": "Followed",
      "autoClaim": "Auto channel points",
      "fastForward": "Fast forward",
      "more": "+{{count}} more",
      "tip": "Offer a Bubble Tea",
      "settings": "All settings"
    },
    "quickFollow": {
      "add": "Add to StreamPulse",
      "tracked": "Tracked",
      "remove": "Remove from StreamPulse",
      "added": "{{name}} added to StreamPulse",
      "removed": "{{name}} removed from StreamPulse",
      "error": "Action failed. Try again."
    },
    "player": {
      "skipToLive": "Skip to live",
      "holdToFastForward": "Hold to fast-forward x2",
      "volumeBoostLabel": "Boost the volume",
      "volumeBoostHint": "Click: on/off · scroll or arrows: adjust, up to 200%",
      "pictureInPicture": "Picture-in-Picture",
      "clipDownload": "Download clip (MP4)",
      "clipDownloading": "Downloading clip…",
      "clipDownloadFailed": "Download failed, try again",
      "latencyEmpty": "Latency: --",
      "latencyValue": "Latency: {{value}}s",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Message removed by StreamPulse"
    },
    "shared": {
      "settings": {
        "groupAutomation": "Automation",
        "groupPreviews": "Hover previews",
        "groupNotifications": "Notifications",
        "groupChat": "Chat",
        "autoClaimTitle": "Auto-claim channel points",
        "autoClaimDropsTitle": "Auto-claim Twitch Drops",
        "autoClaimMomentsTitle": "Auto-claim Twitch Moments",
        "autoCancelRaidsTitle": "Auto-cancel Raids",
        "autoRefreshTitle": "Recover the player on errors",
        "keepQualityTitle": "Keep quality in background",
        "fastForwardTitle": "Fast-forward button",
        "pipButtonTitle": "Picture-in-Picture button",
        "hideTwitchExtensionsTitle": "Hide Twitch extensions",
        "communityBadgeTitle": "Community badge",
        "previewsEnableTitle": "Hover previews",
        "previewsModeTitle": "Preview mode",
        "previewsModeImage": "Image",
        "previewsModeVideo": "Video",
        "previewsSurfaceDirectory": "Directory",
        "previewsSurfaceSidebar": "Sidebar",
        "previewsAudioTitle": "Audio (video mode)",
        "liveNotificationsTitle": "Chrome notifications",
        "gameAlertsTitle": "Category change alerts",
        "titleAlertsTitle": "Title change alerts",
        "soundsTitle": "Notification sound"
      },
      "cosmetics": {
        "badgeTitle": "Badge effect",
        "badgeBody": "Animates the StreamPulse logo next to your name.",
        "nameTitle": "Special name",
        "nameBody": "A gradient or effect on your name, seen by StreamPulse users.",
        "none": "None",
        "pulse": "Pulse",
        "shine": "Shine",
        "rainbow": "Rainbow",
        "glow": "Glow",
        "bounce": "Bounce",
        "spin": "Spin",
        "flicker": "Flickering neon",
        "aurora": "Aurora",
        "sunset": "Sunset",
        "lcd": "LCD screen",
        "gold": "Gold",
        "neon": "Neon",
        "preview": "Chat preview",
        "sampleName": "YourName"
      }
    }
  },
  "es": {
    "enhancer": {
      "jumpToLive": "Ir al directo (StreamPulse)"
    },
    "twitchUi": {
      "favorites": "Favoritos de StreamPulse",
      "pin": "Añadir a favoritos de StreamPulse",
      "unpin": "Quitar de favoritos de StreamPulse",
      "offline": "Desconectado",
      "emptyFavorites": "Pasa el ratón por un canal seguido y pulsa la estrella.",
      "drawerTitle": "Ajustes",
      "tabGeneral": "General",
      "tabPreviews": "Vistas previas",
      "tabAlerts": "Alertas",
      "close": "Cerrar",
      "fullPage": "Página completa",
      "plusOnly": "Solo StreamPulse+",
      "discoverPlus": "Descubrir StreamPulse+",
      "chatRow": "Efectos StreamPulse+",
      "chatRowNote": "Visto por otros usuarios de StreamPulse."
    },
    "badge": {
      "lifetime": "Miembro de por vida",
      "months": "Suscrito desde hace {{count}} meses",
      "monthOne": "Suscrito desde hace 1 mes",
      "newMember": "Nuevo suscriptor",
      "freeLine": "Usuario de la extensión"
    },
    "topbar": {
      "previews": "Vistas previas",
      "thisChannel": "Este canal",
      "badgeColor": "Color de la insignia",
      "badgeAuthor": "Nombre",
      "badgeTheme": "Tema",
      "badgeCustom": "Personal.",
      "liveNow": "En directo",
      "noneLive": "Nadie en directo",
      "watchedHere": "Visto aquí",
      "follow": "Seguir",
      "followed": "Seguido",
      "autoClaim": "Puntos automáticos",
      "fastForward": "Avance rápido",
      "more": "+{{count}} más",
      "tip": "Invitar a un Bubble Tea",
      "settings": "Ajustes"
    },
    "quickFollow": {
      "add": "Añadir a StreamPulse",
      "tracked": "Siguiendo",
      "remove": "Quitar de StreamPulse",
      "added": "{{name}} añadido a StreamPulse",
      "removed": "{{name}} eliminado de StreamPulse",
      "error": "Acción fallida. Inténtalo de nuevo."
    },
    "player": {
      "skipToLive": "Volver al directo",
      "holdToFastForward": "Mantén pulsado para avanzar x2",
      "volumeBoostLabel": "Amplificar el volumen",
      "volumeBoostHint": "Clic: activar o desactivar · rueda o flechas: ajustar, hasta 200 %",
      "pictureInPicture": "Imagen en imagen",
      "clipDownload": "Descargar clip (MP4)",
      "clipDownloading": "Descargando clip…",
      "clipDownloadFailed": "Error en la descarga, inténtalo de nuevo",
      "latencyEmpty": "Latencia: --",
      "latencyValue": "Latencia: {{value}}s",
      "offline": "DESCONECTADO"
    },
    "chatFilter": {
      "replacement": "Mensaje eliminado por StreamPulse"
    },
    "shared": {
      "settings": {
        "groupAutomation": "Automatización",
        "groupPreviews": "Vistas previas al pasar",
        "groupNotifications": "Notificaciones",
        "groupChat": "Chat",
        "autoClaimTitle": "Auto-reclamo de puntos",
        "autoClaimDropsTitle": "Reclamar Drops de Twitch automáticamente",
        "autoClaimMomentsTitle": "Reclamar Moments de Twitch automáticamente",
        "autoCancelRaidsTitle": "Cancelar raids automáticamente",
        "autoRefreshTitle": "Recuperar el reproductor si falla",
        "keepQualityTitle": "Mantener la calidad en segundo plano",
        "fastForwardTitle": "Botón de avance rápido",
        "pipButtonTitle": "Botón de imagen en imagen",
        "hideTwitchExtensionsTitle": "Ocultar extensiones de Twitch",
        "communityBadgeTitle": "Insignia comunitaria",
        "previewsEnableTitle": "Vistas previas al pasar",
        "previewsModeTitle": "Modo de vista previa",
        "previewsModeImage": "Imagen",
        "previewsModeVideo": "Vídeo",
        "previewsSurfaceDirectory": "Directorio",
        "previewsSurfaceSidebar": "Barra lateral",
        "previewsAudioTitle": "Audio (modo vídeo)",
        "liveNotificationsTitle": "Notificaciones de Chrome",
        "gameAlertsTitle": "Alertas de cambio de categoría",
        "titleAlertsTitle": "Alertas de cambio de título",
        "soundsTitle": "Sonido de las notificaciones"
      },
      "cosmetics": {
        "badgeTitle": "Efecto de la insignia",
        "badgeBody": "Anima el logo de StreamPulse junto a tu nombre.",
        "nameTitle": "Nombre especial",
        "nameBody": "Un degradado o efecto en tu nombre, visto por los usuarios de StreamPulse.",
        "none": "Ninguno",
        "pulse": "Pulso",
        "shine": "Brillo",
        "rainbow": "Arcoíris",
        "glow": "Halo",
        "bounce": "Rebote",
        "spin": "Giro",
        "flicker": "Neón parpadeante",
        "aurora": "Aurora",
        "sunset": "Atardecer",
        "lcd": "Pantalla LCD",
        "gold": "Oro",
        "neon": "Neón",
        "preview": "Vista previa del chat",
        "sampleName": "TuNombre"
      }
    }
  },
  "pt-BR": {
    "enhancer": {
      "jumpToLive": "Ir para o ao vivo (StreamPulse)"
    },
    "twitchUi": {
      "favorites": "Favoritos do StreamPulse",
      "pin": "Adicionar aos favoritos do StreamPulse",
      "unpin": "Remover dos favoritos do StreamPulse",
      "offline": "Offline",
      "emptyFavorites": "Passe o mouse num canal seguido e clique na estrela.",
      "drawerTitle": "Configurações",
      "tabGeneral": "Geral",
      "tabPreviews": "Prévias",
      "tabAlerts": "Alertas",
      "close": "Fechar",
      "fullPage": "Página completa",
      "plusOnly": "Exclusivo StreamPulse+",
      "discoverPlus": "Conhecer o StreamPulse+",
      "chatRow": "Efeitos StreamPulse+",
      "chatRowNote": "Visto por outros usuários do StreamPulse."
    },
    "badge": {
      "lifetime": "Membro vitalício",
      "months": "Assinante há {{count}} meses",
      "monthOne": "Assinante há 1 mês",
      "newMember": "Novo assinante",
      "freeLine": "Usuário da extensão"
    },
    "topbar": {
      "previews": "Prévias ao passar",
      "thisChannel": "Este canal",
      "badgeColor": "Cor do distintivo",
      "badgeAuthor": "Nome",
      "badgeTheme": "Tema",
      "badgeCustom": "Custom",
      "liveNow": "Ao vivo",
      "noneLive": "Ninguém ao vivo",
      "watchedHere": "Assistido aqui",
      "follow": "Seguir",
      "followed": "Seguindo",
      "autoClaim": "Pontos automáticos",
      "fastForward": "Avanço rápido",
      "more": "+{{count}} outros",
      "tip": "Pagar um Bubble Tea",
      "settings": "Configurações"
    },
    "quickFollow": {
      "add": "Adicionar ao StreamPulse",
      "tracked": "Seguindo",
      "remove": "Remover do StreamPulse",
      "added": "{{name}} adicionado ao StreamPulse",
      "removed": "{{name}} removido do StreamPulse",
      "error": "Falha na ação. Tente novamente."
    },
    "player": {
      "skipToLive": "Voltar ao ao vivo",
      "holdToFastForward": "Segure para avançar x2",
      "volumeBoostLabel": "Amplificar o volume",
      "volumeBoostHint": "Clique: liga ou desliga · roda ou setas: ajustar, até 200%",
      "pictureInPicture": "Picture-in-Picture",
      "clipDownload": "Baixar clipe (MP4)",
      "clipDownloading": "Baixando clipe…",
      "clipDownloadFailed": "Falha no download, tente novamente",
      "latencyEmpty": "Latência: --",
      "latencyValue": "Latência: {{value}}s",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Mensagem removida pelo StreamPulse"
    },
    "shared": {
      "settings": {
        "groupAutomation": "Automação",
        "groupPreviews": "Prévias ao passar o mouse",
        "groupNotifications": "Notificações",
        "groupChat": "Chat",
        "autoClaimTitle": "Auto-resgate de pontos",
        "autoClaimDropsTitle": "Resgatar Drops da Twitch automaticamente",
        "autoClaimMomentsTitle": "Resgatar Moments da Twitch automaticamente",
        "autoCancelRaidsTitle": "Cancelar raids automaticamente",
        "autoRefreshTitle": "Recuperar o player em caso de erro",
        "keepQualityTitle": "Manter a qualidade em segundo plano",
        "fastForwardTitle": "Botão de avanço rápido",
        "pipButtonTitle": "Botão Picture-in-Picture",
        "hideTwitchExtensionsTitle": "Ocultar extensões da Twitch",
        "communityBadgeTitle": "Distintivo comunitário",
        "previewsEnableTitle": "Prévias ao passar o mouse",
        "previewsModeTitle": "Modo de prévia",
        "previewsModeImage": "Imagem",
        "previewsModeVideo": "Vídeo",
        "previewsSurfaceDirectory": "Diretório",
        "previewsSurfaceSidebar": "Barra lateral",
        "previewsAudioTitle": "Áudio (modo vídeo)",
        "liveNotificationsTitle": "Notificações do Chrome",
        "gameAlertsTitle": "Alertas de mudança de categoria",
        "titleAlertsTitle": "Alertas de mudança de título",
        "soundsTitle": "Som das notificações"
      },
      "cosmetics": {
        "badgeTitle": "Efeito do emblema",
        "badgeBody": "Anima o logo do StreamPulse ao lado do seu nome.",
        "nameTitle": "Nome especial",
        "nameBody": "Um degradê ou efeito no seu nome, visto pelos usuários do StreamPulse.",
        "none": "Nenhum",
        "pulse": "Pulso",
        "shine": "Brilho",
        "rainbow": "Arco-íris",
        "glow": "Halo",
        "bounce": "Pulo",
        "spin": "Giro",
        "flicker": "Neon piscante",
        "aurora": "Aurora",
        "sunset": "Pôr do sol",
        "lcd": "Tela LCD",
        "gold": "Ouro",
        "neon": "Neon",
        "preview": "Prévia no chat",
        "sampleName": "SeuNome"
      }
    }
  },
  "de": {
    "enhancer": {
      "jumpToLive": "Zum Live-Stream springen (StreamPulse)"
    },
    "twitchUi": {
      "favorites": "StreamPulse-Favoriten",
      "pin": "Zu StreamPulse-Favoriten hinzufügen",
      "unpin": "Aus StreamPulse-Favoriten entfernen",
      "offline": "Offline",
      "emptyFavorites": "Fahre über einen gefolgten Kanal und klicke auf den Stern.",
      "drawerTitle": "Einstellungen",
      "tabGeneral": "Allgemein",
      "tabPreviews": "Vorschauen",
      "tabAlerts": "Benachrichtigungen",
      "close": "Schließen",
      "fullPage": "Ganze Seite",
      "plusOnly": "Nur mit StreamPulse+",
      "discoverPlus": "StreamPulse+ entdecken",
      "chatRow": "StreamPulse+-Effekte",
      "chatRowNote": "Für andere StreamPulse-Nutzer sichtbar."
    },
    "badge": {
      "lifetime": "Mitglied auf Lebenszeit",
      "months": "Seit {{count}} Monaten dabei",
      "monthOne": "Seit 1 Monat dabei",
      "newMember": "Neues Mitglied",
      "freeLine": "Nutzt die Erweiterung"
    },
    "topbar": {
      "previews": "Hover-Vorschau",
      "thisChannel": "Dieser Kanal",
      "badgeColor": "Farbe des Abzeichens",
      "badgeAuthor": "Name",
      "badgeTheme": "Theme",
      "badgeCustom": "Eigene",
      "liveNow": "Jetzt live",
      "noneLive": "Niemand ist live",
      "watchedHere": "Hier geschaut",
      "follow": "Folgen",
      "followed": "Verfolgt",
      "autoClaim": "Automatische Punkte",
      "fastForward": "Schnellvorlauf",
      "more": "+{{count}} weitere",
      "tip": "Bieten Sie einen Bubble Tea an",
      "settings": "Alle Einstellungen"
    },
    "quickFollow": {
      "add": "Zu StreamPulse hinzufügen",
      "tracked": "Verfolgt",
      "remove": "Aus StreamPulse entfernen",
      "added": "{{name}} zu StreamPulse hinzugefügt",
      "removed": "{{name}} aus StreamPulse entfernt",
      "error": "Aktion fehlgeschlagen. Versuchen Sie es erneut."
    },
    "player": {
      "skipToLive": "Weiter zum Leben",
      "holdToFastForward": "Halten Sie die Taste gedrückt, um x2",
      "volumeBoostLabel": "Lautstärke verstärken",
      "volumeBoostHint": "Klick: ein oder aus · Scrollen oder Pfeile: bis 200 %",
      "pictureInPicture": "Bild-in-Bild",
      "clipDownload": "Clip herunterladen (MP4)",
      "clipDownloading": "Clip wird heruntergeladen…",
      "clipDownloadFailed": "Download fehlgeschlagen, versuche es erneut",
      "latencyEmpty": "vorzuspulen Latenz: --",
      "latencyValue": "Latenz: {{value}}s",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Nachricht von StreamPulse entfernt"
    },
    "shared": {
      "settings": {
        "groupAutomation": "Automatisierung",
        "groupPreviews": "Hover-Vorschau",
        "groupNotifications": "Benachrichtigungen",
        "groupChat": "Chat",
        "autoClaimTitle": "Kanalpunkte automatisch beanspruchen",
        "autoClaimDropsTitle": "Beanspruchen Sie Twitch Drops automatisch",
        "autoClaimMomentsTitle": "Beanspruchen Sie automatisch Twitch-Momente",
        "autoCancelRaidsTitle": "Raids automatisch abbrechen",
        "autoRefreshTitle": "Player bei Fehlern wiederherstellen",
        "keepQualityTitle": "Qualität im Hintergrund behalten",
        "fastForwardTitle": "Schnellvorlauf-Taste",
        "pipButtonTitle": "Bild-in-Bild-Button",
        "hideTwitchExtensionsTitle": "Twitch-Erweiterungen ausblenden",
        "communityBadgeTitle": "Community-Abzeichen",
        "previewsEnableTitle": "Hover-Vorschau",
        "previewsModeTitle": "Vorschaumodus",
        "previewsModeImage": "Bild",
        "previewsModeVideo": "Video",
        "previewsSurfaceDirectory": "Verzeichnis",
        "previewsSurfaceSidebar": "Seitenleiste",
        "previewsAudioTitle": "Audio (Videomodus)",
        "liveNotificationsTitle": "Chrome-Benachrichtigungen",
        "gameAlertsTitle": "Benachrichtigungen zu Kategorieänderungen",
        "titleAlertsTitle": "Benachrichtigungen bei Titeländerung",
        "soundsTitle": "Benachrichtigungston"
      },
      "cosmetics": {
        "badgeTitle": "Abzeichen-Effekt",
        "badgeBody": "Animiert das StreamPulse-Logo neben deinem Namen.",
        "nameTitle": "Spezieller Name",
        "nameBody": "Ein Verlauf oder Effekt auf deinem Namen, sichtbar für StreamPulse-Nutzer.",
        "none": "Keiner",
        "pulse": "Pulsieren",
        "shine": "Glanz",
        "rainbow": "Regenbogen",
        "glow": "Leuchten",
        "bounce": "Hüpfen",
        "spin": "Drehen",
        "flicker": "Flackerndes Neon",
        "aurora": "Aurora",
        "sunset": "Sonnenuntergang",
        "lcd": "LCD-Bildschirm",
        "gold": "Gold",
        "neon": "Neon",
        "preview": "Chat-Vorschau",
        "sampleName": "DeinName"
      }
    }
  },
  "it": {
    "enhancer": {
      "jumpToLive": "Vai alla diretta (StreamPulse)"
    },
    "twitchUi": {
      "favorites": "Preferiti StreamPulse",
      "pin": "Aggiungi ai preferiti StreamPulse",
      "unpin": "Rimuovi dai preferiti StreamPulse",
      "offline": "Offline",
      "emptyFavorites": "Passa sopra un canale seguito e clicca la stella.",
      "drawerTitle": "Impostazioni",
      "tabGeneral": "Generale",
      "tabPreviews": "Anteprime",
      "tabAlerts": "Avvisi",
      "close": "Chiudi",
      "fullPage": "Pagina completa",
      "plusOnly": "Solo StreamPulse+",
      "discoverPlus": "Scopri StreamPulse+",
      "chatRow": "Effetti StreamPulse+",
      "chatRowNote": "Visto dagli altri utenti StreamPulse."
    },
    "badge": {
      "lifetime": "Membro a vita",
      "months": "Abbonato da {{count}} mesi",
      "monthOne": "Abbonato da 1 mese",
      "newMember": "Nuovo abbonato",
      "freeLine": "Utente dell'estensione"
    },
    "topbar": {
      "previews": "Anteprime al passaggio del mouse",
      "thisChannel": "Questo canale",
      "badgeColor": "Colore del badge",
      "badgeAuthor": "Nome",
      "badgeTheme": "Tema",
      "badgeCustom": "Custom",
      "liveNow": "Ora in diretta",
      "noneLive": "Nessuno in diretta",
      "watchedHere": "Guardato qui",
      "follow": "Segui",
      "followed": "Seguito",
      "autoClaim": "Punti automatici",
      "fastForward": "Avanzamento rapido",
      "more": "+{{count}} altri",
      "tip": "Offri un Bubble Tea",
      "settings": "Tutte le impostazioni"
    },
    "quickFollow": {
      "add": "Aggiungi a StreamPulse",
      "tracked": "Tracciato",
      "remove": "Rimuovi da StreamPulse",
      "added": "{{name}} aggiunto a StreamPulse",
      "removed": "{{name}} rimosso da StreamPulse",
      "error": "Azione fallita. Riprova."
    },
    "player": {
      "skipToLive": "Passa alla diretta",
      "holdToFastForward": "Tieni premuto per avanzare velocemente x2",
      "volumeBoostLabel": "Amplifica il volume",
      "volumeBoostHint": "Clic: attiva o disattiva · rotella o frecce: regola, fino al 200%",
      "pictureInPicture": "Picture-in-Picture",
      "clipDownload": "Scarica clip (MP4)",
      "clipDownloading": "Download della clip…",
      "clipDownloadFailed": "Download non riuscito, riprova",
      "latencyEmpty": "Latenza: --",
      "latencyValue": "Latenza: {{value}}s",
      "offline": "NON IN LINEA"
    },
    "chatFilter": {
      "replacement": "Messaggio rimosso da StreamPulse"
    },
    "shared": {
      "settings": {
        "groupAutomation": "Automazione",
        "groupPreviews": "Anteprime al passaggio del mouse",
        "groupNotifications": "Notifiche",
        "groupChat": "Chatta",
        "autoClaimTitle": "Rivendica automaticamente i punti canale",
        "autoClaimDropsTitle": "Riscuoti automaticamente i Twitch Drops",
        "autoClaimMomentsTitle": "Rivendica automaticamente i momenti Twitch",
        "autoCancelRaidsTitle": "Annulla automaticamente i raid",
        "autoRefreshTitle": "Ripristina il player in caso di errore",
        "keepQualityTitle": "Mantieni la qualità in background",
        "fastForwardTitle": "Pulsante di avanzamento veloce",
        "pipButtonTitle": "Pulsante Picture-in-Picture",
        "hideTwitchExtensionsTitle": "Nascondi le estensioni Twitch",
        "communityBadgeTitle": "Badge della comunità",
        "previewsEnableTitle": "Anteprime al passaggio del mouse",
        "previewsModeTitle": "Modalità anteprima",
        "previewsModeImage": "Immagine",
        "previewsModeVideo": "Video",
        "previewsSurfaceDirectory": "Elenco",
        "previewsSurfaceSidebar": "Barra laterale",
        "previewsAudioTitle": "Audio (modalità video)",
        "liveNotificationsTitle": "Notifiche di Chrome",
        "gameAlertsTitle": "Avvisi di cambio di categoria",
        "titleAlertsTitle": "Avvisi di cambio titolo",
        "soundsTitle": "Suono di notifica"
      },
      "cosmetics": {
        "badgeTitle": "Effetto del badge",
        "badgeBody": "Anima il logo StreamPulse accanto al tuo nome.",
        "nameTitle": "Nome speciale",
        "nameBody": "Un gradiente o un effetto sul tuo nome, visto dagli utenti StreamPulse.",
        "none": "Nessuno",
        "pulse": "Pulsazione",
        "shine": "Riflesso",
        "rainbow": "Arcobaleno",
        "glow": "Alone",
        "bounce": "Rimbalzo",
        "spin": "Rotazione",
        "flicker": "Neon lampeggiante",
        "aurora": "Aurora",
        "sunset": "Tramonto",
        "lcd": "Schermo LCD",
        "gold": "Oro",
        "neon": "Neon",
        "preview": "Anteprima in chat",
        "sampleName": "IlTuoNome"
      }
    }
  },
  "pl": {
    "enhancer": {
      "jumpToLive": "Przejdź na żywo (StreamPulse)"
    },
    "twitchUi": {
      "favorites": "Ulubione StreamPulse",
      "pin": "Dodaj do ulubionych StreamPulse",
      "unpin": "Usuń z ulubionych StreamPulse",
      "offline": "Offline",
      "emptyFavorites": "Najedź na obserwowany kanał i kliknij gwiazdkę.",
      "drawerTitle": "Ustawienia",
      "tabGeneral": "Ogólne",
      "tabPreviews": "Podglądy",
      "tabAlerts": "Alerty",
      "close": "Zamknij",
      "fullPage": "Pełna strona",
      "plusOnly": "Tylko StreamPulse+",
      "discoverPlus": "Poznaj StreamPulse+",
      "chatRow": "Efekty StreamPulse+",
      "chatRowNote": "Widoczne dla innych użytkowników StreamPulse."
    },
    "badge": {
      "lifetime": "Członek dożywotni",
      "months": "Subskrybuje od {{count}} mies.",
      "monthOne": "Subskrybuje od 1 miesiąca",
      "newMember": "Nowy subskrybent",
      "freeLine": "Użytkownik rozszerzenia"
    },
    "topbar": {
      "previews": "Najedź kursorem na podglądy",
      "thisChannel": "Ten kanał",
      "badgeColor": "Kolor odznaki",
      "badgeAuthor": "Pseudonim",
      "badgeTheme": "Motyw",
      "badgeCustom": "Własny",
      "liveNow": "Na żywo",
      "noneLive": "Nikt nie nadaje",
      "watchedHere": "Oglądane tutaj",
      "follow": "Obserwuj",
      "followed": "Obserwowany",
      "autoClaim": "Automatyczne punkty",
      "fastForward": "Przewijanie",
      "more": "+{{count}} więcej",
      "tip": "Zaoferuj herbatę bąbelkową",
      "settings": "Wszystkie ustawienia"
    },
    "quickFollow": {
      "add": "Dodaj do StreamPulse",
      "tracked": "Śledzone",
      "remove": "Usuń ze StreamPulse",
      "added": "{{name}} dodano do StreamPulse",
      "removed": "{{name}} usunięty ze StreamPulse",
      "error": "Akcja nie powiodła się. Spróbuj ponownie."
    },
    "player": {
      "skipToLive": "Przejdź do transmisji na żywo",
      "holdToFastForward": "Przytrzymaj, aby przewinąć do przodu x2",
      "volumeBoostLabel": "Wzmocnij głośność",
      "volumeBoostHint": "Klik: włącz lub wyłącz · kółko lub strzałki: do 200%",
      "pictureInPicture": "Obraz w obrazie",
      "clipDownload": "Pobierz klip (MP4)",
      "clipDownloading": "Pobieranie klipu…",
      "clipDownloadFailed": "Pobieranie nie powiodło się, spróbuj ponownie",
      "latencyEmpty": "Opóźnienie: --",
      "latencyValue": "Opóźnienie: {{value}} s",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Wiadomość usunięta przez StreamPulse"
    },
    "shared": {
      "settings": {
        "groupAutomation": "Automatyzacja",
        "groupPreviews": "Najedź kursorem na podglądy",
        "groupNotifications": "Powiadomienia",
        "groupChat": "Czat",
        "autoClaimTitle": "Automatyczne odbieranie punktów kanału",
        "autoClaimDropsTitle": "Automatyczne odbieranie Twitch Drops",
        "autoClaimMomentsTitle": "Automatyczne odbieranie chwil Twitch",
        "autoCancelRaidsTitle": "Automatyczne anulowanie nalotów",
        "autoRefreshTitle": "Napraw odtwarzacz przy błędzie",
        "keepQualityTitle": "Zachowaj jakość w tle",
        "fastForwardTitle": "Przycisk przewijania do przodu",
        "pipButtonTitle": "Przycisk obrazu w obrazie",
        "hideTwitchExtensionsTitle": "Ukryj rozszerzenia Twitcha",
        "communityBadgeTitle": "Odznaka społeczności",
        "previewsEnableTitle": "Najedź kursorem na podglądy",
        "previewsModeTitle": "Tryb podglądu",
        "previewsModeImage": "Obraz",
        "previewsModeVideo": "Wideo",
        "previewsSurfaceDirectory": "Katalog",
        "previewsSurfaceSidebar": "Pasek boczny",
        "previewsAudioTitle": "Dźwięk (tryb wideo)",
        "liveNotificationsTitle": "Powiadomienia Chrome",
        "gameAlertsTitle": "Alerty o zmianie kategorii",
        "titleAlertsTitle": "Alerty o zmianie tytułu",
        "soundsTitle": "Dźwięk powiadomienia"
      },
      "cosmetics": {
        "badgeTitle": "Efekt odznaki",
        "badgeBody": "Animuje logo StreamPulse obok Twojej nazwy.",
        "nameTitle": "Specjalna nazwa",
        "nameBody": "Gradient lub efekt na Twojej nazwie, widoczny dla użytkowników StreamPulse.",
        "none": "Brak",
        "pulse": "Pulsowanie",
        "shine": "Połysk",
        "rainbow": "Tęcza",
        "glow": "Poświata",
        "bounce": "Podskok",
        "spin": "Obrót",
        "flicker": "Migający neon",
        "aurora": "Zorza",
        "sunset": "Zachód słońca",
        "lcd": "Ekran LCD",
        "gold": "Złoto",
        "neon": "Neon",
        "preview": "Podgląd czatu",
        "sampleName": "TwojaNazwa"
      }
    }
  },
  "tr": {
    "enhancer": {
      "jumpToLive": "Canlı yayına git (StreamPulse)"
    },
    "twitchUi": {
      "favorites": "StreamPulse favorileri",
      "pin": "StreamPulse favorilerine ekle",
      "unpin": "StreamPulse favorilerinden çıkar",
      "offline": "Çevrimdışı",
      "emptyFavorites": "Takip ettiğin bir kanalın üzerine gel ve yıldıza tıkla.",
      "drawerTitle": "Ayarlar",
      "tabGeneral": "Genel",
      "tabPreviews": "Önizlemeler",
      "tabAlerts": "Uyarılar",
      "close": "Kapat",
      "fullPage": "Tam sayfa",
      "plusOnly": "Yalnızca StreamPulse+",
      "discoverPlus": "StreamPulse+'ı keşfet",
      "chatRow": "StreamPulse+ efektleri",
      "chatRowNote": "Diğer StreamPulse kullanıcıları görür."
    },
    "badge": {
      "lifetime": "Ömür boyu üye",
      "months": "{{count}} aydır abone",
      "monthOne": "1 aydır abone",
      "newMember": "Yeni abone",
      "freeLine": "Eklenti kullanıcısı"
    },
    "topbar": {
      "previews": "Fareyle üzerine gelindiğinde görünen önizlemeler",
      "thisChannel": "Bu kanal",
      "badgeColor": "Rozet rengi",
      "badgeAuthor": "Kullanıcı adı",
      "badgeTheme": "Tema",
      "badgeCustom": "Özel",
      "liveNow": "Şu anda yayında",
      "noneLive": "Kimse yayında değil",
      "watchedHere": "Burada izlenen",
      "follow": "Takip et",
      "followed": "Takip ediliyor",
      "autoClaim": "Otomatik puanlar",
      "fastForward": "Hızlı ileri",
      "more": "+{{count}} daha",
      "tip": "Bir Bubble Tea ikram edin",
      "settings": "Tüm ayarlar"
    },
    "quickFollow": {
      "add": "StreamPulse'a ekle",
      "tracked": "Takip Edilen",
      "remove": "StreamPulse'tan kaldır",
      "added": "{{name}}, StreamPulse'a eklendi",
      "removed": "{{name}}, StreamPulse'tan kaldırıldı",
      "error": "İşlem başarısız oldu. Lütfen tekrar deneyin."
    },
    "player": {
      "skipToLive": "Canlı yayına atla",
      "holdToFastForward": "Hızlı ileri sarma için basılı tutun x2",
      "volumeBoostLabel": "Sesi güçlendir",
      "volumeBoostHint": "Tık: aç veya kapat · tekerlek veya oklar: %200'e kadar ayarla",
      "pictureInPicture": "Resim içinde resim",
      "clipDownload": "Klibi indir (MP4)",
      "clipDownloading": "Klip indiriliyor…",
      "clipDownloadFailed": "İndirme başarısız, tekrar dene",
      "latencyEmpty": "Gecikme: --",
      "latencyValue": "Gecikme süresi: {{value}} saniye",
      "offline": "ÇEVRİMDIŞI"
    },
    "chatFilter": {
      "replacement": "Mesaj, StreamPulse tarafından kaldırıldı"
    },
    "shared": {
      "settings": {
        "groupAutomation": "Otomasyon",
        "groupPreviews": "Fareyle üzerine gelindiğinde görünen önizlemeler",
        "groupNotifications": "Bildirimler",
        "groupChat": "Kedi",
        "autoClaimTitle": "Kanal puanlarını otomatik olarak talep et",
        "autoClaimDropsTitle": "Twitch Drops'u otomatik olarak talep et",
        "autoClaimMomentsTitle": "Twitch Moments'ı otomatik olarak talep et",
        "autoCancelRaidsTitle": "Baskınları Otomatik Olarak İptal Et",
        "autoRefreshTitle": "Hata olunca oynatıcıyı kurtar",
        "keepQualityTitle": "Arka planda kaliteyi koru",
        "fastForwardTitle": "Hızlı ileri sarma düğmesi",
        "pipButtonTitle": "Resim içinde resim düğmesi",
        "hideTwitchExtensionsTitle": "Twitch uzantılarını gizle",
        "communityBadgeTitle": "Topluluk rozeti",
        "previewsEnableTitle": "Fareyle üzerine gelindiğinde görünen önizlemeler",
        "previewsModeTitle": "Önizleme modu",
        "previewsModeImage": "Resim",
        "previewsModeVideo": "Video",
        "previewsSurfaceDirectory": "Dizin",
        "previewsSurfaceSidebar": "Kenar çubuğu",
        "previewsAudioTitle": "Ses (video modu)",
        "liveNotificationsTitle": "Chrome bildirimleri",
        "gameAlertsTitle": "Kategori değişikliği uyarıları",
        "titleAlertsTitle": "Başlık değişikliği uyarıları",
        "soundsTitle": "Bildirim sesi"
      },
      "cosmetics": {
        "badgeTitle": "Rozet efekti",
        "badgeBody": "Adının yanındaki StreamPulse logosunu canlandırır.",
        "nameTitle": "Özel ad",
        "nameBody": "Adında StreamPulse kullanıcılarının göreceği bir renk geçişi ya da efekt.",
        "none": "Yok",
        "pulse": "Nabız",
        "shine": "Parıltı",
        "rainbow": "Gökkuşağı",
        "glow": "Hale",
        "bounce": "Zıplama",
        "spin": "Dönme",
        "flicker": "Titreyen neon",
        "aurora": "Kutup ışığı",
        "sunset": "Gün batımı",
        "lcd": "LCD ekran",
        "gold": "Altın",
        "neon": "Neon",
        "preview": "Sohbet önizlemesi",
        "sampleName": "AdınBurada"
      }
    }
  },
  "ru": {
    "enhancer": {
      "jumpToLive": "Перейти к прямому эфиру (StreamPulse)"
    },
    "twitchUi": {
      "favorites": "Избранное StreamPulse",
      "pin": "Добавить в избранное StreamPulse",
      "unpin": "Убрать из избранного StreamPulse",
      "offline": "Не в сети",
      "emptyFavorites": "Наведи на отслеживаемый канал и нажми на звезду.",
      "drawerTitle": "Настройки",
      "tabGeneral": "Общие",
      "tabPreviews": "Превью",
      "tabAlerts": "Оповещения",
      "close": "Закрыть",
      "fullPage": "Полная страница",
      "plusOnly": "Только StreamPulse+",
      "discoverPlus": "Узнать о StreamPulse+",
      "chatRow": "Эффекты StreamPulse+",
      "chatRowNote": "Видно другим пользователям StreamPulse."
    },
    "badge": {
      "lifetime": "Пожизненный участник",
      "months": "Подписка {{count}} мес.",
      "monthOne": "Подписка 1 месяц",
      "newMember": "Новый подписчик",
      "freeLine": "Пользователь расширения"
    },
    "topbar": {
      "previews": "Предварительный просмотр при наведении курсора",
      "thisChannel": "Этот канал",
      "badgeColor": "Цвет значка",
      "badgeAuthor": "Ник",
      "badgeTheme": "Тема",
      "badgeCustom": "Свой",
      "liveNow": "В эфире",
      "noneLive": "Никого нет в эфире",
      "watchedHere": "Просмотрено здесь",
      "follow": "Отслеживать",
      "followed": "Отслеживается",
      "autoClaim": "Автоочки канала",
      "fastForward": "Перемотка",
      "more": "+{{count}} ещё",
      "tip": "Предложите чай с пузырьками",
      "settings": "Все настройки"
    },
    "quickFollow": {
      "add": "Добавить в StreamPulse",
      "tracked": "Отслеживается",
      "remove": "Удалить из StreamPulse",
      "added": "{{name}} добавлен в StreamPulse",
      "removed": "{{name}} удален из StreamPulse",
      "error": "Операция не удалась. Попробуйте ещё раз."
    },
    "player": {
      "skipToLive": "Перейти к трансляции",
      "holdToFastForward": "Удерживайте для ускоренного просмотра в 2 раза",
      "volumeBoostLabel": "Усилить громкость",
      "volumeBoostHint": "Клик: вкл или выкл · колесо или стрелки: до 200 %",
      "pictureInPicture": "Картинка в картинке",
      "clipDownload": "Скачать клип (MP4)",
      "clipDownloading": "Скачивание клипа…",
      "clipDownloadFailed": "Не удалось скачать, попробуйте снова",
      "latencyEmpty": "Задержка: --",
      "latencyValue": "Задержка: {{value}} с",
      "offline": "ОФЛАЙН"
    },
    "chatFilter": {
      "replacement": "Сообщение удалено StreamPulse"
    },
    "shared": {
      "settings": {
        "groupAutomation": "Автоматизация",
        "groupPreviews": "Предварительный просмотр при наведении курсора",
        "groupNotifications": "Уведомления",
        "groupChat": "Кот",
        "autoClaimTitle": "Автоматическое начисление баллов по каналу «Auto-claim»",
        "autoClaimDropsTitle": "Автоматическое получение призов Twitch Drops",
        "autoClaimMomentsTitle": "Автоматическое добавление моментов Twitch",
        "autoCancelRaidsTitle": "Автоматическая отмена рейдов",
        "autoRefreshTitle": "Восстанавливать плеер при ошибке",
        "keepQualityTitle": "Сохранять качество в фоне",
        "fastForwardTitle": "Кнопка «Перемотка вперед»",
        "pipButtonTitle": "Кнопка «Картинка в картинке»",
        "hideTwitchExtensionsTitle": "Скрыть расширения Twitch",
        "communityBadgeTitle": "Значок сообщества",
        "previewsEnableTitle": "Предварительный просмотр при наведении курсора",
        "previewsModeTitle": "Режим предварительного просмотра",
        "previewsModeImage": "Изображение",
        "previewsModeVideo": "Видео",
        "previewsSurfaceDirectory": "Справочник",
        "previewsSurfaceSidebar": "Боковая панель",
        "previewsAudioTitle": "Аудио (режим видео)",
        "liveNotificationsTitle": "Уведомления Chrome",
        "gameAlertsTitle": "Уведомления об изменении категории",
        "titleAlertsTitle": "Оповещения об изменении названия",
        "soundsTitle": "Звук уведомления"
      },
      "cosmetics": {
        "badgeTitle": "Эффект значка",
        "badgeBody": "Анимирует логотип StreamPulse рядом с вашим ником.",
        "nameTitle": "Особый ник",
        "nameBody": "Градиент или эффект на вашем нике, видимый пользователям StreamPulse.",
        "none": "Нет",
        "pulse": "Пульсация",
        "shine": "Блеск",
        "rainbow": "Радуга",
        "glow": "Свечение",
        "bounce": "Прыжок",
        "spin": "Вращение",
        "flicker": "Мигающий неон",
        "aurora": "Сияние",
        "sunset": "Закат",
        "lcd": "Экран LCD",
        "gold": "Золото",
        "neon": "Неон",
        "preview": "Предпросмотр чата",
        "sampleName": "ВашНик"
      }
    }
  },
  "ja": {
    "enhancer": {
      "jumpToLive": "ライブに移動 (StreamPulse)"
    },
    "twitchUi": {
      "favorites": "StreamPulse お気に入り",
      "pin": "StreamPulse お気に入りに追加",
      "unpin": "StreamPulse お気に入りから削除",
      "offline": "オフライン",
      "emptyFavorites": "フォロー中のチャンネルにカーソルを合わせて星をクリック。",
      "drawerTitle": "設定",
      "tabGeneral": "一般",
      "tabPreviews": "プレビュー",
      "tabAlerts": "通知",
      "close": "閉じる",
      "fullPage": "全画面ページ",
      "plusOnly": "StreamPulse+ 限定",
      "discoverPlus": "StreamPulse+ を見る",
      "chatRow": "StreamPulse+ エフェクト",
      "chatRowNote": "他の StreamPulse ユーザーに表示されます。"
    },
    "badge": {
      "lifetime": "永久メンバー",
      "months": "{{count}}か月利用中",
      "monthOne": "1か月利用中",
      "newMember": "新規メンバー",
      "freeLine": "拡張機能ユーザー"
    },
    "topbar": {
      "previews": "ホバー時のプレビュー",
      "thisChannel": "このチャンネル",
      "badgeColor": "バッジの色",
      "badgeAuthor": "ユーザー名",
      "badgeTheme": "テーマ",
      "badgeCustom": "カスタム",
      "liveNow": "配信中",
      "noneLive": "配信中の人はいません",
      "watchedHere": "ここでの視聴",
      "follow": "フォロー",
      "followed": "フォロー中",
      "autoClaim": "ポイント自動取得",
      "fastForward": "早送り",
      "more": "他 {{count}} 件",
      "tip": "バブルティーを振る舞う",
      "settings": "すべての設定"
    },
    "quickFollow": {
      "add": "StreamPulseに追加",
      "tracked": "追跡済み",
      "remove": "StreamPulseから削除する",
      "added": "{{name}} が StreamPulse に追加されました",
      "removed": "{{name}} が StreamPulse から削除されました",
      "error": "操作に失敗しました。もう一度お試しください。"
    },
    "player": {
      "skipToLive": "ライブへスキップ",
      "holdToFastForward": "長押しで早送り（2倍速）",
      "volumeBoostLabel": "音量をブースト",
      "volumeBoostHint": "クリック：オン/オフ · ホイールや矢印：最大200%まで調整",
      "pictureInPicture": "ピクチャー・イン・ピクチャー",
      "clipDownload": "クリップをダウンロード (MP4)",
      "clipDownloading": "クリップをダウンロード中…",
      "clipDownloadFailed": "ダウンロードに失敗しました。もう一度お試しください",
      "latencyEmpty": "レイテンシー：--",
      "latencyValue": "遅延：{{value}}秒",
      "offline": "オフライン"
    },
    "chatFilter": {
      "replacement": "StreamPulse によりメッセージが削除されました"
    },
    "shared": {
      "settings": {
        "groupAutomation": "自動化",
        "groupPreviews": "ホバー時のプレビュー",
        "groupNotifications": "通知",
        "groupChat": "猫",
        "autoClaimTitle": "チャンネルポイントの自動獲得",
        "autoClaimDropsTitle": "Twitch Dropsの自動受け取り",
        "autoClaimMomentsTitle": "Twitch Momentsの自動申請",
        "autoCancelRaidsTitle": "レイドの自動キャンセル",
        "autoRefreshTitle": "エラー時にプレーヤーを復帰させる",
        "keepQualityTitle": "バックグラウンドでも画質を維持",
        "fastForwardTitle": "早送りボタン",
        "pipButtonTitle": "ピクチャー・イン・ピクチャーボタン",
        "hideTwitchExtensionsTitle": "Twitchの拡張機能を非表示にする",
        "communityBadgeTitle": "コミュニティバッジ",
        "previewsEnableTitle": "ホバー時のプレビュー",
        "previewsModeTitle": "プレビューモード",
        "previewsModeImage": "画像",
        "previewsModeVideo": "動画",
        "previewsSurfaceDirectory": "ディレクトリ",
        "previewsSurfaceSidebar": "サイドバー",
        "previewsAudioTitle": "音声（動画モード）",
        "liveNotificationsTitle": "Chromeの通知",
        "gameAlertsTitle": "カテゴリ変更の通知",
        "titleAlertsTitle": "タイトル変更の通知",
        "soundsTitle": "通知音"
      },
      "cosmetics": {
        "badgeTitle": "バッジのエフェクト",
        "badgeBody": "名前の横の StreamPulse ロゴをアニメーションさせます。",
        "nameTitle": "スペシャルネーム",
        "nameBody": "StreamPulse ユーザーに見える、名前のグラデーションやエフェクト。",
        "none": "なし",
        "pulse": "パルス",
        "shine": "きらめき",
        "rainbow": "レインボー",
        "glow": "グロー",
        "bounce": "バウンス",
        "spin": "スピン",
        "flicker": "点滅ネオン",
        "aurora": "オーロラ",
        "sunset": "サンセット",
        "lcd": "LCD 画面",
        "gold": "ゴールド",
        "neon": "ネオン",
        "preview": "チャットのプレビュー",
        "sampleName": "あなたの名前"
      }
    }
  },
  "ko": {
    "enhancer": {
      "jumpToLive": "라이브로 이동 (StreamPulse)"
    },
    "twitchUi": {
      "favorites": "StreamPulse 즐겨찾기",
      "pin": "StreamPulse 즐겨찾기에 추가",
      "unpin": "StreamPulse 즐겨찾기에서 제거",
      "offline": "오프라인",
      "emptyFavorites": "팔로우한 채널에 마우스를 올리고 별을 누르세요.",
      "drawerTitle": "설정",
      "tabGeneral": "일반",
      "tabPreviews": "미리보기",
      "tabAlerts": "알림",
      "close": "닫기",
      "fullPage": "전체 페이지",
      "plusOnly": "StreamPulse+ 전용",
      "discoverPlus": "StreamPulse+ 알아보기",
      "chatRow": "StreamPulse+ 효과",
      "chatRowNote": "다른 StreamPulse 사용자에게 보입니다."
    },
    "badge": {
      "lifetime": "평생 멤버",
      "months": "{{count}}개월째 구독 중",
      "monthOne": "1개월째 구독 중",
      "newMember": "새 구독자",
      "freeLine": "확장 프로그램 사용자"
    },
    "topbar": {
      "previews": "마우스 오버 시 미리보기",
      "thisChannel": "이 채널",
      "badgeColor": "배지 색상",
      "badgeAuthor": "사용자 이름",
      "badgeTheme": "테마",
      "badgeCustom": "사용자 지정",
      "liveNow": "방송 중",
      "noneLive": "방송 중인 사람이 없습니다",
      "watchedHere": "여기서 시청",
      "follow": "팔로우",
      "followed": "팔로우 중",
      "autoClaim": "자동 채널 포인트",
      "fastForward": "빨리 감기",
      "more": "외 {{count}}명",
      "tip": "버블티 한 잔 대접하기",
      "settings": "모든 설정"
    },
    "quickFollow": {
      "add": "StreamPulse에 추가하기",
      "tracked": "추적됨",
      "remove": "StreamPulse에서 제거",
      "added": "{{name}}이(가) StreamPulse에 추가되었습니다.",
      "removed": "{{name}}이(가) StreamPulse에서 삭제되었습니다.",
      "error": "작업이 실패했습니다. 다시 시도해 주세요."
    },
    "player": {
      "skipToLive": "라이브로 건너뛰기",
      "holdToFastForward": "길게 누르면 2배속으로 빨리 감기",
      "volumeBoostLabel": "음량 증폭",
      "volumeBoostHint": "클릭: 켜기/끄기 · 휠 또는 화살표: 최대 200%까지 조절",
      "pictureInPicture": "PIP 모드",
      "clipDownload": "클립 다운로드 (MP4)",
      "clipDownloading": "클립 다운로드 중…",
      "clipDownloadFailed": "다운로드에 실패했습니다. 다시 시도하세요",
      "latencyEmpty": "지연 시간: --",
      "latencyValue": "지연 시간: {{value}}초",
      "offline": "오프라인"
    },
    "chatFilter": {
      "replacement": "StreamPulse에 의해 메시지가 삭제되었습니다."
    },
    "shared": {
      "settings": {
        "groupAutomation": "자동화",
        "groupPreviews": "마우스 오버 시 미리보기",
        "groupNotifications": "알림",
        "groupChat": "고양이",
        "autoClaimTitle": "채널 포인트 자동 적립",
        "autoClaimDropsTitle": "Twitch Drops 자동 수령",
        "autoClaimMomentsTitle": "Twitch 모멘트 자동 클레임",
        "autoCancelRaidsTitle": "레이드 자동 취소",
        "autoRefreshTitle": "오류 시 플레이어 복구",
        "keepQualityTitle": "백그라운드에서 화질 유지",
        "fastForwardTitle": "빨리 감기 버튼",
        "pipButtonTitle": "PIP 버튼",
        "hideTwitchExtensionsTitle": "Twitch 확장 프로그램 숨기기",
        "communityBadgeTitle": "커뮤니티 배지",
        "previewsEnableTitle": "마우스 오버 시 미리보기",
        "previewsModeTitle": "미리보기 모드",
        "previewsModeImage": "이미지",
        "previewsModeVideo": "동영상",
        "previewsSurfaceDirectory": "목록",
        "previewsSurfaceSidebar": "사이드바",
        "previewsAudioTitle": "오디오 (동영상 모드)",
        "liveNotificationsTitle": "Chrome 알림",
        "gameAlertsTitle": "카테고리 변경 알림",
        "titleAlertsTitle": "제목 변경 알림",
        "soundsTitle": "알림 소리"
      },
      "cosmetics": {
        "badgeTitle": "배지 효과",
        "badgeBody": "닉네임 옆 StreamPulse 로고에 애니메이션을 줍니다.",
        "nameTitle": "특별 닉네임",
        "nameBody": "StreamPulse 사용자에게 보이는 닉네임 그라데이션이나 효과.",
        "none": "없음",
        "pulse": "펄스",
        "shine": "반짝임",
        "rainbow": "무지개",
        "glow": "후광",
        "bounce": "바운스",
        "spin": "회전",
        "flicker": "깜빡이는 네온",
        "aurora": "오로라",
        "sunset": "노을",
        "lcd": "LCD 화면",
        "gold": "골드",
        "neon": "네온",
        "preview": "채팅 미리보기",
        "sampleName": "내닉네임"
      }
    }
  }
};
  var DEFAULT_LANG = "en";

  /**
   * Résout une préférence stockée ("pt_BR", "EN", "de-DE") vers une langue
   * disponible. Exact d'abord, puis sous-étiquette de base.
   */
  function resolve(value) {
    if (typeof value !== "string" || !value.trim()) return DEFAULT_LANG;
    var raw = value.trim().replace(/_/g, "-").toLowerCase();
    var codes = Object.keys(STRINGS);
    for (var i = 0; i < codes.length; i++) {
      if (codes[i].toLowerCase() === raw) return codes[i];
    }
    var base = raw.split("-")[0];
    for (var j = 0; j < codes.length; j++) {
      if (codes[j].toLowerCase() === base) return codes[j];
      if (codes[j].toLowerCase().split("-")[0] === base) return codes[j];
    }
    return DEFAULT_LANG;
  }

  /** Lit une clé "a.b.c", avec repli sur l'anglais puis sur la clé brute. */
  function get(lang, key, params) {
    var value = dig(STRINGS[lang], key);
    if (value == null) value = dig(STRINGS[DEFAULT_LANG], key);
    if (typeof value !== "string") return key;
    if (params) {
      value = value.replace(/{{\s*([^}\s]+)\s*}}/g, function (match, name) {
        return Object.prototype.hasOwnProperty.call(params, name) ? params[name] : match;
      });
    }
    return value;
  }

  function dig(root, key) {
    if (!root) return null;
    var parts = String(key).split(".");
    var node = root;
    for (var i = 0; i < parts.length; i++) {
      if (node == null || typeof node !== "object") return null;
      node = node[parts[i]];
    }
    return node;
  }

  window.__SP_I18N__ = {
    resolve: resolve,
    get: get,
    languages: Object.keys(STRINGS),
    defaultLanguage: DEFAULT_LANG,
  };
})();
