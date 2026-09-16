import { t, getCurrentLanguage, resolveLocale } from "./i18n.js";
import {
  DEFAULT_PLATFORM,
  getPlatformDefinition,
  getPlatformLabelKey,
  platformSupportsLiveStatus,
  formatHandleForDisplay,
  buildProfileUrl,
} from "./platforms.js";

// Popup rendering: the featured live on stage, the live strip tiles and the
// rows of the "all channels" sheet. popup.js owns state and storage.

const HOVER_DELAY = 500;
const THUMB_CACHE_MAX = 50;
const MAX_THUMB_CONCURRENCY = 3;
const FALLBACK_ICON = "images/photos/48px.png";

const STROKE = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const ICONS = {
  bell: `<svg ${STROKE}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
  game: `<svg ${STROKE}><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4M8 10v4"/><path d="M15 13h.01M18 11h.01"/></svg>`,
  title: `<svg ${STROKE}><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>`,
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2.5 2.9 6.2 6.6.7-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.7z"/></svg>',
  open: `<svg ${STROKE}><path d="M7 17 17 7"/><path d="M9 7h8v8"/></svg>`,
  trash: `<svg ${STROKE}><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4h8v2"/></svg>`,
  grip: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  list: `<svg ${STROKE}><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
};

const ALERTS = [
  { key: "notificationsEnabled", icon: "bell", label: "popup.osd.alertLive", hint: "popup.card.notificationsToggle", callback: "onToggleNotify" },
  { key: "gameNotificationsEnabled", icon: "game", label: "popup.osd.alertCategory", hint: "popup.card.gameNotificationsToggle", callback: "onToggleGameNotify" },
  { key: "titleNotificationsEnabled", icon: "title", label: "popup.osd.alertTitle", hint: "popup.card.titleNotificationsToggle", callback: "onToggleTitleNotify" },
];

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(className, { label = "", icon = "", text = "" } = {}) {
  const node = el("button", className);
  node.type = "button";
  if (icon) node.innerHTML = ICONS[icon];
  if (text) node.append(document.createTextNode(text));
  if (label) {
    node.setAttribute("aria-label", label);
    node.title = label;
  }
  return node;
}

function getPlatformLabel(platform) {
  return t(getPlatformLabelKey(platform));
}

function currentLocale() {
  return resolveLocale(getCurrentLanguage());
}

export function formatNumber(value) {
  try {
    return new Intl.NumberFormat(currentLocale()).format(value);
  } catch {
    return String(value);
  }
}

export function formatCompactNumber(value) {
  try {
    return new Intl.NumberFormat(currentLocale(), { notation: "compact", maximumFractionDigits: 1 }).format(value);
  } catch {
    return String(value);
  }
}

function formatMinutes(totalMinutes) {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours > 0) return t("popup.osd.durationHM", { h: hours, m: String(rest).padStart(2, "0") });
  return t("popup.osd.durationM", { m: rest });
}

function minutesSince(isoDate) {
  const start = Date.parse(isoDate);
  if (!Number.isFinite(start)) return null;
  const minutes = (Date.now() - start) / 60000;
  return minutes >= 0 ? minutes : null;
}

export function getDisplayLabel(streamer) {
  const platformId = streamer.platform || DEFAULT_PLATFORM;
  return streamer.displayName || formatHandleForDisplay(platformId, streamer.handle || streamer.twitch);
}

export function getStreamerUrl(streamer) {
  const platformId = streamer.platform || DEFAULT_PLATFORM;
  return buildProfileUrl(platformId, streamer.handle || streamer.twitch || streamer.id);
}

function getLiveState(streamer, status) {
  const active = status?.active || { isLive: false };
  const platformId = streamer.platform || DEFAULT_PLATFORM;
  const supported = platformSupportsLiveStatus(platformId) && active.supportsLiveStatus !== false;
  const viewers = Number.isFinite(active.viewers) ? active.viewers : status?.viewers;
  return {
    active,
    platformId,
    supported,
    isLive: supported && Boolean(active.isLive),
    viewers: Number.isFinite(viewers) ? viewers : null,
  };
}

function platformIcon(platformId) {
  return `../${getPlatformDefinition(platformId).icon || FALLBACK_ICON}`;
}

/**
 * Version pré-floutée d'un avatar pour la bannière : dessinée une fois dans un
 * canvas ~5× plus petit avec blur(5.6px) + saturate(1.3) + zoom 1.2 (l'équivalent
 * exact de blur(28px) en espace 780×300), puis servie en image statique. Le rendu
 * est identique mais la peinture au repos ne coûte plus un filtre live.
 * Repli transparent sur l'URL d'origine si le canvas est teinté (CORS) ou en erreur.
 */
function preblurAvatar(url, image) {
  const source = new Image();
  source.crossOrigin = "anonymous";
  source.onload = () => {
    try {
      const W = 156;
      const H = 60;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      ctx.filter = "blur(5.6px) saturate(1.3)";
      const scale = Math.max(W / source.naturalWidth, H / source.naturalHeight) * 1.2;
      const w = source.naturalWidth * scale;
      const h = source.naturalHeight * scale;
      ctx.drawImage(source, (W - w) / 2, (H - h) / 2, w, h);
      image.src = canvas.toDataURL();
      image.classList.add("sp-preblurred");
    } catch {
      image.src = url;
    }
  };
  source.onerror = () => {
    image.src = url;
  };
  source.src = url;
}

function avatarImage(className, streamer, platformId) {
  const img = el("img", className);
  const fallback = platformIcon(platformId);
  img.alt = "";
  img.decoding = "async";
  img.src = streamer.avatarUrl || fallback;
  img.onerror = function onAvatarError() {
    this.onerror = null;
    this.src = fallback;
  };
  return img;
}

// --- Thumbnail cache (survives popup close/reopen, LRU-bounded) ---
const thumbCache = new Map();
let thumbCacheLoaded = false;
let thumbCacheLoading = null;
let thumbSaveTimer = null;

function rememberThumb(key, url) {
  if (thumbCache.has(key)) thumbCache.delete(key);
  thumbCache.set(key, url);
  if (thumbCache.size > THUMB_CACHE_MAX) thumbCache.delete(thumbCache.keys().next().value);
}

async function readThumbCache() {
  try {
    const data = await chrome.storage.local.get("streampulse:thumbCache");
    for (const [key, url] of Object.entries(data["streampulse:thumbCache"] || {})) rememberThumb(key, url);
  } catch {
    // A missing cache only costs one network fetch.
  }
  thumbCacheLoaded = true;
}

function loadThumbCache() {
  if (thumbCacheLoaded) return Promise.resolve();
  thumbCacheLoading ||= readThumbCache().finally(() => {
    thumbCacheLoading = null;
  });
  return thumbCacheLoading;
}

function setCachedThumb(key, url) {
  if (url) rememberThumb(key, url);
  else thumbCache.delete(key);
  clearTimeout(thumbSaveTimer);
  thumbSaveTimer = setTimeout(() => {
    chrome.storage.local.set({ "streampulse:thumbCache": Object.fromEntries(thumbCache) }).catch(() => {});
  }, 1000);
}

loadThumbCache();

let activeThumbLoads = 0;
const thumbQueue = [];

function drainThumbQueue() {
  while (activeThumbLoads < MAX_THUMB_CONCURRENCY && thumbQueue.length > 0) {
    const job = thumbQueue.shift();
    activeThumbLoads++;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      activeThumbLoads--;
      drainThumbQueue();
    };
    try {
      job(release);
    } catch {
      release();
    }
  }
}

function probeImage(url, onOk, onFail) {
  thumbQueue.push((release) => {
    const probe = new Image();
    probe.onload = () => {
      release();
      if (probe.naturalWidth < 100) onFail();
      else onOk();
    };
    probe.onerror = () => {
      release();
      onFail();
    };
    probe.src = url;
  });
  drainThumbQueue();
}

function loadThumbnail(streamer, active, image, width, height) {
  const candidates = (active.thumbnailCandidates || [active.thumbnailUrl])
    .filter(Boolean)
    .map((url) => url.replace("{width}", String(width)).replace("{height}", String(height)));
  if (candidates.length === 0) return;

  const apply = (url) => {
    if (!image.isConnected) return;
    image.src = url;
    image.hidden = false;
  };
  let index = 0;
  const tryNext = () => {
    if (index >= candidates.length) {
      setCachedThumb(streamer.id, null);
      return;
    }
    const url = candidates[index++];
    probeImage(url, () => {
      apply(url);
      setCachedThumb(streamer.id, url);
    }, tryNext);
  };

  const cached = thumbCache.get(streamer.id);
  if (cached) {
    probeImage(cached, () => apply(cached), () => {
      setCachedThumb(streamer.id, null);
      tryNext();
    });
  } else {
    tryNext();
  }
}

// --- Kick hover preview on the stage: iframe after a short hover, freed on leave ---
function setupHoverPlayer(stage, media, platformId, streamer, onOpen) {
  stage._hoverAbort?.abort();
  if (platformId !== "kick" || !streamer.handle) return;
  const controller = new AbortController();
  stage._hoverAbort = controller;
  const { signal } = controller;
  const embedUrl = `https://player.kick.com/${encodeURIComponent(streamer.handle)}?muted=true`;
  let timer = null;

  media.style.pointerEvents = "auto";
  media.addEventListener("mouseenter", () => {
    if (media.querySelector(".hover-player-wrap")) return;
    timer = setTimeout(() => {
      const wrap = el("div", "hover-player-wrap");
      const frame = document.createElement("iframe");
      frame.allow = "autoplay; encrypted-media; picture-in-picture";
      frame.setAttribute("scrolling", "no");
      frame.src = embedUrl;
      // Iframes swallow clicks: a transparent layer keeps "click to watch".
      const overlay = el("div", "embed-click-overlay");
      overlay.addEventListener("click", onOpen);
      wrap.append(frame, overlay);
      media.appendChild(wrap);
      stage.classList.add("is-playing");
    }, HOVER_DELAY);
  }, { signal });
  stage.addEventListener("mouseleave", () => {
    clearTimeout(timer);
    stopHoverPlayer(stage, media);
  }, { signal });
}

