import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseBulkAdd } from "../js/bulk-add.js";
import { executeBulkAdd } from "../js/bulk-add-page.js";

function harness(initial = {}) {
  const stored = { betaGeneralStreamers: [], betaChannelGroups: [], ...structuredClone(initial) };
  const calls = [];
  const writes = [];
  const storage = {
    async get(keys) {
      return structuredClone(Object.fromEntries(keys.map((key) => [key, stored[key]])));
    },
    async set(value) {
      writes.push(structuredClone(value));
      Object.assign(stored, structuredClone(value));
    },
  };
  const sendMessage = async (message) => {
    calls.push(message);
    const streamer = { ...message, id: `returned-${message.platform}-${message.handle}` };
    stored.betaGeneralStreamers.push(streamer);
    return { success: true, streamers: structuredClone(stored.betaGeneralStreamers) };
  };
  return { stored, calls, writes, storage, sendMessage };
}

test("only selected candidates run, sequentially, through addStreamer", async () => {
  const h = harness();
  const { rows } = parseBulkAdd("sp_test_one\nsp_test_two\nsp_test_three\nsp_test_one\n<bad>");
  rows[1].selected = false;
  let release;
  let active = 0;
  let peak = 0;
  const sendMessage = async (message) => {
    active += 1;
    peak = Math.max(peak, active);
    if (message.handle === "sp_test_one") await new Promise((resolve) => { release = resolve; });
    const response = await h.sendMessage(message);
    active -= 1;
    return response;
  };
  const pending = executeBulkAdd(rows, { ...h, sendMessage });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(rows[0].status, "adding");
  assert.equal(rows[2].status, "ready");
  release();
  await pending;
  assert.equal(peak, 1);
  assert.deepEqual(h.calls, [
    { type: "addStreamer", platform: "twitch", handle: "sp_test_one" },
    { type: "addStreamer", platform: "twitch", handle: "sp_test_three" },
  ]);
  assert.deepEqual(rows.map((row) => row.status), ["success", "ready", "success", "duplicate", "invalid"]);
  assert.equal(rows[0].selected, false);
  assert.equal(rows[0].streamerId, "returned-twitch-sp_test_one");
});

test("requires success === true; failed rows keep their input and retry without successes", async () => {
  const h = harness();
  const responses = [null, undefined, {}, { success: false }, { success: "true" }, { success: 1 }, { error: "Test refusal" }];
  const { rows } = parseBulkAdd(Array.from({ length: responses.length + 1 }, (_, i) => `sp_test_${i}`).join("\n"));
  const attempts = [];
  await executeBulkAdd(rows, {
    ...h,
    async sendMessage(message) {
      attempts.push(message.handle);
      return message.handle === "sp_test_0" ? h.sendMessage(message) : responses[Number(message.handle.slice(8)) - 1];
    },
  });
  assert.equal(rows[0].status, "success");
  for (const row of rows.slice(1)) {
    assert.equal(row.status, "error");
    assert.equal(row.selected, true);
    assert.equal(row.raw, row.handle);
    assert.notEqual(row.added, true);
  }
  assert.equal(rows.at(-1).error, "Test refusal");
  const retry = [];
  await executeBulkAdd(rows, { ...h, sendMessage: (message) => { retry.push(message.handle); return h.sendMessage(message); } });
  assert.deepEqual(retry, attempts.slice(1));
  assert.ok(rows.every((row) => row.status === "success"));
});

test("transport or storage failures leave retryable rows and do not stop later candidates", async () => {
  const h = harness();
  const { rows } = parseBulkAdd("sp_test_one\nsp_test_two");
  await executeBulkAdd(rows, {
    ...h,
    sendMessage: (message) => message.handle === "sp_test_one" ? Promise.reject(new Error("test transport")) : h.sendMessage(message),
  });
  assert.deepEqual(rows.map((row) => row.status), ["error", "success"]);
  assert.equal(rows[0].errorKey, "bulk.addFailed");
  await executeBulkAdd(rows, { ...h, storage: { ...h.storage, get: async () => { throw new Error("test read"); } } });
  assert.equal(rows[0].errorKey, "bulk.readFailed");
  assert.equal(h.calls.length, 1);
  await executeBulkAdd(rows, h);
  assert.ok(rows.every((row) => row.status === "success"));
});

