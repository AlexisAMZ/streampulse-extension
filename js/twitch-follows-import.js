// Module « Importer mes follows Twitch », monté dans la page d'ajout par lot et
// dans l'onboarding. Il crée lui-même tous ses éléments.
// Parcours : confirmation 1 → connexion Twitch → choix (rien de coché) →
// confirmation 2 avec le nombre → ajout. Un bouton retire d'un coup ce qui a été
// importé, sans toucher aux chaînes que l'utilisateur avait déjà.
//
// Jeton : variable locale de `start()`, lu une fois puis annulé chez Twitch.
// Jamais stocké, jamais journalisé, jamais envoyé ailleurs qu'à Twitch.

import { t } from "./i18n.js";
import { IMPORTED_FOLLOWS_KEY, addImportedEntry, stillImported } from "./imported-follows.js";
import { formatHandleForDisplay } from "./platforms.js";
import { buildAuthorizeUrl, followsToRows, parseAuthRedirect, readFollowsThenRevoke } from "./twitch-follows.js";

export const IMPORT_MAX = 100;
const STRIP_MAX = 16;

const STREAMERS_KEY = "betaGeneralStreamers";
const ERROR_KEYS = {
  config: "bulk.import.err.config",
  permission: "bulk.import.err.permission",
  denied: "bulk.import.err.denied",
  state: "bulk.import.err.state",
  invalid: "bulk.import.err.state",
  unauthorized: "bulk.import.err.unauthorized",
  rateLimited: "bulk.import.err.rateLimited",
};
const GENERIC_ERROR_KEY = "bulk.import.err.generic";

const typedError = (code) => Object.assign(new Error(code), { code });
const isSelectable = (row) => row.status === "ready" || row.status === "error";

function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const REDIRECT_ORIGIN = "https://*.chromiumapp.org/*";
const AUTH_WINDOW = { width: 560, height: 820 };

/**
 * Fenêtre de connexion Twitch à nous : celle de launchWebAuthFlow est minuscule
 * sous Chrome et cache le bouton Autoriser. Rend l'adresse de retour (avec le
 * jeton dans le fragment) dès que Twitch y redirige, puis referme la fenêtre.
 */
async function openAuthWindow(url, redirectUri) {
  const win = await chrome.windows.create({ url, type: "popup", focused: true, ...AUTH_WINDOW });
  const tabId = win.tabs?.[0]?.id;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (settle, value) => {
      if (settled) return;
      settled = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.windows.onRemoved.removeListener(onRemoved);
      settle(value);
    };
    const onUpdated = (id, info, tab) => {
      const current = info.url || tab?.url;
      if (id !== tabId || !current?.startsWith(redirectUri)) return;
      finish(resolve, current);
      chrome.windows.remove(win.id).catch(() => {});
    };
    const onRemoved = (id) => {
      if (id === win.id) finish(reject, typedError("denied"));
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.windows.onRemoved.addListener(onRemoved);
  });
}

/**
 * Ouvre la fenêtre Twitch et rend le jeton. La demande de permission vient en
 * premier : Chrome l'exige pendant le clic, avant toute attente.
 */
async function authorize() {
  const granted = await chrome.permissions.request({ permissions: ["identity"], origins: [REDIRECT_ORIGIN] });
  if (!granted) throw typedError("permission");
  const config = await chrome.runtime.sendMessage({ type: "getConfig" });
  const clientId = config?.clientId;
  if (!clientId) throw typedError("config");
  const state = randomState();
  let redirect;
  try {
    const redirectUri = chrome.identity.getRedirectURL();
    redirect = await openAuthWindow(buildAuthorizeUrl({ clientId, redirectUri, state }), redirectUri);
  } catch {
    throw typedError("denied");
  }
  const result = parseAuthRedirect(redirect, state);
  if (!result.ok) throw typedError(result.reason);
  return { token: result.token, clientId };
}

/** La permission ne sert qu'à ce moment-là : on la rend aussitôt. */
function releaseIdentityPermission() {
  chrome.permissions.remove({ permissions: ["identity"], origins: [REDIRECT_ORIGIN] }).catch(() => {});
}