function stopHoverPlayer(stage, media) {
  media.querySelectorAll(".hover-player-wrap").forEach((wrap) => {
    const frame = wrap.querySelector("iframe");
    if (frame) frame.src = "about:blank";
    wrap.remove();
  });
  stage.classList.remove("is-playing");
}

// --- Alerts ---
function alertToggle(className, streamer, alert, callbacks, withLabel) {
  const enabled = streamer[alert.key] !== false;
  const node = button(className, { icon: alert.icon, label: t(alert.hint) });
  if (withLabel) node.append(document.createTextNode(t(alert.label)));
  node.setAttribute("aria-pressed", String(enabled));
  node.addEventListener("click", async () => {
    const next = node.getAttribute("aria-pressed") !== "true";
    if (await callbacks[alert.callback](streamer.id, next)) {
      node.setAttribute("aria-pressed", String(next));
    }
  });
  return node;
}

// --- Stage ---
export function renderStage(stage, media, feature, streamer, status, { isNew }, callbacks) {
  stopHoverPlayer(stage, media);
  const { active, platformId, viewers } = getLiveState(streamer, status);
  const label = getDisplayLabel(streamer);
  const platformLabel = getPlatformLabel(platformId);
  const open = () => callbacks.onOpen(getStreamerUrl(streamer));
  stage.dataset.state = "live";

  const image = el("img", "stage-image");
  image.alt = t("popup.labels.previewAltLive", { name: label });
  image.hidden = true;
  media.replaceChildren(image);
  loadThumbnail(streamer, active, image, 960, 540);
  setupHoverPlayer(stage, media, platformId, streamer, open);

  const pills = el("div", "feature-pills");
  // The time on air rides inside the live pill so the row never wraps.
  const onAir = minutesSince(active.startedAt);
  const liveText = onAir !== null ? `${t("popup.osd.onAirChip")} · ${formatMinutes(onAir)}` : t("popup.osd.onAirChip");
  const live = el("span", "pill pill-live");
  live.append(el("i"), document.createTextNode(liveText));
  pills.append(live);
  if (viewers !== null) {
    const chip = el("span", "pill pill-dark");
    chip.title = t("popup.labels.viewers", { count: formatNumber(viewers) });
    chip.append(el("i"), document.createTextNode(t("popup.labels.viewers", { count: formatCompactNumber(viewers) })));
    pills.append(chip);
  }
  if (isNew) pills.append(el("span", "pill pill-new", t("popup.cplus.newBadge")));

  const text = el("div", "feature-text");
  text.append(
    pills,
    el("p", "feature-name", label),
    el("p", "feature-sub", [active.title || t("popup.card.defaultLiveTitle"), active.game, platformLabel].filter(Boolean).join(" · ")),
  );

  const alerts = el("div", "feature-alerts");
  alerts.setAttribute("role", "group");
  alerts.setAttribute("aria-label", t("popup.osd.alerts"));
  ALERTS.forEach((alert) => alerts.append(alertToggle("alert-toggle", streamer, alert, callbacks, true)));

  const watch = button("watch-button", { icon: "play", text: t("popup.osd.watch") });
  watch.addEventListener("click", open);

  feature.replaceChildren(el("div", "feature"));
  feature.firstChild.append(avatarImage(`feature-avatar ring-${platformId}`, streamer, platformId), text, alerts, watch);
}