test("rereads existing streamers before each add, including after an ambiguous rejection", async () => {
  const h = harness();
  const { rows } = parseBulkAdd("sp_test_one\nsp_test_two");
  await executeBulkAdd(rows, {
    ...h,
    async sendMessage(message) {
      const response = await h.sendMessage(message);
      h.stored.betaGeneralStreamers.push({ id: "other-tab-id", platform: "twitch", handle: "sp_test_two" });
      return response;
    },
  });
  assert.deepEqual(rows.map((row) => row.status), ["success", "existing"]);
  assert.equal(h.calls.length, 1);

  const retryRows = parseBulkAdd("sp_test_three").rows;
  await executeBulkAdd(retryRows, {
    ...h,
    async sendMessage(message) {
      await h.sendMessage(message);
      throw new Error("test reply lost after save");
    },
  });
  assert.equal(retryRows[0].status, "error");
  await executeBulkAdd(retryRows, h);
  assert.equal(retryRows[0].status, "existing");
  assert.equal(h.calls.length, 2);
});

test("group writes use verified returned IDs and preserve current groups and metadata", async () => {
  const h = harness({ betaChannelGroups: [{ id: "target", name: "Test group", memberIds: ["old-id"], color: "test-color" }] });
  const { rows } = parseBulkAdd("sp_test_one\nkick.com/sp_test_two");
  await executeBulkAdd(rows, {
    ...h, groupId: "target",
    async sendMessage(message) {
      const response = await h.sendMessage(message);
      if (message.handle === "sp_test_one") h.stored.betaChannelGroups.push({ id: "other", name: "Other test group", memberIds: ["other-id"] });
      else {
        h.stored.betaChannelGroups[0].name = "Renamed test group";
        h.stored.betaChannelGroups[0].memberIds.push("concurrent-id");
        h.stored.betaChannelGroups[1].memberIds.push("other-concurrent-id");
      }
      return response;
    },
  });
  assert.deepEqual(h.stored.betaChannelGroups, [
    { id: "target", name: "Renamed test group", memberIds: ["old-id", "returned-twitch-sp_test_one", "concurrent-id", "returned-kick-sp_test_two"], color: "test-color" },
    { id: "other", name: "Other test group", memberIds: ["other-id", "other-concurrent-id"] },
  ]);
  assert.ok(h.writes.every((write) => Object.keys(write).join() === "betaChannelGroups"));
  assert.equal(h.writes.length, 2);
});

test("group write failure retries only membership, not the acknowledged add", async () => {
  const h = harness({ betaChannelGroups: [{ id: "target", name: "Test group", memberIds: [] }] });
  const { rows } = parseBulkAdd("sp_test_one");
  await executeBulkAdd(rows, { ...h, groupId: "target", storage: { ...h.storage, set: async () => { throw new Error("test write"); } } });
  assert.equal(rows[0].added, true);
  assert.equal(rows[0].status, "error");
  assert.equal(rows[0].errorKey, "bulk.groupFailed");
  await executeBulkAdd(rows, { ...h, groupId: "target" });
  assert.equal(rows[0].status, "success");
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.stored.betaChannelGroups[0].memberIds, ["returned-twitch-sp_test_one"]);
  await executeBulkAdd(rows, { ...h, groupId: "target" });
  assert.equal(h.writes.length, 1);
});

