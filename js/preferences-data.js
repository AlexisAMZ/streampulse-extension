/**
 * Défauts et nettoyage des préférences générales — source unique partagée par
 * le service worker (background.js) et la popup. Avant, popup.js recopiait un
 * sous-ensemble sans synchronisation : toute nouvelle préférence y tombait sur
 * undefined.
 *
 * La coercion vit ici (sanitizePreferences) pour rester testable hors service
 * worker : scripts/verify.mjs vérifie statiquement que DEFAULT_PREFERENCES et
 * sanitizePreferences exposent exactement les mêmes clés.
 */
import { DEFAULT_LANGUAGE, matchLanguage } from "../i18n/meta.js";

/** Qualités proposées pour le lecteur Twitch. "auto" laisse Twitch décider. */
export const PLAYER_QUALITIES = ["auto", "source", "1440", "1080", "720", "480", "360"];

export const DEFAULT_PREFERENCES = {
  liveNotifications: true,
  gameNotifications: false,
  titleNotifications: false,
  dropAlerts: false,
  raidAlerts: false,
  // Bêta : détection des raids entrants en arrière-plan via IRC anonyme.
  // Opt-in explicite car elle maintient une connexion WebSocket permanente.
  backgroundRaidAlerts: false,
  // Notification « StreamPulse a été mis à jour » : opt-in pour ne pas
  // surprendre les nouvelles installations.
  updateNotifications: false,
  soundsEnabled: true,
  theme: "dark",
  quietHoursEnabled: false,
  quietHoursStart: "23:00",
  quietHoursEnd: "08:00",
  autoClaimChannelPoints: true,
  autoClaimDrops: true,
  autoClaimMoments: true,
  autoOpenInventory: false,
  autoOpenInventoryIntervalHours: 24,
  hideTwitchExtensions: false,
  keepQualityInBackground: false,
  enablePipButton: true,
  autoRefreshPlayerErrors: true,
  enableClipDownload: false,
  playerQuality: "auto",
  // Amplification du volume du lecteur : 100 % = aucune amplification, 300 % max.
  playerVolumeBoost: 100,
  // Position de l'indicateur de latence : "viewers" = sous le lecteur, à
  // côté du nombre de spectateurs ; "chat" = dans l'en-tête du chat, à la
  // place du titre « Chat du stream ».
  latencyPlacement: "viewers",
  autoCancelRaids: false,
  preventTabDiscard: true,
  enablePredictionsPopup: true,
  enableTabLiveIcon: true,
  enableStreamerFavicon: true,
  enableFastForwardButton: true,
  watchTimeTracker: true,
  pointsTracking: true,
  dropsTracking: true,
  // Synchro multi-appareils via chrome.storage.sync : opt-in, rien ne quitte
  // l'appareil sans elle. La langue et les réglages voyagent avec la liste.
  crossDeviceSync: false,
  chatKeywords: "",
  chatBlockedUsers: "",
  language: DEFAULT_LANGUAGE,
  sortOrder: "live",
  previewsEnabled: true,
  previewsMode: "image",
  previewsSurfaceDirectory: true,
  previewsSurfaceSidebar: true,
  previewsSurfaceClips: true,
  previewsSurfaceSearch: true,
  previewsSize: "m",
  previewsAudio: false,
  previewsShowDelayMs: 350,
  previewsAnimations: true,
  communityBadge: false,
};

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Heure calme « HH:MM » : sinon le défaut. La plage peut passer minuit. */
function normalizeQuietHour(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return HH_MM.test(trimmed) ? trimmed : fallback;
}

/** Langue connue, sinon la langue par défaut du produit. */
export function normalizeLanguage(value) {
  return matchLanguage(value) || DEFAULT_LANGUAGE;
}

/** Langue d'une nouvelle installation : celle de Chrome, sinon "en". */
export function detectInstallLanguage(uiLanguage) {
  return matchLanguage(uiLanguage) || DEFAULT_LANGUAGE;
}

// Bornes 1-24 h : une seule source de coercion, partagée par
// sanitizePreferences() et le handler updatePreferences de background.js.
function clampInventoryIntervalHours(value) {
  const hours = Number(value);
  return Number.isFinite(hours)
    ? Math.min(24, Math.max(1, Math.round(hours)))
    : 24;
}

// 100 % (aucune amplification) à 300 %, au dix de pourcentage près.
function clampVolumeBoost(value) {
  const boost = Number(value);
  return Number.isFinite(boost)
    ? Math.min(300, Math.max(100, Math.round(boost)))
    : 100;
}

/**
 * Booléen opt-in : la valeur stockée gagne (un choix, même ancien, n'est
 * jamais écrasé) ; une clé absente retombe sur le défaut — false aujourd'hui.
 */
function optIn(preferences, key) {
  const value = preferences[key];
  return value === undefined ? DEFAULT_PREFERENCES[key] : value === true;
}

/**
 * Réglages d'alertes « en masse » : renvoie les champs par streamer à mettre
 * à jour quand ces réglages changent. Jamais des verrous : changer un réglage
 * l'applique à tous les streamers existants et sert de défaut aux nouveaux.
 */
export function notificationFieldsFromUpdates(updates = {}) {
  const fields = [];
  if ("liveNotifications" in updates) fields.push(["notificationsEnabled", updates.liveNotifications === true]);
  if ("gameNotifications" in updates) fields.push(["gameNotificationsEnabled", updates.gameNotifications === true]);
  if ("titleNotifications" in updates) fields.push(["titleNotificationsEnabled", updates.titleNotifications === true]);
  return fields;
}

