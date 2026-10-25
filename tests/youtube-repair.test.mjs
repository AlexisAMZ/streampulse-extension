import { test } from "node:test";
import assert from "node:assert/strict";
import { applyYoutubeRepairs, needsYoutubeRepair, repairYoutubeNames } from "../js/sw/youtube-repair.js";

const ID = "UClqVM39KDCN-RISpnU6Wz-A";
const stuck = { id: `youtube:${ID}`, platform: "youtube", handle: ID, displayName: ID, avatarUrl: "" };
const healthy = { id: "youtube:jawed", platform: "youtube", handle: "jawed", displayName: "jawed", avatarUrl: "https://yt3.example/a.jpg" };
const twitch = { id: "zabuza", platform: "twitch", handle: "zabuza", displayName: "Zabuza", avatarUrl: "" };

test("seule une chaîne YouTube dont le nom est un identifiant UC est à réparer", () => {
  assert.equal(needsYoutubeRepair(stuck), true);
  assert.equal(needsYoutubeRepair({ ...stuck, displayName: "" }), true);
  assert.equal(needsYoutubeRepair({ ...stuck, displayName: "ZABUZA" }), false);
  assert.equal(needsYoutubeRepair(healthy), false);
  assert.equal(needsYoutubeRepair(twitch), false);
});

test("applyYoutubeRepairs renvoie une nouvelle liste sans toucher l'originale", () => {
  const list = [healthy, stuck, twitch];
  const next = applyYoutubeRepairs(list, new Map([[stuck.id, { name: "ZABUZA", avatar: "https://yt3.example/z.jpg" }]]));
  assert.notEqual(next, list);
  assert.equal(next[1].displayName, "ZABUZA");
  assert.equal(next[1].avatarUrl, "https://yt3.example/z.jpg");
  assert.equal(stuck.displayName, ID);
  assert.equal(next[0], healthy);
  assert.equal(next[2], twitch);
});

test("une photo déjà saine n'est pas remplacée", () => {
  const withPhoto = { ...stuck, avatarUrl: "https://yt3.example/mine.jpg" };
  const [fixed] = applyYoutubeRepairs([withPhoto], new Map([[stuck.id, { name: "ZABUZA", avatar: "https://yt3.example/z.jpg" }]]));
  assert.equal(fixed.avatarUrl, "https://yt3.example/mine.jpg");
});

test("repairYoutubeNames résout puis relit la liste avant d'écrire", async () => {
  let stored = [stuck, healthy];
  const saved = [];
  const added = { id: "youtube:new", platform: "youtube", handle: "new", displayName: "New", avatarUrl: "" };
  const count = await repairYoutubeNames({
    getStreamers: async () => stored,
    saveStreamers: async (list) => { saved.push(list); stored = list; },
    resolve: async (handle) => {
      // Une chaîne ajoutée pendant la résolution ne doit pas être perdue.
      stored = [...stored, added];
      return { id: handle, name: "ZABUZA", avatar: "https://yt3.example/z.jpg" };
    },
  });
  assert.equal(count, 1);
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0].map((s) => s.id), [stuck.id, healthy.id, added.id]);
  assert.equal(saved[0][0].displayName, "ZABUZA");
});

test("rien à réparer ou résolution sans nom : aucune écriture", async () => {
  let writes = 0;
  const deps = { saveStreamers: async () => { writes += 1; } };
  assert.equal(await repairYoutubeNames({ ...deps, getStreamers: async () => [healthy, twitch], resolve: async () => null }), 0);
  assert.equal(await repairYoutubeNames({ ...deps, getStreamers: async () => [stuck], resolve: async () => ({ id: ID, name: ID, avatar: "" }) }), 0);
  assert.equal(await repairYoutubeNames({ ...deps, getStreamers: async () => [stuck], resolve: async () => null }), 0);
  assert.equal(writes, 0);
});

test("au plus 5 chaînes par passage", async () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ ...stuck, id: `youtube:UC${String(i).padStart(22, "a")}`, handle: `UC${String(i).padStart(22, "a")}`, displayName: `UC${String(i).padStart(22, "a")}` }));
  let resolved = 0;
  const count = await repairYoutubeNames({
    getStreamers: async () => many,
    saveStreamers: async () => {},
    resolve: async (handle) => { resolved += 1; return { id: handle, name: "Nom", avatar: "" }; },
  });
  assert.equal(resolved, 5);
  assert.equal(count, 5);
});
