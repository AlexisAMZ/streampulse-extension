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
  };

  const { handleVodUnmuteInstallRules, clearVodRulesForTab, pruneOrphanVodRules } = await import(
    `../js/sw/vod-unmute.js?t=${Date.now()}`
  );

  // 1. Installation de 95 segments muets (doit générer 3 règles de 40 max par regex)
  const segmentIds = Array.from({ length: 95 }, (_, i) => String(900 + i));
  const res = await handleVodUnmuteInstallRules(
    { segmentIds, append: false },
    { tab: { id: 10 } }
  );

  assert.equal(res.ok, true);
  assert.equal(res.count, 3);
  assert.equal(fakeRules.length, 3);

  // Vérification de la première règle
  const firstRule = fakeRules[0];
  assert.equal(firstRule.condition.tabIds[0], 10);
  assert.equal(firstRule.action.type, "redirect");
  assert.equal(firstRule.action.redirect.regexSubstitution, "\\1\\2\\3");

  // Test de la regex sur différentes qualités et domaines
  const re = new RegExp(firstRule.condition.regexFilter);
  const testUrlChunked = "https://d2vi6trrdongqn.cloudfront.net/hash/chunked/900-unmuted.ts";
  const testUrl720p = "https://d2vi6trrdongqn.cloudfront.net/hash/720p60/915-muted.ts?sig=abc";
  const testUrlTtvnw = "https://video-edge.ttvnw.net/v1/1080p60/939-muted.ts";
  const testUrlOther = "https://d2vi6trrdongqn.cloudfront.net/hash/chunked/945-unmuted.ts"; // dans la 2ème règle

  assert.equal(re.test(testUrlChunked), true);
  assert.equal(testUrlChunked.replace(re, "$1$2$3"), "https://d2vi6trrdongqn.cloudfront.net/hash/chunked/900.ts");

  assert.equal(re.test(testUrl720p), true);
  assert.equal(testUrl720p.replace(re, "$1$2$3"), "https://d2vi6trrdongqn.cloudfront.net/hash/720p60/915.ts?sig=abc");

  assert.equal(re.test(testUrlTtvnw), true);
  assert.equal(testUrlTtvnw.replace(re, "$1$2$3"), "https://video-edge.ttvnw.net/v1/1080p60/939.ts");

  assert.equal(re.test(testUrlOther), false); // Appartient au lot suivant

  // Test de restriction par qualité lorsque quality est fourni
  const qualityRes = await handleVodUnmuteInstallRules(
    { segmentIds: ["900"], quality: "chunked", append: false },
    { tab: { id: 10 } }
  );
  assert.equal(qualityRes.ok, true);
  const qRule = fakeRules[0];
  const qRe = new RegExp(qRule.condition.regexFilter);
  assert.equal(qRe.test("https://d2vi6trrdongqn.cloudfront.net/hash/chunked/900-unmuted.ts"), true);
  assert.equal(qRe.test("https://d2vi6trrdongqn.cloudfront.net/hash/720p60/900-muted.ts"), false);

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
