import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const SOURCE = await readFile(new URL("../js/inject/clipboard-tap.js", import.meta.url), "utf8");

/** Exécute le script dans une page factice et renvoie ce qu'il relaie. */
function load() {
  const relayed = [];
  const written = [];
  class Clipboard {
    async writeText(text) { written.push(text); }
  }
  const listeners = {};
  const window = {
    getSelection: () => "",
    dispatchEvent: (event) => relayed.push(event.detail),
  };
  const context = {
    window, Clipboard,
    document: { addEventListener: (type, fn) => { listeners[type] = fn; } },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
  };
  context.window.window = window;
  vm.runInNewContext(SOURCE, context);
  return { clip: new Clipboard(), relayed, written, window, listeners };
}

test("un lien de clip copié par Twitch est relayé, et la copie a bien lieu", async () => {
  const { clip, relayed, written } = load();
  await clip.writeText("https://www.twitch.tv/jltomy/clip/TenaciousHungryBearRuleFive-9LH6RtxFnZJ05euK");
  await clip.writeText("https://clips.twitch.tv/AbCd-123_x");
  assert.deepEqual(relayed, ["https://www.twitch.tv/jltomy/clip/TenaciousHungryBearRuleFive-9LH6RtxFnZJ05euK", "https://clips.twitch.tv/AbCd-123_x"]);
  assert.equal(written.length, 2);
});

test("tout autre texte copié reste ignoré : rien ne sort", async () => {
  const { clip, relayed, written } = load();
  await clip.writeText("mon mot de passe");
  await clip.writeText("https://example.com/clip/abc");
  await clip.writeText("https://www.twitch.tv/jltomy");
  assert.deepEqual(relayed, []);
  assert.equal(written.length, 3, "la copie de la page n'est jamais bloquée");
});

test("copie par sélection : même filtre", () => {
  const { relayed, window, listeners } = load();
  window.getSelection = () => "https://clips.twitch.tv/Slug-1";
  listeners.copy();
  window.getSelection = () => "texte quelconque";
  listeners.copy();
  assert.deepEqual(relayed, ["https://clips.twitch.tv/Slug-1"]);
});
