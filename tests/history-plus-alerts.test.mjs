import test from "node:test";
import assert from "node:assert/strict";
import {
  addSession,
  emptyHistory,
  markSeen,
  patchSession,
  selectMissed,
  summarize,
  formatClock,
  HISTORY_MAX_AGE_MS,
} from "../js/history-data.js";
import { normalizeRules, ruleMatches, decideSmartAlert, normalizeRule } from "../js/smart-alerts.js";
import { normalizeLicenseKey, isPlusActive, verifyLicense, needsRecheck, PLUS_GRACE_MS, PLUS_RECHECK_MS } from "../js/plus.js";

const NOW = Date.parse("2026-09-14T12:00:00Z");
const session = (over = {}) => ({
  streamerId: "twitch:kamet0",
  platform: "twitch",
  handle: "kamet0",
  title: "GTA RP",
  game: "Grand Theft Auto V",
  startedAt: "2026-09-14T06:00:00Z",
  endedAt: "2026-09-14T09:00:00Z",
  ...over,
});

test("addSession enregistre une session terminée avec sa durée", () => {
  const { entries } = addSession(emptyHistory(), session(), NOW);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].durationSec, 3 * 3600);
  assert.equal(entries[0].seen, false);
});

test("addSession ignore les sessions de moins de 5 minutes", () => {
  const { entries } = addSession(emptyHistory(), session({ endedAt: "2026-09-14T06:03:00Z" }), NOW);
  assert.equal(entries.length, 0);
});

test("addSession met à jour sans dupliquer et garde l'état vu", () => {
  let history = addSession(emptyHistory(), session(), NOW);
  history = markSeen(history, history.entries[0].id);
  history = addSession(history, session({ title: "Nouveau titre" }), NOW);
  assert.equal(history.entries.length, 1);
  assert.equal(history.entries[0].title, "Nouveau titre");
  assert.equal(history.entries[0].seen, true);
});

test("addSession oublie les sessions trop anciennes et trie du plus récent", () => {
  const old = session({ streamerId: "twitch:old", startedAt: NOW - HISTORY_MAX_AGE_MS - 7200000, endedAt: NOW - HISTORY_MAX_AGE_MS - 3600000 });
  let history = addSession(emptyHistory(), old, NOW - HISTORY_MAX_AGE_MS);
  history = addSession(history, session({ streamerId: "kick:teuf", platform: "kick", startedAt: "2026-09-14T08:00:00Z", endedAt: "2026-09-14T11:00:00Z" }), NOW);
  history = addSession(history, session(), NOW);
  assert.deepEqual(history.entries.map((e) => e.streamerId), ["kick:teuf", "twitch:kamet0"]);
});

test("selectMissed exclut les lives regardés et filtre par plateforme", () => {
  let history = addSession(emptyHistory(), session(), NOW);
  history = addSession(history, session({ streamerId: "kick:teuf", platform: "kick" }), NOW);
  history = addSession(history, session({ streamerId: "twitch:vu", watched: true }), NOW);
  assert.equal(selectMissed(history).length, 2);
  assert.equal(selectMissed(history, { platform: "kick" }).length, 1);
  const stats = summarize(selectMissed(history));
  assert.equal(stats.totalSeconds, 6 * 3600);
  assert.equal(stats.unseen, 2);
});

test("patchSession complète une session (VOD trouvée après coup)", () => {
  let history = addSession(emptyHistory(), session(), NOW);
  history = patchSession(history, history.entries[0].id, { vodUrl: "https://www.twitch.tv/videos/1" });
  assert.equal(history.entries[0].vodUrl, "https://www.twitch.tv/videos/1");
});

test("formatClock formate une durée de VOD", () => {
  assert.equal(formatClock(11524), "3:12:04");
  assert.equal(formatClock(125), "2:05");
});

test("ruleMatches combine jeu, mots du titre et seuil de viewers", () => {
  const rule = normalizeRule({ games: ["grand theft auto v"], keywords: ["événement"], minViewers: 5000 });
  const live = { isLive: true, game: "Grand Theft Auto V", title: "Gros EVENEMENT ce soir", viewers: 8000 };
  assert.equal(ruleMatches(rule, live), true);
  assert.equal(ruleMatches(rule, { ...live, viewers: 100 }), false);
  assert.equal(ruleMatches(rule, { ...live, game: "Minecraft" }), false);
  assert.equal(ruleMatches(rule, { ...live, isLive: false }), false);
});

test("decideSmartAlert : pas de règle active, l'alerte classique s'applique", () => {
  assert.equal(decideSmartAlert([], { isLive: true }), null);
  assert.equal(decideSmartAlert([normalizeRule({ enabled: false })], { isLive: true }), null);
});

