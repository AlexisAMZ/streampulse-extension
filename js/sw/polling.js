// Sondage des streamers suivis : statuts, état live, alertes, badge.

import { buildProfileUrl, formatHandleForDisplay, getPlatformIcon, normalizePlatform } from "../platforms.js";
import { PLUS_KEY, getDeviceId, isPlusActive, needsRecheck, verifyLicense } from "../plus.js";
import { normalizeLanguage } from "../preferences-data.js";
import { isWithinQuietHours } from "../quiet-hours.js";
import { SMART_ALERTS_KEY, decideSmartAlert, normalizeRules } from "../smart-alerts.js";
import { ActionBadge } from "./action-badge.js";
import { clearTwitchRateLimit, ensureConfig, twitchRateLimitUntil } from "./config.js";
import { HistoryStore } from "./history-store.js";
import { translate } from "./i18n.js";
import { sanitizeLogin } from "./normalize.js";
import { NotificationCenter, NotificationSystem } from "./notifications.js";
import { PlatformChecker, fetchTwitchStreamsBatch, twitchStreamToStatus } from "./platform-checker.js";
import { EMPTY_LIVE_STATE, catchUpNames, countLive, didStreamEnd, nextLiveStateFrom, planStreamerAlerts, restoreLiveStateEntry } from "./poll-logic.js";
import { streamerCache, streamerLiveState, streamerStates } from "./state.js";
import { DataStore, PreferenceStore } from "./stores.js";

/**
 * Revérifie la licence StreamPulse+ une fois par jour. Clé refusée (abonnement
 * résilié, remboursement) : la licence est retirée. Erreur réseau : on garde
 * la licence, isPlusActive applique alors le délai de grâce hors ligne.
 */
export async function recheckPlusLicense(record) {
  if (!needsRecheck(record)) return;
  const now = Date.now();
  const device = await getDeviceId(chrome.storage.local);
  const result = await verifyLicense(record.licenseKey, fetch, now, device);
  if (result.ok) {
    await chrome.storage.local.set({ [PLUS_KEY]: { ...result.record, checkedAt: now } });
  } else if (["invalid", "format", "device_limit"].includes(result.error)) {
    await chrome.storage.local.remove(PLUS_KEY);
  } else {
    await chrome.storage.local.set({ [PLUS_KEY]: { ...record, checkedAt: now } });
  }
}


/**
 * Dernier titre et derniere categorie vus en direct pour ce streamer.
 * Se lit avant que le sondage en cours n'ecrase l'etat, donc renvoie bien
 * l'avant-dernier passage en direct et non celui d'aujourd'hui.
 */
export function lastSeenOf(streamerId) {
  const previous = streamerLiveState.get(streamerId);
  if (!previous) return {};
  const lastTitle = previous.title || previous.lastTitle || "";
  const lastGame = previous.game || previous.lastGame || "";
  return {
    ...(lastTitle ? { lastTitle } : {}),
    ...(lastGame ? { lastGame } : {}),
  };
}

/**
 * Construit le statut d'un streamer. `twitchBatch` est le résultat de la
 * sonde groupée (voir pollStreamers) : { streams: Map|null, error } — quand
 * il est fourni, aucune requête Helix individuelle n'est émise pour ce
 * streamer. Un échec du batch marque tous les streamers Twitch en erreur
 * (la boucle de sondage préserve alors leur état live précédent).
 */
