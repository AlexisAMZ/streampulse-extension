import { test } from "node:test";
import assert from "node:assert/strict";
import { kickLoginFromUser, youtubeChannelIdFromAccountHtml, youtubeHandleFromChannelHtml } from "../js/account-logins-parse.js";

test("Kick : le slug de la chaîne prime, sinon le nom d'utilisateur", () => {
  assert.equal(kickLoginFromUser({ username: "Le Streamer", streamer_channel: { slug: "le-streamer" } }), "le-streamer");
  assert.equal(kickLoginFromUser({ username: "Amine" }), "amine");
});

test("Kick : réponse inexploitable, chaîne vide", () => {
  assert.equal(kickLoginFromUser(null), "");
  assert.equal(kickLoginFromUser({ id: 5 }), "");
  assert.equal(kickLoginFromUser({ username: "!!" }), "");
});

const ACCOUNT_HTML = '"LOGGED_IN":true,... "channelOptionsRenderer":{"avatar":{},"avatarEndpoint":{"urlEndpoint":{"url":"http://www.youtube.com/channel/UCabcdefghijklmnopqrstuv"}},"name":"Moi"}';

test("YouTube : l'ID de la chaîne du compte connecté, lu dans la page compte", () => {
  assert.equal(youtubeChannelIdFromAccountHtml(ACCOUNT_HTML), "UCabcdefghijklmnopqrstuv");
});

test("YouTube : déconnecté ou sans bloc chaîne, chaîne vide", () => {
  assert.equal(youtubeChannelIdFromAccountHtml(ACCOUNT_HTML.replace("true", "false")), "");
  assert.equal(youtubeChannelIdFromAccountHtml('"LOGGED_IN":true,"channel/UCzzzzzzzzzzzzzzzzzzzzzz"'), "");
  assert.equal(youtubeChannelIdFromAccountHtml(""), "");
  assert.equal(youtubeChannelIdFromAccountHtml(undefined), "");
});

test("YouTube : le @handle vient du lien canonique de la page de la chaîne", () => {
  const html = '<link rel="canonical" href="https://www.youtube.com/@MonCanal">';
  assert.equal(youtubeHandleFromChannelHtml(html), "moncanal");
  assert.equal(youtubeHandleFromChannelHtml('<link rel="canonical" href="https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv">'), "");
  assert.equal(youtubeHandleFromChannelHtml(""), "");
});
