// Barre « Chercher un réglage » + filtre par plateforme, et pastilles Twitch / Kick /
// YouTube sur les réglages qui ne concernent pas toutes les plateformes.
import { getPlatformIcon } from "./platforms.js";
import { PLATFORM_FILTERS, matchesFilter, normalizeText, platformsOfIds } from "./settings-filter.js";
import { onLanguageChange, t } from "./i18n.js";

const FILTERABLE_PANELS = ["notifications", "rewards", "player", "general"];
const FOLLOWERS = "P"; // une note ou un statut suit la décision de la ligne qu'il commente

// Clés écrites en entier : le contrôle des clés mortes de verify les voit.
const PLATFORM_LABEL = { twitch: "platforms.twitch", kick: "platforms.kick", youtube: "platforms.youtube" };

export function createSettingsFilter({ root = document } = {}) {
  const bar = root.getElementById("settings-filter");
  const input = root.getElementById("settings-search");
  if (!bar || !input) return null;
  const chips = [...bar.querySelectorAll("[data-platform]")];
  let platform = "all";

  const panels = FILTERABLE_PANELS.map((name) => root.getElementById(`menu-${name}`)).filter(Boolean).map((panel) => {
    const units = [...panel.children].filter((child) => child.tagName !== "H2");
    const entries = units.map((element) => {
      const ids = [...element.querySelectorAll("[id]")].map((node) => node.id).concat(element.id || []);
      return { element, platforms: platformsOfIds(ids), text: normalizeText(element.textContent), heading: element.tagName === "H3" };
    });
    const empty = document.createElement("p");
    empty.className = "settings-note settings-empty";
    empty.setAttribute("role", "status");
    empty.hidden = true;
    empty.dataset.i18n = "popup.settingsFilter.empty";
    panel.append(empty);
    const tab = root.getElementById(`menu-tab-${panel.id.replace("menu-", "")}`);
    return { panel, entries, empty, tab };
  });

  function addTags() {
    for (const { entries } of panels) {
      for (const { element, platforms } of entries) {
        if (!platforms || element.querySelector(":scope .platform-tags")) continue;
        const title = element.querySelector(".settings-title");
        if (!title) continue;
        const tags = document.createElement("span");
        tags.className = "platform-tags";
        for (const name of platforms) {
          const tag = document.createElement("span");
          tag.className = "platform-tag";
          const icon = document.createElement("img");
          icon.src = chrome.runtime.getURL(getPlatformIcon(name));
          icon.alt = "";
          icon.width = 11;
          icon.height = 11;
          const label = document.createElement("span");
          label.dataset.i18n = PLATFORM_LABEL[name];
          tag.append(icon, label);
          tags.append(tag);
        }
        title.append(tags);
      }
    }
  }

  function apply() {
    const query = input.value;
    const active = platform !== "all" || normalizeText(query).trim() !== "";
    for (const { entries, empty, tab } of panels) {
      let visibleCount = 0;
      let previous = true;
      entries.forEach((entry, index) => {
        const { element } = entry;
        // Notes et statuts (<p>) ne sont jamais jugés seuls : ils suivent leur ligne.
        const follows = element.tagName === FOLLOWERS && index > 0 && !entry.heading;
        const shown = !active || (follows ? previous : matchesFilter(entry, { platform, query }));
        element.hidden = !shown;
        if (!follows && !entry.heading) previous = shown;
        if (shown && !entry.heading && !follows) visibleCount += 1;
      });
      // Un titre de groupe sans aucune ligne visible derrière lui disparaît.
      entries.forEach((entry, index) => {
        if (!entry.heading || !active) return;
        let any = false;
        for (let next = index + 1; next < entries.length && !entries[next].heading; next += 1) {
          if (!entries[next].element.hidden && entries[next].element.tagName !== FOLLOWERS) any = true;
        }
        entry.element.hidden = !any;
      });
      empty.hidden = !(active && visibleCount === 0);
      if (tab) tab.toggleAttribute("data-empty", active && visibleCount === 0);
    }
    for (const chip of chips) chip.setAttribute("aria-pressed", String(chip.dataset.platform === platform));
  }

  function translateAll() {
    for (const element of [...bar.querySelectorAll("[data-i18n]"), ...panels.flatMap(({ panel }) => [...panel.querySelectorAll(".platform-tag [data-i18n], .settings-empty")])]) {
      element.textContent = t(element.dataset.i18n);
    }
    input.placeholder = t("popup.settingsFilter.search");
    input.setAttribute("aria-label", t("popup.settingsFilter.search"));
  }

  function syncVisibility() {
    const current = root.querySelector(".menu-nav .menu-tab[aria-selected=\"true\"]")?.dataset.panel;
    bar.hidden = !FILTERABLE_PANELS.includes(current);
  }

  input.addEventListener("input", apply);
  for (const chip of chips) {
    chip.addEventListener("click", () => {
      platform = PLATFORM_FILTERS.includes(chip.dataset.platform) ? chip.dataset.platform : "all";
      apply();
    });
  }
  root.querySelector(".menu-nav")?.addEventListener("click", () => setTimeout(syncVisibility, 0));
  addTags();
  translateAll();
  apply();
  syncVisibility();
  onLanguageChange(translateAll);
  return { apply, syncVisibility };
}
