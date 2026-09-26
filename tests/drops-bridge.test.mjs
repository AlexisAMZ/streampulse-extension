/**
 * Le pont des Drops tourne dans la page Twitch : on le charge dans un bac à
 * sable avec un faux fetch et un faux cache Apollo, puis on lui envoie les
 * commandes telles que dropsRecorder.js les poste.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("../js/inject/drops-bridge.js", import.meta.url), "utf8");
const ORIGIN = "https://www.twitch.tv";
const GQL = "https://gql.twitch.tv/gql";

function sandbox({ respond = () => ({ data: {} }), cookie = "", apollo = null } = {}) {
  const requests = [];
  const posted = [];
  const listeners = [];
  const fetch = async (url, init = {}) => {
    requests.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
    const reply = respond(url, init, requests.length);
    return { status: reply.status || 200, json: async () => reply.json ?? reply };
  };
  const win = {
    fetch,
    postMessage: (message, origin) => posted.push({ message, origin }),
    addEventListener: (type, listener) => {
      if (type === "message") listeners.push(listener);
    },
    __APOLLO_CLIENT__: apollo ? { cache: { extract: () => apollo } } : undefined,
  };
  win.top = win;
  new Function("window", "location", "document", SOURCE)(win, { origin: ORIGIN }, { cookie });

  const run = async (action, fields = {}) => {
    const id = `cmd-${posted.length}`;
    listeners.forEach((listener) => listener({ source: win, data: { source: "streampulse:drops:cmd", v: 1, id, action, ...fields } }));
    for (let i = 0; i < 20 && !posted.some((item) => item.message.id === id); i++) await new Promise((resolve) => setTimeout(resolve, 0));
    return posted.find((item) => item.message.id === id)?.message;
  };
  return { win, run, requests, posted };
}

const inventoryData = { currentUser: { id: "999", inventory: { dropCampaignsInProgress: [], gameEventDrops: [] } } };

test("les en-têtes des requêtes GraphQL de Twitch sont lus sans modifier la requête", async () => {
  const box = sandbox({ respond: () => ({ data: inventoryData }) });
  const init = { method: "POST", headers: { "Client-Id": "abc", Authorization: "OAuth jeton", "Client-Integrity": "v4.integrite" }, body: "{}" };
  await box.win.fetch(GQL, init);
  assert.deepEqual(box.requests[0].init, init, "la requête de Twitch part telle quelle");

  const result = await box.run("inventory");
  assert.equal(result.ok, true);
  assert.equal(result.data.tier, "full");
  const sent = box.requests[1];
  assert.equal(sent.url, GQL);
  assert.equal(sent.init.headers["Client-Id"], "abc");
  assert.equal(sent.init.headers.Authorization, "OAuth jeton");
  assert.equal(sent.init.headers["Client-Integrity"], "v4.integrite");
  assert.match(sent.body.query, /dropCampaignsInProgress/);
});

test("sans requête de Twitch, le jeton vient du cookie ; sans cookie, rien ne part", async () => {
  const signedIn = sandbox({ cookie: "unique_id=x; auth-token=abc123", respond: () => ({ data: inventoryData }) });
  const result = await signedIn.run("inventory");
  assert.equal(result.ok, true);
  assert.equal(signedIn.requests[0].init.headers.Authorization, "OAuth abc123");
  assert.equal(signedIn.requests[0].init.headers["Client-Id"], "kimne78kx3ncx6brgo4mv6wki5h1ko");

  const signedOut = sandbox();
  const refused = await signedOut.run("inventory");
  assert.deepEqual([refused.ok, refused.error], [false, "signed-out"]);
  assert.equal(signedOut.requests.length, 0);
});

test("si Twitch retire un champ, l'inventaire est relu avec la requête de repli", async () => {
  const box = sandbox({
    cookie: "auth-token=t",
    respond: (_url, _init, n) => (n === 1 ? { data: null, errors: [{ message: 'Cannot query field "gameEventDrops" on type "Inventory".' }] } : { data: inventoryData }),
  });
  const result = await box.run("inventory");
  assert.equal(result.ok, true);
  assert.equal(result.data.tier, "lite");
  assert.doesNotMatch(box.requests[1].body.query, /gameEventDrops/);
});

test("sans en-tête d'intégrité, les campagnes viennent du cache Apollo de la page", async () => {
  const apollo = {
    "DropCampaign:c1": {
      __typename: "DropCampaign", id: "c1", name: "HEAT", status: "ACTIVE", startAt: "2026-09-20T00:00:00Z", endAt: "2026-09-27T00:00:00Z",
      game: { __ref: "Game:1" }, owner: { __ref: "Organization:o" }, self: { __typename: "DropCampaignSelfEdge", isAccountConnected: true },
    },
    "Game:1": { __typename: "Game", id: "1", displayName: "World of Tanks: HEAT", 'boxArtURL({"height":72,"width":52})': "https://box/1.jpg" },
    "Organization:o": { __typename: "Organization", id: "o", name: "Wargaming" },
    ROOT_QUERY: { __typename: "Query" },
  };
  const box = sandbox({ cookie: "auth-token=t", apollo });
  const result = await box.run("campaigns");
  assert.equal(result.ok, true);
  assert.equal(result.data.source, "apollo");
  assert.equal(box.requests.length, 0, "aucune requête refusée d'avance");
  assert.deepEqual(result.data.campaigns[0].game, { id: "1", displayName: "World of Tanks: HEAT", boxArtURL: "https://box/1.jpg" });
  assert.equal(result.data.campaigns[0].owner.name, "Wargaming");
  assert.equal(result.data.campaigns[0].self.isAccountConnected, true);

  const empty = await sandbox({ cookie: "auth-token=t" }).run("campaigns");
  assert.deepEqual([empty.ok, empty.error], [false, "unavailable"]);
});

test("avec l'en-tête d'intégrité, les campagnes viennent de GraphQL ; un refus retombe sur le cache", async () => {
  const campaigns = [{ id: "c1", name: "HEAT", game: { displayName: "World of Tanks: HEAT" } }];
  const box = sandbox({ respond: () => ({ data: { currentUser: { id: "1", dropCampaigns: campaigns } } }) });
  await box.win.fetch(GQL, { headers: { Authorization: "OAuth t", "Client-Integrity": "v4" } });
  const result = await box.run("campaigns");
  assert.deepEqual([result.ok, result.data.source, result.data.campaigns], [true, "gql", campaigns]);

  const refused = sandbox({
    respond: () => ({ data: null, errors: [{ message: "failed integrity check" }] }),
    apollo: { "DropCampaign:c2": { __typename: "DropCampaign", id: "c2", name: "X", game: null } },
  });
  await refused.win.fetch(GQL, { headers: { Authorization: "OAuth t", "Client-Integrity": "v4" } });
  const fallback = await refused.run("campaigns");
  assert.deepEqual([fallback.ok, fallback.data.source], [true, "apollo"]);
});

test("claim envoie claimDropRewards avec l'identifiant échappé et lit le statut", async () => {
  const box = sandbox({ cookie: "auth-token=t", respond: () => ({ data: { claimDropRewards: { status: "ELIGIBLE_FOR_ALL" } } }) });
  const result = await box.run("claim", { instanceId: "999#c1#d1", auto: true });
  assert.deepEqual([result.ok, result.data.claimed, result.data.status, result.instanceId, result.auto], [true, true, "ELIGIBLE_FOR_ALL", "999#c1#d1", true]);
  assert.match(box.requests[0].body.query, /claimDropRewards\(input: \{ dropInstanceID: "999#c1#d1" \}\)/);

  const invalid = await box.run("claim", { instanceId: '"} evil' });
  assert.deepEqual([invalid.ok, invalid.error], [false, "invalid"]);
  assert.equal(box.requests.length, 1);
});

test("les commandes inconnues ou venues d'ailleurs sont ignorées", async () => {
  const box = sandbox({ cookie: "auth-token=t" });
  const result = await box.run("delete-everything");
  assert.equal(result, undefined);
  assert.equal(box.requests.length, 0);
});
