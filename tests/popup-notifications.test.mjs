import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createFakeChrome } from "./helpers/fake-chrome.mjs";
import en from "../i18n/lang/en.js";
import fr from "../i18n/lang/fr.js";
import { initI18n, setLanguage } from "../js/i18n.js";

// The parent owns the dictionaries. These in-memory labels exercise the real
// i18n lifecycle without adding translations or touching the popup entrypoint.
const keys = [
  "pauseTitle", "pauseHour", "pauseTomorrow", "resume", "exceptPinned", "exceptPinnedHint",
  "pauseActive", "pauseInactive", "loading", "readError", "writeError", "diagnosticTitle",
  "diagnosticHint", "streamerLabel", "refresh", "empty", "permissionGranted", "permissionDenied",
  "permissionUnknown", "pinnedAllowed", "quietActive", "quietInactive", "settings", "enabled",
  "disabled", "plusActive", "plusInactive", "smartActive", "smartInactive", "smartNone",
  "observedAt", "noObservationTime",
];
const reasons = ["apiError", "unsupported", "streamerDisabled", "offline", "smartMatch", "smartUnchanged", "smartNoMatch", "live", "catchUp", "changes", "noChange", "noStatus", "noBaseline"];
for (const [language, dictionary] of [["en", en], ["fr", fr]]) {
  dictionary.popup.notificationTools = Object.fromEntries(keys.map((key) => [key, `${language}:${key}`]));
  Object.assign(dictionary.popup.notificationTools, {
    pauseActive: `${language}:pauseActive {{until}}`,
    quietActive: `${language}:quietActive {{start}} {{end}}`,
    settings: `${language}:settings {{live}} {{game}} {{title}}`,
    smartActive: `${language}:smartActive {{count}}`,
    smartInactive: `${language}:smartInactive {{count}}`,
    observedAt: `${language}:observedAt {{date}}`,
    reason: Object.fromEntries(reasons.map((key) => [key, `${language}:reason.${key}`])),
  });
}

// Minimal DOM for this controller: native EventTarget/AbortSignal semantics,
// stable elements and select values; no browser, server or external requests.
class Element extends EventTarget {
  constructor(tag) {
    super();
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this._text = "";
    this._value = "";
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; this._text = ""; }
  set textContent(text) { this._text = String(text); this.children = []; }
  get textContent() { return this._text + this.children.map((child) => child.textContent).join(""); }
  set value(value) { this._value = String(value); }
  get value() {
    if (this.tagName !== "SELECT") return this._value;
    return this.children.some((child) => child.value === this._value) ? this._value : this.children[0]?.value || "";
  }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  focus() { document.activeElement = this; }
  click() { if (!this.disabled) this.dispatchEvent(new Event("click")); }
}

const NOW = new Date(2026, 9, 17, 12).getTime();
const KEY = "streamPulseNotificationPause";
let fake, root, streamers, preferences, plus, controller, writes;
const $ = (id) => document.getElementById(id);
const tick = () => new Promise((resolve) => queueMicrotask(resolve));
async function settled() { for (let i = 0; i < 30; i += 1) await tick(); }

beforeEach(async (t) => {
  root = new Element("div");
  root.id = "notification-tools";
  globalThis.document = Object.assign(new EventTarget(), {
    hidden: false,
    activeElement: null,
    createElement: (tag) => new Element(tag),
    getElementById: (id) => {
      const visit = (element) => element.id === id ? element : element.children.map(visit).find(Boolean);
      return visit(root);
    },
  });
  globalThis.window = new EventTarget();
  preferences = { quietHoursEnabled: false, language: "en", soundsEnabled: false };
  streamers = [
    { id: "caster", displayName: "<img src=x onerror=alert(1)>", notificationsEnabled: true, gameNotificationsEnabled: false, titleNotificationsEnabled: false },
    { id: "other", displayName: "Other", notificationsEnabled: false },
  ];
  const active = { isLive: true, platform: "twitch", title: "Final", game: "Chess", sessionId: "v1" };
  fake = createFakeChrome({ local: {
    betaGeneralPreferences: preferences,
    betaPinnedIds: ["caster"],
    betaGeneralStatuses: { caster: { active, updatedAt: NOW }, other: { active: { isLive: false } } },
    streamPulseLiveState: { caster: { ...active, updatedAt: NOW } },
    streamPulseSmartAlerts: { caster: [{ id: "r", games: ["Chess"] }] },
  } });
  globalThis.chrome = fake;
  fake.notifications.getPermissionLevel = async () => "granted";
  writes = [];
  for (const method of ["set", "remove"]) {
    const original = fake.storage.local[method];
    t.mock.method(fake.storage.local, method, async (value) => { writes.push([method, value]); return original(value); });
  }
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Network forbidden"); });
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: NOW });
  plus = false;
  controller = null;
  await initI18n("en");
  t.after(() => { controller?.destroy(); delete globalThis.document; delete globalThis.window; delete globalThis.chrome; });
});

