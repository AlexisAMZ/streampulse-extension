import test from "node:test";
import assert from "node:assert/strict";
import {
  chzzkThumbnail, isChzzkChannelId, parseChzzkInput, parseChzzkLive, pickChzzkChannel, chzzkChannelUrl, chzzkLiveUrl,
} from "../js/chzzk.js";

const ID = "bb382c2c0cc9fa7c86ab3b037fb5799c";

test("identifiant de chaîne : 32 caractères hexadécimaux", () => {
  assert.equal(isChzzkChannelId(ID), true);
  assert.equal(isChzzkChannelId(ID.toUpperCase()), true);
  for (const bad of ["", "abc", `${ID}0`, "zz382c2c0cc9fa7c86ab3b037fb5799c", null, undefined]) assert.equal(isChzzkChannelId(bad), false);
});

test("saisie : identifiant, lien de chaîne ou de live, sinon un nom", () => {
  assert.deepEqual(parseChzzkInput(ID), { id: ID });
  assert.deepEqual(parseChzzkInput(ID.toUpperCase()), { id: ID });
  assert.deepEqual(parseChzzkInput(`https://chzzk.naver.com/${ID}`), { id: ID });
  assert.deepEqual(parseChzzkInput(`https://chzzk.naver.com/live/${ID}?x=1`), { id: ID });
  assert.deepEqual(parseChzzkInput("  @침착맨 "), { name: "침착맨" });
  assert.deepEqual(parseChzzkInput("Nom Avec Espaces"), { name: "Nom Avec Espaces" });
});

test("saisie : vide ou inutilisable", () => {
  for (const bad of ["", "   ", "@", null, undefined, 42, "\u0000\u0007"]) assert.equal(parseChzzkInput(bad), null);
  assert.equal(parseChzzkInput("x".repeat(200)).name.length, 40);
});

test("recherche : seule une correspondance exacte du nom est acceptée", () => {
  const response = {
    code: 200,
    content: { data: [
      { channel: { channelId: "a".repeat(32), channelName: "침착맨 팬", channelImageUrl: "https://nng-phinf.pstatic.net/a.png", followerCount: 5 } },
      { channel: { channelId: ID, channelName: "침착맨", channelImageUrl: "https://nng-phinf.pstatic.net/b.png", followerCount: 330362, openLive: false } },
    ] },
  };
  const channel = pickChzzkChannel(response, " 침착맨 ");
  assert.equal(channel.id, ID);
  assert.equal(channel.name, "침착맨");
  assert.equal(channel.avatar, "https://nng-phinf.pstatic.net/b.png");
  assert.equal(pickChzzkChannel(response, "침착"), null);
  assert.equal(pickChzzkChannel({ content: { data: [] } }, "x"), null);
  assert.equal(pickChzzkChannel(null, "x"), null);
});

test("recherche : sans casse, et une image non sécurisée est écartée", () => {
  const response = { content: { data: [{ channel: { channelId: ID, channelName: "Bonny", channelImageUrl: "http://evil.example/a.png" } }] } };
  const channel = pickChzzkChannel(response, "bonny");
  assert.equal(channel.id, ID);
  assert.equal(channel.avatar, "");
});

test("live ouvert : titre, catégorie, spectateurs, début en heure coréenne", () => {
  const live = parseChzzkLive({
    liveId: 21740811, liveTitle: "Titre", status: "OPEN", concurrentUserCount: 21, openDate: "2026-10-20 03:20:24",
    liveCategory: "Minecraft", liveCategoryValue: "마인크래프트",
    liveImageUrl: "https://livecloud-thumb.akamaized.net/x/image_{type}.jpg",
    channel: { channelId: ID, channelName: "Bonny", channelImageUrl: "https://nng-phinf.pstatic.net/b.png" },
  });
  assert.equal(live.isLive, true);
  assert.equal(live.title, "Titre");
  assert.equal(live.game, "마인크래프트");
  assert.equal(live.viewers, 21);
  assert.equal(live.sessionId, "21740811");
  assert.equal(live.startedAt, "2026-10-19T18:20:24.000Z");
  assert.equal(live.thumbnailUrl, "https://livecloud-thumb.akamaized.net/x/image_480.jpg");
  assert.equal(live.displayName, "Bonny");
  assert.equal(live.avatarUrl, "https://nng-phinf.pstatic.net/b.png");
});

