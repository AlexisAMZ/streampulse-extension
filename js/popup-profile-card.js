// Carte pager de « Profil et comptes » : écran LCD (photo, bonjour, pseudo), touches de
// plateforme, champ du pseudo et couleurs d'accent. La plateforme choisie est celle où
// la photo est cherchée ; elle est enregistrée avec le profil (`userProfile.platform`),
// comme à l'onboarding.
import { onLanguageChange, t } from "./i18n.js";
import { getPlatformDefinition } from "./platforms.js";
import { GTA6_EVENT_END } from "./gta6-launch.js";
import { syncGta6Theme } from "./theme-gta6.js";

const PLATFORMS = ["twitch", "kick", "youtube"];
const ACCENTS = [
  { id: "violet", color: "#9146ff", labelKey: "popup.profileCard.accentViolet" },
  { id: "lcd", color: "#4f7a1f", labelKey: "popup.profileCard.accentLcd" },
  { id: "ocean", color: "#2563eb", labelKey: "popup.profileCard.accentOcean" },
  { id: "ember", color: "#c2410c", labelKey: "popup.profileCard.accentEmber" },
  { id: "crimson", color: "#be123c", labelKey: "popup.profileCard.accentCrimson" },
  // Thème événement : sortie de GTA VI le 19/11/2026. Offert à tous jusqu'au 30/11 inclus.
  { id: "gta6", color: "#d81b7a", labelKey: "popup.profileCard.accentGta6", freeUntil: GTA6_EVENT_END.getTime() },
];

/** Une teinte d'événement est libre pendant sa fenêtre, sinon elle suit StreamPulse+. */
function isFreeAccent(entry) {
  return entry.id === "violet" || (entry.freeUntil !== undefined && Date.now() < entry.freeUntil);
}
export const ACCENT_KEY = "popupAccent";
const PREVIEW_DELAY_MS = 450;

const $ = (id) => document.getElementById(id);

