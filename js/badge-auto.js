// Mode auto des badges : la file des badges à obtenir. Module pur.
//
// Twitch ne fait progresser les Drops que sur un seul live à la fois : un seul
// onglet regarde donc un seul jeu. Les badges d'un même jeu (paliers de 30 min,
// 1 h, 90 min…) avancent ensemble et forment un groupe ; l'onglet reste sur ce
// jeu tant qu'il en manque un, puis passe au groupe suivant. La campagne qui
// finit le plus tôt passe en premier.
//
// État rangé sous BADGE_AUTO_KEY :
//   { mode: "manual" | "all", jobs: Job[], tabId, gameKey, startedAt }
//   Job = { badgeId, title, image, game, gameId, campaignId, endsAt, addedAt }
// « all » : « Récupérer tous les badges possibles », la file se complète seule.

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value, max = 120) => (typeof value === "string" ? value.slice(0, max) : "");
const time = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0);

function normalizeJob(raw) {
  if (!isPlainObject(raw)) return null;
  const badgeId = text(raw.badgeId);
  if (!badgeId) return null;
  return {
    badgeId,
    title: text(raw.title) || badgeId,
    image: text(raw.image, 400),
    game: text(raw.game),
    gameId: text(raw.gameId, 20),
    campaignId: text(raw.campaignId),
    endsAt: time(raw.endsAt),
    addedAt: time(raw.addedAt),
  };
}

/** État stocké → état propre ; reprend l'ancien format d'un seul badge. */
export function normalizeAuto(raw) {
  if (!isPlainObject(raw)) return null;
  const jobs = Array.isArray(raw.jobs) ? raw.jobs : raw.badgeId ? [{ ...raw, addedAt: raw.startedAt }] : [];
  return {
    mode: raw.mode === "all" ? "all" : "manual",
    jobs: jobs.map(normalizeJob).filter(Boolean),
    tabId: Number.isInteger(raw.tabId) ? raw.tabId : 0,
    // Jeu (clé de groupe) sur lequel l'onglet regarde un live.
    gameKey: text(raw.gameKey),
    startedAt: time(raw.startedAt),
  };
}

/** Badge du catalogue (avec sa campagne en cours) → tâche ; null sans campagne. */
export function jobFromBadge(badge, now = Date.now()) {
  const campaign = badge?.campaign;
  if (!campaign) return null;
  return normalizeJob({
    badgeId: badge.id,
    title: badge.title,
    image: badge.image,
    game: campaign.game,
    gameId: campaign.gameId,
    campaignId: campaign.id,
    endsAt: campaign.endsAt,
    addedAt: now,
  });
}

/** Ajoute des tâches à la file, sans doublon (la première version d'un badge reste). */
export function addJobs(state, jobs, patch = {}) {
  const base = normalizeAuto(state) || { mode: "manual", jobs: [], tabId: 0, gameKey: "", startedAt: 0 };
  const known = new Set(base.jobs.map((job) => job.badgeId));
  const added = (jobs || []).map(normalizeJob).filter((job) => job && !known.has(job.badgeId) && known.add(job.badgeId));
  return { ...base, ...patch, jobs: [...base.jobs, ...added] };
}

export function removeJob(state, badgeId) {
  const base = normalizeAuto(state);
  return base ? { ...base, jobs: base.jobs.filter((job) => job.badgeId !== badgeId) } : null;
}

/** « Tous les badges possibles » : gratuits, pas encore obtenus, avec une campagne en cours. */
export function freeBadgeJobs(catalog, now = Date.now()) {
  return (catalog || []).filter((badge) => !badge.owned && !badge.paid && badge.campaign).map((badge) => jobFromBadge(badge, now)).filter(Boolean);
}

/** Retire de la file les badges obtenus et ceux dont la campagne est finie. */
export function pruneJobs(state, { owned = [], now = Date.now() } = {}) {
  const base = normalizeAuto(state) || { mode: "manual", jobs: [], tabId: 0, gameKey: "", startedAt: 0 };
  const have = new Set(owned);
  const obtained = [];
  const expired = [];
  const jobs = [];
  for (const job of base.jobs) {
    if (have.has(job.badgeId)) obtained.push(job);
    else if (job.endsAt && job.endsAt <= now) expired.push(job);
    else jobs.push(job);
  }
  return { state: { ...base, jobs }, obtained, expired };
}

const groupKey = (job) => job.gameId || job.game.toLowerCase();

/** Groupes par jeu, dans l'ordre de passage : fin de campagne la plus proche, puis ajout le plus ancien. */
export function gameGroups(jobs) {
  const groups = new Map();
  for (const job of jobs || []) {
    const key = groupKey(job);
    if (!groups.has(key)) groups.set(key, { key, game: job.game, gameId: job.gameId, campaignIds: [], endsAt: 0, addedAt: job.addedAt, jobs: [] });
    const group = groups.get(key);
    group.jobs.push(job);
    if (job.campaignId && !group.campaignIds.includes(job.campaignId)) group.campaignIds.push(job.campaignId);
    if (job.endsAt && (!group.endsAt || job.endsAt < group.endsAt)) group.endsAt = job.endsAt;
    group.addedAt = Math.min(group.addedAt, job.addedAt);
  }
  return [...groups.values()].sort((a, b) => (a.endsAt || Infinity) - (b.endsAt || Infinity) || a.addedAt - b.addedAt);
}

export function currentGroup(state) {
  return gameGroups(normalizeAuto(state)?.jobs || [])[0] || null;
}

/**
 * Ce que dit la bannière de l'onglet : badges du jeu en cours, minutes du Drop
 * le plus proche d'être gagné, et la suite de la file.
 */
export function bannerModel(state, drops = []) {
  const groups = gameGroups(normalizeAuto(state)?.jobs || []);
  const group = groups[0];
  if (!group) return null;
  const pending = (drops || []).filter((drop) => group.campaignIds.includes(drop.campaignId) && !drop.claimed && drop.required > 0);
  const closest = pending.sort((a, b) => a.required - a.minutes - (b.required - b.minutes))[0];
  const rest = groups.slice(1);
  return {
    mode: normalizeAuto(state).mode,
    game: group.game,
    badges: group.jobs.map((job) => job.title),
    minutes: closest ? { done: Math.min(closest.minutes, closest.required), required: closest.required } : null,
    nextBadges: rest.reduce((sum, item) => sum + item.jobs.length, 0),
    nextGames: rest.length,
  };
}