/**
 * Préférences d'après remise à zéro : tout revient au défaut, sauf la langue
 * et le thème choisis.
 */
export function resetPreferencesFrom(current = {}) {
  return {
    ...DEFAULT_PREFERENCES,
    language: current.language ?? DEFAULT_PREFERENCES.language,
    theme: current.theme ?? DEFAULT_PREFERENCES.theme,
  };
}

/** Coercion complète d'un lot de préférences : même clés que DEFAULT_PREFERENCES. */
export function sanitizePreferences(preferences = {}) {
  const SORT_ORDER_VALUES = ["live", "name-asc", "name-desc", "custom"];
  const PREVIEWS_SIZES = ["s", "m", "l"];
  const LATENCY_PLACEMENTS = ["viewers", "chat"];
  const previewsDelay = Number(preferences.previewsShowDelayMs);
  return {
    liveNotifications: preferences.liveNotifications !== false,
    gameNotifications: Boolean(preferences.gameNotifications),
    titleNotifications: Boolean(preferences.titleNotifications),
    // Opt-in : une sauvegarde ou un stockage plus ancien peut porter true,
    // ce choix reste ; une clé absente prend le défaut (false).
    dropAlerts: optIn(preferences, "dropAlerts"),
    raidAlerts: optIn(preferences, "raidAlerts"),
    backgroundRaidAlerts: preferences.backgroundRaidAlerts === true,
    updateNotifications: optIn(preferences, "updateNotifications"),
    soundsEnabled: preferences.soundsEnabled !== false,
    theme: preferences.theme === "light" ? "light" : "dark",
    quietHoursEnabled: preferences.quietHoursEnabled === true,
    quietHoursStart: normalizeQuietHour(preferences.quietHoursStart, DEFAULT_PREFERENCES.quietHoursStart),
    quietHoursEnd: normalizeQuietHour(preferences.quietHoursEnd, DEFAULT_PREFERENCES.quietHoursEnd),
    autoClaimChannelPoints: preferences.autoClaimChannelPoints !== false,
    autoClaimDrops: preferences.autoClaimDrops !== false,
    autoClaimMoments: preferences.autoClaimMoments !== false,
    autoOpenInventory: Boolean(preferences.autoOpenInventory),
    autoOpenInventoryIntervalHours: clampInventoryIntervalHours(preferences.autoOpenInventoryIntervalHours),
    hideTwitchExtensions: Boolean(preferences.hideTwitchExtensions),
    keepQualityInBackground: preferences.keepQualityInBackground === true,
    enablePipButton: preferences.enablePipButton !== false,
    autoRefreshPlayerErrors: preferences.autoRefreshPlayerErrors !== false,
    enableClipDownload: optIn(preferences, "enableClipDownload"),
    playerQuality: PLAYER_QUALITIES.includes(preferences.playerQuality) ? preferences.playerQuality : "auto",
    playerVolumeBoost: clampVolumeBoost(preferences.playerVolumeBoost),
    latencyPlacement: LATENCY_PLACEMENTS.includes(preferences.latencyPlacement)
      ? preferences.latencyPlacement
      : "viewers",
    // Les alertes de raid rapportent des points en suivant le raid : garder
    // l'annulation automatique active rendrait les deux fonctionnalités
    // contradictoires (le raid est annulé avant qu'on puisse le suivre).
    // Tant que le détecteur de raids est actif, l'annulation est forcée off.
    autoCancelRaids:
      preferences.autoCancelRaids === true && preferences.backgroundRaidAlerts !== true,
    preventTabDiscard: preferences.preventTabDiscard !== false,
    enablePredictionsPopup: preferences.enablePredictionsPopup !== false,
    enableTabLiveIcon: preferences.enableTabLiveIcon !== false,
    enableStreamerFavicon: preferences.enableStreamerFavicon !== false,
    enableFastForwardButton: preferences.enableFastForwardButton !== false,
    watchTimeTracker: preferences.watchTimeTracker !== false,
    pointsTracking: preferences.pointsTracking !== false,
    dropsTracking: preferences.dropsTracking !== false,
    // Opt-in : la synchro ne part que sur un accord explicite.
    crossDeviceSync: optIn(preferences, "crossDeviceSync"),
    chatKeywords: typeof preferences.chatKeywords === "string" ? preferences.chatKeywords : "",
    chatBlockedUsers: typeof preferences.chatBlockedUsers === "string" ? preferences.chatBlockedUsers : "",
    language: normalizeLanguage(preferences.language),
    sortOrder: SORT_ORDER_VALUES.includes(preferences.sortOrder) ? preferences.sortOrder : "live",
    previewsEnabled: preferences.previewsEnabled !== false,
    previewsMode: preferences.previewsMode === "video" ? "video" : "image",
    previewsSurfaceDirectory: preferences.previewsSurfaceDirectory !== false,
    previewsSurfaceSidebar: preferences.previewsSurfaceSidebar !== false,
    previewsSurfaceClips: preferences.previewsSurfaceClips !== false,
    previewsSurfaceSearch: preferences.previewsSurfaceSearch !== false,
    previewsSize: PREVIEWS_SIZES.includes(preferences.previewsSize) ? preferences.previewsSize : "m",
    previewsAudio: preferences.previewsAudio === true,
    previewsShowDelayMs: Number.isFinite(previewsDelay)
      ? Math.min(2000, Math.max(0, previewsDelay))
      : DEFAULT_PREFERENCES.previewsShowDelayMs,
    previewsAnimations: preferences.previewsAnimations !== false,
    communityBadge: preferences.communityBadge === true,
  };
}
