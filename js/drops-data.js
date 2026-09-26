// Suivi des Drops Twitch. Module pur : normalisation de l'inventaire et des
// campagnes lus sur Twitch, progression en temps réel, détection des Drops
// récupérés, filtres des campagnes et historique. Aucun accès à chrome.* ni au
// DOM. Testé par tests/drops-data.test.mjs.

import { dayKey } from "./recap-data.js";

export const DROPS_PROGRESS_KEY = "streamPulseDropsProgress";
export const DROPS_CAMPAIGNS_KEY = "streamPulseDropsCampaigns";
export const DROPS_HISTORY_KEY = "streamPulseDropsHistory";
/** Début du suivi : un Drop obtenu avant n'entre jamais dans l'historique. */
export const DROPS_SINCE_KEY = "streamPulseDropsSince";
/** Campagnes de récompenses (badges de chat) : cache relu toutes les 30 minutes. */
export const DROPS_REWARDS_KEY = "streamPulseDropsRewards";
/** Badges globaux de Twitch, avec la date où StreamPulse a vu chacun pour la première fois. */
export const DROPS_BADGES_KEY = "streamPulseDropsBadges";
export const DROPS_KEYS = [DROPS_PROGRESS_KEY, DROPS_CAMPAIGNS_KEY, DROPS_HISTORY_KEY, DROPS_SINCE_KEY, DROPS_REWARDS_KEY, DROPS_BADGES_KEY];
/** Un badge vu pour la première fois depuis moins longtemps est « nouveau ». */
export const NEW_BADGE_MS = 30 * 86_400_000;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const HISTORY_LIMIT = 2000;
export const HISTORY_RETENTION_DAYS = 400;
export const NEW_CAMPAIGN_MS = 3 * DAY_MS;
export const ENDING_SOON_MS = 48 * HOUR_MS;
/** Au-delà, la progression affichée n'est plus décomptée : elle vient d'une vieille lecture. */
export const STALE_MS = 30 * MINUTE_MS;
/** Durée pendant laquelle l'accueil annonce un Drop tout juste récupéré. */
export const RECENT_CLAIM_MS = HOUR_MS;
/** Un Drop vu récupéré et une récompense de l'inventaire sont le même gain s'ils sont si proches. */
const SAME_AWARD_MS = 2 * HOUR_MS;
const EXPIRED_KEEP_MS = 7 * DAY_MS;
const MAX_MINUTES = 100_000;

export const CAMPAIGN_FILTERS = Object.freeze(["all", "new", "ending", "upcoming"]);
/** Statuts renvoyés par Twitch quand la récompense est bien dans l'inventaire. */
export const CLAIM_OK_STATUSES = Object.freeze(["ELIGIBLE_FOR_ALL", "DROP_INSTANCE_ALREADY_CLAIMED"]);

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value, max = 160) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const idOf = (value) => (typeof value === "number" && Number.isFinite(value) ? String(value) : text(value, 200));
const list = (value) => (Array.isArray(value) ? value : []);

function timeOf(value) {
  const at = typeof value === "number" ? value : typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(at) && at > 0 ? at : 0;
}

function minutesOf(value) {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.min(MAX_MINUTES, Math.max(0, Math.floor(n))) : 0;
}

function httpsUrl(value) {
  const url = text(value, 600);
  return url.startsWith("https://") ? url : "";
}

/** Jaquette Twitch : l'adresse porte parfois un gabarit {width}x{height}. */
function boxArt(value) {
  return httpsUrl(value).replace("{width}", "52").replace("{height}", "72");
}

// ─── États lus du storage ─────────────────────────────────────────────────────

export function emptyProgress() {
  return { updatedAt: 0, eventAt: 0, drops: [], channels: {} };
}

/** Progression lue du storage, sans faire confiance à sa forme. */
export function progressFrom(stored = {}) {
  const value = (stored || {})[DROPS_PROGRESS_KEY];
  if (!isPlainObject(value)) return emptyProgress();
  return {
    updatedAt: timeOf(value.updatedAt),
    eventAt: timeOf(value.eventAt),
    drops: list(value.drops).filter((drop) => isPlainObject(drop) && typeof drop.id === "string"),
    channels: isPlainObject(value.channels) ? value.channels : {},
  };
}

