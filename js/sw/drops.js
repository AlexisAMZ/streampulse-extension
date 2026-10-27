// Points de chaîne, Drops, badges et mode auto des badges.

import { createBadgeAuto, watchProbe } from "../badge-auto-worker.js";
import { PLUS_KEY, isPlusActive } from "../plus.js";
import { BADGE_ADDED_KEY, BADGE_AUTO_KEY, BADGE_EVENTS_KEY, CLAIM_OK_STATUSES, DROPS_BADGES_KEY, DROPS_CAMPAIGNS_KEY, campaignsFrom } from "../drops-data.js";
import { addedFrom, badgesFrom, catalogBadges, eventsFrom, isPaidBadge } from "../badges-data.js";
import { BADGE_ALERT_SEEN_KEY, BADGE_LIMITED_KEY, BADGE_WATCH_KEY, LIMITED_EVENT_MS, SHORT_EVENT_MS, formatTimeLeft, isShortEvent, limitedFrom, planBadgeAlerts, seenFrom as alertsSeenFrom, watchFrom } from "../badge-watch.js";
import { DROP_ALERTS_KEY, DROP_ALERTS_SEEN_KEY, campaignAlerts, normalizeDropAlerts, seenFrom } from "../drop-alerts.js";
import { createDropsClient } from "../drops-gql.js";
import { createDropsStore } from "../drops-store.js";
import { createPointsStore } from "../points-store.js";
import { recordPlusValue } from "./plus-value.js";
import { ensureConfig, fetchTwitchJson, resolveTwitchChannels, twitchHeaders } from "./config.js";
import { DROPS_ALARM } from "./constants.js";
import { translateWithPrefs } from "./i18n.js";
import { lowPowerPlayer } from "./low-power-player.js";
import { NotificationCenter } from "./notifications.js";
import { EventLogStore, PreferenceStore, StatsStore } from "./stores.js";
import { warnWith } from "./log.js";

export const pointsStore = createPointsStore({ storage: chrome.storage.local, resolveChannels: resolveTwitchChannels });

// ─── Suivi des Drops ──────────────────────────────────────────────────────────
// dropsRecorder.js relaie l'inventaire, les événements et les campagnes lus
// dans la page Twitch ; drops-store.js est le seul à les écrire. Les requêtes
// vers Twitch partent toujours de la page : ici, on ne fait que ranger,
// prévenir, et confier les récupérations à un onglet Twitch.

export const dropsStore = createDropsStore({ storage: chrome.storage.local, resolveChannels: resolveTwitchChannels });
/** Un Drop gagné hors de la vue (lecture tardive) ne déclenche pas d'alerte. */
const DROP_ALERT_MAX_AGE_MS = 60 * 60_000;
const DROP_ALERTS_PER_READ = 3;
/** Le popup ouvert ne relance pas une lecture plus récente que ce délai. */
export const DROPS_POPUP_REFRESH_MS = 2 * 60_000;

/** Journal d'événements, compteur et alerte pour chaque Drop obtenu. */
export async function announceDrops(entries) {
  if (!entries?.length) return;
  const prefs = await PreferenceStore.get();
  const now = Date.now();
  let alerts = 0;
  // Compteur de valeur : seuls les Drops pris par la récupération auto (Plus).
  const autoDrops = entries.filter((entry) => entry?.auto).length;
  if (autoDrops) {
    const plus = isPlusActive((await chrome.storage.local.get(PLUS_KEY))[PLUS_KEY]);
    if (plus) recordPlusValue({ drops: autoDrops }).catch(() => {});
  }
  for (const entry of entries) {
    const label = [entry.name, entry.game].filter(Boolean).join(" · ");
    await StatsStore.increment("dropsClaimed", 1);
    await EventLogStore.addLog({ type: "drop", channel: entry.channel || "", text: label || translateWithPrefs(prefs, "background.notifications.dropMessage"), value: 1 });
    if (!prefs.dropAlerts || now - entry.at > DROP_ALERT_MAX_AGE_MS || alerts >= DROP_ALERTS_PER_READ) continue;
    alerts += 1;
    await NotificationCenter.show({
      title: translateWithPrefs(prefs, "background.notifications.dropTitle"),
      message: label
        ? translateWithPrefs(prefs, "background.notifications.dropClaimedMessage", { reward: label })
        : translateWithPrefs(prefs, "background.notifications.dropMessage"),
    });
  }
}

