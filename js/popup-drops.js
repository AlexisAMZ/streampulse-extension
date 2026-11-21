// Drops Twitch dans le popup : bande « Drops en cours » de l'accueil, puce
// « Drops du jour », et panneau Drops des Réglages (en cours, campagnes et,
// avec StreamPulse+, historique). Lit le storage que le service worker
// alimente ; tous les calculs viennent de drops-data.js et badges-data.js.

import { t, tp, getCurrentLanguage } from "./i18n.js";
import { claimedDropIds, currentGroup, isCampaignDone, isDropJob, normalizeAuto } from "./badge-auto.js";
import { BADGE_FREE_KEY, freeAvailable, freeUsedToday } from "./badge-free.js";
import { BADGE_LIMITED_KEY, BADGE_SCOPE_KEY, BADGE_WATCH_KEY, ENDING_SOON_MS, limitedFrom, toggleWatch, watchFrom } from "./badge-watch.js";
import { DROP_ALERTS_KEY } from "./drop-alerts.js";
import { createScopeEditor } from "./popup-alert-scope.js";
import { REFRESH_CHOICES, effectiveRefreshMinutes } from "./refresh-interval.js";
import { MISSED_KEY, markSeen, missedFrom, weekSummary } from "./missed-alerts.js";
import {
  DROPS_KEYS,
  BADGE_AUTO_KEY,
  activeRewards,
  isActiveCampaign,
  isBadgeCampaign,
  bandModel,
  campaignsFrom,
  countFilters,
  currentDrops,
  dropsToday,
  filterCampaigns,
  historyFrom,
  isClaimable,
  isEndingSoon,
  isMine,
  isNewCampaign,
  lastReadAt,
  myGamesFrom,
  progressFrom,
  recentClaims,
  remainingMinutes,
  rewardsFrom,
  summarizeHistory,
  watchedMinutesFor,
} from "./drops-data.js";
import {
  addedFrom,
  badgesFrom,
  catalogBadges,
  countBadges,
  eventsFrom,
  newBadges,
  gameFromDescription,
} from "./badges-data.js";
import { buildRewardPlan, normalizePlanSelection } from "./reward-plan.js";
import { KICK_DROPS_KEY, kickDropsFrom, isKickBadge, kickBadgesFrom } from "./kick-drops-data.js";

const $ = (id) => document.getElementById(id);
/** Descriptions de badges traduites par le site (DeepL), gardées par langue. */
const BADGE_TEXT_URL = "https://streampulse.tech/api/twitch-badges";
const BADGE_TEXT_KEY = "streamPulseBadgeText";
const REWARD_PLAN_KEY = "streamPulseRewardPlan";
export const DROPS_PLATFORM_KEY = "streamPulseDropsPlatform";
export const BADGES_PLATFORM_KEY = "streamPulseBadgesPlatform";
let dropsPlatform = "all";
let badgesPlatform = "all";

export function setDropsPlatformForTest(platform) {
  dropsPlatform = platform;
}
export function setBadgesPlatformForTest(platform) {
  badgesPlatform = platform;
}
export function getDropsPlatform() {
  return dropsPlatform;
}
export function getBadgesPlatform() {
  return badgesPlatform;
}

function renderPlatformFilter(groupId, current) {
  document.querySelectorAll(`#${groupId} [data-platform]`).forEach((btn) => {
    const active = btn.dataset.platform === current;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}
const BADGE_TEXT_MAX_AGE_MS = 7 * 86_400_000;
let badgeText = {};
let badgeAuto = null;
/** Badge gratuit du jour (sans StreamPulse+), voir js/badge-free.js. */
let badgeFree = null;
/** Badges suivis avec la cloche : { [badgeId]: { at, live } }. */
let badgeWatch = {};
/** StreamPulse+ : alerte pour tout badge temporaire (une journée ou moins). */
let badgeLimited = false;
/** Une seule tentative par badge et par ouverture du popup : pas de boucle si le site ne traduit pas. */
const badgeTextTried = new Set();
const PREFERENCES_KEY = "betaGeneralPreferences";
const WATCH_DAILY_KEY = "streamPulseWatchTimeDaily";
const CAMPAIGNS_PAGE = "https://www.twitch.tv/drops/campaigns";
const LIVE_247_PAGE = "https://www.twitch.tv/streampulse247";
const CAMPAIGN_ROWS = 40;
const HISTORY_ROWS = 80;
/** Le panneau rappelle les Drops récupérés depuis ce délai, sous ceux en cours. */
const CLAIMED_SHOWN_MS = 12 * 3_600_000;
const CLAIMED_SHOWN_MAX = 3;
const CLAIM_PENDING_MS = 20_000;
const TICK_MS = 30_000;
/** Au-delà, l'onglet Badges signale que les campagnes n'ont pas été relues. */
const CAMPAIGNS_OLD_MS = 12 * 3_600_000;
const BADGE_SORT_KEYS = Object.freeze({ live: "popup.drops.badgeSortLive", soon: "popup.drops.badgeSortSoon", ended: "popup.drops.badgeSortEnded", owned: "popup.drops.badgeSortOwned" });
const BADGE_EMPTY_KEYS = Object.freeze({ live: "popup.drops.badgesEmptyLive", soon: "popup.drops.badgesEmptySoon", ended: "popup.drops.badgesEmptyEnded", owned: "popup.drops.badgesEmptyOwned" });
const GIFT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>';

/** Alertes de campagnes Drops (Plus) : { enabled, games }, lu comme le reste. */

let deps = { isPlus: () => false, openPlus: () => {} };
let twitchLogin = "";

/** Vérifie si l'utilisateur est connecté à Twitch (cookie login ou auth-token sur twitch.tv). */
export async function isTwitchSignedIn() {
  try {
    if (typeof chrome !== "undefined" && chrome.cookies?.get) {
      const loginCookie = await chrome.cookies.get({ url: "https://www.twitch.tv", name: "login" }).catch(() => null);
      if (loginCookie?.value) {
        twitchLogin = decodeURIComponent(loginCookie.value);
        return true;
      }
      const authCookie = await chrome.cookies.get({ url: "https://www.twitch.tv", name: "auth-token" }).catch(() => null);
      if (authCookie?.value) {
        twitchLogin = "signed-in";
        return true;
      }
      twitchLogin = "";
      return false;
    }
  } catch {
    // cookies non disponibles
  }
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      const res = await chrome.runtime.sendMessage({ type: "getTwitchLogin" }).catch(() => null);
      if (res?.login) {
        twitchLogin = res.login;
        return true;
      }
      if (res && res.login === "") {
        twitchLogin = "";
        return false;
      }
    }
  } catch {
    // repli
  }
  return Boolean(twitchLogin);
}

export function setTwitchLoginForTest(val) {
  twitchLogin = val;
}
let progress = progressFrom({});
let campaigns = campaignsFrom({});
let rewards = rewardsFrom({});
let badges = badgesFrom({});
let history = [];
let prefs = {};
let missed = missedFrom(null);
let myGames = new Set();
// Temps de visionnage brut (par jour, chaîne et jeu) : alimente l'estimation
// locale de progression des campagnes de badges à objectif de minutes.
let watchDaily = {};
let filter = "all";
let badgeEvents = eventsFrom({});
let badgeAdded = addedFrom({});
let badgeFilter = "live";
let badgeCost = "all";
let badgeQuery = "";
let badgeLimit = 40;
/** Campagnes affichées : la liste en compte une centaine, le reste se déplie avec « Voir plus ». */
let campaignLimit = CAMPAIGN_ROWS;
let rewardPlan = normalizePlanSelection(null);
let kickDrops = kickDropsFrom({});
/** Récupérations demandées depuis ce popup : instanceId → heure de la demande. */
const claiming = new Map();

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// ─── Formats ──────────────────────────────────────────────────────────────────

const locale = () => getCurrentLanguage();
const unit = (value, name) => new Intl.NumberFormat(locale(), { style: "unit", unit: name, unitDisplay: "short" }).format(value);

/** Minutes restantes ou durée en minutes, heures ou jours : « 27 min », « 1 h 38 min », « 5 h », « 10 j 10 h ». */
export function minutesLabel(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m < 60) return unit(m, "minute");
  if (m < 1440) {
    const hours = Math.floor(m / 60);
    const rest = m % 60;
    return rest ? `${unit(hours, "hour")} ${unit(rest, "minute")}` : unit(hours, "hour");
  }
  const days = Math.floor(m / 1440);
  const remainingMin = m % 1440;
  const hours = Math.floor(remainingMin / 60);
  return hours ? `${unit(days, "day")} ${unit(hours, "hour")}` : unit(days, "day");
}

/** Durée jusqu'à une échéance, à l'unité la plus parlante : « 1 j », « 5 h », « 40 min ». */
function spanLabel(ms) {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes >= 1440) return unit(Math.round(minutes / 1440), "day");
  if (minutes >= 60) return unit(Math.round(minutes / 60), "hour");
  return unit(minutes, "minute");
}

function agoLabel(at, now) {
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: "auto" });
  const minutes = Math.round((at - now) / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

const clock = (at) => new Date(at).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
const shortDate = (at) => new Date(at).toLocaleDateString(locale(), { day: "numeric", month: "short" });
const dateTime = (at) => `${shortDate(at)}, ${clock(at)}`;

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(locale(), { month: "long", year: "numeric" });
}

const plural = (count, key, params = {}) => tp(key, count, params);

function channelLabel(drop) {
  const name = drop.channel || (drop.channelId && progress.channels?.[drop.channelId]) || "";
  if (name) return t("popup.drops.onChannel", { channel: name });
  return drop.anyChannel ? t("popup.drops.anyChannel") : "";
}

const endsLabel = (drop, now) => (drop.endsAt > now ? t("popup.drops.endsIn", { time: spanLabel(drop.endsAt - now) }) : "");
const percent = (drop) => (drop.required ? Math.min(100, (drop.minutes / drop.required) * 100) : 0);
const autoClaimOn = () => prefs.autoClaimDrops !== false;
const trackingOn = () => prefs.dropsTracking !== false;

function thumb(url, className) {
  const box = el("span", className);
  if (url) {
    const img = el("img");
    img.src = url;
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => {
      img.remove();
      box.innerHTML = GIFT_ICON;
    };
    box.append(img);
  } else {
    box.innerHTML = GIFT_ICON;
  }
  return box;
}

/** Jauge : width 100 % fixe, remplie par scaleX (bornée ; illisible → vide). Pur, testé. */
export function fillTransform(percentValue) {
  const value = Number(percentValue);
  if (!Number.isFinite(value)) return "scaleX(0)";
  const ratio = Math.min(1, Math.max(0, value / 100));
  return `scaleX(${Math.round(ratio * 1000) / 1000})`;
}

