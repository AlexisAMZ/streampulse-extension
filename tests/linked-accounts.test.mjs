import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extensionPage } from "./helpers/extension-page.mjs";
import {
  LINKED_ACCOUNTS_KEY, getLinkedGroup, normalizeLinkedAccounts,
  selectLinkedLive, shouldNotifyLinked,
} from "../js/linked-accounts.js";

const streamers = [
  { id: "ada", platform: "twitch", displayName: "Ada", handle: "ada", notificationsEnabled: false },
  { id: "kick:ada", platform: "kick", displayName: "Ada", handle: "ada", notificationsEnabled: true },
  { id: "youtube:UCada", platform: "youtube", displayName: "Ada", handle: "UCada" },
  { id: "bea", platform: "twitch", displayName: "Bea", handle: "bea" },
  { id: "kick:bea", platform: "kick", displayName: "Bea", handle: "bea" },
  { id: "youtube:UCbea", platform: "youtube", displayName: "Bea", handle: "UCbea" },
];
const group = { id: "ada-group", name: "Ada", streamerIds: ["ada", "kick:ada", "youtube:UCada"], preferredId: "youtube:UCada" };
const otherGroup = { id: "bea-group", name: "Bea", streamerIds: ["bea", "kick:bea"], preferredId: "bea" };
const live = { active: { isLive: true } };
const ids = (entries) => entries.map((entry) => entry.id);

test("normalization is opt-in, rejects malformed groups and keeps only the public schema", () => {
  assert.equal(LINKED_ACCOUNTS_KEY, "streamPulseLinkedAccounts");
  for (const value of [null, undefined, {}, "groups", 1]) assert.deepEqual(normalizeLinkedAccounts(value), []);
  assert.deepEqual(normalizeLinkedAccounts([
    null, {}, { ...group, id: " " }, { ...group, name: 4 },
    { ...group, name: " " }, { ...group, streamerIds: "ada" },
    { ...group, streamerIds: [null, 4, {}, "ada", "ada"] },
    { ...group, id: " group ", name: " Ada ensemble ", streamerIds: [" ada ", "ada", "kick:ada", false, ""], preferredId: "missing", stats: { total: 9 } },
  ], streamers), [{ id: "group", name: "Ada ensemble", streamerIds: ["ada", "kick:ada"], preferredId: "ada" }]);
  assert.deepEqual(normalizeLinkedAccounts([], streamers), [], "matching names never create links");
});

test("membership and preference are filtered against existing accounts only when a roster is supplied", () => {
  assert.deepEqual(normalizeLinkedAccounts([group]), [group]);
  assert.deepEqual(normalizeLinkedAccounts([group], streamers.slice(0, 2)), [{ ...group, streamerIds: ["ada", "kick:ada"], preferredId: "ada" }]);
  assert.deepEqual(normalizeLinkedAccounts([group], streamers.slice(0, 1)), []);
  assert.deepEqual(normalizeLinkedAccounts([group], []), []);
  assert.deepEqual(normalizeLinkedAccounts([group], null), []);
  const opaque = { ...group, streamerIds: ["UCAbC", "UCabc"], preferredId: " UCabc " };
  assert.deepEqual(normalizeLinkedAccounts([opaque]), [{ ...opaque, preferredId: "UCabc" }], "IDs stay case-sensitive");
});

test("groups need two platforms when metadata permits checking, without discarding extra explicit members", () => {
  const samePlatform = { ...group, streamerIds: ["ada", "bea"], preferredId: "ada" };
  assert.deepEqual(normalizeLinkedAccounts([samePlatform], streamers), []);
  assert.deepEqual(normalizeLinkedAccounts([samePlatform], [{ id: "ada" }, { id: "bea" }]), [samePlatform]);
  const crossPlatform = { ...samePlatform, streamerIds: ["ada", "bea", "kick:ada"] };
  assert.deepEqual(normalizeLinkedAccounts([crossPlatform], streamers), [crossPlatform]);
  assert.deepEqual(normalizeLinkedAccounts([samePlatform], [{ id: "ada", platform: "other" }, { id: "bea", platform: "other" }]), [samePlatform]);
});

test("the first valid group owns each member and group ID; rejected groups reserve nothing", () => {
  const input = [
    { ...group, id: "reused", streamerIds: ["bea"] },
    group,
    { ...otherGroup, id: "ada-group" },
    { ...otherGroup, id: "reused", streamerIds: ["ada", "bea", "kick:bea"], preferredId: "ada" },
    { ...group, id: "last", streamerIds: ["kick:bea", "youtube:UCbea"] },
  ];
  assert.deepEqual(normalizeLinkedAccounts(input, streamers), [group, { ...otherGroup, id: "reused" }]);
  assert.deepEqual(getLinkedGroup(input, "kick:bea"), { ...otherGroup, id: "reused" });
  assert.equal(getLinkedGroup(input, "ada-group"), null, "lookup takes a streamer ID, not a group ID");
  assert.equal(getLinkedGroup(null, "ada"), null);
});

