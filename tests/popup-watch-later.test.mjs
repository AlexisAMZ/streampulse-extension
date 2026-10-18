import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createFakeChrome } from "./helpers/fake-chrome.mjs";
import { extensionPage } from "./helpers/extension-page.mjs";
import { initWatchLater } from "../js/popup-watch-later.js";
import { WATCH_LATER_KEY } from "../js/watch-later.js";
import { initI18n, setLanguage } from "../js/i18n.js";
import en from "../i18n/lang/en.js";
import fr from "../i18n/lang/fr.js";

// Handoff for the parent: merge each dictionary into popup.watchLater.
// Tests install them in memory only; the existing locale files stay untouched.
export const watchLaterTranslations = {
  en: {
    title: "Watch later",
    hint: "Keep Twitch, Kick and YouTube links with a personal note. This list stays in this browser.",
    addTitle: "Save a link",
    editTitle: "Edit the title or note",
    urlLabel: "HTTPS link",
    titleLabel: "Title (optional)",
    noteLabel: "Note (optional)",
    save: "Save to Watch later",
    saveChanges: "Save changes",
    cancel: "Cancel editing",
    refresh: "Refresh",
    empty: "No saved links yet. Paste a link above or save a live stream or replay.",
    loading: "Loading your list...",
    count: "{{count}} / {{max}} links",
    edit: "Edit",
    editLabel: "Edit {{title}}",
    remove: "Remove",
    confirmRemove: "Confirm removal",
    openLabel: "Open {{title}} in a new tab",
    addedAt: "Saved on {{date}}",
    saved: "Link saved.",
    removed: "Link removed.",
    invalidUrl: "Use a Twitch, Kick or YouTube HTTPS link without a username or password.",
    invalidTitle: "Keep the title to {{max}} characters or fewer, then try again.",
    invalidNote: "Keep the note to {{max}} characters or fewer, then try again.",
    full: "Your list already has {{max}} links. Remove one before adding another.",
    missing: "This link was removed elsewhere. Cancel editing, then add it again if needed.",
    readError: "Your list could not be loaded. Refresh to try again.",
    writeError: "Your change could not be saved. Your draft is still here; try again.",
  },
  fr: {
    title: "\u00c0 voir",
    hint: "Garde des liens Twitch, Kick et YouTube avec une note personnelle. Cette liste reste dans ce navigateur.",
    addTitle: "Enregistrer un lien",
    editTitle: "Modifier le titre ou la note",
    urlLabel: "Lien HTTPS",
    titleLabel: "Titre (facultatif)",
    noteLabel: "Note (facultative)",
    save: "Enregistrer dans \u00c0 voir",
    saveChanges: "Enregistrer les modifications",
    cancel: "Annuler la modification",
    refresh: "Actualiser",
    empty: "Aucun lien enregistr\u00e9. Colle un lien ci-dessus ou enregistre un live ou une rediffusion.",
    loading: "Chargement de ta liste...",
    count: "{{count}} / {{max}} liens",
    edit: "Modifier",
    editLabel: "Modifier {{title}}",
    remove: "Supprimer",
    confirmRemove: "Confirmer la suppression",
    openLabel: "Ouvrir {{title}} dans un nouvel onglet",
    addedAt: "Enregistr\u00e9 le {{date}}",
    saved: "Lien enregistr\u00e9.",
    removed: "Lien supprim\u00e9.",
    invalidUrl: "Utilise un lien HTTPS Twitch, Kick ou YouTube, sans identifiant ni mot de passe.",
    invalidTitle: "Limite le titre \u00e0 {{max}} caract\u00e8res, puis r\u00e9essaie.",
    invalidNote: "Limite la note \u00e0 {{max}} caract\u00e8res, puis r\u00e9essaie.",
    full: "Ta liste contient d\u00e9j\u00e0 {{max}} liens. Supprime un lien avant d'en ajouter un.",
    missing: "Ce lien a \u00e9t\u00e9 supprim\u00e9 ailleurs. Annule la modification, puis ajoute-le \u00e0 nouveau si besoin.",
    readError: "Impossible de charger ta liste. Actualise pour r\u00e9essayer.",
    writeError: "Impossible d'enregistrer la modification. Ta saisie est conserv\u00e9e ; r\u00e9essaie.",
  },
};

