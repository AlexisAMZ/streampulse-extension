import test from "node:test";
import assert from "node:assert/strict";
import {
  REASONS,
  addGain,
  channelDetail,
  channelName,
  dayKeysForPeriod,
  daySeries,
  emptyState,
  lastGainAt,
  normalizeGain,
  prune,
  stateFrom,
  summarize,
  tierFromFactor,
  toStorage,
  POINTS_DAILY_KEY,
} from "../js/points-data.js";

const NOW = new Date(2026, 8, 26, 21, 50).getTime(); // 26 sept. 2026, 21 h 50, heure locale

/** Charge utile telle que Twitch l'envoie dans un message « points-earned ». */
function raw({ channel = "123", reason = "WATCH", total = 12, base = 10, factor = 0.2, at = NOW, balance = 23410 } = {}) {
  return {
    timestamp: new Date(at).toISOString(),
    channel_id: channel,
    point_gain: {
      user_id: "999",
      channel_id: channel,
      total_points: total,
      baseline_points: base,
      reason_code: reason,
      multipliers: factor ? [{ reason_code: "SUB_T1", factor }] : [],
    },
    balance: { user_id: "999", channel_id: channel, balance },
  };
}

const gainOf = (options, now = NOW) => normalizeGain(raw(options), now);

test("normalizeGain lit un gain de visionnage avec multiplicateur", () => {
  const gain = gainOf();
  assert.equal(gain.channelId, "123");
  assert.equal(gain.reason, "WATCH");
  assert.equal(gain.points, 12);
  assert.equal(gain.base, 10);
  assert.equal(gain.factor, 0.2);
  assert.equal(gain.balance, 23410);
  assert.equal(gain.day, "2026-09-26");
  assert.equal(gain.at, NOW);
  assert.match(gain.key, /^123\|\d+\|WATCH\|12$/);
});

test("normalizeGain range un code inconnu dans OTHER en gardant le code d'origine", () => {
  const gain = gainOf({ reason: "PREDICTION", total: 500, base: 500, factor: 0 });
  assert.equal(gain.reason, "OTHER");
  assert.equal(gain.rawReason, "PREDICTION");
});

test("normalizeGain refuse une charge invalide", () => {
  assert.equal(normalizeGain(null), null);
  assert.equal(normalizeGain({}), null);
  assert.equal(normalizeGain(raw({ channel: "abc" })), null);
  assert.equal(normalizeGain(raw({ total: 0 })), null);
  assert.equal(normalizeGain(raw({ total: 2.5 })), null);
  assert.equal(normalizeGain(raw({ total: 5_000_000 })), null);
});

test("normalizeGain replie la base sur le total quand elle est absente ou incohérente", () => {
  const missing = raw();
  delete missing.point_gain.baseline_points;
  assert.equal(normalizeGain(missing, NOW).base, 12);
  assert.equal(gainOf({ base: 99 }).base, 12);
});

test("normalizeGain prend l'heure courante si l'horodatage est illisible", () => {
  const payload = raw();
  payload.timestamp = "pas une date";
  assert.equal(normalizeGain(payload, NOW).at, NOW);
});

test("addGain agrège par jour, chaîne et raison sans muter l'état", () => {
  const start = emptyState();
  const one = addGain(start, gainOf({ at: NOW - 1000 }));
  const two = addGain(one, gainOf({ at: NOW }));
  assert.deepEqual(start, emptyState());
  assert.deepEqual(two.daily["2026-09-26"]["123"].WATCH, { count: 2, points: 24, base: 20 });
  assert.equal(two.journal.length, 2);
  assert.equal(two.journal[0].at, NOW);
});

test("addGain ignore un doublon (deux onglets reçoivent le même gain)", () => {
  const once = addGain(emptyState(), gainOf());
  const twice = addGain(once, gainOf());
  assert.equal(twice, once);
});

test("addGain garde solde, multiplicateur et dates des gains uniques", () => {
  let state = addGain(emptyState(), gainOf({ at: NOW - 5000, balance: 100 }));
  state = addGain(state, gainOf({ reason: "CHEER", total: 350, base: 350, factor: 0, at: NOW - 4000, balance: 450 }));
  state = addGain(state, gainOf({ reason: "FOLLOW", total: 300, base: 300, factor: 0, at: NOW - 3000, balance: 750 }));
  const channel = state.channels["123"];
  assert.equal(channel.balance, 750);
  assert.equal(channel.factor, 0.2);
  assert.equal(channel.firsts.CHEER, NOW - 4000);
  assert.equal(channel.firsts.FOLLOW, NOW - 3000);
  assert.equal(channel.lastGainAt, NOW - 3000);
});

test("addGain ne remplace pas un solde récent par un gain plus ancien", () => {
  let state = addGain(emptyState(), gainOf({ at: NOW, balance: 900 }));
  state = addGain(state, gainOf({ at: NOW - 60_000, total: 60, base: 50, reason: "CLAIM", balance: 800 }));
  assert.equal(state.channels["123"].balance, 900);
});

test("prune coupe le journal et les jours trop anciens", () => {
  let state = emptyState();
  state = addGain(state, gainOf({ at: NOW - 70 * 86_400_000 }));
  state = addGain(state, gainOf({ at: NOW - 500 * 86_400_000, total: 60, base: 50, reason: "CLAIM" }));
  state = addGain(state, gainOf({ at: NOW }));
  const pruned = prune(state, NOW);
  assert.equal(pruned.journal.length, 1);
  assert.equal(Object.keys(pruned.daily).length, 2);
});

