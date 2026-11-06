import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { addImportedEntry, planImportedRemoval, sanitizeImportedRegistry, stillImported } from "../js/imported-follows.js";

const old = { id: "ancien", createdAt: 100 };
const imported = { id: "importe", createdAt: 200 };

test("le registre ne garde que des entrées valides et ne duplique pas", () => {
  assert.deepEqual(sanitizeImportedRegistry("x"), []);
  assert.deepEqual(sanitizeImportedRegistry([{ id: "a", createdAt: 1 }, { id: 3 }, null, { id: "b" }]), [{ id: "a", createdAt: 1 }]);
  const once = addImportedEntry([], imported);
  assert.deepEqual(once, [{ id: "importe", createdAt: 200 }]);
  assert.deepEqual(addImportedEntry(once, { id: "importe", createdAt: 300 }), [{ id: "importe", createdAt: 300 }]);
  assert.deepEqual(addImportedEntry(once, { id: "sans-date" }), once);
});

test("addImportedEntry ne modifie pas le registre reçu", () => {
  const registry = Object.freeze([]);
  assert.equal(addImportedEntry(registry, imported).length, 1);
  assert.equal(registry.length, 0);
});

test("seules les chaînes importées et encore présentes comptent", () => {
  const registry = [{ id: "importe", createdAt: 200 }, { id: "disparue", createdAt: 150 }];
  assert.deepEqual(stillImported(registry, [old, imported]).map((entry) => entry.id), ["importe"]);
});

test("une chaîne retirée puis remise à la main n'est plus considérée comme importée", () => {
  const registry = [{ id: "importe", createdAt: 200 }];
  assert.deepEqual(stillImported(registry, [{ id: "importe", createdAt: 999 }]), []);
});

test("le retrait garde les chaînes d'avant et nettoie épingles et groupes", () => {
  const groups = [{ id: "g", name: "G", memberIds: ["ancien", "importe"] }];
  const plan = planImportedRemoval({
    registry: [{ id: "importe", createdAt: 200 }],
    streamers: [old, imported],
    pinnedIds: ["importe", "ancien"],
    groups,
  });
  assert.deepEqual(plan.removedIds, ["importe"]);
  assert.deepEqual(plan.streamers, [old]);
  assert.deepEqual(plan.pinnedIds, ["ancien"]);
  assert.deepEqual(plan.groups[0].memberIds, ["ancien"]);
  assert.deepEqual(groups[0].memberIds, ["ancien", "importe"], "groupes d'origine intacts");
});

test("sans registre, le retrait ne touche à rien", () => {
  const plan = planImportedRemoval({ registry: undefined, streamers: [old], pinnedIds: ["ancien"], groups: [] });
  assert.deepEqual(plan.removedIds, []);
  assert.deepEqual(plan.streamers, [old]);
});

test("le module d'import se monte sur les deux pages et n'y dépend d'aucun id", async () => {
  const source = await readFile(new URL("../js/twitch-follows-import.js", import.meta.url), "utf8");
  assert.ok(!source.includes("getElementById"), "le module crée lui-même ses éléments");
  for (const page of ["bulk-add", "onboarding"]) {
    const html = await readFile(new URL(`../html/${page}.html`, import.meta.url), "utf8");
    assert.match(html, /id="follows-import-root"/, page);
    assert.match(html, /css\/follows-import\.css/, page);
  }
});
