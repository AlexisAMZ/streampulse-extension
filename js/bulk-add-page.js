import { initI18n, applyTranslations, t, getCurrentLanguage } from "./i18n.js";
import { formatHandleForDisplay, getPlatformLabelKey } from "./platforms.js";
import { MAX_BULK_SIZE, getBulkKey, parseBulkAdd } from "./bulk-add.js";
import { mountFollowsImport } from "./twitch-follows-import.js";

const STREAMERS_KEY = "betaGeneralStreamers";
const GROUPS_KEY = "betaChannelGroups";
const PREFERENCES_KEY = "betaGeneralPreferences";

const canRetry = (row) => row.status === "ready" || row.status === "error";

/** Mutates the preview rows; injectable Chrome boundaries keep execution testable offline. */
export async function executeBulkAdd(rows, {
  sendMessage = (message) => chrome.runtime.sendMessage(message),
  storage = chrome.storage.local,
  groupId = "",
  max = MAX_BULK_SIZE,
  onUpdate = () => {},
  onAdded = async () => {},
} = {}) {
  if (rows.length > max) throw new Error("bulk.tooMany");
  for (const row of rows) {
    if (!row.selected || !canRetry(row)) continue;
    Object.assign(row, { status: "adding", error: "", errorKey: "" });
    onUpdate(row);
    let errorKey = "bulk.readFailed";
    try {
      const key = getBulkKey(row);
      if (!row.added) {
        const current = await storage.get([STREAMERS_KEY]);
        const streamers = current[STREAMERS_KEY] ?? [];
        if (!Array.isArray(streamers)) throw new Error(errorKey);
        if (streamers.some((streamer) => getBulkKey(streamer) === key)) {
          Object.assign(row, { status: "existing", selected: false });
          continue;
        }
        errorKey = "bulk.addFailed";
        const response = await sendMessage({ type: "addStreamer", platform: row.platform, handle: row.handle });
        if (response?.success !== true) {
          row.error = typeof response?.error === "string" ? response.error : "";
          throw new Error(errorKey);
        }
        // Acknowledged adds are never sent again, even when verification or grouping fails.
        const matches = Array.isArray(response.streamers) ? response.streamers.filter((streamer) => getBulkKey(streamer) === key) : [];
        Object.assign(row, { added: true, streamerId: matches.length === 1 && typeof matches[0].id === "string" ? matches[0].id : "" });
        if (row.streamerId) await onAdded(row, matches[0]);
      }
      errorKey = "bulk.verifyFailed";
      const current = await storage.get([STREAMERS_KEY, GROUPS_KEY]);
      if (!row.streamerId || !Array.isArray(current[STREAMERS_KEY]) || !current[STREAMERS_KEY].some((streamer) => streamer?.id === row.streamerId && getBulkKey(streamer) === key)) {
        throw new Error(errorKey);
      }
      if (groupId) {
        errorKey = "bulk.groupFailed";
        const groups = current[GROUPS_KEY] ?? [];
        if (!Array.isArray(groups)) throw new Error(errorKey);
        const index = groups.findIndex((group) => group?.id === groupId);
        if (index === -1) {
          errorKey = "bulk.groupMissing";
          throw new Error(errorKey);
        }
        if (!Array.isArray(groups[index].memberIds)) throw new Error(errorKey);
        if (!groups[index].memberIds.includes(row.streamerId)) {
          await storage.set({
            [GROUPS_KEY]: groups.map((group, i) => i === index ? { ...group, memberIds: [...group.memberIds, row.streamerId] } : group),
          });
        }
      }
      Object.assign(row, { status: "success", selected: false });
    } catch {
      Object.assign(row, { status: "error", errorKey });
    } finally {
      onUpdate(row);
    }
  }
  return rows;
}

