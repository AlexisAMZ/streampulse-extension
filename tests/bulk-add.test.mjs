import test from "node:test";
import assert from "node:assert/strict";
import { MAX_BULK_SIZE, getBulkKey, parseBulkAdd } from "../js/bulk-add.js";

test("parses handles and channel links without looking up accounts", () => {
  const parsed = parseBulkAdd([
    "  @sp_test_one , https://www.twitch.tv/SP_TEST_TWO/videos?filter=all ",
    "kick.com/sp-test-three; https://m.youtube.com/@SP_TEST_FOUR/streams",
    "https://youtube.com/channel/UCabcdefghijklmnopqrstuv\tsp_test_five",
  ].join("\r\n"), { defaultPlatform: "kick" });
  assert.deepEqual(parsed.rows.map(({ platform, handle, status, selected }) => ({ platform, handle, status, selected })), [
    { platform: "kick", handle: "sp_test_one", status: "ready", selected: true },
    { platform: "twitch", handle: "sp_test_two", status: "ready", selected: true },
    { platform: "kick", handle: "sp-test-three", status: "ready", selected: true },
    { platform: "youtube", handle: "sp_test_four", status: "ready", selected: true },
    { platform: "youtube", handle: "UCabcdefghijklmnopqrstuv", status: "ready", selected: true },
    { platform: "kick", handle: "sp_test_five", status: "ready", selected: true },
  ]);
  assert.equal(parsed.total, 6);
  assert.equal(parsed.overLimit, false);
  assert.equal(parsed.rows[0].raw, "@sp_test_one");
});

test("uses the selected platform only for bare handles", () => {
  for (const defaultPlatform of ["twitch", "kick", "youtube"]) {
    const { rows } = parseBulkAdd("@sp_test_one\nhttps://twitch.tv/sp_test_two", { defaultPlatform });
    assert.equal(rows[0].platform, defaultPlatform);
    assert.equal(rows[1].platform, "twitch");
  }
  assert.equal(parseBulkAdd("sp_test_one", { defaultPlatform: "unknown" }).rows[0].platform, "twitch");
  assert.equal(parseBulkAdd("sp_test_one", { defaultPlatform: "constructor" }).rows[0].platform, "twitch");
});

test("rejects unsafe hosts, videos, system routes and lossy handle cleanup", () => {
  const invalid = [
    "https://twitch.tv.evil.test/sp_test_one",
    "https://evil.test/twitch.tv/sp_test_one",
    "https://twitch.tv@evil.test/sp_test_one",
    "https://sp_test_one@twitch.tv/sp_test_one",
    "https://twitch.tv:8080/sp_test_one",
    "javascript:sp_test_one",
    "ftp://twitch.tv/sp_test_one",
    "https://twitch.tv/",
    "https://twitch.tv/directory/category/test",
    "https://clips.twitch.tv/sp_test_clip",
    "https://kick.com/browse",
    "https://kick.com/account-settings",
    "https://kick.com/help-center",
    "https://youtube.com/watch?v=sp_test_video",
    "https://youtu.be/sp_test_video",
    "https://youtube.com/shorts/sp_test_video",
    "https://youtube.com/c/sp_test_one",
    "https://youtube.com/user/sp_test_one",
    "https://youtube.com/@sp_test_one/not-a-channel-tab",
    "https://youtube.com/channel/not_a_channel_id",
    "https://twitch.tv/sp_test_one%2Fsp_test_two",
    "https://twitch.tv/sp_test_one%ZZ",
    "https://twitch.tv/sp_test_one\\videos",
    "sp test one",
    "sp_test_one!",
    "<sp_test_one>",
    "@@sp_test_one",
    "@",
    "a".repeat(26),
  ];
  for (const raw of invalid) {
    const { rows } = parseBulkAdd(raw);
    assert.equal(rows.length, 1, raw);
    assert.equal(rows[0].status, "invalid", raw);
    assert.equal(rows[0].selected, false, raw);
    assert.equal(rows[0].raw, raw);
    assert.equal(rows[0].handle, "", raw);
  }
});

test("accepts safe channel URL variants and supported YouTube identifiers", () => {
  const { rows } = parseBulkAdd([
    "http://twitch.tv/SP_TEST_ONE/",
    "//www.kick.com/sp_test_two?ref=test#about",
    "https://www.youtube.com/%40sp_test_three/live",
    "@sp.test-four",
    "UCabcdefghijklmnopqrstuv",
  ].join("\n"), { defaultPlatform: "youtube" });
  assert.ok(rows.every((row) => row.status === "ready"));
  assert.equal(rows[2].handle, "sp_test_three");
  assert.equal(rows[3].handle, "sp.test-four");
  assert.equal(rows[4].handle, "UCabcdefghijklmnopqrstuv");
  assert.equal(parseBulkAdd("ab", { defaultPlatform: "youtube" }).rows[0].status, "invalid");
});

test("distinguishes existing and in-batch duplicates without mutating storage", () => {
  const streamers = Object.freeze([
    Object.freeze({ id: "sp_test_one", twitch: "sp_test_one" }),
    Object.freeze({ id: "kick:sp_test_two", platform: "kick" }),
    Object.freeze({ id: "youtube:sp_test_three", platform: "youtube", handle: "@SP_TEST_THREE" }),
    null,
  ]);
  const { rows } = parseBulkAdd([
    "SP_TEST_ONE",
    "https://twitch.tv/sp_test_one",
    "kick.com/sp_test_one",
    "kick.com/sp_test_two",
    "youtube.com/@sp_test_three",
    "sp_test_four",
    "@SP_TEST_FOUR",
  ].join("\n"), { streamers });
  assert.deepEqual(rows.map((row) => row.status), ["existing", "duplicate", "ready", "existing", "existing", "ready", "duplicate"]);
  assert.deepEqual(rows.map((row) => row.selected), [false, false, true, false, false, true, false]);
});

test("YouTube channel IDs retain their case-sensitive identity", () => {
  const first = "UCabcdefghijklmnopqrstuv";
  const second = "UCAbcdefghijklmnopqrstuv";
  const { rows } = parseBulkAdd(`${first}\n${second}\n${first}`, {
    defaultPlatform: "youtube",
    streamers: [{ id: `youtube:${first}`, platform: "youtube", handle: first }],
  });
  assert.deepEqual(rows.map((row) => row.status), ["existing", "ready", "duplicate"]);
  assert.notEqual(getBulkKey(rows[0]), getBulkKey(rows[1]));
  assert.equal(getBulkKey({ platform: "youtube", handle: "@SP_TEST_ONE" }), "youtube:sp_test_one");
  assert.equal(getBulkKey(null), "");
});

test("limits preview to 50 entries and reports overflow rather than silently importing", () => {
  assert.equal(MAX_BULK_SIZE, 50);
  const source = Array.from({ length: 51 }, (_, i) => `sp_test_${i}`).join("\n");
  const parsed = parseBulkAdd(source);
  assert.equal(parsed.total, 51);
  assert.equal(parsed.rows.length, 50);
  assert.equal(parsed.overLimit, true);
  assert.equal(parseBulkAdd(source.split("\n").slice(0, 50).join("\n")).overLimit, false);
});

test("empty and non-text input produce no fabricated candidates", () => {
  for (const value of ["", " \n,;\t\r\n ", null, undefined, 123, {}]) {
    assert.deepEqual(parseBulkAdd(value), { rows: [], total: 0, overLimit: false });
  }
});