function setFill(element, percentValue) {
  if (element) element.style.transform = fillTransform(percentValue);
}

function bar(drop) {
  const track = el("span", "drops-bar");
  const fill = el("i");
  setFill(fill, percent(drop));
  track.append(fill);
  return track;
}

// ─── Accueil : bande et puce ──────────────────────────────────────────────────

/**
 * Pastille de l'accueil (maquette H1) : le Drop qui avance avec son liseré de
 * progression, sinon le dernier récupéré, sinon le compte du jour. Le popup
 * est plafonné à 600 px par Chrome : une pastille ne prend rien à la scène.
 */
function renderChip(now) {
  const chip = $("activity-drops");
  if (!chip) return;
  const model = trackingOn() ? bandModel(progress, history, now) : null;
  const today = trackingOn() ? dropsToday(history, now) : 0;
  chip.hidden = !model && today === 0;
  chip.classList.toggle("is-progress", model?.kind === "progress");
  chip.classList.toggle("is-claimed", model?.kind === "claimed");
  let fill = chip.querySelector(".chip-fill");
  if (!fill) {
    fill = el("span", "chip-fill");
    chip.append(fill);
  }
  const label = chip.querySelector(".chip-label");
  let text;
  if (model?.kind === "progress") {
    const { drop } = model;
    const left = isClaimable(drop) ? t("popup.drops.ready") : t("popup.drops.timeLeft", { time: minutesLabel(remainingMinutes(drop)) });
    const more = model.others ? plural(model.others, "popup.drops.bandMore") : "";
    text = [drop.name, left, more].filter(Boolean).join(" · ");
    setFill(fill, percent(drop));
    chip.title = [drop.game, channelLabel(drop), model.stale ? t("popup.drops.staleHint") : endsLabel(drop, now)].filter(Boolean).join(" · ");
  } else if (model?.kind === "claimed") {
    text = t("popup.drops.bandClaimed", { name: model.entry.name });
    setFill(fill, 0);
    chip.title = model.entry.game || "";
  } else {
    text = plural(today, "popup.cplus.dropsToday");
    setFill(fill, 0);
    chip.title = "";
  }
  if (label) label.textContent = text;
}

// ─── Panneau : en cours ───────────────────────────────────────────────────────

/**
 * Un Drop prêt garde son bouton même avec la récupération auto : si Twitch la
 * refuse, l'utilisateur peut toujours relancer à la main.
 */
function readySide(drop, now) {
  const side = el("div", "drop-side");
  const pending = claiming.get(drop.instanceId);
  if (pending && now - pending < CLAIM_PENDING_MS) {
    side.append(el("span", "drops-tag is-pending", t("popup.drops.claiming")));
    return side;
  }
  const button = el("button", "button button-primary drops-claim", t("popup.drops.claim"));
  button.type = "button";
  button.dataset.claim = drop.instanceId;
  side.append(button);
  return side;
}

function progressRow(drop, now) {
  const ready = isClaimable(drop);
  const row = el("li", ready ? "drop-row is-ready" : "drop-row");
  const main = el("div", "drop-main");
  main.append(el("b", null, drop.name), el("small", null, [drop.game, channelLabel(drop)].filter(Boolean).join(" · ")));
  if (!ready) main.append(bar(drop));
  let side;
  if (ready) {
    side = readySide(drop, now);
  } else {
    side = el("div", "drop-side");
    side.append(el("b", null, t("popup.drops.timeLeft", { time: minutesLabel(remainingMinutes(drop)) })), el("small", null, [t("popup.drops.progress", { minutes: drop.minutes, required: drop.required }), endsLabel(drop, now)].filter(Boolean).join(" · ")));
  }
  row.append(thumb(drop.image, "drop-img"), main, side);
  return row;
}

function claimedRow(entry) {
  const row = el("li", "drop-row is-ready");
  const main = el("div", "drop-main");
  main.append(el("b", null, entry.name), el("small", null, t(entry.auto ? "popup.drops.claimedAuto" : "popup.drops.claimedAt", { time: clock(entry.at) })));
  const side = el("div", "drop-side");
  side.append(el("span", "drops-tag", t("popup.drops.inInventory")));
  row.append(thumb(entry.image, "drop-img"), main, side);
  return row;
}

function kickBoxedRow(boxed) {
  const row = el("li", "drop-row is-ready kick-boxed-row");
  const icon = el("div", "drop-img");
  icon.innerHTML = GIFT_ICON;
  const main = el("div", "drop-main");
  const count = boxed.length;
  const label = count > 1 ? `${count} coffres Kick prêts à ouvrir !` : "Coffre Kick prêt à ouvrir !";
  main.append(el("b", null, label), el("small", null, boxed.map((b) => b.label).join(", ")));
  const side = el("div", "drop-side");
  const btn = el("button", "button button-primary button-small", "Ouvrir");
  btn.type = "button";
  btn.addEventListener("click", () => {
    btn.disabled = true;
    btn.textContent = "...";
    chrome.runtime.sendMessage({ type: "unboxKickRewards", ids: boxed.map((b) => b.id) }).then(() => {
      reload();
    }).catch(() => {
      btn.disabled = false;
      btn.textContent = "Ouvrir";
    });
  });
  side.append(btn);
  row.append(icon, main, side);
  return row;
}

function kickChallengeRow(ch) {
  const row = el("li", ch.ready ? "drop-row is-ready" : "drop-row");
  const icon = el("div", "drop-img");
  icon.innerHTML = GIFT_ICON;
  const main = el("div", "drop-main");
  const tag = el("span", "plat-tag-kick", "KICK");
  const title = el("b", null, ch.name);
  const meta = el("small");
  meta.append(tag, `${minutesLabel(ch.minutes)} / ${minutesLabel(ch.required)} · Défi quotidien`);
  main.append(title, meta);
  if (!ch.ready) main.append(bar(ch));
  const side = el("div", "drop-side");
  if (ch.ready) {
    const btn = el("a", "button button-primary button-small", "Récupérer");
    btn.href = ch.url || "https://kick.com/drops/rewards";
    btn.target = "_blank";
    btn.rel = "noopener";
    side.append(btn);
  } else {
    const left = Math.max(0, ch.required - ch.minutes);
    side.append(
      el("b", null, t("popup.drops.timeLeft", { time: minutesLabel(left) })),
      el("small", null, "Kick Rewards")
    );
  }
  row.append(icon, main, side);
  return row;
}

function kickDropRow(drop) {
  const row = el("li", drop.ready ? "drop-row is-ready" : "drop-row");
  const main = el("div", "drop-main");
  const tag = el("span", "plat-tag-kick", "KICK");
  const title = el("b", null, drop.name);
  const meta = el("small");
  meta.append(tag, `${drop.game} · ${minutesLabel(drop.minutes)} / ${minutesLabel(drop.required)}`);
  main.append(title, meta);
  if (!drop.ready) main.append(bar(drop));
  const side = el("div", "drop-side");
  if (drop.ready) {
    const btn = el("a", "button button-primary button-small", "Réclamer");
    btn.href = "https://kick.com/drops/campaigns";
    btn.target = "_blank";
    btn.rel = "noopener";
    side.append(btn);
  } else {
    const link = el("a", null, "Regarder");
    link.href = drop.url || "https://kick.com/drops/campaigns";
    link.target = "_blank";
    link.rel = "noopener";
    const left = Math.max(0, drop.required - drop.minutes);
    side.append(
      el("b", null, t("popup.drops.timeLeft", { time: minutesLabel(left) })),
      el("small", null, link)
    );
  }
  row.append(thumb(drop.image, "drop-img"), main, side);
  return row;
}

function renderProgress(now) {
  const showTwitch = dropsPlatform === "all" || dropsPlatform === "twitch";
  const showKick = dropsPlatform === "all" || dropsPlatform === "kick";

  const drops = showTwitch ? currentDrops(progress, now) : [];
  const claimed = showTwitch ? recentClaims(history, now, CLAIMED_SHOWN_MS).slice(0, CLAIMED_SHOWN_MAX) : [];
  const kickBoxed = showKick ? (kickDrops.boxed || []) : [];
  const kickChallenges = showKick ? (kickDrops.challenges || []).filter((c) => !c.claimed && !isKickBadge(c)) : [];
  const kickProgress = showKick ? (kickDrops.progress || []).filter((p) => !p.claimed && !isKickBadge(p)) : [];

  const rows = [
    ...(kickBoxed.length ? [kickBoxedRow(kickBoxed)] : []),
    ...kickChallenges.map(kickChallengeRow),
    ...kickProgress.map(kickDropRow),
    ...drops.map((drop) => progressRow(drop, now)),
    ...claimed.map(claimedRow),
  ];

  $("drops-progress").replaceChildren(...rows);
  const isTwitchConnected = Boolean(twitchLogin);
  const dropsAuthNotice = $("drops-auth-notice");
  if (dropsAuthNotice) {
    dropsAuthNotice.hidden = dropsPlatform === "kick" || isTwitchConnected;
    const textEl = $("drops-auth-notice-text");
    if (textEl) textEl.textContent = t("popup.drops.dropsAuthNotice");
  }
  const emptyProgress = $("drops-progress-empty");
  if (emptyProgress) {
    emptyProgress.hidden = rows.length > 0;
    emptyProgress.textContent = (!isTwitchConnected && dropsPlatform !== "kick")
      ? t("popup.drops.emptyProgressSignedOut")
      : t("popup.drops.emptyProgress");
  }
  const readAt = lastReadAt(progress);
  $("drops-updated").textContent = readAt ? t("popup.drops.updatedAgo", { ago: agoLabel(readAt, now) }) : t("popup.drops.neverRead");
}

// ─── Panneau : campagnes ──────────────────────────────────────────────────────

function campaignWhen(campaign, now) {
  if (campaign.startsAt > now) return { text: t("popup.drops.startsIn", { time: spanLabel(campaign.startsAt - now) }), tone: "new" };
  const range = campaign.startsAt && campaign.endsAt ? t("popup.drops.dateRange", { start: shortDate(campaign.startsAt), end: shortDate(campaign.endsAt) }) : "";
  if (isEndingSoon(campaign, now)) return { text: t("popup.drops.endsIn", { time: spanLabel(campaign.endsAt - now) }), tone: "soon" };
  if (isNewCampaign(campaign, now)) return { text: [t("popup.drops.isNew"), range].filter(Boolean).join(" · "), tone: "new" };
  return { text: range, tone: "" };
}

