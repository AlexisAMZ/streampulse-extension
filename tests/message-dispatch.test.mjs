import { test } from "node:test";
import assert from "node:assert/strict";
import { createMessageDispatcher, isExtensionPage, rejectReason, reply, respond } from "../js/sw/message-dispatch.js";

const identity = { runtimeId: "ext-id", extensionPrefix: "chrome-extension://ext-id/" };
const popup = { id: "ext-id", url: "chrome-extension://ext-id/html/popup.html" };
const contentScript = { id: "ext-id", url: "https://www.twitch.tv/foo", tab: { id: 4 } };

const silence = (t) => t.mock.method(console, "warn", () => {});

test("isExtensionPage", () => {
  assert.equal(isExtensionPage(popup, identity.extensionPrefix), true);
  assert.equal(isExtensionPage(contentScript, identity.extensionPrefix), false);
  assert.equal(isExtensionPage({}, identity.extensionPrefix), false);
  assert.equal(isExtensionPage(popup, ""), false);
});

test("rejectReason: expéditeur étranger refusé", () => {
  assert.equal(rejectReason({ type: "getStreamers" }, { id: "other" }, identity), "unknown-sender");
  assert.equal(rejectReason({ type: "getStreamers" }, undefined, identity), "unknown-sender");
});

test("rejectReason: action sensible refusée depuis un content script", () => {
  assert.equal(rejectReason({ type: "resetPreferences" }, contentScript, identity), "not-extension-page");
  assert.equal(rejectReason({ type: "resetPreferences" }, popup, identity), null);
  assert.equal(rejectReason({ type: "trackWatchTime" }, contentScript, identity), null);
});

test("rejectReason: removeStreamer et updatePreferences autorisés depuis nos content scripts, pas depuis un inconnu", () => {
  for (const type of ["removeStreamer", "updatePreferences"]) {
    assert.equal(rejectReason({ type }, contentScript, identity), null);
    assert.equal(rejectReason({ type }, { id: "intrus", url: contentScript.url }, identity), "unknown-sender");
  }
});

test("dispatcher: refuse et répond forbidden", (t) => {
  silence(t);
  const calls = [];
  const dispatch = createMessageDispatcher({ resetPreferences: () => calls.push("x") }, () => identity);
  const responses = [];
  assert.equal(dispatch({ type: "resetPreferences" }, contentScript, (r) => responses.push(r)), false);
  assert.deepEqual(responses, [{ error: "forbidden" }]);
  assert.deepEqual(calls, []);
});

test("dispatcher: aiguille vers le handler du type", () => {
  const dispatch = createMessageDispatcher(
    { ping: (request, sender, sendResponse) => { sendResponse({ pong: request.n, tab: sender.tab?.id }); return true; } },
    () => identity,
  );
  const responses = [];
  assert.equal(dispatch({ type: "ping", n: 2 }, contentScript, (r) => responses.push(r)), true);
  assert.deepEqual(responses, [{ pong: 2, tab: 4 }]);
});

test("dispatcher: type inconnu ou hérité du prototype = pas de réponse", () => {
  const dispatch = createMessageDispatcher({}, () => identity);
  assert.equal(dispatch({ type: "nope" }, popup, () => assert.fail()), false);
  assert.equal(dispatch({ type: "toString" }, popup, () => assert.fail()), false);
  assert.equal(dispatch({ audioCommand: { action: "play" } }, popup, () => assert.fail()), false);
});

test("dispatcher: exception synchrone transformée en réponse d'erreur", (t) => {
  silence(t);
  const dispatch = createMessageDispatcher({ boom: () => { throw new Error("kaboom"); } }, () => identity);
  const responses = [];
  assert.equal(dispatch({ type: "boom" }, popup, (r) => responses.push(r)), false);
  assert.deepEqual(responses, [{ error: "kaboom" }]);
});

test("respond et reply: enveloppes de réponse", async (t) => {
  silence(t);
  const out = [];
  const push = (r) => out.push(r);
  respond(async () => ({ a: 1 }), push);
  respond(async () => { throw new Error("no"); }, push);
  reply(async () => ({ raw: true }), push);
  reply(async () => { throw new Error("bad"); }, push);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const sorted = (list) => list.map((item) => JSON.stringify(item)).sort();
  assert.deepEqual(sorted(out), sorted([{ success: true, a: 1 }, { error: "no" }, { raw: true }, { error: "bad" }]));
});
