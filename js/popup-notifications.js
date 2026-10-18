// Outils locaux : la pause n'ecrit que sa cle, le diagnostic n'envoie rien.
import { getCurrentLanguage, onLanguageChange, resolveLocale, t } from "./i18n.js";
import {
  NOTIFICATION_PAUSE_KEY, NOTIFICATION_PINS_KEY, diagnoseStreamerNotifications,
  pauseNotifications, readNotificationControls, readNotificationPermission,
  resumeNotifications, setNotificationPauseException,
} from "./notification-controls.js";
import { PLUS_KEY } from "./plus.js";
import { SMART_ALERTS_KEY } from "./smart-alerts.js";
import { PREFERENCES_KEY, STORAGE_KEYS } from "./sw/constants.js";

const instances = new WeakMap();

/** Call after initI18n and mounting #notification-tools. Returns { refresh, destroy } or null. */
export async function initNotificationControls({ isPlus = () => false, getStreamers = () => [], getPreferences = () => null, diagnosticRoot = null } = {}) {
  const root = document.getElementById("notification-tools");
  if (!root) return null;
  const existing = instances.get(root);
  if (existing) {
    await existing.refresh();
    return existing;
  }

  const labels = [];
  function node(tag, className, id, key) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (id) element.id = id;
    if (key) {
      element.dataset.i18n = key;
      labels.push([element, key]);
    }
    return element;
  }
  function text(element, value) {
    if (element.textContent !== value) element.textContent = value;
  }
  function dateLabel(value) {
    if (!Number.isFinite(value) || Number.isNaN(new Date(value).getTime())) return null;
    return new Intl.DateTimeFormat(resolveLocale(getCurrentLanguage()), { dateStyle: "short", timeStyle: "short" }).format(value);
  }

  const pauseHeading = node("h3", "settings-group-header", null, "popup.notificationTools.pauseTitle");
  const pauseStatus = node("p", "settings-note", "notification-pause-status");
  pauseStatus.setAttribute("role", "status");
  const actions = node("div", "panel-actions");
  const hour = node("button", "button button-quiet", "notification-pause-hour", "popup.notificationTools.pauseHour");
  const tomorrow = node("button", "button button-quiet", "notification-pause-tomorrow", "popup.notificationTools.pauseTomorrow");
  const resume = node("button", "button button-quiet", "notification-resume", "popup.notificationTools.resume");
  actions.append(hour, tomorrow, resume);
  const exceptionRow = node("label", "settings-toggle");
  const exceptionText = node("span", "settings-text");
  exceptionText.append(
    node("span", "settings-title", null, "popup.notificationTools.exceptPinned"),
    node("span", "settings-description", "notification-exception-hint", "popup.notificationTools.exceptPinnedHint"),
  );
  const exception = node("input", null, "notification-except-pinned");
  exception.type = "checkbox";
  exception.setAttribute("role", "switch");
  exception.setAttribute("aria-describedby", "notification-exception-hint");
  exceptionRow.append(exceptionText, exception);

  const error = node("p", "settings-description", "notification-tools-error");
  error.setAttribute("role", "alert");
  const diagnosticHead = node("div", "panel-head");
  const refreshButton = node("button", "button button-quiet", "notification-refresh", "popup.notificationTools.refresh");
  diagnosticHead.append(node("h3", "settings-group-header", null, "popup.notificationTools.diagnosticTitle"), refreshButton);
  const hint = node("p", "settings-description", "notification-diagnostic-hint", "popup.notificationTools.diagnosticHint");
  const picker = node("div", "field-stack");
  const selectLabel = node("label", "settings-title", null, "popup.notificationTools.streamerLabel");
  selectLabel.setAttribute("for", "notification-streamer");
  const select = node("select", "settings-select", "notification-streamer");
  select.setAttribute("aria-describedby", "notification-diagnostic-hint");
  picker.append(selectLabel, select);
  const empty = node("p", "settings-note", "notification-empty", "popup.notificationTools.empty");
  const results = node("div", "field-stack", "notification-results");
  results.setAttribute("role", "status");
  const observed = node("p", "settings-description", "notification-observed-at");
  const decision = node("p", "settings-title", "notification-decision");
  const permission = node("p", "settings-note", "notification-permission");
  const silence = node("p", "settings-note", "notification-silence");
  const quiet = node("p", "settings-note", "notification-quiet");
  const settings = node("p", "settings-note", "notification-settings");
  const plus = node("p", "settings-note", "notification-plus");
  const smart = node("p", "settings-note", "notification-smart");
  results.append(observed, decision, permission, silence, quiet, settings, plus, smart);
  // Le diagnostic peut vivre ailleurs (rubrique Aide) ; sans second point de montage, tout reste ensemble.
  const diagnosticNodes = [diagnosticHead, hint, picker, empty, results];
  if (diagnosticRoot) {
    root.replaceChildren(pauseHeading, pauseStatus, actions, exceptionRow, error);
    diagnosticRoot.replaceChildren(...diagnosticNodes);
  } else {
    root.replaceChildren(pauseHeading, pauseStatus, actions, exceptionRow, error, ...diagnosticNodes);
  }
  for (const button of [hour, tomorrow, resume, refreshButton]) button.type = "button";

  let snapshot = null;
  let reading = false;
  let saving = false;
  let disposed = false;
  let errorKey = null;
  let request = 0;
  let timer;
  let choicesKey = "";
  const events = new AbortController();

  function render() {
    if (disposed) return;
    const now = Date.now();
    for (const [element, key] of labels) text(element, t(key));
    error.hidden = !errorKey;
    text(error, errorKey ? t(errorKey) : "");
    const paused = Boolean(snapshot && snapshot.controls.pause.until > now);
    text(pauseStatus, snapshot
      ? paused ? t("popup.notificationTools.pauseActive", { until: dateLabel(snapshot.controls.pause.until), time: dateLabel(snapshot.controls.pause.until) }) : t("popup.notificationTools.pauseInactive")
      : t("popup.notificationTools.loading"));
    pauseStatus.hidden = !snapshot && Boolean(errorKey);
    const unavailable = reading || saving || !snapshot;
    hour.disabled = tomorrow.disabled = exception.disabled = unavailable;
    resume.disabled = unavailable || !paused;
    refreshButton.disabled = reading || saving;
    root.setAttribute("aria-busy", String(reading || saving));

    const streamers = getStreamers() || [];
    const choices = streamers.map((streamer) => [streamer.id, String(streamer.displayName || streamer.handle || streamer.twitch || streamer.id)]);
    const nextChoicesKey = JSON.stringify(choices);
    if (choicesKey !== nextChoicesKey) {
      const selected = select.value;
      select.replaceChildren(...choices.map(([id, name]) => {
        const option = node("option");
        option.value = id;
        option.textContent = name;
        return option;
      }));
      if (choices.some(([id]) => id === selected)) select.value = selected;
      choicesKey = nextChoicesKey;
    }
    const streamer = streamers.find((item) => item.id === select.value);
    select.title = choices.find(([id]) => id === select.value)?.[1] || "";
    select.disabled = !snapshot || !streamer;
    picker.hidden = empty.hidden = !snapshot;
    if (snapshot) {
      picker.hidden = streamers.length === 0;
      empty.hidden = streamers.length !== 0;
    }
    results.hidden = !snapshot || !streamer;
    if (snapshot && streamer) {
      const preferences = getPreferences() || snapshot.controls.preferences;
      const plusActive = isPlus() === true;
      const report = diagnoseStreamerNotifications({
        ...snapshot.controls, preferences, streamer, isPlus: plusActive, permission: snapshot.permission, now,
        status: snapshot.data[STORAGE_KEYS.STATUSES]?.[streamer.id],
        liveState: snapshot.data[STORAGE_KEYS.LIVE_STATE]?.[streamer.id],
        smartRules: snapshot.data[SMART_ALERTS_KEY],
      });
      const date = dateLabel(report.updatedAt);
      text(observed, date ? t("popup.notificationTools.observedAt", { date }) : t("popup.notificationTools.noObservationTime"));
      text(decision, t(`popup.notificationTools.reason.${report.decision.reason}`));
      text(permission, t(report.permission === "granted" ? "popup.notificationTools.permissionGranted"
        : report.permission === "denied" ? "popup.notificationTools.permissionDenied" : "popup.notificationTools.permissionUnknown"));
      text(silence, report.silence.pinnedException ? t("popup.notificationTools.pinnedAllowed")
        : report.silence.paused ? t("popup.notificationTools.pauseActive", { until: dateLabel(report.silence.until) }) : t("popup.notificationTools.pauseInactive"));
      text(quiet, report.silence.quiet ? t("popup.notificationTools.quietActive", { start: preferences.quietHoursStart, end: preferences.quietHoursEnd }) : t("popup.notificationTools.quietInactive"));
      text(settings, t("popup.notificationTools.settings", Object.fromEntries(Object.entries(report.settings).map(([key, enabled]) => [key, t(enabled ? "popup.notificationTools.enabled" : "popup.notificationTools.disabled")]))));
      text(plus, t(plusActive ? "popup.notificationTools.plusActive" : "popup.notificationTools.plusInactive"));
      text(smart, t(report.smart.active ? "popup.notificationTools.smartActive"
        : report.smart.configured ? "popup.notificationTools.smartInactive" : "popup.notificationTools.smartNone", { count: report.smart.configured }));
    }

    // UI only: the worker resumes by comparing timestamps, even with no popup.
    clearTimeout(timer);
    if (snapshot) timer = setTimeout(render, Math.min(60_000 - now % 60_000, paused ? snapshot.controls.pause.until - now : Infinity));
  }

  async function refresh() {
    if (disposed) return;
    const current = ++request;
    reading = true;
    render();
    try {
      const [controls, data, permission] = await Promise.all([
        readNotificationControls(),
        chrome.storage.local.get([STORAGE_KEYS.STATUSES, STORAGE_KEYS.LIVE_STATE, SMART_ALERTS_KEY]),
        readNotificationPermission(),
      ]);
      if (disposed || current !== request) return;
      if (!snapshot || controls.pause.until !== snapshot.controls.pause.until || controls.pause.exceptPinned !== snapshot.controls.pause.exceptPinned) {
        exception.checked = controls.pause.exceptPinned;
      }
      snapshot = { controls, data, permission };
      errorKey = null;
    } catch (_error) {
      if (disposed || current !== request) return;
      snapshot = null;
      errorKey = "popup.notificationTools.readError";
    } finally {
      if (!disposed && current === request) {
        reading = false;
        render();
      }
    }
  }

  async function save(operation) {
    if (saving || reading || !snapshot || disposed) return;
    saving = true;
    errorKey = null;
    render();
    try {
      await operation();
      if (!disposed) await refresh();
    } catch (_error) {
      errorKey = "popup.notificationTools.writeError";
      if (snapshot?.controls.pause.until > Date.now()) exception.checked = snapshot.controls.pause.exceptPinned;
    } finally {
      // eslint-disable-next-line require-atomic-updates -- The synchronous guard admits only one writer.
      saving = false;
      render();
    }
  }

  let queued = false;
  function requestRefresh() {
    if (queued || disposed) return;
    queued = true;
    // Let the parent's storage listener update its state-backed getters first.
    queueMicrotask(() => { queued = false; if (!disposed) void refresh(); });
  }
  const watched = new Set([NOTIFICATION_PAUSE_KEY, NOTIFICATION_PINS_KEY, PREFERENCES_KEY, PLUS_KEY, SMART_ALERTS_KEY, STORAGE_KEYS.STREAMERS, STORAGE_KEYS.STATUSES, STORAGE_KEYS.LIVE_STATE]);
  const storageChanged = (changes, area) => {
    if (area === "local" && Object.keys(changes).some((key) => watched.has(key))) requestRefresh();
  };
  const languageChanged = onLanguageChange(render);
  chrome.storage.onChanged.addListener(storageChanged);
  hour.addEventListener("click", () => void save(() => pauseNotifications("hour", exception.checked)), { signal: events.signal });
  tomorrow.addEventListener("click", () => void save(() => pauseNotifications("tomorrow", exception.checked)), { signal: events.signal });
  resume.addEventListener("click", () => void save(() => resumeNotifications()), { signal: events.signal });
  exception.addEventListener("change", () => {
    if (snapshot?.controls.pause.until > Date.now()) void save(() => setNotificationPauseException(exception.checked));
  }, { signal: events.signal });
  select.addEventListener("change", render, { signal: events.signal });
  refreshButton.addEventListener("click", requestRefresh, { signal: events.signal });
  window.addEventListener("focus", requestRefresh, { signal: events.signal });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) requestRefresh(); }, { signal: events.signal });

  function destroy() {
    if (disposed) return;
    disposed = true;
    request += 1;
    clearTimeout(timer);
    events.abort();
    languageChanged();
    chrome.storage.onChanged.removeListener(storageChanged);
    instances.delete(root);
    root.replaceChildren();
    diagnosticRoot?.replaceChildren();
  }
  window.addEventListener("pagehide", destroy, { signal: events.signal });
  const controller = { refresh, destroy };
  instances.set(root, controller);
  await refresh();
  return controller;
}
