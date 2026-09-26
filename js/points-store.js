// Écrivain unique du suivi des points, côté service worker. Les gains relayés
// par pointsRecorder.js passent tous par une file : deux gains simultanés ne
// peuvent pas s'écraser. Les calculs vivent dans points-data.js ; ce module
// ne fait que lire, appliquer et écrire, puis nommer les chaînes.

import {
  POINTS_CHANNELS_KEY,
  POINTS_KEYS,
  addGain,
  normalizeGain,
  prune,
  stateFrom,
  toStorage,
} from "./points-data.js";

const PRUNED_AT_KEY = "streamPulsePointsPrunedAt";
const PRUNE_EVERY_MS = 86_400_000;
const RESOLVE_BATCH = 100;

/**
 * @param {{
 *   storage: { get(keys: string[]): Promise<object>, set(values: object): Promise<void>, remove(keys: string[]): Promise<void> },
 *   resolveChannels: (ids: string[]) => Promise<Array<{ id: string, login: string, displayName: string, avatar: string }>>,
 *   now?: () => number,
 *   log?: { warn: (...args: unknown[]) => void },
 * }} deps
 */
export function createPointsStore({ storage, resolveChannels, now = () => Date.now(), log = console }) {
  let queue = Promise.resolve();

  function enqueue(task) {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  }

  async function read() {
    const stored = await storage.get([...POINTS_KEYS, PRUNED_AT_KEY]);
    return { state: stateFrom(stored), prunedAt: Number(stored[PRUNED_AT_KEY]) || 0 };
  }

  function record(raw) {
    return enqueue(async () => {
      const clock = now();
      const gain = normalizeGain(raw, clock);
      if (!gain) return { recorded: false, reason: "invalid" };
      const { state, prunedAt } = await read();
      const added = addGain(state, gain);
      if (added === state) return { recorded: false, reason: "duplicate" };
      const due = clock - prunedAt >= PRUNE_EVERY_MS;
      const next = due ? prune(added, clock) : added;
      await storage.set({ ...toStorage(next), ...(due ? { [PRUNED_AT_KEY]: clock } : {}) });
      return { recorded: true, channelId: gain.channelId };
    });
  }

  function resolveNames() {
    return enqueue(async () => {
      const { state } = await read();
      const missing = Object.entries(state.channels)
        .filter(([, channel]) => !channel?.login)
        .map(([id]) => id)
        .slice(0, RESOLVE_BATCH);
      if (missing.length === 0) return 0;

      let users;
      try {
        users = await resolveChannels(missing);
      } catch (error) {
        log.warn("[StreamPulse] noms des chaînes de points indisponibles", error);
        return 0;
      }

      const channels = { ...state.channels };
      let named = 0;
      for (const user of Array.isArray(users) ? users : []) {
        const id = String(user?.id || "");
        if (!channels[id] || !user.login) continue;
        channels[id] = {
          ...channels[id],
          login: String(user.login),
          displayName: String(user.displayName || user.login),
          avatar: String(user.avatar || ""),
        };
        named += 1;
      }
      if (named > 0) await storage.set({ [POINTS_CHANNELS_KEY]: channels });
      return named;
    });
  }

  function reset() {
    return enqueue(() => storage.remove([...POINTS_KEYS, PRUNED_AT_KEY]));
  }

  return { record, resolveNames, reset };
}
