// Écrivain unique du suivi des Drops, côté service worker. Tout ce que
// dropsRecorder.js relaie (inventaire, événements temps réel, campagnes,
// résultats de récupération) passe par une file : deux lectures simultanées
// ne peuvent pas s'écraser. Les calculs vivent dans drops-data.js et badges-data.js.

import {
  BADGE_ADDED_KEY,
  BADGE_EVENTS_KEY,
  CLAIM_OK_STATUSES,
  DROPS_CAMPAIGNS_KEY,
  DROPS_HISTORY_KEY,
  DROPS_KEYS,
  DROPS_PROGRESS_KEY,
  DROPS_REWARDS_KEY,
  DROPS_BADGES_KEY,
  DROPS_SINCE_KEY,
  applyCampaignDetails,
  applyClaim,
  applyEvent,
  applyInventory,
  campaignsFrom,
  DETAILS_PER_READ,
  campaignsNeedingDetails,
  historyFrom,
  isClaimable,
  isPlainObject,
  mergeCampaigns,
  normalizeCampaigns,
  normalizeInventory,
  normalizeRewards,
  progressFrom,
  pruneHistory,
  rewardsFrom,
} from "./drops-data.js";
import {
  addedFrom,
  badgesFrom,
  mergeBadges,
  buildBadgeEvents,
  eventsFrom,
  normalizeAdded,
} from "./badges-data.js";

/** Un Drop réservé à un onglet n'est pas redemandé à un autre avant ce délai. */
const CLAIM_LOCK_MS = 2 * 60_000;
/** Un Drop inconnu relance la lecture de l'inventaire, au plus une fois par période. */
const UNKNOWN_REFRESH_MS = 2 * 60_000;
const RESOLVE_BATCH = 100;
/** Un détail demandé n'est pas redemandé avant ce délai (plusieurs onglets Twitch lisent la liste). */
const DETAIL_REQUEST_MS = 2 * 60_000;

/**
 * @param {{
 *   storage: { get(keys: string[]): Promise<object>, set(values: object): Promise<void>, remove(keys: string[]): Promise<void> },
 *   resolveChannels?: (ids: string[]) => Promise<Array<{ id: string, displayName: string }>>,
 *   now?: () => number,
 *   log?: { warn: (...args: unknown[]) => void },
 * }} deps
 */