function safeImage(raw) {
  try {
    const url = new URL(String(raw || ""));
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

export function normalizeAccent(value) {
  return ACCENTS.some((accent) => accent.id === value) ? value : "violet";
}

export function applyAccent(value) {
  const accent = normalizeAccent(value);
  if (accent === "violet") delete document.body.dataset.accent;
  else document.body.dataset.accent = accent;
  syncGta6Theme(accent);
  return accent;
}

const platformName = (platform) => t(getPlatformDefinition(platform).labelKey);

/**
 * @param {object} options
 * @param {() => object|null} options.getProfile
 * @param {(profile: object) => void} options.setProfile
 * @param {(message: object) => Promise<any>} options.send
 * @param {(text: string, kind: string) => void} options.feedback
 * @param {(button: HTMLElement) => void} options.markSuccess
 * @param {() => boolean} options.isPlus
 * @param {() => void} options.openPlus
 * @param {() => void} options.onSaved
 * @param {string} options.accent accent déjà enregistré
 */
export function initProfileCard(options) {
  const card = $("pager-card");
  const input = $("pref-pseudo-input");
  const saveButton = $("pref-pseudo-save");
  if (!card || !input || !saveButton) return null;

  let platform = PLATFORMS.includes(options.getProfile()?.platform) ? options.getProfile().platform : "twitch";
  let preview = { handle: "", avatarUrl: "", displayName: "", state: "saved" };
  let accent = applyAccent(options.accent);
  let timer = 0;
  let request = 0;

  function currentAvatar() {
    const profile = options.getProfile() || {};
    return preview.state === "saved" ? safeImage(profile.avatarUrl) : safeImage(preview.avatarUrl);
  }

  function renderScreen() {
    const profile = options.getProfile() || {};
    const typed = input.value.trim();
    const name = preview.state === "saved"
      ? profile.displayName || profile.handle || ""
      : preview.displayName || typed;
    const hour = new Date().getHours();
    $("pager-hello").textContent = hour < 18 ? t("popup.greetingMorning") : t("popup.greetingEvening");
    $("pager-name").textContent = name || t("popup.profileCard.namePlaceholder");
    const photo = $("pager-photo");
    photo.dataset.platform = platform;
    $("pager-initials").textContent = (name || "?").slice(0, 1).toUpperCase();
    const image = $("pager-img");
    const src = currentAvatar();
    // La lettre ne reste que tant qu'il n'y a pas de photo affichable : multiplier
    // l'image sur le fond LCD la laisserait transparaître sinon.
    const initials = $("pager-initials");
    initials.hidden = Boolean(src);
    image.hidden = !src;
    if (src) {
      image.onerror = () => {
        image.hidden = true;
        initials.hidden = false;
      };
      if (image.getAttribute("src") !== src) image.src = src;
    } else {
      image.onerror = null;
      image.removeAttribute("src");
    }
    $("pager-platform-icon").src = `../${getPlatformDefinition(platform).icon}`;
    const source = $("pager-source");
    if (preview.state === "looking") source.textContent = t("popup.profileCard.sourceLooking", { platform: platformName(platform) });
    else if (preview.state === "missing") source.textContent = t("popup.profileCard.sourceMissing", { platform: platformName(platform) });
    else source.textContent = src ? t("popup.profileCard.sourceFrom", { platform: platformName(platform) }) : t("popup.profileCard.sourceNone");
    source.dataset.state = preview.state;
  }

  function renderKeys() {
    const box = $("pager-platforms");
    box.replaceChildren(...PLATFORMS.map((id) => {
      const key = document.createElement("button");
      key.type = "button";
      key.className = "pager-key";
      key.dataset.platform = id;
      key.setAttribute("role", "radio");
      key.setAttribute("aria-checked", String(id === platform));
      const icon = document.createElement("img");
      icon.src = `../${getPlatformDefinition(id).icon}`;
      icon.alt = "";
      const label = document.createElement("span");
      label.textContent = platformName(id);
      key.append(icon, label);
      return key;
    }));
  }

  function renderAccents() {
    const box = $("pager-accents");
    const unlocked = options.isPlus();
    box.replaceChildren(...ACCENTS.map((entry) => {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "pager-swatch";
      swatch.dataset.accent = entry.id;
      swatch.style.setProperty("--swatch", entry.color);
      swatch.setAttribute("role", "radio");
      swatch.setAttribute("aria-checked", String(entry.id === accent));
      const locked = !unlocked && !isFreeAccent(entry);
      swatch.classList.toggle("is-locked", locked);
      swatch.title = locked ? `${t(entry.labelKey)} · ${t("popup.plus.badge")}` : t(entry.labelKey);
      swatch.setAttribute("aria-label", swatch.title);
      return swatch;
    }));
  }

  /** Cherche la photo du pseudo tapé sur la plateforme choisie, sans rien enregistrer. */
  function schedulePreview() {
    clearTimeout(timer);
    const handle = input.value.trim();
    const profile = options.getProfile() || {};
    if (!handle || (handle === (profile.handle || "") && platform === (profile.platform || "twitch"))) {
      preview = { handle: "", avatarUrl: "", displayName: "", state: "saved" };
      renderScreen();
      return;
    }
    preview = { handle, avatarUrl: "", displayName: handle, state: "looking" };
    renderScreen();
    const mine = ++request;
    timer = setTimeout(async () => {
      const result = await options.send({ type: "lookupTwitchUser", handle, platform });
      if (mine !== request) return;
      const user = result?.user || null;
      preview = {
        handle,
        avatarUrl: user?.profile_image_url || "",
        displayName: user?.display_name || handle,
        state: user ? "found" : "missing",
      };
      renderScreen();
    }, PREVIEW_DELAY_MS);
  }

  async function save() {
    const raw = input.value.trim();
    if (!raw) {
      options.feedback(t("popup.settings.pseudoEmpty"), "error");
      return;
    }
    clearTimeout(timer);
    request += 1;
    saveButton.disabled = true;
    const previous = options.getProfile() || {};
    // La photo suit le pseudo ET la plateforme : sans compte trouvé, pas de photo
    // vaut mieux que celle de quelqu'un d'autre.
    const lookup = await options.send({ type: "lookupTwitchUser", handle: raw, platform });
    const user = lookup?.user || null;
    const next = {
      ...previous,
      handle: raw,
      platform,
      displayName: user?.display_name || raw,
      avatarUrl: user?.profile_image_url || "",
    };
    const result = await options.send({ type: "updateUserProfile", profile: next });
    saveButton.disabled = false;
    if (!result?.success) {
      options.feedback(result?.error || t("popup.errors.generic"), "error");
      return;
    }
    options.setProfile(next);
    preview = { handle: "", avatarUrl: "", displayName: "", state: user ? "saved" : "missing" };
    renderScreen();
    options.markSuccess(saveButton);
    options.feedback(user ? t("popup.settings.pseudoSaved") : t("popup.profileCard.savedNoPhoto", { platform: platformName(platform) }), user ? "success" : "info");
    options.onSaved();
  }

  $("pager-platforms").addEventListener("click", (event) => {
    const key = event.target.closest(".pager-key");
    if (!key || key.dataset.platform === platform) return;
    platform = key.dataset.platform;
    renderKeys();
    schedulePreview();
    renderScreen();
  });

  $("pager-accents").addEventListener("click", (event) => {
    const swatch = event.target.closest(".pager-swatch");
    if (!swatch) return;
    const id = swatch.dataset.accent;
    if (!options.isPlus() && !isFreeAccent(ACCENTS.find((entry) => entry.id === id))) {
      options.openPlus();
      return;
    }
    accent = applyAccent(id);
    chrome.storage.local.set({ [ACCENT_KEY]: accent });
    renderAccents();
  });

  input.addEventListener("input", schedulePreview);
  saveButton.addEventListener("click", save);
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    save();
  });

  function renderAll() {
    renderKeys();
    renderAccents();
    renderScreen();
  }
  renderAll();
  onLanguageChange(renderAll);
  return { refresh: renderAll, renderAccents };
}