function el(tag, className, ...children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

/** Texte fixe : `data-i18n` le garde à jour si la langue change (onboarding). */
function label(tag, className, key) {
  const node = el(tag, className);
  node.dataset.i18n = key;
  node.textContent = t(key);
  return node;
}

const CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

/** Rond du streamer : les initiales restent dessous si la photo manque ou ne charge pas. */
function avatarNode(row) {
  const node = el("span", "fi-avatar");
  node.textContent = Array.from(row.displayName || row.handle).slice(0, 2).join("").toUpperCase();
  if (row.avatar) {
    const image = el("img");
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => image.remove());
    image.src = row.avatar;
    node.append(image);
  }
  return node;
}

function button(kind, key, onClick) {
  const node = key ? label("button", `btn ${kind}`, key) : el("button", `btn ${kind}`);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

/**
 * @param {HTMLElement} root
 * @param {{executeBulkAdd: Function, getGroupId?: () => string, onChange?: () => unknown, embedded?: boolean, onExit?: () => void, onStep?: (step: string) => void}} options
 *   `embedded` : le module vit derrière une porte de l'onboarding ; `onExit` y ramène.
 * @returns {{open: () => Promise<void>} | undefined}
 */
export function mountFollowsImport(root, { executeBulkAdd, getGroupId = () => "", onChange = () => {}, embedded = false, onExit = () => {}, onStep = () => {} }) {
  if (!root) return undefined;
  let rows = [];
  let busy = false;
  let importedCount = 0;

  const status = el("p", "fi-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.tabIndex = -1;
  const error = el("p", "fi-error");
  error.setAttribute("role", "alert");
  error.hidden = true;

  const filter = el("input", "fi-filter");
  filter.type = "search";
  filter.id = "fi-filter";
  filter.autocomplete = "off";
  filter.spellcheck = false;
  filter.dataset.i18nAttrPlaceholder = "bulk.import.filter";
  filter.placeholder = t("bulk.import.filter");
  const filterLabel = label("label", "fi-sr", "bulk.import.filter");
  filterLabel.htmlFor = filter.id;
  const selectAll = el("input");
  selectAll.type = "checkbox";
  const list = el("ul", "fi-list");
  const noMatch = label("p", "fi-hint", "bulk.import.noMatch");
  noMatch.hidden = true;
  const strip = el("div", "fi-strip");
  const count = el("p", "fi-count");
  const confirmText = el("p", "fi-text");
  const undoText = el("p", "fi-text");

  const selectedRows = () => rows.filter((row) => row.selected && isSelectable(row));

  const steps = {
    start: null, confirm1: null, loading: null, pick: null, confirm2: null, adding: null, done: null, confirmUndo: null,
  };

  function show(step, { focus = true } = {}) {
    for (const [name, node] of Object.entries(steps)) node.hidden = name !== step;
    onStep(step);
    if (focus) steps[step].querySelector("button")?.focus();
  }

  function showError(key, params = {}) {
    error.textContent = t(key, params);
    error.hidden = false;
  }

  function clearMessages() {
    error.hidden = true;
    status.textContent = "";
  }

  /** Annuler dans l'onboarding ramène aux portes, sauf s'il reste un import à retirer. */
  function leave() {
    if (embedded && !importedCount) onExit();
    else show("start");
  }

  const exitButtons = () => (embedded ? [button("btn-ghost", "bulk.import.otherWay", onExit)] : []);

  const reviewButton = button("btn-primary", "bulk.import.review", () => {
    renderControls();
    strip.replaceChildren(...selectedRows().slice(0, STRIP_MAX).map(avatarNode));
    show("confirm2");
  });
  const addButton = button("btn-primary", "", addChosen);
  const undoButton = button("btn-ghost", "", askUndo);
  const undoDoneButton = button("btn-ghost", "", askUndo);
  const undoYesButton = button("btn-primary", "", removeImported);

  steps.start = el("div", "fi-step",
    label("p", "fi-hint", "bulk.import.intro"),
    el("div", "fi-actions",
      button(embedded ? "btn-primary" : "btn-ghost", "bulk.import.open", () => { clearMessages(); show("confirm1"); }),
      undoButton,
      ...exitButtons()));
  steps.confirm1 = el("div", "fi-step",
    label("p", "fi-text", "bulk.import.confirm1"),
    label("p", "fi-hint", "bulk.import.revokeNote"),
    el("div", "fi-actions",
      button("btn-ghost", "bulk.import.cancel", leave),
      button("btn-primary", "bulk.import.continue", start)));
  steps.loading = el("div", "fi-step", label("p", "fi-hint", "bulk.import.keepOpen"));
  steps.pick = el("div", "fi-step",
    label("p", "fi-hint", "bulk.import.pickHint"),
    el("div", "fi-tools",
      el("div", "fi-search", filterLabel, filter),
      el("label", "fi-all", selectAll, label("span", "", "bulk.import.selectAll")),
      count),
    list,
    noMatch,
    el("div", "fi-actions",
      button("btn-ghost", "bulk.import.cancel", () => { rows = []; clearMessages(); leave(); }),
      reviewButton));
  steps.confirm2 = el("div", "fi-step",
    strip,
    confirmText,
    el("div", "fi-actions",
      button("btn-ghost", "bulk.import.back", () => show("pick")),
      addButton));
  steps.adding = el("div", "fi-step", label("p", "fi-hint", "bulk.import.keepOpen"));
  steps.done = el("div", "fi-step",
    el("div", "fi-actions",
      button("btn-ghost", "bulk.import.again", () => {
        clearMessages();
        renderList();
        renderControls();
        show(rows.some(isSelectable) ? "pick" : "start");
      }),
      undoDoneButton,
      ...exitButtons()));
  steps.confirmUndo = el("div", "fi-step",
    undoText,
    el("div", "fi-actions",
      button("btn-ghost", "bulk.import.cancel", () => show("start")),
      undoYesButton));

  root.replaceChildren(el("section", "fi",
    label("h2", "fi-title", "bulk.import.title"),
    ...Object.values(steps),
    status,
    error));

  function renderList() {
    const needle = filter.value.trim().toLowerCase();
    list.replaceChildren();
    for (const row of rows) {
      if (needle && !row.handle.includes(needle)) continue;
      const box = el("input");
      box.type = "checkbox";
      box.checked = row.selected;
      box.disabled = busy || !isSelectable(row);
      box.addEventListener("change", () => toggleRow(row, box));
      const tick = el("span", "fi-tick");
      tick.innerHTML = CHECK_ICON;
      const avatar = avatarNode(row);
      avatar.append(tick);
      const displayed = row.displayName || formatHandleForDisplay("twitch", row.handle);
      const name = el("strong", "fi-name");
      name.textContent = displayed;
      name.title = displayed;
      const result = el("span", "fi-result");
      if (row.status === "existing") result.textContent = t("bulk.existing");
      else if (row.status === "success") result.textContent = t("bulk.success");
      else if (row.status === "error") result.textContent = t("bulk.error");
      const item = el("li", "fi-row", el("label", "", box, avatar, name), result);
      item.dataset.status = row.status;
      list.append(item);
    }
    noMatch.hidden = list.childElementCount > 0 || rows.length === 0;
  }

  function toggleRow(row, box) {
    if (box.checked && selectedRows().length >= IMPORT_MAX) {
      box.checked = false;
      showError("bulk.import.tooMany", { max: IMPORT_MAX });
      return;
    }
    row.selected = box.checked;
    error.hidden = true;
    renderControls();
  }

  function renderControls() {
    const candidates = rows.filter(isSelectable);
    const selected = selectedRows().length;
    count.textContent = t("bulk.import.count", { selected, max: IMPORT_MAX, total: candidates.length });
    reviewButton.disabled = busy || !selected;
    selectAll.disabled = busy || !candidates.length;
    selectAll.checked = selected > 0 && selected === Math.min(candidates.length, IMPORT_MAX);
    selectAll.indeterminate = selected > 0 && !selectAll.checked;
    addButton.textContent = t("bulk.import.confirmAdd", { count: selected });
    confirmText.textContent = t("bulk.import.confirm2", { count: selected });
  }

  function renderUndo() {
    const text = t("bulk.import.undo", { count: importedCount });
    for (const node of [undoButton, undoDoneButton]) {
      node.textContent = text;
      node.hidden = importedCount === 0;
    }
    undoText.textContent = t("bulk.import.undoConfirm", { count: importedCount });
    undoYesButton.textContent = t("bulk.import.undoYes", { count: importedCount });
  }

  async function refreshImportedCount() {
    const stored = await chrome.storage.local.get([IMPORTED_FOLLOWS_KEY, STREAMERS_KEY]);
    importedCount = stillImported(stored[IMPORTED_FOLLOWS_KEY], stored[STREAMERS_KEY]).length;
    renderUndo();
  }

  async function start() {
    if (busy) return;
    busy = true;
    clearMessages();
    show("loading", { focus: false });
    status.textContent = t("bulk.import.connecting");
    try {
      // `token` ne vit que dans ce bloc. Pas de log ici : ni jeton, ni adresse de retour.
      const { token, clientId } = await authorize();
      status.textContent = t("bulk.import.reading");
      const { logins, profiles } = await readFollowsThenRevoke({ token, clientId });
      const stored = await chrome.storage.local.get([STREAMERS_KEY]);
      rows = followsToRows(logins, stored[STREAMERS_KEY], profiles);
      filter.value = "";
      status.textContent = t("bulk.import.found", { count: rows.length });
      if (!rows.length) showError("bulk.import.empty");
      show("pick");
    } catch (failure) {
      status.textContent = "";
      showError(Object.hasOwn(ERROR_KEYS, failure?.code) ? ERROR_KEYS[failure.code] : GENERIC_ERROR_KEY);
      show("start");
    } finally {
      releaseIdentityPermission();
      busy = false;
      renderList();
      renderControls();
    }
  }

  /** Inscrit la chaîne au registre dès son ajout : un onglet fermé en cours reste annulable. */
  async function recordImported(row, streamer) {
    try {
      const stored = await chrome.storage.local.get([IMPORTED_FOLLOWS_KEY]);
      await chrome.storage.local.set({ [IMPORTED_FOLLOWS_KEY]: addImportedEntry(stored[IMPORTED_FOLLOWS_KEY], streamer) });
    } catch (failure) {
      console.warn("[follows-import] registre non écrit :", failure?.message);
    }
  }

  async function addChosen() {
    if (busy) return;
    const chosen = selectedRows();
    if (!chosen.length) return;
    busy = true;
    error.hidden = true;
    show("adding", { focus: false });
    let done = 0;
    try {
      await executeBulkAdd(chosen, {
        max: IMPORT_MAX,
        groupId: getGroupId(),
        onAdded: recordImported,
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
      await refreshImportedCount().catch(() => {});
      show("done", { focus: false });
      renderList();
      renderControls();
      status.focus();
      await onChange();
    }
  }

  async function askUndo() {
    if (busy) return;
    clearMessages();
    await refreshImportedCount();
    if (importedCount) show("confirmUndo");
    else show("start");
  }

  async function removeImported() {
    if (busy) return;
    busy = true;
    clearMessages();
    try {
      const response = await chrome.runtime.sendMessage({ type: "removeImportedFollows" });
      if (response?.success !== true) throw new Error("undo");
      status.textContent = t("bulk.import.undone", { count: response.removed });
      rows = [];
    } catch {
      showError("bulk.import.err.undo");
    } finally {
      busy = false;
      await refreshImportedCount().catch(() => {});
      show("start", { focus: false });
      status.focus();
      await onChange();
    }
  }

  filter.addEventListener("input", renderList);
  selectAll.addEventListener("change", () => {
    const candidates = rows.filter(isSelectable);
    candidates.forEach((row, index) => { row.selected = selectAll.checked && index < IMPORT_MAX; });
    if (selectAll.checked && candidates.length > IMPORT_MAX) showError("bulk.import.tooMany", { max: IMPORT_MAX });
    else error.hidden = true;
    renderList();
    renderControls();
  });

  renderControls();
  renderUndo();
  show("start", { focus: false });
  refreshImportedCount().catch((failure) => console.warn("[follows-import] lecture impossible :", failure?.message));

  /** Entrée par la porte de l'onboarding : directement à Twitch, sauf s'il y a un import à retirer. */
  async function open() {
    clearMessages();
    await refreshImportedCount().catch(() => {});
    show(importedCount ? "start" : "confirm1");
  }

  return { open };
}
