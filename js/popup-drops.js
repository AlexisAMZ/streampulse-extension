// Drops Twitch dans le popup : bande « Drops en cours » de l'accueil, puce
// « Drops du jour », et panneau Drops des Réglages (en cours, campagnes et,
// avec StreamPulse+, historique). Lit le storage que le service worker
// alimente ; tous les calculs viennent de drops-data.js.

import { t, getCurrentLanguage } from "./i18n.js";
import {
  DROPS_KEYS,
  badgesFrom,
  catalogBadges,
  countBadges,
  activeNames,
  newBadges,
  activeRewards,
  bandModel,
  campaignUrl,
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
} from "./drops-data.js";

const $ = (id) => document.getElementById(id);
const PREFERENCES_KEY = "betaGeneralPreferences";
const WATCH_DAILY_KEY = "streamPulseWatchTimeDaily";
const CAMPAIGNS_PAGE = "https://www.twitch.tv/drops/campaigns";
const CAMPAIGN_ROWS = 40;
const HISTORY_ROWS = 80;
/** Le panneau rappelle les Drops récupérés depuis ce délai, sous ceux en cours. */
const CLAIMED_SHOWN_MS = 12 * 3_600_000;
const CLAIMED_SHOWN_MAX = 3;
const CLAIM_PENDING_MS = 20_000;
const TICK_MS = 30_000;
const GIFT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>';

let deps = { isPlus: () => false, openPlus: () => {} };
let progress = progressFrom({});
let campaigns = campaignsFrom({});
let rewards = rewardsFrom({});
let badges = badgesFrom({});
let history = [];
let prefs = {};
let myGames = new Set();
let filter = "all";
let badgeFilter = "available";
let badgeQuery = "";
let badgeLimit = 40;
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

