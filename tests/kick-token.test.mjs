// Un jeton Kick refusé (401) ne doit pas rester en cache jusqu'à son expiration,
// sinon l'extension reste sur l'API v2 pendant 60 jours après une rotation.
import { test } from "node:test";
import assert from "node:assert/strict";

const STORAGE_KEY = "streampulse:kickToken";
const DAY = 86_400_000;
let caseId = 0;

function setup({ storedToken = "ancien", proxyToken = "neuf", kickStatus = 401 } = {}) {
  const store = storedToken
    ? { [STORAGE_KEY]: { value: storedToken, expiresAt: Date.now() + 30 * DAY } }
    : {};
  const calls = { proxy: 0 };
  globalThis.chrome = {
    storage: {
      local: {
        get: async (key) => (key in store ? { [key]: structuredClone(store[key]) } : {}),
        set: async (items) => Object.assign(store, structuredClone(items)),
        remove: async (key) => { delete store[key]; },
      },
    },
  };
  globalThis.fetch = async (url) => {
    if (String(url).includes("/api/kick-token")) {
      calls.proxy += 1;
      return new Response(JSON.stringify({ access_token: proxyToken, expires_at: Date.now() + 60 * DAY }));
    }
    return new Response(JSON.stringify({ data: [] }), { status: kickStatus });
  };
  caseId += 1;
  return { store, calls, load: () => import(`../js/sw/kick-token.js?case=${caseId}`) };
}

const OFFICIAL_CALLS = {
  fetchKickOfficial: (mod, token) => mod.fetchKickOfficial("xqc", token),
  fetchKickChannelsOfficial: (mod, token) => mod.fetchKickChannelsOfficial(["xqc"], token),
  fetchKickLivestreamsOfficial: (mod, token) => mod.fetchKickLivestreamsOfficial([1], token),
};

for (const [name, call] of Object.entries(OFFICIAL_CALLS)) {
  test(`${name} : un 401 efface le jeton et le suivant vient du proxy`, async () => {
    const { store, calls, load } = setup();
    const mod = await load();
    assert.equal(await mod.getKickAppToken(), "ancien");
    assert.equal(calls.proxy, 0);

    await assert.rejects(call(mod, "ancien"), /401/);
    assert.equal(store[STORAGE_KEY], undefined);

    assert.equal(await mod.getKickAppToken(), "neuf");
    assert.equal(calls.proxy, 1);
    assert.equal(store[STORAGE_KEY].value, "neuf");
  });
}

test("un 401 sur un jeton déjà remplacé n'efface pas le nouveau", async () => {
  const { store, calls, load } = setup({ storedToken: "neuf" });
  const mod = await load();
  assert.equal(await mod.getKickAppToken(), "neuf");

  await assert.rejects(mod.fetchKickOfficial("xqc", "ancien"), /401/);

  assert.equal(store[STORAGE_KEY].value, "neuf");
  assert.equal(await mod.getKickAppToken(), "neuf");
  assert.equal(calls.proxy, 0);
});

test("une autre erreur de Kick garde le jeton en cache", async () => {
  const { store, calls, load } = setup({ kickStatus: 500 });
  const mod = await load();
  assert.equal(await mod.getKickAppToken(), "ancien");

  await assert.rejects(mod.fetchKickOfficial("xqc", "ancien"), /500/);

  assert.equal(store[STORAGE_KEY].value, "ancien");
  assert.equal(await mod.getKickAppToken(), "ancien");
  assert.equal(calls.proxy, 0);
});

test("une réponse valide renvoie toujours les données de Kick", async () => {
  const { load } = setup({ kickStatus: 200 });
  globalThis.fetch = async () => new Response(JSON.stringify({ data: [{ slug: "xqc" }] }));
  const mod = await load();

  assert.deepEqual(await mod.fetchKickOfficial("xqc", "ancien"), { slug: "xqc" });
  assert.deepEqual(await mod.fetchKickChannelsOfficial(["xqc"], "ancien"), [{ slug: "xqc" }]);
  assert.deepEqual(await mod.fetchKickLivestreamsOfficial([1], "ancien"), [{ slug: "xqc" }]);
});