export function campaignsFrom(stored = {}) {
  const value = (stored || {})[DROPS_CAMPAIGNS_KEY];
  if (!isPlainObject(value)) return { updatedAt: 0, source: "", campaigns: [] };
  return {
    updatedAt: timeOf(value.updatedAt),
    source: text(value.source, 20),
    campaigns: list(value.campaigns).filter((campaign) => isPlainObject(campaign) && typeof campaign.id === "string"),
  };
}

export function historyFrom(stored = {}) {
  return list((stored || {})[DROPS_HISTORY_KEY]).filter(isHistoryEntry);
}

export function isHistoryEntry(entry) {
  return isPlainObject(entry) && typeof entry.key === "string" && entry.key.length > 0 && Number.isFinite(entry.at) && typeof entry.name === "string";
}

// ─── Inventaire ───────────────────────────────────────────────────────────────

function normalizeDrop(drop, campaign, now) {
  const dropId = idOf(drop.id);
  if (!dropId) return null;
  const self = isPlainObject(drop.self) ? drop.self : {};
  const benefits = list(drop.benefitEdges).map((edge) => edge?.benefit).filter(isPlainObject);
  const required = minutesOf(drop.requiredMinutesWatched);
  return {
    id: dropId,
    campaignId: campaign.id,
    instanceId: idOf(self.dropInstanceID),
    name: benefits.map((benefit) => text(benefit.name, 120)).filter(Boolean).join(" + ") || text(drop.name, 120),
    game: campaign.game,
    image: httpsUrl(benefits.find((benefit) => benefit.imageAssetURL)?.imageAssetURL),
    benefitIds: benefits.map((benefit) => idOf(benefit.id)).filter(Boolean),
    isBadge: benefits.length > 0 && benefits.every((benefit) => benefit.distributionType === "BADGE"),
    minutes: Math.min(minutesOf(self.currentMinutesWatched), required || MAX_MINUTES),
    required,
    startsAt: timeOf(drop.startAt),
    endsAt: timeOf(drop.endAt) || campaign.endsAt,
    channel: campaign.channel,
    anyChannel: campaign.anyChannel,
    claimed: self.isClaimed === true,
    seenAt: now,
  };
}

const isActiveAt = (drop, now) => (!drop.startsAt || drop.startsAt <= now) && (!drop.endsAt || drop.endsAt > now);
export const isClaimable = (drop) => Boolean(drop?.instanceId) && drop.claimed !== true;
export const remainingMinutes = (drop) => Math.max(0, (drop?.required || 0) - (drop?.minutes || 0));

/**
 * Drops à montrer : tous ceux prêts à récupérer, plus, pour chaque campagne,
 * celui qui avance et finira le premier. Twitch compte les minutes sur tous
 * les Drops d'une campagne à la fois : en montrer un seul par campagne suffit.
 */
function pickCurrent(candidates, now) {
  const ready = candidates.filter(isClaimable);
  const byCampaign = new Map();
  for (const drop of candidates) {
    if (isClaimable(drop) || drop.minutes <= 0 || !isActiveAt(drop, now)) continue;
    const best = byCampaign.get(drop.campaignId);
    if (!best || remainingMinutes(drop) < remainingMinutes(best)) byCampaign.set(drop.campaignId, drop);
  }
  return sortDrops([...ready, ...byCampaign.values()]);
}

export function sortDrops(drops) {
  return [...drops].sort((a, b) => Number(isClaimable(b)) - Number(isClaimable(a)) || remainingMinutes(a) - remainingMinutes(b) || (a.endsAt || Infinity) - (b.endsAt || Infinity));
}

/**
 * Lit la réponse GraphQL `currentUser.inventory`. Renvoie les Drops en cours,
 * ceux déjà récupérés, et les récompenses de l'inventaire avec leur date
 * (`gameEventDrops`), ou `null` si la réponse n'a pas la forme attendue.
 */
