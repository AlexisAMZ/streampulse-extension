// Écrivain unique du suivi des Drops, côté service worker. Tout ce que
// dropsRecorder.js relaie (inventaire, événements temps réel, campagnes,
// résultats de récupération) passe par une file : deux lectures simultanées
// ne peuvent pas s'écraser. Les calculs vivent dans drops-data.js.

import {
  CLAIM_OK_STATUSES,
  DROPS_CAMPAIGNS_KEY,
  DROPS_HISTORY_KEY,
  DROPS_KEYS,
  DROPS_PROGRESS_KEY,
  DROPS_REWARDS_KEY,
  DROPS_BADGES_KEY,
  badgesFrom,
  mergeBadges,
  DROPS_SINCE_KEY,
  applyClaim,
  applyEvent,
  applyInventory,
  campaignsFrom,
  historyFrom,
  isClaimable,
  normalizeCampaigns,
  normalizeInventory,
  normalizeRewards,
  progressFrom,
  pruneCampaigns,
  pruneHistory,
} from "./drops-data.js";

/** Un Drop réservé à un onglet n'est pas redemandé à un autre avant ce délai. */
const CLAIM_LOCK_MS = 2 * 60_000;
/** Un Drop inconnu relance la lecture de l'inventaire, au plus une fois par période. */
const UNKNOWN_REFRESH_MS = 2 * 60_000;
const RESOLVE_BATCH = 100;

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

  function enqueue(task) {
    const run = queue.then(task, task);
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
      const campaigns = pruneCampaigns(normalizeCampaigns(rawList), clock);
      if (!campaigns.length) return { recorded: false };
      await storage.set({ [DROPS_CAMPAIGNS_KEY]: { updatedAt: clock, source: String(source || ""), campaigns } });
      return { recorded: true, count: campaigns.length };
    });
  }

  function recordRewards(rawList) {
    return enqueue(async () => {
      const rewards = normalizeRewards(rawList);
      await storage.set({ [DROPS_REWARDS_KEY]: { updatedAt: now(), rewards } });
      return { recorded: true, count: rewards.length };
    });
  }

  function recordBadges(raw) {
    return enqueue(async () => {
      const result = mergeBadges(badgesFrom(await storage.get([DROPS_BADGES_KEY])), raw, now());
      if (result.state.updatedAt) await storage.set({ [DROPS_BADGES_KEY]: result.state });
      return { added: result.added };
    });
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

  return { recordInventory, recordEvent, recordCampaigns, recordRewards, recordBadges, recordClaim, resolveNames, readCampaigns };
}
