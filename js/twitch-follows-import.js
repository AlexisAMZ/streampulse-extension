// Section « Importer mes follows Twitch » de la page d'ajout par lot.
// Parcours : confirmation 1 (ce qui va se passer) → connexion Twitch →
// choix (rien de coché) → confirmation 2 (le nombre exact) → ajout.

import { t } from "./i18n.js";
import { formatHandleForDisplay } from "./platforms.js";
import {
  buildAuthorizeUrl, fetchAllFollows, followsToRows, parseAuthRedirect,
} from "./twitch-follows.js";

export const IMPORT_MAX = 100;

const STREAMERS_KEY = "betaGeneralStreamers";
const REMOTE_CONFIG_KEY = "streampulse:remoteConfig";
const ERROR_KEYS = {
  config: "bulk.import.err.config",
  permission: "bulk.import.err.permission",
  denied: "bulk.import.err.denied",
  state: "bulk.import.err.state",
  unauthorized: "bulk.import.err.unauthorized",
  rateLimited: "bulk.import.err.rateLimited",
};
const GENERIC_ERROR_KEY = "bulk.import.err.generic";
const STEPS = ["start", "confirm1", "loading", "pick", "confirm2", "adding", "done"];

const byId = (id) => document.getElementById(id);

function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function readClientId() {
  const stored = await chrome.storage.local.get(REMOTE_CONFIG_KEY);
  return stored[REMOTE_CONFIG_KEY]?.data?.clientId || "";
}

/** Ouvre la fenêtre Twitch et rend le jeton (jamais stocké). Lève une erreur typée. */
async function authorize() {
  const clientId = await readClientId();
  if (!clientId) throw Object.assign(new Error("config"), { code: "config" });
  const granted = await chrome.permissions.request({ permissions: ["identity"] });
  if (!granted) throw Object.assign(new Error("permission"), { code: "permission" });
  const state = randomState();
  const redirectUri = chrome.identity.getRedirectURL();
  let redirect;
  try {
    redirect = await chrome.identity.launchWebAuthFlow({
      url: buildAuthorizeUrl({ clientId, redirectUri, state }),
      interactive: true,
    });
  } catch {
    throw Object.assign(new Error("denied"), { code: "denied" });
  }
  const result = parseAuthRedirect(redirect, state);
  if (!result.ok) throw Object.assign(new Error(result.reason), { code: result.reason });
  return { token: result.token, clientId };
}