async function mount() {
  const { initNotificationControls } = await import("../js/popup-notifications.js");
  controller = await initNotificationControls({ isPlus: () => plus, getStreamers: () => streamers, getPreferences: () => preferences });
  return controller;
}

test("montage idempotent, diagnostic local honnete et noms inseres comme texte", async () => {
  const first = await mount();
  const select = $("notification-streamer");
  select.focus();
  assert.equal(await mount(), first);
  assert.equal($("notification-streamer"), select);
  assert.equal(document.activeElement, select);
  assert.equal(select.children[0].textContent, streamers[0].displayName);
  assert.equal(select.children[0].children.length, 0);
  assert.equal($("notification-decision").textContent, "en:reason.noChange");
  assert.equal($("notification-permission").textContent, "en:permissionGranted");
  assert.equal($("notification-plus").textContent, "en:plusInactive");
  assert.equal($("notification-smart").textContent, "en:smartInactive 1");
  assert.equal($("notification-settings").textContent, "en:settings en:enabled en:disabled en:disabled");
  assert.equal(fake.storage.onChanged.listeners.length, 1);
  assert.deepEqual(writes, []);
  assert.equal(fake.calls.some(([name]) => name === "notifications.create" || name === "runtime.sendMessage"), false);
});

test("pause 1h, exception modifiable sans prolongation, expiration automatique et reprise manuelle", async (t) => {
  await mount();
  $("notification-pause-hour").click();
  $("notification-pause-tomorrow").click();
  await settled();
  assert.deepEqual(fake.storage.local.dump()[KEY], { until: NOW + 3_600_000, exceptPinned: false });
  assert.equal(writes.length, 1, "les doubles clics ne lancent pas une seconde ecriture");
  assert.equal($("notification-resume").disabled, false);
  $("notification-except-pinned").checked = true;
  $("notification-except-pinned").dispatchEvent(new Event("change"));
  await settled();
  assert.deepEqual(fake.storage.local.dump()[KEY], { until: NOW + 3_600_000, exceptPinned: true });
  assert.equal($("notification-silence").textContent, "en:pinnedAllowed");
  t.mock.timers.tick(3_600_001);
  assert.equal($("notification-pause-status").textContent, "en:pauseInactive");
  assert.equal($("notification-resume").disabled, true);
  assert.equal(writes.length, 2, "l'expiration n'ecrit rien");
  $("notification-pause-tomorrow").click();
  await settled();
  assert.deepEqual(fake.storage.local.dump()[KEY], { until: new Date(2026, 9, 18, 8).getTime(), exceptPinned: true });
  $("notification-resume").click();
  await settled();
  assert.equal(KEY in fake.storage.local.dump(), false);
  assert.deepEqual(fake.storage.local.dump().betaGeneralPreferences, preferences);
  assert.deepEqual(writes.map(([method, value]) => method === "set" ? Object.keys(value) : [value]), Array(4).fill([KEY]));
});

test("selection, preferences courantes, permissions et Plus se reevaluent sans ecriture", async () => {
  await mount();
  plus = true;
  preferences = { ...preferences, quietHoursEnabled: true, quietHoursStart: "10:00", quietHoursEnd: "14:00" };
  fake.notifications.getPermissionLevel = async () => "denied";
  await controller.refresh();
  assert.equal($("notification-permission").textContent, "en:permissionDenied");
  assert.equal($("notification-quiet").textContent, "en:quietActive 10:00 14:00");
  assert.equal($("notification-plus").textContent, "en:plusActive");
  assert.equal($("notification-smart").textContent, "en:smartActive 1");
  assert.equal($("notification-decision").textContent, "en:reason.smartMatch");
  $("notification-streamer").value = "other";
  $("notification-streamer").dispatchEvent(new Event("change"));
  assert.equal($("notification-decision").textContent, "en:reason.streamerDisabled");
  await controller.refresh();
  assert.equal($("notification-streamer").value, "other");
  streamers = [];
  await controller.refresh();
  assert.equal($("notification-empty").hidden, false);
  assert.equal($("notification-results").hidden, true);
  assert.deepEqual(writes, []);
});