export function normalizeInventory(raw, now = Date.now()) {
  const inventory = isPlainObject(raw?.currentUser?.inventory) ? raw.currentUser.inventory : isPlainObject(raw?.inventory) ? raw.inventory : raw;
  if (!isPlainObject(inventory) || !Array.isArray(inventory.dropCampaignsInProgress)) return null;

  const candidates = [];
  const claimed = [];
  for (const rawCampaign of inventory.dropCampaignsInProgress) {
    if (!isPlainObject(rawCampaign)) continue;
    const allowed = list(rawCampaign.allow?.channels).filter(isPlainObject);
    const restricted = rawCampaign.allow?.isEnabled !== false && allowed.length > 0;
    const campaign = {
      id: idOf(rawCampaign.id),
      game: text(rawCampaign.game?.displayName || rawCampaign.game?.name, 120) || text(rawCampaign.name, 120),
      endsAt: timeOf(rawCampaign.endAt),
      channel: restricted && allowed.length === 1 ? text(allowed[0].displayName || allowed[0].name, 80) : "",
      // Sans liste de chaînes, on ne sait pas : on ne promet pas « toute chaîne ».
      anyChannel: isPlainObject(rawCampaign.allow) && !restricted,
    };
    for (const rawDrop of list(rawCampaign.timeBasedDrops)) {
      if (!isPlainObject(rawDrop)) continue;
      const drop = normalizeDrop(rawDrop, campaign, now);
      if (!drop) continue;
      (drop.claimed ? claimed : candidates).push(drop);
    }
  }

  const awarded = list(inventory.gameEventDrops)
    .filter(isPlainObject)
    .map((benefit) => ({
      benefitId: idOf(benefit.id),
      name: text(benefit.name, 120),
      image: httpsUrl(benefit.imageURL),
      game: text(benefit.game?.displayName || benefit.game?.name, 120),
      at: timeOf(benefit.lastAwardedAt),
    }))
    .filter((benefit) => benefit.benefitId && benefit.name && benefit.at);

  return { drops: pickCurrent(candidates, now), claimed, awarded };
}

function historyEntry(drop, { at, auto, channel }) {
  return {
    key: `drop:${drop.id}`,
    dropId: drop.id,
    instanceId: drop.instanceId || "",
    benefitIds: list(drop.benefitIds),
    name: drop.name,
    game: drop.game || "",
    image: drop.image || "",
    channel: channel || drop.channel || "",
    at,
    auto: Boolean(auto),
  };
}

/** Un gain déjà dans l'historique, qu'il vienne d'une récupération ou de l'inventaire. */
function findAward(history, benefitIds, at) {
  return history.find((entry) => entry.at && Math.abs(entry.at - at) <= SAME_AWARD_MS && list(entry.benefitIds).some((id) => benefitIds.includes(id)));
}

function channelName(progress, drop) {
  return drop.channel || (drop.channelId && text(progress.channels?.[drop.channelId], 80)) || "";
}

/**
 * Applique une lecture d'inventaire. Un Drop vu en cours puis récupéré, ou
 * une récompense apparue dans l'inventaire depuis le début du suivi, entre
 * dans l'historique ; les Drops obtenus avant ne sont jamais comptés.
 *
 * @returns {{ progress: object, history: object[], added: object[] }}
 */
