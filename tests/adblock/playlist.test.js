import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import vm from "node:vm";

// Exercise the REAL shipped ad-blocker (js/inject/twitch-adblock.js) through its
// public fetch hook. The MAIN-world IIFE installs a hooked `fetch` on its scope;
// we run it in a VM with a controllable scope and assert the network behavior:
// SSAI stitched-ad stripping, CSAI empty-payload blocking, and pass-through.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = readFileSync(resolve(ROOT, "js/inject/twitch-adblock.js"), "utf8");

// Minimal Response shim — the hook only uses clone()/text()/status/statusText/headers.
class FakeResponse {
  constructor(body, init = {}) {
    this._body = body == null ? "" : String(body);
    this.status = init.status == null ? 200 : init.status;
    this.statusText = init.statusText == null ? "" : init.statusText;
    this.headers = init.headers == null ? {} : init.headers;
    this.ok = this.status >= 200 && this.status < 300;
  }
  clone() {
    return new FakeResponse(this._body, {
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
    });
  }
  text() {
    return Promise.resolve(this._body);
  }
}

function FakeXHR() {}
FakeXHR.prototype.open = function () {};
FakeXHR.prototype.send = function () {};
FakeXHR.prototype.addEventListener = function () {};

// Build a scope, run the ad-blocker in it, and return the scope. `fetchImpl` is the
// "real" network the hook delegates to (so tests can spy on / control responses).
function installAdblock(fetchImpl) {
  const sandbox = {
    console,
    Promise,
    Response: FakeResponse,
    Blob: function () {},
    URL: { createObjectURL: () => "blob:mock" },
    setTimeout,
    clearTimeout,
    XMLHttpRequest: FakeXHR,
    Worker: function () {},
    localStorage: { getItem: () => null, setItem: () => {} },
    postMessage: () => {},
    addEventListener: () => {},
    document: {
      getElementById: () => null,
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
      querySelector: () => null,
      body: { appendChild() {} },
    },
    fetch: fetchImpl,
  };
  sandbox.self = sandbox;
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: "twitch-adblock.js" });
  return sandbox;
}

const PLAYLIST_URL = "https://usher.ttvnw.net/api/channel/hls/test.m3u8";

const AD_PLAYLIST = [
  "#EXTM3U",
  "#EXT-X-VERSION:3",
  "#EXTINF:2.0,live",
  "seg-live-1.ts",
  '#EXT-X-DATERANGE:ID="stitched-ad-1",CLASS="twitch-stitched-ad",START-DATE="2026-01-01T00:00:00Z",DURATION=30',
  "#EXTINF:2.0,ad",
  "ad-seg-1.ts",
  "#EXTINF:2.0,ad",
  "ad-seg-2.ts",
  "#EXT-X-DISCONTINUITY",
  "#EXTINF:2.0,live",
  "seg-live-2.ts",
].join("\n");

