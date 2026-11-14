import test from "node:test";
import assert from "node:assert/strict";
import {
  BADGE_LIMITED_KEY,
  ENDING_SOON_MS,
  LIMITED_EVENT_MS,
  SHORT_EVENT_MS,
  formatTimeLeft,
  limitedFrom,
  planBadgeAlerts,
  toggleWatch,
  watchFrom,
} from "../js/badge-watch.js";

const NOW = Date.parse("2026-10-20T12:00:00Z");
const MIN = 60_000;
const HOUR = 60 * MIN;

const badge = (id, startsAt, endsAt, extra = {}) => ({
  id,
  title: id,
  status: "live",
  owned: false,
  event: { campaignId: "c", dropId: "d", startsAt, endsAt },
  ...extra,
});
const plan = (badges, over = {}) => planBadgeAlerts({ badges, watch: {}, seen: {}, shortMs: SHORT_EVENT_MS, now: NOW, ...over });
const kinds = (result) => result.alerts.map((a) => `${a.badge.id}:${a.kind}`);

test("un événement court qui vient de démarrer prévient une seule fois", () => {
  const short = badge("flash", NOW - 5 * MIN, NOW + 25 * MIN);
  const first = plan([short]);
  assert.deepEqual(kinds(first), ["flash:start"]);
  assert.equal(first.alerts[0].endsAt, NOW + 25 * MIN);
  assert.deepEqual(plan([short], { seen: first.seen }).alerts, [], "déjà signalé");
});

test("un événement long, ou sans fin connue, ne déclenche pas l'alerte automatique", () => {
  assert.deepEqual(plan([badge("long", NOW - HOUR, NOW + 10 * 24 * HOUR)]).alerts, []);
  assert.deepEqual(plan([badge("sans-fin", NOW - MIN, 0)]).alerts, []);
  assert.ok(SHORT_EVENT_MS >= 30 * MIN);
});

test("l'alerte automatique suit le réglage ; la cloche, non", () => {
  const short = badge("flash", NOW - MIN, NOW + 29 * MIN);
  assert.deepEqual(plan([short], { shortMs: 0 }).alerts, []);
  assert.deepEqual(kinds(plan([short], { shortMs: 0, watch: { flash: { at: NOW - HOUR, live: false } } })), ["flash:start"]);
});

test("un badge déjà en cours quand on le suit n'envoie pas d'alerte de départ, mais prévient avant la fin", () => {
  const long = badge("long", NOW - 2 * HOUR, NOW + 40 * MIN);
  const watch = { long: { at: NOW - HOUR, live: true } };
  assert.deepEqual(plan([long], { watch }).alerts, []);
  const closing = badge("long", NOW - 2 * HOUR, NOW + ENDING_SOON_MS - MIN);
  const result = plan([closing], { watch });
  assert.deepEqual(kinds(result), ["long:ending"]);
  assert.deepEqual(plan([closing], { watch, seen: result.seen }).alerts, [], "une seule alerte de fin");
});

test("un badge suivi avant son départ prévient au démarrage, puis avant la fin", () => {
  const watch = { x: { at: NOW - 3 * HOUR, live: false } };
  const live = badge("x", NOW - 10 * MIN, NOW + 3 * HOUR);
  const started = plan([live], { watch });
  assert.deepEqual(kinds(started), ["x:start"]);
  const closing = badge("x", NOW - 10 * MIN, NOW + 10 * MIN);
  assert.deepEqual(kinds(plan([closing], { watch, seen: started.seen })), ["x:ending"]);
});

test("ni badge obtenu, ni badge terminé ou à venir, ne déclenche quoi que ce soit", () => {
  const watch = { a: { at: 0, live: false }, b: { at: 0, live: false }, c: { at: 0, live: false } };
  const list = [
    badge("a", NOW - MIN, NOW + 20 * MIN, { owned: true }),
    badge("b", NOW - MIN, NOW + 20 * MIN, { status: "ended" }),
    badge("c", NOW + HOUR, NOW + 2 * HOUR, { status: "soon" }),
  ];
  assert.deepEqual(plan(list, { watch }).alerts, []);
});

test("trois alertes au plus par passage, les autres restent pour le suivant", () => {
  const list = ["a", "b", "c", "d", "e"].map((id) => badge(id, NOW - MIN, NOW + 20 * MIN));
  const first = plan(list);
  assert.equal(first.alerts.length, 3);
  assert.deepEqual(kinds(plan(list, { seen: first.seen })).length, 2);
});

test("les alertes déjà vues depuis plus de 7 jours sont oubliées", () => {
  const seen = { "old|c|d|start": NOW - 8 * 24 * HOUR, "new|c|d|start": NOW - HOUR };
  const result = plan([], { seen });
  assert.deepEqual(Object.keys(result.seen), ["new|c|d|start"]);
});

test("toggleWatch ajoute avec l'état au moment du clic, retire au second clic, et watchFrom filtre le stockage", () => {
  const on = toggleWatch({}, "x", { live: true, now: NOW });
  assert.deepEqual(on, { x: { at: NOW, live: true } });
  assert.deepEqual(toggleWatch(on, "x", { live: true, now: NOW }), {});
  assert.deepEqual(on, { x: { at: NOW, live: true } }, "l'entrée de départ n'est pas modifiée");
  assert.deepEqual(watchFrom({ streamPulseBadgeWatch: { x: { at: 5, live: false }, y: "nope", z: null } }), { x: { at: 5, live: false } });
  assert.deepEqual(watchFrom({}), {});
});

