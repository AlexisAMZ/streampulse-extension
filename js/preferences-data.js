/**
 * Défauts des préférences générales — source unique partagée par le service
 * worker (background.js) et la popup. Avant, popup.js recopiait un sous-ensemble
 * sans synchronisation : toute nouvelle préférence y tombait sur undefined.
 */
import { DEFAULT_LANGUAGE } from "../i18n/translations.js";

export const DEFAULT_PREFERENCES = {
  liveNotifications: true,
  gameNotifications: false,
  titleNotifications: false,
  dropAlerts: true,
  predictionAlerts: true,
  raidAlerts: true,
  // Bêta : détection des raids entrants en arrière-plan via IRC anonyme.
  // Opt-in explicite car elle maintient une connexion WebSocket permanente.
  backgroundRaidAlerts: false,
  // Notification « StreamPulse a été mis à jour » : une fois par version,
  // clic vers la page des nouveautés.
  updateNotifications: true,
  soundsEnabled: true,
  autoClaimChannelPoints: true,
  autoClaimDrops: true,
  autoClaimMoments: true,
  autoOpenInventory: false,
  autoOpenInventoryIntervalHours: 24,
  hideTwitchExtensions: false,
  keepQualityInBackground: false,
  enablePipButton: true,
  autoRefreshPlayerErrors: true,
  enableClipDownload: true,
  playerQuality: "auto",
  autoCancelRaids: false,
  preventTabDiscard: true,
  enablePredictionsPopup: true,
  enableTabLiveIcon: true,
  enableStreamerFavicon: true,
  enableFastForwardButton: true,
  watchTimeTracker: true,
  pointsTracking: true,
  dropsTracking: true,
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
  previewsShowDelayMs: 200,
  previewsAnimations: true,
  communityBadge: false,
  // "author" = couleur du pseudo, "theme" = blanc/noir selon Twitch,
  // ou une couleur hexadecimale fixe.
  communityBadgeColor: "author",
};
