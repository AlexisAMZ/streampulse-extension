// Badges globaux de Twitch pour l'onglet Badges : catalogue (avec la date où
// StreamPulse a vu chaque badge), journal qui relie chaque badge au Drop ou à
// la récompense qui le donne, statuts (en cours, à venir, terminé) et dates
// d'ajout notées par streampulse.fr. Module pur : aucun accès à chrome.* ni au
// DOM. Testé par tests/badge-events.test.mjs, tests/badge-statuses.test.mjs et
// tests/drops-rewards.test.mjs.

import {
  BADGE_ADDED_KEY,
  BADGE_EVENTS_KEY,
  DROPS_BADGES_KEY,
  httpsUrl,
  isActiveCampaign,
  isPlainObject,
  isTwitchGaming,
  list,
  text,
  timeOf,
} from "./drops-data.js";

const DAY_MS = 86_400_000;
/** Un badge vu pour la première fois depuis moins longtemps est « nouveau ». */
const NEW_BADGE_MS = 30 * DAY_MS;
/** Un événement de badge reste au journal jusqu'à 60 jours après sa fin. */
const EVENT_KEEP_MS = 60 * DAY_MS;
/** Un badge sans campagne reste « à venir » pendant 30 jours après son ajout. */
const SOON_WINDOW_MS = 30 * DAY_MS;
/** Un badge terminé reste affiché 7 jours. */
const ENDED_SHOWN_MS = 7 * DAY_MS;

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
 * Twitch ne date pas ses badges : on retient le moment où chacun apparaît
 * pour la première fois. À la première synchronisation, tous sont déjà connus
 * (firstSeen 0) ; seuls les suivants seront « nouveaux ». Un badge a
 * plusieurs versions : une seule ligne par set.
 *
 * @returns {{ state: object, added: object[] }}
 */
export function mergeBadges(state, raw, now) {
  const first = !state.syncedAt;
  const known = new Map(state.badges.map((badge) => [badge.id, badge]));

  // Une réponse liste toutes les versions de chaque set (paliers de sub…). Le
  // catalogue n'en montre qu'une — la première rencontrée, stable d'une lecture
  // à l'autre — mais retient la plus haute : quand elle monte, une nouvelle
  // version de la série est apparue et le badge est signalé comme nouveauté.
  const sets = new Map();
  for (const item of list(raw.badges)) {
    const id = text(item?.setID, 120);
    if (!id) continue;
    const version = Number(item?.version);
    const set = sets.get(id);
    if (!set) {
      sets.set(id, { base: item, top: Number.isFinite(version) ? version : undefined });
      continue;
    }
    if (Number.isFinite(version) && (set.top === undefined || version > set.top)) set.top = version;
  }

  const badges = [];
  const added = [];
  for (const [id, set] of sets) {
    const item = set.base;
    const before = known.get(id);
    const badge = {
      id,
      version: set.top !== undefined ? String(set.top) : (before?.version || ""),
      title: text(item.title, 120) || id,
      description: text(item.description, 400),
      image: httpsUrl(item.imageURL),
      url: httpsUrl(item.clickURL),
      game: gameFromUrl(item.clickURL),
      firstSeen: before ? before.firstSeen : first ? 0 : now,
      newVersionAt: before?.newVersionAt || 0,
    };
    // Nouvelle version d'une série déjà connue (palier de sub en plus…) : la
    // version du set a monté, on date la nouveauté sans toucher l'image de base.
    if (before && set.top !== undefined && Number(before.version || 0) < set.top) {
      badge.newVersionAt = now;
    }
    if (!before && !first) added.push(badge);
    badges.push(badge);
  }
  if (!badges.length) return { state, added: [] };
  return {
    state: { updatedAt: now, syncedAt: state.syncedAt || now, badges, owned: list(raw.owned).map((id) => text(id, 120)).filter(Boolean) },
    added,
  };
}