// Merged from i18n/lang/*: the tests below exercise the real shipped copy.
en.popup.watchLater = { ...watchLaterTranslations.en, ...en.watchLaterCopy };
fr.popup.watchLater = { ...watchLaterTranslations.fr, ...fr.watchLaterCopy };

// Stable DOM nodes, events and selections let these tests catch destructive
// re-renders without a new DOM dependency or an extension/background process.
class Element extends EventTarget {
  constructor(tag) {
    super();
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.className = "";
    this.value = "";
    this.hidden = false;
    this.disabled = false;
    this._text = "";
  }
  get classList() {
    const names = () => new Set(this.className.split(/\s+/).filter(Boolean));
    return {
      contains: (name) => names().has(name),
      add: (name) => { this.className = [...names().add(name)].join(" "); },
      remove: (name) => { const next = names(); next.delete(name); this.className = [...next].join(" "); },
    };
  }
  append(...children) { for (const child of children) this.insertBefore(child, null); }
  insertBefore(child, reference) {
    child.remove();
    this.children.splice(reference ? this.children.indexOf(reference) : this.children.length, 0, child);
    child.parentElement = this;
    return child;
  }
  remove() {
    if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
    this.parentElement = null;
  }
  replaceChildren(...children) { for (const child of [...this.children]) child.remove(); this._text = ""; this.append(...children); }
  set textContent(value) { this.replaceChildren(); this._text = String(value); }
  get textContent() { return this._text + this.children.map((child) => child.textContent).join(""); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  contains(element) { return this === element || this.children.some((child) => child.contains(element)); }
  focus() { document.activeElement = this; }
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  click() { if (!this.disabled) this.dispatchEvent(new Event("click")); }
}

const saved = (index = 1, extra = {}) => ({
  id: `id-${index}`, url: `https://www.twitch.tv/videos/${index}`, title: `Final ${index}`,
  note: "42:00", createdAt: Date.parse("2026-10-17T12:00:00Z") - index, platform: "twitch", ...extra,
});
let root, fake, controller, writes;
const $ = (id) => document.getElementById(id);
const rows = () => $("watch-later-list").children;
const descendants = (node) => [node, ...node.children.flatMap(descendants)];
const button = (row, action) => descendants(row).find((node) => node.dataset.action === action);
const fill = (id, value) => { $(id).value = value; $(id).dispatchEvent(new Event("input")); };
const submit = () => $("watch-later-form").dispatchEvent(new Event("submit", { cancelable: true }));
async function settled() { for (let i = 0; i < 40; i += 1) await Promise.resolve(); }

beforeEach(async (t) => {
  root = new Element("section");
  root.id = "watch-later";
  globalThis.document = Object.assign(new EventTarget(), {
    activeElement: null,
    createElement: (tag) => new Element(tag),
    getElementById: (id) => descendants(root).find((node) => node.id === id) || null,
  });
  globalThis.window = new EventTarget();
  fake = createFakeChrome({ local: { [WATCH_LATER_KEY]: [saved()], unrelated: { keep: true } } });
  globalThis.chrome = fake;
  fake.runtime.sendMessage = async () => ({ success: true });
  writes = [];
  const set = fake.storage.local.set;
  t.mock.method(fake.storage.local, "set", async (values) => {
    writes.push(structuredClone(values));
    await set(values);
    const changes = Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { newValue }]));
    for (const listener of [...fake.storage.onChanged.listeners]) listener(changes, "local");
  });
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Network forbidden"); });
  controller = null;
  await initI18n("en");
  t.after(() => { controller?.destroy(); delete globalThis.document; delete globalThis.window; delete globalThis.chrome; });
});

async function mount() { controller = await initWatchLater(); return controller; }

test("idempotent mount reads only, has labelled fields, safe links and no automatic history import", async () => {
  const first = await mount();
  const note = $("watch-later-note");
  note.focus();
  assert.equal(await mount(), first);
  assert.equal($("watch-later-note"), note);
  assert.equal(document.activeElement, note);
  assert.equal(fake.storage.onChanged.listeners.length, 1);
  assert.deepEqual(writes, []);
  assert.equal(rows().length, 1);
  for (const field of ["url", "title", "note"]) {
    assert.ok(descendants(root).some((node) => node.tagName === "LABEL" && node.getAttribute("for") === `watch-later-${field}`));
  }
  const link = descendants(rows()[0]).find((node) => node.tagName === "A");
  assert.equal(link.href, saved().url);
  assert.equal(link.target, "_blank");
  assert.match(link.rel, /\bnoopener\b/);
  assert.equal(link.getAttribute("aria-label"), "Open Final 1 in a new tab");
  assert.deepEqual(fake.calls, []);
});