test("normalization caps valid groups at 100, bounds names and is idempotent without mutating inputs", () => {
  const many = Array.from({ length: 102 }, (_, index) => ({ id: `g${index}`, name: "n".repeat(120), streamerIds: [`a${index}`, `b${index}`], preferredId: null }));
  const before = structuredClone(many);
  for (const entry of many) { Object.freeze(entry.streamerIds); Object.freeze(entry); }
  Object.freeze(many);
  const result = normalizeLinkedAccounts([{}, ...many]);
  assert.equal(result.length, 100);
  assert.equal(result.at(-1).id, "g99");
  assert.equal(result[0].name.length, 80);
  assert.deepEqual(normalizeLinkedAccounts(result), result);
  assert.deepEqual(many, before);
});

test("live selection prefers a LIVE member, otherwise group order, and keeps unlinked live entries in input order", () => {
  const statuses = { ada: live, "kick:ada": live, "youtube:UCada": live, bea: live, "kick:bea": { active: { isLive: false } } };
  assert.deepEqual(ids(selectLinkedLive(streamers, statuses, [group])), ["youtube:UCada", "bea"]);
  delete statuses["youtube:UCada"];
  assert.deepEqual(ids(selectLinkedLive([...streamers].reverse(), statuses, [group])), ["bea", "ada"]);
  statuses.ada = { active: { isLive: false } };
  assert.deepEqual(ids(selectLinkedLive(streamers, statuses, [group])), ["kick:ada", "bea"]);
  assert.deepEqual(ids(selectLinkedLive(streamers, statuses, [])), ["kick:ada", "bea"]);
  assert.deepEqual(selectLinkedLive(null, statuses, [group]), []);
  assert.deepEqual(selectLinkedLive(streamers, null, [group]), []);
});

test("live selection handles worker Maps, ignores absent members and returns original account objects", () => {
  const roster = Object.freeze(streamers.slice(0, 2).map((entry) => Object.freeze({ ...entry })));
  const statuses = new Map([["ada", live], ["kick:ada", live], ["youtube:UCada", live]]);
  const result = selectLinkedLive(roster, statuses, Object.freeze([Object.freeze(group)]));
  assert.deepEqual(ids(result), ["ada"]);
  assert.equal(result[0], roster[0]);
  assert.equal(result[0].notificationsEnabled, false, "display choice does not change notification preferences");
  assert.equal(statuses.size, 3);
});

test("only actual live flags count, and prototype properties cannot impersonate statuses", () => {
  const statuses = Object.assign(Object.create({ ada: live }), {
    "kick:ada": { active: { isLive: "true" } },
    "youtube:UCada": { active: { isLive: true, isError: true } },
  });
  assert.deepEqual(selectLinkedLive(streamers, statuses, [group]), []);
  assert.deepEqual(ids(selectLinkedLive(streamers, { ada: { isLive: true } }, [group])), ["ada"], "flat worker live states are accepted");
});

test("notification gate selects one eligible candidate, preferred first, without silencing unlinked accounts", () => {
  const candidates = { ada: live, "kick:ada": live, "youtube:UCada": live };
  assert.equal(shouldNotifyLinked("ada", candidates, [group]), false);
  assert.equal(shouldNotifyLinked("youtube:UCada", candidates, [group]), true);
  delete candidates["youtube:UCada"];
  assert.equal(shouldNotifyLinked("ada", candidates, [group]), true);
  assert.equal(shouldNotifyLinked("kick:ada", candidates, [group]), false);
  assert.equal(shouldNotifyLinked("bea", {}, [group]), true);
  assert.equal(shouldNotifyLinked("ada", {}, [group]), false);
});

test("a muted or non-candidate preferred live cannot mask an eligible notification", () => {
  const preferred = { ...group, preferredId: "ada" };
  const candidates = new Map([["ada", { ...live, notificationsEnabled: false }], ["kick:ada", live]]);
  assert.equal(shouldNotifyLinked("ada", candidates, [preferred]), false);
  assert.equal(shouldNotifyLinked("kick:ada", candidates, [preferred]), true);
  // The parent excludes already-live accounts with no new alert, and applies
  // quiet hours / smart rules before calling this pure batch-selection gate.
  candidates.delete("ada");
  assert.equal(shouldNotifyLinked("kick:ada", candidates, [preferred]), true);
  assert.equal(candidates.size, 1);
});

