import test from "node:test";
import assert from "node:assert/strict";
import { BACKUP_KEYS, buildBackup, mergeBackup, parseBackup } from "../js/backup.js";
import { DROPS_HISTORY_KEY, DROPS_PROGRESS_KEY } from "../js/drops-data.js";

const entry = (key, at, name = "Vehicle XP Booster") => ({ key, dropId: key, instanceId: "", benefitIds: [], name, game: "World of Tanks: HEAT", image: "", channel: "Terracid", at, auto: true });

test("l'historique des Drops fait partie de la sauvegarde, pas la progression", () => {
  assert.ok(BACKUP_KEYS.includes(DROPS_HISTORY_KEY));
  assert.ok(!BACKUP_KEYS.includes(DROPS_PROGRESS_KEY), "la progression est un cache relu sur Twitch");
  const history = [entry("drop:a", 2), entry("drop:b", 1)];
  const parsed = parseBackup(buildBackup({ [DROPS_HISTORY_KEY]: history }, { version: "26.9.27" }));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.data[DROPS_HISTORY_KEY], history);
});

test("la restauration écarte les entrées de Drops mal formées", () => {
  const parsed = parseBackup({ [DROPS_HISTORY_KEY]: [entry("drop:a", 1), { key: "x" }, null, { key: "", name: "a", at: 1 }] });
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.data[DROPS_HISTORY_KEY].map((item) => item.key), ["drop:a"]);
});

test("la fusion fait l'union des deux historiques, sans doublon, du plus récent au plus ancien", () => {
  const current = { [DROPS_HISTORY_KEY]: [entry("drop:a", 3), entry("drop:b", 1)] };
  const merged = mergeBackup(current, { [DROPS_HISTORY_KEY]: [entry("drop:b", 1, "Autre nom"), entry("drop:c", 2)] }).data;
  assert.deepEqual(merged[DROPS_HISTORY_KEY].map((item) => item.key), ["drop:a", "drop:c", "drop:b"]);
  assert.equal(merged[DROPS_HISTORY_KEY][2].name, "Vehicle XP Booster", "l'entrée locale gagne");
});
