import test from "node:test";
import assert from "node:assert/strict";

test("parseCsv gère guillemets, virgules imbriquées et fins de ligne", async () => {
  const { parseCsv } = await import("../js/history-csv.js");
  const csv = 'a,b,"c, d","e""f"\r\nx,"y\nz",,w';
  assert.deepEqual(parseCsv(csv), [
    ["a", "b", "c, d", 'e"f'],
    ["x", "y\nz", "", "w"],
  ]);
  assert.deepEqual(parseCsv(""), []);
  assert.deepEqual(parseCsv("\uFEFFa,b"), [["a", "b"]]);
});

test("l'historique de Drops fait un aller-retour CSV sans perte", async () => {
  const { dropsHistoryCsv, importFromCsv } = await import("../js/history-csv.js");
  const history = [
    { key: "d1", name: "Casque " + String.fromCharCode(0x2013) + ' "Pro"', game: "PAYDAY 3, le jeu", channel: "xqc", at: Date.UTC(2026, 9, 1, 12), auto: true },
    { key: "d2", name: "Logo", game: "Rust", channel: "", at: Date.UTC(2026, 8, 20, 8), auto: false },
  ];
  const csv = dropsHistoryCsv(history);
  assert.ok(csv.startsWith("\uFEFFdate,name"));
  const back = importFromCsv(csv).drops;
  assert.equal(back.length, 2);
  assert.equal(back[0].name, history[0].name); // virgule et guillemets préservés
  assert.equal(back[0].game, history[0].game);
  assert.equal(back[0].at, history[0].at);
  assert.equal(back[0].auto, true);
  assert.equal(back[1].auto, false);
});

test("le journal de points fait un aller-retour CSV, lignes invalides jetées", async () => {
  const { pointsJournalCsv, importFromCsv } = await import("../js/history-csv.js");
  const journal = [
    { key: "p1", at: Date.UTC(2026, 9, 1, 9), channelId: "c1", reason: "WATCH", points: 10, base: 10, factor: 1 },
    { key: "p2", at: Date.UTC(2026, 9, 1, 10), channelId: "c2", reason: "CLAIM", points: 50, base: 50, factor: 1 },
  ];
  const channels = { c1: { name: "Chaîne, une" }, c2: { name: "Autre" } };
  const csv = pointsJournalCsv(journal, channels);
  const back = importFromCsv(csv).gains;
  assert.equal(back.length, 2);
  // Tri du plus récent au plus ancien dans le CSV : le gain de 10 h (50 pts) vient en premier.
  assert.equal(back[0].points, 50);
  assert.ok(back[0].key.startsWith("csv:"));
  assert.equal(back[0].day, "2026-10-01");

  // Une ligne pourrie (date absente, points non numériques) ne casse rien.
  const dirty = "date,channel,reason,points\npas-une-date,x,WATCH,10\n2026-10-01T10:00:00Z,y,CLAIM,abc\n";
  assert.equal(importFromCsv(dirty).gains.length, 0);
});

test("importFromCsv sur un CSV inconnu ne renvoie rien", async () => {
  const { importFromCsv } = await import("../js/history-csv.js");
  assert.deepEqual(importFromCsv("foo,bar\n1,2"), { drops: [], gains: [] });
});