export function renderStageEmpty(stage, media, feature, { kind, offlineCount, avatarUrl, onOpenSheet }) {
  stopHoverPlayer(stage, media);
  stage._hoverAbort?.abort();
  stage.dataset.state = kind;
  if (avatarUrl) {
    const image = el("img", "stage-image is-avatar");
    image.alt = "";
    // Le blur 28px efface tout détail : on pré-floute dans un canvas réduit
    // (rendu identique, peinture statique au repos au lieu d'un filtre live).
    preblurAvatar(avatarUrl, image);
    media.replaceChildren(image);
  } else {
    media.replaceChildren();
  }

  const box = el("div", "stage-empty");
  if (kind === "empty") {
    box.append(el("p", "stage-empty-title", t("popup.cplus.emptyTitle")), el("p", "stage-empty-body", t("popup.cplus.emptyBody")));
  } else {
    box.append(
      el("p", "stage-empty-title", t("popup.cplus.nobodyTitle")),
      el("p", "stage-empty-body", t("popup.cplus.nobodyBody", { count: offlineCount })),
    );
    const all = button("button", { icon: "list", text: t("popup.cplus.seeAll") });
    all.addEventListener("click", onOpenSheet);
    box.append(all);
  }
  feature.replaceChildren(box);
}

// --- Live strip ---
export function createMiniCard(streamer, status, { selected, pinned, isNew }, callbacks) {
  const { active, platformId, viewers } = getLiveState(streamer, status);
  const label = getDisplayLabel(streamer);
  const item = el("li", "mini");
  item.dataset.id = streamer.id;
  item.classList.toggle("is-selected", selected);
  item.classList.toggle("is-pinned", pinned);

  const hit = button("mini-hit", { label: t("popup.osd.rowLive", { name: label, platform: getPlatformLabel(platformId), game: active.game || "" }) });
  hit.removeAttribute("title");
  hit.setAttribute("aria-pressed", String(selected));
  const image = el("img", "mini-image");
  image.alt = "";
  image.hidden = true;
  hit.append(image);
  loadThumbnail(streamer, active, image, 440, 248);
  if (viewers !== null) {
    const chip = el("span", "pill pill-dark mini-viewers");
    chip.append(el("i"), document.createTextNode(formatCompactNumber(viewers)));
    hit.append(chip);
  }
  if (isNew) hit.append(el("span", "pill pill-new mini-new", t("popup.cplus.newBadge")));
  const who = el("span", "mini-who");
  const text = el("span", "mini-text");
  text.append(el("span", "mini-name", label), el("span", "mini-game", active.game || getPlatformLabel(platformId)));
  who.append(avatarImage(`mini-avatar ring-${platformId}`, streamer, platformId), text);
  hit.append(who);
  hit.addEventListener("click", () => callbacks.onSelect(streamer.id));

  const pinLabel = t(pinned ? "popup.cplus.unpin" : "popup.cplus.pin", { name: label });
  const pin = button("mini-pin", { icon: "star", label: pinLabel });
  pin.setAttribute("aria-pressed", String(pinned));
  pin.addEventListener("click", () => callbacks.onTogglePin(streamer.id));

  item.append(hit, pin);
  return item;
}