/** Minutes restantes : « 27 min », « 1 h 38 min ». */
function minutesLabel(minutes) {
  if (minutes < 60) return unit(minutes, "minute");
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${unit(hours, "hour")} ${unit(rest, "minute")}` : unit(hours, "hour");
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

const plural = (count, one, other, params = {}) => t(count === 1 ? one : other, { count, ...params });

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

function bar(drop) {
  const track = el("span", "drops-bar");
  const fill = el("i");
  fill.style.width = `${percent(drop)}%`;
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
    const left = isClaimable(drop) ? t("popup.drops.ready") : minutesLabel(remainingMinutes(drop));
    const more = model.others ? plural(model.others, "popup.drops.bandMoreOne", "popup.drops.bandMoreOther") : "";
    text = [drop.name, left, more].filter(Boolean).join(" · ");
    fill.style.width = `${percent(drop)}%`;
    chip.title = [drop.game, channelLabel(drop), model.stale ? t("popup.drops.staleHint") : endsLabel(drop, now)].filter(Boolean).join(" · ");
  } else if (model?.kind === "claimed") {
    text = t("popup.drops.bandClaimed", { name: model.entry.name });
    fill.style.width = "0";
    chip.title = model.entry.game || "";
  } else {
    text = plural(today, "popup.cplus.dropsToday", "popup.cplus.dropsTodayPlural");
    fill.style.width = "0";
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
    side.append(el("b", null, minutesLabel(remainingMinutes(drop))), el("small", null, [t("popup.drops.progress", { minutes: drop.minutes, required: drop.required }), endsLabel(drop, now)].filter(Boolean).join(" · ")));
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

function renderProgress(now) {
  const drops = currentDrops(progress, now);
  const claimed = recentClaims(history, now, CLAIMED_SHOWN_MS).slice(0, CLAIMED_SHOWN_MAX);
  $("drops-progress").replaceChildren(...drops.map((drop) => progressRow(drop, now)), ...claimed.map(claimedRow));
  $("drops-progress-empty").hidden = drops.length + claimed.length > 0;
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
  const mine = isMine(campaign, myGames);
  const item = el("li");
  const button = el("button", mine ? "camp-row is-mine" : "camp-row");
  button.type = "button";
  button.dataset.url = campaignUrl(campaign.id);
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
    campaign.owner,
    campaign.rewardCount ? plural(campaign.rewardCount, "popup.drops.rewardsOne", "popup.drops.rewardsOther") : "",
    campaign.connected === false && campaign.accountLinkUrl ? t("popup.drops.linkAccount") : "",
    mine ? t("popup.drops.yourGames") : "",
  ].filter(Boolean).join(" · ");
  const main = el("span", "camp-main");
  main.append(el("b", null, campaign.game), el("small", null, meta));

  const side = el("span", "camp-side");
  if (campaign.badgeOnly) side.append(el("span", "camp-badge", t("popup.drops.badge")));
  const when = campaignWhen(campaign, now);
  if (when.text) side.append(el("span", when.tone ? `camp-when is-${when.tone}` : "camp-when", when.text));

  button.append(box, main, side);
  item.append(button);
  return item;
}

function renderCampaigns(now) {
  if (!$("drops-campaigns")) return;
  const all = campaigns.campaigns;
  const counts = countFilters(all, now);
  document.querySelectorAll("#drops-filters [data-filter]").forEach((button) => {
    const active = button.dataset.filter === filter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    const count = button.querySelector("[data-count]");
    if (count) count.textContent = all.length ? String(counts[button.dataset.filter] ?? 0) : "";
  });
  $("drops-campaigns-meta").textContent = campaigns.updatedAt
    ? t("popup.drops.campaignsMeta", { count: counts.all, ago: agoLabel(campaigns.updatedAt, now) })
    : "";

  const shown = filterCampaigns(all, filter, now, myGames).slice(0, CAMPAIGN_ROWS);
  $("drops-campaigns").replaceChildren(...shown.map((campaign) => campaignRow(campaign, now)));
  const empty = shown.length === 0;
  $("drops-campaigns-empty").hidden = !empty;
  if (!empty) return;
  const key = !all.length ? "popup.drops.campaignsNone" : filter === "upcoming" ? "popup.drops.upcomingEmpty" : "popup.drops.filterEmpty";
  $("drops-campaigns-empty-text").textContent = t(key);
  $("drops-open-campaigns").hidden = all.length > 0;
}

// ─── Panneau : badges et récompenses ──────────────────────────────────────────

/** Conditions d'une campagne de récompenses : minutes regardées, abonnements, ou l'un des deux. */
function rewardRequirement(reward) {
  const parts = [];
  if (reward.minutesGoal) parts.push(t("popup.drops.badgeWatch", { time: minutesLabel(reward.minutesGoal) }));
  if (reward.subsGoal) parts.push(plural(reward.subsGoal, "popup.drops.badgeSubOne", "popup.drops.badgeSubOther"));
  return parts.join(` ${t("popup.drops.badgeOr")} `);
}

function rewardRow(reward, now) {
  const item = el("li");
  const row = el(reward.url ? "button" : "div", "camp-row");
  if (reward.url) {
    row.type = "button";
    row.dataset.url = reward.url;
  }
  if (reward.summary && reward.summary !== reward.name) row.title = reward.summary;
  const main = el("span", "camp-main");
  main.append(
    el("b", null, reward.rewards.map((item) => item.name).join(" + ")),
    el("small", null, [reward.brand || reward.game || reward.name, rewardRequirement(reward)].filter(Boolean).join(" · ")),
  );
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

function badgeRow(badge) {
  const item = el("li");
  const url = badge.campaign ? campaignUrl(badge.campaign.id) : badge.url;
  const row = el(url ? "button" : "div", "camp-row badge-row");
  if (url) {
    row.type = "button";
    row.dataset.url = url;
  }
  const main = el("span", "camp-main");
  main.append(el("b", null, badge.title), el("small", "badge-desc", badge.description));
  if (badge.description) main.title = badge.description;
  const side = el("span", "camp-side");
  if (badge.available && !badge.owned) side.append(el("span", "camp-when is-new", t("popup.drops.badgeAvailable")));
  side.append(el("span", badge.owned ? "drops-tag" : badge.paid ? "camp-badge" : "camp-when is-new", t(badge.owned ? "popup.drops.badgeOwned" : badge.paid ? "popup.drops.badgePaid" : "popup.drops.badgeFree")));
  // Relié à une campagne de Drops : sa vraie date de fin, et un lien vers elle.
  if (badge.campaign?.endsAt) side.append(el("span", isEndingSoon(badge.campaign, Date.now()) ? "camp-when is-soon" : "camp-when", t("popup.drops.endsIn", { time: spanLabel(badge.campaign.endsAt - Date.now()) })));
  else if (badge.firstSeen) side.append(el("span", "camp-when", shortDate(badge.firstSeen)));
  row.append(thumb(badge.image, "drop-img is-small"), main, side);
  item.append(row);
  return item;
}

/**
 * Twitch ne date pas ses badges : StreamPulse note leur première apparition.
 * Le message de synchronisation l'explique tant qu'aucun nouveau n'est apparu.
 */
function renderBadges(now) {
  if (!$("drops-badges")) return;
  const shown = newBadges(badges, now);
  $("drops-badges").replaceChildren(...shown.map(badgeRow));
  $("drops-badges-meta").textContent = badges.badges.length ? t("popup.drops.badgesKnown", { count: badges.badges.length }) : "";
  const sync = $("drops-badges-sync");
  sync.hidden = shown.length > 0;
  sync.textContent = badges.syncedAt ? t("popup.drops.badgesSince", { date: shortDate(badges.syncedAt) }) : t("popup.drops.badgesSyncing");
}

function renderCatalog() {
  if (!$("badges-catalog")) return;
  const context = { now: Date.now(), campaigns: campaigns.campaigns, names: activeNames({ rewards: rewards.rewards, campaigns: campaigns.campaigns, drops: progress.drops }) };
  const counts = countBadges(badges, context);
  document.querySelectorAll("#badges-filters [data-filter]").forEach((button) => {
    const active = button.dataset.filter === badgeFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    const count = button.querySelector("[data-count]");
    if (count) count.textContent = badges.badges.length ? String(counts[button.dataset.filter] ?? 0) : "";
  });
  const list = catalogBadges(badges, badgeFilter, badgeQuery, context);
  $("badges-catalog").replaceChildren(...list.slice(0, badgeLimit).map(badgeRow));
  $("badges-catalog-empty").hidden = list.length > 0 || !badges.badges.length;
  $("badges-more").hidden = list.length <= badgeLimit;
}

// ─── Panneau : historique (StreamPulse+) ──────────────────────────────────────

function renderHistory() {
  const plus = deps.isPlus();
  $("drops-locked").hidden = plus;
  $("drops-history").hidden = !plus;
  const summary = summarizeHistory(history);
  $("drops-history-meta").textContent = plus && summary.total ? plural(summary.total, "popup.drops.historyMetaOne", "popup.drops.historyMetaOther") : "";
  if (!plus) return;
  if (!summary.total) {
    $("drops-history").replaceChildren(el("p", "drops-empty", t("popup.drops.historyEmpty")));
    return;
  }
  const nodes = [];
  let rows = 0;
  for (const month of summary.months) {
    if (rows >= HISTORY_ROWS) break;
    nodes.push(el("p", "drops-month", plural(month.count, "popup.drops.historyMonthOne", "popup.drops.historyMonthOther", { month: monthLabel(month.key) })));
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
  $("drops-auto").classList.toggle("is-on", auto);
  $("drops-auto-label").textContent = t(auto ? "popup.drops.autoOn" : "popup.drops.autoOff");
  renderProgress(now);
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
    $("tab-settings")?.click();
    $("menu-tab-drops")?.click();
  };
  $("activity-drops")?.addEventListener("click", openPanel);
  $("activity-drops")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openPanel();
  });
  $("drops-auto")?.addEventListener("click", () => $("menu-tab-automation")?.click());
  $("drops-filters")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    filter = button.dataset.filter;
    renderCampaigns(Date.now());
  });
  $("drops-rewards")?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-url]");
    if (row) openTab(row.dataset.url);
  });
  $("drops-campaigns")?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-url]");
    if (row) openTab(row.dataset.url);
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
  $("badges-search")?.addEventListener("input", (event) => {
    badgeQuery = event.target.value;
    badgeLimit = 40;
    renderCatalog();
  });
  for (const id of ["badges-catalog", "drops-badges"]) {
    $(id)?.addEventListener("click", (event) => {
      const row = event.target.closest("[data-url]");
      if (row) openTab(row.dataset.url);
    });
  }
  $("badges-more")?.addEventListener("click", () => {
    badgeLimit += 40;
    renderCatalog();
  });
  $("drops-open-campaigns")?.addEventListener("click", () => openTab(CAMPAIGNS_PAGE));
  $("drops-unlock")?.addEventListener("click", () => deps.openPlus());
}

async function reload() {
  const stored = await chrome.storage.local.get([...DROPS_KEYS, PREFERENCES_KEY]);
  progress = progressFrom(stored);
  campaigns = campaignsFrom(stored);
  rewards = rewardsFrom(stored);
  badges = badgesFrom(stored);
  history = historyFrom(stored);
  prefs = stored[PREFERENCES_KEY] || {};
  render();
}

export async function initDrops({ isPlus, onPlusChange, openPlus }) {
  if (!$("menu-drops") && !$("activity-drops")) return;
  deps = { isPlus, openPlus };
  bind();
  onPlusChange(() => render());
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (DROPS_KEYS.some((key) => key in changes) || PREFERENCES_KEY in changes)) reload().catch(() => {});
  });
  await reload();
  // Les jeux regardés ne changent pas pendant que le popup est ouvert : lus une fois.
  chrome.storage.local.get([WATCH_DAILY_KEY]).then((stored) => {
    myGames = myGamesFrom(stored[WATCH_DAILY_KEY], Date.now());
    renderCampaigns(Date.now());
  }).catch(() => {});
  setInterval(render, TICK_MS);
  // Popup ouvert : on demande une lecture fraîche à un onglet Twitch, s'il y en a un.
  chrome.runtime.sendMessage({ type: "dropsRefresh" }).catch(() => {});
}
