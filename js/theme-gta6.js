// Thème événement GTA VI : panneau du compte à rebours posé sur la scène d'accueil.
// Monté quand la couleur d'interface « gta6 » est active, retiré dès qu'on en change.
// Le décor (illustration de nuit, panneau du live, néons) est en CSS : css/theme-gta6.css.
import { onLanguageChange, t } from "./i18n.js";
import { launchState } from "./gta6-launch.js";

const STICKER_ID = "gta6-count";
let timer = 0;
let offLanguage = null;

const pad = (value) => String(value).padStart(2, "0");

/** Le banc du popup simule une date avec ?gta6now=2026-11-19T00:00 ; sans effet ailleurs. */
function clockOffset() {
  try {
    const forced = new URLSearchParams(location.search).get("gta6now");
    const time = forced ? Date.parse(forced) : Number.NaN;
    return Number.isFinite(time) ? time - Date.now() : 0;
  } catch {
    return 0;
  }
}

function buildSticker() {
  const box = document.createElement("div");
  box.id = STICKER_ID;
  box.className = "gta6-count";
  const logo = document.createElement("img");
  logo.className = "gta6-count-logo";
  logo.src = "../images/gta6/vi.png";
  logo.alt = "";
  const text = document.createElement("span");
  text.className = "gta6-count-text";
  const label = document.createElement("span");
  label.className = "gta6-count-label";
  const time = document.createElement("span");
  time.className = "gta6-count-time";
  // Le compteur change chaque seconde : un lecteur d'écran n'en lit que la version figée
  // de l'attribut aria-label, mise à jour à la minute.
  time.setAttribute("aria-hidden", "true");
  text.append(label, time);
  box.append(logo, text);
  return box;
}

function render(box, offset) {
  const state = launchState(new Date(Date.now() + offset));
  box.hidden = state.phase === "over";
  box.dataset.phase = state.phase;
  if (state.phase === "over") return state;
  const label = box.querySelector(".gta6-count-label");
  const time = box.querySelector(".gta6-count-time");
  if (state.phase === "out") {
    label.textContent = t("popup.gta6.outLabel");
    time.textContent = t("popup.gta6.outTitle");
    box.setAttribute("aria-label", `${label.textContent} ${time.textContent}`);
    return state;
  }
  label.textContent = t("popup.gta6.countdownLabel");
  const days = t("popup.gta6.days", { days: state.days });
  time.textContent = `${days} ${pad(state.hours)}:${pad(state.minutes)}:${pad(state.seconds)}`;
  box.setAttribute("aria-label", `${label.textContent} ${days} ${pad(state.hours)}:${pad(state.minutes)}`);
  return state;
}

function mount() {
  const stage = document.getElementById("stage");
  if (!stage || document.getElementById(STICKER_ID)) return;
  const box = buildSticker();
  box.setAttribute("role", "img");
  stage.append(box);
  const offset = clockOffset();
  const state = render(box, offset);
  if (state.phase === "soon") {
    timer = setInterval(() => {
      if (render(box, offset).phase !== "soon") stopTimer();
    }, 1000);
  }
  offLanguage = onLanguageChange(() => render(box, offset));
}

function stopTimer() {
  clearInterval(timer);
  timer = 0;
}

function unmount() {
  stopTimer();
  if (typeof offLanguage === "function") offLanguage();
  offLanguage = null;
  document.getElementById(STICKER_ID)?.remove();
}

/** @param {string} accent couleur d'interface active */
export function syncGta6Theme(accent) {
  if (accent === "gta6") mount();
  else unmount();
}

addEventListener("pagehide", unmount);
