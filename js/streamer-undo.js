// « Annuler » après la suppression d'un streamer : on photographie tout ce
// qui le concerne avant de le retirer, puis on calcule les messages qui le
// remettent en place (même id, alertes, rang, épingle, groupe).

export const UNDO_WINDOW_MS = 5000;

const ALERT_FLAGS = [
  ["notificationsEnabled", "toggleNotifications"],
  ["gameNotificationsEnabled", "toggleGameNotifications"],
  ["titleNotificationsEnabled", "toggleTitleNotifications"],
];

export function snapshotStreamer({ streamers = [], pinnedIds = [], groups = [] }, id) {
  const streamer = streamers.find((s) => s.id === id);
  if (!streamer) return null;
  const group = groups.find((g) => (g.memberIds || []).includes(id));
  return {
    streamer: { ...streamer },
    order: streamers.map((s) => s.id),
    pinned: pinnedIds.includes(id),
    groupId: group ? group.id : null,
  };
}

export function addMessageFor(snapshot) {
  const { streamer } = snapshot;
  return {
    type: "addStreamer",
    platform: streamer.platform || "twitch",
    handle: streamer.handle || streamer.twitch || streamer.id,
    displayName: streamer.displayName || streamer.handle || streamer.twitch || streamer.id,
  };
}

/** Messages à envoyer une fois le streamer ré-ajouté (id = restoredId). */
export function restoreMessages(snapshot, restoredId, { streamers = [], pinnedIds = [] }) {
  const restored = streamers.find((s) => s.id === restoredId) || {};
  const messages = [];
  for (const [flag, type] of ALERT_FLAGS) {
    const wanted = snapshot.streamer[flag] !== false;
    if ((restored[flag] !== false) !== wanted) messages.push({ type, id: restoredId, enabled: wanted });
  }
  const present = new Set(streamers.map((s) => s.id));
  const order = snapshot.order.map((id) => (id === snapshot.streamer.id ? restoredId : id)).filter((id) => present.has(id));
  const extras = streamers.map((s) => s.id).filter((id) => !order.includes(id));
  messages.push({ type: "reorderStreamers", order: [...order, ...extras] });
  if (snapshot.pinned && !pinnedIds.includes(restoredId)) {
    messages.push({ type: "setPinnedStreamers", pinnedIds: [...pinnedIds, restoredId] });
  }
  return messages;
}

/** Nouveaux groupes (copie) avec le streamer remis dans son groupe d'origine. */
export function restoreGroups(groups, snapshot, restoredId) {
  if (!snapshot.groupId) return groups;
  return groups.map((group) => {
    const members = (group.memberIds || []).filter((id) => id !== snapshot.streamer.id && id !== restoredId);
    return group.id === snapshot.groupId ? { ...group, memberIds: [...members, restoredId] } : group;
  });
}
