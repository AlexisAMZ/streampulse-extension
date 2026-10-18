import { DEFAULT_PREFERENCES } from "./preferences-data.js";
import { normalizeQuietTime } from "./quiet-hours.js";

export const PREFERENCE_CONTROLS = [
  { id: "pref-quiet-hours", key: "quietHoursEnabled", type: "boolean" },
  { id: "pref-quiet-hours-start", key: "quietHoursStart", type: "time" },
  { id: "pref-quiet-hours-end", key: "quietHoursEnd", type: "time" },
  { id: "pref-predictions-popup", key: "enablePredictionsPopup", type: "boolean" },
  { id: "pref-volume-boost", key: "playerVolumeBoost", type: "number" },
  { id: "pref-drops-tracking-panel", key: "dropsTracking", type: "boolean" },
];

export function createPreferenceControls({ root = document, getPreferences, updatePreferences }) {
  const controls = PREFERENCE_CONTROLS.map((definition) => ({ ...definition, element: root.getElementById(definition.id) }));
  const render = () => {
    const prefs = { ...DEFAULT_PREFERENCES, ...getPreferences() };
    for (const { element, key, type } of controls) {
      if (!element) continue;
      if (type === "boolean") element.checked = prefs[key] === true;
      else element.value = String(prefs[key]);
    }
    const label = root.getElementById("volume-boost-value");
    if (label) label.textContent = String(prefs.playerVolumeBoost);
  };
  for (const { element, key, type } of controls) {
    if (!element) continue;
    element.addEventListener("change", async () => {
      const value = type === "boolean" ? element.checked : type === "time"
        ? normalizeQuietTime(element.value, DEFAULT_PREFERENCES[key])
        : Math.min(300, Math.max(100, Number(element.value) || 100));
      await updatePreferences({ [key]: value });
      render();
    });
    if (key === "playerVolumeBoost") element.addEventListener("input", () => {
      const label = root.getElementById("volume-boost-value");
      if (label) label.textContent = element.value;
    });
  }
  return { render };
}
