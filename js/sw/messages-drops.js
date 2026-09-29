// Handlers de messages runtime (voir messages.js pour la table).

import { CLAIM_OK_STATUSES } from "../drops-data.js";
import { DROPS_POPUP_REFRESH_MS, announceDrops, badgeAuto, checkBadgeAfterClaim, claimDropFromWorker, dropsStore, dropsStreamUrl, pointsStore, refreshDropsFromWorker, sendDropsCommand } from "./drops.js";
import { PreferenceStore } from "./stores.js";

export function handleRecordPointsGain(request, sender, sendResponse) {
  (async () => {
    try {
      const prefs = await PreferenceStore.get();
      if (prefs.pointsTracking === false) {
        sendResponse({ success: true, recorded: false });
        return;
      }
      const result = await pointsStore.record(request.data);
      sendResponse({ success: true, ...result });
      if (result.recorded) pointsStore.resolveNames().catch(() => {});
    } catch (error) {
      sendResponse({ error: error?.message || String(error) });
    }
  })();
  return true;
}

export function handleResetPoints(request, sender, sendResponse) {
  pointsStore.reset().then(
    () => sendResponse({ success: true }),
    (error) => sendResponse({ error: error?.message || String(error) }),
  );
  return true;
}

export function handleRecordDropsInventory(request, sender, sendResponse) {
  (async () => {
    try {
      const prefs = await PreferenceStore.get();
      if (prefs.dropsTracking === false || request.ok !== true) {
        sendResponse({ success: true, recorded: false, claim: [] });
        return;
      }
      const result = await dropsStore.recordInventory(request.data, { autoClaim: prefs.autoClaimDrops !== false });
      sendResponse({ success: true, recorded: result.recorded, claim: result.claim });
      announceDrops(result.added).catch(() => {});
    } catch (error) {
      sendResponse({ error: error?.message || String(error) });
    }
  })();
  return true;
}

export function handleRecordDropsEvent(request, sender, sendResponse) {
  (async () => {
    try {
      const prefs = await PreferenceStore.get();
      if (prefs.dropsTracking === false) {
        sendResponse({ success: true, recorded: false, refresh: false, claim: [] });
        return;
      }
      const result = await dropsStore.recordEvent(request.data, { autoClaim: prefs.autoClaimDrops !== false });
      sendResponse({ success: true, ...result });
      if (result.channelId) dropsStore.resolveNames().catch(() => {});
    } catch (error) {
      sendResponse({ error: error?.message || String(error) });
    }
  })();
  return true;
}

export function handleRecordDropsCampaigns(request, sender, sendResponse) {
  (async () => {
    try {
      const prefs = await PreferenceStore.get();
      const result = prefs.dropsTracking === false
        ? { recorded: false }
        : await dropsStore.recordCampaigns(request.data, request.source);
      sendResponse({ success: true, ...result });
    } catch (error) {
      sendResponse({ error: error?.message || String(error) });
    }
  })();
  return true;
}

export function handleRecordDropClaim(request, sender, sendResponse) {
  (async () => {
    try {
      const result = await dropsStore.recordClaim({
        instanceId: String(request.instanceId || ""),
        ok: request.ok === true,
        status: String(request.status || ""),
        auto: request.auto !== false,
      });
      sendResponse({ success: true, recorded: result.recorded });
      if (result.entry) announceDrops([result.entry]).catch(() => {});
      else if (request.ok !== true || !CLAIM_OK_STATUSES.includes(request.status)) {
        console.warn("[StreamPulse] récupération du Drop refusée :", request.error || request.status || "sans statut");
      }
    } catch (error) {
      sendResponse({ error: error?.message || String(error) });
    }
  })();
  return true;
}

