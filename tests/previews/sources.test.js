import { describe, it, expect } from "vitest";
import { loadPreviewModule } from "../helpers/loadScript.js";

const { sources } = loadPreviewModule("js/previews/sources.js");

describe("sources.SIZE_PRESETS", () => {
  it("exposes s/m/l 16:9 presets", () => {
    expect(sources.SIZE_PRESETS.s).toEqual({ width: 280, height: 157 });
    expect(sources.SIZE_PRESETS.m).toEqual({ width: 360, height: 202 });
    expect(sources.SIZE_PRESETS.l).toEqual({ width: 440, height: 247 });
  });
});

describe("sources.twitchPreviewImageUrl", () => {
  it("builds a static-cdn preview URL with the given size", () => {
    expect(sources.twitchPreviewImageUrl("Pokimane", 360, 202)).toBe(
      "https://static-cdn.jtvnw.net/previews-ttv/live_user_pokimane-360x202.jpg"
    );
  });

  it("lowercases the login and appends a cache-bust when provided", () => {
    expect(sources.twitchPreviewImageUrl("XQc", 280, 157, 12345)).toBe(
      "https://static-cdn.jtvnw.net/previews-ttv/live_user_xqc-280x157.jpg?cb=12345"
    );
  });

  it("falls back to the M preset when size is missing", () => {
    expect(sources.twitchPreviewImageUrl("a")).toBe(
      "https://static-cdn.jtvnw.net/previews-ttv/live_user_a-360x202.jpg"
    );
  });

  it("strips unexpected characters from the login", () => {
    expect(sources.twitchPreviewImageUrl("  Bad Name! ", 280, 157)).toBe(
      "https://static-cdn.jtvnw.net/previews-ttv/live_user_badname-280x157.jpg"
    );
  });
});

describe("sources.twitchPlayerEmbedUrl", () => {
  it("includes channel, default parent twitch.tv, muted + autoplay", () => {
    const url = new URL(sources.twitchPlayerEmbedUrl("Ninja"));
    expect(url.origin + url.pathname).toBe("https://player.twitch.tv/");
    expect(url.searchParams.get("channel")).toBe("ninja");
    expect(url.searchParams.get("parent")).toBe("twitch.tv");
    expect(url.searchParams.get("muted")).toBe("true");
    expect(url.searchParams.get("autoplay")).toBe("true");
  });

  it("honors a custom parent and unmuted audio", () => {
    const url = new URL(
      sources.twitchPlayerEmbedUrl("ninja", { parent: "www.twitch.tv", muted: false })
    );
    expect(url.searchParams.get("parent")).toBe("www.twitch.tv");
    expect(url.searchParams.get("muted")).toBe("false");
  });
});

describe("sources.clipEmbedUrl", () => {
  it("builds a clips embed URL with parent + autoplay + muted", () => {
    const url = new URL(
      sources.clipEmbedUrl("AwkwardHelplessSalamanderSwiftRage", { parent: "clips.twitch.tv" })
    );
    expect(url.origin + url.pathname).toBe("https://clips.twitch.tv/embed");
    expect(url.searchParams.get("clip")).toBe("AwkwardHelplessSalamanderSwiftRage");
    expect(url.searchParams.get("parent")).toBe("clips.twitch.tv");
    expect(url.searchParams.get("autoplay")).toBe("true");
    expect(url.searchParams.get("muted")).toBe("true");
  });
});
