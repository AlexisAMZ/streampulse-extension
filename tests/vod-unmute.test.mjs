import test from "node:test";
import assert from "node:assert/strict";

test("VOD Unmute : installation et nettoyage des règles déclaratives compactes", async () => {
  const fakeRules = [];
  const fakeTabs = new Map([[10, { id: 10 }]]);

  global.chrome = {
    declarativeNetRequest: {
      async getSessionRules() {
        return [...fakeRules];
      },
      async updateSessionRules({ removeRuleIds = [], addRules = [] }) {
        const removeSet = new Set(removeRuleIds);
        for (let i = fakeRules.length - 1; i >= 0; i--) {
          if (removeSet.has(fakeRules[i].id)) {
            fakeRules.splice(i, 1);
          }
        }
        for (const rule of addRules) {
          fakeRules.push(rule);
        }
      },
    },
    tabs: {
      async get(tabId) {
        if (!fakeTabs.has(tabId)) {
          throw new Error("Onglet inexistant");
        }
        return fakeTabs.get(tabId);
      },
      onRemoved: {
        addListener() {},
      },
    },
    storage: {
      local: {
        _data: {},
        async get(keys) {
          if (typeof keys === "string") return { [keys]: this._data[keys] };
          if (Array.isArray(keys)) {
            const res = {};
            for (const k of keys) res[k] = this._data[k];
            return res;
          }
          return { ...this._data };
        },
        async set(obj) {
          Object.assign(this._data, obj);
        },
      },
    },
  };

  const { handleVodUnmuteInstallRules, clearVodRulesForTab, pruneOrphanVodRules } = await import(
    `../js/sw/vod-unmute.js?t=${Date.now()}`
  );

  // 1. Installation de 95 segments muets (doit générer 3 règles de redirection + 1 règle modifyHeaders CORS)
  const segmentIds = Array.from({ length: 95 }, (_, i) => String(900 + i));
  const res = await handleVodUnmuteInstallRules(
    { segmentIds, append: false },
    { tab: { id: 10 } }
  );

  assert.equal(res.ok, true);
  assert.equal(res.count, 4);
  assert.equal(fakeRules.length, 4);

  // Vérification de la première règle (redirection)
  const firstRule = fakeRules[0];
  assert.equal(firstRule.condition.tabIds, undefined);
  assert.equal(firstRule.priority, 2);
  assert.equal(firstRule.action.type, "redirect");
  assert.equal(firstRule.action.redirect.regexSubstitution, "\\1\\2\\3");

  // Vérification de la règle modifyHeaders CORS (dédiée au contournement 403 S3)
  const corsRule = fakeRules[3];
  assert.equal(corsRule.priority, 1);
  assert.equal(corsRule.action.type, "modifyHeaders");
  assert.equal(corsRule.action.requestHeaders[0].header, "Origin");
  assert.equal(corsRule.action.requestHeaders[0].operation, "remove");
  assert.equal(corsRule.action.responseHeaders[0].header, "Access-Control-Allow-Origin");
  assert.equal(corsRule.action.responseHeaders[0].value, "https://www.twitch.tv");
  assert.ok(corsRule.action.responseHeaders.some((h) => h.header === "Access-Control-Expose-Headers"));
  assert.ok(new RegExp(corsRule.condition.regexFilter).test("https://d2vi6trrdongqn.cloudfront.net/hash/chunked/1223.ts"));

  // Test de la regex sur différentes qualités et domaines (y compris twitch.tv)
  const re = new RegExp(firstRule.condition.regexFilter);
  const testUrlChunked = "https://d2vi6trrdongqn.cloudfront.net/hash/chunked/900-unmuted.ts";
  const testUrl720p = "https://d2vi6trrdongqn.cloudfront.net/hash/720p60/915-muted.ts?sig=abc";
  const testUrlTtvnw = "https://video-edge.ttvnw.net/v1/1080p60/939-muted.ts";
  const testUrlTwitch = "https://vod-metro.twitch.tv/v1/1080p60/900-muted.ts";
  const testUrlOther = "https://d2vi6trrdongqn.cloudfront.net/hash/chunked/945-unmuted.ts"; // dans la 2ème règle

  assert.equal(re.test(testUrlChunked), true);
  assert.equal(testUrlChunked.replace(re, "$1$2$3"), "https://d2vi6trrdongqn.cloudfront.net/hash/chunked/900.ts");

  assert.equal(re.test(testUrl720p), true);
  assert.equal(testUrl720p.replace(re, "$1$2$3"), "https://d2vi6trrdongqn.cloudfront.net/hash/720p60/915.ts?sig=abc");

  assert.equal(re.test(testUrlTtvnw), true);
  assert.equal(testUrlTtvnw.replace(re, "$1$2$3"), "https://video-edge.ttvnw.net/v1/1080p60/939.ts");

  assert.equal(re.test(testUrlTwitch), true);
  assert.equal(testUrlTwitch.replace(re, "$1$2$3"), "https://vod-metro.twitch.tv/v1/1080p60/900.ts");

  // Support des flux modernes au format mp4 / m4s
  const testUrlMp4 = "https://d2vi6trrdongqn.cloudfront.net/hash/chunked/900-muted.mp4";
  assert.equal(re.test(testUrlMp4), true);
  assert.equal(testUrlMp4.replace(re, "$1$2$3"), "https://d2vi6trrdongqn.cloudfront.net/hash/chunked/900.mp4");

  assert.equal(re.test(testUrlOther), false); // Appartient au lot suivant

  // Test de redirection vers cible -unmuted spécifique
  await clearVodRulesForTab(10);
  const unmutedRedirectRes = await handleVodUnmuteInstallRules(
    {
      redirects: [
        {
          sourceUrl: "https://d2vi6trrdongqn.cloudfront.net/hash/chunked/414-muted.mp4",
          targetUrl: "https://d2vi6trrdongqn.cloudfront.net/hash/chunked/414-unmuted.mp4",
          targetType: "unmuted",
        },
      ],
      append: false,
    },
    { tab: { id: 10 } }
  );
  assert.equal(unmutedRedirectRes.ok, true);
  assert.equal(fakeRules.length, 2); // 1 redirection + 1 modifyHeaders CORS
  const unmutedRule = fakeRules[0];
  assert.equal(unmutedRule.action.redirect.regexSubstitution, "\\1\\2-unmuted\\3");
  const reUnmuted = new RegExp(unmutedRule.condition.regexFilter);
  assert.equal(reUnmuted.test("https://d2vi6trrdongqn.cloudfront.net/hash/chunked/414-muted.mp4"), true);
  assert.equal(
    "https://d2vi6trrdongqn.cloudfront.net/hash/chunked/414-muted.mp4".replace(reUnmuted, "$1$2-unmuted$3"),
    "https://d2vi6trrdongqn.cloudfront.net/hash/chunked/414-unmuted.mp4"
  );

  // 2. Nettoyage ciblé par onglet
  await clearVodRulesForTab(10);
  assert.equal(fakeRules.length, 0);

  // 3. Test de purge des règles orphelines
  fakeRules.push({
    id: 999,
    condition: { tabIds: [9999] }, // Onglet qui n'existe plus
  });
  assert.equal(fakeRules.length, 1);
  await pruneOrphanVodRules();
  assert.equal(fakeRules.length, 0);
});

