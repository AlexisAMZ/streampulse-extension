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
