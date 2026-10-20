export const LINKED_ACCOUNTS_KEY = "streamPulseLinkedAccounts";
export const LINKED_ACCOUNTS_LIMIT = 100;

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const KNOWN_PLATFORMS = new Set(["twitch", "kick", "youtube", "chzzk"]);
const MAX_ID_LENGTH = 60;
const MAX_NAME_LENGTH = 80;

const platformOf = (streamer) => {
  const platform = typeof streamer?.platform === "string" ? streamer.platform.trim().toLowerCase() : "";
  return KNOWN_PLATFORMS.has(platform) ? platform : null;
};

const trimmed = (value) => (typeof value === "string" ? value.trim() : "");

/** Roster lookup: `undefined` means "no roster, trust the IDs"; anything else filters. */
function rosterIndex(streamers) {
  if (streamers === undefined) return null;
  const roster = Array.isArray(streamers) ? streamers.filter(isObject) : [];
  return new Map(roster.filter((streamer) => typeof streamer.id === "string").map((streamer) => [streamer.id, platformOf(streamer)]));
}

/** Two platforms are required only when every member has a known platform. */
function spansPlatforms(ids, roster) {
  if (!roster) return true;
  const platforms = ids.map((id) => roster.get(id));
  if (platforms.some((platform) => !platform)) return true;
  return new Set(platforms).size >= 2;
}

function normalizeGroup(raw, roster, takenMembers) {
  if (!isObject(raw)) return null;
  const id = trimmed(raw.id).slice(0, MAX_ID_LENGTH);
  const name = trimmed(raw.name).slice(0, MAX_NAME_LENGTH);
  if (!id || !name || !Array.isArray(raw.streamerIds)) return null;
  const ids = [...new Set(raw.streamerIds.map(trimmed))]
    .filter((member) => member && !takenMembers.has(member) && (!roster || roster.has(member)));
  if (ids.length < 2 || !spansPlatforms(ids, roster)) return null;
  const preferred = trimmed(raw.preferredId);
  return { id, name, streamerIds: ids, preferredId: ids.includes(preferred) ? preferred : ids[0] };
}

/** Manual, bounded groups. A streamer belongs to at most one group. */
export function normalizeLinkedAccounts(value, streamers) {
  const roster = rosterIndex(streamers);
  const takenMembers = new Set();
  const takenIds = new Set();
  const groups = [];
  for (const raw of Array.isArray(value) ? value : []) {
    if (groups.length === LINKED_ACCOUNTS_LIMIT) break;
    const group = normalizeGroup(raw, roster, takenMembers);
    if (!group || takenIds.has(group.id)) continue;
    group.streamerIds.forEach((member) => takenMembers.add(member));
    takenIds.add(group.id);
    groups.push(group);
  }
  return groups;
}

export function getLinkedGroup(groups, streamerId) {
  return normalizeLinkedAccounts(groups).find((group) => group.streamerIds.includes(streamerId)) ?? null;
}

const isLiveStatus = (status) => {
  if (!isObject(status)) return false;
  if (isObject(status.active)) return status.active.isLive === true && status.active.isError !== true;
  return status.isLive === true && status.isError !== true;
};
const accountEnabled = (account) => account?.notificationsEnabled !== false;

/** Worker snapshots are Maps and only count own entries; popup fixtures use plain objects. */
function statusEntries(statuses) {
  if (!statuses || typeof statuses !== "object") return null;
  if (statuses instanceof Map) return [...statuses];
  return Object.keys(statuses).map((id) => [id, statuses[id]]);
}

function pickLinkedLive(streamers, statuses, groups, { respectMute }) {
  const entries = statusEntries(statuses);
  if (!Array.isArray(streamers) || !entries) return [];
  const byId = new Map(entries);
  const accounts = new Map(streamers.filter(isObject).map((streamer) => [streamer.id, streamer]));
  const live = new Set([...accounts.keys()].filter((id) => isLiveStatus(byId.get(id))));
  const hidden = new Set();
  for (const group of normalizeLinkedAccounts(groups, streamers)) {
    const candidates = group.streamerIds.filter((id) => live.has(id));
    const eligible = respectMute ? candidates.filter((id) => accountEnabled(accounts.get(id))) : candidates;
    const visible = eligible.includes(group.preferredId) ? group.preferredId : eligible[0];
    candidates.filter((id) => id !== visible).forEach((id) => hidden.add(id));
  }
  return streamers.filter((streamer) => isObject(streamer) && live.has(streamer.id) && !hidden.has(streamer.id));
}