test("dayKeysForPeriod couvre le panneau et le récap", () => {
  const state = addGain(emptyState(), gainOf({ at: new Date(2026, 7, 3).getTime() }));
  assert.deepEqual(dayKeysForPeriod("today", state, NOW), ["2026-09-26"]);
  assert.equal(dayKeysForPeriod("7d", state, NOW).length, 7);
  assert.equal(dayKeysForPeriod("30d", state, NOW).length, 30);
  assert.deepEqual(dayKeysForPeriod("all", state, NOW), ["2026-08-03"]);
  assert.deepEqual(dayKeysForPeriod("month:2026-08", state, NOW), ["2026-08-03"]);
  assert.deepEqual(dayKeysForPeriod("year:2026", state, NOW), ["2026-08-03"]);
  assert.deepEqual(dayKeysForPeriod("inconnue", state, NOW), []);
});

test("summarize totalise par raison et par chaîne, avec le bonus d'abonné", () => {
  let state = emptyState();
  state = addGain(state, gainOf({ channel: "1", reason: "CLAIM", total: 60, base: 50, at: NOW - 3000 }));
  state = addGain(state, gainOf({ channel: "1", reason: "WATCH", total: 12, base: 10, at: NOW - 2000 }));
  state = addGain(state, gainOf({ channel: "2", reason: "RAID", total: 250, base: 250, factor: 0, at: NOW - 1000 }));
  const summary = summarize(state, "7d", NOW);
  assert.equal(summary.total, 322);
  assert.equal(summary.subBonus, 12);
  assert.equal(summary.count, 3);
  assert.equal(summary.channelCount, 2);
  assert.deepEqual(summary.byReason.map((r) => r.code), REASONS.map((r) => r.code));
  assert.equal(summary.byReason.find((r) => r.code === "CLAIM").points, 60);
  assert.equal(summary.byChannel[0].channelId, "2");
  assert.equal(summary.byChannel[1].reasons.WATCH.count, 1);
});

test("daySeries renvoie un point par jour, dans l'ordre chronologique", () => {
  const state = addGain(emptyState(), gainOf({ at: NOW }));
  const series = daySeries(state, "7d", NOW);
  assert.equal(series.length, 7);
  assert.equal(series[6].key, "2026-09-26");
  assert.equal(series[6].points, 12);
  assert.equal(daySeries(state, "year:2026", NOW).length, 12);
  assert.equal(daySeries(state, "month:2026-09", NOW).length, 30);
});

test("channelDetail donne la fiche d'une chaîne et les états mensuels", () => {
  let state = emptyState();
  state = addGain(state, gainOf({ reason: "CLAIM", total: 60, base: 50, at: NOW - 3000 }));
  state = addGain(state, gainOf({ reason: "CHEER", total: 350, base: 350, factor: 0, at: new Date(2026, 8, 3).getTime() }));
  state = addGain(state, gainOf({ reason: "SUB_GIFT", total: 500, base: 500, factor: 0, at: new Date(2026, 7, 20).getTime() }));
  const detail = channelDetail(state, "123", "7d", NOW);
  assert.equal(detail.total, 60);
  assert.equal(detail.subBonus, 10);
  assert.equal(detail.reasons.find((r) => r.code === "CLAIM").count, 1);
  assert.equal(detail.status.CHEER.done, true);
  assert.equal(detail.status.SUB_GIFT.done, false, "un sub offert en août ne compte pas pour septembre");
  assert.equal(detail.status.FOLLOW.done, false);
  assert.equal(detail.factor, 0.2);
  assert.equal(detail.balance, 23410);
  assert.equal(detail.days.length, 7);
  assert.equal(detail.journal[0].reason, "CLAIM");
});

test("tierFromFactor retrouve le palier d'abonnement", () => {
  assert.equal(tierFromFactor(0), 0);
  assert.equal(tierFromFactor(0.2), 1);
  assert.equal(tierFromFactor(0.4), 2);
  assert.equal(tierFromFactor(1), 3);
});

test("lastGainAt et channelName", () => {
  let state = addGain(emptyState(), gainOf({ at: NOW - 5000 }));
  assert.equal(lastGainAt(state), NOW - 5000);
  assert.equal(lastGainAt(emptyState()), 0);
  assert.equal(channelName(state, "123"), "#123");
  state = { ...state, channels: { ...state.channels, 123: { ...state.channels["123"], login: "novastream", displayName: "Novastream" } } };
  assert.equal(channelName(state, "123"), "Novastream");
});

test("stateFrom et toStorage font l'aller-retour, et stateFrom répare une forme invalide", () => {
  const state = addGain(emptyState(), gainOf());
  assert.deepEqual(stateFrom(toStorage(state)), state);
  assert.deepEqual(stateFrom({ [POINTS_DAILY_KEY]: [] }), emptyState());
});

test("points d'avant le suivi par jour, repris du journal d'événements", async () => {
  const { pointsFromLogs } = await import("../js/points-data.js");
  const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
  const logs = [
    { type: "points", value: 50, timestamp: at(2026, 9, 26) }, // déjà dans le suivi par jour
    { type: "points", value: 50, timestamp: at(2026, 9, 25) },
    { type: "points", value: 60, timestamp: at(2026, 9, 24) },
    { type: "drop", value: 1, timestamp: at(2026, 9, 24) },
    { type: "points", value: 50, timestamp: at(2026, 9, 10) }, // hors période
    { type: "points", value: "x", timestamp: at(2026, 9, 24) },
    null,
  ];
  assert.deepEqual(pointsFromLogs(logs, { fromKey: "2026-09-20", beforeKey: "2026-09-26" }), { points: 110, firstDay: "2026-09-24" });
  assert.deepEqual(pointsFromLogs(logs, { fromKey: "2026-09-26", beforeKey: "2026-09-26" }), { points: 0, firstDay: "" });
  assert.deepEqual(pointsFromLogs(undefined, { fromKey: "2026-09-01", beforeKey: "" }), { points: 0, firstDay: "" });
});