export function applyInventory(progress, history, inventory, now, since) {
  const previous = new Map(progress.drops.map((drop) => [drop.id, drop]));
  const drops = inventory.drops.map((drop) => {
    const before = previous.get(drop.id);
    return before?.channelId ? { ...drop, channelId: before.channelId } : drop;
  });

  const known = new Set(history.map((entry) => entry.key));
  const added = [];
  const next = [...history];
  const push = (entry) => {
    known.add(entry.key);
    next.unshift(entry);
    added.push(entry);
  };

  for (const drop of inventory.claimed) {
    const before = previous.get(drop.id);
    if (!before || known.has(`drop:${drop.id}`)) continue;
    const award = inventory.awarded.find((benefit) => drop.benefitIds.includes(benefit.benefitId) && benefit.at >= since);
    push(historyEntry({ ...before, ...drop, image: drop.image || award?.image || before.image }, {
      at: award?.at || now,
      auto: false,
      channel: channelName(progress, before),
    }));
  }

  for (const benefit of inventory.awarded) {
    if (benefit.at < since) continue;
    const key = `benefit:${benefit.benefitId}:${benefit.at}`;
    if (known.has(key) || findAward(next, [benefit.benefitId], benefit.at)) continue;
    push({ key, dropId: "", instanceId: "", benefitIds: [benefit.benefitId], name: benefit.name, game: benefit.game, image: benefit.image, channel: "", at: benefit.at, auto: false });
  }

  next.sort((a, b) => b.at - a.at);
  return {
    progress: { ...progress, updatedAt: now, drops, channels: pruneChannels(progress.channels, drops) },
    history: next,
    added,
  };
}

function pruneChannels(channels, drops) {
  const used = new Set(drops.map((drop) => drop.channelId).filter(Boolean));
  return Object.fromEntries(Object.entries(channels || {}).filter(([id]) => used.has(id)));
}

// ─── Événements temps réel (Hermes / PubSub) ──────────────────────────────────

/**
 * `drop-progress` : minutes regardées pour un Drop. `drop-claim` : Twitch
 * annonce qu'un Drop est prêt, avec l'identifiant à envoyer pour le récupérer.
 * `known` est faux si le Drop n'est pas encore dans la progression : il faut
 * alors relire l'inventaire pour connaître son nom.
 */
export function applyEvent(progress, event, now) {
  const type = event?.type;
  const data = isPlainObject(event?.data) ? event.data : null;
  const dropId = idOf(data?.drop_id);
  if (!data || !dropId || (type !== "drop-progress" && type !== "drop-claim")) return null;

  const channelId = /^\d{1,20}$/.test(idOf(data.channel_id)) ? idOf(data.channel_id) : "";
  const index = progress.drops.findIndex((drop) => drop.id === dropId);
  let instanceId = "";
  let drops = progress.drops;

  if (index !== -1) {
    const drop = { ...progress.drops[index] };
    if (channelId) drop.channelId = channelId;
    if (type === "drop-progress") {
      drop.required = minutesOf(data.required_progress_min) || drop.required;
      drop.minutes = Math.min(minutesOf(data.current_progress_min), drop.required || MAX_MINUTES);
    } else {
      instanceId = idOf(data.drop_instance_id);
      if (instanceId) {
        drop.instanceId = instanceId;
        drop.minutes = drop.required;
      }
    }
    drops = sortDrops(progress.drops.map((item, i) => (i === index ? drop : item)));
  } else if (type === "drop-claim") {
    instanceId = idOf(data.drop_instance_id);
  }

  return {
    progress: { ...progress, eventAt: now, drops },
    known: index !== -1,
    channelId,
    instanceId,
  };
}

/** Un Drop récupéré par StreamPulse : il quitte la progression et entre dans l'historique. */
export function applyClaim(progress, history, instanceId, now, auto) {
  const drop = progress.drops.find((item) => item.instanceId === instanceId);
  const drops = progress.drops.filter((item) => item.instanceId !== instanceId);
  if (!drop) return { progress: { ...progress, drops }, history, entry: null };
  const key = `drop:${drop.id}`;
  if (history.some((entry) => entry.key === key)) return { progress: { ...progress, drops }, history, entry: null };
  const entry = historyEntry(drop, { at: now, auto, channel: channelName(progress, drop) });
  return { progress: { ...progress, drops }, history: [entry, ...history], entry };
}

export function pruneHistory(history, now) {
  const oldest = now - HISTORY_RETENTION_DAYS * DAY_MS;
  return history
    .filter((entry) => entry.at >= oldest)
    .sort((a, b) => b.at - a.at)
    .slice(0, HISTORY_LIMIT);
}