function campaignRow(campaign, now) {
  const isKick = campaign.platform === "kick";
  const mine = !isKick && isMine(campaign, myGames);
  const item = el("li");
  const button = el("button", mine ? "camp-row is-mine" : "camp-row");
  button.type = "button";
  if (isKick) {
    button.dataset.kickUrl = campaign.url || "https://kick.com/drops/campaigns";
  } else {
    button.dataset.gameId = campaign.gameId || "";
    button.dataset.game = campaign.game;
  }
  if (campaign.name) button.title = campaign.name;

  const box = el("span", "camp-box");
  if (campaign.boxArt) {
    const img = el("img");
    img.src = campaign.boxArt;
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => img.remove();
    box.append(img);
  }

  const meta = [
    isKick ? null : campaign.owner,
    campaign.rewardCount ? plural(campaign.rewardCount, "popup.drops.rewards") : "",
    campaign.connected === false && campaign.accountLinkUrl ? t("popup.drops.linkAccount") : "",
    mine ? t("popup.drops.yourGames") : "",
  ].filter(Boolean).join(" · ");
  const main = el("span", "camp-main");
  const title = el("b", null, campaign.game);
  if (isKick) {
    title.prepend(el("span", "plat-tag-kick", "KICK"));
  }
  main.append(title, el("small", null, meta));

  const side = el("span", "camp-side");
  if (campaign.badgeOnly) side.append(el("span", "camp-badge", t("popup.drops.badge")));
  const when = campaignWhen(campaign, now);
  if (when.text) side.append(el("span", when.tone ? `camp-when is-${when.tone}` : "camp-when", when.text));

  button.append(box, main, side);
  if (isKick && campaign.url) {
    button.addEventListener("click", () => {
      chrome.tabs.create({ url: campaign.url });
    });
  }
  item.append(button);
  const auto = campaignAutoButton(campaign, now);
  if (auto) {
    item.classList.add("has-camp-auto");
    item.append(auto);
  }
  return item;
}

const dropJobId = (campaign) => `drop:${campaign.id}`;

/** Campagne que le mode auto peut farmer : en cours, compte lié, pas déjà tout récupéré. */
function isFarmable(campaign, now) {
  if (campaign.platform === "kick") return false;
  return isActiveCampaign(campaign, now) && campaign.connected !== false && !isCampaignDone(campaign, claimedDropIds(history, progress.drops))
    && (!campaign.drops || campaign.drops.some((drop) => drop.minutes > 0));
}

/** Barre sous la ligne, comme sur les badges : lance (▶), met en file (horloge) ou retire la campagne du mode auto. */
function campaignAutoButton(campaign, now) {
  if (!isFarmable(campaign, now)) return null;
  const id = dropJobId(campaign);
  const state = autoState(id);
  const on = state !== "off";
  const button = el("button", on ? `camp-auto is-on${state === "queued" ? " is-queued" : ""}` : "camp-auto");
  button.type = "button";
  button.dataset.campAuto = campaign.id;
  button.innerHTML = state === "running"
    ? '<span class="badge-auto-dot" aria-hidden="true"></span>'
    : state === "queued"
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>';
  // Même libellé que sur les badges : on voit tout de suite ce que fait le bouton.
  button.append(el("span", null, t(state === "running" ? "popup.drops.badgeAutoOn" : state === "queued" ? "popup.drops.badgeAutoQueued" : "popup.drops.badgeAuto")));
  const label = t(state === "running" ? "popup.drops.campAutoOn" : state === "queued" ? "popup.drops.campAutoQueued" : "popup.drops.campAuto", { game: campaign.game });
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", on ? "true" : "false");
  return button;
}

/** Ajoute une campagne à la file du mode auto, ou l'en retire (le service worker gère l'onglet). */
function toggleCampaignAuto(campaignId) {
  const campaign = campaigns.campaigns.find((item) => item.id === campaignId);
  if (!campaign) return;
  const id = dropJobId(campaign);
  if (autoState(id) !== "off") {
    sendAuto({ type: "badgeAutoStop", badgeId: id });
    return;
  }
  if (!deps.isPlus()) {
    deps.openPlus();
    return;
  }
  sendAuto({
    type: "badgeAutoStart",
    badge: { badgeId: id, title: campaign.name || campaign.game, image: campaign.boxArt, game: campaign.game, gameId: campaign.gameId, campaignId: campaign.id, endsAt: campaign.endsAt },
  }).then((result) => {
    if (result?.plusRequired) deps.openPlus();
  });
}

function renderCampaigns(now) {
  if (!$("drops-campaigns")) return;
  const showTwitch = dropsPlatform === "all" || dropsPlatform === "twitch";
  const showKick = dropsPlatform === "all" || dropsPlatform === "kick";

  // Les campagnes de badges (PAYDAY 3, ATLUS…) sont dans l'onglet Badges, réservé à StreamPulse+.
  const kickDropsCampaigns = showKick
    ? (kickDrops.campaigns || []).filter((c) => !isBadgeCampaign(c) && !isKickBadge(c))
    : [];
  const twitchCampaigns = showTwitch
    ? campaigns.campaigns.filter((campaign) => !isBadgeCampaign(campaign))
    : [];
  const all = [
    ...twitchCampaigns,
    ...kickDropsCampaigns,
  ];
  const counts = countFilters(all, now);
  document.querySelectorAll("#drops-filters [data-filter]").forEach((button) => {
    const active = button.dataset.filter === filter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    const count = button.querySelector("[data-count]");
    if (count) count.textContent = all.length ? String(counts[button.dataset.filter] ?? 0) : "";
  });
  const updatedAt = campaigns.updatedAt || 0;
  $("drops-campaigns-meta").textContent = updatedAt
    ? t("popup.drops.campaignsMeta", { count: counts.all, ago: agoLabel(updatedAt, now) })
    : "";

  const matching = filterCampaigns(all, filter, now, myGames);
  const shown = matching.slice(0, campaignLimit);
  $("drops-campaigns").replaceChildren(...shown.map((campaign) => campaignRow(campaign, now)));
  $("drops-campaigns-more").hidden = matching.length <= campaignLimit;
  const empty = shown.length === 0;
  $("drops-campaigns-empty").hidden = !empty;
  if (!empty) return;
  const key = !all.length ? "popup.drops.campaignsNone" : filter === "upcoming" ? "popup.drops.upcomingEmpty" : "popup.drops.filterEmpty";
  $("drops-campaigns-empty-text").textContent = t(key);
  $("drops-open-campaigns").hidden = all.length > 0;
}

// ─── Panneau : planificateur local (sans appel réseau) ────────────────────────

const PLAN_CAMPAIGN_LIMIT = 12;
const BUDGET_PRESETS = [30, 60, 120, 240];

/** Campagnes en cours avec leurs Drops chronométrés ; celles de tes jeux d'abord. */
function rewardPlanRows(now) {
  const current = campaigns.campaigns.filter((campaign) => !isBadgeCampaign(campaign) && Array.isArray(campaign.drops));
  return filterCampaigns(current, "all", now, myGames)
    .map((campaign) => ({ campaign, drops: campaign.drops.filter((drop) => (Number(drop.minutes) || 0) > 0) }))
    .filter((entry) => entry.drops.length)
    .slice(0, PLAN_CAMPAIGN_LIMIT);
}

function saveRewardPlan(next) {
  rewardPlan = normalizePlanSelection(next);
  chrome.storage.local.set({ [REWARD_PLAN_KEY]: rewardPlan }).catch(() => {
    const status = $("reward-plan-status");
    if (status) status.textContent = t("popup.rewardPlan.writeError");
  });
}

/** Minutes déjà regardées, par Drop, d'après la progression suivie. */
function watchedMinutesById() {
  return Object.fromEntries(progress.drops.map((drop) => [drop.id, drop.minutes || 0]));
}

