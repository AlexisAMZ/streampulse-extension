import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createFakeChrome } from "./helpers/fake-chrome.mjs";

// config.js n'est pas versionné (.gitignore) : sans lui, le SW ne se charge pas.
const skip = fs.existsSync(new URL("../config.js", import.meta.url)) ? false : "config.js absent (non versionné)";

let keepChannelTabLoaded;
let onPreferencesChangedForTabDiscard;
let updates;
let tabsToUnmark;

before(async () => {
  if (skip) return;
  globalThis.chrome = createFakeChrome();
  globalThis.self = globalThis;
  ({ keepChannelTabLoaded, onPreferencesChangedForTabDiscard } = await import("../js/sw/tab-discard.js"));
});

function setup(preferences) {
  updates = [];
  tabsToUnmark = [];
  globalThis.chrome.storage.local.get = async () => ({ betaGeneralPreferences: preferences });
  globalThis.chrome.tabs.update = async (id, patch) => { updates.push({ id, ...patch }); };
  globalThis.chrome.tabs.query = async () => tabsToUnmark;
}

const channel = { url: "https://www.twitch.tv/zabuza", autoDiscardable: true };

test("réglage actif : la page d'une chaîne n'est jamais déchargée par le navigateur", { skip }, async () => {
  setup({ preventTabDiscard: true });
  onPreferencesChangedForTabDiscard({ betaGeneralPreferences: { newValue: { preventTabDiscard: true } } }, "local");
  await keepChannelTabLoaded(7, {}, channel);
  assert.deepEqual(updates, [{ id: 7, autoDiscardable: false }]);
});

test("une page qui n'est pas une chaîne (répertoire, réglages) reste déchargeable", { skip }, async () => {
  setup({ preventTabDiscard: true });
  onPreferencesChangedForTabDiscard({ betaGeneralPreferences: { newValue: { preventTabDiscard: true } } }, "local");
  await keepChannelTabLoaded(7, {}, { url: "https://www.twitch.tv/directory", autoDiscardable: true });
  assert.deepEqual(updates, []);
});

test("réglage coupé : aucune page n'est protégée, et les onglets déjà marqués sont rendus au navigateur", { skip }, async () => {
  setup({ preventTabDiscard: false });
  onPreferencesChangedForTabDiscard({ betaGeneralPreferences: { newValue: { preventTabDiscard: true } } }, "local");
  tabsToUnmark = [{ id: 3, url: "https://www.twitch.tv/zabuza" }, { id: 4, url: "https://example.com/" }];
  onPreferencesChangedForTabDiscard({ betaGeneralPreferences: { newValue: { preventTabDiscard: false } } }, "local");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(updates, [{ id: 3, autoDiscardable: true }]);
  updates.length = 0;
  await keepChannelTabLoaded(7, {}, channel);
  assert.deepEqual(updates, []);
});
