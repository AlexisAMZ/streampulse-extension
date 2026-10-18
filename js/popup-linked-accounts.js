// Liste des comptes reliés, avec « Délier ». Les liens se créent depuis la carte
// d'un streamer (accueil ou « Toutes les chaînes ») ; ici on ne fait que les relire
// et les retirer. Aucun compte, statistique ou préférence n'est fusionné.
import { onLanguageChange, t } from "./i18n.js";
import { LINKED_ACCOUNTS_KEY, normalizeLinkedAccounts } from "./linked-accounts.js";

const ROSTER_KEY = "betaGeneralStreamers";
const PLATFORM_NAMES = { twitch: "Twitch", kick: "Kick", youtube: "YouTube" };
// Literal keys only: the i18n handoff test reads them from this file.
const TEXT = {
  title: "popup.linkedAccounts.title",
  description: "popup.linkedAccounts.description",
  accountLabel: "popup.linkedAccounts.accountLabel",
  preferredSummary: "popup.linkedAccounts.preferredSummary",
  empty: "popup.linkedAccounts.empty",
  loading: "popup.linkedAccounts.loading",
  conflict: "popup.linkedAccounts.conflict",
  readError: "popup.linkedAccounts.readError",
  writeError: "popup.linkedAccounts.writeError",
  retry: "popup.linkedAccounts.retry",
  unlink: "popup.linkedAccounts.unlink",
  unlinkConfirm: "popup.linkedAccounts.unlinkConfirm",
  unlinked: "popup.linkedAccounts.unlinked",
};

const instances = new WeakMap();

function el(tag, attributes = {}) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

const sameGroup = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function buildView(root) {
  const title = el("h3", { id: "linked-accounts-title" });
  const description = el("p", { class: "settings-description" });
  const error = el("p", { id: "linked-accounts-error", class: "settings-note", role: "alert" });
  const retry = el("button", { id: "linked-accounts-retry", type: "button", class: "button button-quiet" });
  const status = el("p", { id: "linked-accounts-status", class: "settings-note", role: "status" });
  const empty = el("p", { id: "linked-accounts-empty", class: "settings-note" });
  const list = el("ul", { id: "linked-accounts-list", class: "linked-accounts-list" });
  error.hidden = true;
  retry.hidden = true;
  empty.hidden = true;
  root.replaceChildren(title, description, error, retry, status, empty, list);
  return { title, description, error, retry, status, empty, list };
}