export async function buildStreamerStatus(streamer, twitchBatch = null) {
  const platform = streamer.platform || "twitch";
  let status;
  if (twitchBatch && platform === "twitch") {
    const login = sanitizeLogin(streamer.twitch || streamer.handle);
    if (!login) {
      status = { isLive: false };
    } else if (twitchBatch.error) {
      status = { isLive: false, error: twitchBatch.error, isError: true };
    } else {
      status = twitchStreamToStatus(twitchBatch.streams.get(login));
    }
  } else {
    status = await PlatformChecker.getStatus(streamer);
  }
  const activeStatus = status.isLive
    ? { ...status, platform, supportsLiveStatus: status.supportsLiveStatus }
    : {
        isLive: false,
        platform,
        supportsLiveStatus: status.supportsLiveStatus,
        url: status.url || buildProfileUrl(platform, streamer.handle),
        avatarUrl: status.avatarUrl || "",
        error: status.error,
        isError: status.isError,
        // L'API Twitch ne renvoie rien pour une chaine hors ligne : ni titre,
        // ni categorie. On ressert donc ce qui a ete vu au dernier passage en
        // direct, conserve dans l'etat live, lui-meme restaure du stockage
        // juste au-dessus de la boucle de sondage.
        ...lastSeenOf(streamer.id),
      };

  let avatarUrl = streamer.avatarUrl || status.avatarUrl || "";
  if (!avatarUrl && platform === "twitch") {
    const login = streamer.twitch || streamer.handle;
    if (status?.login) {
      avatarUrl = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${status.login}-128x128.jpg`;
    } else if (login) {
      avatarUrl = `https://static-cdn.jtvnw.net/jtv_user_pictures/${login}-profile_image-70x70.png`;
    }
  }
  if (!avatarUrl) {
    const fallbackIcon =
      (chrome?.runtime
        ? chrome.runtime.getURL(getPlatformIcon(platform))
        : null) || null;
    avatarUrl = fallbackIcon || "";
  }

  const displayName =
    streamer.displayName ||
    status.displayName ||
    formatHandleForDisplay(platform, streamer.handle || streamer.twitch);

  return {
    id: streamer.id,
    platform,
    handle: streamer.handle,
    displayName,
    avatarUrl,
    active: activeStatus,
    updatedAt: Date.now(),
  };
}

export let _pollInFlight = null;

export async function pollStreamers({ forceNotification = false } = {}) {
  // Re-entrancy guard: dedupe concurrent calls
  if (_pollInFlight) return _pollInFlight;

  _pollInFlight = (async () => {
    try {
      return await _pollStreamersImpl({ forceNotification });
    } finally {
      _pollInFlight = null;
    }
  })();
  return _pollInFlight;
}

/**
 * Journal de diagnostic : un changement de jeu/titre sans alerte est invisible
 * pour l'utilisateur. La console du SW dit alors quel garde a bloqué l'envoi.
 */
export function logChangeDiagnostics(streamer, previous, next, preferences) {
  if (!previous.isLive || !next.isLive || next.isError) return;
  if (previous.game !== next.game) {
    console.info("[SP] changement de categorie detecte:", streamer.handle, {
      prefGame: preferences.gameNotifications,
      streamerToggle: streamer.gameNotificationsEnabled,
    });
  }
  if (previous.title !== next.title) {
    console.info("[SP] changement de titre detecte:", streamer.handle, {
      prefTitle: preferences.titleNotifications,
      streamerToggle: streamer.titleNotificationsEnabled,
      sessionIdentique: !previous.sessionId || !next.sessionId || previous.sessionId === next.sessionId,
    });
  }
}