const messages = {
  en: {
    title: "Linked accounts",
    description: "Streamers you've linked across platforms.",
    accountLabel: "{{platform}}: {{name}} ({{account}})",
    preferredSummary: "Preferred: {{account}}",
    empty: "No linked accounts yet.",
    loading: "Loading linked accounts...",
    conflict: "The linked accounts changed elsewhere. Check the list before trying again.",
    readError: "Linked accounts could not be loaded. Try loading them again.",
    writeError: "The link couldn't be removed. Try again in a moment.",
    retry: "Load again",
    unlink: "Unlink",
    unlinkConfirm: "Confirm unlinking",
    unlinked: "Accounts unlinked. Stats and settings are unchanged.",
  },
  fr: {
    title: "Comptes li\u00e9s",
    description: "Les streamers que tu as reli\u00e9s entre eux.",
    accountLabel: "{{platform}} : {{name}} ({{account}})",
    preferredSummary: "Pr\u00e9f\u00e9r\u00e9 : {{account}}",
    empty: "Aucun compte li\u00e9 pour l'instant.",
    loading: "Chargement des comptes li\u00e9s...",
    conflict: "Les comptes li\u00e9s ont chang\u00e9 ailleurs. V\u00e9rifie la liste avant de r\u00e9essayer.",
    readError: "Impossible de charger les comptes li\u00e9s. Relance le chargement.",
    writeError: "Impossible de retirer le lien. R\u00e9essaie dans un instant.",
    retry: "Recharger",
    unlink: "D\u00e9lier",
    unlinkConfirm: "Confirmer le d\u00e9liage",
    unlinked: "Comptes d\u00e9li\u00e9s. Les statistiques et r\u00e9glages sont inchang\u00e9s.",
  },
};

test("popup: the list reads links, follows the language and unlinks only after confirmation", async () => {
  const result = await extensionPage("popup", async (api) => {
    const { $, stored, module, waitFor, calls } = api;
    for (const lang of ["en", "fr"]) {
      const dictionary = await import(new URL(`../i18n/lang/${lang}.js`, document.baseURI));
      dictionary.default.popup.linkedAccounts = stored.messages[lang];
    }
    const { initI18n, setLanguage } = await module("i18n.js");
    await initI18n("en");
    const { initLinkedAccounts } = await module("popup-linked-accounts.js");
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const key = "streamPulseLinkedAccounts";
    const roster = stored.betaGeneralStreamers;
    const root = document.createElement("section");
    root.id = "linked-accounts";
    $("menu-general").prepend(root);
    const controller = await initLinkedAccounts({ getStreamers: () => roster });
    const idle = () => waitFor(() => root.getAttribute("aria-busy") === "false");
    const countWrites = () => calls.filter((call) => call.type === "storage.set").length;
    const error = $("linked-accounts-error");
    check(countWrites() === 0 && root.querySelectorAll("form, select, input").length === 0, "the settings list creates nothing and has no form");
    check(await initLinkedAccounts({ getStreamers: () => roster }) === controller, "mount must be idempotent");
    check(root.querySelectorAll("img").length === 0, "names must never become HTML");
    await setLanguage("fr");
    check($("linked-accounts-title").textContent === stored.messages.fr.title, "labels must follow the language");
    check(countWrites() === 0 && api.changes.size === 1, "language change must not write or duplicate listeners");

    let unlink = [...$("linked-accounts-list").querySelectorAll("button")][0];
    const group = stored[key][0];
    unlink.click();
    check(unlink.textContent === stored.messages.fr.unlinkConfirm && countWrites() === 0, "unlink needs explicit confirmation");
    stored[key] = stored[key].map((entry) => entry.id === group.id ? { ...entry, name: "Changed elsewhere" } : entry);
    unlink.click();
    await waitFor(() => error.textContent === stored.messages.fr.conflict);
    await idle();
    check(countWrites() === 0 && stored[key].length === 1, "confirmation must not delete a changed group");
    await controller.refresh();
    unlink = [...$("linked-accounts-list").querySelectorAll("button")][0];
    unlink.click();
    unlink.click();
    await waitFor(() => stored[key].length === 0);
    await idle();
    check($("linked-accounts-status").textContent === stored.messages.fr.unlinked, "unlink must announce the actual result");
    check(!$("linked-accounts-empty").hidden, "an empty list is explained");
    const writes = calls.filter((call) => call.type === "storage.set");
    check(writes.length === 1 && Object.keys(writes[0].items).join() === key, "only the linked-account key may be written");
    check(root.scrollWidth <= root.clientWidth, "the section must fit the fixed popup width");
    controller.destroy();
    check(root.children.length === 0 && api.changes.size === 0, "destroy must release listeners");
    root.remove();
    check(await initLinkedAccounts() === null, "no mount means no listeners");
    return { writes: writes.length, errorsAccessible: error.getAttribute("role") === "alert" };
  }, { stored: { messages, betaGeneralStreamers: streamers, [LINKED_ACCOUNTS_KEY]: [otherGroup] } });
  assert.deepEqual(result, { writes: 1, errorsAccessible: true });
});

