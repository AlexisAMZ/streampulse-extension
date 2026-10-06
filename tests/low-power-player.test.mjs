import test from "node:test";
import assert from "node:assert/strict";
import { lowPowerPlayer } from "../js/sw/low-power-player.js";

/** Faux lecteur Twitch trouvé dans l'arbre React, et faux <video>. */
function fakePage({ volume = 0, muted = true } = {}) {
  const calls = [];
  const player = {
    volume,
    muted,
    getQualities: () => [{ height: 720, bitrate: 3000 }, { height: 360, bitrate: 800 }],
    setAutoSwitchQuality: () => {},
    setQuality: (quality) => calls.push(["quality", quality.height]),
    getVolume() { return this.volume; },
    setVolume(value) { this.volume = value; calls.push(["volume", value]); },
    isMuted() { return this.muted; },
    setMuted(value) { this.muted = value; calls.push(["muted", value]); },
    paused: () => false,
  };
  const root = { "__reactFiber$x": { memoizedProps: { mediaPlayerInstance: { core: player } }, return: null } };
  const video = { muted: true, volume: 0 };
  const document = {
    querySelector: (selector) => (selector === "video" ? video : root),
    querySelectorAll: () => [],
  };
  return { player, video, calls, document };
}

function run(page) {
  const saved = { document: globalThis.document, setTimeout: globalThis.setTimeout, setInterval: globalThis.setInterval };
  globalThis.document = page.document;
  globalThis.setTimeout = () => 0;
  globalThis.setInterval = () => 0;
  try {
    lowPowerPlayer();
  } finally {
    Object.assign(globalThis, saved);
  }
}

test("mode auto : le lecteur n'est jamais muet ni à 0 %, l'onglet seul porte le silence", () => {
  const page = fakePage({ volume: 0, muted: true });
  run(page);
  assert.equal(page.player.volume, 0.02);
  assert.equal(page.player.muted, false);
  assert.deepEqual([page.video.muted, page.video.volume], [false, 0.02]);
  assert.ok(page.calls.some(([kind, value]) => kind === "quality" && value === 360));
});

test("un volume déjà d'au moins 1 % est laissé tel quel", () => {
  const page = fakePage({ volume: 0.3, muted: false });
  run(page);
  assert.equal(page.player.volume, 0.3);
  assert.ok(!page.calls.some(([kind]) => kind === "volume" || kind === "muted"));
});