function renderRewardPlan(now = Date.now(), { force = false } = {}) {
  const host = $("reward-plan");
  if (!host) return;
  const entries = rewardPlanRows(now);
  // La progression bouge à chaque minute : sans changement de campagnes ni de langue, seul le résumé se met à jour,
  // pour garder les campagnes ouvertes, le focus et la saisie.
  const key = `${getCurrentLanguage()}|${entries.map((entry) => `${entry.campaign.id}:${entry.drops.length}`).join(",")}`;
  if (!force && host._planKey === key && host._updateSummary) {
    host._updateSummary();
    return;
  }
  host._planKey = key;
  host.replaceChildren();
  const heading = el("h3", "settings-group-header");
  heading.textContent = t("popup.rewardPlan.title");
  const intro = el("p", "settings-description");
  intro.textContent = t("popup.rewardPlan.description");
  host.append(heading, intro);
  if (!entries.length) {
    const empty = el("p", "settings-note");
    empty.textContent = t(campaigns.updatedAt ? "popup.drops.campaignsNone" : "popup.rewardPlan.loading");
    host.append(empty);
    host._updateSummary = null;
    return;
  }
  const available = new Set(entries.flatMap((entry) => entry.drops.map((drop) => drop.id)));
  rewardPlan = { ...rewardPlan, selectedIds: rewardPlan.selectedIds.filter((id) => available.has(id)) };
  const chosen = () => new Set(rewardPlan.selectedIds);
  const counters = [];

  // Les listes restent repliées : une campagne ne s'ouvre que si elle contient un choix.
  for (const entry of entries) {
    const group = el("details", "reward-plan-group");
    const picked = entry.drops.filter((drop) => chosen().has(drop.id)).length;
    group.open = picked > 0;
    const summary = el("summary");
    const name = el("span", "reward-plan-name", entry.campaign.game || entry.campaign.name || t("popup.drops.badgesCampaign"));
    const count = el("span", "reward-plan-count");
    summary.append(name, count);
    group.append(summary);
    const syncCount = () => {
      const n = entry.drops.filter((drop) => chosen().has(drop.id)).length;
      count.textContent = n ? t("popup.rewardPlan.selectedCount", { count: n }) : "";
      count.hidden = n === 0;
    };
    counters.push(syncCount);
    syncCount();
    for (const drop of entry.drops) {
      const label = el("label", "settings-toggle");
      const text = el("span", "settings-text");
      text.append(el("span", "settings-title", drop.name || drop.id), el("span", "settings-note", t("popup.rewardPlan.minutes", { count: drop.minutes })));
      const input = el("input");
      input.type = "checkbox";
      input.value = drop.id;
      input.checked = chosen().has(drop.id);
      input.setAttribute("role", "switch");
      input.setAttribute("aria-label", t("popup.rewardPlan.select", { name: drop.name || drop.id }));
      input.addEventListener("change", () => {
        const next = chosen();
        if (input.checked) next.add(drop.id);
        else next.delete(drop.id);
        saveRewardPlan({ ...rewardPlan, selectedIds: [...next] });
        counters.forEach((sync) => sync());
        updateSummary();
      });
      label.append(text, input);
      group.append(label);
    }
    host.append(group);
  }

  // Temps disponible : le champ ne se recrée jamais, il garde focus et saisie.
  const budgetRow = el("div", "reward-plan-budget");
  const budgetLabel = el("label", "settings-title", t("popup.rewardPlan.budget"));
  budgetLabel.htmlFor = "reward-plan-budget";
  const budget = el("input", "text-input");
  budget.id = "reward-plan-budget";
  budget.type = "number";
  budget.inputMode = "numeric";
  budget.min = "0";
  budget.max = "720";
  budget.step = "5";
  budget.value = rewardPlan.budgetMinutes ?? "";
  const presets = el("div", "segmented reward-plan-presets");
  presets.setAttribute("role", "group");
  presets.setAttribute("aria-label", t("popup.rewardPlan.budget"));
  const syncPresets = () => presets.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.minutes) === rewardPlan.budgetMinutes)));
  const setBudget = (minutes) => {
    saveRewardPlan({ ...rewardPlan, budgetMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : null });
    syncPresets();
    updateSummary();
  };
  for (const minutes of BUDGET_PRESETS) {
    const preset = el("button", "pf-btn", formatPlanDuration(minutes));
    preset.type = "button";
    preset.dataset.minutes = String(minutes);
    preset.addEventListener("click", () => {
      budget.value = String(minutes);
      setBudget(minutes);
    });
    presets.append(preset);
  }
  budget.addEventListener("input", () => setBudget(Number(budget.value)));
  syncPresets();
  budgetRow.append(budgetLabel, presets, budget);
  host.append(budgetRow);

  const status = el("p", "settings-note");
  status.id = "reward-plan-status";
  status.setAttribute("role", "status");
  const detail = el("ul", "reward-plan-rows");
  host.append(status, detail);

  function updateSummary() {
    detail.replaceChildren();
    if (!rewardPlan.selectedIds.length) {
      status.textContent = t("popup.rewardPlan.empty");
      return;
    }
    const plan = buildRewardPlan({
      campaigns: entries.map((entry) => entry.campaign),
      selectedIds: rewardPlan.selectedIds,
      budgetMinutes: rewardPlan.budgetMinutes,
      progressById: watchedMinutesById(),
      now: Date.now(),
    });
    status.textContent = [
      t("popup.rewardPlan.total", { time: formatPlanDuration(plan.totalMinutes) }),
      plan.overBudget ? t("popup.rewardPlan.overBudget", { time: formatPlanDuration(plan.totalMinutes - plan.budgetMinutes) }) : "",
      plan.budgetMinutes !== null && !plan.overBudget ? t("popup.rewardPlan.withinBudget") : "",
      plan.incomplete ? t("popup.rewardPlan.unknown") : "",
    ].filter(Boolean).join(" ");
    detail.append(...plan.rows.map((row) => {
      const item = el("li", row.impossibleDeadline ? "is-late" : "");
      const left = row.minutesRemaining === null ? t("popup.rewardPlan.unknownDuration") : t("popup.rewardPlan.remaining", { time: formatPlanDuration(row.minutesRemaining) });
      item.append(el("span", "reward-plan-row-name", row.name), el("span", "reward-plan-row-left", left));
      if (row.impossibleDeadline) item.append(el("span", "reward-plan-row-late", t("popup.rewardPlan.impossible")));
      return item;
    }));
  }
  updateSummary();
  host._updateSummary = updateSummary;
}

function formatPlanDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (!h) return t("popup.rewardPlan.minutes", { count: m });
  return m ? `${h} h ${t("popup.rewardPlan.minutes", { count: m })}` : `${h} h`;
}

// ─── Panneau : alertes de campagnes (StreamPulse+) ────────────────────────────

const dropScope = createScopeEditor({
  key: DROP_ALERTS_KEY,
  toggleId: "pref-drop-campaign-alerts",
  modesId: "drop-alerts-modes",
  gamesId: "drop-alerts-games",
  lineId: "drop-alerts-line",
  isPlus: () => deps.isPlus(),
  openPlus: () => deps.openPlus(),
});

const badgeScope = createScopeEditor({
  key: BADGE_SCOPE_KEY,
  toggleId: "badges-scope-toggle",
  modesId: "badges-scope-modes",
  gamesId: "badges-scope-games",
  lineId: "badges-scope-line",
  isPlus: () => deps.isPlus(),
  openPlus: () => deps.openPlus(),
});

// ─── Délai d'actualisation des badges et Drops (StreamPulse+) ─────────────────

/** Les deux listes (onglets Badges et Drops) montrent le délai en vigueur. */
function renderRefresh() {
  const plus = deps.isPlus();
  const current = String(effectiveRefreshMinutes(prefs, plus));
  for (const select of document.querySelectorAll(".drops-refresh-select")) {
    if (!select.options.length) {
      select.append(...REFRESH_CHOICES.map((minutes) => new Option(t("popup.rewardPlan.minutes", { count: minutes }), String(minutes))));
    }
    if (document.activeElement !== select) select.value = current;
  }
  for (const lock of document.querySelectorAll(".drops-refresh-lock")) lock.hidden = plus;
}

async function changeRefresh(event) {
  if (!deps.isPlus()) {
    renderRefresh();
    deps.openPlus();
    return;
  }
  const minutes = Number(event.target.value);
  try {
    const result = await chrome.runtime.sendMessage({ type: "updatePreferences", updates: { dropsRefreshMinutes: minutes } });
    if (result?.success !== true) throw new Error(result?.error || "refus");
    prefs = { ...prefs, dropsRefreshMinutes: minutes };
  } catch (error) {
    console.warn("[popup] délai d'actualisation non enregistré :", error?.message || error);
  }
  renderRefresh();
}

// ─── Alertes manquées (sans StreamPulse+) ─────────────────────────────────────

/** Détail d'une ligne : « 30 min · fini il y a 2 h », « en cours · encore 20 min », « nouvelle campagne ». */
function missedDetail(item, now) {
  if (item.kind === "drop") return t("popup.missed.newCampaign");
  const parts = item.durationMs ? [spanLabel(item.durationMs)] : [];
  if (item.endsAt && item.endsAt <= now) parts.push(t("popup.missed.ended", { ago: agoLabel(item.endsAt, now) }));
  else if (item.endsAt) parts.push(t("popup.missed.left", { time: spanLabel(item.endsAt - now) }));
  else parts.push(t("popup.missed.newBadge"));
  return parts.join(" · ");
}

function renderMissed() {
  const now = Date.now();
  const summary = weekSummary(missed, now);
  const show = !deps.isPlus() && summary.total > 0;
  for (const id of ["badges-missed", "drops-missed"]) {
    const host = $(id);
    if (!host) continue;
    host.hidden = !show;
    if (!show) continue;
    host.querySelector(".missed-count").textContent = String(summary.total);
    const rows = missed.items.slice(0, 3).map((item) => {
      const row = el("li");
      row.append(el("span", "", [item.title, item.game].filter(Boolean).join(" · ")), el("span", "", missedDetail(item, now)));
      return row;
    });
    host.querySelector(".missed-lcd-list").replaceChildren(...rows);
  }
}

/** Onglet Badges ou Drops ouvert : les alertes manquées sont vues, le point de l'icône s'éteint. */
async function seeMissed() {
  if (deps.isPlus() || !missed.items.some((item) => item.at > missed.seenAt)) return;
  missed = markSeen(missed, Date.now());
  try {
    await chrome.storage.local.set({ [MISSED_KEY]: missed });
  } catch (error) {
    console.warn("[popup] alertes manquées non marquées comme vues :", error?.message || error);
  }
}

function renderDropAlerts() {
  const plus = deps.isPlus();
  if ($("drop-alerts-locked")) $("drop-alerts-locked").hidden = plus;
  if ($("drop-alerts-editor")) $("drop-alerts-editor").hidden = !plus;
  if ($("badges-scope-lock")) $("badges-scope-lock").hidden = plus;
  dropScope.render();
  badgeScope.render();
  renderRefresh();
  renderMissed();
}

// ─── Panneau : badges et récompenses ──────────────────────────────────────────

/** Conditions d'une campagne de récompenses : minutes regardées, abonnements, ou l'un des deux. */
function rewardRequirement(reward) {
  const parts = [];
  if (reward.minutesGoal) parts.push(t("popup.drops.badgeWatch", { time: minutesLabel(reward.minutesGoal) }));
  if (reward.subsGoal) parts.push(plural(reward.subsGoal, "popup.drops.badgeSub"));
  return parts.join(` ${t("popup.drops.badgeOr")} `);
}

/** Libellé localisé du pill de type (« Code », « Badge »…) ; valeur inconnue affichée telle quelle. */
const REWARD_TYPE_KEYS = {
  code: "popup.drops.rewardTypeCode",
  badge: "popup.drops.rewardTypeBadge",
  emote: "popup.drops.rewardTypeEmote",
  item: "popup.drops.rewardTypeItem",
};