/** Catégorie citée par le lien d'un badge : /directory/game/<nom>/… ou /directory/category/<slug>. */
export function gameFromUrl(url) {
  const match = /twitch\.tv\/directory\/(?:game|category)\/([^/?#]+)/i.exec(String(url || ""));
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]).replace(/-/g, " ").trim();
  } catch {
    return "";
  }
}

/**
 * Jeu cité dans la description d'un badge gagné en regardant, sans lien de
 * catégorie : « … earned by watching X for 1 hour », « … watching 30 minutes
 * of X category ». Souvent le seul indice de Twitch quand clickURL est null.
 */
export function gameFromDescription(description) {
  const text = String(description || "");
  const ofCategory = /watching (?:\d+|one|an?)?\s*(?:minutes?|hours?)?\s*of (.+?) category/i.exec(text);
  const watchFor = /watch\w* (.+?) for (?:\d+|one|an?) (?:minutes?|hours?)/i.exec(text);
  return (ofCategory?.[1] || watchFor?.[1] || "").trim().slice(0, 80);
}

/**
 * Payant = l'action demandée coûte : prendre un sub, en offrir un, acheter ou
 * poser des Bits. Les badges gagnés en regardant se gagnent gratuitement —
 * une description qui parle d'un abonnement sans le demander ne paie pas.
 */
export const isPaidBadge = (badge) => /subscrib|gift|\bsubs?\b|\bbits?\b/i.test(badge.description || "");

/** Minuscules sans accents : « Pokémon » et « Pokemon » doivent se reconnaître. */
const fold = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Badges d'événements terminés que rien dans le catalogue de Twitch ne date :
 * ils partagent le nom d'un jeu dont une campagne de badges est en cours, et
 * seraient proposés à tort. Identifiants Twitch (setID).
 */
const RETIRED_BADGES = new Set([
  "league-of-legends-classic", // lancement de LoL Classic en Twitch Rivals
  "elden-ring-recluse", // sortie de Nightreign
  "elden-ring-wylder", // sortie de Nightreign
  "raging-wolf-helm", // lancement de Shadow of the Erdtree
  "sorcerer-rogier-elden-ring",
  "rematch-nations-cup", // Rematch Nations Cup terminée
  "rematch-nations-cup-eng", // variante abonnés de la même coupe
]);

// ─── Journal des badges ───────────────────────────────────────────────────────

export function eventsFrom(stored = {}) {
  const value = (stored || {})[BADGE_EVENTS_KEY];
  if (!isPlainObject(value)) return { updatedAt: 0, events: [] };
  return {
    updatedAt: timeOf(value.updatedAt),
    events: list(value.events).filter((event) => isPlainObject(event) && typeof event.badgeId === "string" && event.badgeId),
  };
}

const ROMAN_NUMERALS = Object.freeze({ ii: "2", iii: "3", iv: "4", v: "5", vi: "6" });

/** Nom de jeu comparable : replié, chiffres romains isolés en chiffres, sans espaces ni ponctuation. */
export function gameKey(value) {
  return fold(value).split(/[^a-z0-9]+/).map((word) => ROMAN_NUMERALS[word] || word).join("");
}

/**
 * Deux noms du même jeu : égaux une fois comparables, ou l'un contenu dans
 * l'autre s'il fait au moins 6 caractères (« ACE COMBAT 8 » dans « ACE COMBAT 8:
 * WINGS OF THEVE », « Space Marine 2 » dans « Warhammer 40,000: Space Marine II »).
 */
export function sameGame(a, b) {
  const x = gameKey(a);
  const y = gameKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 6 && long.includes(short);
}

/** Catégorie citée par une description : « … a streamer in the ELDEN RING category ». */
export function categoryFromDescription(description) {
  return (/\bin (?:the )?(.+?) category/i.exec(String(description || ""))?.[1] || "").trim().slice(0, 80);
}

/** Jeux qu'un badge cite : lien de catégorie, « in the X category », « watching X for… ». */
function badgeGames(badge) {
  return [badge.game, categoryFromDescription(badge.description), gameFromDescription(badge.description)].filter(Boolean);
}