test("storage content is text, invalid URLs never reach links, language changes preserve selection", async () => {
  const hostile = '<img src=x onerror="alert(1)">';
  await fake.storage.local.set({ [WATCH_LATER_KEY]: [saved(1, { title: hostile, note: hostile }), saved(2, { url: "javascript:alert(1)" })] });
  await mount();
  assert.equal(rows().length, 1);
  assert.equal(descendants(root).some((node) => node.tagName === "IMG"), false);
  const link = descendants(rows()[0]).find((node) => node.tagName === "A");
  assert.equal(link.textContent, hostile);
  fill("watch-later-note", "a draft\nsecond line");
  const note = $("watch-later-note");
  note.focus();
  note.setSelectionRange(3, 8);
  const before = writes.length;
  await setLanguage("fr");
  assert.equal($("watch-later-heading").textContent, watchLaterTranslations.fr.title);
  assert.equal($("watch-later-note"), note);
  assert.equal(note.value, "a draft\nsecond line");
  assert.equal(document.activeElement, note);
  assert.deepEqual([note.selectionStart, note.selectionEnd], [3, 8]);
  assert.equal(writes.length, before);
});

test("explicit submission validates, announces errors and saves without clearing an omitted existing note", async () => {
  await mount();
  fill("watch-later-url", "http://twitch.tv/a");
  fill("watch-later-title", "My title");
  submit();
  await settled();
  assert.equal($("watch-later-error").getAttribute("role"), "alert");
  assert.equal($("watch-later-error").textContent, watchLaterTranslations.en.invalidUrl);
  assert.equal($("watch-later-url").getAttribute("aria-invalid"), "true");
  assert.equal($("watch-later-title").value, "My title");
  assert.deepEqual(writes, []);
  fill("watch-later-url", saved().url);
  submit();
  await settled();
  assert.deepEqual(fake.storage.local.dump()[WATCH_LATER_KEY], [saved(1, { title: "My title" })]);
  assert.equal($("watch-later-url").value, "");
  assert.equal($("watch-later-error").hidden, true);
  assert.equal($("watch-later-status").textContent, watchLaterTranslations.en.saved);
});

test("editing a note patches fresh storage without overwriting an externally changed title or draft", async () => {
  await mount();
  const row = rows()[0];
  button(row, "edit").click();
  const note = $("watch-later-note");
  assert.equal($("watch-later-url").readOnly, true);
  fill("watch-later-note", "  new note\n50:00  ");
  note.focus();
  note.setSelectionRange(2, 6);
  await fake.storage.local.set({ [WATCH_LATER_KEY]: [saved(2), saved(1, { title: "Changed elsewhere", note: "external" })] });
  await setLanguage("fr");
  assert.equal(rows()[1], row);
  assert.equal($("watch-later-note"), note);
  assert.equal(note.value, "  new note\n50:00  ");
  assert.equal(document.activeElement, note);
  assert.deepEqual([note.selectionStart, note.selectionEnd], [2, 6]);
  submit();
  await settled();
  assert.deepEqual(fake.storage.local.dump()[WATCH_LATER_KEY], [saved(2), saved(1, { title: "Changed elsewhere", note: "  new note\n50:00  " })]);
  assert.deepEqual(fake.storage.local.dump().unrelated, { keep: true });
  assert.equal($("watch-later-cancel").hidden, true);
  assert.equal($("watch-later-url").readOnly, false);
  button(rows()[1], "edit").click();
  fill("watch-later-note", "");
  submit();
  await settled();
  assert.equal(fake.storage.local.dump()[WATCH_LATER_KEY][1].note, "");
});

test("typing during a pending save is not discarded; double submission writes only once", async (t) => {
  await mount();
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const set = fake.storage.local.set;
  t.mock.method(fake.storage.local, "set", async (values) => { await pending; return set(values); });
  fill("watch-later-url", "https://kick.com/caster");
  fill("watch-later-note", "submitted");
  submit();
  submit();
  await settled();
  assert.equal($("watch-later-save").disabled, true);
  fill("watch-later-note", "still typing");
  $("watch-later-note").focus();
  release();
  await settled();
  assert.equal(writes.length, 1);
  assert.equal(fake.storage.local.dump()[WATCH_LATER_KEY][0].note, "submitted");
  assert.equal($("watch-later-note").value, "still typing");
  assert.equal(document.activeElement, $("watch-later-note"));
  assert.equal($("watch-later-save").disabled, false);
});