/** One live tile per group: the preferred account when it is live, otherwise group order. */
export function selectLinkedLive(streamers, statuses, groups) {
  return pickLinkedLive(streamers, statuses, groups, { respectMute: false });
}

/** One notification per group among live candidates; muted accounts never mask another. */
export function shouldNotifyLinked(streamerId, statuses, groups) {
  const entries = statusEntries(statuses);
  if (!entries) return true;
  if (!getLinkedGroup(groups, streamerId)) return true;
  const streamers = entries.map(([id, status]) => ({ id, notificationsEnabled: status?.notificationsEnabled }));
  return pickLinkedLive(streamers, new Map(entries), groups, { respectMute: true }).some((streamer) => streamer.id === streamerId);
}

/** Comptes d'une autre plateforme que `streamerId`, libres de tout lien : ceux qu'un clic peut relier. */
export function linkCandidates(streamers, groups, streamerId) {
  const roster = Array.isArray(streamers) ? streamers.filter(isObject) : [];
  const self = roster.find((streamer) => streamer.id === streamerId);
  const selfPlatform = platformOf(self);
  if (!selfPlatform) return [];
  const taken = new Set(normalizeLinkedAccounts(groups, roster).flatMap((group) => group.streamerIds));
  if (taken.has(streamerId)) return [];
  return roster.filter((streamer) => {
    const platform = platformOf(streamer);
    return typeof streamer.id === "string" && streamer.id !== streamerId && platform && platform !== selfPlatform && !taken.has(streamer.id);
  });
}

/** Ajoute un groupe de deux comptes (le premier est le préféré) ; renvoie les groupes inchangés si le lien est impossible. */
export function linkPair(groups, streamers, firstId, secondId, name) {
  const current = normalizeLinkedAccounts(groups, streamers);
  const allowed = linkCandidates(streamers, current, firstId).some((streamer) => streamer.id === secondId);
  const label = trimmed(name).slice(0, MAX_NAME_LENGTH);
  if (!allowed || !label || current.length >= LINKED_ACCOUNTS_LIMIT) return current;
  const id = `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return [...current, { id, name: label, streamerIds: [firstId, secondId], preferredId: firstId }];
}

/** Retire le groupe qui contient `streamerId` ; les comptes eux-mêmes ne bougent pas. */
export function unlinkStreamer(groups, streamers, streamerId) {
  return normalizeLinkedAccounts(groups, streamers).filter((group) => !group.streamerIds.includes(streamerId));
}

/** Retire UN compte de son groupe ; le groupe se dissout sous deux comptes, rien d'autre ne bouge. */
export function unlinkAccount(groups, streamers, streamerId) {
  return normalizeLinkedAccounts(
    normalizeLinkedAccounts(groups, streamers).map((group) => (
      group.streamerIds.includes(streamerId)
        ? { ...group, streamerIds: group.streamerIds.filter((id) => id !== streamerId) }
        : group
    )),
    streamers,
  );
}

/**
 * Liste des chaînes : un groupe lié devient une seule ligne, à la place de son premier membre.
 * Le compte qui porte la ligne est un membre en direct, sinon le préféré, sinon le premier.
 * `members` suit le même ordre (porteur, préféré, reste du groupe).
 */
export function collapseLinkedRows(rows, groups, isLive = () => false) {
  const normalized = normalizeLinkedAccounts(groups, rows);
  const groupOf = (id) => normalized.find((group) => group.streamerIds.includes(id)) ?? null;
  const seen = new Set();
  const out = [];
  for (const streamer of rows) {
    const group = groupOf(streamer.id);
    if (!group) {
      out.push({ streamer, members: [streamer], group: null });
      continue;
    }
    if (seen.has(group.id)) continue;
    seen.add(group.id);
    const members = rows.filter((row) => group.streamerIds.includes(row.id));
    const rank = (row) => (isLive(row) ? 0 : 2) + (row.id === group.preferredId ? 0 : 1);
    const ordered = [...members].sort((a, b) => rank(a) - rank(b) || members.indexOf(a) - members.indexOf(b));
    out.push({ streamer: ordered[0], members: ordered, group: members.length > 1 ? group : null });
  }
  return out.map((row) => (row.members.length > 1 ? row : { ...row, group: null }));
}