test("VOD Unmute : résolution autonome locale via GraphQL et M3U8 sans API distante", async () => {
  const { handleVodUnmuteResolve } = await import(
    `../js/sw/vod-unmute.js?t=${Date.now()}`
  );

  // Rejet immédiat sur identifiant invalide
  const invalidRes = await handleVodUnmuteResolve({ vodId: "abc" });
  assert.equal(invalidRes.ok, false);
  assert.equal(invalidRes.error, "invalid_vod_id");

  // Mock de fetch global pour tester la résolution 100% locale
  const originalFetch = global.fetch;
  try {
    global.fetch = async (url, opts) => {
      if (url.includes("gql.twitch.tv")) {
        return {
          ok: true,
          json: async () => [
            {
              data: {
                video: {
                  id: "123456",
                  seekPreviewsURL: "https://d2vi6trrdongqn.cloudfront.net/hash/storyboards/123456-info.json",
                },
              },
            },
          ],
        };
      }
      if (url.includes(".m3u8")) {
        const m3u8Content = [
          "#EXTM3U",
          "#EXT-X-VERSION:3",
          "#EXT-X-TARGETDURATION:10",
          "#EXTINF:10.000,",
          "https://d2vi6trrdongqn.cloudfront.net/hash/chunked/12-muted.ts",
          "#EXT-X-ENDLIST",
        ].join("\n");
        return {
          ok: true,
          text: async () => m3u8Content,
        };
      }
      if (url.includes("12.ts")) {
        return {
          status: 206,
          ok: true,
        };
      }
      return { status: 404, ok: false };
    };

    const validRes = await handleVodUnmuteResolve({ vodId: "123456" });
    assert.equal(validRes.ok, true);
    assert.equal(validRes.vodId, "123456");
    assert.equal(validRes.isPlus, true);
    assert.equal(validRes.restoredRanges.length, 1);
    assert.equal(validRes.restoredRanges[0].segmentId, "12");
    assert.equal(validRes.restoredRanges[0].targetType, "bare");
  } finally {
    global.fetch = originalFetch;
  }
});