/** Description qui cite une année passée : l'événement est fini. */
function mentionsPastYear(badge, now) {
  const year = new Date(now).getFullYear();
  return (fold(badge.description).match(/\b20\d\d\b/g) || []).some((value) => Number(value) < year);
}

/** Titre comparable : replié, sans ponctuation ni espaces (« Don’t  Eat » = « Don't Eat »). */
function titleKey(value) {
  const folded = fold(value).trim();
  return folded.replace(/[^a-z0-9]+/g, "") || folded;
}

/** Fin d'un Drop, bornée par celle de sa campagne ; une campagne close avant terme clôt ses Drops. */
function dropEnd(campaign, drop, now) {
  const ends = [drop?.endsAt, campaign.endsAt].filter((at) => at > 0);
  const end = ends.length ? Math.min(...ends) : 0;
  const closed = campaign.status && !["ACTIVE", "UPCOMING"].includes(campaign.status);
  return closed && (!end || end > now) ? now : end;
}

const eventKey = (event) => `${event.badgeId}|${event.campaignId}|${event.dropId}`;

function dropEvent(badgeId, campaign, drop, link, now) {
  return {
    badgeId,
    kind: "drops",
    campaignId: campaign.id,
    dropId: drop?.id || "",
    game: campaign.game || "",
    gameId: campaign.gameId || "",
    owner: campaign.owner || "",
    startsAt: drop?.startsAt || campaign.startsAt || 0,
    endsAt: dropEnd(campaign, drop, now),
    minutes: drop?.minutes || 0,
    subs: drop?.subs || 0,
    link,
    seenAt: now,
  };
}

function rewardEvent(badgeId, reward, item, now) {
  return {
    badgeId,
    kind: "rewards",
    campaignId: reward.id,
    dropId: item.id || "",
    game: reward.game || reward.brand || "",
    gameId: "",
    owner: reward.brand || "",
    startsAt: reward.startsAt || 0,
    endsAt: reward.endsAt || 0,
    minutes: reward.minutesGoal || 0,
    subs: reward.subsGoal || 0,
    link: "reward",
    seenAt: now,
  };
}

/**
 * Journal des badges : chaque badge du catalogue relié aux Drops (ou aux
 * récompenses de campagne) qui le donnent, avec les dates du Drop. Liaison
 * exacte par le nom de la récompense ; secours par le jeu, seulement pour une
 * campagne Twitch Gaming dont on n'a pas encore le détail. Dès que le détail
 * d'une campagne est connu, seuls les badges qu'elle nomme s'y rattachent.
 * Les événements finis restent 60 jours.
 */
export function buildBadgeEvents({ campaigns = [], rewards = [], catalog = [], previous = [], now }) {
  const byTitle = new Map();
  for (const badge of catalog) {
    const key = titleKey(badge.title);
    if (key && !byTitle.has(key)) byTitle.set(key, badge);
  }
  const named = (name) => byTitle.get(titleKey(name));
  const fresh = [];
  for (const campaign of campaigns) {
    for (const drop of campaign.drops || []) {
      for (const name of drop.badges || []) {
        const badge = named(name);
        if (badge) fresh.push(dropEvent(badge.id, campaign, drop, "reward", now));
      }
    }
  }
  for (const reward of rewards) {
    for (const item of reward.rewards || []) {
      const badge = named(item.name);
      if (badge) fresh.push(rewardEvent(badge.id, reward, item, now));
    }
  }
  const exact = new Set([...previous, ...fresh].filter((event) => event.link === "reward").map((event) => event.badgeId));
  for (const campaign of campaigns) {
    if (campaign.drops || !isTwitchGaming(campaign) || !campaign.game || !isActiveCampaign(campaign, now)) continue;
    for (const badge of catalog) {
      if (exact.has(badge.id) || RETIRED_BADGES.has(badge.id) || mentionsPastYear(badge, now)) continue;
      if (badgeGames(badge).some((game) => sameGame(game, campaign.game))) fresh.push(dropEvent(badge.id, campaign, null, "game", now));
    }
  }
  // Une campagne détaillée est recréée en entier par `fresh` : ses anciens événements partent.
  const detailed = new Set(campaigns.filter((campaign) => campaign.drops).map((campaign) => campaign.id));
  // Une campagne (ou récompense) que Twitch ne liste plus avant sa fin est close à ce moment-là.
  const listed = { drops: new Set(campaigns.map((campaign) => campaign.id)), rewards: new Set(rewards.map((reward) => reward.id)) };
  const sources = { drops: campaigns.length, rewards: rewards.length };
  const merged = new Map(previous
    .filter((event) => !(event.kind === "drops" && detailed.has(event.campaignId)))
    .map((event) => (sources[event.kind] && !listed[event.kind]?.has(event.campaignId) && event.endsAt > now ? { ...event, endsAt: now } : event))
    .map((event) => [eventKey(event), event]));
  for (const event of fresh) merged.set(eventKey(event), event);
  return [...merged.values()].filter((event) => (event.endsAt || event.seenAt) + EVENT_KEEP_MS > now);
}

