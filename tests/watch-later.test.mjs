import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  WATCH_LATER_KEY, WATCH_LATER_LIMITS, mergeWatchLater, normalizeWatchLater,
} from "../js/watch-later.js";
import { saveWatchLater } from "../js/popup-watch-later.js";
import { createFakeChrome } from "./helpers/fake-chrome.mjs";

const NOW = Date.parse("2026-10-17T12:00:00.000Z");
const entry = (index = 0, extra = {}) => ({
  id: `saved-${index}`, url: `https://www.twitch.tv/videos/${index}`,
  title: `Video ${index}`, note: "", createdAt: NOW - index, platform: "twitch", ...extra,
});

test("storage contract, pure normalization and canonical URL deduplication", () => {
  assert.equal(WATCH_LATER_KEY, "streamPulseWatchLater");
  assert.equal(WATCH_LATER_LIMITS.entries, 200);
  const source = Object.freeze([
    Object.freeze(entry(1, { url: " HTTPS://WWW.TWITCH.TV:443/videos/1 ", title: " Final ", note: "  round 2\n42:00  ", platform: "kick", extra: true })),
    Object.freeze(entry(2, { url: "https://www.twitch.tv/videos/1", note: "duplicate" })),
  ]);
  const normalized = normalizeWatchLater(source);
  assert.deepEqual(normalized, [entry(1, { title: "Final", note: "  round 2\n42:00  " })]);
  assert.notEqual(normalized[0], source[0]);
  assert.deepEqual(normalizeWatchLater(normalized), normalized);
});

test("only the exact supported HTTPS hosts are admitted; timestamps and queries survive", () => {
  const hosts = {
    "twitch.tv": "twitch", "www.twitch.tv": "twitch", "clips.twitch.tv": "twitch",
    "kick.com": "kick", "youtube.com": "youtube", "www.youtube.com": "youtube", "youtu.be": "youtube",
  };
  for (const [host, platform] of Object.entries(hosts)) {
    const url = `https://${host}/watch?v=abc&t=42#chapter`;
    assert.deepEqual(normalizeWatchLater([entry(0, { url })]), [entry(0, { url, platform })]);
  }
});

const unsafeURLs = [
  "", "not a URL", "/videos/1", "//twitch.tv/videos/1", "https:twitch.tv/videos/1",
  "http://twitch.tv/a", "javascript:alert(1)", "data:text/html,<script>alert(1)</script>",
  "file:///tmp/watch", "ftp://kick.com/a", "https://evil.example/a",
  "https://twitch.tv.evil.example/a", "https://evil-twitch.tv/a", "https://m.youtube.com/a",
  "https://player.twitch.tv/a", "https://clips.twitch.tv.evil.example/a", "https://www.kick.com/a",
  "https://kick.com.evil.example/a", "https://youtube.com.evil.example/a", "https://www.youtu.be/a",
  "https://evil.example@twitch.tv/a", "https://user:secret@kick.com/a", "https://@youtube.com/a",
  "https://twitch.tv@evil.example/a", "https://twitch.tv:444/a", "https://twitch.tv./a",
  "https://twi\ntch.tv/a", "https://twi\ttch.tv/a", "https://twitch.tv/\u0000a",
  "https://twitch.tv\\@evil.example/a", "https:///twitch.tv/a", "https://twitch.tv/a b",
  "https://tw\u0456tch.tv/a", "https://localhost/a", "https://127.0.0.1/a",
  null, 42, {}, ["https://twitch.tv/a"],
];

test("malicious and malformed URLs are dropped on read and rejected on save", () => {
  for (const url of unsafeURLs) {
    assert.deepEqual(normalizeWatchLater([entry(0, { url })]), [], String(url));
    assert.throws(() => mergeWatchLater([], { url }), { code: "invalidUrl" }, String(url));
  }
});

test("corrupt containers and fields are deterministic, bounded and stripped to the contract", () => {
  for (const value of [null, undefined, {}, "array", 12]) assert.deepEqual(normalizeWatchLater(value), []);
  assert.deepEqual(normalizeWatchLater([null, 12, "item", [], {}]), []);
  const url = "https://kick.com/caster";
  assert.deepEqual(normalizeWatchLater([{ url, id: 1, title: {}, note: [], createdAt: "wrong", platform: "youtube" }]), [{
    id: url, url, title: url, note: "", createdAt: 0, platform: "kick",
  }]);
  const normalized = normalizeWatchLater([entry(1, {
    title: "a".repeat(WATCH_LATER_LIMITS.title + 1), note: "b".repeat(WATCH_LATER_LIMITS.note + 1),
  })])[0];
  assert.equal(normalized.title.length, WATCH_LATER_LIMITS.title);
  assert.equal(normalized.note.length, WATCH_LATER_LIMITS.note);
});