test("a removed group is not recreated; retry may choose no group", async () => {
  const h = harness({ betaChannelGroups: [{ id: "target", name: "Test group", memberIds: [] }] });
  const { rows } = parseBulkAdd("sp_test_one");
  await executeBulkAdd(rows, {
    ...h, groupId: "target",
    async sendMessage(message) {
      const response = await h.sendMessage(message);
      h.stored.betaChannelGroups = [];
      return response;
    },
  });
  assert.equal(rows[0].errorKey, "bulk.groupMissing");
  assert.equal(rows[0].added, true);
  assert.deepEqual(h.writes, []);
  await executeBulkAdd(rows, h);
  assert.equal(rows[0].status, "success");
  assert.equal(h.calls.length, 1);
});

test("missing, unrelated or unpersisted returned IDs never become group members", async () => {
  for (const reply of [
    { success: true },
    { success: true, id: "guessed-id", streamers: [] },
    { success: true, streamers: [{ id: "unrelated-id", platform: "twitch", handle: "sp_test_other" }] },
    { success: true, streamers: [{ id: "not-stored-id", platform: "twitch", handle: "sp_test_one" }] },
  ]) {
    const h = harness({ betaChannelGroups: [{ id: "target", name: "Test group", memberIds: [] }] });
    const { rows } = parseBulkAdd("sp_test_one");
    let attempts = 0;
    const options = { ...h, groupId: "target", sendMessage: async () => { attempts += 1; return reply; } };
    await executeBulkAdd(rows, options);
    assert.equal(rows[0].status, "error");
    assert.equal(rows[0].added, true);
    assert.equal(rows[0].errorKey, "bulk.verifyFailed");
    await executeBulkAdd(rows, options);
    assert.equal(attempts, 1);
    assert.deepEqual(h.writes, []);
  }
});

test("verification can recover after storage becomes available without resending the add", async () => {
  const h = harness();
  const { rows } = parseBulkAdd("sp_test_one");
  let reads = 0;
  await executeBulkAdd(rows, {
    ...h,
    storage: { ...h.storage, get: (keys) => { reads += 1; if (reads === 2) throw new Error("test verify read"); return h.storage.get(keys); } },
  });
  assert.equal(rows[0].errorKey, "bulk.verifyFailed");
  assert.equal(rows[0].added, true);
  await executeBulkAdd(rows, h);
  assert.equal(rows[0].status, "success");
  assert.equal(h.calls.length, 1);
});

test("existing membership is not written twice and cross-platform IDs cannot match", async () => {
  const h = harness({ betaChannelGroups: [{ id: "target", name: "Test group", memberIds: ["returned-twitch-sp_test_one"] }] });
  await executeBulkAdd(parseBulkAdd("sp_test_one").rows, { ...h, groupId: "target" });
  assert.deepEqual(h.writes, []);
  const { rows } = parseBulkAdd("kick.com/sp_test_two");
  await executeBulkAdd(rows, {
    ...h, groupId: "target",
    sendMessage: async () => ({ success: true, streamers: [{ id: "wrong-platform-id", platform: "twitch", handle: "sp_test_two" }] }),
  });
  assert.equal(rows[0].errorKey, "bulk.verifyFailed");
  assert.deepEqual(h.writes, []);
});

test("execution rejects oversized batches before any message", async () => {
  const h = harness();
  const row = parseBulkAdd("sp_test_one").rows[0];
  await assert.rejects(executeBulkAdd(Array.from({ length: 51 }, () => ({ ...row })), h), /bulk.tooMany/);
  assert.deepEqual(h.calls, []);
});

test("the standalone page uses shared design, translated labels and an external ES module", async () => {
  const html = await readFile(new URL("../html/bulk-add.html", import.meta.url), "utf8");
  assert.match(html, /css\/tokens\.css/);
  assert.match(html, /css\/pages\.css/);
  assert.match(html, /css\/bulk-add\.css/);
  assert.match(html, /type="module" src="\.\.\/js\/bulk-add-page\.js"/);
  assert.match(html, /data-i18n="bulk\.title"/);
  assert.match(html, /role="alert"/);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(html, /<script(?![^>]*src=)[^>]*>|\son\w+\s*=/i);
});
