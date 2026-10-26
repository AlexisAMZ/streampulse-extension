import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../js/inject/preventPause.js", import.meta.url), "utf8");
const FLAG = "streampulse:keepQualityInBackground";
const EVENT = "streampulse:keep-playing-changed";

/** Page Twitch cachée, avec un localStorage et des écouteurs d'événements simulés. */
function load({ flag = false } = {}) {
  const store = new Map(flag ? [[FLAG, "1"]] : []);
  class Document {}
  Object.defineProperties(Document.prototype, {
    hidden: { get: () => true, configurable: true },
    webkitHidden: { get: () => true, configurable: true },
    visibilityState: { get: () => "hidden", configurable: true },
    webkitVisibilityState: { get: () => "hidden", configurable: true },
  });
  Document.prototype.hasFocus = () => false;
  const listeners = [];
  const doc = Object.create(Document.prototype);
  doc.addEventListener = (type, fn) => listeners.push({ type, fn });
  const window = {
    localStorage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: (key) => store.delete(key) },
    addEventListener: (type, fn) => listeners.push({ type, fn }),
  };
  window.window = window;
  vm.runInNewContext(source, { window, document: doc, Document, console });
  const fire = (type, event = {}) => {
    let stopped = false;
    for (const entry of listeners.filter((item) => item.type === type)) {
      entry.fn({ ...event, stopImmediatePropagation: () => { stopped = true; } });
    }
    return stopped;
  };
  return { doc, store, window, fire };
}

test("réglage coupé au chargement : Twitch garde son comportement d'origine", () => {
  const { doc } = load();
  assert.equal(doc.hidden, true);
  assert.equal(doc.visibilityState, "hidden");
});

test("réglage actif au chargement : la page paraît toujours visible", () => {
  const { doc, fire } = load({ flag: true });
  assert.equal(doc.hidden, false);
  assert.equal(doc.visibilityState, "visible");
  assert.equal(doc.hasFocus(), true);
  assert.equal(fire("visibilitychange"), true, "le signal de visibilité est avalé");
});

test("activer le réglage prend effet tout de suite, sans recharger la page", () => {
  const { doc, store, fire } = load();
  assert.equal(doc.hidden, true);
  store.set(FLAG, "1");
  fire(EVENT);
  assert.equal(doc.hidden, false);
  assert.equal(doc.visibilityState, "visible");
  assert.equal(fire("visibilitychange"), true);
});

test("couper le réglage rend aussitôt son comportement à Twitch", () => {
  const { doc, store, fire } = load({ flag: true });
  assert.equal(doc.hidden, false);
  store.delete(FLAG);
  fire(EVENT);
  assert.equal(doc.hidden, true);
  assert.equal(doc.visibilityState, "hidden");
  assert.equal(doc.hasFocus(), false);
  assert.equal(fire("visibilitychange"), false, "le signal passe de nouveau");
});

test("activer deux fois de suite ne pose rien en double et n'écrase pas l'original", () => {
  const { doc, store, fire } = load();
  store.set(FLAG, "1");
  fire(EVENT);
  fire(EVENT);
  store.delete(FLAG);
  fire(EVENT);
  assert.equal(doc.hidden, true, "l'original d'avant la première activation est bien restauré");
});

test("le blur de la fenêtre n'est avalé que lorsque le réglage est actif", () => {
  const { window, store, fire } = load({ flag: true });
  assert.equal(fire("blur", { target: window }), true);
  assert.equal(fire("blur", { target: {} }), false);
  store.delete(FLAG);
  fire(EVENT);
  assert.equal(fire("blur", { target: window }), false);
});
