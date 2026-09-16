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
        "autoRefreshTitle": "Actualisation automatique",
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
        "autoRefreshTitle": "Automatic refresh",
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
        "autoRefreshTitle": "Actualización automática",
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
        "autoRefreshTitle": "Atualização automática",
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
        "autoRefreshTitle": "Automatische Aktualisierung",
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
        "autoRefreshTitle": "Aggiornamento automatico",
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
        "autoRefreshTitle": "Automatyczne odświeżanie",
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
        "autoRefreshTitle": "Otomatik yenileme",
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
        "autoRefreshTitle": "Автоматическое обновление",
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
        "autoRefreshTitle": "自動更新",
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
        "autoRefreshTitle": "자동 새로고침",
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
  },
  "id": {
    "twitchUi": {
      "favorites": "Favorit StreamPulse",
      "pin": "Tambahkan ke favorit StreamPulse",
      "unpin": "Hapus dari favorit StreamPulse",
      "offline": "Offline",
      "emptyFavorites": "Arahkan ke kanal yang diikuti lalu klik bintang.",
      "drawerTitle": "Pengaturan",
      "tabGeneral": "Umum",
      "tabPreviews": "Pratinjau",
      "tabAlerts": "Peringatan",
      "close": "Tutup",
      "fullPage": "Halaman penuh",
      "plusOnly": "Khusus StreamPulse+",
      "discoverPlus": "Lihat StreamPulse+",
      "chatRow": "Efek StreamPulse+",
      "chatRowNote": "Dilihat pengguna StreamPulse lain."
    },
    "badge": {
      "lifetime": "Anggota seumur hidup",
      "months": "Berlangganan {{count}} bulan",
      "monthOne": "Berlangganan 1 bulan",
      "newMember": "Pelanggan baru",
      "freeLine": "Pengguna ekstensi"
    },
    "topbar": {
      "previews": "Pratinjau saat mengarahkan kursor",
      "thisChannel": "Kanal ini",
      "badgeColor": "Warna lencana",
      "badgeAuthor": "Nama",
      "badgeTheme": "Tema",
      "badgeCustom": "Khusus",
      "liveNow": "Sedang live",
      "noneLive": "Tidak ada yang live",
      "watchedHere": "Ditonton di sini",
      "follow": "Ikuti",
      "followed": "Diikuti",
      "autoClaim": "Poin otomatis",
      "fastForward": "Maju cepat",
      "more": "+{{count}} lainnya",
      "tip": "Menawarkan Bubble Tea",
      "settings": "Semua pengaturan"
    },
    "quickFollow": {
      "add": "Tambahkan ke StreamPulse",
      "tracked": "Dilacak",
      "remove": "Hapus dari StreamPulse",
      "added": "{{name}} telah ditambahkan ke StreamPulse",
      "removed": "{{name}} telah dihapus dari StreamPulse",
      "error": "Tindakan gagal. Coba lagi."
    },
    "player": {
      "skipToLive": "Lompat ke siaran langsung",
      "holdToFastForward": "Tahan tombol untuk memajukan cepat x2",
      "pictureInPicture": "Picture-in-Picture",
      "clipDownload": "Unduh klip (MP4)",
      "clipDownloading": "Mengunduh klip…",
      "clipDownloadFailed": "Unduhan gagal, coba lagi",
      "latencyEmpty": "Latensi: --",
      "latencyValue": "Latensi: {{value}} detik",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Pesan dihapus oleh StreamPulse"
    },
    "shared": {
      "settings": {
        "groupAutomation": "Otomatisasi",
        "groupPreviews": "Pratinjau saat mengarahkan kursor",
        "groupNotifications": "Pemberitahuan",
        "groupChat": "Kucing",
        "autoClaimTitle": "Klaim poin saluran secara otomatis",
        "autoClaimDropsTitle": "Klaim Otomatis Twitch Drops",
        "autoClaimMomentsTitle": "Klaim Otomatis Twitch Moments",
        "autoCancelRaidsTitle": "Pembatalan Otomatis Serangan",
        "autoRefreshTitle": "Pembaruan otomatis",
        "keepQualityTitle": "Pertahankan kualitas di latar belakang",
        "fastForwardTitle": "Tombol maju cepat",
        "pipButtonTitle": "Tombol Picture-in-Picture",
        "hideTwitchExtensionsTitle": "Sembunyikan ekstensi Twitch",
        "communityBadgeTitle": "Lencana komunitas",
        "previewsEnableTitle": "Pratinjau saat mengarahkan kursor",
        "previewsModeTitle": "Mode Pratinjau",
        "previewsModeImage": "Gambar",
        "previewsModeVideo": "Video",
        "previewsSurfaceDirectory": "Daftar",
        "previewsSurfaceSidebar": "Bilah samping",
        "previewsAudioTitle": "Audio (video mode)",
        "liveNotificationsTitle": "Pemberitahuan Chrome",
        "gameAlertsTitle": "Pemberitahuan perubahan kategori",
        "titleAlertsTitle": "Peringatan perubahan judul",
        "soundsTitle": "Suara notifikasi"
      },
      "cosmetics": {
        "badgeTitle": "Efek lencana",
        "badgeBody": "Menganimasikan logo StreamPulse di samping namamu.",
        "nameTitle": "Nama spesial",
        "nameBody": "Gradasi atau efek pada namamu, dilihat oleh pengguna StreamPulse.",
        "none": "Tidak ada",
        "pulse": "Denyut",
        "shine": "Kilau",
        "rainbow": "Pelangi",
        "glow": "Pendar",
        "bounce": "Pantul",
        "spin": "Putar",
        "flicker": "Neon berkedip",
        "aurora": "Aurora",
        "sunset": "Senja",
        "lcd": "Layar LCD",
        "gold": "Emas",
        "neon": "Neon",
        "preview": "Pratinjau chat",
        "sampleName": "NamaMu"
      }
    }
  },
  "nl": {
    "twitchUi": {
      "favorites": "StreamPulse-favorieten",
      "pin": "Toevoegen aan StreamPulse-favorieten",
      "unpin": "Verwijderen uit StreamPulse-favorieten",
      "offline": "Offline",
      "emptyFavorites": "Beweeg over een gevolgd kanaal en klik op de ster.",
      "drawerTitle": "Instellingen",
      "tabGeneral": "Algemeen",
      "tabPreviews": "Voorbeelden",
      "tabAlerts": "Meldingen",
      "close": "Sluiten",
      "fullPage": "Volledige pagina",
      "plusOnly": "Alleen StreamPulse+",
      "discoverPlus": "Ontdek StreamPulse+",
      "chatRow": "StreamPulse+-effecten",
      "chatRowNote": "Zichtbaar voor andere StreamPulse-gebruikers."
    },
    "badge": {
      "lifetime": "Lid voor het leven",
      "months": "{{count}} maanden abonnee",
      "monthOne": "1 maand abonnee",
      "newMember": "Nieuwe abonnee",
      "freeLine": "Gebruikt de extensie"
    },
    "topbar": {
      "previews": "Voorbeelden bij aanwijzen",
      "thisChannel": "Dit kanaal",
      "badgeColor": "Kleur van de badge",
      "badgeAuthor": "Naam",
      "badgeTheme": "Thema",
      "badgeCustom": "Eigen",
      "liveNow": "Nu live",
      "noneLive": "Niemand is live",
      "watchedHere": "Hier gekeken",
      "follow": "Volgen",
      "followed": "Gevolgd",
      "autoClaim": "Automatische punten",
      "fastForward": "Snel vooruit",
      "more": "+{{count}} meer",
      "tip": "Bied een bubble tea aan",
      "settings": "Alle instellingen"
    },
    "quickFollow": {
      "add": "Toevoegen aan StreamPulse",
      "tracked": "Gevolgd",
      "remove": "Uit StreamPulse verwijderen",
      "added": "{{name}} is toegevoegd aan StreamPulse",
      "removed": "{{name}} is verwijderd uit StreamPulse",
      "error": "De actie is mislukt. Probeer het nog eens."
    },
    "player": {
      "skipToLive": "Ga naar live",
      "holdToFastForward": "Houd ingedrukt om 2x sneller vooruit te spoelen",
      "pictureInPicture": "Beeld-in-beeld",
      "clipDownload": "Clip downloaden (MP4)",
      "clipDownloading": "Clip wordt gedownload…",
      "clipDownloadFailed": "Downloaden mislukt, probeer het opnieuw",
      "latencyEmpty": "Vertraging: --",
      "latencyValue": "Vertraging: {{value}}s",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Bericht verwijderd door StreamPulse"
    },
    "shared": {
      "settings": {
        "groupAutomation": "Automatisering",
        "groupPreviews": "Voorbeelden bij aanwijzen",
        "groupNotifications": "Meldingen",
        "groupChat": "Kat",
        "autoClaimTitle": "Punten automatisch via het claimkanaal verzamelen",
        "autoClaimDropsTitle": "Twitch Drops automatisch claimen",
        "autoClaimMomentsTitle": "Twitch Moments automatisch claimen",
        "autoCancelRaidsTitle": "Raids automatisch annuleren",
        "autoRefreshTitle": "Automatisch vernieuwen",
        "keepQualityTitle": "Kwaliteit op de achtergrond behouden",
        "fastForwardTitle": "Knop 'Snel vooruitspoelen'",
        "pipButtonTitle": "Beeld-in-beeldknop",
        "hideTwitchExtensionsTitle": "Twitch-extensies verbergen",
        "communityBadgeTitle": "Community-badge",
        "previewsEnableTitle": "Voorbeelden bij aanwijzen",
        "previewsModeTitle": "Voorbeeldmodus",
        "previewsModeImage": "Afbeelding",
        "previewsModeVideo": "Video",
        "previewsSurfaceDirectory": "Overzicht",
        "previewsSurfaceSidebar": "Zijbalk",
        "previewsAudioTitle": "Audio (videomodus)",
        "liveNotificationsTitle": "Chrome-meldingen",
        "gameAlertsTitle": "Meldingen bij wijzigingen in categorieën",
        "titleAlertsTitle": "Meldingen bij titelwijziging",
        "soundsTitle": "Meldingsgeluid"
      },
      "cosmetics": {
        "badgeTitle": "Badge-effect",
        "badgeBody": "Animeert het StreamPulse-logo naast je naam.",
        "nameTitle": "Speciale naam",
        "nameBody": "Een verloop of effect op je naam, zichtbaar voor StreamPulse-gebruikers.",
        "none": "Geen",
        "pulse": "Pulseren",
        "shine": "Glans",
        "rainbow": "Regenboog",
        "glow": "Gloed",
        "bounce": "Stuiter",
        "spin": "Draaien",
        "flicker": "Flikkerend neon",
        "aurora": "Aurora",
        "sunset": "Zonsondergang",
        "lcd": "LCD-scherm",
        "gold": "Goud",
        "neon": "Neon",
        "preview": "Chatvoorbeeld",
        "sampleName": "JouwNaam"
      }
    }
  },
  "hi": {
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
      "previews": "पूर्वावलोकन पर होवर करें",
      "thisChannel": "यह चैनल",
      "badgeColor": "बैज का रंग",
      "badgeAuthor": "उपयोगकर्ता नाम",
      "badgeTheme": "विषय",
      "badgeCustom": "रिवाज़",
      "liveNow": "अब सीधा प्रसारण हो रहा है",
      "noneLive": "अभी कोई नहीं रहता",
      "watchedHere": "यहाँ देखा",
      "follow": "अनुसरण करना",
      "followed": "पालन ​​किया",
      "autoClaim": "ऑटो चैनल पॉइंट",
      "fastForward": "तेजी से आगे बढ़ना",
      "more": "+{{count}} अधिक",
      "tip": "बबल टी पेश करें",
      "settings": "सभी सेटिंग्स"
    },
    "quickFollow": {
      "add": "StreamPulse में जोड़ें",
      "tracked": "ट्रैक",
      "remove": "StreamPulse से हटाएं",
      "added": "{{name}} को StreamPulse में जोड़ा गया",
      "removed": "{{name}} को StreamPulse से हटा दिया गया",
      "error": "क्रिया: विफल रही है। पुनः प्रयास करें।"
    },
    "player": {
      "skipToLive": "जीना छोड़ें",
      "holdToFastForward": "तेजी से आगे बढ़ने वाले x2 को दबाए रखें",
      "pictureInPicture": "Picture-in-Picture",
      "clipDownload": "Download clip (MP4)",
      "clipDownloading": "Downloading clip…",
      "clipDownloadFailed": "Download failed, try again",
      "latencyEmpty": "विलंबता:--",
      "latencyValue": "विलंबता: {{value}}s",
      "offline": "ऑफलाइन"
    },
    "chatFilter": {
      "replacement": "StreamPulse द्वारा संदेश हटा दिया गया"
    },
    "shared": {
      "settings": {
        "groupAutomation": "स्वचालन",
        "groupPreviews": "पूर्वावलोकन पर होवर करें",
        "groupNotifications": "सूचनाएं",
        "groupChat": "चैट",
        "autoClaimTitle": "स्वत: दावा चैनल अंक",
        "autoClaimDropsTitle": "स्वतः-दावा Twitch बूँदें",
        "autoClaimMomentsTitle": "स्वत: दावा Twitch क्षण",
        "autoCancelRaidsTitle": "छापे स्वत: रद्द करें",
        "autoRefreshTitle": "स्वचालित ताज़ा",
        "keepQualityTitle": "Keep quality in background",
        "fastForwardTitle": "तेजी से आगे बढ़ने वाला बटन",
        "pipButtonTitle": "Picture-in-Picture button",
        "hideTwitchExtensionsTitle": "Twitch एक्सटेंशन छुपाएं",
        "communityBadgeTitle": "सामुदायिक बैज",
        "previewsEnableTitle": "पूर्वावलोकन पर होवर करें",
        "previewsModeTitle": "पूर्वावलोकन मोड",
        "previewsModeImage": "छवि",
        "previewsModeVideo": "वीडियो",
        "previewsSurfaceDirectory": "निर्देशिका",
        "previewsSurfaceSidebar": "साइडबार",
        "previewsAudioTitle": "ऑडियो (वीडियो मोड)",
        "liveNotificationsTitle": "Chrome सूचनाएं",
        "gameAlertsTitle": "श्रेणी परिवर्तन अलर्ट",
        "titleAlertsTitle": "शीर्षक परिवर्तन अलर्ट",
        "soundsTitle": "अधिसूचना ध्वनि"
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
  "sv": {
    "twitchUi": {
      "favorites": "StreamPulse-favoriter",
      "pin": "Lägg till i StreamPulse-favoriter",
      "unpin": "Ta bort från StreamPulse-favoriter",
      "offline": "Offline",
      "emptyFavorites": "Hovra över en följd kanal och klicka på stjärnan.",
      "drawerTitle": "Inställningar",
      "tabGeneral": "Allmänt",
      "tabPreviews": "Förhandsvisningar",
      "tabAlerts": "Aviseringar",
      "close": "Stäng",
      "fullPage": "Hel sida",
      "plusOnly": "Endast StreamPulse+",
      "discoverPlus": "Upptäck StreamPulse+",
      "chatRow": "StreamPulse+-effekter",
      "chatRowNote": "Syns för andra StreamPulse-användare."
    },
    "badge": {
      "lifetime": "Livstidsmedlem",
      "months": "Prenumerant i {{count}} månader",
      "monthOne": "Prenumerant i 1 månad",
      "newMember": "Ny prenumerant",
      "freeLine": "Använder tillägget"
    },
    "topbar": {
      "previews": "Förhandsvisning vid muspekning",
      "thisChannel": "Den här kanalen",
      "badgeColor": "Märkets färg",
      "badgeAuthor": "Namn",
      "badgeTheme": "Tema",
      "badgeCustom": "Egen",
      "liveNow": "Sänder nu",
      "noneLive": "Ingen sänder nu",
      "watchedHere": "Tittat här",
      "follow": "Följ",
      "followed": "Följd",
      "autoClaim": "Automatiska poäng",
      "fastForward": "Snabbspolning",
      "more": "+{{count}} till",
      "tip": "Bjud på ett bubbelte",
      "settings": "Alla inställningar"
    },
    "quickFollow": {
      "add": "Lägg till i StreamPulse",
      "tracked": "Spårad",
      "remove": "Ta bort från StreamPulse",
      "added": "{{name}} har lagts till i StreamPulse",
      "removed": "{{name}} har tagits bort från StreamPulse",
      "error": "Åtgärden misslyckades. Försök igen."
    },
    "player": {
      "skipToLive": "Gå till live",
      "holdToFastForward": "Håll ned för att spola fram x2",
      "pictureInPicture": "Bild-i-bild",
      "clipDownload": "Ladda ner klipp (MP4)",
      "clipDownloading": "Laddar ner klipp…",
      "clipDownloadFailed": "Nedladdningen misslyckades, försök igen",
      "latencyEmpty": "Fördröjning: --",
      "latencyValue": "Fördröjning: {{value}} sekunder",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Meddelandet har tagits bort av StreamPulse"
    },
    "shared": {
      "settings": {
        "groupAutomation": "Automatisering",
        "groupPreviews": "Förhandsvisning vid muspekning",
        "groupNotifications": "Meddelanden",
        "groupChat": "Katt",
        "autoClaimTitle": "Automatisk inlösen av kanalpoäng",
        "autoClaimDropsTitle": "Automatisk hämtning av Twitch Drops",
        "autoClaimMomentsTitle": "Automatisk hämtning av Twitch Moments",
        "autoCancelRaidsTitle": "Automatisk avbrytning av raider",
        "autoRefreshTitle": "Automatisk uppdatering",
        "keepQualityTitle": "Behåll kvaliteten i bakgrunden",
        "fastForwardTitle": "Snabbspolningsknapp",
        "pipButtonTitle": "Bild-i-bild-knapp",
        "hideTwitchExtensionsTitle": "Dölj Twitch-tillägg",
        "communityBadgeTitle": "Gemenskapsmärke",
        "previewsEnableTitle": "Förhandsvisning vid muspekning",
        "previewsModeTitle": "Förhandsgranskningsläge",
        "previewsModeImage": "Bild",
        "previewsModeVideo": "Video",
        "previewsSurfaceDirectory": "Katalog",
        "previewsSurfaceSidebar": "Sidomeny",
        "previewsAudioTitle": "Ljud (videoläge)",
        "liveNotificationsTitle": "Chrome-meddelanden",
        "gameAlertsTitle": "Varningar om ändring av kategori",
        "titleAlertsTitle": "Aviseringar vid titeländring",
        "soundsTitle": "Meddelandeljud"
      },
      "cosmetics": {
        "badgeTitle": "Märkeseffekt",
        "badgeBody": "Animerar StreamPulse-loggan bredvid ditt namn.",
        "nameTitle": "Specialnamn",
        "nameBody": "En tonad färg eller effekt på ditt namn, synlig för StreamPulse-användare.",
        "none": "Ingen",
        "pulse": "Puls",
        "shine": "Glans",
        "rainbow": "Regnbåge",
        "glow": "Glöd",
        "bounce": "Studs",
        "spin": "Snurr",
        "flicker": "Flimrande neon",
        "aurora": "Norrsken",
        "sunset": "Solnedgång",
        "lcd": "LCD-skärm",
        "gold": "Guld",
        "neon": "Neon",
        "preview": "Förhandsvisning i chatten",
        "sampleName": "DittNamn"
      }
    }
  },
  "cs": {
    "twitchUi": {
      "favorites": "Oblíbené StreamPulse",
      "pin": "Přidat do oblíbených StreamPulse",
      "unpin": "Odebrat z oblíbených StreamPulse",
      "offline": "Offline",
      "emptyFavorites": "Najeď na sledovaný kanál a klikni na hvězdu.",
      "drawerTitle": "Nastavení",
      "tabGeneral": "Obecné",
      "tabPreviews": "Náhledy",
      "tabAlerts": "Upozornění",
      "close": "Zavřít",
      "fullPage": "Celá stránka",
      "plusOnly": "Jen StreamPulse+",
      "discoverPlus": "Objevit StreamPulse+",
      "chatRow": "Efekty StreamPulse+",
      "chatRowNote": "Vidí to ostatní uživatelé StreamPulse."
    },
    "badge": {
      "lifetime": "Doživotní člen",
      "months": "Předplatitel {{count}} měs.",
      "monthOne": "Předplatitel 1 měsíc",
      "newMember": "Nový předplatitel",
      "freeLine": "Uživatel rozšíření"
    },
    "topbar": {
      "previews": "Náhledy při najetí myší",
      "thisChannel": "Tento kanál",
      "badgeColor": "Barva odznaku",
      "badgeAuthor": "Jméno",
      "badgeTheme": "Motiv",
      "badgeCustom": "Vlastní",
      "liveNow": "Právě živě",
      "noneLive": "Nikdo nevysílá",
      "watchedHere": "Sledováno zde",
      "follow": "Sledovat",
      "followed": "Sledováno",
      "autoClaim": "Automatické body",
      "fastForward": "Rychlé přetáčení",
      "more": "+{{count}} dalších",
      "tip": "Nabídněte bubble tea",
      "settings": "Všechna nastavení"
    },
    "quickFollow": {
      "add": "Přidat do StreamPulse",
      "tracked": "Sledováno",
      "remove": "Odstranit ze StreamPulse",
      "added": "{{name}} byl přidán do StreamPulse",
      "removed": "{{name}} byl odstraněn ze StreamPulse",
      "error": "Akce se nezdařila. Zkuste to znovu."
    },
    "player": {
      "skipToLive": "Přejít na živé vysílání",
      "holdToFastForward": "Podržte pro dvojnásobné zrychlení přehrávání",
      "pictureInPicture": "Obraz v obraze",
      "clipDownload": "Stáhnout klip (MP4)",
      "clipDownloading": "Stahování klipu…",
      "clipDownloadFailed": "Stažení se nezdařilo, zkuste to znovu",
      "latencyEmpty": "Zpoždění: --",
      "latencyValue": "Zpoždění: {{value}} s",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Zpráva byla odstraněna službou StreamPulse"
    },
    "shared": {
      "settings": {
        "groupAutomation": "Automatizace",
        "groupPreviews": "Náhledy při najetí myší",
        "groupNotifications": "Oznámení",
        "groupChat": "Kočka",
        "autoClaimTitle": "Automatické získávání bodů v kanálu",
        "autoClaimDropsTitle": "Automatické získávání odměn z Twitch Drops",
        "autoClaimMomentsTitle": "Automatické zachycení momentů na Twitchi",
        "autoCancelRaidsTitle": "Automatické zrušení nájezdů",
        "autoRefreshTitle": "Automatické obnovení",
        "keepQualityTitle": "Zachovat kvalitu na pozadí",
        "fastForwardTitle": "Tlačítko pro rychlý posun vpřed",
        "pipButtonTitle": "Tlačítko Obraz v obraze",
        "hideTwitchExtensionsTitle": "Skrýt rozšíření Twitchu",
        "communityBadgeTitle": "Komunitní odznak",
        "previewsEnableTitle": "Náhledy při najetí myší",
        "previewsModeTitle": "Režim náhledu",
        "previewsModeImage": "Obrázek",
        "previewsModeVideo": "Video",
        "previewsSurfaceDirectory": "Adresář",
        "previewsSurfaceSidebar": "Postranní panel",
        "previewsAudioTitle": "Zvuk (režim videa)",
        "liveNotificationsTitle": "Oznámení v prohlížeči Chrome",
        "gameAlertsTitle": "Upozornění na změnu kategorie",
        "titleAlertsTitle": "Upozornění na změnu názvu",
        "soundsTitle": "Zvuk upozornění"
      },
      "cosmetics": {
        "badgeTitle": "Efekt odznaku",
        "badgeBody": "Animuje logo StreamPulse vedle tvého jména.",
        "nameTitle": "Speciální jméno",
        "nameBody": "Přechod nebo efekt na tvém jménu, viditelný pro uživatele StreamPulse.",
        "none": "Žádný",
        "pulse": "Pulzování",
        "shine": "Lesk",
        "rainbow": "Duha",
        "glow": "Záře",
        "bounce": "Poskok",
        "spin": "Otáčení",
        "flicker": "Blikající neon",
        "aurora": "Polární záře",
        "sunset": "Západ slunce",
        "lcd": "LCD displej",
        "gold": "Zlato",
        "neon": "Neon",
        "preview": "Náhled v chatu",
        "sampleName": "TvojeJméno"
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