test("decideSmartAlert ne prévient qu'une fois quand une règle devient vraie", () => {
  const rules = [normalizeRule({ id: "gta", games: ["Grand Theft Auto V"] })];
  const first = decideSmartAlert(rules, { isLive: true, game: "Just Chatting" }, []);
  assert.equal(first.notifyRule, null);
  const second = decideSmartAlert(rules, { isLive: true, game: "Grand Theft Auto V" }, first.matchedIds);
  assert.equal(second.notifyRule.id, "gta");
  const third = decideSmartAlert(rules, { isLive: true, game: "Grand Theft Auto V" }, second.matchedIds);
  assert.equal(third.notifyRule, null);
});

test("normalizeRules nettoie les termes et retire les streamers vides", () => {
  const rules = normalizeRules({ "twitch:a": [{ games: [" GTA ", "gta", ""] }], "twitch:b": [] });
  assert.deepEqual(Object.keys(rules), ["twitch:a"]);
  assert.deepEqual(rules["twitch:a"][0].games, ["GTA"]);
});

test("normalizeLicenseKey accepte les saisies approximatives", () => {
  assert.equal(normalizeLicenseKey("sp-abcd-1234-efgh-5678"), "SP-ABCD-1234-EFGH-5678");
  assert.equal(normalizeLicenseKey("abcd 1234 efgh 5678"), "SP-ABCD-1234-EFGH-5678");
  assert.equal(normalizeLicenseKey("SP-ABCD"), null);
});

test("isPlusActive : à vie toujours actif, mensuel tant que la vérification est récente", () => {
  const base = { licenseKey: "SP-ABCD-1234-EFGH-5678", status: "active", verifiedAt: NOW };
  assert.equal(isPlusActive({ ...base, plan: "lifetime", verifiedAt: 0 }, NOW), true);
  assert.equal(isPlusActive({ ...base, plan: "monthly" }, NOW + PLUS_GRACE_MS - 1), true);
  assert.equal(isPlusActive({ ...base, plan: "monthly" }, NOW + PLUS_GRACE_MS + 1), false);
  assert.equal(isPlusActive(null, NOW), false);
});

test("needsRecheck revérifie une licence active au bout de 24 h", () => {
  const record = { licenseKey: "SP-ABCD-1234-EFGH-5678", status: "active", plan: "monthly", verifiedAt: NOW };
  assert.equal(needsRecheck(record, NOW + PLUS_RECHECK_MS - 1), false);
  assert.equal(needsRecheck(record, NOW + PLUS_RECHECK_MS), true);
  assert.equal(needsRecheck({ ...record, checkedAt: NOW + PLUS_RECHECK_MS }, NOW + PLUS_RECHECK_MS + 1), false);
  assert.equal(needsRecheck(null, NOW), false);
});

test("verifyLicense gère format, clé refusée, réseau et succès", async () => {
  const ok = async () => ({ ok: true, status: 200, json: async () => ({ valid: true, plan: "lifetime" }) });
  const refused = async () => ({ ok: false, status: 404, json: async () => ({ valid: false }) });
  const full = async () => ({ ok: false, status: 403, json: async () => ({ valid: false, error: "device_limit" }) });
  const down = async () => { throw new Error("offline"); };
  assert.deepEqual(await verifyLicense("nope", ok, NOW), { ok: false, error: "format" });
  assert.deepEqual(await verifyLicense("SP-ABCD-1234-EFGH-5678", refused, NOW), { ok: false, error: "invalid" });
  assert.deepEqual(await verifyLicense("SP-ABCD-1234-EFGH-5678", down, NOW), { ok: false, error: "network" });
  assert.deepEqual(await verifyLicense("SP-ABCD-1234-EFGH-5678", full, NOW, "a".repeat(32)), { ok: false, error: "device_limit" });
  const result = await verifyLicense("abcd-1234-efgh-5678", ok, NOW);
  assert.equal(result.ok, true);
  assert.equal(result.record.plan, "lifetime");
});

test("verifyLicense garde le rôle fondateur et ignore tout autre rôle", async () => {
  const reply = (role) => async () => ({ ok: true, status: 200, json: async () => ({ valid: true, plan: "lifetime", referrals: 2, role }) });
  const admin = await verifyLicense("SP-ABCD-1234-EFGH-5678", reply("admin"), NOW);
  assert.equal(admin.record.role, "admin");
  assert.equal(admin.record.referrals, 2);
  assert.equal((await verifyLicense("SP-ABCD-1234-EFGH-5678", reply("root"), NOW)).record.role, "");
  assert.equal((await verifyLicense("SP-ABCD-1234-EFGH-5678", reply(undefined), NOW)).record.role, "");
});
