import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_GAMES, SCOPE_ALL, SCOPE_GAMES, mergeScope, normalizeScope, scopeActive, scopeMatches, updateScope } from "../js/alert-scope.js";

test("normalizeScope : valeurs par défaut sûres", () => {
  assert.deepEqual(normalizeScope(null), { enabled: false, mode: SCOPE_GAMES, games: [], since: 0 });
  assert.deepEqual(normalizeScope({ enabled: "yes", mode: "nimporte", since: -4 }), { enabled: false, mode: SCOPE_GAMES, games: [], since: 0 });
  assert.equal(normalizeScope({ mode: "all" }).mode, SCOPE_ALL);
});

test("normalizeScope : jeux nettoyés, dédupliqués, plafonnés", () => {
  assert.deepEqual(normalizeScope({ games: [" Valorant ", "valorant", "", null, "CS2"] }).games, ["Valorant", "CS2"]);
  assert.equal(normalizeScope({ games: Array.from({ length: 40 }, (_, i) => `Jeu ${i}`) }).games.length, MAX_GAMES);
});

test("updateScope : renvoie une copie et remet since à maintenant", () => {
  const before = { enabled: true, mode: "games", games: ["Valorant"], since: 1 };
  const after = updateScope(before, { mode: "all" }, 500);
  assert.deepEqual(after, { enabled: true, mode: SCOPE_ALL, games: ["Valorant"], since: 500 });
  assert.equal(before.mode, "games");
});

test("scopeMatches : tous les jeux, jeux choisis, éteint", () => {
  const all = normalizeScope({ enabled: true, mode: "all" });
  assert.equal(scopeMatches(all, "Valorant"), true);
  assert.equal(scopeMatches(all, ""), true);
  const games = normalizeScope({ enabled: true, games: ["Counter Strike 2"] });
  assert.equal(scopeMatches(games, "Counter-Strike 2"), true);
  assert.equal(scopeMatches(games, "Valorant"), false);
  assert.equal(scopeMatches(games, ""), false);
  assert.equal(scopeMatches(normalizeScope({ enabled: false, mode: "all" }), "Valorant"), false);
  assert.equal(scopeActive(normalizeScope({ enabled: true, games: [] })), false);
});

test("mergeScope : remplacement ou addition", () => {
  const local = { enabled: false, mode: "games", games: ["Valorant"], since: 10 };
  const incoming = { enabled: true, mode: "all", games: ["CS2"], since: 20 };
  assert.deepEqual(mergeScope(local, incoming, true), normalizeScope(incoming));
  assert.deepEqual(mergeScope(local, incoming, false), { enabled: true, mode: SCOPE_ALL, games: ["Valorant", "CS2"], since: 20 });
});
