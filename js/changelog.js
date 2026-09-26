/**
 * Renders the patch notes page from js/changelog-data.js.
 *
 * Everything is built with textContent and explicit attributes, never innerHTML,
 * because contributor handles and URLs are hand-authored data that could
 * otherwise inject markup into this page.
 */

import { RELEASES, getLatestRelease, pickLocalized } from "./changelog-data.js";
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

/** Thèmes d'une grosse version, dans l'ordre de la page (voir changelog-data.js). */
const AREA_ORDER = ["drops", "badges", "points", "plus", "interface", "fixes"];

/**
 * Sépare l'intitulé d'un changement de son détail : « Nouveau panneau Drops :
 * tes Drops… » devient un titre et un paragraphe, lisibles en diagonale. Seul
 * un deux-points suivi d'une espace compte (« 16:9 » reste entier), et
 * l'intitulé doit rester court ; sinon le texte reste d'un seul tenant.
 */
function splitLead(text) {
  // Intitulé : dans la première phrase, 90 caractères au plus, avant « : » ou « ： ».
  const match = /^([^.!?。]{3,90}?)\s?(?::\s+|：\s*)(\S[\s\S]*)$/u.exec(text);
  if (!match) return { lead: "", body: text };
  const locale = resolveLocale(getCurrentLanguage());
  const body = match[2];
  return { lead: match[1].trim(), body: body.charAt(0).toLocaleUpperCase(locale) + body.slice(1) };
}

function renderItem(change) {
  const item = el("li", "cl-item");
  const { lead, body } = splitLead(localized(change.text));
  const copy = el("div", "cl-copy");
  if (lead) copy.append(el("h3", "cl-lead", lead));
  copy.append(el("p", "cl-text", body));
  item.append(copy);
  const type = TYPE_KEYS[change.type] ? change.type : "other";
  item.append(el("span", `cl-tag cl-tag-${type}`, t(TYPE_KEYS[type] || "changelog.tagOther")));
  return item;
}

/** Une section du corps de page, repérée par le sommaire. */
function renderSection(id, label, changes) {
  const section = el("section", "cl-area");
  section.id = id;
  section.setAttribute("aria-labelledby", `${id}-title`);
  const title = el("h2", "cl-area-title");
  title.id = `${id}-title`;
  title.append(el("span", null, label), el("span", "cl-area-count", String(changes.length)));
  const list = el("ul", "cl-list");
  for (const change of changes) list.append(renderItem(change));
  section.append(title, list);
  return section;
}

/**
 * Sections de la version : par thème quand les changements en portent un
 * (grosse version), sinon par type comme avant. Renvoie { id, label, count }
 * pour le sommaire.
 */
function renderChanges(release) {
  const host = document.getElementById("cl-changes");
  host.replaceChildren();

  const changes = Array.isArray(release.changes) ? release.changes : [];
  if (!changes.length) {
    host.append(el("p", "cl-empty", t("changelog.genericChanges")));
    return [];
  }

  const byArea = changes.some((change) => change.area);
  // Rangé par type, l'étiquette répéterait le titre de sa section.
  host.classList.toggle("is-by-type", !byArea);
  const keys = byArea ? AREA_ORDER : ["new", "improved", "fix"];
  const groupOf = (change) => (byArea ? change.area : change.type);
  const labelOf = (key) => t(byArea ? `changelog.areas.${key}` : TYPE_KEYS[key]);
  const sections = [];
  for (const key of keys) {
    const items = changes.filter((change) => groupOf(change) === key);
    if (!items.length) continue;
    const id = `cl-${key}`;
    host.append(renderSection(id, labelOf(key), items));
    sections.push({ id, label: labelOf(key), count: items.length });
  }

  // Un thème ou un type inconnu reste affiché plutôt que perdu.
  const rest = changes.filter((change) => !keys.includes(groupOf(change)));
  if (rest.length) {
    host.append(renderSection("cl-other", t("changelog.tagOther"), rest));
    sections.push({ id: "cl-other", label: t("changelog.tagOther"), count: rest.length });
  }
  return sections;
}

/**
 * Sommaire : colonne fixe sur grand écran, ligne de pastilles sur mobile. Le
 * lien de la section visible est marqué aria-current au fil de la lecture.
 */
function renderToc(entries) {
  const nav = document.getElementById("cl-toc");
  const list = document.getElementById("cl-toc-list");
  if (!nav || !list) return;
  list.replaceChildren();
  // Une version courte se lit d'un coup d'œil : pas de sommaire.
  if (entries.length < 3) {
    nav.hidden = true;
    return;
  }
  nav.hidden = false;
  const links = new Map();
  for (const entry of entries) {
    const item = el("li");
    const link = el("a", "cl-toc-link");
    link.href = `#${entry.id}`;
    link.append(el("span", "cl-toc-label", entry.label));
    if (entry.count) link.append(el("span", "cl-toc-count", String(entry.count)));
    item.append(link);
    list.append(item);
    links.set(entry.id, link);
  }
  if (typeof IntersectionObserver !== "function") return;
  const visible = new Set();
  // Rien dans la zone de lecture (haut de page, entre deux sections) : on garde
  // la dernière section repérée, la première au départ.
  let current = entries[0].id;
  const mark = () => {
    current = entries.find((entry) => visible.has(entry.id))?.id || current;
    links.forEach((link, id) => {
      if (id === current) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  };
  const observer = new IntersectionObserver((records) => {
    for (const record of records) {
      if (record.isIntersecting) visible.add(record.target.id);
      else visible.delete(record.target.id);
    }
    mark();
  }, { rootMargin: "-20% 0px -55% 0px" });
  for (const entry of entries) {
    const target = document.getElementById(entry.id);
    if (target) observer.observe(target);
  }
  mark();
}

function renderThanks(release) {
  const section = document.getElementById("cl-thanks");
  const list = document.getElementById("cl-thanks-list");
  list.replaceChildren();

  const thanks = (Array.isArray(release.thanks) ? release.thanks : []).filter(
    (entry) => entry && entry.handle,
  );

  // Hide the whole section when there's nobody to credit: an empty
  // "Merci à eux" block looks broken.
  if (!thanks.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;

  // Avec un seul contributeur, « Merci à eux » sonne faux, mais écrire « à lui »
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

  thanks.forEach((person) => {
    const item = el("li", "cl-thanks-item");

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
    for (const change of release.changes || []) list.append(renderItem(change));
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

  // Le grand titre H1 affiche directement le titre de la mise à jour actuelle
  renderDisplay(localized(release.title) || t("changelog.pageTitle"));


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

  const sections = renderChanges(release);
  renderThanks(release);
  renderHistory(release.version);
  renderSupport();
  const extras = [
    { id: "cl-thanks", label: document.getElementById("cl-thanks-title").textContent },
    { id: "cl-history", label: t("changelog.historyTitle") },
  ].filter((entry) => !document.getElementById(entry.id).hidden);
  renderToc([...sections, ...extras]);
}

async function init() {
  // La langue vient de la préférence utilisateur (storage). initI18n doit être
  // résolu avant tout rendu, sinon la première peinture utiliserait la langue
  // par défaut puis changerait sous les yeux de l'utilisateur.
  await initI18n();
  applyTranslations(document);
  document.documentElement.lang = getCurrentLanguage();

  // Toujours afficher la dernière version publiée (notes de la mise à jour actuelle)
  const release = getLatestRelease();
  if (!release) {
    renderDisplay(t("changelog.noNotes"));
    document.getElementById("cl-subtitle").textContent = t("changelog.noNotesBody");
    document.getElementById("cl-version").textContent = "—";
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