test("popup: a failed read offers a retry instead of a false empty state", async () => {
  const result = await extensionPage("popup", async (api) => {
    const { $, stored, module, waitFor } = api;
    const dictionary = await import(new URL("../i18n/lang/en.js", document.baseURI));
    dictionary.default.popup.linkedAccounts = stored.messages.en;
    const { initI18n } = await module("i18n.js");
    await initI18n("en");
    const { initLinkedAccounts } = await module("popup-linked-accounts.js");
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const root = document.createElement("section");
    root.id = "linked-accounts";
    $("menu-general").append(root);
    const read = chrome.storage.local.get;
    chrome.storage.local.get = async () => { throw new Error("Cannot read"); };
    const controller = await initLinkedAccounts({ getStreamers: () => stored.betaGeneralStreamers });
    await waitFor(() => $("linked-accounts-error").textContent === stored.messages.en.readError);
    check(!$("linked-accounts-retry").hidden && $("linked-accounts-empty").hidden, "failed initial load needs a retry, not a false empty state");
    chrome.storage.local.get = read;
    $("linked-accounts-retry").click();
    await waitFor(() => !$("linked-accounts-empty").hidden);
    check($("linked-accounts-error").hidden, "a successful retry clears the error");
    controller.destroy();
    return true;
  }, { stored: { messages, betaGeneralStreamers: streamers, [LINKED_ACCOUNTS_KEY]: [] } });
  assert.equal(result, true);
});

test("the FR/EN handoff covers every literal UI key with matching interpolation parameters", async () => {
  const source = await readFile(new URL("../js/popup-linked-accounts.js", import.meta.url), "utf8");
  const keys = new Set([...source.matchAll(/"popup\.linkedAccounts\.([^"]+)"/g)].map((match) => match[1]));
  assert.deepEqual(keys, new Set(Object.keys(messages.en)));
  assert.deepEqual(new Set(Object.keys(messages.fr)), keys);
  for (const key of keys) {
    const params = (text) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
    assert.deepEqual(params(messages.en[key]), params(messages.fr[key]), key);
  }
});

test("retirer un compte d'un groupe à trois garde les deux autres, le préféré retombe sur le premier", async () => {
  const { unlinkAccount } = await import("../js/linked-accounts.js");
  const next = unlinkAccount([group], streamers, "youtube:UCada");
  assert.deepEqual(next, [{ ...group, streamerIds: ["ada", "kick:ada"], preferredId: "ada" }]);
  assert.deepEqual(group.streamerIds, ["ada", "kick:ada", "youtube:UCada"], "entrée non modifiée");
});

test("retirer un compte d'un groupe à deux dissout le groupe sans toucher les autres", async () => {
  const { unlinkAccount } = await import("../js/linked-accounts.js");
  assert.deepEqual(unlinkAccount([group, otherGroup], streamers, "kick:bea"), [group]);
  assert.deepEqual(unlinkAccount([group], streamers, "inconnu"), [group]);
});

test("la liste des chaînes replie un groupe lié en une ligne portée par le compte en direct, puis le préféré", async () => {
  const { collapseLinkedRows } = await import("../js/linked-accounts.js");
  const rows = [streamers[3], streamers[0], streamers[4], streamers[1], streamers[2]];
  const collapsed = collapseLinkedRows(rows, [group, otherGroup], (s) => s.id === "kick:bea" || s.id === "youtube:UCada");
  assert.deepEqual(collapsed.map((row) => row.streamer.id), ["kick:bea", "youtube:UCada"]);
  assert.deepEqual(collapsed[0].members.map((m) => m.id), ["kick:bea", "bea"], "préféré d'abord quand rien ne distingue");
  assert.deepEqual(collapsed[1].members.map((m) => m.id), ["youtube:UCada", "ada", "kick:ada"]);
  assert.equal(collapsed[0].group.id, "bea-group");
});

test("les comptes sans lien ou dont le partenaire est filtré restent seuls", async () => {
  const { collapseLinkedRows } = await import("../js/linked-accounts.js");
  const only = collapseLinkedRows([streamers[0], streamers[3]], [group, otherGroup], () => false);
  assert.deepEqual(only.map((row) => [row.streamer.id, row.members.length]), [["ada", 1], ["bea", 1]]);
  assert.equal(only[0].group, null);
  assert.deepEqual(collapseLinkedRows([], [group], () => false), []);
});