/** Branche la section ; `executeBulkAdd` est injecté pour éviter un import circulaire. */
export function initFollowsImport({ executeBulkAdd, getGroupId = () => "" }) {
  const root = byId("import-follows");
  if (!root) return;
  const status = byId("import-status");
  const error = byId("import-error");
  const list = byId("import-list");
  const filter = byId("import-filter");
  const selectAll = byId("import-select-all");
  const reviewButton = byId("import-review");
  const addButton = byId("import-add");
  let rows = [];
  let busy = false;

  const selectedRows = () => rows.filter((row) => row.selected && row.status === "ready");

  function show(step) {
    for (const name of STEPS) byId(`import-step-${name}`).hidden = name !== step;
  }

  function showError(key, params = {}) {
    error.textContent = t(key, params);
    error.hidden = false;
  }

  function renderList() {
    const needle = filter.value.trim().toLowerCase();
    list.replaceChildren();
    for (const row of rows) {
      if (needle && !row.handle.includes(needle)) continue;
      const item = document.createElement("li");
      item.className = "bulk-row";
      item.dataset.status = row.status;
      const label = document.createElement("label");
      label.className = "bulk-row-label";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = row.selected;
      box.disabled = busy || row.status !== "ready";
      box.addEventListener("change", () => {
        if (!box.checked) row.selected = false;
        else if (selectedRows().length >= IMPORT_MAX) {
          box.checked = false;
          showError("bulk.import.tooMany", { max: IMPORT_MAX });
          return;
        } else row.selected = true;
        error.hidden = true;
        renderControls();
      });
      const name = document.createElement("strong");
      name.textContent = formatHandleForDisplay("twitch", row.handle);
      const details = document.createElement("span");
      details.className = "bulk-row-details";
      details.append(name);
      label.append(box, details);
      const result = document.createElement("span");
      result.className = "bulk-row-result";
      result.textContent = row.status === "existing" ? t("bulk.existing") : row.status === "success" ? t("bulk.success") : row.status === "error" ? t("bulk.error") : "";
      item.append(label, result);
      list.append(item);
    }
  }

  function renderControls() {
    const ready = rows.filter((row) => row.status === "ready");
    const selected = selectedRows().length;
    byId("import-count").textContent = t("bulk.import.count", { selected, max: IMPORT_MAX, total: ready.length });
    reviewButton.disabled = busy || !selected;
    selectAll.disabled = busy || !ready.length;
    selectAll.checked = selected > 0 && selected === Math.min(ready.length, IMPORT_MAX);
    selectAll.indeterminate = selected > 0 && !selectAll.checked;
    addButton.textContent = t("bulk.import.confirmAdd", { count: selected });
    byId("import-confirm2-text").textContent = t("bulk.import.confirm2", { count: selected });
  }

  async function start() {
    if (busy) return;
    busy = true;
    error.hidden = true;
    show("loading");
    status.textContent = t("bulk.import.connecting");
    try {
      const { token, clientId } = await authorize();
      status.textContent = t("bulk.import.reading");
      const logins = await fetchAllFollows({ token, clientId });
      const stored = await chrome.storage.local.get([STREAMERS_KEY]);
      rows = followsToRows(logins, stored[STREAMERS_KEY]);
      filter.value = "";
      show("pick");
      status.textContent = t("bulk.import.found", { count: rows.length });
      if (!rows.length) showError("bulk.import.empty");
    } catch (failure) {
      showError(Object.hasOwn(ERROR_KEYS, failure?.code) ? ERROR_KEYS[failure.code] : GENERIC_ERROR_KEY);
      show("start");
    } finally {
      busy = false;
      renderList();
      renderControls();
    }
  }

  async function addChosen() {
    if (busy) return;
    const chosen = selectedRows();
    if (!chosen.length) return;
    busy = true;
    error.hidden = true;
    show("adding");
    let done = 0;
    try {
      await executeBulkAdd(chosen, {
        max: IMPORT_MAX,
        groupId: getGroupId(),
        onUpdate(row) {
          if (row.status !== "adding") done += 1;
          status.textContent = t("bulk.progress", { done, total: chosen.length });
        },
      });
      const failed = chosen.filter((row) => row.status === "error").length;
      status.textContent = t("bulk.finished", { added: chosen.filter((row) => row.added).length, failed });
      if (failed) showError("bulk.partial");
    } catch {
      showError("bulk.addFailed");
    } finally {
      busy = false;
      show("done");
      renderList();
      renderControls();
      status.focus();
    }
  }

  byId("import-open").addEventListener("click", () => { error.hidden = true; show("confirm1"); });
  byId("import-cancel-1").addEventListener("click", () => show("start"));
  byId("import-continue").addEventListener("click", start);
  byId("import-back").addEventListener("click", () => show("pick"));
  byId("import-leave").addEventListener("click", () => { rows = []; error.hidden = true; status.textContent = ""; show("start"); });
  reviewButton.addEventListener("click", () => { renderControls(); show("confirm2"); });
  byId("import-cancel-2").addEventListener("click", () => show("pick"));
  addButton.addEventListener("click", addChosen);
  byId("import-restart").addEventListener("click", () => { rows = []; status.textContent = ""; show("start"); });
  filter.addEventListener("input", renderList);
  selectAll.addEventListener("change", () => {
    const ready = rows.filter((row) => row.status === "ready");
    ready.forEach((row, index) => { row.selected = selectAll.checked && index < IMPORT_MAX; });
    if (selectAll.checked && ready.length > IMPORT_MAX) showError("bulk.import.tooMany", { max: IMPORT_MAX });
    renderList();
    renderControls();
  });
  show("start");
}
