// Table de dispatch des messages runtime : un handler par type.

import { handleAddStreamer, handleGetStreamers, handleLookupTwitchUser, handleRefreshStatuses, handleRemoveStreamer, handleReorderStreamers, handleSearchChannels, handleSetPinnedStreamers, handleToggleNotificationFlag } from "./messages-streamers.js";
import { handleBadgeAutoStart, handleBadgeAutoStop, handleClaimDrop, handleDropClaimedByClick, handleDropsRefresh, handleOpenDropsStream, handleRecordDropClaim, handleRecordDropsCampaigns, handleRecordDropsEvent, handleRecordDropsInventory, handleRecordPointsGain, handleResetPoints } from "./messages-drops.js";
import { handleResetPreferences, handleTestNotification, handleUpdatePreferences, handleUpdateUserProfile } from "./messages-preferences.js";
import { handleClearEventLogs, handleGetConfig, handleGetEventLogs, handleImportHistoryCsv, handleIncrementStat, handleMarkHistorySeen, handleOpenPatchNotes, handleOpenSettings, handleRemoveHistoryEntry, handleResolveKickAvatar, handleTrackWatchTime } from "./messages-app.js";

export const MESSAGE_HANDLERS = Object.freeze({
  getStreamers: handleGetStreamers,
  lookupTwitchUser: handleLookupTwitchUser,
  searchChannels: handleSearchChannels,
  addStreamer: handleAddStreamer,
  removeStreamer: handleRemoveStreamer,
  toggleNotifications: handleToggleNotificationFlag,
  toggleGameNotifications: handleToggleNotificationFlag,
  toggleTitleNotifications: handleToggleNotificationFlag,
  refreshStatuses: handleRefreshStatuses,
  reorderStreamers: handleReorderStreamers,
  setPinnedStreamers: handleSetPinnedStreamers,
  recordPointsGain: handleRecordPointsGain,
  resetPoints: handleResetPoints,
  recordDropsInventory: handleRecordDropsInventory,
  recordDropsEvent: handleRecordDropsEvent,
  recordDropsCampaigns: handleRecordDropsCampaigns,
  recordDropClaim: handleRecordDropClaim,
  dropsRefresh: handleDropsRefresh,
  badgeAutoStart: handleBadgeAutoStart,
  badgeAutoStop: handleBadgeAutoStop,
  openDropsStream: handleOpenDropsStream,
  claimDrop: handleClaimDrop,
  dropClaimedByClick: handleDropClaimedByClick,
  updateUserProfile: handleUpdateUserProfile,
  updatePreferences: handleUpdatePreferences,
  resetPreferences: handleResetPreferences,
  testNotification: handleTestNotification,
  openPatchNotes: handleOpenPatchNotes,
  openSettings: handleOpenSettings,
  getConfig: handleGetConfig,
  trackWatchTime: handleTrackWatchTime,
  markHistorySeen: handleMarkHistorySeen,
  removeHistoryEntry: handleRemoveHistoryEntry,
  incrementStat: handleIncrementStat,
  getEventLogs: handleGetEventLogs,
  clearEventLogs: handleClearEventLogs,
  importHistoryCsv: handleImportHistoryCsv,
  resolveKickAvatar: handleResolveKickAvatar,
});