test("reverting a note during a pending save still saves that revert on the next submission", async (t) => {
  await mount();
  button(rows()[0], "edit").click();
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const set = fake.storage.local.set;
  const delayed = t.mock.method(fake.storage.local, "set", async (values) => { await pending; return set(values); });
  fill("watch-later-note", "submitted");
  submit();
  fill("watch-later-note", saved().note);
  release();
  await settled();
  delayed.mock.restore();
  assert.equal($("watch-later-note").value, saved().note);
  assert.equal(fake.storage.local.dump()[WATCH_LATER_KEY][0].note, "submitted");
  submit();
  await settled();
  assert.equal(fake.storage.local.dump()[WATCH_LATER_KEY][0].note, saved().note);
});

test("clearing a note while a new link saves preserves the draft and clears the saved note on resubmit", async (t) => {
  await mount();
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const set = fake.storage.local.set;
  const delayed = t.mock.method(fake.storage.local, "set", async (values) => { await pending; return set(values); });
  fill("watch-later-url", "https://kick.com/caster");
  fill("watch-later-note", "submitted");
  submit();
  fill("watch-later-note", "");
  release();
  await settled();
  delayed.mock.restore();
  assert.equal($("watch-later-note").value, "");
  submit();
  await settled();
  assert.equal(fake.storage.local.dump()[WATCH_LATER_KEY][0].note, "");
});

test("a continuing note draft never restores an untouched stale title on resubmission", async (t) => {
  await mount();
  button(rows()[0], "edit").click();
  await fake.storage.local.set({ [WATCH_LATER_KEY]: [saved(1, { title: "New title elsewhere" })] });
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const set = fake.storage.local.set;
  const delayed = t.mock.method(fake.storage.local, "set", async (values) => { await pending; return set(values); });
  fill("watch-later-note", "first draft");
  submit();
  fill("watch-later-note", "second draft");
  release();
  await settled();
  delayed.mock.restore();
  submit();
  await settled();
  assert.equal(fake.storage.local.dump()[WATCH_LATER_KEY][0].note, "second draft");
  assert.equal(fake.storage.local.dump()[WATCH_LATER_KEY][0].title, "New title elsewhere");
});

test("removal needs confirmation, uses fresh storage and leaves failures visible and recoverable", async (t) => {
  await mount();
  const remove = button(rows()[0], "remove");
  remove.click();
  await settled();
  assert.deepEqual(writes, []);
  assert.equal(remove.textContent, watchLaterTranslations.en.confirmRemove);
  await setLanguage("fr");
  assert.equal(remove.textContent, watchLaterTranslations.fr.confirmRemove);
  await fake.storage.local.set({ [WATCH_LATER_KEY]: [saved(2), saved()] });
  remove.focus();
  remove.click();
  await settled();
  assert.deepEqual(fake.storage.local.dump()[WATCH_LATER_KEY], [saved(2)]);
  assert.equal(document.activeElement, $("watch-later-url"));
  const failure = t.mock.method(fake.storage.local, "set", async () => { throw new Error("Quota"); });
  button(rows()[0], "remove").click();
  button(rows()[0], "remove").click();
  await settled();
  assert.equal(rows().length, 1);
  assert.equal($("watch-later-error").textContent, watchLaterTranslations.fr.writeError);
  failure.mock.restore();
  button(rows()[0], "remove").click();
  button(rows()[0], "remove").click();
  await settled();
  assert.equal(rows().length, 0);
  assert.equal($("watch-later-empty").hidden, false);
});

test("a draft typed while a confirmed deletion is pending is not erased or blurred", async (t) => {
  await mount();
  button(rows()[0], "edit").click();
  const remove = button(rows()[0], "remove");
  remove.focus();
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const set = fake.storage.local.set;
  t.mock.method(fake.storage.local, "set", async (values) => { await pending; return set(values); });
  remove.click();
  remove.click();
  fill("watch-later-note", "a newer draft");
  $("watch-later-note").focus();
  release();
  await settled();
  assert.deepEqual(fake.storage.local.dump()[WATCH_LATER_KEY], []);
  assert.equal($("watch-later-note").value, "a newer draft");
  assert.equal(document.activeElement, $("watch-later-note"));
});