/** Call after initI18n. Returns { refresh, destroy } or null without a mount. */
export async function initLinkedAccounts({ getStreamers = () => [] } = {}) {
  const root = document.getElementById("linked-accounts");
  if (!root) return null;
  if (instances.has(root)) return instances.get(root);
  const view = buildView(root);
  const events = new AbortController();
  let groups = [];
  let loaded = false;
  let loading = false;
  let writing = false;
  let request = 0;
  let destroyed = false;
  let statusKey = null;
  let errorKey = null;
  let confirming = null;

  const roster = () => (Array.isArray(getStreamers()) ? getStreamers() : []);
  const accountText = (streamer) => t(TEXT.accountLabel, {
    platform: PLATFORM_NAMES[streamer.platform] || streamer.platform || "?",
    name: streamer.displayName || streamer.handle || streamer.id,
    account: streamer.handle || streamer.id,
  });

  function setMessages() {
    view.status.textContent = statusKey ? t(TEXT[statusKey]) : "";
    view.error.textContent = errorKey ? t(TEXT[errorKey]) : "";
    view.error.hidden = !errorKey;
    view.retry.hidden = errorKey !== "readError" || loaded;
  }

  function report({ status = null, error = null }) {
    statusKey = status;
    errorKey = error;
    setMessages();
  }

  function renderGroups() {
    const byId = new Map(roster().map((streamer) => [streamer.id, streamer]));
    view.empty.hidden = !loaded || groups.length > 0;
    view.list.replaceChildren(...groups.map((group) => {
      const row = el("li", { class: "settings-row" });
      const text = el("div", { class: "settings-text" });
      const title = el("span", { class: "settings-title" });
      title.textContent = group.name;
      const members = el("span", { class: "settings-description" });
      members.textContent = group.streamerIds.map((id) => (byId.has(id) ? accountText(byId.get(id)) : id)).join(" · ");
      const preferredAccount = byId.get(group.preferredId);
      const summary = el("span", { class: "settings-description" });
      summary.textContent = t(TEXT.preferredSummary, { account: preferredAccount ? accountText(preferredAccount) : group.preferredId });
      text.append(title, members, summary);
      const unlink = el("button", { type: "button", class: "button button-quiet" });
      unlink.dataset.groupId = group.id;
      unlink.textContent = t(confirming === group.id ? TEXT.unlinkConfirm : TEXT.unlink);
      unlink.addEventListener("click", () => onUnlink(group, unlink));
      row.append(text, unlink);
      return row;
    }));
  }

  function render() {
    view.title.textContent = t(TEXT.title);
    view.description.textContent = t(TEXT.description);
    view.retry.textContent = t(TEXT.retry);
    view.empty.textContent = t(TEXT.empty);
    if (loading && !loaded) view.status.textContent = t(TEXT.loading);
    renderGroups();
    setMessages();
    root.setAttribute("aria-busy", String(loading || writing));
  }

  function refresh() {
    const mine = ++request;
    loading = true;
    root.setAttribute("aria-busy", "true");
    let pending;
    try {
      pending = Promise.resolve(chrome.storage.local.get([LINKED_ACCOUNTS_KEY]));
    } catch (error) {
      pending = Promise.reject(error);
    }
    return pending.then((stored) => {
      if (destroyed || mine !== request) return;
      groups = normalizeLinkedAccounts(stored?.[LINKED_ACCOUNTS_KEY], roster());
      loaded = true;
      confirming = null;
      if (errorKey === "readError") errorKey = null;
      loading = false;
      render();
    }, (error) => {
      if (destroyed || mine !== request) return;
      console.warn("[linked-accounts] read failed:", error);
      loading = false;
      report({ error: "readError" });
      root.setAttribute("aria-busy", String(writing));
    });
  }

  async function onUnlink(group, button) {
    if (writing) return;
    if (confirming !== group.id) {
      confirming = group.id;
      button.textContent = t(TEXT.unlinkConfirm);
      return;
    }
    writing = true;
    request += 1;
    loading = false;
    report({});
    root.setAttribute("aria-busy", "true");
    try {
      // Groupes et liste relus ensemble juste avant d'écrire : un lien changé ailleurs n'est jamais écrasé.
      const stored = await chrome.storage.local.get([LINKED_ACCOUNTS_KEY, ROSTER_KEY]);
      const freshRoster = Array.isArray(stored?.[ROSTER_KEY]) ? stored[ROSTER_KEY] : roster();
      const freshGroups = normalizeLinkedAccounts(stored?.[LINKED_ACCOUNTS_KEY], freshRoster);
      const current = freshGroups.find((entry) => entry.id === group.id);
      if (!current || !sameGroup(current, group)) throw Object.assign(new Error("conflict"), { code: "conflict" });
      const next = freshGroups.filter((entry) => entry.id !== group.id);
      await chrome.storage.local.set({ [LINKED_ACCOUNTS_KEY]: next });
      if (destroyed) return;
      groups = next;
      confirming = null;
      writing = false;
      render();
      report({ status: "unlinked" });
    } catch (error) {
      if (destroyed) return;
      if (!error.code) console.warn("[linked-accounts] unlink failed:", error);
      confirming = null;
      writing = false;
      report({ error: error.code || "writeError" });
      root.setAttribute("aria-busy", "false");
    }
  }

  view.retry.addEventListener("click", () => refresh(), { signal: events.signal });

  const storageChanged = (changes, area) => {
    if (area !== "local" || writing) return;
    if (changes[LINKED_ACCOUNTS_KEY] || changes[ROSTER_KEY]) refresh();
  };
  chrome.storage.onChanged.addListener(storageChanged);
  const stopLanguage = onLanguageChange(render);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    request += 1;
    events.abort();
    stopLanguage?.();
    chrome.storage.onChanged.removeListener(storageChanged);
    root.replaceChildren();
    root.removeAttribute("aria-busy");
    instances.delete(root);
  }

  const controller = { refresh, destroy };
  instances.set(root, controller);
  window.addEventListener("pagehide", destroy, { signal: events.signal });
  loading = true;
  render();
  await refresh();
  return controller;
}