export async function _pollStreamersImpl({ forceNotification = false } = {}) {
  await ensureConfig(); // hydrate credentials before any Twitch API call (MV3 SW restart safety)
  const streamers = await DataStore.getStreamers();
  const preferences = await PreferenceStore.get();
  if (streamers.length === 0) {
    // Don't wipe statuses/live-state here. A transient empty read from
    // chrome.storage (or a single-poll race) shouldn't destroy the dedup state
    // for genuinely-followed streamers: it would cause every previously-live
    // streamer to re-fire its "now live" notification on the next poll.
    await ActionBadge.update(0, preferences);
    return [];
  }

  // ALWAYS restore from the dedicated LIVE_STATE storage key (not just when
  // size === 0). MV3 service workers can be terminated between any two polls,
  // and this Map is module-level (lost on every restart). Without restoring
  // from storage, every poll on a fresh SW would see `wasLive = false` and
  // re-fire the "live" notification: i.e. one notification per poll interval.
  // Using a dedicated key (vs. piggybacking on STATUSES) means notification
  // dedup survives even if the statuses object is transiently wiped.
  try {
    const savedLiveState = await DataStore.getLiveState();
    Object.entries(savedLiveState || {}).forEach(([id, entry]) => {
      const restored = restoreLiveStateEntry(entry);
      if (!streamerLiveState.has(id) && restored) streamerLiveState.set(id, restored);
    });
  } catch (err) {
    console.warn("Failed to restore live state:", err?.message || err);
  }

  // Alertes intelligentes : actives seulement avec StreamPulse+.
  const plusStored = await chrome.storage.local.get([PLUS_KEY, SMART_ALERTS_KEY]);
  await recheckPlusLicense(plusStored[PLUS_KEY]);
  const plusActive = isPlusActive((await chrome.storage.local.get(PLUS_KEY))[PLUS_KEY]);
  const smartRules = plusActive ? normalizeRules(plusStored[SMART_ALERTS_KEY]) : {};

  const streamerById = new Map();
  streamers.forEach((streamer) => {
    streamerCache.set(streamer.id, streamer);
    streamerById.set(streamer.id, streamer);
  });

  // Sonde groupée Twitch : 1 requête Helix par tranche de 100 streamers au
  // lieu d'1 requête par streamer. Un échec du batch est propagé tel quel
  // (chaque streamer Twitch repart en isError, l'état live précédent est
  // conservé par la boucle ci-dessous).
  const twitchBatch = { streams: new Map(), error: "" };
  const twitchLogins = streamers
    .filter((streamer) => normalizePlatform(streamer.platform || "twitch") === "twitch")
    .map((streamer) => sanitizeLogin(streamer.twitch || streamer.handle))
    .filter(Boolean);
  if (twitchLogins.length > 0) {
    const rateLimitedUntil = await twitchRateLimitUntil();
    if (rateLimitedUntil) {
      // Pause 429 : aucune requête Twitch envoyée, l'état précédent de chaque
      // streamer est conservé (isError => previousLiveState recopié) — ni
      // bascule offline/on-line, ni erreur affichée, et le quota respire.
      twitchBatch.error = "rate_limited";
      console.info(
        "[SP] sondage Twitch en pause (quota) jusqu'à",
        new Date(rateLimitedUntil).toISOString()
      );
    } else {
      try {
        twitchBatch.streams = await fetchTwitchStreamsBatch(twitchLogins);
        clearTwitchRateLimit();
      } catch (error) {
        twitchBatch.error = error?.message || "batch_failed";
        console.warn("Twitch batched status error:", twitchBatch.error);
      }
    }
  }

  // Kick reste sondé par chaine (pas d'API batch) : on borne la concurrence.
  const statuses = [];
  const CONCURRENCY = 3;
  for (let i = 0; i < streamers.length; i += CONCURRENCY) {
    const batch = streamers.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((streamer) => buildStreamerStatus(streamer, twitchBatch)));
    statuses.push(...results);
  }

  // Streamers déjà en direct au premier sondage (rattrapage) : une seule
  // notification groupée sera envoyée après la boucle, pas 1 par streamer.
  const catchUpLive = [];

  // Heures calmes : aucune alerte (live, catégorie, titre, rattrapage) pendant
  // la plage. L'état live reste persisté normalement, donc à la sortie de la
  // plage aucune session déjà annoncée ne repart en doublon.
  const quietNow = isWithinQuietHours(Date.now(), preferences);
  // Les envois sont mis en file et partent APRES la persistance de l'état
  // (statuses + live-state) : si le SW est tué en plein envoi, on perd au pire
  // une alerte au lieu de la rediffuser au sondage suivant (doublon).
  const queuedAlerts = [];
  const queueAlert = (send) => {
    if (!quietNow) queuedAlerts.push(send);
  };

  for (const status of statuses) {
    const streamer = streamerById.get(status.id);
    const previousLiveState = streamerLiveState.get(streamer.id) || EMPTY_LIVE_STATE;
    const now = Date.now();
    const nextLiveState = nextLiveStateFrom(status, previousLiveState, streamer, now);

    // Fin de live : entree d'historique (la VOD Twitch est cherchee ensuite).
    if (didStreamEnd(previousLiveState, nextLiveState)) {
      HistoryStore.recordEnded(streamer, previousLiveState).catch((error) =>
        console.warn("History record failed:", error?.message || error)
      );
    }

    // Regles d'alerte du streamer : elles remplacent l'alerte classique.
    const smartDecision = nextLiveState.isError
      ? null
      : decideSmartAlert(
          smartRules[streamer.id],
          status.active,
          previousLiveState.isLive ? previousLiveState.matchedRuleIds || [] : []
        );
    if (smartDecision) nextLiveState.matchedRuleIds = smartDecision.matchedIds;

    logChangeDiagnostics(streamer, previousLiveState, nextLiveState, preferences);
    const alerts = planStreamerAlerts({ streamer, previous: previousLiveState, next: nextLiveState, smartDecision, forceNotification, now });
    for (const alert of alerts) {
      if (alert.type === "catchUp") {
        const platform = status.platform || streamer.platform || "twitch";
        catchUpLive.push(streamer.displayName || formatHandleForDisplay(platform, streamer.handle || streamer.twitch));
      } else if (alert.type === "live") {
        queueAlert(() => NotificationSystem.notifyLive(streamer, status.active, preferences));
      } else if (alert.type === "game") {
        queueAlert(() => NotificationSystem.notifyGameChange(streamer, alert.from, alert.to, preferences, nextLiveState.platform));
      } else if (alert.type === "title") {
        queueAlert(() => NotificationSystem.notifyTitleChange(streamer, alert.from, alert.to, preferences, nextLiveState.platform));
      }
    }

    streamerStates.set(status.id, status);
    streamerLiveState.set(streamer.id, nextLiveState);
  }

  const statusesObject = {};
  statuses.forEach((status) => {
    statusesObject[status.id] = status;
  });
  await DataStore.saveStatuses(statusesObject);

  // Persist live-state separately so notification dedup survives SW restarts.
  // Storing as a plain object (Map serialization) keyed by streamer.id.
  try {
    const liveStateObject = {};
    streamerLiveState.forEach((value, key) => {
      liveStateObject[key] = value;
    });
    await DataStore.saveLiveState(liveStateObject);
  } catch (err) {
    console.warn("Failed to persist live state:", err?.message || err);
  }

  // L'état est persisté : les alertes partent maintenant, une à une. Un SW tué
  // ici perd une alerte, mais ne rediffusera jamais une session déjà annoncée.
  for (const send of queuedAlerts) {
    try {
      await send();
    } catch (error) {
      console.warn("[SP] alerte non envoyée :", error?.message || error);
    }
  }

  // Rattrapage au démarrage : une seule notification récapitulative, quel que
  // soit le nombre de streamers trouvés déjà en direct. Silencieuse pendant
  // les heures calmes, comme les alertes individuelles.
  if (catchUpLive.length > 0 && !quietNow) {
    const lang = normalizeLanguage(preferences?.language);
    const names = catchUpNames(catchUpLive);
    await NotificationCenter.show({
      title: translate(lang, "background.notifications.startupBatchTitle"),
      message: translate(lang, "background.notifications.startupBatchBody", { names }),
      iconUrl: NotificationCenter.getDefaultIcon(),
      requireInteraction: false,
      priority: 1,
      playSound: preferences?.soundsEnabled !== false,
    });
  }

  await ActionBadge.update(countLive(statuses), preferences);

  // Pre-cache thumbnails for live streamers (background)
  precacheThumbnails(statuses).catch(() => {});

  return statuses;
}

export async function precacheThumbnails(statuses) {
  const CACHE_KEY = "streampulse:thumbCache";
  let cache = {};
  try {
    const stored = await chrome.storage.local.get(CACHE_KEY);
    cache = stored[CACHE_KEY] || {};
  } catch { /* ignore */ }

  let changed = false;

  for (const status of statuses) {
    if (!status.active?.isLive) continue;

    // Pick the best thumbnail URL (no fetch: CORS blocks HEAD from SW)
    const candidates = status.active.thumbnailCandidates || [];
    const mainThumb = status.active.thumbnailUrl;
    const url = candidates[0] || mainThumb;
    if (!url) continue;

    if (cache[status.id] !== url) {
      cache[status.id] = url;
      changed = true;
    }
  }

  // Clean cache: remove entries for streamers no longer followed
  const statusIds = new Set(statuses.map((s) => s.id));
  for (const id of Object.keys(cache)) {
    if (!statusIds.has(id)) {
      delete cache[id];
      changed = true;
    }
  }

  if (changed) {
    await chrome.storage.local.set({ [CACHE_KEY]: cache }).catch(() => {});
  }
}
