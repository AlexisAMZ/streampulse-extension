// Panneau « Points » des Réglages : points de chaîne gagnés sur Twitch. Vue
// gratuite : total par chaîne. StreamPulse+ : tuiles par raison, fiche de
// chaque streamer et journal des gains. Lit le storage, que le service worker
// alimente ; tous les calculs viennent de points-data.js.

import { t, getCurrentLanguage } from "./i18n.js";
import {
  POINTS_KEYS,
  REASONS,
  REASON_LABEL_KEYS,
  channelDetail,
  channelName,
  lastGainAt,
  stateFrom,
  summarize,
  tierFromFactor,
} from "./points-data.js";

const $ = (id) => document.getElementById(id);
const LIST_LIMIT = 25;
const JOURNAL_ROWS = 8;
const RESET_ARM_MS = 4000;
/** Gains uniques : sans gain sur la période, on montre leur état plutôt qu'un zéro. */
const STATUS_CODES = new Set(["FOLLOW", "CHEER", "SUB_GIFT"]);

let deps = { isPlus: () => false, openPlus: () => {} };
let state = stateFrom({});
let period = "7d";
let selected = null;
let resetTimer = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const locale = () => getCurrentLanguage();
const fmt = (value) => new Intl.NumberFormat(locale()).format(value);
const factorLabel = (factor) => new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(1 + factor);
const reasonLabel = (code) => t(REASON_LABEL_KEYS[code] || REASON_LABEL_KEYS.OTHER);

function dayLabel(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d || 1).toLocaleDateString(locale(), { day: "numeric", month: "short" });
}

function dateLabel(at) {
  return new Date(at).toLocaleDateString(locale(), { day: "numeric", month: "short" });
}

function whenLabel(at, now) {
  const sameDay = new Date(at).toDateString() === new Date(now).toDateString();
  return sameDay
    ? new Date(at).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })
    : dateLabel(at);
}

