import { describe, it, expect } from "vitest";
import { loadPreviewModule } from "../helpers/loadScript.js";

const { stream } = loadPreviewModule("js/previews/stream.js");

const MASTER = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=1920x1080,VIDEO="chunked"
https://video/1080.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=600000,RESOLUTION=1280x720,VIDEO="720p60"
https://video/720.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=300000,RESOLUTION=852x480,VIDEO="480p30"
https://video/480.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=150000,RESOLUTION=640x360,VIDEO="360p30"
https://video/360.m3u8`;

describe("stream.accessTokenRequest", () => {
  it("builds the PlaybackAccessToken persisted query for a live login", () => {
    const req = stream.accessTokenRequest("XQc");
    expect(req.operationName).toBe("PlaybackAccessToken");
    expect(req.extensions.persistedQuery.sha256Hash).toMatch(/^[0-9a-f]{64}$/);
    expect(req.variables).toMatchObject({ isLive: true, login: "xqc", isVod: false });
  });
});

describe("stream.usherUrl", () => {
  it("builds the usher m3u8 URL with token + sig + flags", () => {
    const url = new URL(stream.usherUrl("Ninja", "TOK.value", "SIGN", { p: 42 }));
    expect(url.hostname).toBe("usher.ttvnw.net");
    expect(url.pathname).toBe("/api/channel/hls/ninja.m3u8");
    expect(url.searchParams.get("token")).toBe("TOK.value");
    expect(url.searchParams.get("sig")).toBe("SIGN");
    expect(url.searchParams.get("allow_source")).toBe("true");
    expect(url.searchParams.get("client_id")).toBe(stream.CLIENT_ID);
    expect(url.searchParams.get("p")).toBe("42");
  });
});

describe("stream.proxyMasterUrl", () => {
  it("joins the proxy base + channel, stripping a trailing slash and lowercasing", () => {
    expect(stream.proxyMasterUrl("https://lb-eu.cdn-perfprod.com/live", "XQc")).toBe(
      "https://lb-eu.cdn-perfprod.com/live/xqc"
    );
    expect(stream.proxyMasterUrl("https://p/live/", "Ninja")).toBe("https://p/live/ninja");
  });

  it("ships a non-empty default proxy list", () => {
    expect(Array.isArray(stream.PROXY_BASES)).toBe(true);
    expect(stream.PROXY_BASES.length).toBeGreaterThan(0);
  });
});

describe("stream.hasAd", () => {
  it("detects a Twitch stitched-ad break", () => {
    const ad = [
      "#EXTINF:2.0,live",
      "seg1.ts",
      '#EXT-X-DATERANGE:ID="stitched-ad-1",CLASS="twitch-stitched-ad",START-DATE="x"',
      "seg2.ts",
    ].join("\n");
    expect(stream.hasAd(ad)).toBe(true);
  });

  it("returns false for a normal live playlist or empty input", () => {
    expect(stream.hasAd("#EXTINF:2.0,live\nseg1.ts\nseg2.ts")).toBe(false);
    expect(stream.hasAd("")).toBe(false);
  });
});

describe("stream.pickVariant", () => {
  it("returns the highest variant at or below the cap", () => {
    expect(stream.pickVariant(MASTER, 480)).toBe("https://video/480.m3u8");
    expect(stream.pickVariant(MASTER, 720)).toBe("https://video/720.m3u8");
    expect(stream.pickVariant(MASTER, 360)).toBe("https://video/360.m3u8");
  });

  it("falls back to the lowest variant when none fit under the cap", () => {
    const onlyHigh = `#EXTM3U
#EXT-X-STREAM-INF:RESOLUTION=1920x1080
https://video/1080.m3u8
#EXT-X-STREAM-INF:RESOLUTION=1280x720
https://video/720.m3u8`;
    expect(stream.pickVariant(onlyHigh, 480)).toBe("https://video/720.m3u8");
  });

  it("returns null for empty or non-playlist input", () => {
    expect(stream.pickVariant("", 480)).toBeNull();
    expect(stream.pickVariant("not a playlist", 480)).toBeNull();
  });
});