export function createAllChannelsTile(offlineStreamers, offlineCount, onOpen) {
  const item = el("li", "mini mini-all");
  const hit = button("mini-hit");
  const stack = el("span", "avatar-stack");
  offlineStreamers.forEach((streamer) => stack.append(avatarImage("", streamer, streamer.platform || DEFAULT_PLATFORM)));
  const text = el("span", "");
  text.append(
    el("span", "mini-all-title", offlineCount > 0 ? t("popup.cplus.offlineTile", { count: offlineCount }) : t("popup.cplus.allChannels")),
    el("span", "mini-all-action", `${t("popup.cplus.seeAll")} ›`),
  );
  hit.append(stack, text);
  hit.addEventListener("click", onOpen);
  item.append(hit);
  return item;
}

// --- All channels sheet ---
function highlight(target, text, query) {
  const index = query ? text.toLowerCase().indexOf(query) : -1;
  if (index < 0) {
    target.textContent = text;
    return;
  }
  target.append(
    document.createTextNode(text.slice(0, index)),
    el("mark", "", text.slice(index, index + query.length)),
    document.createTextNode(text.slice(index + query.length)),
  );
}

function rowMeta(active, supported, isLive, viewers, platformLabel) {
  if (!supported) return t("popup.card.statusUnsupported", { platform: platformLabel });
  if (isLive) {
    const audience = viewers !== null ? t("popup.labels.viewers", { count: formatNumber(viewers) }) : "";
    return [active.game, audience, platformLabel].filter(Boolean).join(" · ");
  }
  const lastGame = active.lastGame || active.game;
  return [lastGame ? t("popup.osd.lastCategory", { game: lastGame }) : "", platformLabel].filter(Boolean).join(" · ");
}