test("live fermé : hors ligne, sans spectateurs ni vignette", () => {
  const live = parseChzzkLive({ liveId: 5, liveTitle: "Fini", status: "CLOSE", concurrentUserCount: 1491, openDate: "2026-10-19 19:56:46", liveImageUrl: null, channel: { channelName: "Z" } });
  assert.equal(live.isLive, false);
  assert.equal(live.viewers, 0);
  assert.equal(live.thumbnailUrl, "");
});

test("live : contenu absent ou incohérent", () => {
  assert.equal(parseChzzkLive(null).isLive, false);
  assert.equal(parseChzzkLive({ status: "OPEN", concurrentUserCount: -4, openDate: "pas une date" }).viewers, 0);
  assert.equal(parseChzzkLive({ status: "OPEN", openDate: "pas une date" }).startedAt, null);
  assert.equal(parseChzzkLive({ status: "OPEN", liveImageUrl: "http://x/a_{type}.jpg" }).thumbnailUrl, "");
});

test("vignette : seulement du https, et la taille remplace le motif", () => {
  assert.equal(chzzkThumbnail("https://h/a_{type}.jpg", 720), "https://h/a_720.jpg");
  assert.equal(chzzkThumbnail("http://h/a_{type}.jpg"), "");
  assert.equal(chzzkThumbnail(""), "");
});

test("adresses de chaîne et de live", () => {
  assert.equal(chzzkChannelUrl(ID), `https://chzzk.naver.com/${ID}`);
  assert.equal(chzzkLiveUrl(ID), `https://chzzk.naver.com/live/${ID}`);
  assert.equal(chzzkChannelUrl("pas un id"), "https://chzzk.naver.com/");
});

import { fetchChzzkLive, resolveChzzkChannel } from "../js/chzzk.js";

const channelRow = (id, name) => ({ channelId: id, channelName: name, channelImageUrl: "https://nng-phinf.pstatic.net/x.png", followerCount: 10, openLive: false });

test("résolution par identifiant : une seule requête sur la chaîne", async () => {
  const calls = [];
  const getJson = async (path) => { calls.push(path); return { code: 200, content: channelRow(ID, "침착맨") }; };
  const channel = await resolveChzzkChannel(ID, getJson);
  assert.equal(channel.id, ID);
  assert.deepEqual(calls, [`/service/v1/channels/${ID}`]);
});

test("résolution par nom : recherche, puis nom exact", async () => {
  const calls = [];
  const getJson = async (path) => {
    calls.push(path);
    return { content: { data: [{ channel: channelRow("a".repeat(32), "침착맨 팬") }, { channel: channelRow(ID, "침착맨") }] } };
  };
  const channel = await resolveChzzkChannel("침착맨", getJson);
  assert.equal(channel.id, ID);
  assert.match(calls[0], /^\/service\/v1\/search\/channels\?keyword=%EC%B9%A8%EC%B0%A9%EB%A7%A8&size=20$/);
});

test("résolution : introuvable, saisie vide ou réseau en échec", async () => {
  assert.equal(await resolveChzzkChannel("", async () => ({})), null);
  assert.equal(await resolveChzzkChannel("inconnu", async () => ({ content: { data: [] } })), null);
  assert.equal(await resolveChzzkChannel(ID, async () => null), null);
  assert.equal(await resolveChzzkChannel(ID, async () => { throw new Error("réseau"); }), null);
});

