import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../js/inject/quickFollowCore.js", import.meta.url), "utf8");

/** Charge le noyau dans un contexte isolé, avec un faux runtime dont on pilote les réponses. */
function load(responses) {
  const calls = [];
  const warnings = [];
  const runtime = {
    lastError: undefined,
    sendMessage(message, callback) {
      calls.push(message);
      const next = responses.shift();
      runtime.lastError = next.error ? { message: next.error } : undefined;
      callback(next.res);
      runtime.lastError = undefined;
    },
  };
  const window = {};
  vm.runInNewContext(source, {
    window,
    chrome: { runtime },
    console: { warn: (...args) => warnings.push(args.join(" ")), log() {} },
    setTimeout: (fn) => fn(),
    document: {},
  });
  return { send: window.__SP_QF__.send, calls, warnings };
}

test("send renvoie la réponse du service worker", async () => {
  const { send, calls } = load([{ res: { success: true } }]);
  assert.deepEqual(await send({ type: "addStreamer" }), { success: true });
  assert.equal(calls.length, 1);
});

test("service worker pas encore prêt : le message est renvoyé puis passe", async () => {
  const { send, calls, warnings } = load([
    { error: "Could not establish connection. Receiving end does not exist." },
    { res: { success: true } },
  ]);
  assert.deepEqual(await send({ type: "addStreamer" }), { success: true });
  assert.equal(calls.length, 2);
  assert.equal(warnings.length, 1);
});

test("jamais plus de trois envois, puis null", async () => {
  const gone = { error: "Receiving end does not exist." };
  const { send, calls } = load([gone, gone, gone, gone]);
  assert.equal(await send({ type: "addStreamer" }), null);
  assert.equal(calls.length, 3);
});

test("port fermé sans réponse : pas de renvoi (l'ajout a peut-être eu lieu), le motif est journalisé", async () => {
  const { send, calls, warnings } = load([{ error: "The message port closed before a response was received." }]);
  assert.equal(await send({ type: "addStreamer" }), null);
  assert.equal(calls.length, 1);
  assert.match(warnings[0], /port closed/);
});
