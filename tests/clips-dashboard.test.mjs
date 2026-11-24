import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CLIPS_DASHBOARD_ACCESS, CLIPS_DASHBOARD_SCRIPT_ID, clipsDashboardScripts, syncClipsDashboardAccess } from "../js/clips-dashboard-access.js";

test("accès facultatif : seul le tableau de bord, et le script ne vise que le gestionnaire de clips", () => {
  assert.deepEqual(CLIPS_DASHBOARD_ACCESS, { origins: ["https://dashboard.twitch.tv/*"] });
  const [script] = clipsDashboardScripts();
  assert.equal(script.id, CLIPS_DASHBOARD_SCRIPT_ID);
  assert.deepEqual(script.matches, ["https://dashboard.twitch.tv/u/*/content/clips/*"]);
  assert.ok(script.js.at(-1) === "js/clipsDashboard.js" && script.js.includes("js/inject/clips-handoff.js"));
});

test("manifeste : le script de page existe dans l'archive et l'accès n'est pas obligatoire", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.ok(manifest.optional_host_permissions.includes("https://dashboard.twitch.tv/*"));
  assert.ok(!manifest.host_permissions.includes("https://dashboard.twitch.tv/*"));
  for (const file of clipsDashboardScripts()[0].js) await readFile(new URL(`../${file}`, import.meta.url));
});

function fakeChrome({ granted, registered = [] }) {
  const calls = [];
  const list = [...registered];
  globalThis.chrome = {
    permissions: { contains: async () => granted },
    scripting: {
      getRegisteredContentScripts: async ({ ids }) => list.filter((script) => ids.includes(script.id)),
      registerContentScripts: async (scripts) => { calls.push(["register", scripts.length]); list.push(...scripts); },
      updateContentScripts: async (scripts) => { calls.push(["update", scripts.length]); },
      unregisterContentScripts: async ({ ids }) => { calls.push(["unregister", ids.length]); },
    },
  };
  return calls;
}

test("synchro : accès accordé, le script s'enregistre puis se met à jour sans doublon", async () => {
  const calls = fakeChrome({ granted: true });
  await syncClipsDashboardAccess();
  await syncClipsDashboardAccess();
  assert.deepEqual(calls, [["register", 1], ["update", 1]]);
});

test("synchro : accès retiré, le script est désenregistré ; jamais accordé, rien à faire", async () => {
  const removed = fakeChrome({ granted: false, registered: [{ id: CLIPS_DASHBOARD_SCRIPT_ID }] });
  await syncClipsDashboardAccess();
  assert.deepEqual(removed, [["unregister", 1]]);
  const never = fakeChrome({ granted: false });
  await syncClipsDashboardAccess();
  assert.deepEqual(never, []);
});
