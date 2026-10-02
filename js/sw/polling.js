// Sondage des streamers suivis : statuts, état live, alertes, badge.

import { buildProfileUrl, formatHandleForDisplay, getPlatformIcon, normalizePlatform, sanitizeHandle } from "../platforms.js";
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
import { warnWith } from "./log.js";

/**
 * Revérifie la licence StreamPulse+ une fois par jour. Clé refusée (abonnement
 * résilié, remboursement) : la licence est retirée. Erreur réseau : on garde
 * la licence, isPlusActive applique alors le délai de grâce hors ligne.
 */
async function recheckPlusLicense(record) {
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
function lastSeenOf(streamerId) {
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
async function buildStreamerStatus(streamer, twitchBatch = null, kickBatch = null) {
  const platform = streamer.platform || "twitch";
  let status;
  if (platform === "kick" && kickBatch) {
    const slug = sanitizeHandle("kick", streamer.handle || streamer.id || "");
    status = (slug && kickBatch.get(slug)) || (await PlatformChecker.getStatus(streamer));
  } else if (twitchBatch && platform === "twitch") {
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
  // Rattrapage d'avatar Kick : les streamers ajoutés avant le suivi par API
  // n'ont pas de photo (le logo de la plateforme prenait le relais). Le sondage
  // passe de toute façon par l'API de Kick — on en profite, écriture sur
  // changement seulement.
  if (platform === "kick" && status.avatarUrl && streamer.avatarUrl !== status.avatarUrl) {
    DataStore.getStreamers()
      .then((list) => {
        const entry = list.find(
          (item) => (item.platform || "twitch") === "kick"
            && String(item.handle || "").toLowerCase() === String(streamer.handle || "").toLowerCase(),
        );
        if (!entry || entry.avatarUrl === status.avatarUrl) return;
        entry.avatarUrl = status.avatarUrl;
        return DataStore.saveStreamers(list);
      })
      .catch(() => {});
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

let _pollInFlight = null;

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
function logChangeDiagnostics(streamer, previous, next, preferences) {
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

/**
 * TOUJOURS restaurer depuis la clé LIVE_STATE dédiée (pas seulement quand la
 * Map est vide) : le SW MV3 peut être tué entre deux sondages et cette Map
 * vit en mémoire. Sans cette restauration, chaque sondage d'un SW neuf
 * verrait `wasLive = false` et renverrait l'alerte « en direct ». Une clé
 * dédiée (et non STATUSES) garde la déduplication même si les statuts sont
 * effacés un instant.
 */
async function restoreLiveState() {
  try {
    const savedLiveState = await DataStore.getLiveState();
    Object.entries(savedLiveState || {}).forEach(([id, entry]) => {
      const restored = restoreLiveStateEntry(entry);
      if (!streamerLiveState.has(id) && restored) streamerLiveState.set(id, restored);
    });
  } catch (err) {
    console.warn("Failed to restore live state:", err?.message || err);
  }
}

/** Alertes intelligentes : actives seulement avec StreamPulse+. */
async function loadSmartRules() {
  const plusStored = await chrome.storage.local.get([PLUS_KEY, SMART_ALERTS_KEY]);
  await recheckPlusLicense(plusStored[PLUS_KEY]);
  const plusActive = isPlusActive((await chrome.storage.local.get(PLUS_KEY))[PLUS_KEY]);
  return plusActive ? normalizeRules(plusStored[SMART_ALERTS_KEY]) : {};
}

/**
 * Sonde groupée Twitch : 1 requête Helix par tranche de 100 streamers au lieu
 * d'1 requête par streamer. Un échec du batch est propagé tel quel (chaque
 * streamer Twitch repart en isError, l'état live précédent est conservé).
 */
async function probeTwitchBatch(streamers) {
  const twitchLogins = streamers
    .filter((streamer) => normalizePlatform(streamer.platform || "twitch") === "twitch")
    .map((streamer) => sanitizeLogin(streamer.twitch || streamer.handle))
    .filter(Boolean);
  if (twitchLogins.length === 0) return { streams: new Map(), error: "" };
  const rateLimitedUntil = await twitchRateLimitUntil();
  if (rateLimitedUntil) {
    // Pause 429 : aucune requête Twitch envoyée, l'état précédent de chaque
    // streamer est conservé — ni bascule, ni erreur affichée, et le quota respire.
    console.info("[SP] sondage Twitch en pause (quota) jusqu'à", new Date(rateLimitedUntil).toISOString());
    return { streams: new Map(), error: "rate_limited" };
  }
  try {
    const streams = await fetchTwitchStreamsBatch(twitchLogins);
    clearTwitchRateLimit();
    return { streams, error: "" };
  } catch (error) {
    const message = error?.message || "batch_failed";
    console.warn("Twitch batched status error:", message);
    return { streams: new Map(), error: message };
  }
}

/** Kick et YouTube restent sondés par chaîne (pas d'API groupée) : concurrence bornée. */
async function buildAllStatuses(streamers, twitchBatch, kickBatch = null) {
  const statuses = [];
  const CONCURRENCY = 3;
  for (let i = 0; i < streamers.length; i += CONCURRENCY) {
    const batch = streamers.slice(i, i + CONCURRENCY);
    statuses.push(...(await Promise.all(batch.map((streamer) => buildStreamerStatus(streamer, twitchBatch, kickBatch)))));
  }
  return statuses;
}

/** Transforme une alerte planifiée en envoi (ou en nom pour le rattrapage groupé). */
function dispatchAlert(alert, { streamer, status, next, preferences, queueAlert, catchUpLive }) {
  if (alert.type === "catchUp") {
    const platform = status.platform || streamer.platform || "twitch";
    catchUpLive.push(streamer.displayName || formatHandleForDisplay(platform, streamer.handle || streamer.twitch));
  } else if (alert.type === "live") {
    queueAlert(() => NotificationSystem.notifyLive(streamer, status.active, preferences));
  } else if (alert.type === "game") {
    queueAlert(() => NotificationSystem.notifyGameChange(streamer, alert.from, alert.to, preferences, next.platform));
  } else if (alert.type === "title") {
    queueAlert(() => NotificationSystem.notifyTitleChange(streamer, alert.from, alert.to, preferences, next.platform));
  }
}

/** Un streamer : état live suivant, fin de live, alertes planifiées. */
function processStatus(status, context) {
  const { streamer } = context;
  const previous = streamerLiveState.get(streamer.id) || EMPTY_LIVE_STATE;
  const now = Date.now();
  const next = nextLiveStateFrom(status, previous, streamer, now);

  // Fin de live : entrée d'historique (la VOD Twitch est cherchée ensuite).
  if (didStreamEnd(previous, next)) {
    HistoryStore.recordEnded(streamer, previous).catch((error) => console.warn("History record failed:", error?.message || error));
  }

  // Règles d'alerte du streamer : elles remplacent l'alerte classique.
  const smartDecision = next.isError
    ? null
    : decideSmartAlert(context.smartRules[streamer.id], status.active, previous.isLive ? previous.matchedRuleIds || [] : []);
  if (smartDecision) next.matchedRuleIds = smartDecision.matchedIds;

  logChangeDiagnostics(streamer, previous, next, context.preferences);
  const alerts = planStreamerAlerts({ streamer, previous, next, smartDecision, forceNotification: context.forceNotification, now });
  for (const alert of alerts) dispatchAlert(alert, { ...context, status, next });

  streamerStates.set(status.id, status);
  streamerLiveState.set(streamer.id, next);
}

/** Statuts (popup) et état live (déduplication des alertes) persistés séparément. */
async function persistPollState(statuses) {
  await DataStore.saveStatuses(Object.fromEntries(statuses.map((status) => [status.id, status])));
  try {
    await DataStore.saveLiveState(Object.fromEntries(streamerLiveState));
  } catch (err) {
    console.warn("Failed to persist live state:", err?.message || err);
  }
}

/** L'état est persisté : les alertes partent une à une. Un SW tué ici perd une alerte, jamais un doublon. */
async function sendQueuedAlerts(queuedAlerts) {
  for (const send of queuedAlerts) {
    try {
      await send();
    } catch (error) {
      console.warn("[SP] alerte non envoyée :", error?.message || error);
    }
  }
}

/** Rattrapage au démarrage : une seule notification récapitulative. */
async function notifyCatchUp(catchUpLive, preferences) {
  if (catchUpLive.length === 0) return;
  const lang = normalizeLanguage(preferences?.language);
  await NotificationCenter.show({
    title: translate(lang, "background.notifications.startupBatchTitle"),
    message: translate(lang, "background.notifications.startupBatchBody", { names: catchUpNames(catchUpLive) }),
    iconUrl: NotificationCenter.getDefaultIcon(),
    requireInteraction: false,
    priority: 1,
    playSound: preferences?.soundsEnabled !== false,
  });
}

async function _pollStreamersImpl({ forceNotification = false } = {}) {
  await ensureConfig(); // credentials avant tout appel Twitch (redémarrage du SW MV3)
  const streamers = await DataStore.getStreamers();
  const preferences = await PreferenceStore.get();
  if (streamers.length === 0) {
    // Ne pas effacer statuts ni état live : une lecture vide passagère ne doit
    // pas détruire la déduplication (chaque live renverrait son alerte).
    await ActionBadge.update(0, preferences);
    return [];
  }
  await restoreLiveState();
  const smartRules = await loadSmartRules();
  const streamerById = new Map(streamers.map((streamer) => [streamer.id, streamer]));
  streamers.forEach((streamer) => streamerCache.set(streamer.id, streamer));
  const kickStreamers = streamers.filter((s) => (s.platform || "twitch") === "kick");
  const kickBatch = kickStreamers.length
    ? await PlatformChecker.getKickStatusBatch(kickStreamers).catch(() => null)
    : null;
  const statuses = await buildAllStatuses(streamers, await probeTwitchBatch(streamers), kickBatch);

  // Heures calmes : aucune alerte (live, catégorie, titre, rattrapage). L'état
  // live reste persisté, donc aucune session annoncée ne repart en doublon.
  // Les envois partent APRÈS la persistance de l'état (voir sendQueuedAlerts).
  const quietNow = isWithinQuietHours(Date.now(), preferences);
  const queuedAlerts = [];
  const catchUpLive = [];
  const queueAlert = (send) => {
    if (!quietNow) queuedAlerts.push(send);
  };
  for (const status of statuses) {
    processStatus(status, { streamer: streamerById.get(status.id), preferences, smartRules, forceNotification, queueAlert, catchUpLive });
  }
  await persistPollState(statuses);
  await sendQueuedAlerts(queuedAlerts);
  if (!quietNow) await notifyCatchUp(catchUpLive, preferences);
  await ActionBadge.update(countLive(statuses), preferences);
  precacheThumbnails(statuses).catch((error) => console.warn("[SP] cache des vignettes :", error?.message || error));
  return statuses;
}

async function precacheThumbnails(statuses) {
  const CACHE_KEY = "streampulse:thumbCache";
  let cache = {};
  try {
    const stored = await chrome.storage.local.get(CACHE_KEY);
    cache = stored[CACHE_KEY] || {};
  } catch (error) {
    console.warn("[SP] lecture du cache des vignettes :", error?.message || error);
  }

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
    await chrome.storage.local.set({ [CACHE_KEY]: cache }).catch(warnWith("écriture du cache des vignettes"));
  }
}
