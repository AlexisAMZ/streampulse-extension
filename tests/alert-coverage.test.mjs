import assert from "node:assert/strict";
import test from "node:test";
import { alertCoverage } from "../js/alert-coverage.js";

test("an empty roster has no coverage to report", () => {
  assert.deepEqual(alertCoverage([], "live"), { state: "empty", on: 0, total: 0 });
  assert.equal(alertCoverage(undefined, "game").state, "empty");
});

test("live alerts default to on, category and title alerts default to off", () => {
  const roster = [{ id: "a" }, { id: "b" }];
  assert.equal(alertCoverage(roster, "live").state, "on");
  assert.equal(alertCoverage(roster, "game").state, "off");
  assert.equal(alertCoverage(roster, "title").state, "off");
});

test("a roster that differs reports how many streamers are on", () => {
  const roster = [{ id: "a", gameNotificationsEnabled: true }, { id: "b", gameNotificationsEnabled: false }, { id: "c" }];
  assert.deepEqual(alertCoverage(roster, "game"), { state: "mixed", on: 1, total: 3 });
  assert.equal(alertCoverage([{ notificationsEnabled: false }], "live").state, "off");
});

test("couper puis réactiver : la couverture suit le réglage quand la liste locale est mise à jour", async () => {
  const { withNotificationFields } = await import("../js/preferences-data.js");
  let roster = [{ id: "a", gameNotificationsEnabled: true }, { id: "b", gameNotificationsEnabled: true }];
  assert.equal(alertCoverage(roster, "game").state, "on");

  roster = withNotificationFields(roster, { gameNotifications: false });
  assert.equal(alertCoverage(roster, "game").state, "off", "après la coupure, l'interrupteur doit montrer « off »");

  roster = withNotificationFields(roster, { gameNotifications: true });
  assert.equal(alertCoverage(roster, "game").state, "on", "et pouvoir être réactivé");
});

test("withNotificationFields : les autres réglages ne touchent pas la liste, et rien n'est modifié sur place", async () => {
  const { withNotificationFields } = await import("../js/preferences-data.js");
  const roster = [{ id: "a", titleNotificationsEnabled: false }];
  assert.equal(withNotificationFields(roster, { soundsEnabled: false }), roster);
  const next = withNotificationFields(roster, { titleNotifications: true });
  assert.deepEqual(next, [{ id: "a", titleNotificationsEnabled: true }]);
  assert.deepEqual(roster, [{ id: "a", titleNotificationsEnabled: false }], "liste d'origine intacte");
  assert.equal(withNotificationFields(undefined, { titleNotifications: true }), undefined);
});