export function createDropsStore({ storage, resolveChannels = async () => [], now = () => Date.now(), log = console }) {
  let queue = Promise.resolve();
  const claimLocks = new Map();
  let unknownRefreshAt = 0;
  const detailRequests = new Map();

  /** Prochaines campagnes à détailler, sans celles demandées il y a moins de 2 min. */
  function nextDetails(campaigns, clock) {
    for (const [id, at] of detailRequests) if (clock - at >= DETAIL_REQUEST_MS) detailRequests.delete(id);
    const ids = campaignsNeedingDetails(campaigns, clock, Number.POSITIVE_INFINITY).filter((id) => !detailRequests.has(id)).slice(0, DETAILS_PER_READ);
    ids.forEach((id) => detailRequests.set(id, clock));
    return ids;
  }

  function enqueue(task) {
    const run = queue.then(task, task);
    // L'échec reste porté par `run`, rendu à l'appelant : la file, elle, continue.
    queue = run.catch(() => {});
    return run;
  }

  async function read() {
    const stored = await storage.get(DROPS_KEYS);
    return {
      progress: progressFrom(stored),
      history: historyFrom(stored),
      since: Number(stored[DROPS_SINCE_KEY]) || 0,
    };
  }

  /** Réserve les récupérations pour l'onglet qui demande ; renvoie celles qui lui reviennent. */
  function lock(instanceIds, clock) {
    for (const [id, expires] of claimLocks) if (expires <= clock) claimLocks.delete(id);
    const granted = [...new Set(instanceIds)].filter((id) => id && !claimLocks.has(id));
    granted.forEach((id) => claimLocks.set(id, clock + CLAIM_LOCK_MS));
    return granted;
  }

  /** Relie de nouveau badges et campagnes après toute lecture qui les touche. */
  async function relinkBadges(clock) {
    const stored = await storage.get([DROPS_CAMPAIGNS_KEY, DROPS_REWARDS_KEY, DROPS_BADGES_KEY, BADGE_EVENTS_KEY]);
    const catalog = badgesFrom(stored).badges;
    if (!catalog.length) return;
    const events = buildBadgeEvents({
      campaigns: campaignsFrom(stored).campaigns,
      rewards: rewardsFrom(stored).rewards,
      catalog,
      previous: eventsFrom(stored).events,
      now: clock,
    });
    await storage.set({ [BADGE_EVENTS_KEY]: { updatedAt: clock, events } });
  }

  function recordInventory(raw, { autoClaim = false } = {}) {
    return enqueue(async () => {
      const clock = now();
      const inventory = normalizeInventory(raw, clock);
      if (!inventory) return { recorded: false, reason: "invalid", added: [], claim: [] };
      const state = await read();
      const since = state.since || clock;
      const result = applyInventory(state.progress, state.history, inventory, clock, since);
      await storage.set({
        [DROPS_PROGRESS_KEY]: result.progress,
        ...(result.added.length ? { [DROPS_HISTORY_KEY]: pruneHistory(result.history, clock) } : {}),
        ...(state.since ? {} : { [DROPS_SINCE_KEY]: since }),
      });
      const ready = result.progress.drops.filter(isClaimable).map((drop) => drop.instanceId);
      return { recorded: true, added: result.added, claim: autoClaim ? lock(ready, clock) : [] };
    });
  }

  function recordEvent(event, { autoClaim = false } = {}) {
    return enqueue(async () => {
      const clock = now();
      const state = await read();
      const result = applyEvent(state.progress, event, clock);
      if (!result) return { recorded: false, refresh: false, claim: [] };
      await storage.set({ [DROPS_PROGRESS_KEY]: result.progress });
      let refresh = false;
      if (!result.known && clock - unknownRefreshAt >= UNKNOWN_REFRESH_MS) {
        unknownRefreshAt = clock;
        refresh = true;
      }
      // Un Drop inconnu n'est pas récupéré tout de suite : la relecture de
      // l'inventaire donnera son nom, puis le proposera à la récupération.
      const claim = autoClaim && result.known && result.instanceId ? lock([result.instanceId], clock) : [];
      return { recorded: true, refresh, claim, channelId: result.channelId };
    });
  }

  function recordCampaigns(rawList, source) {
    return enqueue(async () => {
      const clock = now();
      const incoming = normalizeCampaigns(rawList);
      if (!incoming.length) return { recorded: false, details: [] };
      const previous = campaignsFrom(await storage.get([DROPS_CAMPAIGNS_KEY])).campaigns;
      const campaigns = mergeCampaigns(previous, incoming, clock);
      await storage.set({ [DROPS_CAMPAIGNS_KEY]: { updatedAt: clock, source: String(source || ""), campaigns } });
      await relinkBadges(clock);
      return { recorded: true, count: campaigns.length, details: nextDetails(campaigns, clock) };
    });
  }

  /** Détail des campagnes demandé par le relais ; renvoie les suivantes à lire. */
  function recordCampaignDetails(rawList, ids) {
    return enqueue(async () => {
      const clock = now();
      const stored = campaignsFrom(await storage.get([DROPS_CAMPAIGNS_KEY]));
      const asked = (Array.isArray(ids) ? ids : []).map(String).filter(Boolean);
      if (!stored.campaigns.length || !asked.length) return { recorded: false, details: [] };
      const campaigns = applyCampaignDetails(stored.campaigns, rawList, asked, clock);
      await storage.set({ [DROPS_CAMPAIGNS_KEY]: { ...stored, campaigns } });
      await relinkBadges(clock);
      return { recorded: true, details: nextDetails(campaigns, clock) };
    });
  }

  function recordRewards(rawList) {
    return enqueue(async () => {
      const clock = now();
      const rewards = normalizeRewards(rawList);
      await storage.set({ [DROPS_REWARDS_KEY]: { updatedAt: clock, rewards } });
      await relinkBadges(clock);
      return { recorded: true, count: rewards.length };
    });
  }

  function recordBadges(raw) {
    return enqueue(async () => {
      const clock = now();
      const result = mergeBadges(badgesFrom(await storage.get([DROPS_BADGES_KEY])), raw, clock);
      if (result.state.updatedAt) await storage.set({ [DROPS_BADGES_KEY]: result.state });
      await relinkBadges(clock);
      return { added: result.added };
    });
  }

  /** Dates d'ajout des badges notées par streampulse.fr. */
  function recordBadgeAdded(raw) {
    return enqueue(async () => {
      if (!isPlainObject(raw)) return { recorded: false, count: 0 };
      let added = normalizeAdded(raw);
      // Une réponse vide ne fait pas oublier les dates déjà connues.
      if (!Object.keys(added).length) added = addedFrom(await storage.get([BADGE_ADDED_KEY])).added;
      await storage.set({ [BADGE_ADDED_KEY]: { fetchedAt: now(), added } });
      return { recorded: true, count: Object.keys(added).length };
    });
  }

  /** Relie de nouveau sans lecture : après une mise à jour, le journal vient des données déjà gardées. */
  function relink() {
    return enqueue(() => relinkBadges(now()));
  }

  /** Résultat de `claimDropRewards` renvoyé par la page Twitch. */
  function recordClaim({ instanceId, ok, status, auto = true }) {
    return enqueue(async () => {
      claimLocks.delete(instanceId);
      const success = ok === true && CLAIM_OK_STATUSES.includes(status);
      if (!instanceId || !success) return { recorded: false, entry: null };
      const clock = now();
      const state = await read();
      const result = applyClaim(state.progress, state.history, instanceId, clock, auto);
      await storage.set({
        [DROPS_PROGRESS_KEY]: result.progress,
        ...(result.entry ? { [DROPS_HISTORY_KEY]: pruneHistory(result.history, clock) } : {}),
      });
      return { recorded: Boolean(result.entry), entry: result.entry };
    });
  }

  /** Nomme les chaînes vues dans les événements, par un appel Helix groupé. */
  function resolveNames() {
    return enqueue(async () => {
      const { progress } = await read();
      const missing = [...new Set(progress.drops.map((drop) => drop.channelId).filter((id) => id && !progress.channels[id]))].slice(0, RESOLVE_BATCH);
      if (!missing.length) return 0;
      let users;
      try {
        users = await resolveChannels(missing);
      } catch (error) {
        log.warn("[StreamPulse] noms des chaînes des Drops indisponibles", error);
        return 0;
      }
      const channels = { ...progress.channels };
      let named = 0;
      for (const user of Array.isArray(users) ? users : []) {
        const id = String(user?.id || "");
        if (!missing.includes(id) || !user.displayName) continue;
        channels[id] = String(user.displayName);
        named += 1;
      }
      if (named) await storage.set({ [DROPS_PROGRESS_KEY]: { ...progress, channels } });
      return named;
    });
  }

  async function readCampaigns() {
    return campaignsFrom(await storage.get([DROPS_CAMPAIGNS_KEY]));
  }

  return { recordInventory, recordEvent, recordCampaigns, recordCampaignDetails, recordRewards, recordBadges, recordBadgeAdded, relink, recordClaim, resolveNames, readCampaigns };
}