// ─── Statuts de l'onglet Badges ───────────────────────────────────────────────

const VIEWER_ACTION = /\b(watch\w*|view\w*|subscrib\w*|gift\w*|cheer\w*|bits?)\b/i;
const NOT_VIEWER = /\b(creators?|streamers? who|tickets?|attend\w*|DJ Program|partners?|affiliates?)\b/i;

/** Badge qu'un spectateur peut gagner (regarder, s'abonner, offrir, Bits), pas un badge de créateur, de billet ou de salon. */
export function viewerEarnable(description) {
  const value = String(description || "");
  return VIEWER_ACTION.test(value) && !NOT_VIEWER.test(value);
}

const SET_ID = /^[a-z0-9][a-z0-9_-]{0,119}$/i;

/** Dates d'ajout renvoyées par streampulse.fr : { setID: ms }, valeurs illisibles écartées. */
export function normalizeAdded(raw) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  for (const [id, value] of Object.entries(raw)) {
    const at = timeOf(value);
    if (SET_ID.test(id) && at) out[id] = at;
  }
  return out;
}

export function addedFrom(stored = {}) {
  const value = (stored || {})[BADGE_ADDED_KEY];
  if (!isPlainObject(value)) return { fetchedAt: 0, added: {} };
  return { fetchedAt: timeOf(value.fetchedAt), added: normalizeAdded(value.added) };
}

/** Date d'ajout d'un badge : la plus ancienne entre celle du site et celle de l'appareil ; 0 si aucune. */
export function badgeAddedAt(badge, siteAdded = {}) {
  const values = [Number(siteAdded?.[badge.id]) || 0, Number(badge.firstSeen) || 0].filter((at) => at > 0);
  return values.length ? Math.min(...values) : 0;
}

const isLiveEvent = (event, now) => (!event.startsAt || event.startsAt <= now) && (!event.endsAt || event.endsAt > now);

/**
 * Statut d'un badge : `live` (un Drop qui le donne est ouvert ; le plus tardif
 * s'il y en a plusieurs), `soon` (un Drop démarre plus tard, ou badge ajouté
 * depuis moins de 30 jours, sans campagne, gagnable en spectateur), `ended`
 * (tous ses Drops finis, affiché 7 jours), sinon null.
 */
export function badgeStatus(badge, events, { now, addedAt = 0 }) {
  const mine = list(events).filter((event) => event.badgeId === badge.id);
  const live = mine.filter((event) => isLiveEvent(event, now)).sort((a, b) => (b.endsAt || Infinity) - (a.endsAt || Infinity));
  if (live.length) return { status: "live", event: live[0] };
  const later = mine.filter((event) => event.startsAt > now).sort((a, b) => a.startsAt - b.startsAt);
  if (later.length) return { status: "soon", event: later[0] };
  const ended = mine.filter((event) => event.endsAt && event.endsAt <= now).sort((a, b) => b.endsAt - a.endsAt);
  if (ended.length) return { status: now - ended[0].endsAt <= ENDED_SHOWN_MS ? "ended" : null, event: ended[0] };
  const recent = addedAt > 0 && now - addedAt <= SOON_WINDOW_MS;
  if (recent && viewerEarnable(badge.description) && !RETIRED_BADGES.has(badge.id) && !mentionsPastYear(badge, now)) return { status: "soon", event: null };
  return { status: null, event: null };
}

