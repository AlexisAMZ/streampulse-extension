// Suivi des Drops et récompenses Kick en arrière-plan (session_token, endpoints REST).
import { KICK_DROPS_KEY, kickDropsFrom, normalizeKickBoxed, normalizeKickCampaigns, normalizeKickChallenges, normalizeKickProgress } from "../kick-drops-data.js";
import { DROPS_HISTORY_KEY, historyFrom, pruneHistory } from "../drops-data.js";
import { NotificationCenter } from "./notifications.js";
import { PreferenceStore } from "./stores.js";
import { plusActiveFrom } from "../plus.js";

const KICK_PROGRESS_URL = "https://web.kick.com/api/v1/drops/progress";
const KICK_CHALLENGES_URL = "https://web.kick.com/api/v1/gamification/challenges";
const KICK_CAMPAIGNS_URL = "https://web.kick.com/api/v1/drops/campaigns";
const KICK_BOXED_URL = "https://web.kick.com/api/v1/rewards/boxed";
const KICK_UNBOX_URL = "https://web.kick.com/api/v1/rewards/mark-unboxed";
const KICK_USER_URL = "https://kick.com/api/v1/user";
const KICK_TIMEOUT_MS = 10_000;
const KICK_MIN_GAP_MS = 60_000;

export async function getKickSessionToken() {
  try {
    const cookie = await chrome.cookies.get({ url: "https://kick.com", name: "session_token" });
    return cookie?.value ? decodeURIComponent(cookie.value) : null;
  } catch (_) {
    return null;
  }
}

async function fetchKickApi(url, token, options = {}) {
  const headers = {
    Accept: "application/json",
    "x-app-platform": "web",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(url, {
    ...options,
    headers,
    signal: AbortSignal.timeout(KICK_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (response.status === 204) return null;
  return await response.json();
}

export async function unboxKickRewards(ids = []) {
  if (!ids.length) return { success: false, count: 0 };
  const token = await getKickSessionToken();
  if (!token) return { success: false, reason: "signed-out" };
  try {
    await fetchKickApi(KICK_UNBOX_URL, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const stored = await chrome.storage.local.get([KICK_DROPS_KEY, DROPS_HISTORY_KEY]);
    const state = kickDropsFrom(stored);
    const unboxedItems = state.boxed.filter((b) => ids.includes(b.id));
    const remainingBoxed = state.boxed.filter((b) => !ids.includes(b.id));
    const now = Date.now();

    const currentHistory = historyFrom(stored);
    const historyEntries = unboxedItems.map((item) => ({
      key: `kick_${item.id}`,
      at: now,
      name: item.label || "Récompense Kick",
      game: item.source || "Kick",
      image: item.thumbnail || "",
      platform: "kick",
    }));
    const nextHistory = pruneHistory([...currentHistory, ...historyEntries], now);

    await chrome.storage.local.set({
      [KICK_DROPS_KEY]: { ...state, boxed: remainingBoxed, updatedAt: now },
      [DROPS_HISTORY_KEY]: nextHistory,
    });
    return { success: true, count: ids.length, items: unboxedItems };
  } catch (error) {
    console.warn("[StreamPulse] déballage coffres Kick :", error?.message || error);
    return { success: false, error: error?.message || String(error) };
  }
}

export async function refreshKickDropsFromWorker({ force = false } = {}) {
  const token = await getKickSessionToken();
  const stored = await chrome.storage.local.get(KICK_DROPS_KEY);
  const prev = kickDropsFrom(stored);
  const now = Date.now();

  if (!token) {
    if (!prev.disconnected) {
      await chrome.storage.local.set({
        [KICK_DROPS_KEY]: { ...prev, disconnected: true, updatedAt: now },
      });
    }
    return { success: false, reason: "signed-out" };
  }

  if (!force && now - prev.updatedAt < KICK_MIN_GAP_MS) {
    return { success: true, cached: true };
  }

  try {
    const [progressRes, challengesRes, campaignsRes, boxedRes, userRes] = await Promise.allSettled([
      fetchKickApi(KICK_PROGRESS_URL, token),
      fetchKickApi(KICK_CHALLENGES_URL, token),
      fetchKickApi(KICK_CAMPAIGNS_URL, token),
      fetchKickApi(KICK_BOXED_URL, token),
      fetchKickApi(KICK_USER_URL, token),
    ]);

    const progress = progressRes.status === "fulfilled" ? normalizeKickProgress(progressRes.value?.data) : prev.progress;
    const challenges = challengesRes.status === "fulfilled" ? normalizeKickChallenges(challengesRes.value?.data) : prev.challenges;
    const campaigns = campaignsRes.status === "fulfilled" ? normalizeKickCampaigns(campaignsRes.value?.data) : prev.campaigns;
    const boxed = boxedRes.status === "fulfilled" ? normalizeKickBoxed(boxedRes.value) : prev.boxed;
    const user = userRes.status === "fulfilled" && userRes.value?.id ? { id: userRes.value.id, username: userRes.value.username } : prev.user;

    const nextState = {
      progress,
      challenges,
      campaigns,
      boxed,
      updatedAt: now,
      user,
      disconnected: false,
    };

    await chrome.storage.local.set({ [KICK_DROPS_KEY]: nextState });

    const prefs = await PreferenceStore.get();
    const plus = await plusActiveFrom(chrome.storage.local);

    const prevBoxedIds = new Set(prev.boxed.map((b) => b.id));
    const newlyBoxed = boxed.filter((b) => !prevBoxedIds.has(b.id));

    // Déballage auto : désactivé par défaut, requiert autoUnboxKickRewards explicite et licence Plus.
    if (boxed.length > 0 && prefs.autoUnboxKickRewards === true && plus) {
      const boxIds = boxed.map((b) => b.id);
      unboxKickRewards(boxIds).then((res) => {
        if (res.success) {
          NotificationCenter.show({
            title: "Coffre Kick débloqué !",
            message: `${boxIds.length} récompense(s) Kick récupérée(s) !`,
            url: "https://kick.com/drops/rewards",
          }).catch(() => {});
        }
      }).catch(() => {});
    } else if (newlyBoxed.length > 0 && prefs.dropAlerts !== false) {
      const count = newlyBoxed.length;
      NotificationCenter.show({
        title: "Coffre Kick à déballer !",
        message: count === 1
          ? `${newlyBoxed[0].label || "Une récompense Kick"} est prête à être déballée.`
          : `${count} coffres Kick sont prêts à être déballés.`,
        url: "https://kick.com/drops/rewards",
      }).catch(() => {});
    }

    const prevReadyIds = new Set([
      ...prev.progress.filter((p) => p.ready).map((p) => p.id),
      ...prev.challenges.filter((c) => c.ready).map((c) => c.id),
    ]);

    const newlyReady = [
      ...progress.filter((p) => p.ready && !prevReadyIds.has(p.id)),
      ...challenges.filter((c) => c.ready && !prevReadyIds.has(c.id)),
    ];

    if (newlyReady.length > 0 && prefs.dropAlerts !== false) {
      for (const item of newlyReady.slice(0, 2)) {
        await NotificationCenter.show({
          title: "Drop Kick disponible !",
          message: `${item.name} (${item.game}) est prêt à être réclamé.`,
          url: item.url || "https://kick.com/drops/campaigns",
        }).catch(() => {});
      }
    }

    return { success: true, count: progress.length + challenges.length };
  } catch (error) {
    console.warn("[StreamPulse] actualisation Kick Drops :", error?.message || error);
    return { success: false, error: error?.message || String(error) };
  }
}
