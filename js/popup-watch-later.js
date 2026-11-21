import { getCurrentLanguage, onLanguageChange, resolveLocale, t } from "./i18n.js";
import { bindInlineConfirm } from "./inline-confirm.js";
import { WATCH_LATER_KEY, WATCH_LATER_LIMITS, mergeWatchLater, normalizeWatchLater } from "./watch-later.js";

const instances = new WeakMap();
let writeQueue = Promise.resolve();

function updateWatchLater(change) {
  const operation = writeQueue.then(async () => {
    const stored = await chrome.storage.local.get(WATCH_LATER_KEY);
    const result = change(normalizeWatchLater(stored[WATCH_LATER_KEY]));
    await chrome.storage.local.set({ [WATCH_LATER_KEY]: result.entries });
    return result.entry;
  });
  // Only this popup's gestures are serialized; failures still reject to callers.
  writeQueue = operation.catch(() => {});
  return operation;
}

/** Inline card used by the History grid: one click, no form to fill again. */
export function createWatchLaterButton(entry) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button-quiet watch-later-save";
  button.textContent = t("popup.watchLater.save");
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await updateWatchLater((current) => {
        return mergeWatchLater(current, {
          id: entry.id,
          url: entry.vodUrl || entry.url,
          title: entry.title || entry.game || entry.displayName,
          note: "",
          createdAt: Date.now(),
          platform: entry.platform,
        }, { now: Date.now() }).entries;
      });
      button.textContent = t("popup.watchLater.saved");
    } catch {
      button.textContent = t("popup.watchLater.writeError");
      button.disabled = false;
    }
  });
  return button;
}

/** Call only on a user gesture (manual form, live or history/VOD save button).
 * Returns the saved entry. Errors expose .code: invalidUrl/invalidTitle/invalidNote/full.
 * Omitting note preserves it; passing "" explicitly clears it.
 */
export async function saveWatchLater(input = {}) {
  const { url, title, note } = input || {};
  return updateWatchLater((entries) => mergeWatchLater(entries, { url, title, note }, {
    id: crypto.randomUUID(), createdAt: Date.now(),
  }));
}