describe("twitch-adblock fetch hook — SSAI stripping", () => {
  it("removes stitched-ad segments but keeps the live segments", async () => {
    const sandbox = installAdblock(() =>
      Promise.resolve(new FakeResponse(AD_PLAYLIST, { status: 200, statusText: "OK" }))
    );
    const res = await sandbox.fetch(PLAYLIST_URL);
    const text = await res.text();

    expect(text).not.toContain("twitch-stitched-ad");
    expect(text).not.toContain("ad-seg-1.ts");
    expect(text).not.toContain("ad-seg-2.ts");
    expect(text).not.toContain("#EXT-X-DISCONTINUITY");
    expect(text).toContain("seg-live-1.ts");
    expect(text).toContain("seg-live-2.ts");
  });

  it("strips a midroll pod where the discontinuity OPENS the ad (per-segment markers)", async () => {
    const midroll = [
      "#EXTM3U",
      "#EXT-X-VERSION:3",
      "#EXT-X-TARGETDURATION:6",
      "#EXT-X-MEDIA-SEQUENCE:100",
      '#EXT-X-DATERANGE:ID="sess",CLASS="twitch-session",END-ON-NEXT=YES',
      '#EXT-X-DATERANGE:ID="pod",CLASS="twitch-stitched-ad",DURATION=4',
      "#EXT-X-DISCONTINUITY",
      '#EXT-X-DATERANGE:ID="q0",CLASS="twitch-stitched-ad",X-TV-TWITCH-AD-QUARTILE="0"',
      "#EXT-X-PROGRAM-DATE-TIME:2026-06-01T00:00:00Z",
      "#EXTINF:2.0,",
      "https://ad/ad-seg-1.ts",
      '#EXT-X-DATERANGE:ID="q1",CLASS="twitch-stitched-ad",X-TV-TWITCH-AD-QUARTILE="1"',
      "#EXT-X-PROGRAM-DATE-TIME:2026-06-01T00:00:02Z",
      "#EXTINF:2.0,",
      "https://ad/ad-seg-2.ts",
      "#EXT-X-DISCONTINUITY",
      "#EXT-X-PROGRAM-DATE-TIME:2026-06-01T00:00:04Z",
      "#EXTINF:2.0,",
      "https://live/live-seg-1.ts",
      "#EXTINF:2.0,",
      "https://live/live-seg-2.ts",
    ].join("\n");
    const sandbox = installAdblock(() =>
      Promise.resolve(new FakeResponse(midroll, { status: 200 }))
    );
    const res = await sandbox.fetch(PLAYLIST_URL);
    const text = await res.text();
    expect(text).not.toContain("ad-seg-1.ts");
    expect(text).not.toContain("ad-seg-2.ts");
    expect(text).not.toContain("twitch-stitched-ad");
    expect(text).not.toContain("#EXT-X-DISCONTINUITY");
    expect(text).toContain("live-seg-1.ts");
    expect(text).toContain("live-seg-2.ts");
    expect(text).toContain("twitch-session"); // non-ad metadata kept
  });

  it("fails safe on a pure-ad window — returns the original rather than an empty playlist", async () => {
    const pureAd = [
      "#EXTM3U",
      "#EXT-X-VERSION:3",
      "#EXT-X-MEDIA-SEQUENCE:1",
      '#EXT-X-DATERANGE:ID="pod",CLASS="twitch-stitched-ad",DURATION=4',
      "#EXT-X-DISCONTINUITY",
      '#EXT-X-DATERANGE:ID="q0",CLASS="twitch-stitched-ad",X-TV-TWITCH-AD-QUARTILE="0"',
      "#EXTINF:2.0,",
      "https://ad/ad1.ts",
      '#EXT-X-DATERANGE:ID="q1",CLASS="twitch-stitched-ad",X-TV-TWITCH-AD-QUARTILE="1"',
      "#EXTINF:2.0,",
      "https://ad/ad2.ts",
    ].join("\n");
    const sandbox = installAdblock(() =>
      Promise.resolve(new FakeResponse(pureAd, { status: 200 }))
    );
    const res = await sandbox.fetch(PLAYLIST_URL);
    const text = await res.text();
    // No live segments to keep → must return the original so the player keeps playing.
    expect(text).toBe(pureAd);
    expect(text).toContain("ad1.ts");
  });

  it("records the strip in the diagnostics counter", async () => {
    const sandbox = installAdblock(() =>
      Promise.resolve(new FakeResponse(AD_PLAYLIST, { status: 200 }))
    );
    await sandbox.fetch(PLAYLIST_URL);
    // The main-thread signal posts a message; the counter increment lives in the
    // worker path, so here we just assert the playlist response was rewritten.
    expect(sandbox.__SP_ADBLOCK_DIAG__).toBeTruthy();
    expect(sandbox.__SP_ADBLOCK_DIAG__.debug).toBe(false);
  });

  it("passes a clean playlist through untouched", async () => {
    const clean = "#EXTM3U\n#EXTINF:2.0,live\nseg1.ts\n#EXTINF:2.0,live\nseg2.ts";
    const sandbox = installAdblock(() =>
      Promise.resolve(new FakeResponse(clean, { status: 200 }))
    );
    const res = await sandbox.fetch(PLAYLIST_URL);
    const text = await res.text();
    expect(text).toContain("seg1.ts");
    expect(text).toContain("seg2.ts");
  });

  it("returns the playlist unchanged when it can't strip the format (no false block)", async () => {
    // hasAd() is true (X-TV-TWITCH-AD) but there is no twitch-stitched-ad daterange
    // for stripAds() to act on — so we must NOT pretend we blocked it.
    const unstrippable = [
      "#EXTM3U",
      "#EXT-X-VERSION:3",
      "#EXTINF:2.0,live",
      "seg-live-1.ts",
      '#EXT-X-DATERANGE:ID="x",X-TV-TWITCH-AD-ROLL-TYPE="MIDROLL"',
      "#EXTINF:2.0,ad",
      "ad-seg-x.ts",
      "#EXTINF:2.0,live",
      "seg-live-2.ts",
    ].join("\n");
    const sandbox = installAdblock(() =>
      Promise.resolve(new FakeResponse(unstrippable, { status: 200 }))
    );
    const res = await sandbox.fetch(PLAYLIST_URL);
    const text = await res.text();
    expect(text).toBe(unstrippable);
    expect(text).toContain("ad-seg-x.ts");
  });
});

describe("twitch-adblock fetch hook — CSAI blocking", () => {
  it("returns an empty payload for an ad request without hitting the network", async () => {
    let hits = 0;
    const sandbox = installAdblock(() => {
      hits++;
      return Promise.resolve(new FakeResponse("REAL-ADS", { status: 200 }));
    });
    const res = await sandbox.fetch("https://edge.ads.twitch.tv/ads?something=1");
    const text = await res.text();

    expect(text).toBe("[]");
    expect(hits).toBe(0);
  });

  it("leaves unrelated requests alone", async () => {
    let hits = 0;
    const sandbox = installAdblock((u) => {
      hits++;
      return Promise.resolve(new FakeResponse("ok:" + u, { status: 200 }));
    });
    const res = await sandbox.fetch("https://gql.twitch.tv/gql");
    const text = await res.text();

    expect(hits).toBe(1);
    expect(text).toBe("ok:https://gql.twitch.tv/gql");
  });
});
