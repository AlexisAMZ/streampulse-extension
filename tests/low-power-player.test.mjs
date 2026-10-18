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

/**
 * Lance le script et exécute `ticks` passages de sa boucle (le premier est
 * immédiat, les suivants sont ceux replanifiés par setTimeout/setInterval).
 */
function run(page, { ticks = 1 } = {}) {
  const saved = { document: globalThis.document, setTimeout: globalThis.setTimeout, setInterval: globalThis.setInterval };
  const scheduled = [];
  globalThis.document = page.document;
  globalThis.setTimeout = (fn) => (scheduled.push(fn), 0);
  globalThis.setInterval = (fn) => (scheduled.push(fn), 0);
  try {
    lowPowerPlayer();
    for (let index = 1; index < ticks; index += 1) scheduled[index - 1]?.();
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

test("la qualité n'est réappliquée que si le lecteur n'y est déjà pas : chaque setQuality fige le flux", () => {
  const calls = [];
  const qualities = [{ group: "1080p60", height: 1080, bitrate: 8000 }, { group: "360p30", height: 360, bitrate: 800 }];
  const player = {
    active: qualities[0],
    auto: true,
    getQualities: () => qualities,
    getQuality() { return this.active; },
    setQuality(quality) { calls.push(["quality", quality.group]); this.active = quality; },
    isAutoQualityMode() { return this.auto; },
    setAutoQualityMode(value) { calls.push(["auto", value]); this.auto = value; },
    getVolume: () => 0.5,
    isMuted: () => false,
  };
  const root = { "__reactFiber$x": { memoizedProps: { mediaPlayerInstance: player }, return: null } };
  const video = { muted: true, volume: 0, paused: false };
  const document = {
    querySelector: (selector) => (selector === "video" ? video : root),
    querySelectorAll: () => [],
  };
  run({ document }, { ticks: 3 });
  assert.deepEqual(calls.filter(([kind]) => kind === "quality"), [["quality", "360p30"]]);
  assert.deepEqual(calls.filter(([kind]) => kind === "auto"), [["auto", false]]);
});

test("l'ancien nom d'API setAutoSwitchQuality est utilisé en repli quand setAutoQualityMode n'existe plus", () => {
  const page = fakePage({ volume: 0, muted: true });
  const calls = [];
  page.player.setAutoQualityMode = undefined;
  page.player.setAutoSwitchQuality = (value) => calls.push(["auto", value]);
  run(page, { ticks: 2 });
  assert.deepEqual(calls, [["auto", false]]);
});

test("un lecteur figé repart par player.play() — Twitch a retiré paused() de son API", () => {
  const calls = [];
  const video = { muted: true, volume: 0, paused: true };
  const player = {
    getQualities: () => [{ height: 360, bitrate: 800 }],
    setQuality: () => {},
    getVolume() { return this.volume; },
    setVolume(value) { this.volume = value; },
    isMuted() { return this.muted; },
    setMuted(value) { this.muted = value; },
    volume: 0,
    muted: true,
    play() { calls.push(["play", video.muted]); video.paused = false; },
  };
  assert.equal(typeof player.paused, "undefined"); // la forme actuelle de l'API Twitch
  const root = { "__reactFiber$x": { memoizedProps: { mediaPlayerInstance: player }, return: null } };
  const document = {
    querySelector: (selector) => (selector === "video" ? video : root),
    querySelectorAll: () => [],
  };
  run({ document }, { ticks: 2 });
  // Reprise pendant que c'est encore muet (Chrome l'autorise toujours), une seule fois.
  assert.deepEqual(calls, [["play", true]]);
  assert.equal(video.paused, false);
  assert.equal(video.muted, false);
  assert.equal(video.volume, 0.02);
});
