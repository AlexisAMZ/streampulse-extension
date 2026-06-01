// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { loadPreviewModule } from "../helpers/loadScript.js";

let targets;
beforeAll(() => {
  targets = loadPreviewModule("js/previews/targets-twitch.js").targets;
});

function frag(html) {
  const host = document.createElement("div");
  host.innerHTML = html.trim();
  return host.firstElementChild;
}

describe("loginFromHref", () => {
  it("extracts the channel login from a channel path", () => {
    expect(targets.loginFromHref("/Pokimane")).toBe("pokimane");
    expect(targets.loginFromHref("https://www.twitch.tv/xQc?foo=1")).toBe("xqc");
  });
  it("ignores reserved (non-channel) paths", () => {
    expect(targets.loginFromHref("/directory/game/Just%20Chatting")).toBe("");
    expect(targets.loginFromHref("/settings/profile")).toBe("");
  });
});

describe("clipSlugFromHref", () => {
  it("reads the slug from /<channel>/clip/<slug>", () => {
    expect(targets.clipSlugFromHref("/pokimane/clip/FunnySlugName-abc123")).toBe("FunnySlugName-abc123");
  });
  it("reads the slug from a clips.twitch.tv URL and ?clip=", () => {
    expect(targets.clipSlugFromHref("https://clips.twitch.tv/CoolSlug")).toBe("CoolSlug");
    expect(targets.clipSlugFromHref("/foo?clip=QuerySlug")).toBe("QuerySlug");
  });
});

describe("extractFromAnchor — directory card", () => {
  it("returns a channel descriptor with title + category", () => {
    const card = frag(`
      <article class="tw-media-card">
        <a data-a-target="preview-card-image-link" href="/ninja"></a>
        <a data-a-target="preview-card-title-link" title="Ranked grind">Ranked grind</a>
        <a data-a-target="preview-card-game-link">Fortnite</a>
        <div class="tw-media-card-stat">42.1K viewers</div>
      </article>`);
    const anchor = card.querySelector('a[data-a-target="preview-card-image-link"]');
    const d = targets.extractFromAnchor(anchor, { hostname: "www.twitch.tv", pathname: "/directory" });
    expect(d).toMatchObject({
      kind: "channel",
      login: "ninja",
      surface: "directory",
      title: "Ranked grind",
      category: "Fortnite",
      viewers: "42.1K viewers",
    });
  });
});

describe("extractFromAnchor — sidebar card", () => {
  it("classifies as sidebar and extracts the login + avatar", () => {
    const nav = frag(`
      <nav class="side-nav">
        <div class="side-nav-card">
          <a class="side-nav-card__link" href="/xqc">
            <img class="tw-image-avatar" src="https://cdn/avatar.png" />
            <p class="side-nav-card__title" title="xQc">xQc</p>
            <div class="side-nav-card__metadata">Just Chatting</div>
          </a>
        </div>
      </nav>`);
    const anchor = nav.querySelector("a.side-nav-card__link");
    const d = targets.extractFromAnchor(anchor, { hostname: "www.twitch.tv", pathname: "/xqc" });
    expect(d).toMatchObject({
      kind: "channel",
      login: "xqc",
      surface: "sidebar",
      avatarUrl: "https://cdn/avatar.png",
      category: "Just Chatting",
    });
  });
});

describe("extractFromAnchor — clip card", () => {
  it("returns a clip descriptor", () => {
    const card = frag(`
      <article class="tw-media-card">
        <a data-a-target="preview-card-image-link" href="/pokimane/clip/SuperClip-xyz"></a>
      </article>`);
    const anchor = card.querySelector("a");
    const d = targets.extractFromAnchor(anchor, { hostname: "www.twitch.tv", pathname: "/pokimane/clips" });
    expect(d).toMatchObject({ kind: "clip", slug: "SuperClip-xyz", surface: "clips" });
  });
});

describe("extractFromAnchor — search route", () => {
  it("tags the surface as search", () => {
    const card = frag(`
      <article class="tw-media-card">
        <a data-a-target="preview-card-image-link" href="/shroud"></a>
      </article>`);
    const anchor = card.querySelector("a");
    const d = targets.extractFromAnchor(anchor, { hostname: "www.twitch.tv", pathname: "/search?term=shroud" });
    expect(d.surface).toBe("search");
    expect(d.login).toBe("shroud");
  });
});

describe("extractFromAnchor — non-channel link", () => {
  it("returns null when there is no usable login or slug", () => {
    const a = frag('<a data-a-target="preview-card-image-link" href="/directory/game/Slots"></a>');
    expect(targets.extractFromAnchor(a, { hostname: "www.twitch.tv", pathname: "/directory" })).toBeNull();
  });
});
