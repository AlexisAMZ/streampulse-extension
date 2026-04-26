export const AVAILABLE_LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
];

export const translations = {
  fr: {
    meta: {
      languageName: "Français",
      languageSwitcherLabel: "Langue",
    },
    common: {
      appName: "StreamPulse",
      loading: "Chargement…",
      confirm: "Confirmer",
      cancel: "Annuler",
      error: "Une erreur est survenue. Réessayez.",
      unknown: "Inconnu",
    },
    platforms: {
      twitch: "Twitch",
      kick: "Kick",
      dlive: "DLive",
    },
    onboarding: {
      htmlLang: "fr",
      documentTitle: "StreamPulse – Première configuration",
      welcomeTitle: "Bienvenue sur StreamPulse",
      welcomeDescription:
        "Ajoute ton premier streamer pour recevoir ses notifications. Tu pourras en ajouter d'autres ensuite directement depuis StreamPulse.",
      languagePrompt: "Choisis la langue de l’extension",
      languageHint: "Tu pourras la modifier plus tard depuis les réglages.",
      preferencesTitle: "Réglages recommandés",
      preferencesDescription:
        "Active les options qui te conviennent. Tu pourras les modifier plus tard dans les réglages.",
      notificationsGroupTitle: "Notifications",
      notificationsGroupHint:
        "Personnalise la façon dont StreamPulse te prévient.",
      playerGroupTitle: "Lecteur Twitch",
      playerGroupHint: "Optimise le lecteur pour rattraper le direct.",
      qualityGroupTitle: "Automatisation",
      qualityGroupHint: "Automatise les petites actions répétitives.",
      autoClaimTitle: "Récupération auto des points",
      autoClaimDescription:
        "Cliquer automatiquement les bonus de points de chaîne sur Twitch.",
      autoRefreshTitle: "Actualisation automatique",
      autoRefreshDescription:
        "Relancer le lecteur Twitch lorsqu’un message d’erreur (#1000, #2000, #3000, #4000 ou #5000) apparaît.",
      fastForwardTitle: "Bouton d'avance rapide",
      fastForwardDescription:
        "Ajouter un bouton au lecteur pour rattraper instantanément le direct.",
chatFilterTitle: "Mots-clés masqués",
      chatFilterDescription: "Masquer les messages contenant ces mots (séparés par des virgules).",
      chatFilterPlaceholder: "spoiler, ban, giveaway...",
      blockedUsersTitle: "Utilisateurs masqués",
      blockedUsersDescription: "Masquer les messages de ces utilisateurs (séparés par des virgules).",
      blockedUsersPlaceholder: "bot, spammer...",
      formLabelBase: "Nom du créateur *",
      formLabelPlatform: "Ajouter un créateur {{platform}}",
      helperTextBase: "Saisis l’identifiant ou le lien du créateur.",
      helperTextPlatform: "Ajoute un créateur disponible sur {{platform}}.",
      placeholders: {
        twitch: "ex: AlexisAMZ",
        kick: "ex: Teuf",
        dlive: "ex: Teuf",
      },
      submit: "Ajouter",
      currentHeader: "Streamers suivis",
      currentHint:
        "Vérifie ta sélection. Retire un streamer si tu t'es trompé avant de terminer.",
      removeStreamer: "Retirer",
      nextStepTitle: "Dernière étape",
      pinCallout:
        "📌 Pour retrouver l’extension facilement, pense à l’épingler :",
      pinStep1: "<strong>Clique</strong> sur l'icône puzzle en haut à droite",
      pinStep2:
        '<strong>Cherche</strong> <span class="highlight">StreamPulse</span>',
      pinStep3:
        "<strong>Épingle</strong> l’extension pour l’avoir toujours sous la main",
      nextHint:
        "Tu pourras ajouter d'autres streamers ou compléter leurs réseaux depuis le menu principal.",
      stepLanguage: "Langue",
      stepStreamers: "Streamers",
      stepSettings: "Réglages",
      stepFinish: "C'est parti",
      continueBtn: "Continuer",
      backBtn: "Retour",
      finishTitle: "Tu es prêt !",
      finishDescription: "StreamPulse est configuré. Épingle l'extension pour y accéder facilement.",
      finish: "Lancer StreamPulse 🚀",
      footerText:
        'Créé par <a href="https://www.instagram.com/alexisamz" target="_blank" rel="noopener noreferrer">@AlexisAMZ</a> • <a href="mailto:contact@alexisamz.fr">contact@alexisamz.fr</a>',
      feedback: {
        invalidHandle:
          "Merci de saisir un identifiant valide pour {{platform}}.",
        adding: "Ajout en cours…",
        addSuccessPlatform: "{{handle}} ajouté pour {{platform}} !",
        removeSuccess: "Streamer retiré.",
      },
      errors: {
        extensionUnavailable: "Impossible de contacter l'extension.",
        removeFailed: "Impossible de supprimer ce streamer.",
      },
      closeWindow: "Fermer la fenêtre",
    },
    popup: {
      htmlLang: "fr",
      title: "StreamPulse",
      tabs: {
        streamers: "Streamers",
        settings: "Réglages",
      },
      refresh: "Actualiser",
      addStreamerTitleBase: "Ajouter un streamer",
      addStreamerTitlePlatform: "Ajouter un streamer {{platform}}",
      addStreamerHelperBase: "Saisissez le lien ou l’identifiant du créateur.",
      addStreamerHelperPlatform:
        "Ajoutez un créateur disponible sur {{platform}}.",
      addStreamerSubmit: "Ajouter",
      platformSelectorLabel: "Plateforme du streamer",
      placeholders: {
        twitch: "ex: AlexisAMZ",
        kick: "ex: Teuf",
        dlive: "ex: Teuf",
      },
      emptyState: "Aucun streamer suivi. Ajoutez-en un pour commencer.",
      sort: {
        live: "En ligne d'abord",
        nameAsc: "Nom A → Z",
        nameDesc: "Nom Z → A",
        custom: "Ordre personnalisé",
      },
      settingsTitle: "Réglages",
      settings: {
        liveNotificationsTitle: "Notifications Chrome",
        liveNotificationsDescription:
          "Recevoir une alerte lorsqu’un streamer suivi démarre un live.",
        gameAlertsTitle: "Alertes changement de catégorie",
        gameAlertsDescription:
          "Être notifié lorsqu’un streamer change de jeu sur Twitch.",
        soundsTitle: "Son des notifications",
        soundsDescription: "Activer ou couper le son lors des alertes.",
        autoClaimTitle: "Récupération auto des points",
        autoClaimDescription:
          "Cliquer automatiquement les bonus de points de chaîne sur Twitch.",
        autoRefreshTitle: "Actualisation automatique",
        autoRefreshDescription:
          "Relancer le lecteur Twitch si un message d’erreur (#1000, #2000, #3000, #4000 ou #5000) apparaît.",
        fastForwardTitle: "Bouton d'avance rapide",
        fastForwardDescription:
          "Ajouter un bouton pour rattraper instantanément le direct quand le flux est en retard.",
        chatFilterDescription: "Mots-clés à masquer (séparés par des virgules).",
        languageTitle: "Langue de l'extension",
        languageDescription: "Choisissez la langue de l’interface.",
        dataTitle: "Données & Statistiques",
        dataDescription: "Gérez vos données et consultez vos statistiques.",
        groupNotifications: "Notifications",
        groupAutomation: "Automatisation",
        groupChat: "Chat",
        groupData: "Données",
        groupWatchTime: "Temps de visionnage",
        watchTimeTitle: "Watch Time Tracker",
        watchTimeDescription:
          "Suivi du temps passé sur chaque chaîne.",
      },
      watchTime: {
        totalTime: "Temps total",
        totalChannels: "Chaînes",
        topWatched: "Les plus regardés",
        empty: "Aucune donnée ce mois-ci. Regarde un stream pour commencer !",
      },
      stats: {
        pointsClaimed: "Points récupérés",
        confirmReset: "Réinitialiser les statistiques ?",
        resetSuccess: "Statistiques remises à zéro",
        resetError: "Erreur lors de la réinitialisation",
        loadError: "Erreur",
      },
      actions: {
        export: "Exporter",
        import: "Importer",
        saveChatFilter: "Enregistrer le filtre",
        saveBlockedUsers: "Enregistrer les utilisateurs masqués",
      },
      supportDev: "Offrir un Bubble Tea au développeur",
      testNotification: "Tester une notification",
      card: {
        offline: "Hors ligne",
        notificationsToggle: "Notifications",
        open: "Ouvrir",
        remove: "Retirer",
        confirmRemove: "Supprimer ?",
        confirmYes: "Oui",
        confirmNo: "Non",
        defaultLiveTitle: "En direct",
        lastUpdateLabel: "Dernière MAJ",
        noPreview: "Pas d'aperçu disponible",
        statusLive: "En live · {{platform}}",
        offlinePlatform: "Hors ligne · {{platform}}",
        statusUnsupported: "Statut indisponible sur {{platform}}",
      },
      toast: {
        notifyEnabled: "Notifications activées pour {{name}}",
        notifyDisabled: "Notifications désactivées pour {{name}}",
      },
      preferences: {
        liveEnabled: "Notifications Chrome activées.",
        liveDisabled: "Notifications Chrome désactivées.",
        gameEnabled: "Alertes changement de catégorie activées.",
        gameDisabled: "Alertes changement de catégorie désactivées.",
        soundsEnabled: "Son des notifications activé.",
        soundsDisabled: "Son des notifications désactivé.",
        autoClaimEnabled: "Récupération automatique des points activée.",
        autoClaimDisabled: "Récupération automatique des points désactivée.",
        autoRefreshEnabled: "Actualisation automatique du lecteur activée.",
        autoRefreshDisabled: "Actualisation automatique du lecteur désactivée.",
        fastForwardEnabled: "Bouton d'avance rapide activé.",
        fastForwardDisabled: "Bouton d'avance rapide désactivé.",
        watchTimeEnabled: "Watch Time Tracker activé.",
        watchTimeDisabled: "Watch Time Tracker désactivé.",
        languageUpdated: "Langue mise à jour.",
      },
      errors: {
        generic: "Une erreur est survenue. Réessayez.",
        invalidHandle:
          "Merci de saisir un identifiant valide pour {{platform}}.",
        streamerExists: "Ce streamer est déjà suivi.",
        streamerNotFound:
          "Impossible de trouver ce créateur sur {{platform}}. Vérifiez l'orthographe.",
        apiError:
          "Erreur de connexion à {{platform}}. Réessayez dans un instant.",
      },
      feedback: {
        adding: "Ajout en cours…",
        addSuccessPlatform:
          "{{handle}} ajouté à StreamPulse pour {{platform}} !",
        removeSuccess: "{{name}} retiré de la liste.",
        removeFailed: "Impossible de retirer ce streamer.",
        refreshing: "Actualisation en cours…",
        refreshDone: "Statuts mis à jour.",
        testSent: "Notification de test envoyée !",
        importSuccess: "Données importées avec succès !",
        chatFilterSaved: "Filtre de chat enregistré.",
        blockedUsersSaved: "Utilisateurs masqués enregistrés.",
        importError: "Erreur lors de l'importation.",
      },
      meta: {
        footerText:
          'Créé par <a href="https://www.instagram.com/alexisamz" target="_blank" rel="noopener noreferrer">@AlexisAMZ</a> • <a href="mailto:contact@alexisamz.fr">contact@alexisamz.fr</a>',
      },
      labels: {
        viewers: "{{count}} spectateurs",
        lastUpdateTimePlaceholder: "—",
        previewAltLive: "Aperçu du stream de {{name}}",
        previewAltOffline: "Hors ligne - {{name}}",
        avatarAlt: "Avatar de {{name}}",
      },
    },
    background: {
      errors: {
        notificationsDisabled:
          "Active les notifications Chrome pour lancer un test.",
        invalidHandle: "Nom de chaîne invalide pour {{platform}}.",
        streamerExistsPlatform: "Ce créateur est déjà suivi sur {{platform}}.",
        streamerNotFound:
          "Impossible de trouver ce créateur sur {{platform}}. Vérifie l'orthographe.",
        apiError:
          "Erreur de connexion à {{platform}}. Réessaie dans un instant.",
        noPreferencesUpdate: "Aucune préférence à mettre à jour.",
        testNotificationFailed:
          "Impossible d'envoyer la notification de test pour le moment.",
      },
      notifications: {
        liveTitle: "{{name}} est en live",
        liveMessage: "{{game}} • {{viewers}} spectateurs",
        liveMessageNoViewers: "{{game}}",
        liveMessageNoGame: "{{viewers}} spectateurs",
        categoryChangeTitle: "{{name}} change de catégorie",
        categoryChangeMessage: "{{from}} → {{to}}",
        unknownCategory: "Catégorie inconnue",
        newCategory: "Nouvelle catégorie",
        testSimpleMessage: "Ceci est une notification de test.",
        test1Title: "StreamPulse – Test 1",
        test1Message: "Notification de test immédiate 1",
        test2Title: "StreamPulse – Test 2",
        test2Message: "Notification requiert un clic",
        test3Title: "StreamPulse – Test 3",
        test3Message: "Notification planifiée toutes les 1 minute",
        test4Title: "StreamPulse – Test 4",
        test4Message: "Notification planifiée toutes les 30 secondes",
        test5Title: "StreamPulse – Test 5",
        test5Message: "Notification silencieuse",
      },
      diagnostics: {
        scheduleName: "test{{id}}",
      },
      badge: {
        live: ({ count }) =>
          count > 1
            ? `StreamPulse · ${count} streamers en live.`
            : "StreamPulse · 1 streamer suivi est en live.",
        idle: "StreamPulse",
      },
    },
  },
  en: {
    meta: {
      languageName: "English",
      languageSwitcherLabel: "Language",
    },
    common: {
      appName: "StreamPulse",
      loading: "Loading…",
      confirm: "Confirm",
      cancel: "Cancel",
      error: "Something went wrong. Please try again.",
      unknown: "Unknown",
    },
    platforms: {
      twitch: "Twitch",
      kick: "Kick",
      dlive: "DLive",
    },
    onboarding: {
      htmlLang: "en",
      documentTitle: "StreamPulse – First-time setup",
      welcomeTitle: "Welcome to StreamPulse",
      welcomeDescription:
        "Add your first streamer to start receiving their notifications. You can add more later directly from StreamPulse.",
      languagePrompt: "Choose the extension language",
      languageHint: "You can change it later from the settings.",
      preferencesTitle: "Recommended settings",
      preferencesDescription:
        "Toggle anything you need now. You can always revise these in StreamPulse.",
      notificationsGroupTitle: "Notifications",
      notificationsGroupHint:
        "Decide how StreamPulse alerts you when someone goes live or switches category.",
      playerGroupTitle: "Player helpers",
      playerGroupHint: "Keep the Twitch player close to real time.",
      qualityGroupTitle: "Automation",
      qualityGroupHint: "Automate repetitive tasks to save time.",
      autoClaimTitle: "Auto-claim channel points",
      autoClaimDescription:
        "Automatically click Twitch channel point bonuses for you.",
      autoRefreshTitle: "Automatic refresh",
      autoRefreshDescription:
        "Reload the Twitch player when an error message appears (#1000, #2000, #3000, #4000 or #5000).",
      fastForwardTitle: "Fast-forward button",
      fastForwardDescription:
        "Add a button to the player to catch up to live instantly.",
      chatFilterTitle: "Chat Filter",
      chatFilterDescription: "Hide messages containing these words (comma separated).",
      chatFilterPlaceholder: "spoiler, ban, giveaway...",
      blockedUsersTitle: "Blocked Users",
      blockedUsersDescription: "Hide messages from these users (comma separated).",
      blockedUsersPlaceholder: "bot, spammer...",
      formLabelBase: "Creator name *",
      formLabelPlatform: "Add a {{platform}} creator",
      helperTextBase: "Enter the creator handle or channel link.",
      helperTextPlatform: "Add a creator available on {{platform}}.",
      placeholders: {
        twitch: "e.g. minos",
        kick: "e.g. trainwreckstv",
        dlive: "e.g. yomogi",
      },
      submit: "Add",
      currentHeader: "Followed streamers",
      currentHint:
        "Review your selection. Remove a streamer if you made a mistake before finishing.",
      removeStreamer: "Remove",
      nextStepTitle: "Final step",
      pinCallout: "📌 Pin the extension so it stays easy to find:",
      pinStep1: "<strong>Click</strong> the puzzle icon in the toolbar",
      pinStep2:
        '<strong>Find</strong> <span class="highlight">StreamPulse</span>',
      pinStep3: "<strong>Pin</strong> the extension to keep it handy",
      nextHint:
        "You can add more streamers or complete their social links from the main menu.",
      stepLanguage: "Language",
      stepStreamers: "Streamers",
      stepSettings: "Settings",
      stepFinish: "Let's go",
      continueBtn: "Continue",
      backBtn: "Back",
      finishTitle: "You're all set!",
      finishDescription: "StreamPulse is ready. Pin the extension for quick access.",
      finish: "Launch StreamPulse 🚀",
      footerText:
        'Created by <a href="https://www.instagram.com/alexisamz" target="_blank" rel="noopener noreferrer">@AlexisAMZ</a> • <a href="mailto:contact@alexisamz.fr">contact@alexisamz.fr</a>',
      feedback: {
        invalidHandle: "Please enter a valid {{platform}} identifier.",
        adding: "Adding streamer…",
        addSuccessPlatform: "{{handle}} added for {{platform}}!",
        removeSuccess: "Creator removed.",
      },
      errors: {
        extensionUnavailable: "Unable to reach the extension.",
        removeFailed: "Unable to remove this streamer.",
      },
      closeWindow: "Close window",
    },
    popup: {
      htmlLang: "en",
      title: "StreamPulse",
      tabs: {
        streamers: "Streamers",
        settings: "Settings",
      },
      refresh: "Refresh",
      addStreamerTitleBase: "Add a streamer",
      addStreamerTitlePlatform: "Add a {{platform}} streamer",
      addStreamerHelperBase: "Enter the creator handle or channel link.",
      addStreamerHelperPlatform: "Add a creator available on {{platform}}.",
      addStreamerSubmit: "Add",
      platformSelectorLabel: "Streamer platform",
      placeholders: {
        twitch: "e.g. minos",
        kick: "e.g. trainwreckstv",
        dlive: "e.g. yomogi",
      },
      emptyState: "No streamers followed yet. Add one to get started.",
      sort: {
        live: "Online first",
        nameAsc: "Name A → Z",
        nameDesc: "Name Z → A",
        custom: "Custom order",
      },
      settingsTitle: "Settings",
      settings: {
        liveNotificationsTitle: "Chrome notifications",
        liveNotificationsDescription:
          "Get an alert when a followed streamer goes live.",
        gameAlertsTitle: "Category change alerts",
        gameAlertsDescription:
          "Be notified when a streamer switches games on Twitch.",
        soundsTitle: "Notification sound",
        soundsDescription: "Play or mute the sound when alerts fire.",
        autoClaimTitle: "Auto-claim channel points",
        autoClaimDescription:
          "Automatically click Twitch channel point bonuses for you.",
        autoRefreshTitle: "Automatic refresh",
        autoRefreshDescription:
          "Reload the Twitch player when an error message appears (#1000, #2000, #3000, #4000 or #5000).",
        fastForwardTitle: "Fast-forward button",
        fastForwardDescription:
          "Add a button to instantly catch up to live when the stream lags behind.",
        chatFilterDescription: "Hide messages containing these words (comma separated).",
        languageTitle: "Extension language",
        languageDescription: "Choose the interface language.",
        dataTitle: "Data & Statistics",
        dataDescription: "Manage your data and view your statistics.",
        groupNotifications: "Notifications",
        groupAutomation: "Automation",
        groupChat: "Chat",
        groupData: "Data",
        groupWatchTime: "Watch Time",
        watchTimeTitle: "Watch Time Tracker",
        watchTimeDescription:
          "Track time spent on each channel.",
      },
      watchTime: {
        totalTime: "Total time",
        totalChannels: "Channels",
        topWatched: "Most watched",
        empty: "No data this month. Watch a stream to get started!",
      },
      stats: {
        pointsClaimed: "Points claimed",
        confirmReset: "Reset statistics?",
        resetSuccess: "Statistics reset",
        resetError: "Failed to reset statistics",
        loadError: "Error",
      },
      actions: {
        export: "Export",
        import: "Import",
        saveChatFilter: "Save chat filter",
        saveBlockedUsers: "Save blocked users",
      },
      supportDev: "Offer a Bubble Tea to the developer",
      testNotification: "Send a test notification",
      card: {
        offline: "Offline",
        notificationsToggle: "Notifications",
        open: "Open",
        remove: "Remove",
        confirmRemove: "Delete?",
        confirmYes: "Yes",
        confirmNo: "No",
        defaultLiveTitle: "Live now",
        lastUpdateLabel: "Last update",
        noPreview: "No preview available",
        statusLive: "Live · {{platform}}",
        offlinePlatform: "Offline · {{platform}}",
        statusUnsupported: "Live status unavailable on {{platform}}",
      },
      toast: {
        notifyEnabled: "Notifications enabled for {{name}}",
        notifyDisabled: "Notifications disabled for {{name}}",
      },
      preferences: {
        liveEnabled: "Chrome notifications enabled.",
        liveDisabled: "Chrome notifications disabled.",
        gameEnabled: "Category change alerts enabled.",
        gameDisabled: "Category change alerts disabled.",
        soundsEnabled: "Notification sound enabled.",
        soundsDisabled: "Notification sound disabled.",
        autoClaimEnabled: "Channel point auto-claim enabled.",
        autoClaimDisabled: "Channel point auto-claim disabled.",
        autoRefreshEnabled: "Automatic player refresh enabled.",
        autoRefreshDisabled: "Automatic player refresh disabled.",
        fastForwardEnabled: "Fast-forward button enabled.",
        fastForwardDisabled: "Fast-forward button disabled.",
        watchTimeEnabled: "Watch Time Tracker enabled.",
        watchTimeDisabled: "Watch Time Tracker disabled.",
        languageUpdated: "Language updated.",
      },
      errors: {
        generic: "Something went wrong. Please try again.",
        invalidHandle: "Please enter a valid {{platform}} identifier.",
        streamerExists: "This creator is already followed.",
        streamerNotFound:
          "We couldn't find this creator on {{platform}}. Double-check the spelling.",
        apiError:
          "Connection error with {{platform}}. Please try again in a moment.",
      },
      feedback: {
        adding: "Adding streamer…",
        addSuccessPlatform:
          "{{handle}} has been added to StreamPulse for {{platform}}!",
        removeSuccess: "{{name}} removed from the list.",
        removeFailed: "Unable to remove this streamer.",
        refreshing: "Refreshing statuses…",
        refreshDone: "Statuses updated.",
        testSent: "Test notification sent!",
        importSuccess: "Data imported successfully!",
        chatFilterSaved: "Chat filter saved.",
        blockedUsersSaved: "Blocked users saved.",
        importError: "Error importing data.",
      },
      meta: {
        footerText:
          'Created by <a href="https://www.instagram.com/alexisamz" target="_blank" rel="noopener noreferrer">@AlexisAMZ</a> • <a href="mailto:contact@alexisamz.fr">contact@alexisamz.fr</a>',
      },
      labels: {
        viewers: "{{count}} viewers",
        lastUpdateTimePlaceholder: "—",
        previewAltLive: "{{name}}’s live preview",
        previewAltOffline: "Offline – {{name}}",
        avatarAlt: "{{name}}’s avatar",
      },
    },
    background: {
      errors: {
        notificationsDisabled: "Enable Chrome notifications to run a test.",
        invalidHandle: "Invalid {{platform}} identifier.",
        streamerExistsPlatform:
          "This creator is already followed on {{platform}}.",
        streamerNotFound:
          "We couldn't find this creator on {{platform}}. Check the spelling.",
        apiError:
          "Connection error with {{platform}}. Try again in a moment.",
        noPreferencesUpdate: "No preferences to update.",
        testNotificationFailed:
          "The test notification cannot be sent right now.",
      },
      notifications: {
        liveTitle: "{{name}} is live",
        liveMessage: "{{game}} • {{viewers}} viewers",
        liveMessageNoViewers: "{{game}}",
        liveMessageNoGame: "{{viewers}} viewers",
        categoryChangeTitle: "{{name}} changed category",
        categoryChangeMessage: "{{from}} → {{to}}",
        unknownCategory: "Unknown category",
        newCategory: "New category",
        testSimpleMessage: "This is a test notification.",
        test1Title: "StreamPulse – Test 1",
        test1Message: "Instant test notification 1",
        test2Title: "StreamPulse – Test 2",
        test2Message: "Notification requires a click",
        test3Title: "StreamPulse – Test 3",
        test3Message: "Notification scheduled every 1 minute",
        test4Title: "StreamPulse – Test 4",
        test4Message: "Notification scheduled every 30 seconds",
        test5Title: "StreamPulse – Test 5",
        test5Message: "Silent notification",
      },
      diagnostics: {
        scheduleName: "test{{id}}",
      },
      badge: {
        live: ({ count }) =>
          count > 1
            ? `StreamPulse · ${count} streamers are live.`
            : "StreamPulse · 1 streamer is live.",
        idle: "StreamPulse",
      },
    },
  },
};

export const DEFAULT_LANGUAGE = "fr";

export function formatTemplate(template, params = {}) {
  if (typeof template !== "string") {
    return template;
  }
  return template.replace(/{{\s*([^}\s]+)\s*}}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      return String(params[key]);
    }
    return "";
  });
}