test("live : une requête, contenu analysé ; chaîne inconnue ou erreur réseau distinguées", async () => {
  const ok = await fetchChzzkLive(ID, async (path) => {
    assert.equal(path, `/service/v3/channels/${ID}/live-detail`);
    return { code: 200, content: { status: "OPEN", liveTitle: "T", concurrentUserCount: 3, liveId: 9, openDate: "2026-10-20 03:20:24", channel: { channelId: ID, channelName: "N" } } };
  });
  assert.equal(ok.status.isLive, true);
  assert.equal(ok.status.title, "T");
  const gone = await fetchChzzkLive(ID, async () => ({ code: 404, message: "채널이 존재하지 않습니다." }));
  assert.deepEqual(gone, { notFound: true });
  const down = await fetchChzzkLive(ID, async () => { throw new Error("réseau"); });
  assert.equal(down.error, "réseau");
  const bad = await fetchChzzkLive("pas un id", async () => ({}));
  assert.deepEqual(bad, { notFound: true });
});

import { CHZZK_HOST_PERMISSION, CHZZK_RULE_ID, chzzkOriginRule } from "../js/chzzk.js";

test("règle de réécriture : l'API n'accepte que l'origine de son site", () => {
  const rule = chzzkOriginRule("abcdefghijklmnopabcdefghijklmnop");
  assert.equal(rule.id, CHZZK_RULE_ID);
  assert.equal(rule.action.type, "modifyHeaders");
  assert.deepEqual(rule.action.requestHeaders, [
    { header: "origin", operation: "set", value: "https://chzzk.naver.com" },
    { header: "referer", operation: "set", value: "https://chzzk.naver.com/" },
  ]);
  assert.equal(rule.condition.urlFilter, "||api.chzzk.naver.com/");
  assert.deepEqual(rule.condition.resourceTypes, ["xmlhttprequest"]);
  assert.deepEqual(rule.condition.initiatorDomains, ["abcdefghijklmnopabcdefghijklmnop"]);
  assert.equal(CHZZK_HOST_PERMISSION, "https://*.chzzk.naver.com/*");
});

test("règle de réécriture : sans identifiant d'extension valide, aucune règle", () => {
  for (const bad of ["", null, undefined, "pas un id", 42]) assert.equal(chzzkOriginRule(bad), null);
});

test("scripts des pages CHZZK : posés sur le site seulement, latence selon l'interrupteur", async () => {
  const { chzzkPageScripts, CHZZK_PERMISSIONS, CHZZK_ACCESS, CHZZK_LATENCY_ENABLED, CHZZK_PAGE_SCRIPT_IDS } = await import("../js/chzzk.js");
  const scripts = chzzkPageScripts();
  assert.deepEqual(CHZZK_PERMISSIONS, [CHZZK_HOST_PERMISSION]);
  assert.deepEqual(CHZZK_ACCESS, { origins: [CHZZK_HOST_PERMISSION], permissions: ["declarativeNetRequestWithHostAccess"] });
  for (const script of scripts) assert.deepEqual(script.matches, ["https://chzzk.naver.com/*"]);
  assert.equal(new Set(scripts.map((script) => script.id)).size, scripts.length);
  for (const script of scripts) assert.ok(CHZZK_PAGE_SCRIPT_IDS.includes(script.id));
  const isolated = scripts.find((script) => script.world !== "MAIN");
  assert.equal(isolated.js[0], "js/inject/i18n-inline.js");
  assert.ok(isolated.js.includes("js/inject/quickFollowChzzk.js"));
  assert.equal(isolated.js.includes("js/chzzkPlayerEnhancer.js"), CHZZK_LATENCY_ENABLED);
  assert.equal(scripts.some((script) => script.world === "MAIN"), CHZZK_LATENCY_ENABLED);
});

test("manifeste : la règle d'en-tête est une permission facultative, jamais obligatoire", async () => {
  const { readFile } = await import("node:fs/promises");
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.ok(!manifest.permissions.includes("declarativeNetRequestWithHostAccess"));
  assert.deepEqual(manifest.optional_permissions, ["declarativeNetRequestWithHostAccess"]);
  assert.deepEqual(manifest.optional_host_permissions, [CHZZK_HOST_PERMISSION]);
});