function agoLabel(at, now) {
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: "auto" });
  const minutes = Math.round((at - now) / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

function avatar(channelId) {
  const name = channelName(state, channelId);
  const initial = name.replace(/^#/, "").charAt(0).toUpperCase() || "?";
  const wrap = el("span", "pts-avatar");
  const url = state.channels[channelId]?.avatar;
  if (url) {
    const img = el("img");
    img.src = url;
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => {
      img.remove();
      wrap.textContent = initial;
    };
    wrap.append(img);
  } else {
    wrap.textContent = initial;
  }
  return wrap;
}

/** Barre empilée : un segment coloré par raison, à la part de chaque raison. */
function stackBar(reasons, total) {
  const bar = el("span", "pts-stack");
  for (const reason of REASONS) {
    const points = reasons?.[reason.code]?.points || 0;
    if (!points || !total) continue;
    const segment = el("i");
    segment.dataset.reason = reason.code;
    segment.style.width = `${(points / total) * 100}%`;
    bar.append(segment);
  }
  return bar;
}

function lcdBlock(total, meta) {
  const block = el("div", "pts-lcd");
  const value = el("p", "pts-lcd-total");
  value.append(el("span", null, fmt(total)), el("small", null, t("popup.points.unit")));
  const metaLine = el("p", "pts-lcd-meta");
  meta.filter(Boolean).forEach((text) => metaLine.append(el("span", null, text)));
  block.append(value, metaLine);
  return block;
}

// ─── Vue d'ensemble ────────────────────────────────────────────────────────────

function renderTiles(summary) {
  const tiles = summary.byReason
    .filter((reason) => reason.code !== "OTHER" || reason.points > 0)
    .map((reason) => {
      const tile = el("div", reason.points > 0 ? "pts-tile" : "pts-tile is-zero");
      const label = el("span", "pts-tile-label", reasonLabel(reason.code));
      label.dataset.reason = reason.code;
      tile.append(label, el("b", null, fmt(reason.points)), el("span", "pts-tile-note", reason.count ? t("popup.points.tileCount", { count: fmt(reason.count) }) : "—"));
      return tile;
    });
  if (summary.subBonus > 0) {
    const tile = el("div", "pts-tile is-sub");
    tile.append(el("span", "pts-tile-label", t("popup.points.subBonusTile")), el("b", null, `+${fmt(summary.subBonus)}`), el("span", "pts-tile-note", t("popup.points.subBonusTileNote")));
    tiles.push(tile);
  }
  $("points-reasons").replaceChildren(...tiles);
}

function renderChannels(summary, plus) {
  const max = summary.byChannel[0]?.points || 0;
  $("points-channels").replaceChildren(
    ...summary.byChannel.slice(0, LIST_LIMIT).map((row, index) => {
      const name = channelName(state, row.channelId);
      const track = el("span", "pts-track");
      const fill = plus ? stackBar(row.reasons, row.points) : el("span", "pts-fill");
      fill.style.width = `${max ? Math.max(3, (row.points / max) * 100) : 0}%`;
      track.append(fill);
      const cells = [
        el("span", "pts-rank", String(index + 1).padStart(2, "0")),
        avatar(row.channelId),
        el("span", "pts-name", name),
        track,
        el("span", "pts-value", fmt(row.points)),
      ];
      const item = el("li");
      if (plus) {
        const button = el("button", "pts-row");
        button.type = "button";
        button.dataset.channel = row.channelId;
        button.setAttribute("aria-label", t("popup.points.openDetail", { name }));
        button.append(...cells, el("span", "pts-chevron", "›"));
        item.append(button);
      } else {
        const line = el("div", "pts-row");
        line.append(...cells);
        item.append(line);
      }
      return item;
    }),
  );
}

function renderOverview(now, plus) {
  const summary = summarize(state, period, now);
  const empty = summary.total === 0;
  $("points-total").textContent = fmt(summary.total);
  const meta = [t("popup.points.metaChannels", { count: fmt(summary.channelCount) })];
  if (plus && summary.subBonus > 0) meta.push(t("popup.points.metaSubBonus", { points: fmt(summary.subBonus) }));
  $("points-meta").replaceChildren(...meta.map((text) => el("span", null, text)));
  $("points-empty").hidden = !empty;
  $("points-reasons").hidden = !plus || empty;
  $("points-click-hint").hidden = !plus || empty;
  $("points-locked").hidden = plus;
  if (plus && !empty) renderTiles(summary);
  renderChannels(summary, plus);
}

// ─── Fiche d'une chaîne (StreamPulse+) ─────────────────────────────────────────

function statusBadge(code, detail) {
  const status = detail.status[code];
  if (status?.done) return el("span", "pts-status is-done", t("popup.points.statusDone", { date: dateLabel(status.at) }));
  if (code === "FOLLOW") return el("span", "pts-status", "—");
  return el("span", "pts-status is-open", t("popup.points.statusNotYet"));
}

function ruleLabel(reason) {
  if (!reason.rule) return "—";
  return reason.upTo ? t("popup.points.ruleUpTo", { points: fmt(reason.rule) }) : `+${fmt(reason.rule)}`;
}

function reasonTable(detail) {
  const table = el("table", "pts-table");
  const head = el("tr");
  [["popup.points.tableSource", ""], ["popup.points.tableRule", ""], ["popup.points.tableCount", "n"], ["popup.points.tablePoints", "n"]]
    .forEach(([key, className]) => head.append(el("th", className, t(key))));
  head.append(el("th"));
  const thead = el("thead");
  thead.append(head);

  const rows = detail.reasons
    .filter((reason) => reason.code !== "OTHER" || reason.count > 0)
    .map((reason) => {
      const row = el("tr", reason.count ? "" : "is-muted");
      const label = el("td", "pts-reason", reasonLabel(reason.code));
      label.dataset.reason = reason.code;
      const extra = el("td");
      if (!reason.count && STATUS_CODES.has(reason.code)) {
        extra.append(statusBadge(reason.code, detail));
      } else if (reason.count) {
        const bar = el("span", "pts-minibar");
        const fill = el("i");
        fill.dataset.reason = reason.code;
        fill.style.width = `${detail.total ? Math.max(4, (reason.points / detail.total) * 100) : 0}%`;
        bar.append(fill);
        extra.append(bar);
      }
      row.append(label, el("td", "pts-rule", ruleLabel(reason)), el("td", "n", reason.count ? fmt(reason.count) : "—"), el("td", "n pts-points", fmt(reason.points)), extra);
      return row;
    });

  if (detail.subBonus > 0) {
    const row = el("tr", "is-sub");
    row.append(el("td", "pts-reason", t("popup.points.subBonusRow")), el("td", "pts-rule", t("popup.points.subBonusRule")), el("td"), el("td", "n pts-points", `+${fmt(detail.subBonus)}`), el("td"));
    rows.push(row);
  }
  const total = el("tr", "is-total");
  total.append(el("td", null, t("popup.points.total")), el("td"), el("td", "n", fmt(detail.count)), el("td", "n", fmt(detail.total)), el("td"));
  rows.push(total);

  const tbody = el("tbody");
  tbody.append(...rows);
  table.append(thead, tbody);
  return table;
}

function daysChart(days) {
  const block = el("div", "pts-days-block");
  block.append(el("p", "pts-subtitle", t("popup.points.days")));
  const max = Math.max(0, ...days.map((day) => day.points));
  const bars = el("div", "pts-days");
  days.forEach((day) => {
    const bar = el("i", day.points ? "" : "is-empty");
    bar.style.height = max && day.points ? `${Math.max(6, (day.points / max) * 100)}%` : "2px";
    bar.title = `${dayLabel(day.key)} · ${fmt(day.points)}`;
    bars.append(bar);
  });
  const axis = el("div", "pts-axis");
  axis.append(el("span", null, days[0] ? dayLabel(days[0].key) : ""), el("span", null, days.length ? dayLabel(days[days.length - 1].key) : ""));
  block.append(bars, axis);
  return block;
}

function journalList(journal, now) {
  const block = el("div", "pts-journal");
  block.append(el("p", "pts-subtitle", t("popup.points.journal")));
  if (!journal.length) {
    block.append(el("p", "pts-muted", t("popup.points.journalEmpty")));
    return block;
  }
  journal.slice(0, JOURNAL_ROWS).forEach((entry) => {
    const row = el("div", "pts-journal-row");
    const label = el("span", null, reasonLabel(entry.reason));
    if (entry.factor > 0) label.append(el("small", null, ` ×${factorLabel(entry.factor)}`));
    row.append(el("time", null, whenLabel(entry.at, now)), label, el("b", null, `+${fmt(entry.points)}`));
    block.append(row);
  });
  return block;
}

function renderDetail(now) {
  const detail = channelDetail(state, selected, period, now);
  const head = el("div", "pts-detail-head");
  const info = el("div", "pts-detail-info");
  info.append(el("h3", null, detail.name));
  const tier = tierFromFactor(detail.factor);
  if (tier) info.append(el("span", "pts-badge", t("popup.points.tier", { tier, factor: factorLabel(detail.factor) })));
  const balance = el("div", "pts-balance");
  if (detail.balance !== null) balance.append(el("span", null, t("popup.points.balance")), el("b", null, fmt(detail.balance)));
  head.append(avatar(selected), info, balance);

  const lcd = lcdBlock(detail.total, [detail.subBonus > 0 ? t("popup.points.detailSubBonus", { points: fmt(detail.subBonus) }) : ""]);
  const bottom = el("div", "pts-detail-bottom");
  bottom.append(daysChart(detail.days), journalList(detail.journal, now));
  $("points-detail-body").replaceChildren(head, lcd, reasonTable(detail), bottom);
}

// ─── Rendu et événements ───────────────────────────────────────────────────────

function renderHealth(now) {
  const last = lastGainAt(state);
  $("points-health").textContent = last
    ? t("popup.points.healthLast", { ago: agoLabel(last, now) })
    : t("popup.points.healthNever");
}

function syncPeriodButtons() {
  document.querySelectorAll("#points-period [data-period]").forEach((button) => {
    const active = button.dataset.period === period;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function render() {
  if (!$("menu-points")) return;
  const now = Date.now();
  const plus = deps.isPlus();
  if (!plus || (selected && !state.channels[selected])) selected = null;
  $("points-overview").hidden = Boolean(selected);
  $("points-detail").hidden = !selected;
  if (selected) renderDetail(now);
  else renderOverview(now, plus);
  renderHealth(now);
  syncPeriodButtons();
}

async function resetPoints(button) {
  // Double clic volontaire : le premier arme le bouton, le second efface.
  if (!button.dataset.armed) {
    button.dataset.armed = "1";
    button.textContent = t("popup.points.resetConfirm");
    resetTimer = setTimeout(() => {
      delete button.dataset.armed;
      button.textContent = t("popup.points.reset");
    }, RESET_ARM_MS);
    return;
  }
  clearTimeout(resetTimer);
  delete button.dataset.armed;
  button.textContent = t("popup.points.reset");
  button.disabled = true;
  let status;
  try {
    const result = await chrome.runtime.sendMessage({ type: "resetPoints" });
    if (result?.error) throw new Error(result.error);
    status = t("popup.points.resetDone");
  } catch (error) {
    status = error?.message || String(error);
  }
  // Relu après l'attente : le popup a pu être redessiné entre-temps.
  const current = $("btn-reset-points");
  if (current) current.disabled = false;
  $("points-reset-status").textContent = status;
}

function bind() {
  $("points-period")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-period]");
    if (!button) return;
    period = button.dataset.period;
    render();
  });
  $("points-channels")?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-channel]");
    if (!row || !deps.isPlus()) return;
    selected = row.dataset.channel;
    render();
    $("points-back")?.focus();
    $("menu-panels")?.scrollTo({ top: 0 });
  });
  $("points-back")?.addEventListener("click", () => {
    selected = null;
    render();
  });
  $("points-unlock")?.addEventListener("click", () => deps.openPlus());
  $("btn-reset-points")?.addEventListener("click", (event) => resetPoints(event.currentTarget));
}

async function reload() {
  state = stateFrom(await chrome.storage.local.get(POINTS_KEYS));
  render();
}

export async function initPoints({ isPlus, onPlusChange, openPlus }) {
  if (!$("menu-points")) return;
  deps = { isPlus, openPlus };
  bind();
  onPlusChange(() => render());
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && POINTS_KEYS.some((key) => key in changes)) reload().catch(() => {});
  });
  await reload();
}