test("a long URL used as the fallback title remains stable across reads and merges", () => {
  const url = `https://www.youtube.com/watch?v=${"a".repeat(400)}`;
  const result = mergeWatchLater([], { url });
  assert.equal(result.entry.title.length, WATCH_LATER_LIMITS.title);
  assert.deepEqual(normalizeWatchLater(result.entries), result.entries);
  assert.deepEqual(normalizeWatchLater(normalizeWatchLater([{ url }])), normalizeWatchLater([{ url }]));
  const truncated = normalizeWatchLater([entry(0, { title: `${"a".repeat(299)} b` })]);
  assert.deepEqual(normalizeWatchLater(truncated), truncated);
});

test("dates accept milliseconds and ISO strings, never replace unknown dates with today's date", () => {
  assert.equal(normalizeWatchLater([entry(0, { createdAt: "2026-10-17T14:00:00+02:00" })])[0].createdAt, NOW);
  for (const createdAt of [undefined, null, true, [], {}, "", "invalid", -1, Infinity, NaN, 8.64e15 + 1]) {
    assert.equal(normalizeWatchLater([entry(0, { createdAt })])[0].createdAt, 0, String(createdAt));
  }
  assert.equal(normalizeWatchLater([entry(0, { createdAt: 0 })])[0].createdAt, 0);
  assert.equal(normalizeWatchLater([entry(0, { createdAt: 8.64e15 })])[0].createdAt, 8.64e15);
});

test("cap applies after filtering and deduplication, without mutating or reordering retained entries", () => {
  const valid = Array.from({ length: 205 }, (_, i) => entry(i));
  const source = [null, entry(999, { url: "javascript:alert(1)" }), valid[0], ...valid];
  assert.deepEqual(normalizeWatchLater(source), valid.slice(0, 200));
  assert.equal(source.length, 208);
});

test("merge prepends a new item and derives its platform rather than trusting input", () => {
  const existing = Object.freeze([Object.freeze(entry())]);
  const result = mergeWatchLater(existing, {
    url: "https://youtu.be/video?t=42", title: "  Final  ", note: "  watch later\nlast round  ",
    id: "injected", createdAt: -1, platform: "twitch",
  }, { id: "new-id", createdAt: NOW });
  assert.deepEqual(result.entry, {
    id: "new-id", url: "https://youtu.be/video?t=42", title: "Final", note: "  watch later\nlast round  ",
    createdAt: NOW, platform: "youtube",
  });
  assert.deepEqual(result.entries, [result.entry, entry()]);
});

test("merge preserves the original id/date and omitted title/note, but an empty note clears it", () => {
  const saved = entry(1, { note: "personal note" });
  const updated = mergeWatchLater([entry(), saved], { url: saved.url, title: "Renamed" }, { id: "new", createdAt: NOW + 1000 });
  assert.deepEqual(updated.entries, [entry(), { ...saved, title: "Renamed" }]);
  assert.deepEqual(mergeWatchLater(updated.entries, { url: saved.url }).entry, updated.entry);
  assert.equal(mergeWatchLater(updated.entries, { url: saved.url, note: "" }).entry.note, "");
  assert.equal(mergeWatchLater([], { url: saved.url }).entry.title, saved.url);
  assert.equal(mergeWatchLater([saved], { url: saved.url, title: " " }).entry.title, saved.title);
});

test("full lists reject new URLs without eviction, but allow edits and duplicate saves", () => {
  const full = Array.from({ length: 200 }, (_, i) => entry(i));
  assert.throws(() => mergeWatchLater(full, { url: "https://kick.com/new" }), { code: "full" });
  const updated = mergeWatchLater(full, { url: full[42].url, note: "42:00" });
  assert.equal(updated.entries.length, 200);
  assert.deepEqual(updated.entries[42], { ...full[42], note: "42:00" });
  assert.equal(full[42].note, "");
});

test("user fields are validated rather than silently truncated when saving", () => {
  for (const [field, code] of [["title", "invalidTitle"], ["note", "invalidNote"]]) {
    for (const value of [null, 12, {}, [], "x".repeat(WATCH_LATER_LIMITS[field] + 1)]) {
      assert.throws(() => mergeWatchLater([], { url: entry().url, [field]: value }), { code });
    }
  }
  const longURL = `https://twitch.tv/${"a".repeat(WATCH_LATER_LIMITS.url)}`;
  assert.deepEqual(normalizeWatchLater([entry(0, { url: longURL })]), []);
  assert.throws(() => mergeWatchLater([], { url: longURL }), { code: "invalidUrl" });
  for (const input of [undefined, null, [], 42]) assert.throws(() => mergeWatchLater([], input), { code: "invalidUrl" });
});

