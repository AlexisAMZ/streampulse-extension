/**
 * Le pont des Drops tourne dans la page Twitch : on le charge dans un bac à
 * sable avec un faux fetch, puis on lui envoie les
 * commandes telles que dropsRecorder.js les poste.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("../js/inject/drops-bridge.js", import.meta.url), "utf8");
const ORIGIN = "https://www.twitch.tv";
const GQL = "https://gql.twitch.tv/gql";

function sandbox({ respond = () => ({ data: {} }), cookie = "" } = {}) {
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
  };
  win.top = win;
  new Function("window", "location", "document", SOURCE)(win, { origin: ORIGIN }, { cookie });

  // La poignée de main READY apporte le jeton de session ; les commandes le
  // portent et chaque réponse le rend (le relais refuse sinon).
  const TOKEN = "jeton-test";
  listeners.forEach((listener) => listener({ source: win, data: { source: "streampulse:drops:ready", token: TOKEN } }));
  const run = async (action, fields = {}) => {
    const id = `cmd-${posted.length}`;
    listeners.forEach((listener) => listener({ source: win, data: { source: "streampulse:drops:cmd", v: 1, token: TOKEN, id, action, ...fields } }));
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

const withIntegrity = async (box) => box.win.fetch(GQL, { headers: { Authorization: "OAuth t", "Client-Integrity": "v4" } });

test("sans en-tête d'intégrité, la liste des campagnes n'est pas demandée", async () => {
  const box = sandbox({ cookie: "auth-token=t" });
  const result = await box.run("campaigns");
  assert.deepEqual([result.ok, result.error], [false, "unavailable"]);
  assert.equal(box.requests.length, 0);
});

test("la liste des campagnes est demandée avec les Drops de chaque campagne", async () => {
  const campaigns = [{ id: "c1", name: "ELDEN RING", game: { displayName: "ELDEN RING" }, timeBasedDrops: [] }];
  const box = sandbox({ respond: () => ({ data: { currentUser: { id: "1", dropCampaigns: campaigns } } }) });
  await withIntegrity(box);
  const result = await box.run("campaigns");
  assert.deepEqual([result.ok, result.data.source, result.data.campaigns], [true, "gql", campaigns]);
  assert.match(box.requests[1].body.query, /timeBasedDrops[\s\S]*requiredSubs[\s\S]*distributionType/);
});

test("si Twitch refuse les Drops dans la liste, la liste est relue sans", async () => {
  const campaigns = [{ id: "c1", name: "HEAT", game: { displayName: "World of Tanks: HEAT" } }];
  const box = sandbox({
    // Twitch refuse les Drops dans la liste, avec ou sans requiredSubs.
    respond: (url, init) => (/timeBasedDrops/.test(init.body || "")
      ? { data: null, errors: [{ message: "Cannot query field \"timeBasedDrops\" on type \"DropCampaign\"." }] }
      : { data: { currentUser: { id: "1", dropCampaigns: campaigns } } }),
  });
  await withIntegrity(box);
  const result = await box.run("campaigns");
  assert.equal(result.ok, true);
  assert.doesNotMatch(box.requests.at(-1).body.query, /timeBasedDrops/);
});

test("le détail de 5 campagnes au plus part en une seule requête, identifiants vérifiés", async () => {
  const box = sandbox({
    respond: () => ({ data: { currentUser: { id: "1", c0: { id: "a-1", timeBasedDrops: [{ id: "d" }] }, c1: null, c2: { id: "d", timeBasedDrops: [] } } } }),
  });
  await withIntegrity(box);
  const result = await box.run("details", { ids: ["a-1", 'b"} evil', "c", "d", "e", "f", "g"] });
  assert.equal(result.ok, true);
  assert.equal(box.requests.length, 2, "une seule requête de détail");
  const query = box.requests[1].body.query;
  assert.match(query, /c0: dropCampaign\(id: "a-1"\)/);
  assert.doesNotMatch(query, /evil/);
  assert.deepEqual(result.data.ids, ["a-1", "c", "d", "e", "f"]);
  assert.deepEqual(result.data.campaigns.map((c) => c.id), ["a-1", "d"]);
});

test("sans en-tête d'intégrité, aucun détail n'est demandé", async () => {
  const box = sandbox({ cookie: "auth-token=t" });
  const result = await box.run("details", { ids: ["a-1"] });
  assert.deepEqual([result.ok, result.error], [false, "integrity"]);
  assert.equal(box.requests.length, 0);
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

test("si Twitch retire requiredSubs, les Drops sont relus sans ce champ (liste et détail)", async () => {
  const schema = { data: null, errors: [{ message: "Cannot query field \"requiredSubs\" on type \"TimeBasedDrop\"." }] };
  const box = sandbox({
    respond: (url, init) => {
      const query = init.body ? JSON.parse(init.body).query : "";
      if (/requiredSubs/.test(query)) return schema;
      if (/dropCampaign\(id/.test(query)) return { data: { currentUser: { id: "1", c0: { id: "a-1", timeBasedDrops: [{ id: "d" }] } } } };
      return { data: { currentUser: { id: "1", dropCampaigns: [{ id: "c1", name: "X", game: { displayName: "X" }, timeBasedDrops: [{ id: "d" }] }] } } };
    },
  });
  await withIntegrity(box);
  const list = await box.run("campaigns");
  assert.equal(list.ok, true);
  assert.match(box.requests.at(-1).body.query, /timeBasedDrops/);
  const details = await box.run("details", { ids: ["a-1"] });
  assert.deepEqual([details.ok, details.data.campaigns.map((c) => c.id)], [true, ["a-1"]]);
});