test("a remotely deleted edit is not resurrected and cancel does not write", async () => {
  await mount();
  button(rows()[0], "edit").click();
  fill("watch-later-note", "keep my draft");
  await fake.storage.local.set({ [WATCH_LATER_KEY]: [] });
  writes.length = 0;
  submit();
  await settled();
  assert.equal($("watch-later-note").value, "keep my draft");
  assert.equal($("watch-later-error").textContent, watchLaterTranslations.en.missing);
  assert.deepEqual(writes, []);
  $("watch-later-cancel").click();
  assert.equal($("watch-later-note").value, "");
  assert.equal($("watch-later-cancel").hidden, true);
  assert.deepEqual(writes, []);
});

test("read failure has a retry and preserves a draft; unrelated and sync changes are ignored", async (t) => {
  const failed = t.mock.method(fake.storage.local, "get", async () => { throw new Error("Read failed"); });
  await mount();
  assert.equal($("watch-later-error").textContent, watchLaterTranslations.en.readError);
  fill("watch-later-note", "draft");
  failed.mock.restore();
  $("watch-later-refresh").click();
  await settled();
  assert.equal($("watch-later-error").hidden, true);
  assert.equal($("watch-later-note").value, "draft");
  assert.equal(rows().length, 1);
  for (const listener of fake.storage.onChanged.listeners) {
    listener({ [WATCH_LATER_KEY]: { newValue: [] } }, "sync");
    listener({ somethingElse: { newValue: 1 } }, "local");
  }
  assert.equal(rows().length, 1);
  assert.deepEqual(writes, []);
});

test("newer storage events beat pending reads, and destroy removes listeners and armed timers", async (t) => {
  await mount();
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  t.mock.method(fake.storage.local, "get", () => pending);
  const refresh = controller.refresh();
  await fake.storage.local.set({ [WATCH_LATER_KEY]: [saved(2), saved()] });
  release({ [WATCH_LATER_KEY]: [saved()] });
  await refresh;
  assert.equal(rows().length, 2);
  button(rows()[0], "remove").click();
  controller.destroy();
  controller.destroy();
  assert.equal(fake.storage.onChanged.listeners.length, 0);
  assert.equal(root.children.length, 0);
  await setLanguage("fr");
  assert.equal(root.children.length, 0);
});

test("no container means no side effects; a later mount and pagehide clean up normally", async () => {
  root.id = "not-mounted";
  assert.equal(await initWatchLater(), null);
  assert.equal(fake.storage.onChanged.listeners.length, 0);
  root.id = "watch-later";
  await mount();
  window.dispatchEvent(new Event("pagehide"));
  assert.equal(fake.storage.onChanged.listeners.length, 0);
  assert.equal(root.children.length, 0);
  await mount();
  assert.equal(fake.storage.onChanged.listeners.length, 1);
  assert.deepEqual(writes, []);
});