function rewardTypeLabel(type) {
  const value = String(type || "").trim();
  if (!value) return "";
  const key = REWARD_TYPE_KEYS[value.toLowerCase()];
  return key ? t(key) : value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function rewardRow(reward, now) {
  const item = el("li");
  const row = el(reward.url ? "button" : "div", "camp-row");
  if (reward.url) {
    row.type = "button";
    row.dataset.url = reward.url;
  }
  if (reward.summary && reward.summary !== reward.name) row.title = reward.summary;
  const title = el("b", null, reward.rewards.map((item) => item.name).join(" + "));
  const typeLabel = rewardTypeLabel(reward.rewards.find((item) => item.type)?.type);
  if (typeLabel) title.append(" ", el("span", "camp-type", typeLabel));
  const main = el("span", "camp-main");
  main.append(
    title,
    el("small", null, [reward.brand || reward.game || reward.name, rewardRequirement(reward)].filter(Boolean).join(" · ")),
  );
  // Progression locale des campagnes à objectif de minutes : Twitch n'expose
  // pas d'avancée, on estime avec le temps regardé sur le jeu depuis le
  // lancement (voir watchedMinutesFor) et on affiche ce qu'il reste.
  if (reward.minutesGoal) {
    const watched = Math.min(watchedMinutesFor(watchDaily, reward, now), reward.minutesGoal);
    const left = reward.minutesGoal - watched;
    const parts = [t("popup.drops.badgeWatched", { watched: minutesLabel(watched), goal: minutesLabel(reward.minutesGoal) })];
    if (left > 0) parts.push(t("popup.drops.badgeWatchLeft", { left: minutesLabel(left) }));
    main.append(el("small", "camp-watch", parts.join(" · ")));
    const bar = el("span", "camp-bar");
    const fill = el("span", "camp-bar-fill");
    fill.style.width = `${Math.round((watched / reward.minutesGoal) * 100)}%`;
    bar.append(fill);
    main.append(bar);
  }
  const side = el("span", "camp-side");
  if (reward.endsAt > now) side.append(el("span", isEndingSoon({ ...reward, status: "" }, now) ? "camp-when is-soon" : "camp-when", t("popup.drops.endsIn", { time: spanLabel(reward.endsAt - now) })));
  row.append(thumb(reward.rewards[0]?.image, "drop-img is-small"), main, side);
  item.append(row);
  return item;
}

function renderRewards(now) {
  if (!$("drops-rewards")) return;
  const shown = activeRewards(rewards.rewards, now);
  $("drops-rewards").replaceChildren(...shown.map((reward) => rewardRow(reward, now)));
  $("drops-rewards-empty").hidden = shown.length > 0 || !rewards.updatedAt;
  $("drops-rewards-meta").textContent = shown.length ? t("popup.drops.badgesMeta", { count: shown.length }) : "";
}

/** Image nette : Twitch sert 18 px par défaut, la version 3 fait 72 px. */
const sharpImage = (url) => String(url || "").replace(/\/1$/, "/3");

/** Condition courte tirée de la description anglaise de Twitch, dans la langue de l'utilisateur. */
function badgeCondition(description) {
  const text = String(description || "");
  const watch = /watch\w*[^.]*?for (\d+|one|an?) (minute|hour)s?/i.exec(text);
  if (watch) {
    const amount = /^\d+$/.test(watch[1]) ? Number(watch[1]) : 1;
    return t("popup.drops.badgeWatch", { time: minutesLabel(/hour/i.test(watch[2]) ? amount * 60 : amount) });
  }
  if (/subscrib\w*[^.]*(gift|offer)/i.test(text)) return t("popup.drops.badgeCondSubGift");
  if (/gift\w* (a )?sub/i.test(text)) return t("popup.drops.badgeCondSubGift");
  if (/subscrib/i.test(text)) return t("popup.drops.badgeCondSub");
  if (/\bbits?\b/i.test(text)) return t("popup.drops.badgeCondBits");
  return "";
}

const categoryOf = (description) => /in the (.+?) category/i.exec(String(description || ""))?.[1] || "";

/** Statut au pied d'une carte : « finit dans … », « À venir » ou « dès le … », « Terminé le … ». */
function statusNodes(status, startsAt, endsAt, now) {
  if (status === "soon") return [el("span", "badge-status-soon", startsAt > now ? t("popup.drops.badgeStartsOn", { date: shortDate(startsAt) }) : t("popup.drops.badgeSoon"))];
  if (status === "ended") return endsAt ? [el("span", "badge-when", t("popup.drops.badgeEndedOn", { date: shortDate(endsAt) }))] : [];
  if (endsAt > now) return [el("span", endsAt - now < 48 * 3_600_000 ? "badge-when is-soon" : "badge-when", t("popup.drops.endsIn", { time: spanLabel(endsAt - now) }))];
  return [];
}

/**
 * Carte d'un badge ou d'une récompense : image, nom, condition courte, jeu,
 * date d'ajout, coût et statut. Un clic ouvre un live où la gagner, seulement
 * si le badge est en cours.
 */
function badgeCard({ title, image, condition, fallback, game, gameId, link, clickable = true, paid, owned, status = "live", startsAt = 0, endsAt = 0, addedAt = 0, tooltip, autoId, watchId = "", watchKind = "start" }) {
  const now = Date.now();
  const item = el("li");
  const target = clickable && (game || link);
  const classes = ["badge-card", owned ? "is-owned" : "", status === "soon" ? "is-soon" : "", status === "ended" ? "is-ended" : ""].filter(Boolean).join(" ");
  const card = el(target ? "button" : "div", classes);
  if (target && game) {
    card.type = "button";
    card.dataset.gameId = gameId || "";
    card.dataset.game = game;
  } else if (target) {
    card.type = "button";
    card.dataset.url = link;
  }
  if (tooltip) card.title = tooltip;
  const art = el("span", "badge-card-art");
  if (image) {
    const img = el("img");
    img.src = image;
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => img.remove();
    art.append(img);
  }
  if (owned) art.append(el("span", "badge-card-check", "✓"));
  const body = el("span", "badge-card-body");
  body.append(el("b", null, title));
  const line = [condition, game].filter(Boolean).join(" · ");
  body.append(el("small", line ? "badge-card-cond" : "badge-card-cond is-long", line || fallback || ""));
  if (addedAt) body.append(el("small", "badge-card-added", t("popup.drops.badgeAddedOn", { date: shortDate(addedAt) })));
  const foot = el("span", "badge-card-foot");
  foot.append(el("span", owned ? "badge-pill is-owned" : paid ? "badge-pill is-paid" : "badge-pill is-free", t(owned ? "popup.drops.badgeOwned" : paid ? "popup.drops.badgePaid" : "popup.drops.badgeFree")));
  foot.append(...statusNodes(status, startsAt, endsAt, now));
  card.append(art, body, foot);
  item.append(card);
  // Bouton frère de la carte (un bouton ne peut pas en contenir un autre).
  if (autoId && !owned) {
    // Trois états : en cours (le jeu regardé), en file (un autre jeu, plus tard), ou libre.
    const state = autoState(autoId);
    const on = state !== "off";
    const auto = el("button", on ? `badge-auto is-on${state === "queued" ? " is-queued" : ""}` : "badge-auto");
    // Lecture automatique (triangle) ou mode en cours (point qui pulse).
    auto.innerHTML = state === "running"
      ? '<span class="badge-auto-dot" aria-hidden="true"></span>'
      : state === "queued"
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>';
    auto.append(el("span", null, t(state === "running" ? "popup.drops.badgeAutoOn" : state === "queued" ? "popup.drops.badgeAutoQueued" : "popup.drops.badgeAuto")));
    auto.type = "button";
    auto.dataset.auto = autoId;
    auto.title = t(on ? "popup.drops.badgeAutoRemove" : "popup.drops.badgeAutoHint");
    auto.setAttribute("aria-pressed", on ? "true" : "false");
    item.classList.add("has-auto");
    item.append(auto);
  }
  if (watchId && !owned) {
    // Cloche : « me prévenir » pour un badge à venir, « rappel de fin » pour un badge déjà en cours.
    const on = Boolean(badgeWatch[watchId]);
    const bell = el("button", on ? "badge-bell is-on" : "badge-bell");
    bell.type = "button";
    bell.dataset.watch = watchId;
    bell.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>';
    const label = on ? "popup.drops.badgeBellOn" : watchKind === "end" ? "popup.drops.badgeBellEnd" : "popup.drops.badgeBell";
    bell.append(el("span", null, t(label)));
    bell.title = t(on ? "popup.drops.badgeBellRemove" : watchKind === "end" ? "popup.drops.badgeBellEndHint" : "popup.drops.badgeBellHint");
    bell.setAttribute("aria-pressed", on ? "true" : "false");
    item.classList.add("has-bell");
    item.append(bell);
  }
  return item;
}

/**
 * Sans Plus, un seul badge reste lisible : celui du badge gratuit du jour (en
 * cours ou déjà choisi), sinon le premier récupérable. Les autres deviennent des
 * cartes floutées sans aucune donnée réelle dans la page.
 */
function visibleFreeId(list) {
  if (badgeAuto?.jobs.length) return badgeAuto.jobs[0].badgeId;
  if (freeUsedToday(badgeFree)) return badgeFree.badgeId;
  return list.find((badge) => badge.status === "live" && badge.campaign && !badge.paid && !badge.owned)?.id || "";
}

function lockedRow() {
  const item = el("li");
  const card = el("button", "badge-card is-locked");
  card.type = "button";
  card.dataset.unlock = "1";
  card.title = t("popup.drops.badgeLockedHint");
  const art = el("span", "badge-card-art");
  art.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  const body = el("span", "badge-card-body");
  body.append(el("span", "badge-blur badge-blur--title"), el("span", "badge-blur"));
  const foot = el("span", "badge-card-foot");
  foot.append(el("span", "badge-pill is-plus", t("popup.plus.badge")));
  card.append(art, body, foot);
  card.setAttribute("aria-label", t("popup.drops.badgeLockedHint"));
  item.append(card);
  return item;
}

/** Lignes du catalogue : tout pour Plus, un badge lisible (plus les siens) sinon. */
function catalogRows(list) {
  if (deps.isPlus()) return list.map(badgeRow);
  const keep = visibleFreeId(list);
  return list.map((badge) => (badge.owned || badge.id === keep ? badgeRow(badge) : lockedRow()));
}

function badgeRow(badge) {
  const text = badgeText[getCurrentLanguage()]?.[badge.id]?.text || badge.description;
  const event = badge.event;
  return badgeCard({
    title: badge.title,
    image: sharpImage(badge.image),
    condition: event?.minutes ? t("popup.drops.badgeWatch", { time: minutesLabel(event.minutes) }) : badgeCondition(badge.description),
    fallback: text,
    game: event?.game || categoryOf(badge.description) || gameFromDescription(badge.description),
    gameId: event?.gameId || "",
    link: badge.campaign ? "" : badge.url,
    // Seul un badge en cours ouvre un live : à venir ou terminé, il n'y a rien à gagner.
    clickable: badge.status === "live",
    paid: badge.paid,
    owned: badge.owned,
    status: badge.status,
    startsAt: event?.startsAt || 0,
    endsAt: event?.endsAt || 0,
    addedAt: badge.addedAt,
    tooltip: text,
    // Le mode auto a besoin d'un Drop en cours : c'est lui qui dit où regarder.
    autoId: badge.campaign && !badge.paid ? badge.id : "",
    // Un badge en cours n'a rien à « annoncer » : la cloche ne sert que si sa fin est connue et pas déjà imminente.
    watchId: badge.status === "soon" || (badge.status === "live" && (event?.endsAt || 0) - Date.now() > ENDING_SOON_MS) ? badge.id : "",
    watchKind: badge.status === "live" ? "end" : "start",
  });
}

/**
 * Twitch ne date pas ses badges : StreamPulse note leur première apparition.
 * Le message de synchronisation l'explique tant qu'aucun nouveau n'est apparu.
 */
function renderBadges(now) {
  if (!$("drops-badges")) return;
  const shown = newBadges(badges, now);
  $("drops-badges").replaceChildren(...catalogRows(shown));
  $("drops-badges-meta").textContent = badges.badges.length ? t("popup.drops.badgesKnown", { count: badges.badges.length }) : "";
  const sync = $("drops-badges-sync");
  sync.hidden = shown.length > 0;
  sync.textContent = badges.syncedAt ? t("popup.drops.badgesSince", { date: shortDate(badges.syncedAt) }) : t("popup.drops.badgesSyncing");
}

/**
 * Demande au site la traduction des badges affichés qui en manquent. Une
 * seule requête à la fois par lot ; en cas d'échec, l'anglais reste affiché.
 */
async function translateBadges(ids) {
  const lang = getCurrentLanguage();
  if (!lang || lang === "en") return;
  const now = Date.now();
  const known = badgeText[lang] || {};
  const missing = ids.filter((id) => !badgeTextTried.has(`${lang}:${id}`) && !(known[id] && now - known[id].at < BADGE_TEXT_MAX_AGE_MS)).slice(0, 60);
  if (!missing.length) return;
  missing.forEach((id) => badgeTextTried.add(`${lang}:${id}`));
  try {
    const response = await fetch(`${BADGE_TEXT_URL}?lang=${encodeURIComponent(lang)}&ids=${missing.map(encodeURIComponent).join(",")}`);
    if (!response.ok) return;
    const { translations = {} } = await response.json();
    const next = { ...(badgeText[lang] || {}) };
    for (const [id, text] of Object.entries(translations)) if (typeof text === "string" && text) next[id] = { text: text.slice(0, 400), at: now };
    badgeText = { ...badgeText, [lang]: next };
    await chrome.storage.local.set({ [BADGE_TEXT_KEY]: badgeText });
    renderCatalog();
  } catch (error) {
    console.warn("[popup] traduction des badges indisponible :", error?.message || error);
  }
}

function setPressed(selector, isActive, extra) {
  document.querySelectorAll(selector).forEach((button) => {
    const active = isActive(button);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    extra?.(button);
  });
}

function kickBadgeRow(badge) {
  const item = el("li");
  const card = el("div", "badge-card");
  card.setAttribute("role", "button");
  card.tabIndex = 0;
  card.dataset.url = badge.url;
  card.title = `${badge.title} · ${badge.game}`;
  card.addEventListener("click", () => openTab(badge.url));

  const art = el("span", "badge-card-art");
  if (badge.image) {
    const img = el("img");
    img.src = badge.image;
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => img.remove();
    art.append(img);
  }
  if (badge.owned) art.append(el("span", "badge-card-check", "✓"));

  const body = el("span", "badge-card-body");
  const title = el("b", null, badge.title);
  body.append(title);
  const condText = badge.required ? `${minutesLabel(badge.minutes)} / ${minutesLabel(badge.required)}` : "Kick";
  body.append(el("small", "badge-card-cond", `${condText} · ${badge.game}`));

  const foot = el("span", "badge-card-foot");
  const tag = el("span", "plat-tag-kick", "KICK");
  foot.append(tag);
  foot.append(el("span", badge.owned ? "badge-pill is-owned" : "badge-pill is-free", t(badge.owned ? "popup.drops.badgeOwned" : "popup.drops.badgeFree")));
  if (!badge.owned && badge.required > 0) {
    const leftMin = Math.max(0, badge.required - badge.minutes);
    foot.append(el("span", "badge-when is-soon", t("popup.drops.timeLeft", { time: minutesLabel(leftMin) })));
  }
  card.append(art, body, foot);
  item.append(card);
  return item;
}

/** Note sous la grille : campagnes jamais lues, ou pas relues depuis 12 h. */
function renderBadgesNote(now) {
  const note = $("badges-campaigns-note");
  if (!note) return;
  const at = campaigns.updatedAt;
  note.textContent = !at ? t("popup.drops.badgesCampaignsNever") : now - at > CAMPAIGNS_OLD_MS ? t("popup.drops.badgesCampaignsOld", { date: dateTime(at) }) : "";
}

function renderCatalog() {
  if (!$("badges-catalog")) return;
  renderAutoBar();
  const now = Date.now();
  const showTwitch = badgesPlatform === "all" || badgesPlatform === "twitch";
  const showKick = badgesPlatform === "all" || badgesPlatform === "kick";

  const context = { now, events: badgeEvents.events, added: badgeAdded.added };
  const counts = showTwitch ? countBadges(badges, context) : { live: 0, soon: 0, ended: 0, owned: 0, liveFree: 0 };
  const allKickBadges = showKick ? kickBadgesFrom(kickDrops, now) : [];
  const kickLive = allKickBadges.filter((b) => b.status === "live").length;
  const kickOwned = allKickBadges.filter((b) => b.owned).length;
  const live = counts.live + kickLive;
  const liveFree = counts.liveFree + kickLive;
  const plus = deps.isPlus();
  // Catalogue visible par tous : sans Plus, un badge auto gratuit par jour.
  $("badges-locked").hidden = plus;
  $("badges-content").hidden = false;
  // La recherche trahirait les noms des badges floutés : réservée à Plus.
  const search = $("badges-search")?.closest("label");
  if (search) search.hidden = !plus;
  if (!plus) badgeQuery = "";
  const filterCounts = { live, soon: counts.soon, ended: counts.ended, owned: counts.owned + kickOwned };
  setPressed("#badges-filters [data-filter]", (button) => button.dataset.filter === badgeFilter, (button) => {
    const count = button.querySelector("[data-count]");
    if (count) count.textContent = String(filterCounts[button.dataset.filter] ?? 0);
  });
  setPressed("#badges-cost [data-cost]", (button) => button.dataset.cost === badgeCost);
  const list = showTwitch ? catalogBadges(badges, { ...context, status: badgeFilter, cost: badgeCost, query: badgeQuery }) : [];
  const filteredKick = allKickBadges.filter((b) => {
    if (badgeFilter === "live" && b.status !== "live") return false;
    if (badgeFilter === "owned" && !b.owned) return false;
    if (badgeFilter === "soon" || badgeFilter === "ended") return false;
    if (badgeCost === "paid") return false;
    if (badgeQuery.trim()) {
      const q = badgeQuery.trim().toLowerCase();
      if (!`${b.title} ${b.game}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const shown = list.slice(0, badgeLimit);
  $("badges-catalog").replaceChildren(...catalogRows(shown), ...filteredKick.map(kickBadgeRow));
  translateBadges(shown.filter((badge) => !badgeCondition(badge.description)).map((badge) => badge.id));
  const isTwitchConnected = Boolean(twitchLogin);
  const authNotice = $("badges-auth-notice");
  if (authNotice) {
    authNotice.hidden = badgesPlatform === "kick" || isTwitchConnected;
    const textEl = $("badges-auth-notice-text");
    if (textEl) textEl.textContent = t("popup.drops.badgesAuthNotice");
  }
  const empty = list.length + filteredKick.length === 0;
  $("badges-catalog-empty").hidden = !empty;
  // Vide à cause d'une recherche ou du coût : « aucun ne correspond » ; sinon, rien dans ce statut.
  if (badgeQuery.trim() || badgeCost !== "all") {
    $("badges-catalog-empty").textContent = t("popup.drops.noBadgeMatch");
  } else if (badgeFilter === "owned" && !isTwitchConnected && badgesPlatform !== "kick") {
    $("badges-catalog-empty").textContent = t("popup.drops.badgesEmptyOwnedSignedOut");
  } else {
    $("badges-catalog-empty").textContent = t(BADGE_EMPTY_KEYS[badgeFilter]);
  }
  $("badges-sort").textContent = empty ? "" : t(BADGE_SORT_KEYS[badgeFilter]);
  $("badges-more").hidden = list.length <= badgeLimit;
  $("badges-total").textContent = String(live);
  $("badges-teaser").hidden = true;
  $("badges-teaser-total").textContent = String(live);
  const soonLine = t("popup.drops.badgesLcdSoon", { count: counts.soon });
  const freeLine = t("popup.drops.badgesLcdFree", { count: liveFree });
  $("badges-teaser-meta").replaceChildren(el("span", null, freeLine));
  $("badges-lcd-meta").replaceChildren(el("span", null, soonLine), el("span", null, freeLine));
  renderBadgesNote(now);
}

// ─── Panneau : historique (StreamPulse+) ──────────────────────────────────────

function renderHistory() {
  const plus = deps.isPlus();
  $("drops-locked").hidden = plus;
  $("drops-history").hidden = !plus;
  const summary = summarizeHistory(history);
  $("drops-history-meta").textContent = plus && summary.total ? plural(summary.total, "popup.drops.historyMeta") : "";
  if (!plus) return;
  if (!summary.total) {
    $("drops-history").replaceChildren(el("p", "drops-empty", t("popup.drops.historyEmpty")));
    return;
  }
  const nodes = [];
  let rows = 0;
  for (const month of summary.months) {
    if (rows >= HISTORY_ROWS) break;
    nodes.push(el("p", "drops-month", plural(month.count, "popup.drops.historyMonth", { month: monthLabel(month.key) })));
    for (const row of month.rows) {
      if (rows++ >= HISTORY_ROWS) break;
      const line = el("div", "drops-hrow");
      const main = el("div", "drop-main");
      const name = el("b", null, row.name);
      if (row.times > 1) name.append(el("small", "drops-times", ` ×${row.times}`));
      main.append(name, el("small", null, [row.game, row.channel ? t("popup.drops.onChannel", { channel: row.channel }) : ""].filter(Boolean).join(" · ")));
      const time = el("time", null, dateTime(row.at));
      time.dateTime = new Date(row.at).toISOString();
      line.append(thumb(row.image, "drop-img is-small"), main, time);
      nodes.push(line);
    }
  }
  $("drops-history").replaceChildren(...nodes);
}

// ─── Rendu et événements ──────────────────────────────────────────────────────

function renderPanel(now) {
  if (!$("menu-drops")) return;
  const auto = autoClaimOn();
  const autoActive = auto && deps.isPlus();
  $("drops-auto").classList.toggle("is-on", autoActive);
  $("drops-auto").setAttribute("aria-pressed", String(autoActive));
  $("drops-auto-label").textContent = t(autoActive ? "popup.drops.autoOn" : "popup.drops.autoOff");
  renderProgress(now);
  renderRewardPlan(now);
  renderDropAlerts();
  renderCampaigns(now);
  renderRewards(now);
  renderBadges(now);
  renderCatalog();
  renderHistory();
}

function render() {
  const now = Date.now();
  for (const [id, at] of claiming) if (now - at >= CLAIM_PENDING_MS) claiming.delete(id);
  renderChip(now);
  renderPanel(now);
  renderDropsAutoBar();
}

function openTab(url) {
  if (chrome.tabs?.create) chrome.tabs.create({ url });
  else window.open(url, "_blank", "noopener");
}

async function claim(button) {
  const instanceId = button.dataset.claim;
  claiming.set(instanceId, Date.now());
  button.disabled = true;
  button.textContent = t("popup.drops.claiming");
  const response = await chrome.runtime.sendMessage({ type: "claimDrop", instanceId }).catch(() => null);
  if (response?.sent && !response.opened) return;
  if (response?.opened) {
    claiming.delete(instanceId);
    render();
    $("drops-updated").textContent = t("popup.drops.claimOpened");
    return;
  }
  // Aucun onglet Twitch pour l'exécuter : on le dit, et le bouton revient.
  claiming.delete(instanceId);
  render();
  $("drops-updated").textContent = t("popup.drops.claimNoTab");
}

function bind() {
  const openPanel = () => {
    $("tab-drops")?.click();
  };
  $("activity-drops")?.addEventListener("click", openPanel);
  $("activity-drops")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openPanel();
  });
  $("drop-alerts-unlock")?.addEventListener("click", () => deps.openPlus());
  dropScope.bind();
  badgeScope.bind();
  for (const cta of document.querySelectorAll(".missed-lcd-buy")) cta.addEventListener("click", () => deps.openPlus());
  for (const id of ["tab-badges", "tab-drops"]) $(id)?.addEventListener("click", () => seeMissed());
  for (const select of document.querySelectorAll(".drops-refresh-select")) select.addEventListener("change", changeRefresh);
  $("drops-platform")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-platform]");
    if (!button) return;
    dropsPlatform = button.dataset.platform || "all";
    chrome.storage.local.set({ [DROPS_PLATFORM_KEY]: dropsPlatform }).catch(() => {});
    renderPlatformFilter("drops-platform", dropsPlatform);
    renderPlatformFilter("drops-auto-platform", dropsPlatform);
    renderDropsAutoBar();
    const now = Date.now();
    renderProgress(now);
    renderCampaigns(now);
  });
  $("drops-auto-platform")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-platform]");
    if (!button) return;
    dropsPlatform = button.dataset.platform || "all";
    chrome.storage.local.set({ [DROPS_PLATFORM_KEY]: dropsPlatform }).catch(() => {});
    renderPlatformFilter("drops-platform", dropsPlatform);
    renderPlatformFilter("drops-auto-platform", dropsPlatform);
    renderDropsAutoBar();
    const now = Date.now();
    renderProgress(now);
    renderCampaigns(now);
  });
  $("badges-platform")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-platform]");
    if (!button) return;
    badgesPlatform = button.dataset.platform || "all";
    chrome.storage.local.set({ [BADGES_PLATFORM_KEY]: badgesPlatform }).catch(() => {});
    renderPlatformFilter("badges-platform", badgesPlatform);
    renderPlatformFilter("badges-auto-platform", badgesPlatform);
    renderAutoBar();
    badgeLimit = 40;
    renderCatalog();
  });
  $("badges-auto-platform")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-platform]");
    if (!button) return;
    badgesPlatform = button.dataset.platform || "all";
    chrome.storage.local.set({ [BADGES_PLATFORM_KEY]: badgesPlatform }).catch(() => {});
    renderPlatformFilter("badges-platform", badgesPlatform);
    renderPlatformFilter("badges-auto-platform", badgesPlatform);
    renderAutoBar();
    badgeLimit = 40;
    renderCatalog();
  });
  $("drops-filters")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    filter = button.dataset.filter;
    campaignLimit = CAMPAIGN_ROWS;
    renderCampaigns(Date.now());
  });
  $("drops-rewards")?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-url]");
    if (row) openTab(row.dataset.url);
  });
  const openStream = (event) => {
    const row = event.target.closest("[data-game], [data-url]");
    if (!row) return false;
    if (row.dataset.game !== undefined) {
      chrome.runtime.sendMessage({ type: "openDropsStream", gameId: row.dataset.gameId, game: row.dataset.game }).catch(() => {});
    } else {
      openTab(row.dataset.url);
    }
    return true;
  };
  $("drops-campaigns")?.addEventListener("click", (event) => {
    const auto = event.target.closest("[data-camp-auto]");
    if (auto) {
      toggleCampaignAuto(auto.dataset.campAuto);
      return;
    }
    const kick = event.target.closest("[data-kick-url]");
    if (kick) {
      openTab(kick.dataset.kickUrl);
      return;
    }
    openStream(event);
  });
  $("drops-progress")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-claim]");
    if (button && !button.disabled) claim(button);
  });
  $("badges-filters")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    badgeFilter = button.dataset.filter;
    badgeLimit = 40;
    renderCatalog();
  });
  $("badges-cost")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cost]");
    if (!button) return;
    badgeCost = button.dataset.cost;
    badgeLimit = 40;
    renderCatalog();
  });
  $("badges-search")?.addEventListener("input", (event) => {
    badgeQuery = event.target.value;
    badgeLimit = 40;
    renderCatalog();
  });
  for (const id of ["badges-catalog", "drops-badges"]) {
    $(id)?.addEventListener("click", (event) => {
      if (event.target.closest("[data-unlock]")) {
        deps.openPlus();
        return;
      }
      const bell = event.target.closest("[data-watch]");
      if (bell) {
        toggleBell(bell.dataset.watch);
        return;
      }
      const auto = event.target.closest("[data-auto]");
      if (auto) toggleAuto(auto.dataset.auto);
      else openStream(event);
    });
  }
  $("badges-auto-all")?.addEventListener("click", toggleAutoAll);
  $("drops-auto-all")?.addEventListener("click", toggleDropsAuto);
  $("badges-limited")?.addEventListener("change", toggleLimited);
  $("drops-campaigns-more")?.addEventListener("click", () => {
    campaignLimit += CAMPAIGN_ROWS;
    renderCampaigns(Date.now());
  });
  $("badges-more")?.addEventListener("click", () => {
    badgeLimit += 40;
    renderCatalog();
  });
  $("drops-open-campaigns")?.addEventListener("click", () => openTab(CAMPAIGNS_PAGE));
  const openTwitchLogin = () => openTab("https://www.twitch.tv/login");
  $("drops-auth-link")?.addEventListener("click", openTwitchLogin);
  $("badges-auth-link")?.addEventListener("click", openTwitchLogin);
  $("drops-live")?.addEventListener("click", () => openTab(LIVE_247_PAGE));
  $("badges-live")?.addEventListener("click", () => openTab(LIVE_247_PAGE));
  $("drops-unlock")?.addEventListener("click", () => deps.openPlus());
  $("badges-unlock")?.addEventListener("click", () => deps.openPlus());
}

/** Suit ou ne suit plus un badge : l'arrière-plan prévient au départ et avant la fin. */
async function toggleBell(badgeId) {
  // Alertes de badges : réservées à StreamPulse+.
  if (!deps.isPlus()) {
    deps.openPlus();
    return;
  }
  const now = Date.now();
  const badge = badges.badges.find((item) => item.id === badgeId);
  const live = Boolean(badge) && catalogBadges({ ...badges, badges: [badge] }, { status: "live", now, events: badgeEvents.events, added: badgeAdded.added }).length > 0;
  badgeWatch = toggleWatch(badgeWatch, badgeId, { live, now });
  renderCatalog();
  try {
    await chrome.storage.local.set({ [BADGE_WATCH_KEY]: badgeWatch });
  } catch (error) {
    console.warn("[popup] alerte de badge non enregistrée :", error?.message || error);
  }
}

/** « running » : badge du jeu regardé ; « queued » : en file ; « off » : pas dans le mode auto. */
function autoState(badgeId) {
  if (!badgeAuto?.jobs.some((job) => job.badgeId === badgeId)) return "off";
  return currentGroup(badgeAuto)?.jobs.some((job) => job.badgeId === badgeId) ? "running" : "queued";
}

const sendAuto = (message) => chrome.runtime.sendMessage(message).catch((error) => console.warn("[popup] mode auto :", error?.message || error));

/** Bouton « Récupérer tous les badges possibles » et état de la file. */
function renderAutoBar() {
  const button = $("badges-auto-all");
  const status = $("badges-auto-status");
  if (!button || !status) return;
  const limited = $("badges-limited");
  if (limited) {
    limited.checked = badgeLimited && deps.isPlus();
    limited.setAttribute("aria-checked", String(limited.checked));
    $("badges-limited-lock").hidden = deps.isPlus();
  }
  const all = badgeAuto?.mode === "all";
  if (all) {
    button.textContent = t("popup.drops.badgeAutoAllStop");
    button.classList.add("is-on");
    button.setAttribute("aria-pressed", "true");
    const group = currentGroup(badgeAuto);
    status.hidden = !group;
    if (group) status.textContent = t("popup.drops.badgeAutoStatus", { count: badgeAuto.jobs.length, game: group.game });
  } else {
    button.classList.remove("is-on");
    button.setAttribute("aria-pressed", "false");
    const free = !deps.isPlus();
    status.hidden = !freeUsedToday(badgeFree);
    if (free) status.textContent = t(freeUsedToday(badgeFree) ? "popup.drops.badgeFreeUsed" : "popup.drops.badgeFreeLeft");
    else status.textContent = "";
    if (badgesPlatform === "kick") {
      button.textContent = t("popup.drops.badgeAutoAllKick");
    } else if (badgesPlatform === "twitch") {
      button.textContent = t("popup.drops.badgeAutoAllTwitch");
    } else {
      button.textContent = t("popup.drops.badgeAutoAll");
    }
  }
}

/** Bouton « Récupérer tous les Drops possibles » (StreamPulse+) : la file suit les campagnes de jeux. */
function renderDropsAutoBar() {
  const button = $("drops-auto-all");
  const status = $("drops-auto-status");
  if (!button || !status) return;
  const on = badgeAuto?.drops === true;
  if (on) {
    button.textContent = t("popup.drops.dropAutoAllStop");
    button.classList.add("is-on");
    button.setAttribute("aria-pressed", "true");
    const group = on ? currentGroup(badgeAuto) : null;
    status.hidden = !group;
    if (group) status.textContent = t("popup.drops.dropAutoStatus", { count: badgeAuto.jobs.filter(isDropJob).length, game: group.game });
  } else {
    button.classList.remove("is-on");
    button.setAttribute("aria-pressed", "false");
    status.hidden = true;
    if (dropsPlatform === "kick") {
      button.textContent = t("popup.drops.dropAutoAllKick");
    } else if (dropsPlatform === "twitch") {
      button.textContent = t("popup.drops.dropAutoAllTwitch");
    } else {
      button.textContent = t("popup.drops.dropAutoAll");
    }
  }
}

async function claimAllKickDrops() {
  if (!deps.isPlus()) {
    deps.openPlus();
    return;
  }
  const button = $("drops-auto-all");
  const status = $("drops-auto-status");
  if (button) button.disabled = true;

  try {
    let unboxedCount = 0;
    const boxed = kickDrops.boxed || [];
    if (boxed.length > 0) {
      const boxIds = boxed.map((b) => b.id);
      const res = await chrome.runtime.sendMessage({ type: "unboxKickRewards", ids: boxIds });
      if (res?.success) unboxedCount = boxIds.length;
    }

    const readyItems = [
      ...(kickDrops.progress || []).filter((p) => p.ready && !isKickBadge(p)),
      ...(kickDrops.challenges || []).filter((c) => c.ready && !isKickBadge(c)),
    ];

    if (readyItems.length > 0) {
      await chrome.tabs.create({ url: "https://kick.com/drops/rewards", active: true });
    } else if (unboxedCount === 0) {
      const activeCamp = (kickDrops.campaigns || []).find((c) => !isKickBadge(c));
      const targetUrl = activeCamp?.url || "https://kick.com/drops/campaigns";
      await chrome.tabs.create({ url: targetUrl, active: true });
    }

    if (status) {
      status.hidden = false;
      status.textContent = unboxedCount > 0
        ? `Kick : ${unboxedCount} coffre(s) déballé(s) !`
        : readyItems.length > 0
          ? `Kick : ${readyItems.length} récompense(s) prête(s), inventaire ouvert !`
          : "Kick : campagnes Drops ouvertes !";
    }
    await reload();
  } catch (error) {
    console.warn("[popup] récupération Kick drops :", error?.message || error);
  } finally {
    if (button) button.disabled = false;
  }
}

async function claimAllKickBadges() {
  if (!deps.isPlus()) {
    deps.openPlus();
    return;
  }
  const button = $("badges-auto-all");
  const status = $("badges-auto-status");
  if (button) button.disabled = true;

  try {
    let unboxedCount = 0;
    const boxed = kickDrops.boxed || [];
    if (boxed.length > 0) {
      const boxIds = boxed.map((b) => b.id);
      const res = await chrome.runtime.sendMessage({ type: "unboxKickRewards", ids: boxIds });
      if (res?.success) unboxedCount = boxIds.length;
    }

    const readyBadges = kickBadgesFrom(kickDrops).filter((b) => b.ready);
    if (readyBadges.length > 0) {
      await chrome.tabs.create({ url: "https://kick.com/drops/rewards", active: true });
    } else if (unboxedCount === 0) {
      const liveBadges = kickBadgesFrom(kickDrops).filter((b) => b.status === "live");
      const targetUrl = liveBadges[0]?.url || "https://kick.com/drops/campaigns";
      await chrome.tabs.create({ url: targetUrl, active: true });
    }

    if (status) {
      status.hidden = false;
      status.textContent = unboxedCount > 0
        ? `Kick : ${unboxedCount} coffre(s) déballé(s) !`
        : readyBadges.length > 0
          ? `Kick : ${readyBadges.length} badge(s) prêt(s), inventaire ouvert !`
          : "Kick : badges ouverts !";
    }
    await reload();
  } catch (error) {
    console.warn("[popup] récupération Kick badges :", error?.message || error);
  } finally {
    if (button) button.disabled = false;
  }
}

async function toggleDropsAuto() {
  if (!deps.isPlus()) {
    deps.openPlus();
    return;
  }
  if (dropsPlatform === "kick") {
    await claimAllKickDrops();
    return;
  }
  if (badgeAuto?.drops === true) {
    sendAuto({ type: "badgeAutoStop", drops: true });
  } else {
    if (dropsPlatform === "all") {
      claimAllKickDrops().catch(() => {});
    }
    sendAuto({ type: "badgeAutoStart", drops: true, platform: dropsPlatform });
  }
}

/** Notification Chrome pour les badges temporaires : réservée à StreamPulse+. */
async function toggleLimited(event) {
  if (!deps.isPlus()) {
    // Sans Plus l'interrupteur reste éteint : on montre l'offre.
    event.target.checked = false;
    deps.openPlus();
    return;
  }
  badgeLimited = event.target.checked;
  renderAutoBar();
  try {
    await chrome.storage.local.set({ [BADGE_LIMITED_KEY]: badgeLimited });
  } catch (error) {
    console.warn("[popup] option des badges temporaires non enregistrée :", error?.message || error);
  }
}

/** Mode « tous les badges » : lance la file complète, ou arrête tout. */
async function toggleAutoAll() {
  if (!deps.isPlus()) {
    deps.openPlus();
    return;
  }
  if (badgesPlatform === "kick") {
    await claimAllKickBadges();
    return;
  }
  if (badgeAuto?.mode === "all") {
    sendAuto({ type: "badgeAutoStop" });
  } else {
    if (badgesPlatform === "all") {
      claimAllKickBadges().catch(() => {});
    }
    sendAuto({ type: "badgeAutoStart", all: true, platform: badgesPlatform });
  }
}

/** Ajoute un badge à la file du mode auto, ou l'en retire (le service worker gère l'onglet). */
function toggleAuto(badgeId) {
  if (autoState(badgeId) !== "off") {
    sendAuto({ type: "badgeAutoStop", badgeId });
    return;
  }
  const badge = badges.badges.find((item) => item.id === badgeId);
  const campaign = badge && catalogBadges({ ...badges, badges: [badge] }, { status: "live", now: Date.now(), events: badgeEvents.events, added: badgeAdded.added })[0]?.campaign;
  if (!campaign) return;
  // Sans Plus, le badge gratuit du jour déjà pris : l'offre plutôt qu'un refus muet.
  if (!deps.isPlus() && (badgeAuto?.jobs.length || !freeAvailable(badgeFree, badgeId))) {
    deps.openPlus();
    return;
  }
  sendAuto({
    type: "badgeAutoStart",
    badge: { badgeId, title: badge.title, image: badge.image, game: campaign.game, gameId: campaign.gameId, campaignId: campaign.id, endsAt: campaign.endsAt },
  }).then((result) => {
    if (result?.plusRequired) deps.openPlus();
  });
}

async function reload() {
  await isTwitchSignedIn();
  const stored = await chrome.storage.local.get([...DROPS_KEYS, KICK_DROPS_KEY, PREFERENCES_KEY, BADGE_AUTO_KEY, BADGE_FREE_KEY, BADGE_WATCH_KEY, BADGE_LIMITED_KEY, BADGE_SCOPE_KEY, DROP_ALERTS_KEY, REWARD_PLAN_KEY, MISSED_KEY, DROPS_PLATFORM_KEY, BADGES_PLATFORM_KEY]);
  kickDrops = kickDropsFrom(stored);
  dropsPlatform = stored[DROPS_PLATFORM_KEY] || "all";
  badgesPlatform = stored[BADGES_PLATFORM_KEY] || "all";
  renderPlatformFilter("drops-platform", dropsPlatform);
  renderPlatformFilter("drops-auto-platform", dropsPlatform);
  renderPlatformFilter("badges-platform", badgesPlatform);
  renderPlatformFilter("badges-auto-platform", badgesPlatform);
  badgeAuto = normalizeAuto(stored[BADGE_AUTO_KEY]);
  badgeFree = stored[BADGE_FREE_KEY] || null;
  badgeWatch = watchFrom(stored);
  badgeLimited = limitedFrom(stored);
  dropScope.load(stored);
  badgeScope.load(stored);
  missed = missedFrom(stored[MISSED_KEY]);
  progress = progressFrom(stored);
  campaigns = campaignsFrom(stored);
  rewards = rewardsFrom(stored);
  badges = badgesFrom(stored);
  badgeEvents = eventsFrom(stored);
  badgeAdded = addedFrom(stored);
  history = historyFrom(stored);
  prefs = stored[PREFERENCES_KEY] || {};
  rewardPlan = normalizePlanSelection(stored[REWARD_PLAN_KEY]);
  const text = (await chrome.storage.local.get(BADGE_TEXT_KEY))[BADGE_TEXT_KEY];
  if (text && typeof text === "object") badgeText = text;
  render();
}

export async function initDrops({ isPlus, onPlusChange, openPlus }) {
  if (!$("menu-drops") && !$("activity-drops")) return;
  deps = { isPlus, openPlus };
  bind();
  onPlusChange(() => render());
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && MISSED_KEY in changes) {
      missed = missedFrom(changes[MISSED_KEY].newValue);
      renderMissed();
    }
    if (area === "local" && REWARD_PLAN_KEY in changes) {
      rewardPlan = normalizePlanSelection(changes[REWARD_PLAN_KEY].newValue);
      // Un choix fait ici écrit puis revient par cet événement : tant que tu es dans le plan, on ne le recrée pas.
      const host = $("reward-plan");
      if (host?.contains(document.activeElement)) host._updateSummary?.();
      else renderRewardPlan(Date.now(), { force: true });
    }
    if (area === "local" && (DROPS_KEYS.some((key) => key in changes) || KICK_DROPS_KEY in changes || PREFERENCES_KEY in changes || BADGE_AUTO_KEY in changes || BADGE_FREE_KEY in changes || DROP_ALERTS_KEY in changes)) reload().catch(() => {});
  });
  if (typeof chrome !== "undefined" && chrome.cookies?.onChanged) {
    chrome.cookies.onChanged.addListener((changeInfo) => {
      const name = changeInfo.cookie?.name;
      if (name === "login" || name === "auth-token") {
        isTwitchSignedIn().then(() => render());
      }
    });
  }
  await reload();
  // Les jeux regardés ne changent pas pendant que le popup est ouvert : lus une fois.
  chrome.storage.local.get([WATCH_DAILY_KEY]).then((stored) => {
    watchDaily = stored[WATCH_DAILY_KEY] || {};
    myGames = myGamesFrom(stored[WATCH_DAILY_KEY], Date.now());
    renderCampaigns(Date.now());
    renderRewards(Date.now());
  }).catch(() => {});
  setInterval(render, TICK_MS);
  // Un seul chemin : gratuit → StreamPulse+, Plus → les réglages de cette rubrique, plus bas.
  $("drops-auto")?.addEventListener("click", () => {
    if (!deps.isPlus()) deps.openPlus();
    else $("drops-settings")?.scrollIntoView({ block: "start", behavior: "smooth" });
  });
  // Popup ouvert : on demande une lecture fraîche à un onglet Twitch, s'il y en a un.
  chrome.runtime.sendMessage({ type: "dropsRefresh" }).catch(() => {});
}