test("StreamPulse+ : les badges temporaires (une journée ou moins) préviennent, pas les plus longs", () => {
  const day = badge("jour", NOW - HOUR, NOW - HOUR + 23 * HOUR);
  const week = badge("semaine", NOW - HOUR, NOW + 7 * 24 * HOUR);
  assert.deepEqual(plan([day, week]).alerts, [], "sans l'option, 23 h n'est pas court");
  assert.deepEqual(kinds(plan([day, week], { shortMs: LIMITED_EVENT_MS })), ["jour:start"]);
  assert.equal(LIMITED_EVENT_MS, 24 * HOUR);
});

test("formatTimeLeft : minutes sous une heure, sinon heures et minutes", () => {
  assert.equal(formatTimeLeft(0), "1 min");
  assert.equal(formatTimeLeft(25 * MIN), "25 min");
  assert.equal(formatTimeLeft(59 * MIN + 1), "60 min");
  assert.equal(formatTimeLeft(3 * HOUR), "3 h");
  assert.equal(formatTimeLeft(3 * HOUR + 20 * MIN), "3 h 20");
  assert.equal(formatTimeLeft(23.5 * HOUR), "23 h 30");
});

test("limitedFrom : activé par défaut, éteint seulement si le choix est explicite", () => {
  assert.equal(limitedFrom({}), true);
  assert.equal(limitedFrom(undefined), true);
  assert.equal(limitedFrom({ [BADGE_LIMITED_KEY]: true }), true);
  assert.equal(limitedFrom({ [BADGE_LIMITED_KEY]: false }), false);
  assert.equal(limitedFrom({ [BADGE_LIMITED_KEY]: "non" }), true, "valeur illisible : le défaut");
});

test("état de départ : les badges déjà en cours ne préviennent pas, les suivants si", () => {
  const already = badge("deja", NOW - 5 * HOUR, NOW + 3 * HOUR);
  const first = plan([already], { baseline: true, shortMs: LIMITED_EVENT_MS });
  assert.deepEqual(first.alerts, []);
  assert.deepEqual(plan([already], { seen: first.seen, shortMs: LIMITED_EVENT_MS }).alerts, [], "toujours silencieux ensuite");
  const fresh = badge("neuf", NOW - MIN, NOW + 3 * HOUR);
  assert.deepEqual(kinds(plan([already, fresh], { seen: first.seen, shortMs: LIMITED_EVENT_MS })), ["neuf:start"]);
});

test("l'état de départ ne coupe pas le rappel de fin d'un badge suivi", () => {
  const closing = badge("x", NOW - 2 * HOUR, NOW + 10 * MIN);
  const result = plan([closing], { baseline: true, watch: { x: { at: NOW - HOUR, live: true } } });
  assert.deepEqual(kinds(result), ["x:ending"]);
});

test("portée Plus « jeux choisis » : un badge du jeu prévient à son démarrage, pas les autres", async () => {
  const scope = { enabled: true, mode: "games", games: ["Valorant"], since: NOW - HOUR };
  const long = (id, game) => badge(id, NOW - MIN, NOW + 10 * 24 * HOUR, { event: { campaignId: id, dropId: "d", startsAt: NOW - MIN, endsAt: NOW + 10 * 24 * HOUR, game } });
  const result = plan([long("v", "VALORANT"), long("r", "Rust")], { scope, shortMs: 0 });
  assert.deepEqual(kinds(result), ["v:start"]);
  assert.deepEqual(kinds(plan([long("v", "Valorant")], { scope, shortMs: 0, seen: result.seen })), []);
});

test("portée Plus « tous » : badges déjà en cours au réglage ignorés, nouveaux annoncés", async () => {
  const scope = { enabled: true, mode: "all", since: NOW - 10 * MIN };
  const ev = (id, startsAt) => badge(id, startsAt, NOW + 3 * 24 * HOUR, { event: { campaignId: id, dropId: "d", startsAt, endsAt: NOW + 3 * 24 * HOUR, game: "Rust" } });
  assert.deepEqual(kinds(plan([ev("old", NOW - HOUR), ev("new", NOW - MIN)], { scope, shortMs: 0 })), ["new:start"]);
  assert.deepEqual(kinds(plan([ev("new", NOW - MIN)], { scope: null, shortMs: 0 })), []);
});

test("newBadgeAlerts : tous avec la portée Plus, gratuits sinon, rien éteint", async () => {
  const { newBadgeAlerts } = await import("../js/badge-watch.js");
  const added = [{ id: "a", paid: false }, { id: "b", paid: true }];
  const isPaid = (b) => b.paid;
  assert.deepEqual(newBadgeAlerts(added, { scope: { enabled: true, mode: "all" }, freeAlerts: false, isPaid }).map((b) => b.id), ["a", "b"]);
  assert.deepEqual(newBadgeAlerts(added, { scope: null, freeAlerts: true, isPaid }).map((b) => b.id), ["a"]);
  assert.deepEqual(newBadgeAlerts(added, { scope: { enabled: true, mode: "games", games: ["Rust"] }, freeAlerts: false, isPaid }), []);
});

test("un nouveau badge annoncé prévient quand il devient récupérable, une seule fois", () => {
  const long = badge("neuf", NOW - MIN, NOW + 10 * 24 * HOUR);
  const announce = (b) => b.id === "neuf";
  const first = plan([long], { shortMs: 0, announce });
  assert.deepEqual(kinds(first), ["neuf:start"]);
  assert.equal(first.alerts[0].fresh, true);
  assert.deepEqual(plan([long], { shortMs: 0, announce, seen: first.seen }).alerts, [], "déjà signalé");
  assert.deepEqual(plan([long], { shortMs: 0 }).alerts, [], "sans annonce voulue, rien ne part");
  assert.deepEqual(plan([long], { shortMs: 0, announce, baseline: true }).alerts, [], "premier passage silencieux");
});