// ─── Campagnes ────────────────────────────────────────────────────────────────

/** Une campagne lue par GraphQL ou dans le cache de la page Twitch. */
export function normalizeCampaign(raw) {
  if (!isPlainObject(raw)) return null;
  const id = idOf(raw.id);
  const game = text(raw.game?.displayName || raw.game?.name, 120);
  if (!id || !(game || raw.name)) return null;
  const drops = Array.isArray(raw.timeBasedDrops) ? raw.timeBasedDrops.filter(isPlainObject) : null;
  const benefits = drops ? drops.flatMap((drop) => list(drop.benefitEdges).map((edge) => edge?.benefit).filter(isPlainObject)) : [];
  const connected = raw.self?.isAccountConnected;
  return {
    id,
    name: text(raw.name, 160),
    game: game || text(raw.name, 120),
    gameId: idOf(raw.game?.id),
    boxArt: boxArt(raw.game?.boxArtURL),
    owner: text(raw.owner?.name, 80),
    startsAt: timeOf(raw.startAt),
    endsAt: timeOf(raw.endAt),
    status: text(raw.status, 20).toUpperCase(),
    rewardCount: drops ? benefits.length || drops.length : null,
    badgeOnly: drops && benefits.length ? benefits.every((benefit) => benefit.distributionType === "BADGE") : null,
    accountLinkUrl: httpsUrl(raw.accountLinkURL),
    connected: typeof connected === "boolean" ? connected : null,
  };
}

export function normalizeCampaigns(rawList) {
  const seen = new Set();
  const campaigns = [];
  for (const raw of list(rawList)) {
    const campaign = normalizeCampaign(raw);
    if (!campaign || seen.has(campaign.id)) continue;
    seen.add(campaign.id);
    campaigns.push(campaign);
  }
  return campaigns;
}

/** Garde les campagnes utiles : en cours, à venir, ou finies depuis moins d'une semaine. */
export function pruneCampaigns(campaigns, now) {
  return campaigns.filter((campaign) => !campaign.endsAt || campaign.endsAt > now - EXPIRED_KEEP_MS);
}

export const campaignUrl = (id) => `https://www.twitch.tv/drops/campaigns?dropID=${encodeURIComponent(id)}`;

const isUpcoming = (campaign, now) => campaign.startsAt > now || campaign.status === "UPCOMING";

export function isActiveCampaign(campaign, now) {
  if (campaign.status && campaign.status !== "ACTIVE") return false;
  return (!campaign.startsAt || campaign.startsAt <= now) && (!campaign.endsAt || campaign.endsAt > now);
}

export const isNewCampaign = (campaign, now) => isActiveCampaign(campaign, now) && campaign.startsAt > 0 && now - campaign.startsAt < NEW_CAMPAIGN_MS;
export const isEndingSoon = (campaign, now) => isActiveCampaign(campaign, now) && campaign.endsAt > 0 && campaign.endsAt - now < ENDING_SOON_MS;

const FILTER_TESTS = {
  all: isActiveCampaign,
  new: isNewCampaign,
  ending: isEndingSoon,
  upcoming: (campaign, now) => isUpcoming(campaign, now) && (!campaign.endsAt || campaign.endsAt > now),
};

/** Jeux regardés ces derniers jours, d'après le temps de visionnage déjà enregistré. */
export function myGamesFrom(watchDaily, now, days = 30) {
  const games = new Set();
  if (!isPlainObject(watchDaily)) return games;
  const oldest = dayKey(new Date(now - (days - 1) * DAY_MS));
  for (const [day, channels] of Object.entries(watchDaily)) {
    if (day < oldest || !isPlainObject(channels)) continue;
    for (const entry of Object.values(channels)) {
      for (const name of Object.keys(isPlainObject(entry?.games) ? entry.games : {})) games.add(name.trim().toLowerCase());
    }
  }
  return games;
}

export const isMine = (campaign, myGames) => Boolean(campaign.game) && myGames.has(campaign.game.toLowerCase());