const STATUS_RANK = Object.freeze({ live: 0, soon: 1, ended: 2 });

/** En cours : fin la plus proche ; à venir : datés, puis ajoutés récemment ; terminés : fin la plus récente. */
function compareBadges(a, b) {
  const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (rank) return rank;
  if (a.status === "live") return (a.event?.endsAt || Infinity) - (b.event?.endsAt || Infinity) || a.title.localeCompare(b.title);
  if (a.status === "soon") return (a.event?.startsAt || Infinity) - (b.event?.startsAt || Infinity) || b.addedAt - a.addedAt || a.title.localeCompare(b.title);
  return (b.event?.endsAt || 0) - (a.event?.endsAt || 0) || a.title.localeCompare(b.title);
}

/**
 * Badges de l'onglet, chacun avec son statut, l'événement retenu (dates,
 * condition), sa date d'ajout et son coût. `status` : live | soon | ended |
 * owned | all ; `cost` : all | free | paid. `campaign` garde la forme attendue
 * par le mode auto (badge-auto.js) : le Drop en cours et son jeu.
 */
export function catalogBadges(state, { status = "all", cost = "all", query = "", now = Date.now(), events = [], added = {} } = {}) {
  const owned = new Set(state.owned);
  const needle = String(query || "").trim().toLowerCase();
  return state.badges
    .map((badge) => {
      const addedAt = badgeAddedAt(badge, added);
      const result = badgeStatus(badge, events, { now, addedAt });
      const event = result.event;
      const paid = event?.subs > 0 ? true : event?.minutes > 0 ? false : isPaidBadge(badge);
      return {
        ...badge,
        owned: owned.has(badge.id),
        paid,
        addedAt,
        status: result.status,
        event,
        campaign: result.status === "live" && event?.kind === "drops" ? { id: event.campaignId, game: event.game, gameId: event.gameId, endsAt: event.endsAt } : null,
      };
    })
    .filter((badge) => badge.status !== null)
    .filter((badge) => status === "all" || (status === "owned" ? badge.owned : badge.status === status))
    .filter((badge) => cost === "all" || badge.paid === (cost === "paid"))
    .filter((badge) => !needle || `${badge.title} ${badge.description}`.toLowerCase().includes(needle))
    .sort(status === "owned" ? (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.title.localeCompare(b.title) : compareBadges);
}

export function countBadges(state, context = {}) {
  const all = catalogBadges(state, { ...context, status: "all", cost: "all", query: "" });
  return {
    all: all.length,
    live: all.filter((badge) => badge.status === "live").length,
    soon: all.filter((badge) => badge.status === "soon").length,
    ended: all.filter((badge) => badge.status === "ended").length,
    owned: all.filter((badge) => badge.owned).length,
    liveFree: all.filter((badge) => badge.status === "live" && !badge.paid).length,
  };
}

export function newBadges(state, now, windowMs = NEW_BADGE_MS) {
  const owned = new Set(state.owned);
  // Nouveauté au sens large : set inédit, ou nouvelle version d'une série
  // connue (palier de sub en plus) — la plus récente des deux dates fait foi.
  // Les badges d'événements terminés ne sont pas des nouveautés.
  return state.badges
    .filter((badge) => !RETIRED_BADGES.has(badge.id))
    .map((badge) => ({ ...badge, lastNews: Math.max(badge.firstSeen || 0, badge.newVersionAt || 0) }))
    .filter((badge) => badge.lastNews > 0 && now - badge.lastNews <= windowMs)
    .map((badge) => ({ ...badge, owned: owned.has(badge.id), paid: isPaidBadge(badge) }))
    .sort((a, b) => b.lastNews - a.lastNews);
}