/**
 * StreamPulse+ : un badge frais apparaît au catalogue → il part au farm tout
 * seul, sans ouvrir l'extension (et sans rater une campagne à durée limitée).
 * Sans file, « tous les badges possibles » démarre et rattrape tout ; avec une
 * file, les nouveaux s'y ajoutent. Coupé par le réglage, et sans effet hors Plus.
 */
export async function farmNewBadgesForPlus(added = []) {
  const prefs = await PreferenceStore.get();
  if (prefs.dropsTracking === false || prefs.autoFarmNewBadges === false) return false;
  if (!isPlusActive((await chrome.storage.local.get(PLUS_KEY))[PLUS_KEY])) return false;
  const ids = (added || []).map((item) => item?.id).filter(Boolean);
  if (!ids.length) return false;
  const result = await badgeAuto.autoFarm(ids).catch((error) => {
    console.warn("[StreamPulse] farm des nouveaux badges :", error?.message || error);
    return null;
  });
  if (!result?.started) return false;
  await NotificationCenter.show({
    title: translateWithPrefs(prefs, "background.badgeAuto.autoFarmTitle"),
    message: translateWithPrefs(prefs, "background.badgeAuto.autoFarmMessage", { count: result.count }),
  });
  return true;
}

// ─── Alertes de campagnes Drops (StreamPulse+) ────────────────────────────────

/** Au plus trois alertes d'un coup : une liste relue après une longue pause ne doit pas inonder. */
const CAMPAIGN_ALERTS_PER_READ = 3;

/**
 * Compare les campagnes relues par les onglets Twitch aux jeux suivis
 * (js/drop-alerts.js) et prévient quand une campagne démarre. Appelé à chaque
 * liste enregistrée, donc aussi quand un onglet revient sur Twitch ; les
 * campagnes déjà signalées ne le sont jamais deux fois.
 */
export async function checkDropCampaignAlerts() {
  const stored = await chrome.storage.local.get([PLUS_KEY, DROP_ALERTS_KEY, DROP_ALERTS_SEEN_KEY, DROPS_CAMPAIGNS_KEY]);
  const settings = normalizeDropAlerts(stored[DROP_ALERTS_KEY]);
  if (!settings.enabled || !settings.games.length) return;
  if (!isPlusActive(stored[PLUS_KEY])) return;
  const { alerts, seen } = campaignAlerts(campaignsFrom(stored).campaigns, settings, seenFrom(stored[DROP_ALERTS_SEEN_KEY]), Date.now());
  await chrome.storage.local.set({ [DROP_ALERTS_SEEN_KEY]: seen });
  if (!alerts.length) return;
  const prefs = await PreferenceStore.get();
  for (const campaign of alerts.slice(0, CAMPAIGN_ALERTS_PER_READ)) {
    await NotificationCenter.show({
      title: translateWithPrefs(prefs, "background.dropAlerts.title", { game: campaign.game }),
      message: campaign.name || translateWithPrefs(prefs, "background.dropAlerts.message", { game: campaign.game }),
      url: `https://www.twitch.tv/directory/game/${encodeURIComponent(campaign.game)}?filter=drops`,
    });
  }
}

/** Onglets Twitch, celui qui a parlé d'abord, puis l'onglet actif. */
async function twitchTabs(preferredId) {
  const tabs = await chrome.tabs.query({ url: "https://www.twitch.tv/*" });
  return tabs
    .filter((tab) => tab.id !== undefined && tab.discarded !== true)
    .sort((a, b) => Number(b.id === preferredId) - Number(a.id === preferredId) || Number(b.active) - Number(a.active));
}

const dropsClient = createDropsClient({ fetch: (...args) => fetch(...args), cookies: chrome.cookies });

/** 5 min : un événement de badge de 30 minutes ne doit pas passer entre deux lectures. */
const DROPS_ALARM_MINUTES = 5;
/** Un onglet Twitch qui vient de relire l'inventaire dispense le service worker de le faire. */
const DROPS_WORKER_MIN_GAP_MS = 4 * 60_000;