/**
 * Campagnes d'un filtre, celles de tes jeux d'abord. Les nouvelles vont de la
 * plus récente à la plus ancienne, les à venir de la plus proche à la plus
 * lointaine, les autres de celle qui finit la première à la dernière.
 */
export function filterCampaigns(campaigns, filterId, now, myGames = new Set()) {
  const test = FILTER_TESTS[filterId] || FILTER_TESTS.all;
  const order = {
    new: (a, b) => b.startsAt - a.startsAt,
    upcoming: (a, b) => a.startsAt - b.startsAt,
  }[filterId] || ((a, b) => (a.endsAt || Infinity) - (b.endsAt || Infinity));
  return campaigns
    .filter((campaign) => test(campaign, now))
    .sort((a, b) => Number(isMine(b, myGames)) - Number(isMine(a, myGames)) || order(a, b) || a.game.localeCompare(b.game));
}

export function countFilters(campaigns, now) {
  return Object.fromEntries(CAMPAIGN_FILTERS.map((id) => [id, campaigns.filter((campaign) => FILTER_TESTS[id](campaign, now)).length]));
}

// ─── Campagnes de récompenses (badges) ───────────────────────────────────────

/** Une campagne `rewardCampaignsAvailableToUser`, avec ses conditions et ses récompenses. */
export function normalizeReward(raw) {
  if (!isPlainObject(raw)) return null;
  const id = idOf(raw.id);
  const rewards = list(raw.rewards)
    .filter(isPlainObject)
    .map((reward) => ({ id: idOf(reward.id), name: text(reward.name, 120), image: httpsUrl(reward.bannerImage?.image1xURL) }))
    .filter((reward) => reward.name);
  if (!id || !rewards.length) return null;
  const url = httpsUrl(raw.externalURL);
  return {
    id,
    name: text(raw.name, 160),
    brand: text(raw.brand, 80),
    game: text(raw.game?.displayName, 120),
    summary: text(raw.summary, 400),
    // Le lien par défaut de Twitch (la page d'accueil) n'apprend rien.
    url: url.replace(/\/+$/, "") === "https://www.twitch.tv" ? "" : url,
    startsAt: timeOf(raw.startsAt),
    endsAt: timeOf(raw.endsAt),
    minutesGoal: minutesOf(raw.unlockRequirements?.minuteWatchedGoal),
    subsGoal: minutesOf(raw.unlockRequirements?.subsGoal),
    rewards,
  };
}

export function normalizeRewards(rawList) {
  const seen = new Set();
  return list(rawList).map(normalizeReward).filter((reward) => reward && !seen.has(reward.id) && seen.add(reward.id));
}

export function rewardsFrom(stored = {}) {
  const value = (stored || {})[DROPS_REWARDS_KEY];
  if (!isPlainObject(value)) return { updatedAt: 0, rewards: [] };
  return { updatedAt: timeOf(value.updatedAt), rewards: list(value.rewards).filter((reward) => isPlainObject(reward) && typeof reward.id === "string") };
}

/** Campagnes en cours, celle qui finit la première d'abord. */
export function activeRewards(rewards, now) {
  return rewards
    .filter((reward) => (!reward.startsAt || reward.startsAt <= now) && (!reward.endsAt || reward.endsAt > now))
    .sort((a, b) => (a.endsAt || Infinity) - (b.endsAt || Infinity));
}

// ─── Badges globaux ───────────────────────────────────────────────────────────

export function badgesFrom(stored = {}) {
  const value = (stored || {})[DROPS_BADGES_KEY];
  if (!isPlainObject(value)) return { updatedAt: 0, syncedAt: 0, badges: [], owned: [] };
  return {
    updatedAt: timeOf(value.updatedAt),
    syncedAt: timeOf(value.syncedAt),
    badges: list(value.badges).filter((badge) => isPlainObject(badge) && typeof badge.id === "string"),
    owned: list(value.owned).filter((id) => typeof id === "string"),
  };
}

