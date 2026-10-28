// Alertes manquées (sans StreamPulse+) : notées ici, jamais notifiées. Le point
// sur l'icône signale celles que le popup n'a pas encore montrées.

import { LIMITED_EVENT_MS, isShortEvent } from "../badge-watch.js";
import { campaignAlerts, seenFrom } from "../drop-alerts.js";
import { MISSED_KEY, addMissed, markSeen, missedFrom, unseenCount } from "../missed-alerts.js";

/** Campagnes déjà comparées pour les alertes manquées (séparé des alertes Plus). */
const MISSED_DROPS_SEEN_KEY = "streamPulseMissedDropsSeen";
const ICON_SIZES = [16, 32];
/** Vert LCD du popup, cerclé de nuit pour se détacher sur toutes les barres. */
const DOT_COLOR = "#c6d4a0";
const DOT_RING = "#0b0c22";

async function save(state) {
  await chrome.storage.local.set({ [MISSED_KEY]: state });
  await syncMissedDot(state);
}

/** Badges courts en cours (une journée ou moins) et nouveaux badges du catalogue. */
export async function recordMissedBadges({ liveBadges = [], added = [] }, now = Date.now()) {
  const entries = [
    ...liveBadges
      .filter((badge) => !badge.owned && isShortEvent(badge.event, LIMITED_EVENT_MS))
      .map((badge) => ({
        id: `badge:${badge.id}:${badge.event.campaignId || ""}`,
        kind: "badge",
        title: badge.title,
        game: badge.event.game || "",
        durationMs: badge.event.endsAt - badge.event.startsAt,
        endsAt: badge.event.endsAt,
        at: now,
      })),
    ...added.map((badge) => ({ id: `new:${badge.id}`, kind: "badge", title: badge.title, game: "", at: now })),
  ];
  if (!entries.length) return;
  const before = missedFrom((await chrome.storage.local.get(MISSED_KEY))[MISSED_KEY]);
  const after = addMissed(before, entries, now);
  if (after.items.length !== before.items.length || after.items[0]?.id !== before.items[0]?.id) await save(after);
}

/** Nouvelles campagnes Drops, tous jeux confondus. Le premier passage note sans rien compter. */
export async function recordMissedCampaigns(campaigns, now = Date.now()) {
  const stored = await chrome.storage.local.get([MISSED_KEY, MISSED_DROPS_SEEN_KEY]);
  const { alerts, seen } = campaignAlerts(campaigns, { enabled: true, mode: "all" }, seenFrom(stored[MISSED_DROPS_SEEN_KEY]), now);
  await chrome.storage.local.set({ [MISSED_DROPS_SEEN_KEY]: seen });
  if (!alerts.length) return;
  const entries = alerts.map((campaign) => ({
    id: `drop:${campaign.id}`,
    kind: "drop",
    title: campaign.name || campaign.game,
    game: campaign.game,
    endsAt: campaign.endsAt,
    at: now,
  }));
  await save(addMissed(missedFrom(stored[MISSED_KEY]), entries, now));
}

/** Le popup a montré les alertes manquées : le point de l'icône s'éteint. */
export async function markMissedSeen(now = Date.now()) {
  const state = missedFrom((await chrome.storage.local.get(MISSED_KEY))[MISSED_KEY]);
  if (!unseenCount(state)) return;
  await save(markSeen(state, now));
}

/** Avec StreamPulse+ (ou l'essai), plus rien n'est manqué : la liste et le point disparaissent. */
export async function clearMissed() {
  await chrome.storage.local.remove(MISSED_KEY);
  await syncMissedDot(missedFrom(null));
}

let baseIcons = null;

async function loadBaseIcons() {
  baseIcons ||= Promise.all(ICON_SIZES.map(async (size) => {
    const blob = await (await fetch(chrome.runtime.getURL(`images/photos/${size}px.png`))).blob();
    return [size, await createImageBitmap(blob)];
  }));
  return baseIcons;
}

/** Icône avec ou sans le point. Sans canvas hors écran (anciens navigateurs), rien ne change. */
export async function syncMissedDot(state) {
  if (typeof OffscreenCanvas !== "function" || typeof createImageBitmap !== "function") return;
  try {
    if (!unseenCount(state)) {
      await chrome.action.setIcon({ path: Object.fromEntries(ICON_SIZES.map((size) => [size, `images/photos/${size}px.png`])) });
      return;
    }
    const imageData = {};
    for (const [size, bitmap] of await loadBaseIcons()) {
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0, size, size);
      const radius = size * 0.2;
      ctx.beginPath();
      ctx.arc(radius + 1, radius + 1, radius, 0, Math.PI * 2);
      ctx.fillStyle = DOT_COLOR;
      ctx.fill();
      ctx.lineWidth = Math.max(1, size / 16);
      ctx.strokeStyle = DOT_RING;
      ctx.stroke();
      imageData[size] = ctx.getImageData(0, 0, size, size);
    }
    await chrome.action.setIcon({ imageData });
  } catch (error) {
    console.warn("[StreamPulse] point des alertes manquées :", error?.message || error);
  }
}
