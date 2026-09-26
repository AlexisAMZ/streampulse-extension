import test from "node:test";
import assert from "node:assert/strict";
import { createDropsClient, twitchToken } from "../js/drops-gql.js";

const cookies = (value) => ({ get: async (details) => (details.name === "auth-token" && value ? { value } : null) });

function client({ token = "abc", respond = () => ({ data: { currentUser: { id: "1", inventory: { dropCampaignsInProgress: [] } } } }) } = {}) {
  const requests = [];
  const fetch = async (url, init) => {
    requests.push({ url, init, body: JSON.parse(init.body) });
    const reply = respond(requests.length);
    return { status: reply.status || 200, json: async () => reply };
  };
  return { api: createDropsClient({ fetch, cookies: cookies(token) }), requests };
}

test("le jeton vient du cookie auth-token de twitch.tv", async () => {
  assert.equal(await twitchToken(cookies("a%20b")), "a b");
  assert.equal(await twitchToken(cookies("")), "");
});

test("l'inventaire part avec la session de l'utilisateur, sans onglet Twitch", async () => {
  const { api, requests } = client();
  const inventory = await api.readInventory();
  assert.deepEqual(inventory.currentUser.inventory.dropCampaignsInProgress, []);
  assert.equal(requests[0].url, "https://gql.twitch.tv/gql");
  assert.equal(requests[0].init.headers.Authorization, "OAuth abc");
  assert.match(requests[0].body.query, /gameEventDrops/);
});

test("déconnecté de Twitch : aucune requête", async () => {
  const { api, requests } = client({ token: "" });
  await assert.rejects(api.readInventory(), { code: "signed-out" });
  assert.equal(requests.length, 0);
});

test("un champ retiré par Twitch fait basculer sur la requête de repli", async () => {
  const { api, requests } = client({ respond: (n) => (n === 1 ? { data: null, errors: [{ message: 'Cannot query field "x"' }] } : { data: { currentUser: { id: "1" } } }) });
  await api.readInventory();
  assert.doesNotMatch(requests[1].body.query, /gameEventDrops/);
});

test("claim envoie l'identifiant échappé et refuse un identifiant suspect", async () => {
  const { api, requests } = client({ respond: () => ({ data: { claimDropRewards: { status: "ELIGIBLE_FOR_ALL" } } }) });
  assert.deepEqual(await api.claim("999#c1#d1"), { status: "ELIGIBLE_FOR_ALL" });
  assert.match(requests[0].body.query, /dropInstanceID: "999#c1#d1"/);
  await assert.rejects(api.claim('"} x'), { code: "invalid" });
});