/**
 * Twitch ne date pas ses badges : comme Stream Database, on retient le moment
 * où chacun apparaît. À la première synchronisation, tous sont déjà connus
 * (firstSeen 0) ; seuls les suivants seront « nouveaux ». Un badge a
 * plusieurs versions : une seule ligne par set.
 *
 * @returns {{ state: object, added: object[] }}
 */
export function mergeBadges(state, raw, now) {
  const first = !state.syncedAt;
  const known = new Map(state.badges.map((badge) => [badge.id, badge]));
  const badges = [];
  const added = [];
  const seen = new Set();
  for (const item of list(raw.badges)) {
    const id = text(item?.setID, 120);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const before = known.get(id);
    const badge = {
      id,
      title: text(item.title, 120) || id,
      description: text(item.description, 400),
      image: httpsUrl(item.imageURL),
      firstSeen: before ? before.firstSeen : first ? 0 : now,
    };
    if (!before && !first) added.push(badge);
    badges.push(badge);
  }
  // Une réponse vide (panne passagère) ne doit pas effacer la liste.
  if (!badges.length) return { state, added: [] };
  return {
    state: { updatedAt: now, syncedAt: state.syncedAt || now, badges, owned: list(raw.owned).map((id) => text(id, 120)).filter(Boolean) },
    added,
  };
}

/** Payant si la description parle d'abonnement, de sub offert ou de Bits. */
export const isPaidBadge = (badge) => /subscrib|gift|\bsubs?\b|\bbits?\b/i.test(badge.description || "");

export function newBadges(state, now, windowMs = NEW_BADGE_MS) {
  const owned = new Set(state.owned);
  return state.badges
    .filter((badge) => badge.firstSeen && now - badge.firstSeen <= windowMs)
    .map((badge) => ({ ...badge, owned: owned.has(badge.id), paid: isPaidBadge(badge) }))
    .sort((a, b) => b.firstSeen - a.firstSeen);
}

// ─── Affichage ────────────────────────────────────────────────────────────────

/** Drops encore utiles à montrer : pas récupérés, et pas finis sauf s'ils restent à récupérer. */
export function currentDrops(progress, now) {
  return sortDrops(progress.drops.filter((drop) => drop.claimed !== true && (isClaimable(drop) || !drop.endsAt || drop.endsAt > now)));
}

export function lastReadAt(progress) {
  return Math.max(progress.updatedAt || 0, progress.eventAt || 0);
}

export const isStale = (progress, now) => now - lastReadAt(progress) > STALE_MS;

export function recentClaims(history, now, windowMs = RECENT_CLAIM_MS) {
  return history.filter((entry) => entry.at <= now && now - entry.at <= windowMs);
}

/** Ce que montre la bande de l'accueil : un Drop en cours, sinon le dernier récupéré. */
export function bandModel(progress, history, now) {
  const drops = currentDrops(progress, now);
  if (drops.length) return { kind: "progress", drop: drops[0], others: drops.length - 1, stale: isStale(progress, now) };
  const recent = recentClaims(history, now);
  if (recent.length) return { kind: "claimed", entry: recent[0], count: recent.length };
  return null;
}

export function dropsToday(history, now) {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  return history.filter((entry) => entry.at >= midnight.getTime() && entry.at <= now).length;
}

/**
 * Historique mois par mois (heure locale). Dans un mois, une même récompense
 * du même jeu, obtenue le même jour sur la même chaîne, tient sur une ligne ×N.
 */
export function summarizeHistory(history) {
  const months = [];
  const sorted = [...history].sort((a, b) => b.at - a.at);
  for (const entry of sorted) {
    const day = dayKey(new Date(entry.at));
    const key = day.slice(0, 7);
    let month = months[months.length - 1];
    if (!month || month.key !== key) {
      month = { key, count: 0, rows: [] };
      months.push(month);
    }
    month.count += 1;
    const last = month.rows[month.rows.length - 1];
    if (last && last.day === day && last.name === entry.name && last.game === entry.game && last.channel === entry.channel) {
      last.times += 1;
    } else {
      month.rows.push({ ...entry, day, times: 1 });
    }
  }
  return { total: sorted.length, months };
}