export function scheduleDropsAlarm() {
  chrome.alarms.get(DROPS_ALARM, (existing) => {
    // Une alarme créée avec l'ancienne période (10 min) est recréée.
    if (!existing || existing.periodInMinutes !== DROPS_ALARM_MINUTES) chrome.alarms.create(DROPS_ALARM, { periodInMinutes: DROPS_ALARM_MINUTES, delayInMinutes: 1 });
  });
}

/**
 * Relit l'inventaire des Drops sans onglet Twitch ouvert (session lue dans le
 * cookie), puis récupère les Drops prêts si la récupération auto est active.
 * Utile quand on regarde sur un autre appareil, et pour un popup à jour.
 * `rewardsMaxAgeMs` resserre la fenêtre de relecture des badges et récompenses
 * (le popup la raccourcit, sinon sa liste ne suit qu'à l'alarme des 30 min).
 */
export async function refreshDropsFromWorker({ minGapMs = DROPS_WORKER_MIN_GAP_MS, rewardsMaxAgeMs = REWARDS_EVERY_MS } = {}) {
  const prefs = await PreferenceStore.get();
  if (prefs.dropsTracking === false) return { read: false, reason: "disabled" };
  refreshRewardsFromWorker({ maxAgeMs: rewardsMaxAgeMs }).catch((error) => {
    if (error.code !== "signed-out") console.warn("[StreamPulse] badges :", error.code || error.message);
  });
  const stored = await chrome.storage.local.get("streamPulseDropsProgress");
  if (Date.now() - (Number(stored.streamPulseDropsProgress?.updatedAt) || 0) < minGapMs) return { read: false, reason: "fresh" };
  let inventory;
  try {
    inventory = await dropsClient.readInventory();
  } catch (error) {
    // Déconnecté de Twitch : rien à lire, ce n'est pas une panne.
    if (error.code !== "signed-out") console.warn("[StreamPulse] lecture des Drops impossible :", error.code || error.message, error.detail || "");
    return { read: false, reason: error.code || "error" };
  }
  // Récupération auto des Drops : réservée à StreamPulse+.
  const plus = isPlusActive((await chrome.storage.local.get(PLUS_KEY))[PLUS_KEY]);
  const autoClaim = plus && prefs.autoClaimDrops !== false;
  const result = await dropsStore.recordInventory(inventory, { autoClaim });
  announceDrops(result.added).catch(warnWith("annonce des Drops"));
  for (const instanceId of result.claim) await claimDropFromWorker(instanceId, true);
  return { read: true };
}

const REWARDS_EVERY_MS = 30 * 60_000;
/** Le catalogue des badges est relu plus souvent que les campagnes : un nouveau badge est le premier signe d'un événement court. */
const BADGES_EVERY_MS = 5 * 60_000;

/** Dates d'ajout des badges notées par streampulse.tech (le CDN garde la réponse 10 min). */
const BADGE_ADDED_URL = "https://streampulse.tech/api/twitch-badges?added=1";
const BADGE_ADDED_EVERY_MS = 6 * 3_600_000;
/** Après un échec, le site n'est pas redemandé avant ce délai. */
const BADGE_ADDED_RETRY_MS = 30 * 60_000;
const BADGE_ADDED_TIMEOUT_MS = 10_000;
let badgeAddedRetryAt = 0;

