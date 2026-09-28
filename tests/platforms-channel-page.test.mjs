import { test } from "node:test";
import assert from "node:assert/strict";
import { isChannelPageUrl } from "../js/platforms.js";

test("une page de chaîne Twitch est reconnue", () => {
  assert.equal(isChannelPageUrl("https://www.twitch.tv/gotaga"), true);
  assert.equal(isChannelPageUrl("https://twitch.tv/sardoche"), true);
  assert.equal(isChannelPageUrl("https://www.twitch.tv/xqc/video/12345"), true);
});

test("les routes Twitch système ne sont pas des chaînes", () => {
  assert.equal(isChannelPageUrl("https://www.twitch.tv/directory/category/just-chatting"), false);
  assert.equal(isChannelPageUrl("https://www.twitch.tv/settings/profile"), false);
  assert.equal(isChannelPageUrl("https://www.twitch.tv/popout/gotaga/chat"), false);
  assert.equal(isChannelPageUrl("https://www.twitch.tv/u/gotaga"), false);
});

test("une page de chaîne Kick est reconnue, les routes système non", () => {
  assert.equal(isChannelPageUrl("https://kick.com/amine"), true);
  assert.equal(isChannelPageUrl("https://kick.com/dashboard"), false);
  assert.equal(isChannelPageUrl("https://kick.com/categories/irl"), false);
});

test("la racine et les URL invalides ne sont pas des chaînes", () => {
  assert.equal(isChannelPageUrl("https://www.twitch.tv/"), false);
  assert.equal(isChannelPageUrl("https://kick.com/"), false);
  assert.equal(isChannelPageUrl("https://www.youtube.com/@MrBeast"), false);
  assert.equal(isChannelPageUrl("https://www.youtube.com/watch?v=abc"), false);
  assert.equal(isChannelPageUrl("chrome-extension://abc/popup.html"), false);
  assert.equal(isChannelPageUrl(""), false);
  assert.equal(isChannelPageUrl(null), false);
  assert.equal(isChannelPageUrl("pas une url"), false);
});

test("un login trop long ou aux caractères interdits est rejeté", () => {
  assert.equal(isChannelPageUrl("https://www.twitch.tv/" + "a".repeat(26)), false);
  assert.equal(isChannelPageUrl("https://kick.com/Quelque%20Chose"), false);
});