// Popup ouvert : relit l'inventaire (et les campagnes périmées) par un onglet Twitch.
export function handleDropsRefresh(request, sender, sendResponse) {
  (async () => {
    try {
      const prefs = await PreferenceStore.get();
      if (prefs.dropsTracking === false) {
        sendResponse({ success: true, sent: false });
        return;
      }
      const stored = await chrome.storage.local.get(["streamPulseDropsProgress", "streamPulseDropsCampaigns"]);
      const now = Date.now();
      const readAt = Number(stored.streamPulseDropsProgress?.updatedAt) || 0;
      const campaignsAt = Number(stored.streamPulseDropsCampaigns?.updatedAt) || 0;
      const sent = request.force || now - readAt >= DROPS_POPUP_REFRESH_MS
        ? (await refreshDropsFromWorker({ minGapMs: 0 })).read || (await sendDropsCommand({ action: "inventory" }))
        : false;
      if (now - campaignsAt >= 30 * 60_000) sendDropsCommand({ action: "campaigns" }).catch(() => {});
      sendResponse({ success: true, sent });
    } catch (error) {
      sendResponse({ error: error?.message || String(error) });
    }
  })();
  return true;
}

export function handleBadgeAutoStart(request, sender, sendResponse) {
  // { badge } : un badge de plus dans la file ; { all: true } : tous les badges gratuits possibles.
  const raw = request.badge || {};
  const job = raw.badgeId ? {
    badgeId: String(raw.badgeId),
    title: String(raw.title || "").slice(0, 120),
    image: String(raw.image || ""),
    game: String(raw.game || "").slice(0, 120),
    gameId: String(raw.gameId || ""),
    campaignId: String(raw.campaignId || ""),
    endsAt: Number(raw.endsAt) || 0,
    addedAt: Date.now(),
  } : null;
  badgeAuto.start({ job, all: request.all === true })
    .then((result) => sendResponse({ success: true, ...result }))
    .catch((error) => sendResponse({ error: error?.message || String(error) }));
  return true;
}

export function handleBadgeAutoStop(request, sender, sendResponse) {
  badgeAuto.stop(String(request.badgeId || ""))
    .then(() => sendResponse({ success: true }))
    .catch((error) => sendResponse({ error: error?.message || String(error) }));
  return true;
}

export function handleOpenDropsStream(request, sender, sendResponse) {
  dropsStreamUrl({ gameId: request.gameId, game: request.game })
    .then((url) => chrome.tabs.create({ url }))
    .then(() => sendResponse({ success: true }))
    .catch((error) => sendResponse({ error: error?.message || String(error) }));
  return true;
}

// Bouton « Récupérer » du popup : récupération auto coupée, ou refusée par Twitch.
export function handleClaimDrop(request, sender, sendResponse) {
  claimDropFromWorker(String(request.instanceId || ""), false)
    .then(async (claimed) => {
      if (claimed) return { sent: true };
      if (await sendDropsCommand({ action: "claim", instanceId: String(request.instanceId || "") })) return { sent: true };
      // Twitch refuse la récupération hors de sa page : on ouvre l'inventaire,
      // où le Drop se récupère d'un clic.
      await chrome.tabs.create({ url: "https://www.twitch.tv/drops/inventory", active: true });
      return { sent: true, opened: true };
    })
    .then((result) => sendResponse({ success: true, ...result }))
    .catch((error) => sendResponse({ error: error?.message || String(error) }));
  return true;
}

// channelPointsClaimer.js a cliqué un bouton « Réclamer » sur la page. Avec
// le suivi des Drops, on relit l'inventaire de cet onglet : le Drop y sera
// compté avec son nom, une seule fois. Sans le suivi, on garde l'ancien
// compteur fondé sur le clic.
export function handleDropClaimedByClick(request, sender, sendResponse) {
  (async () => {
    try {
      const prefs = await PreferenceStore.get();
      if (prefs.dropsTracking !== false) {
        setTimeout(() => sendDropsCommand({ action: "inventory" }, sender.tab?.id).catch(() => {}), 3000);
        setTimeout(checkBadgeAfterClaim, 5000);
      } else {
        await announceDrops([{ name: "", game: "", channel: String(request.channel || ""), at: Date.now() }]);
      }
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ error: error?.message || String(error) });
    }
  })();
  return true;
}