test("VOD Unmute : appel asynchrone avec sendResponse et cache mémoire local F5", async () => {
  const { handleVodUnmuteResolve, handleVodUnmuteInstallRules, handleVodUnmuteClearRules } = await import(
    `../js/sw/vod-unmute.js?t=${Date.now()}`
  );

  let fetchCalls = 0;
  const originalFetch = global.fetch;
  try {
    global.fetch = async (url) => {
      fetchCalls++;
      if (url.includes("gql.twitch.tv")) {
        return {
          ok: true,
          json: async () => [
            {
              data: {
                video: {
                  id: "888999",
                  seekPreviewsURL: "https://d2vi6trrdongqn.cloudfront.net/hash/storyboards/888999-info.json",
                },
              },
            },
          ],
        };
      }
      if (url.includes(".m3u8")) {
        return {
          ok: true,
          text: async () => "#EXTM3U\n#EXTINF:10.000,\nhttps://d2vi6trrdongqn.cloudfront.net/hash/chunked/40-muted.mp4\n#EXT-X-ENDLIST",
        };
      }
      if (url.includes("40.mp4")) {
        return { status: 206, ok: true };
      }
      return { status: 404, ok: false };
    };

    // 1. handleVodUnmuteResolve doit renvoyer true pour maintenir le port de message ouvert
    let resolveResult = null;
    const isAsync = handleVodUnmuteResolve(
      { vodId: "888999" },
      { tab: { id: 10 } },
      (response) => {
        resolveResult = response;
      }
    );
    assert.equal(isAsync, true);

    // Attente que le callback sendResponse soit exécuté
    await new Promise((r) => setTimeout(r, 40));
    assert.ok(resolveResult);
    assert.equal(resolveResult.ok, true);
    assert.equal(resolveResult.vodId, "888999");
    const countAfterFirst = fetchCalls;
    assert.ok(countAfterFirst >= 2);

    // 2. Simulation F5 : second appel pour le même vodId doit taper le cache mémoire local sans requête réseau
    let secondResult = null;
    const isSecondAsync = handleVodUnmuteResolve(
      { vodId: "888999" },
      { tab: { id: 10 } },
      (response) => {
        secondResult = response;
      }
    );
    assert.equal(isSecondAsync, true);
    await new Promise((r) => setTimeout(r, 40));
    assert.ok(secondResult);
    assert.equal(secondResult.ok, true);
    assert.equal(fetchCalls, countAfterFirst); // Pas de nouvelle requête réseau

    // 3. handleVodUnmuteInstallRules doit aussi renvoyer true et appeler sendResponse
    let installResult = null;
    const isInstallAsync = handleVodUnmuteInstallRules(
      { segmentIds: ["40"], append: false },
      { tab: { id: 10 } },
      (response) => {
        installResult = response;
      }
    );
    assert.equal(isInstallAsync, true);
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(installResult);
    assert.equal(installResult.ok, true);

    // 4. handleVodUnmuteClearRules doit renvoyer true et appeler sendResponse
    let clearResult = null;
    const isClearAsync = handleVodUnmuteClearRules(
      {},
      { tab: { id: 10 } },
      (response) => {
        clearResult = response;
      }
    );
    assert.equal(isClearAsync, true);
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(clearResult);
    assert.equal(clearResult.ok, true);
  } finally {
    global.fetch = originalFetch;
  }
});