async function loadBadgeAdded(force) {
  const { fetchedAt } = addedFrom(await chrome.storage.local.get(BADGE_ADDED_KEY));
  if (!force && Date.now() - fetchedAt < BADGE_ADDED_EVERY_MS) return;
  const response = await fetch(BADGE_ADDED_URL, { signal: AbortSignal.timeout(BADGE_ADDED_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  const result = await dropsStore.recordBadgeAdded(json?.added);
  if (!result.recorded) throw new Error("réponse illisible");
}

/** Relues toutes les 6 h, ou tout de suite quand un badge vient d'apparaître ; 30 min de pause après un échec. */
function refreshBadgeAdded({ force = false } = {}) {
  if (Date.now() < badgeAddedRetryAt) return Promise.resolve();
  return loadBadgeAdded(force).catch((error) => {
    badgeAddedRetryAt = Date.now() + BADGE_ADDED_RETRY_MS;
    throw error;
  });
}

/**
 * Campagnes de badges et récompenses, relues au plus toutes les 30 minutes.
 * `maxAgeMs` raccourcit la fenêtre (popup ouvert) : c'est le seul moyen pour
 * l'utilisateur de voir la liste à jour sans attendre la prochaine alarme.
 */
async function refreshRewardsFromWorker({ maxAgeMs = REWARDS_EVERY_MS } = {}) {
  const stored = await chrome.storage.local.get(["streamPulseDropsRewards", "streamPulseDropsBadges", BADGE_AUTO_KEY]);
  const now = Date.now();
  // Deux délais séparés : une lecture réussie de l'un ne doit jamais bloquer l'autre.
  const warn = (what) => (error) => {
    if (error.code !== "signed-out") console.warn(`[StreamPulse] ${what} :`, error.code || error.message, error.detail || "");
  };
  if (now - (Number(stored.streamPulseDropsRewards?.updatedAt) || 0) >= maxAgeMs) {
    await dropsClient.readRewards().then((list) => dropsStore.recordRewards(list), warn("campagnes de badges"));
  }
  // En mode auto, les badges obtenus se relisent à chaque passage pour fermer l'onglet au plus vite.
  let freshBadge = false;
  if (stored[BADGE_AUTO_KEY] || now - (Number(stored.streamPulseDropsBadges?.updatedAt) || 0) >= Math.min(maxAgeMs, BADGES_EVERY_MS)) {
    const result = await dropsClient.readBadges().then((raw) => dropsStore.recordBadges(raw)).catch(warn("badges globaux"));
    if (result) {
      freshBadge = result.added.length > 0;
      announceBadges(result.added).catch(warnWith("annonce des badges"));
      // StreamPulse+ : les nouveaux badges partent directement au farm.
      farmNewBadgesForPlus(result.added).catch(warnWith("farm des nouveaux badges"));
    }
  }
  await checkBadgeAuto();
  await checkBadgeWatch().catch(warnWith("alertes des badges limités"));
  // Après le mode auto, qui doit fermer son onglet au plus vite : le site peut être lent.
  await refreshBadgeAdded({ force: freshBadge }).catch(warnWith("dates d'ajout des badges"));
}


/** Textes des alertes : événement court, badge suivi qui démarre, dernière chance. */
const BADGE_ALERT_KEYS = Object.freeze({
  short: ["background.notifications.badgeShortTitle", "background.notifications.badgeShortMessage"],
  live: ["background.notifications.badgeLiveTitle", "background.notifications.badgeLiveMessage"],
  last: ["background.notifications.badgeLastTitle", "background.notifications.badgeLastMessage"],
});

/**
 * Alertes des badges à durée limitée : événements courts (si les alertes de
 * badges sont actives) et badges suivis avec la cloche. Appelé après chaque
 * lecture du catalogue ; chaque alerte part une seule fois.
 */
export async function checkBadgeWatch() {
  const stored = await chrome.storage.local.get([DROPS_BADGES_KEY, BADGE_EVENTS_KEY, BADGE_ADDED_KEY, BADGE_WATCH_KEY, BADGE_ALERT_SEEN_KEY, BADGE_LIMITED_KEY, PLUS_KEY]);
  const prefs = await PreferenceStore.get();
  const now = Date.now();
  const watch = watchFrom(stored);
  const badges = catalogBadges(badgesFrom(stored), { status: "live", now, events: eventsFrom(stored).events, added: addedFrom(stored).added });
  // StreamPulse+ avec l'option : tout badge d'une journée ou moins prévient ; sinon, les événements de 2 h ou moins si les alertes de badges sont actives.
  const shortMs = isPlusActive(stored[PLUS_KEY]) && limitedFrom(stored) ? LIMITED_EVENT_MS : prefs.badgeAlerts === true ? SHORT_EVENT_MS : 0;
  const { alerts, seen } = planBadgeAlerts({ badges, watch, seen: alertsSeenFrom(stored), shortMs, now, baseline: stored[BADGE_ALERT_SEEN_KEY] === undefined });
  // Un badge suivi dont plus rien ne se joue (obtenu, terminé) quitte la liste.
  const live = new Set(badges.map((badge) => badge.id));
  const all = catalogBadges(badgesFrom(stored), { now, events: eventsFrom(stored).events, added: addedFrom(stored).added });
  const finished = new Set(all.filter((badge) => badge.owned || badge.status === "ended").map((badge) => badge.id));
  const kept = Object.fromEntries(Object.entries(watch).filter(([id]) => live.has(id) || !finished.has(id)));
  const changedWatch = Object.keys(kept).length !== Object.keys(watch).length;
  const changedSeen = stored[BADGE_ALERT_SEEN_KEY] === undefined || alerts.length > 0 || Object.keys(seen).length !== Object.keys(alertsSeenFrom(stored)).length;
  if (changedSeen || changedWatch) await chrome.storage.local.set({ [BADGE_ALERT_SEEN_KEY]: seen, ...(changedWatch ? { [BADGE_WATCH_KEY]: kept } : {}) });
  for (const { badge, kind, endsAt } of alerts) {
    const time = endsAt > 0 ? formatTimeLeft(endsAt - now) : "";
    const short = isShortEvent(badge.event, LIMITED_EVENT_MS);
    const [titleKey, messageKey] = BADGE_ALERT_KEYS[kind === "ending" ? "last" : short ? "short" : "live"];
    const game = badge.event?.game;
    await NotificationCenter.show({
      title: translateWithPrefs(prefs, titleKey, { name: badge.title }),
      message: translateWithPrefs(prefs, messageKey, { name: badge.title, time }),
      url: game ? `https://www.twitch.tv/directory/game/${encodeURIComponent(game)}?filter=drops` : undefined,
    });
  }
}

/**
 * Jeu du live d'une chaîne : "" hors ligne, null si inconnu. Lu en direct par
 * la session Twitch (une chaîne qui change de jeu se voit tout de suite), Helix
 * à défaut (déconnecté de Twitch).
 */
export async function streamGameOf(login) {
  try {
    return await dropsClient.liveGameOf(login);
  } catch (_) {
    // Pas de session Twitch ou GQL indisponible : Helix, parfois en retard.
  }
  try {
    await ensureConfig();
    const data = await fetchTwitchJson(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}&type=live`, { headers: twitchHeaders() });
    return String(data?.data?.[0]?.game_id || "");
  } catch (error) {
    console.warn("[StreamPulse] mode auto badges :", error?.message || error);
    return null;
  }
}

export const badgeAuto = createBadgeAuto({
  streamUrl: dropsStreamUrl,
  streamGameOf,
  lowPowerPlayer,
  // 160p en économie de bande passante (réglage Plus), 360p sinon.
  videoHeight: async () => ((await PreferenceStore.get()).badgeFarmLowQuality ? 160 : 360),
  // Sonde de lecture de l'onglet (vigie) et signal « l'utilisateur regarde
  // ailleurs », tous deux tolérants aux échecs.
  probeTab: async (tabId) => {
    const [frame] = await chrome.scripting.executeScript({ target: { tabId }, func: watchProbe }).catch(() => []);
    return frame?.result ?? null;
  },
  audibleElsewhere: async (tabId) => {
    try {
      const tabs = await chrome.tabs.query({ url: "https://www.twitch.tv/*", audible: true });
      return tabs.some((tab) => tab.id !== tabId);
    } catch (_) {
      return false;
    }
  },
  translate: async (key, params) => translateWithPrefs(await PreferenceStore.get(), key, params),
  notify: async (titleKey, messageKey, params = {}) => {
    const prefs = await PreferenceStore.get();
    await NotificationCenter.show({ title: translateWithPrefs(prefs, titleKey), message: translateWithPrefs(prefs, messageKey, params) });
  },
  // Les Drops du live doivent être suivis pour que la récupération auto passe.
  onStart: () => scheduleDropsAlarm(),
});

function checkBadgeAuto() {
  return badgeAuto.check();
}

export function checkBadgeAfterClaim() {
  badgeAuto.isActive()
    .then((active) => (active ? refreshRewardsFromWorker() : null))
    .catch((error) => console.warn("[StreamPulse] mode auto badges :", error?.code || error?.message || error));
}



/** Alerte pour les nouveaux badges gratuits (3 au plus d'un coup). */
async function announceBadges(badges) {
  const free = badges.filter((badge) => !isPaidBadge(badge)).slice(0, 3);
  if (!free.length) return;
  const prefs = await PreferenceStore.get();
  if (!prefs.badgeAlerts) return;
  for (const badge of free) {
    await NotificationCenter.show({
      title: translateWithPrefs(prefs, "background.notifications.badgeTitle", { name: badge.title }),
      message: badge.description || badge.title,
    });
  }
}

export async function claimDropFromWorker(instanceId, auto) {
  let status = "";
  let ok = false;
  try {
    ({ status } = await dropsClient.claim(instanceId));
    ok = true;
  } catch (error) {
    console.warn("[StreamPulse] récupération du Drop impossible :", error.code || error.message);
  }
  const result = await dropsStore.recordClaim({ instanceId, ok, status, auto });
  if (result.entry) announceDrops([result.entry]).catch(warnWith("annonce du Drop récupéré"));
  const claimed = ok && CLAIM_OK_STATUSES.includes(status);
  if (ok && !claimed) console.warn("[StreamPulse] récupération du Drop refusée :", status || "sans statut");
  // Récupéré mais absent de la progression locale : on relit pour remettre la liste à jour.
  if (claimed && !result.entry) refreshDropsFromWorker({ minGapMs: 0 }).catch(warnWith("relecture des Drops"));
  // Un Drop récupéré peut être le badge attendu : relecture immédiate en mode auto.
  if (claimed) checkBadgeAfterClaim();
  return claimed;
}

/**
 * Live où gagner une campagne : le stream le plus regardé du jeu (Helix), sinon
 * la catégorie filtrée sur les Drops. Les badges de « Twitch Gaming » se gagnent
 * sur n'importe quelle chaîne du jeu qui a les Drops activés.
 */
/** Chaîne StreamPulse 24/7 (badges et Drops), voir js/popup-drops.js. */
const OFFICIAL_LOGIN = "streampulse247";
const isOfficialLive = (item) => String(item.user_login).toLowerCase() === OFFICIAL_LOGIN;

/** Vrai si la chaîne 24/7 diffuse ce jeu en ce moment ; faux si on ne peut pas le vérifier. */
async function officialOnGame(gameId) {
  try {
    return (await dropsClient.liveGameOf(OFFICIAL_LOGIN)) === String(gameId);
  } catch (_) {
    return false;
  }
}

export async function dropsStreamUrl({ gameId, game }) {
  const directory = `https://www.twitch.tv/directory/game/${encodeURIComponent(game || "")}?filter=drops`;
  try {
    await ensureConfig();
    if (!/^\d{1,20}$/.test(String(gameId || ""))) return directory;
    const data = await fetchTwitchJson(`https://api.twitch.tv/helix/streams?game_id=${gameId}&type=live&first=20`, { headers: twitchHeaders() });
    // Un live avec le tag Drops fait progresser la campagne ; à défaut, le premier live du jeu.
    let live = (data?.data || []).filter((item) => item.user_login);
    // La chaîne 24/7 change souvent de jeu et Helix la garde dans l'ancien
    // plusieurs minutes : elle n'est choisie que si elle est vraiment sur ce jeu.
    if (live.some(isOfficialLive) && !(await officialOnGame(gameId))) live = live.filter((item) => !isOfficialLive(item));
    const stream = live.find((item) => (item.tags || []).some((tag) => /drops/i.test(String(tag)))) || live[0];
    return stream ? `https://www.twitch.tv/${encodeURIComponent(stream.user_login)}` : directory;
  } catch (error) {
    console.warn("[StreamPulse] recherche d'un live pour la campagne :", error?.message || error);
    return directory;
  }
}

/** Confie une commande au premier onglet Twitch qui a le relais des Drops. */
export async function sendDropsCommand(command, preferredId) {
  for (const tab of await twitchTabs(preferredId)) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: "dropsCommand", ...command });
      if (response?.ok) return true;
    } catch (_) {
      // Onglet ouvert avant l'installation : pas de relais, on essaie le suivant.
    }
  }
  return false;
}
