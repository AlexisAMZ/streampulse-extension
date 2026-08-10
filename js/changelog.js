/**
 * Renders the patch notes page from js/changelog-data.js.
 *
 * Everything is built with textContent and explicit attributes — never innerHTML
 * — because contributor handles and URLs are hand-authored data that could
 * otherwise inject markup into this page.
 */

import { RELEASES, getRelease, getLatestRelease, pickLocalized } from "./changelog-data.js";
import { initI18n, applyTranslations, t, resolveLocale, getCurrentLanguage } from "./i18n.js";

/**
 * Texte d'une note de version dans la langue choisie par l'utilisateur.
 *
 * Les notes ne vivent pas dans translations.js : elles changent à chaque
 * release et n'ont pas à passer le contrôle de complétude sur 16 langues.
 */
function localized(value) {
  return pickLocalized(value, getCurrentLanguage());
}

/** Clé de libellé pour chaque type de changement. */
const TYPE_KEYS = {
  new: "changelog.tagNew",
  fix: "changelog.tagFix",
  improved: "changelog.tagImproved",
};

/** Accept only http(s) links, so a bad entry can't yield a javascript: URL. */
function safeUrl(raw) {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function formatDate(iso) {
  if (!iso) return "";
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  // Suit la langue choisie dans StreamPulse, pas celle du navigateur.
  return parsed.toLocaleDateString(resolveLocale(getCurrentLanguage()), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function renderChanges(release) {
  const host = document.getElementById("cl-changes");
  host.replaceChildren();

  const changes = Array.isArray(release.changes) ? release.changes : [];
  if (!changes.length) {
    host.append(el("p", "cl-empty", t("changelog.genericChanges")));
    return;
  }

  // Group by type so related items read together.
  let groupIndex = 0;
  const makeGroup = (tagClass, label) => {
    // .glass and .frame-brackets come from onboarding.css: frosted panel plus
    // the violet corner brackets used throughout that flow.
    const group = el("div", "cl-group glass frame-brackets");
    // Stagger each panel so the list assembles instead of appearing at once.
    group.style.animationDelay = `${0.15 + groupIndex * 0.12}s`;
    groupIndex += 1;
    // Separate element because .frame-brackets owns ::before and ::after.
    group.append(el("span", "cl-group-wash"));
    group.append(el("span", tagClass, label));
    return group;
  };

  for (const type of ["new", "improved", "fix"]) {
    const items = changes.filter((change) => change.type === type);
    if (!items.length) continue;

    const group = makeGroup(`cl-tag cl-tag-${type}`, t(TYPE_KEYS[type] || "changelog.tagOther"));

    const list = el("ul", "cl-list");
    for (const item of items) {
      list.append(el("li", "cl-item", localized(item.text)));
    }
    group.append(list);
    host.append(group);
  }

  // Any unrecognised type still gets shown rather than silently dropped.
  const known = new Set(["new", "improved", "fix"]);
  const rest = changes.filter((change) => !known.has(change.type));
  if (rest.length) {
    const group = makeGroup("cl-tag", t("changelog.tagOther"));
    const list = el("ul", "cl-list");
    for (const item of rest) list.append(el("li", "cl-item", localized(item.text)));
    group.append(list);
    host.append(group);
  }
}

function renderThanks(release) {
  const section = document.getElementById("cl-thanks");
  const list = document.getElementById("cl-thanks-list");
  list.replaceChildren();

  const thanks = (Array.isArray(release.thanks) ? release.thanks : []).filter(
    (entry) => entry && entry.handle,
  );

  // Hide the whole section when there's nobody to credit — an empty
  // "Merci à eux" block looks broken.
  if (!thanks.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;

  // Avec un seul contributeur, « Merci à eux » sonne faux — mais écrire « à lui »
  // supposerait un genre qu'on ne connaît pas. Le titre reste donc neutre, et la
  // phrase d'intro disparaît : sa carte dit déjà qui il est et ce qu'il a fait,
  // la répéter donnait trois fois le même pseudo à l'écran.
  const single = thanks.length === 1;
  document.getElementById("cl-thanks-title").textContent = t(
    single ? "changelog.thanksTitleOne" : "changelog.thanksTitle"
  );
  const intro = document.getElementById("cl-thanks-intro");
  intro.hidden = single;
  if (!single) intro.textContent = t("changelog.thanksIntro");

  thanks.forEach((person, index) => {
    const item = el("li", "cl-thanks-item");
    // Land after the change panels, so the page resolves top to bottom.
    item.style.animationDelay = `${0.5 + index * 0.1}s`;

    const avatar = el("span", "cl-thanks-avatar", person.handle.charAt(0).toUpperCase());
    avatar.setAttribute("aria-hidden", "true");
    item.append(avatar);

    const body = el("span", "cl-thanks-body");
    const url = safeUrl(person.url);
    if (url) {
      const link = el("a", "cl-thanks-handle", person.handle);
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      body.append(link);
    } else {
      body.append(el("span", "cl-thanks-handle", person.handle));
    }
    const credit = localized(person.for);
    if (credit) body.append(el("span", "cl-thanks-for", credit));

    item.append(body);
    list.append(item);
  });
}

/**
 * Ligne « Un bug, une idée ? » avec le lien vers la page de support.
 *
 * L'URL est localisée au même titre que le texte : le site expose une page par
 * langue, et le français n'a pas de préfixe. safeUrl garde le href en https,
 * comme pour les profils de contributeurs.
 */
function renderSupport() {
  const host = document.getElementById("cl-support");
  if (!host) return;
  host.replaceChildren();

  const url = safeUrl(t("changelog.supportUrl"));
  if (!url) {
    host.hidden = true;
    return;
  }
  host.hidden = false;

  // Icône construite en SVG plutôt qu'en emoji : elle hérite de currentColor et
  // reste nette à toutes les tailles, comme le reste des repères de la page.
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("class", "cl-support-icon");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "1.8");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");
  const bubble = document.createElementNS("http://www.w3.org/2000/svg", "path");
  bubble.setAttribute("d", "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 20.5l1.6-4.4A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z");
  icon.append(bubble);

  const text = el("span", "cl-support-text", t("changelog.supportIntro"));

  const link = el("a", "cl-support-link", t("changelog.supportLink"));
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.append(el("span", "cl-support-arrow", "→"));

  const card = el("div", "cl-support-card glass frame-brackets");
  card.append(icon, text, link);
  host.append(card);
}

function renderHistory(currentVersion) {
  const section = document.getElementById("cl-history");
  const host = document.getElementById("cl-history-list");
  host.replaceChildren();

  const past = RELEASES.filter((entry) => entry.version !== currentVersion).slice(0, 5);
  if (!past.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;

  for (const release of past) {
    const details = el("details", "cl-history-entry");
    const summary = el("summary", "cl-history-summary");
    summary.append(el("span", "cl-history-version", `v${release.version}`));
    const historyTitle = localized(release.title);
    if (historyTitle) summary.append(el("span", "cl-history-title", historyTitle));
    details.append(summary);

    const list = el("ul", "cl-list");
    for (const change of release.changes || []) {
      list.append(el("li", "cl-item", localized(change.text)));
    }
    details.append(list);
    host.append(details);
  }
}

/**
 * Fill the oversized serif headline, one <span class="word"> per word.
 *
 * Mirrors onboarding step 0: each word animates in with a stagger, and the last
 * two are italic + violet-gradient, which is what gives that hero its rhythm.
 * The delay is inlined per word because the count is only known at runtime.
 */
function renderDisplay(text) {
  const host = document.getElementById("cl-display");
  host.replaceChildren();

  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return;

  // Accent the tail of the sentence, capped at 2 words so a long release title
  // doesn't end up fully italic.
  const accentFrom = Math.max(words.length - 2, Math.ceil(words.length / 2));

  words.forEach((word, index) => {
    const span = el("span", index >= accentFrom ? "word italic" : "word", word);
    span.style.animationDelay = `${0.1 + index * 0.09}s`;
    host.append(span);
    // Whitespace between inline-block words is not collapsible once we build
    // the nodes ourselves, so add it explicitly.
    if (index < words.length - 1) host.append(document.createTextNode(" "));
  });
}

function render(release) {
  const versionLabel = `v${release.version}`;
  document.getElementById("cl-version").textContent = versionLabel;

  const sysVersion = document.getElementById("cl-sys-version");
  if (sysVersion) sysVersion.textContent = versionLabel.toUpperCase();

  const date = formatDate(release.date);
  document.getElementById("cl-date").textContent = date
    ? `${t("changelog.updatePrefix")} · ${date}`
    : t("changelog.updateInstalled");

  // Le H1 nomme la page, pas la release : le titre propre à la version reste
  // affiché dans « Versions précédentes », et le sous-titre juste dessous dit
  // déjà ce que celle-ci apporte.
  renderDisplay(t("changelog.pageTitle"));

  // Explicit subtitle wins; otherwise summarise so the hero never sits on top
  // of a generic sentence that says nothing about this release.
  const subtitle = document.getElementById("cl-subtitle");
  const releaseSubtitle = localized(release.subtitle);
  if (releaseSubtitle) {
    subtitle.textContent = releaseSubtitle;
  } else {
    const count = Array.isArray(release.changes) ? release.changes.length : 0;
    subtitle.textContent = count
      ? t(count > 1 ? "changelog.changeCountPlural" : "changelog.changeCountSingular", { count })
      : t("changelog.genericChanges");
  }

  renderChanges(release);
  renderThanks(release);
  renderHistory(release.version);
  renderSupport();
}

async function init() {
  // La langue vient de la préférence utilisateur (storage). initI18n doit être
  // résolu avant tout rendu, sinon la première peinture utiliserait la langue
  // par défaut puis changerait sous les yeux de l'utilisateur.
  await initI18n();
  applyTranslations(document);
  document.documentElement.lang = getCurrentLanguage();

  // Prefer the running manifest version so the page always describes what's
  // installed; fall back to the newest entry when that lookup fails.
  let version;
  try {
    version = chrome.runtime.getManifest().version;
  } catch {
    version = "";
  }

  const release = getRelease(version) || getLatestRelease();
  if (!release) {
    renderDisplay(t("changelog.noNotes"));
    document.getElementById("cl-subtitle").textContent = t("changelog.noNotesBody");
    document.getElementById("cl-version").textContent = version ? `v${version}` : "—";
    renderSupport();
    return;
  }

  render(release);
}

document.getElementById("cl-close").addEventListener("click", () => {
  window.close();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") window.close();
});

// init() est asynchrone (chargement de la langue) : un rejet non capturé
// laisserait la page vide sans trace exploitable.
init().catch((error) => {
  console.error("[changelog] init failed:", error);
});
