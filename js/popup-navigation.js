import { normalizeLinkedAccounts } from "./linked-accounts.js";

export function filterByPlatform(streamers, platform) {
  const filtered = platform === "all" ? streamers : streamers.filter((streamer) => streamer.platform === platform);
  return {
    streamers: filtered,
    liveCount: filtered.filter((streamer) => streamer.status?.active?.isLive === true).length,
  };
}

export function selectLiveWithLinks(streamers, statuses, value) {
  const groups = normalizeLinkedAccounts(value, streamers);
  const live = streamers.filter((streamer) => statuses[streamer.id]?.active?.isLive === true);
  const hidden = new Set();
  for (const group of groups) {
    const candidates = live.filter((streamer) => group.streamerIds.includes(streamer.id));
    const preferred = candidates.find((streamer) => streamer.id === group.preferredId);
    const visible = preferred || candidates[0];
    if (visible) candidates.filter((streamer) => streamer !== visible).forEach((streamer) => hidden.add(streamer.id));
  }
  return live.filter((streamer) => !hidden.has(streamer.id));
}