let fake, writes, reads;
beforeEach((t) => {
  fake = createFakeChrome({ local: { unrelated: { keep: true } } });
  globalThis.chrome = fake;
  writes = [];
  reads = [];
  const get = fake.storage.local.get;
  const set = fake.storage.local.set;
  t.mock.method(fake.storage.local, "get", async (key) => { reads.push(key); return get(key); });
  t.mock.method(fake.storage.local, "set", async (values) => { writes.push(structuredClone(values)); return set(values); });
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Network forbidden"); });
  t.after(() => { delete globalThis.chrome; });
});

test("save reads the current list on every gesture and only writes its own storage key", async () => {
  await fake.storage.local.set({ [WATCH_LATER_KEY]: [entry()] });
  const first = await saveWatchLater({ url: "https://kick.com/one", note: "keep this" });
  assert.ok(first.id);
  assert.ok(Math.abs(first.createdAt - Date.now()) < 1000);
  const external = entry(2);
  await fake.storage.local.set({ [WATCH_LATER_KEY]: [external, ...fake.storage.local.dump()[WATCH_LATER_KEY]] });
  const updated = await saveWatchLater({ url: first.url, title: "New title" });
  assert.deepEqual(updated, { ...first, title: "New title" });
  assert.deepEqual(fake.storage.local.dump()[WATCH_LATER_KEY], [external, updated, entry()]);
  assert.deepEqual(fake.storage.local.dump().unrelated, { keep: true });
  assert.deepEqual(reads, [WATCH_LATER_KEY, WATCH_LATER_KEY]);
  assert.ok(writes.every((value) => Object.keys(value).join() === WATCH_LATER_KEY));
  assert.deepEqual(fake.calls, [], "no API, tab, history import or runtime message");
});

test("simultaneous saves serialize read/merge/write, deduplicate and preserve notes", async () => {
  const [first, second, duplicate] = await Promise.all([
    saveWatchLater({ url: "https://kick.com/one", note: "keep" }),
    saveWatchLater({ url: "https://youtu.be/two" }),
    saveWatchLater({ url: "https://kick.com/one", title: "One" }),
  ]);
  assert.deepEqual(duplicate, { ...first, title: "One" });
  assert.deepEqual(fake.storage.local.dump()[WATCH_LATER_KEY], [second, duplicate]);
});

test("write failures reject, keep stored entries and do not poison the next queued save", async (t) => {
  const failure = new Error("Write failed");
  const set = t.mock.method(fake.storage.local, "set", async () => { throw failure; });
  await assert.rejects(saveWatchLater({ url: entry().url }), failure);
  assert.equal(fake.storage.local.dump()[WATCH_LATER_KEY], undefined);
  set.mock.restore();
  await saveWatchLater({ url: entry().url });
  assert.equal(fake.storage.local.dump()[WATCH_LATER_KEY].length, 1);
});

test("failed fresh reads never write an empty replacement", async (t) => {
  await fake.storage.local.set({ [WATCH_LATER_KEY]: [entry()] });
  writes.length = 0;
  const failure = new Error("Read failed");
  t.mock.method(fake.storage.local, "get", async () => { throw failure; });
  await assert.rejects(saveWatchLater({ url: "https://kick.com/one" }), failure);
  assert.deepEqual(writes, []);
  assert.deepEqual(fake.storage.local.dump()[WATCH_LATER_KEY], [entry()]);
});

test("invalid and over-cap saves reject without any write or silent eviction", async () => {
  const full = Array.from({ length: 200 }, (_, i) => entry(i));
  await fake.storage.local.set({ [WATCH_LATER_KEY]: full });
  writes.length = 0;
  await assert.rejects(saveWatchLater({ url: "https://twitch.tv.evil.example" }), { code: "invalidUrl" });
  await assert.rejects(saveWatchLater({ url: "https://kick.com/new" }), { code: "full" });
  assert.deepEqual(writes, []);
  assert.deepEqual(fake.storage.local.dump()[WATCH_LATER_KEY], full);
  await saveWatchLater({ url: full[3].url, note: "edited" });
  assert.equal(fake.storage.local.dump()[WATCH_LATER_KEY][3].note, "edited");
});

test("missing and null save inputs reject with an actionable validation code", async () => {
  for (const input of [undefined, null, 42, []]) await assert.rejects(saveWatchLater(input), { code: "invalidUrl" });
  assert.deepEqual(writes, []);
});