test("langue et changements de stockage gardent le focus, le choix et un seul abonnement", async () => {
  await mount();
  const select = $("notification-streamer");
  select.value = "other";
  select.focus();
  $("notification-except-pinned").checked = true;
  fake.runtime.sendMessage = async () => ({ success: true });
  await setLanguage("fr");
  assert.equal($("notification-pause-hour").textContent, "fr:pauseHour");
  assert.equal(select.value, "other");
  assert.equal(document.activeElement, select);
  assert.equal($("notification-except-pinned").checked, true);
  await fake.storage.local.set({ [KEY]: { until: NOW + 1000, exceptPinned: false } });
  for (const listener of fake.storage.onChanged.listeners) listener({ [KEY]: { newValue: fake.storage.local.dump()[KEY] } }, "local");
  await settled();
  assert.match($("notification-pause-status").textContent, /^fr:pauseActive /);
  assert.equal($("notification-except-pinned").checked, false);
  assert.equal(writes.length, 1, "la seule ecriture vient du test, pas du rafraichissement");
  const previous = controller;
  controller.destroy();
  assert.equal(fake.storage.onChanged.listeners.length, 0);
  assert.notEqual(await mount(), previous);
  assert.equal(fake.storage.onChanged.listeners.length, 1);
});

test("stockage en echec : pas de faux succes, reprise possible et erreurs accessibles", async (t) => {
  await mount();
  const failedSet = t.mock.method(fake.storage.local, "set", async () => { throw new Error("Write failed"); });
  $("notification-pause-hour").click();
  await settled();
  assert.equal($("notification-tools-error").getAttribute("role"), "alert");
  assert.equal($("notification-tools-error").textContent, "en:writeError");
  assert.equal($("notification-pause-status").textContent, "en:pauseInactive");
  assert.equal($("notification-pause-hour").disabled, false);
  failedSet.mock.restore();
  const failedGet = t.mock.method(fake.storage.local, "get", async () => { throw new Error("Read failed"); });
  await controller.refresh();
  assert.equal($("notification-tools-error").textContent, "en:readError");
  assert.equal($("notification-results").hidden, true);
  assert.equal($("notification-pause-hour").disabled, true);
  failedGet.mock.restore();
  $("notification-refresh").click();
  await settled();
  assert.equal($("notification-tools-error").hidden, true);
  assert.equal($("notification-pause-hour").disabled, false);
});

test("une lecture ancienne ne remplace pas un etat plus recent et le demontage invalide les lectures", async (t) => {
  await mount();
  const old = fake.storage.local.dump();
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const slowGet = t.mock.method(fake.storage.local, "get", () => pending.then(() => old));
  const slow = controller.refresh();
  slowGet.mock.restore();
  await fake.storage.local.set({ [KEY]: { until: NOW + 1000, exceptPinned: false } });
  await controller.refresh();
  release();
  await slow;
  assert.match($("notification-pause-status").textContent, /^en:pauseActive /);
  const last = controller.refresh();
  controller.destroy();
  await last;
  assert.equal(fake.storage.onChanged.listeners.length, 0);
  assert.equal(root.children.length, 0);
});

test("pas de conteneur : aucun abonnement ; premier chargement en echec recuperable", async (t) => {
  const { initNotificationControls } = await import("../js/popup-notifications.js");
  root.id = "not-mounted";
  assert.equal(await initNotificationControls(), null);
  assert.equal(fake.storage.onChanged.listeners.length, 0);
  root.id = "notification-tools";
  const failedGet = t.mock.method(fake.storage.local, "get", async () => { throw new Error("Read failed"); });
  await mount();
  assert.equal($("notification-tools-error").textContent, "en:readError");
  assert.equal($("notification-pause-status").hidden, true);
  assert.equal($("notification-refresh").disabled, false);
  failedGet.mock.restore();
  await controller.refresh();
  assert.equal($("notification-pause-hour").disabled, false);
  assert.equal(fake.storage.onChanged.listeners.length, 1);
  assert.deepEqual(writes, []);
});

test("contrat i18n : toutes les cles litterales utilisees sont recensees, sans cle superflue", async () => {
  const source = await readFile(new URL("../js/popup-notifications.js", import.meta.url), "utf8");
  const actual = new Set([...source.matchAll(/"popup\.notificationTools\.([^"]+)"/g)].map((match) => match[1]));
  assert.deepEqual(actual, new Set(keys));
  assert.ok(source.includes("`popup.notificationTools.reason.${report.decision.reason}`"));
});