async function initBulkAddPage() {
  const form = document.getElementById("bulk-form");
  const controls = document.getElementById("bulk-controls");
  const input = document.getElementById("bulk-input");
  const platform = document.getElementById("bulk-platform");
  const group = document.getElementById("bulk-group");
  const previewButton = document.getElementById("bulk-preview");
  const addButton = document.getElementById("bulk-add");
  const selectAll = document.getElementById("bulk-select-all");
  const list = document.getElementById("bulk-list");
  const empty = document.getElementById("bulk-empty");
  const summary = document.getElementById("bulk-summary");
  const status = document.getElementById("bulk-status");
  const error = document.getElementById("bulk-error");
  let rows = [];
  let busy = true;
  let currentPreview = false;
  let overLimit = false;

  function showError(key, params = {}) {
    error.textContent = t(key, params);
    error.hidden = false;
    error.focus();
  }

  function updateControls() {
    controls.disabled = busy;
    form.setAttribute("aria-busy", String(busy));
    previewButton.disabled = busy || !input.value.trim();
    const candidates = currentPreview && !overLimit ? rows.filter(canRetry) : [];
    const selected = candidates.filter((row) => row.selected);
    addButton.disabled = busy || !selected.length;
    addButton.textContent = t(selected.length && selected.every((row) => row.status === "error") ? "bulk.retrySelected" : "bulk.addSelected", { count: selected.length });
    selectAll.disabled = busy || !candidates.length;
    selectAll.checked = Boolean(candidates.length) && selected.length === candidates.length;
    selectAll.indeterminate = selected.length > 0 && selected.length < candidates.length;
    list.hidden = !currentPreview || !rows.length;
    empty.hidden = currentPreview && rows.length > 0;
    empty.textContent = t(rows.length ? "bulk.stale" : "bulk.emptyPreview");
    summary.textContent = currentPreview ? t("bulk.summary", {
      candidates: rows.filter((row) => canRetry(row) && !row.added).length,
      duplicates: rows.filter((row) => row.status === "duplicate" || row.status === "existing").length,
      invalid: rows.filter((row) => row.status === "invalid").length,
    }) : "";
  }

  function renderRows() {
    list.replaceChildren();
    rows.forEach((row, index) => {
      const item = document.createElement("li");
      item.className = "bulk-row";
      item.dataset.status = row.status;
      const label = document.createElement("label");
      label.className = "bulk-row-label";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = row.selected;
      checkbox.disabled = busy || overLimit || !canRetry(row);
      const details = document.createElement("span");
      details.className = "bulk-row-details";
      const name = document.createElement("strong");
      name.textContent = row.handle ? formatHandleForDisplay(row.platform, row.handle) : row.raw;
      details.append(name);
      if (row.platform) {
        const platformName = document.createElement("span");
        platformName.className = "bulk-row-platform";
        platformName.textContent = t(getPlatformLabelKey(row.platform));
        details.append(platformName);
      }
      if (row.handle && row.raw !== name.textContent && row.raw !== row.handle) {
        const source = document.createElement("span");
        source.className = "bulk-row-source";
        source.textContent = row.raw;
        details.append(source);
      }
      const result = document.createElement("span");
      result.className = "bulk-row-result";
      result.id = `bulk-result-${index}`;
      result.textContent = row.status === "error" ? row.error || t(row.errorKey) : t(`bulk.${row.status}`);
      checkbox.setAttribute("aria-describedby", result.id);
      checkbox.addEventListener("change", () => {
        if (busy || !currentPreview || overLimit || !canRetry(row)) return;
        row.selected = checkbox.checked;
        updateControls();
      });
      label.append(checkbox, details);
      item.append(label, result);
      list.append(item);
    });
    updateControls();
  }

  function readOptions(stored) {
    document.documentElement.dataset.theme = stored[PREFERENCES_KEY]?.theme === "light" ? "light" : "dark";
    const selected = group.value;
    group.replaceChildren(new Option(t("bulk.noGroup"), ""));
    for (const entry of Array.isArray(stored[GROUPS_KEY]) ? stored[GROUPS_KEY] : []) {
      if (typeof entry?.id === "string" && typeof entry.name === "string") group.add(new Option(entry.name, entry.id));
    }
    if (selected && !Array.from(group.options).some((option) => option.value === selected)) {
      const unavailable = new Option(t("bulk.missingGroupOption"), selected);
      unavailable.disabled = true;
      group.add(unavailable);
    }
    group.value = selected;
  }

  async function preview() {
    if (busy) return;
    busy = true;
    error.hidden = true;
    status.textContent = "";
    updateControls();
    try {
      const stored = await chrome.storage.local.get([STREAMERS_KEY, GROUPS_KEY, PREFERENCES_KEY]);
      if (stored[STREAMERS_KEY] != null && !Array.isArray(stored[STREAMERS_KEY])) throw new Error("bulk.readFailed");
      readOptions(stored);
      const parsed = parseBulkAdd(input.value, { defaultPlatform: platform.value, streamers: stored[STREAMERS_KEY] });
      const previous = new Map(rows.filter((row) => row.added).map((row) => [getBulkKey(row), row]));
      rows = parsed.rows.map((row) => {
        const prior = previous.get(getBulkKey(row));
        return prior && row.status !== "duplicate" ? { ...prior, raw: row.raw } : row;
      });
      overLimit = parsed.overLimit;
      currentPreview = true;
      if (overLimit) showError("bulk.tooMany", { count: parsed.total, max: MAX_BULK_SIZE });
    } catch {
      currentPreview = false;
      showError("bulk.readFailed");
    } finally {
      busy = false;
      renderRows();
    }
  }

  async function addSelected(event) {
    event.preventDefault();
    if (busy || !currentPreview || overLimit) return;
    const total = rows.filter((row) => row.selected && canRetry(row)).length;
    if (!total) return;
    busy = true;
    error.hidden = true;
    let done = 0;
    renderRows();
    try {
      await executeBulkAdd(rows, {
        groupId: group.value,
        onUpdate(row) {
          if (row.status !== "adding") done += 1;
          status.textContent = t("bulk.progress", { done, total });
          renderRows();
        },
      });
      const failed = rows.filter((row) => row.status === "error").length;
      status.textContent = t("bulk.finished", { added: rows.filter((row) => row.added).length, failed });
      if (failed) showError("bulk.partial");
      else status.focus();
    } catch {
      showError("bulk.addFailed");
    } finally {
      busy = false;
      renderRows();
    }
  }

  function invalidate() {
    if (busy) return;
    currentPreview = false;
    error.hidden = true;
    status.textContent = "";
    updateControls();
  }
  input.addEventListener("input", invalidate);
  platform.addEventListener("change", invalidate);
  previewButton.addEventListener("click", preview);
  form.addEventListener("submit", addSelected);
  selectAll.addEventListener("change", () => {
    if (busy || !currentPreview || overLimit) return;
    rows.filter(canRetry).forEach((row) => { row.selected = selectAll.checked; });
    renderRows();
  });

  try {
    await initI18n();
    applyTranslations(document);
    document.documentElement.lang = getCurrentLanguage();
    readOptions(await chrome.storage.local.get([GROUPS_KEY, PREFERENCES_KEY]));
    const importRoot = document.getElementById("follows-import-root");
    mountFollowsImport(importRoot, { executeBulkAdd, getGroupId: () => group.value });
    if (location.hash === "#import") importRoot.querySelector("button")?.focus();
  } catch {
    showError("bulk.readFailed");
  } finally {
    busy = false;
    updateControls();
  }
}

if (typeof document !== "undefined" && document.getElementById("bulk-form")) {
  initBulkAddPage();
}
