// Réglage du son des notifications : un son général + un son par type d'alerte,
// chacun avec un bouton « Écouter ». Les menus sont construits depuis le
// catalogue : ajouter un son ne demande que de toucher notification-sounds.js.
import { onLanguageChange, t } from "./i18n.js";
import { playNotificationSound } from "./notification-sound-player.js";
import { SOUND_INHERIT, SOUND_KINDS, SOUND_KIND_PREFERENCE, SOUND_PRESETS, normalizeGeneralSound, normalizeKindSound } from "./notification-sounds.js";

// Clés écrites en entier : le contrôle des clés mortes de verify les voit.
// (popup.plus.badge et popup.smart.unlock existent déjà, popup.sounds.plusNote est nouvelle.)
const LABELS = {
  inherit: "popup.sounds.inherit",
  kind: { live: "popup.sounds.kind.live", game: "popup.sounds.kind.game", title: "popup.sounds.kind.title", raid: "popup.sounds.kind.raid" },
  preset: {
    classic: "popup.sounds.preset.classic", chime: "popup.sounds.preset.chime", pulse: "popup.sounds.preset.pulse",
    bubble: "popup.sounds.preset.bubble", arpeggio: "popup.sounds.preset.arpeggio", drop: "popup.sounds.preset.drop",
    punch: "popup.sounds.preset.punch", airhorn: "popup.sounds.preset.airhorn", siren: "popup.sounds.preset.siren", laser: "popup.sounds.preset.laser",
  },
};
const GENERAL_ROW = { id: "pref-sound-general", key: "notificationSound", label: "popup.sounds.general" };
const KIND_ROWS = SOUND_KINDS.map((kind) => ({ id: `pref-sound-${kind}`, key: SOUND_KIND_PREFERENCE[kind], label: LABELS.kind[kind], inherit: true }));

/** Monte les réglages dans #sound-settings. Renvoie { render } ou null. */
export function createSoundSettings({ root = document, getPreferences, updatePreferences, play = playNotificationSound, isPlus = () => false, openPlus = () => {} }) {
  const mount = root.getElementById("sound-settings");
  if (!mount) return null;
  const rows = [];

  function row({ id, key, label, inherit }) {
    const wrap = document.createElement("div");
    wrap.className = "settings-sub-row";
    const name = document.createElement("label");
    name.className = "settings-title";
    name.htmlFor = id;
    name.dataset.i18n = label;
    const controls = document.createElement("span");
    controls.className = "sound-controls";
    const select = document.createElement("select");
    select.className = "settings-select";
    select.id = id;
    for (const value of inherit ? [SOUND_INHERIT, ...SOUND_PRESETS] : SOUND_PRESETS) {
      const option = document.createElement("option");
      option.value = value;
      option.dataset.i18n = value === SOUND_INHERIT ? LABELS.inherit : LABELS.preset[value];
      select.append(option);
    }
    const listen = document.createElement("button");
    listen.type = "button";
    listen.className = "button button-quiet";
    listen.dataset.i18n = "popup.sounds.listen";
    listen.setAttribute("aria-describedby", id);
    controls.append(select, listen);
    wrap.append(name, controls);
    rows.push({ key, select, listen, name, wrap, inherit });
    select.addEventListener("change", async () => {
      await updatePreferences({ [key]: select.value });
      render();
    });
    // Le son écouté est celui affiché, pas celui du stockage : « comme le général » joue le général.
    listen.addEventListener("click", () => {
      const prefs = getPreferences() || {};
      const chosen = select.value === SOUND_INHERIT ? normalizeGeneralSound(prefs.notificationSound) : select.value;
      Promise.resolve(play(chosen, { getUrl: (path) => chrome.runtime.getURL(path) })).catch((error) => console.warn("[popup] son impossible à jouer", error));
    });
    return wrap;
  }

  const detail = document.createElement("details");
  detail.className = "settings-advanced sound-per-kind";
  const summary = document.createElement("summary");
  const summaryLabel = document.createElement("span");
  summaryLabel.dataset.i18n = "popup.sounds.perKind";
  const plusTag = document.createElement("span");
  plusTag.className = "plus-tag";
  plusTag.dataset.i18n = "popup.plus.badge";
  summary.append(summaryLabel, plusTag);
  // Le son par type est réservé à StreamPulse+ : sans abonnement, une note et un
  // bouton ouvrent l'offre, les menus restent visibles mais grisés.
  const lockNote = document.createElement("div");
  lockNote.className = "sound-plus-note";
  const lockText = document.createElement("p");
  lockText.className = "settings-description";
  lockText.dataset.i18n = "popup.sounds.plusNote";
  const unlock = document.createElement("button");
  unlock.type = "button";
  unlock.className = "button button-primary";
  unlock.dataset.i18n = "popup.smart.unlock";
  unlock.addEventListener("click", () => openPlus());
  lockNote.append(lockText, unlock);
  detail.append(summary, lockNote, ...KIND_ROWS.map(row));
  mount.append(row(GENERAL_ROW), detail);

  // Idempotent : un menu déroulant ouvert se ferme dès qu'on touche à ses options,
  // et render() tourne à chaque rafraîchissement des réglages de la popup.
  function translateAll() {
    for (const element of mount.querySelectorAll("[data-i18n]")) {
      const label = t(element.dataset.i18n);
      if (element.textContent !== label) element.textContent = label;
    }
  }

  function render() {
    const prefs = getPreferences() || {};
    const enabled = prefs.soundsEnabled !== false;
    const plus = isPlus();
    if (mount.hidden === enabled) mount.hidden = !enabled;
    if (plusTag.hidden === !plus) plusTag.hidden = plus;
    if (lockNote.hidden === !plus) lockNote.hidden = plus;
    for (const { key, select, listen, inherit } of rows) {
      const locked = inherit && !plus;
      // Sans abonnement le menu affiche « comme le général » : le choix enregistré est gardé, pas appliqué.
      const wanted = inherit ? (locked ? SOUND_INHERIT : normalizeKindSound(prefs[key])) : normalizeGeneralSound(prefs[key]);
      if (select.value !== wanted) select.value = wanted;
      if (select.disabled !== locked) select.disabled = locked;
      if (listen.disabled !== locked) listen.disabled = locked;
    }
    // Un type qui s'écarte du général ouvre la liste : le réglage ne se cache pas.
    if (plus && KIND_ROWS.some(({ key }) => normalizeKindSound(prefs[key]) !== SOUND_INHERIT)) detail.open = true;
    translateAll();
  }

  onLanguageChange(translateAll);
  return { render };
}