function groupSelect(streamer, label, groups, groupId, onSetGroup) {
  const select = el("select", "settings-select row-group");
  select.setAttribute("aria-label", t("popup.cplus.groupLabel", { name: label }));
  const none = el("option", "", t("popup.cplus.noGroup"));
  none.value = "";
  select.append(none);
  groups.forEach((group) => {
    const option = el("option", "", group.name);
    option.value = group.id;
    select.append(option);
  });
  select.value = groupId;
  select.addEventListener("change", () => onSetGroup(streamer.id, select.value));
  return select;
}

export function createChannelRow(streamer, status, options, callbacks) {
  const { query, pinned, groups, groupId, index, draggable } = options;
  const { active, platformId, supported, isLive, viewers } = getLiveState(streamer, status);
  const label = getDisplayLabel(streamer);
  const platformLabel = getPlatformLabel(platformId);

  const row = el("li", `channel-row ${isLive ? "live" : "offline"}`);
  row.dataset.id = streamer.id;
  row.dataset.index = String(index);
  if (draggable) {
    row.draggable = true;
    row.setAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown");
    const grip = el("span", "row-grip");
    grip.innerHTML = ICONS.grip;
    grip.title = t("popup.cplus.drag", { name: label });
    row.append(grip);
  }

  const main = el(isLive ? "button" : "span", "row-main");
  if (isLive) {
    main.type = "button";
    main.title = t("popup.cplus.feature", { name: label });
    main.addEventListener("click", () => callbacks.onFeature(streamer.id));
  }
  const name = el("span", "row-name");
  highlight(name, label, query);
  main.append(name, el("span", "row-meta", rowMeta(active, supported, isLive, viewers, platformLabel)));

  const state = el("span", `row-state${isLive ? " is-live" : ""}`);
  state.append(el("i"), document.createTextNode(t(isLive ? "popup.cplus.stateLive" : "popup.cplus.stateOffline")));

  const actions = el("span", "row-actions");
  const pin = button("row-icon pin", { icon: "star", label: t(pinned ? "popup.cplus.unpin" : "popup.cplus.pin", { name: label }) });
  pin.setAttribute("aria-pressed", String(pinned));
  pin.addEventListener("click", () => callbacks.onTogglePin(streamer.id));
  actions.append(pin);
  ALERTS.forEach((alert) => actions.append(alertToggle("row-icon", streamer, alert, callbacks, false)));
  if (groups.length) actions.append(groupSelect(streamer, label, groups, groupId, callbacks.onSetGroup));
  const open = button("row-icon", { icon: "open", label: t("popup.cplus.open", { name: label }) });
  open.addEventListener("click", () => callbacks.onOpen(getStreamerUrl(streamer)));
  const remove = button("row-icon remove", { icon: "trash", label: t("popup.cplus.remove", { name: label }) });
  actions.append(open, remove);

  const confirm = el("span", "row-confirm");
  confirm.hidden = true;
  confirm.setAttribute("role", "alertdialog");
  confirm.setAttribute("aria-label", t("popup.osd.confirmRemove", { name: label }));
  const cancel = button("button button-ghost", { text: t("popup.osd.cancel") });
  const confirmRemove = button("button button-danger", { text: t("popup.osd.remove") });
  confirm.append(el("p", "", t("popup.osd.confirmRemove", { name: label })), cancel, confirmRemove);

  remove.addEventListener("click", () => {
    actions.hidden = true;
    state.hidden = true;
    confirm.hidden = false;
    cancel.focus();
  });
  const closeConfirm = () => {
    confirm.hidden = true;
    actions.hidden = false;
    state.hidden = false;
    remove.focus();
  };
  cancel.addEventListener("click", closeConfirm);
  confirm.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      closeConfirm();
    }
  });
  confirmRemove.addEventListener("click", () => callbacks.onRemove(streamer.id, label));

  row.append(avatarImage(`row-avatar${isLive ? ` ring-${platformId}` : ""}`, streamer, platformId), main, state, actions, confirm);
  return row;
}