/** Mount after initI18n and #watch-later. Returns { refresh, destroy }, or null. */
export async function initWatchLater() {
  const root = document.getElementById("watch-later");
  if (!root) return null;
  if (typeof root.closest === "function") {
    const historyView = root.closest("#history-view") || document?.getElementById?.("history-view");
    if (historyView && !historyView.classList?.contains?.("hidden")) {
      const panel = historyView.closest?.(".menu-panel");
      if (panel) panel.hidden = false;
      const menu = historyView.closest?.(".menu");
      if (menu) menu.classList?.remove?.("hidden");
    }
  }
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

  const head = node("div", "panel-head");
  const heading = node("h3", "settings-group-header", "watch-later-heading", "popup.watchLater.title");
  const count = node("span", "field-value", "watch-later-count");
  const refreshButton = node("button", "button button-quiet", "watch-later-refresh", "popup.watchLater.refresh");
  refreshButton.type = "button";
  head.append(heading, count, refreshButton);
  const hint = node("p", "settings-description", "watch-later-hint", "popup.watchLater.hint");
  const form = node("form", "field-stack watch-later-form", "watch-later-form");
  form.noValidate = true;
  const formHeading = node("h4", "settings-title", "watch-later-form-heading");
  form.setAttribute("aria-labelledby", formHeading.id);
  form.append(formHeading);

  const fields = {};
  for (const [name, key] of [["url", "popup.watchLater.urlLabel"], ["title", "popup.watchLater.titleLabel"], ["note", "popup.watchLater.noteLabel"]]) {
    const label = node("label", "settings-title", null, key);
    const input = node(name === "note" ? "textarea" : "input", name === "note" ? "settings-textarea" : "text-input", `watch-later-${name}`);
    label.setAttribute("for", input.id);
    input.name = name;
    input.maxLength = WATCH_LATER_LIMITS[name];
    input.setAttribute("aria-describedby", "watch-later-error");
    if (name === "note") input.rows = 2;
    else input.type = name === "url" ? "url" : "text";
    fields[name] = input;
    form.append(label, input);
  }
  fields.url.required = true;
  fields.url.autocomplete = "off";
  fields.url.spellcheck = false;
  fields.url.setAttribute("aria-describedby", "watch-later-hint watch-later-error");
  const actions = node("div", "link-row");
  const saveButton = node("button", "button button-primary", "watch-later-save");
  saveButton.type = "submit";
  const cancel = node("button", "button button-quiet", "watch-later-cancel", "popup.watchLater.cancel");
  cancel.type = "button";
  actions.append(saveButton, cancel);
  form.append(actions);
  const error = node("p", "settings-description", "watch-later-error");
  error.setAttribute("role", "alert");
  const status = node("p", "settings-note", "watch-later-status");
  status.setAttribute("role", "status");
  const empty = node("p", "settings-note", "watch-later-empty", "popup.watchLater.empty");
  const list = node("ul", "watch-later-list", "watch-later-list");
  list.setAttribute("aria-labelledby", heading.id);
  root.setAttribute("aria-labelledby", heading.id);
  root.replaceChildren(head, hint, form, error, status, empty, list);

  let entries = null;
  let editing = null;
  let reading = false;
  let saving = false;
  let disposed = false;
  let request = 0;
  let revision = 0;
  let rowSequence = 0;
  let errorKey = null;
  let errorParams = {};
  let statusKey = null;
  const rows = new Map();
  const events = new AbortController();

  function clearError() {
    errorKey = null;
    errorParams = {};
    for (const input of Object.values(fields)) input.removeAttribute("aria-invalid");
  }

  function resetForm() {
    editing = null;
    revision += 1;
    for (const input of Object.values(fields)) input.value = "";
    clearError();
  }

  function createRow(entry) {
    const item = node("li", "settings-row watch-later-item");
    const details = node("div", "settings-text");
    const link = node("a", "log-label watch-later-link", `watch-later-link-${++rowSequence}`);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const meta = node("p", "settings-description");
    const note = node("p", "log-channel watch-later-note-preview");
    details.append(link, meta, note);
    const actions = node("div", "link-row");
    const edit = node("button", "button button-quiet");
    edit.type = "button";
    edit.dataset.action = "edit";
    const remove = node("button", "button button-link-danger");
    remove.type = "button";
    remove.dataset.action = "remove";
    remove.setAttribute("aria-describedby", link.id);
    actions.append(edit, remove);
    item.append(details, actions);
    const labels = { arm: "", confirm: "" };
    const row = { item, link, meta, note, edit, remove, labels, entry };
    edit.addEventListener("click", () => {
      editing = row.entry;
      revision += 1;
      for (const [name, input] of Object.entries(fields)) input.value = editing[name];
      clearError();
      statusKey = null;
      render();
      fields.note.focus();
    });
    row.unbind = bindInlineConfirm(remove, labels, () => {
      const url = row.entry.url;
      const restoreFocus = item.contains(document.activeElement);
      const before = revision;
      void run(() => updateWatchLater((current) => ({ entries: current.filter((entry) => entry.url !== url) })), "popup.watchLater.removed", () => {
        if (revision === before && editing?.url === url) resetForm();
        if (restoreFocus && !form.contains(document.activeElement)) fields.url.focus();
      });
    });
    return row;
  }

  function render() {
    if (disposed) return;
    for (const [element, key] of labels) text(element, t(key));
    text(formHeading, t(editing ? "popup.watchLater.editTitle" : "popup.watchLater.addTitle"));
    text(saveButton, t(editing ? "popup.watchLater.saveChanges" : "popup.watchLater.save"));
    fields.url.readOnly = Boolean(editing);
    cancel.hidden = !editing;
    saveButton.disabled = cancel.disabled = saving;
    refreshButton.disabled = saving || reading;
    root.setAttribute("aria-busy", String(reading || saving));
    text(count, t("popup.watchLater.count", { count: entries?.length || 0, max: WATCH_LATER_LIMITS.entries }));
    count.hidden = !entries;
    error.hidden = !errorKey;
    text(error, errorKey ? t(errorKey, errorParams) : "");
    const message = reading && !entries ? "popup.watchLater.loading" : statusKey;
    status.hidden = !message;
    text(status, message ? t(message) : "");
    empty.hidden = !entries || entries.length > 0;
    const active = new Set((entries || []).map((entry) => entry.url));
    for (const [url, row] of rows) {
      if (!active.has(url)) {
        row.unbind();
        row.item.remove();
        rows.delete(url);
      }
    }
    for (const [index, entry] of (entries || []).entries()) {
      const row = rows.get(entry.url) || createRow(entry);
      rows.set(entry.url, row);
      row.entry = entry;
      row.item.dataset.id = entry.id;
      row.link.href = entry.url;
      row.link.title = entry.url;
      row.link.setAttribute("aria-label", t("popup.watchLater.openLabel", { title: entry.title }));
      text(row.link, entry.title);
      text(row.note, entry.note);
      row.note.title = entry.note;
      row.note.hidden = !entry.note;
      const platform = { twitch: "Twitch", kick: "Kick", youtube: "YouTube" }[entry.platform];
      const date = entry.createdAt ? new Intl.DateTimeFormat(resolveLocale(getCurrentLanguage()), { dateStyle: "short" }).format(entry.createdAt) : null;
      text(row.meta, date ? `${platform} - ${t("popup.watchLater.addedAt", { date })}` : platform);
      text(row.edit, t("popup.watchLater.edit"));
      row.edit.setAttribute("aria-label", t("popup.watchLater.editLabel", { title: entry.title }));
      row.labels.arm = t("popup.watchLater.remove");
      row.labels.confirm = t("popup.watchLater.confirmRemove");
      text(row.remove, row.remove.classList.contains("is-armed") ? row.labels.confirm : row.labels.arm);
      row.edit.disabled = row.remove.disabled = saving;
      // Keep existing nodes in place: refreshes must not replace focused controls.
      if (list.children[index] !== row.item) list.insertBefore(row.item, list.children[index] || null);
    }
  }

  async function refresh() {
    if (disposed) return;
    const current = ++request;
    reading = true;
    render();
    try {
      const stored = await chrome.storage.local.get(WATCH_LATER_KEY);
      if (disposed || current !== request) return;
      entries = normalizeWatchLater(stored[WATCH_LATER_KEY]);
      if (errorKey === "popup.watchLater.readError") clearError();
    } catch (_error) {
      if (disposed || current !== request) return;
      errorKey = "popup.watchLater.readError";
    } finally {
      if (!disposed && current === request) {
        reading = false;
        render();
      }
    }
  }

  async function run(operation, message, onSuccess) {
    if (saving || disposed) return;
    saving = true;
    clearError();
    statusKey = null;
    render();
    try {
      const result = await operation();
      if (disposed) return;
      onSuccess?.(result);
      statusKey = message;
      await refresh();
    } catch (failure) {
      const codes = {
        invalidUrl: "popup.watchLater.invalidUrl", invalidTitle: "popup.watchLater.invalidTitle",
        invalidNote: "popup.watchLater.invalidNote", full: "popup.watchLater.full", missing: "popup.watchLater.missing",
      };
      errorKey = codes[failure?.code] || "popup.watchLater.writeError";
      const field = { invalidUrl: "url", invalidTitle: "title", invalidNote: "note" }[failure?.code];
      errorParams = { max: WATCH_LATER_LIMITS[field || "entries"] };
      if (field) fields[field].setAttribute("aria-invalid", "true");
    } finally {
      // eslint-disable-next-line require-atomic-updates -- The synchronous guard admits one mutation.
      saving = false;
      render();
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const before = revision;
    const selected = editing;
    const input = { url: fields.url.value };
    for (const name of ["title", "note"]) {
      if (selected ? fields[name].value !== selected[name] : fields[name].value !== "") input[name] = fields[name].value;
    }
    void run(() => selected ? updateWatchLater((current) => {
      if (!current.some((entry) => entry.url === selected.url)) throw Object.assign(new Error("missing"), { code: "missing" });
      return mergeWatchLater(current, input);
    }) : saveWatchLater(input), "popup.watchLater.saved", (saved) => {
      if (revision === before) resetForm();
      // A newer draft stays in place, but its baseline is now the saved value.
      // Otherwise reverting a note mid-save would look unchanged on resubmit.
      else if (normalizeWatchLater([{ url: fields.url.value }])[0]?.url === saved.url) {
        editing = { ...saved };
        for (const name of ["title", "note"]) {
          if (selected && !Object.hasOwn(input, name)) editing[name] = selected[name];
        }
      }
    });
  }, { signal: events.signal });
  for (const input of Object.values(fields)) input.addEventListener("input", () => {
    revision += 1;
    statusKey = null;
    status.hidden = true;
    text(status, "");
  }, { signal: events.signal });
  cancel.addEventListener("click", () => { resetForm(); statusKey = null; render(); fields.url.focus(); }, { signal: events.signal });
  refreshButton.addEventListener("click", () => void refresh(), { signal: events.signal });

  const storageChanged = (changes, area) => {
    if (disposed || area !== "local" || !Object.hasOwn(changes, WATCH_LATER_KEY)) return;
    request += 1;
    reading = false;
    entries = normalizeWatchLater(changes[WATCH_LATER_KEY].newValue);
    if (errorKey === "popup.watchLater.readError") clearError();
    render();
  };
  const languageChanged = onLanguageChange(render);
  chrome.storage.onChanged.addListener(storageChanged);

  function destroy() {
    if (disposed) return;
    disposed = true;
    request += 1;
    events.abort();
    languageChanged();
    chrome.storage.onChanged.removeListener(storageChanged);
    for (const row of rows.values()) row.unbind();
    instances.delete(root);
    root.replaceChildren();
  }
  window.addEventListener("pagehide", destroy, { signal: events.signal });
  const controller = { refresh, destroy };
  instances.set(root, controller);
  await refresh();
  return controller;
}
