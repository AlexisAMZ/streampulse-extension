// Points de chaîne, Drops, badges et mode auto des badges.

import { createBadgeAuto } from "../badge-auto-worker.js";
import { BADGE_AUTO_KEY, CLAIM_OK_STATUSES, isPaidBadge } from "../drops-data.js";
import { createDropsClient } from "../drops-gql.js";
import { createDropsStore } from "../drops-store.js";
import { createPointsStore } from "../points-store.js";
import { ensureConfig, fetchTwitchJson, resolveTwitchChannels, twitchHeaders } from "./config.js";
import { DROPS_ALARM } from "./constants.js";
import { translateWithPrefs } from "./i18n.js";
import { lowPowerPlayer } from "./low-power-player.js";
import { NotificationCenter } from "./notifications.js";
import { EventLogStore, PreferenceStore, StatsStore } from "./stores.js";

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

/** Onglets Twitch, celui qui a parlé d'abord, puis l'onglet actif. */
async function twitchTabs(preferredId) {
  const tabs = await chrome.tabs.query({ url: "https://www.twitch.tv/*" });
  return tabs
    .filter((tab) => tab.id !== undefined && tab.discarded !== true)
    .sort((a, b) => Number(b.id === preferredId) - Number(a.id === preferredId) || Number(b.active) - Number(a.active));
}

const dropsClient = createDropsClient({ fetch: (...args) => fetch(...args), cookies: chrome.cookies });

const DROPS_ALARM_MINUTES = 10;
/** Un onglet Twitch qui vient de relire l'inventaire dispense le service worker de le faire. */
const DROPS_WORKER_MIN_GAP_MS = 4 * 60_000;

export function scheduleDropsAlarm() {
  chrome.alarms.get(DROPS_ALARM, (existing) => {
    if (!existing) chrome.alarms.create(DROPS_ALARM, { periodInMinutes: DROPS_ALARM_MINUTES, delayInMinutes: 1 });
  });
}

/**
 * Relit l'inventaire des Drops sans onglet Twitch ouvert (session lue dans le
 * cookie), puis récupère les Drops prêts si la récupération auto est active.
 * Utile quand on regarde sur un autre appareil, et pour un popup à jour.
 */
export async function refreshDropsFromWorker({ minGapMs = DROPS_WORKER_MIN_GAP_MS } = {}) {
  const prefs = await PreferenceStore.get();
  if (prefs.dropsTracking === false) return { read: false, reason: "disabled" };
  refreshRewardsFromWorker().catch((error) => {
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
  const autoClaim = prefs.autoClaimDrops !== false;
  const result = await dropsStore.recordInventory(inventory, { autoClaim });
  announceDrops(result.added).catch(() => {});
  for (const instanceId of result.claim) await claimDropFromWorker(instanceId, true);
  return { read: true };
}

const REWARDS_EVERY_MS = 30 * 60_000;

/** Campagnes de badges et récompenses, relues au plus toutes les 30 minutes. */
async function refreshRewardsFromWorker() {
  const stored = await chrome.storage.local.get(["streamPulseDropsRewards", "streamPulseDropsBadges", BADGE_AUTO_KEY]);
  const now = Date.now();
  // Deux délais séparés : une lecture réussie de l'un ne doit jamais bloquer l'autre.
  const warn = (what) => (error) => {
    if (error.code !== "signed-out") console.warn(`[StreamPulse] ${what} :`, error.code || error.message, error.detail || "");
  };
  if (now - (Number(stored.streamPulseDropsRewards?.updatedAt) || 0) >= REWARDS_EVERY_MS) {
    await dropsClient.readRewards().then((list) => dropsStore.recordRewards(list), warn("campagnes de badges"));
  }
  // En mode auto, les badges obtenus se relisent à chaque passage pour fermer l'onglet au plus vite.
  if (stored[BADGE_AUTO_KEY] || now - (Number(stored.streamPulseDropsBadges?.updatedAt) || 0) >= REWARDS_EVERY_MS) {
    await dropsClient.readBadges()
      .then((raw) => dropsStore.recordBadges(raw))
      .then(({ added }) => announceBadges(added), warn("badges globaux"));
  }
  await checkBadgeAuto();
}


/** Jeu du live d'une chaîne : "" hors ligne, null si Helix ne répond pas. */
export async function streamGameOf(login) {
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
  if (!prefs.dropAlerts) return;
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
  if (result.entry) announceDrops([result.entry]).catch(() => {});
  const claimed = ok && CLAIM_OK_STATUSES.includes(status);
  if (ok && !claimed) console.warn("[StreamPulse] récupération du Drop refusée :", status || "sans statut");
  // Récupéré mais absent de la progression locale : on relit pour remettre la liste à jour.
  if (claimed && !result.entry) refreshDropsFromWorker({ minGapMs: 0 }).catch(() => {});
  // Un Drop récupéré peut être le badge attendu : relecture immédiate en mode auto.
  if (claimed) checkBadgeAfterClaim();
  return claimed;
}

/**
 * Live où gagner une campagne : le stream le plus regardé du jeu (Helix), sinon
 * la catégorie filtrée sur les Drops. Les badges de « Twitch Gaming » se gagnent
 * sur n'importe quelle chaîne du jeu qui a les Drops activés.
 */
export async function dropsStreamUrl({ gameId, game }) {
  const directory = `https://www.twitch.tv/directory/game/${encodeURIComponent(game || "")}?filter=drops`;
  if (!/^\d{1,20}$/.test(String(gameId || ""))) return directory;
  try {
    await ensureConfig();
    const data = await fetchTwitchJson(`https://api.twitch.tv/helix/streams?game_id=${gameId}&type=live&first=20`, { headers: twitchHeaders() });
    // Un live avec le tag Drops fait progresser la campagne ; à défaut, le premier live du jeu.
    const live = (data?.data || []).filter((item) => item.user_login);
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
