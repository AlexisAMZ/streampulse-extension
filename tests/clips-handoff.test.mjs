import { test } from "node:test";
import assert from "node:assert/strict";
import "../js/inject/clips-handoff.js";

const { editorUrlForClipPath, editorUrlForClip, parseClipUrl, EDITOR_ORIGIN } = globalThis.StreamPulseClipsHandoff;
const CANON = "https://www.twitch.tv/gotaga/clip/Abc-1_x";

test("clip Twitch : ouvre l'éditeur avec le lien canonique du clip", () => {
  const url = new URL(editorUrlForClipPath("/gotaga/clip/Abc-1_x"));
  assert.equal(url.origin, "https://spclips.com");
  assert.equal(url.origin, EDITOR_ORIGIN);
  assert.equal(url.pathname, "/app");
  assert.equal(url.searchParams.get("clip"), CANON);
});

test("attribution : seulement des paramètres UTM fixes, aucun secret", () => {
  const params = new URL(editorUrlForClipPath("/gotaga/clip/Abc-1_x")).searchParams;
  assert.deepEqual([...params.keys()].sort(), ["clip", "utm_campaign", "utm_medium", "utm_source"]);
  assert.equal(params.get("utm_medium"), "extension");
});

test("la fin de l'URL (barre, requête, ancre) ne change pas le clip", () => {
  assert.equal(new URL(editorUrlForClipPath("/gotaga/clip/Abc-1_x/")).searchParams.get("clip"), CANON);
});

test("pages qui ne sont pas un clip : aucun lien", () => {
  for (const path of ["/", "/gotaga", "/gotaga/videos/123", "/gotaga/clip", "/gotaga/clip/", "/clip/Abc", "/directory/clips"]) {
    assert.equal(editorUrlForClipPath(path), null, path);
  }
});

test("identifiants hors alphabet du clip refusés", () => {
  for (const path of ["/gotaga/clip/a<b", "/gotaga/clip/a%20b", "/go taga/clip/abc", "/gotaga/clip/a/b", "/../clip/abc"]) {
    assert.equal(editorUrlForClipPath(path), null, path);
  }
});

test("entrée inattendue : null, sans exception", () => {
  for (const bad of [undefined, null, 42, {}, ""]) assert.equal(editorUrlForClipPath(bad), null);
});

test("parseClipUrl et editorUrlForClip : support clips.twitch.tv et kick.com", () => {
  const twitchClips = parseClipUrl("https://clips.twitch.tv/GloriousBraveClip-xyz");
  assert.equal(twitchClips?.platform, "twitch");
  assert.equal(twitchClips?.slug, "GloriousBraveClip-xyz");

  const kickClip = parseClipUrl("https://kick.com/streamer?clip=clip_01H1234567890ABCDEF");
  assert.equal(kickClip?.platform, "kick");
  assert.equal(kickClip?.slug, "clip_01H1234567890ABCDEF");

  const kickUrl = new URL(editorUrlForClip("https://kick.com/streamer?clip=clip_01H1234567890ABCDEF", "test"));
  assert.equal(kickUrl.origin, "https://spclips.com");
  assert.equal(kickUrl.searchParams.get("utm_campaign"), "test");
});
