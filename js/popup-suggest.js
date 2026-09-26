// Suggestions sous le champ d'ajout, comme la recherche de Twitch : dès deux
// lettres, les chaînes correspondantes s'affichent (avatar, direct, jeu).
// Flèches pour parcourir, Entrée ou clic pour ajouter, Échap pour fermer.
// Les chaînes déjà suivies sont signalées et ne s'ajoutent pas une deuxième fois.

import { t } from "./i18n.js";
import { cleanQuery } from "./channel-search.js";

const DEBOUNCE_MS = 220;
const LIST_ID = "streamer-suggest";

let deps = null;
let list = null;
let items = [];
let active = -1;
let timer = 0;
let sequence = 0;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

const followedKeys = () =>
  new Set((deps.getStreamers() || []).map((streamer) => `${streamer.platform || "twitch"}:${String(streamer.handle || streamer.twitch || "").toLowerCase()}`));

function formatFollowers(count) {
  return new Intl.NumberFormat(document.documentElement.lang || undefined, { notation: "compact", maximumFractionDigits: 1 }).format(count);
}

function subtitle(item) {
  if (item.live) return item.game ? t("popup.suggest.liveGame", { game: item.game }) : t("popup.suggest.live");
  return item.followers ? t("popup.suggest.followers", { count: formatFollowers(item.followers) }) : "";
}

function close() {
  items = [];
  active = -1;
  if (!list) return;
  list.hidden = true;
  list.replaceChildren();
  deps.input.setAttribute("aria-expanded", "false");
  deps.input.removeAttribute("aria-activedescendant");
}

function setActive(index) {
  active = index;
  [...list.children].forEach((option, i) => option.setAttribute("aria-selected", String(i === index)));
  if (index >= 0) {
    deps.input.setAttribute("aria-activedescendant", `${LIST_ID}-${index}`);
    list.children[index]?.scrollIntoView({ block: "nearest" });
  } else {
    deps.input.removeAttribute("aria-activedescendant");
  }
}

function render() {
  const followed = followedKeys();
  list.replaceChildren(...items.map((item, index) => {
    const option = node("li", "suggest-option");
    option.id = `${LIST_ID}-${index}`;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", "false");
    const avatar = node("span", item.live ? "suggest-avatar is-live" : "suggest-avatar");
    if (item.avatar) {
      const img = node("img");
      img.src = item.avatar;
      img.alt = "";
      img.loading = "lazy";
      img.onerror = () => img.remove();
      avatar.append(img);
    } else {
      avatar.textContent = item.displayName.slice(0, 1).toUpperCase();
    }
    const body = node("span", "suggest-body");
    body.append(node("b", null, item.displayName));
    const line = subtitle(item);
    if (line) body.append(node("small", item.live ? "is-live" : "", line));
    option.append(avatar, body);
    if (followed.has(`${item.platform}:${item.login}`)) {
      option.classList.add("is-followed");
      option.setAttribute("aria-disabled", "true");
      option.append(node("span", "suggest-tag", t("popup.suggest.followed")));
    }
    option.addEventListener("mousedown", (event) => event.preventDefault());
    option.addEventListener("click", () => choose(index));
    option.addEventListener("mousemove", () => active !== index && setActive(index));
    return option;
  }));
  list.hidden = items.length === 0;
  deps.input.setAttribute("aria-expanded", String(items.length > 0));
  setActive(-1);
}

/** Ajoute la chaîne choisie avec le formulaire habituel : mêmes contrôles, même retour. */
function choose(index) {
  const item = items[index];
  if (!item || list.children[index]?.classList.contains("is-followed")) return;
  deps.input.value = item.login;
  close();
  deps.form.requestSubmit();
}

async function lookup() {
  const platform = deps.getPlatform();
  const query = cleanQuery(deps.input.value);
  const ticket = ++sequence;
  if (!query || (platform !== "twitch" && platform !== "kick")) {
    close();
    return;
  }
  try {
    const response = await chrome.runtime.sendMessage({ type: "searchChannels", platform, query });
    // Une frappe plus récente a pris le relais : cette réponse est périmée.
    if (ticket !== sequence || document.activeElement !== deps.input) return;
    items = Array.isArray(response?.items) ? response.items : [];
    render();
  } catch (error) {
    console.warn("[popup] suggestions :", error?.message || error);
    close();
  }
}

function onKeydown(event) {
  if (list.hidden) return;
  // -1 : retour au texte saisi, comme dans la recherche de Twitch.
  if (event.key === "ArrowDown") {
    event.preventDefault();
    setActive(active + 1 >= items.length ? -1 : active + 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    setActive(active <= -1 ? items.length - 1 : active - 1);
  } else if (event.key === "Enter" && active >= 0) {
    event.preventDefault();
    choose(active);
  } else if (event.key === "Escape") {
    event.preventDefault();
    close();
  }
}

/**
 * @param {{ input: HTMLInputElement, form: HTMLFormElement,
 *           getPlatform: () => string, getStreamers: () => object[] }} options
 */
export function initSuggest(options) {
  if (!options?.input || !options.form) return;
  deps = options;
  list = node("ul", "suggest-list");
  list.id = LIST_ID;
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", t("popup.suggest.label"));
  list.hidden = true;
  deps.input.closest(".add-field")?.append(list);
  deps.input.setAttribute("role", "combobox");
  deps.input.setAttribute("aria-autocomplete", "list");
  deps.input.setAttribute("aria-expanded", "false");
  deps.input.setAttribute("aria-controls", LIST_ID);
  deps.input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(lookup, DEBOUNCE_MS);
  });
  deps.input.addEventListener("keydown", onKeydown);
  deps.input.addEventListener("blur", () => setTimeout(close, 120));
  deps.form.addEventListener("submit", () => {
    sequence++;
    close();
  });
  document.getElementById("platform-picker")?.addEventListener("click", () => {
    sequence++;
    close();
  });
}
