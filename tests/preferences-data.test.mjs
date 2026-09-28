import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PREFERENCES,
  detectInstallLanguage,
  notificationFieldsFromUpdates,
  resetPreferencesFrom,
  sanitizePreferences,
} from "../js/preferences-data.js";

test("theme est conservé par le nettoyage et borné à dark/light", () => {
  assert.equal(DEFAULT_PREFERENCES.theme, "dark");
  assert.equal(sanitizePreferences({ theme: "light" }).theme, "light");
  assert.equal(sanitizePreferences({ theme: "sepia" }).theme, "dark");
  // Le bug d'origine : un autre réglage écrit seul effaçait le thème stocké.
  assert.equal(sanitizePreferences({ language: "fr" }).theme, "dark");
});

test("heures calmes : défauts, format HH:MM validé, plage pouvant passer minuit", () => {
  assert.equal(DEFAULT_PREFERENCES.quietHoursEnabled, false);
  assert.equal(DEFAULT_PREFERENCES.quietHoursStart, "23:00");
  assert.equal(DEFAULT_PREFERENCES.quietHoursEnd, "08:00");
  const clean = sanitizePreferences({
    quietHoursEnabled: true,
    quietHoursStart: "00:30",
    quietHoursEnd: "07:45",
  });
  assert.equal(clean.quietHoursEnabled, true);
  assert.equal(clean.quietHoursStart, "00:30");
  assert.equal(clean.quietHoursEnd, "07:45");
  const dirty = sanitizePreferences({
    quietHoursStart: "24:00",
    quietHoursEnd: "7h",
  });
  assert.equal(dirty.quietHoursStart, "23:00");
  assert.equal(dirty.quietHoursEnd, "08:00");
});

test("les alertes de drops, raids, clips et mises à jour deviennent opt-in", () => {
  assert.equal(DEFAULT_PREFERENCES.dropAlerts, false);
  assert.equal(DEFAULT_PREFERENCES.raidAlerts, false);
  assert.equal(DEFAULT_PREFERENCES.enableClipDownload, false);
  assert.equal(DEFAULT_PREFERENCES.updateNotifications, false);
  // Un choix stocké, même ancien, n'est jamais écrasé.
  assert.equal(sanitizePreferences({ dropAlerts: true }).dropAlerts, true);
  assert.equal(sanitizePreferences({ updateNotifications: true }).updateNotifications, true);
  assert.equal(sanitizePreferences({}).dropAlerts, false);
});

test("le délai des aperçus vaut 350 ms par défaut", () => {
  assert.equal(DEFAULT_PREFERENCES.previewsShowDelayMs, 350);
  assert.equal(sanitizePreferences({ previewsShowDelayMs: 120 }).previewsShowDelayMs, 120);
  assert.equal(sanitizePreferences({}).previewsShowDelayMs, 350);
});

test("predictionAlerts et communityBadgeColor ont disparu", () => {
  assert.ok(!("predictionAlerts" in DEFAULT_PREFERENCES));
  assert.ok(!("communityBadgeColor" in DEFAULT_PREFERENCES));
  const clean = sanitizePreferences({ predictionAlerts: false, communityBadgeColor: "#ff0000" });
  assert.ok(!("predictionAlerts" in clean));
  assert.ok(!("communityBadgeColor" in clean));
});

test("chaque défaut est connu du nettoyage, et réciproquement", () => {
  const defaults = Object.keys(DEFAULT_PREFERENCES).sort();
  const cleaned = Object.keys(sanitizePreferences({})).sort();
  assert.deepEqual(cleaned, defaults);
});

test("les réglages d'alertes en masse donnent les champs à propager aux streamers", () => {
  assert.deepEqual(notificationFieldsFromUpdates({ liveNotifications: false }), [
    ["notificationsEnabled", false],
  ]);
  assert.deepEqual(
    notificationFieldsFromUpdates({
      liveNotifications: true,
      gameNotifications: true,
      titleNotifications: true,
      theme: "light",
    }),
    [
      ["notificationsEnabled", true],
      ["gameNotificationsEnabled", true],
      ["titleNotificationsEnabled", true],
    ],
  );
  assert.deepEqual(notificationFieldsFromUpdates({ theme: "light" }), []);
});

test("la remise à zéro garde la langue et le thème choisis", () => {
  const reset = resetPreferencesFrom({ language: "fr", theme: "light", soundsEnabled: false });
  assert.equal(reset.language, "fr");
  assert.equal(reset.theme, "light");
  assert.equal(reset.soundsEnabled, DEFAULT_PREFERENCES.soundsEnabled);
});

test("la langue d'installation vient de Chrome, avec repli anglais", () => {
  assert.equal(detectInstallLanguage("fr-FR"), "fr");
  assert.equal(detectInstallLanguage("pt-PT"), "pt-BR");
  assert.equal(detectInstallLanguage("xx-YY"), "en");
  assert.equal(detectInstallLanguage(undefined), "en");
});