test("FR/EN handoff covers every literal UI translation key with matching placeholders", async () => {
  const source = await readFile(new URL("../js/popup-watch-later.js", import.meta.url), "utf8");
  const keys = new Set([...source.matchAll(/"popup\.watchLater\.([^"]+)"/g)].map((match) => match[1]));
  assert.deepEqual(keys, new Set(Object.keys(watchLaterTranslations.en)));
  assert.deepEqual(keys, new Set(Object.keys(watchLaterTranslations.fr)));
  for (const key of keys) {
    const placeholders = (value) => [...value.matchAll(/{{(\w+)}}/g)].map((match) => match[1]).sort();
    assert.deepEqual(placeholders(watchLaterTranslations.fr[key]), placeholders(watchLaterTranslations.en[key]), key);
  }
});

test("offline browser: real labels, form submission, safe links and selection survive FR/EN and storage changes", async (t) => {
  // The Node-only network guard is not needed in the separate offline browser.
  t.mock.reset();
  const result = await extensionPage("popup", async ({ $, module, stored, calls, change, waitFor }) => {
    const { default: en } = await import(new URL("../i18n/lang/en.js", document.baseURI));
    const { default: fr } = await import(new URL("../i18n/lang/fr.js", document.baseURI));
    en.popup.watchLater = stored.testTranslations.en;
    fr.popup.watchLater = stored.testTranslations.fr;
    const { initI18n, setLanguage } = await module("i18n.js");
    await initI18n("fr");
    await initI18n("en");
    const { initWatchLater } = await module("popup-watch-later.js");
    const key = "streamPulseWatchLater";
    const stage = (message) => document.documentElement.setAttribute("data-test-progress", message);
    document.querySelector("main")?.classList.add("hidden");
    $("history-view").classList.remove("hidden");
    let root = $("watch-later");
    if (!root) {
      root = document.createElement("section");
      root.id = "watch-later";
      $("history-view").append(root);
    }
    const controller = await initWatchLater();
    stage("watch-later mounted");
    const row = root.querySelector("li");
    const link = row.querySelector("a");
    const security = { href: link.href, rel: link.rel, target: link.target, hasInjectedImage: Boolean(root.querySelector("img")), title: link.textContent };
    row.querySelector('[data-action="edit"]').click();
    const note = $("watch-later-note");
    note.value = "A note\nwith two lines";
    note.dispatchEvent(new Event("input", { bubbles: true }));
    note.focus();
    note.setSelectionRange(2, 6);
    change({ [key]: [{ ...stored[key][0], title: "Renamed elsewhere" }, {
      id: "external", url: "https://kick.com/caster", title: "Other stream", note: "", createdAt: 0, platform: "kick",
    }] });
    await setLanguage("fr");
    stage("watch-later translated");
    const preserved = {
      sameNode: $("watch-later-note") === note, sameRow: root.querySelector("li") === row,
      focus: document.activeElement === note, selection: [note.selectionStart, note.selectionEnd],
      value: note.value, title: $("watch-later-heading").textContent,
    };
    const before = calls.filter((call) => call.type === "storage.set").length;
    $("watch-later-save").click();
    await waitFor(() => !$("watch-later-save").disabled);
    stage("watch-later saved");
    const afterSave = structuredClone(stored[key]);
    const saves = calls.filter((call) => call.type === "storage.set").length - before;
    const remove = row.querySelector('[data-action="remove"]');
    remove.click();
    const armedOnly = stored[key].length === 2;
    remove.click();
    await waitFor(() => stored[key].length === 1 && !$("watch-later-save").disabled);
    stage("watch-later removed");
    $("watch-later-url").value = "https://twitch.tv.evil.example/bad";
    $("watch-later-save").click();
    await waitFor(() => !$("watch-later-error").hidden && !$("watch-later-save").disabled);
    const validation = {
      role: $("watch-later-error").getAttribute("role"), value: $("watch-later-url").value,
      message: $("watch-later-error").textContent, invalid: $("watch-later-url").getAttribute("aria-invalid"),
    };
    const labelled = [...root.querySelectorAll("input, textarea")].every((input) => input.labels.length > 0);
    controller.destroy();
    return { security, preserved, afterSave, saves, armedOnly, validation, labelled, remaining: stored[key].length };
  }, { stored: {
    testTranslations: watchLaterTranslations,
    [WATCH_LATER_KEY]: [{
      id: "saved", url: "https://www.youtube.com/watch?v=sample&t=42", title: "<img src=x onerror=alert(1)>",
      note: "original", createdAt: Date.parse("2026-10-17T12:00:00Z"), platform: "youtube",
    }],
  } });
  assert.deepEqual(result.security, {
    href: "https://www.youtube.com/watch?v=sample&t=42", rel: "noopener noreferrer", target: "_blank",
    hasInjectedImage: false, title: "<img src=x onerror=alert(1)>",
  });
  assert.deepEqual(result.preserved, {
    sameNode: true, sameRow: true, focus: true, selection: [2, 6], value: "A note\nwith two lines", title: watchLaterTranslations.fr.title,
  });
  assert.equal(result.afterSave[0].note, "A note\nwith two lines");
  assert.equal(result.afterSave[0].title, "Renamed elsewhere");
  assert.equal(result.saves, 1);
  assert.equal(result.armedOnly, true);
  assert.deepEqual(result.validation, {
    role: "alert", value: "https://twitch.tv.evil.example/bad", message: watchLaterTranslations.fr.invalidUrl, invalid: "true",
  });
  assert.equal(result.labelled, true);
  assert.equal(result.remaining, 1);
});
