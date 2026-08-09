/**
 * Renders the patch notes page from js/changelog-data.js.
 *
 * Everything is built with textContent and explicit attributes — never innerHTML
 * — because contributor handles and URLs are hand-authored data that could
 * otherwise inject markup into this page.
 */

import { RELEASES, getRelease, getLatestRelease } from "./changelog-data.js";

const TYPE_LABELS = {
  new: "NOUVEAU",
  fix: "CORRIGÉ",
  improved: "AMÉLIORÉ",
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
  return parsed.toLocaleDateString("fr-FR", {
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
    host.append(el("p", "cl-empty", "Corrections internes et améliorations de stabilité."));
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

    const group = makeGroup(`cl-tag cl-tag-${type}`, TYPE_LABELS[type] || type.toUpperCase());

    const list = el("ul", "cl-list");
    for (const item of items) {
      list.append(el("li", "cl-item", item.text || ""));
    }
    group.append(list);
    host.append(group);
  }

  // Any unrecognised type still gets shown rather than silently dropped.
  const known = new Set(["new", "improved", "fix"]);
  const rest = changes.filter((change) => !known.has(change.type));
  if (rest.length) {
    const group = makeGroup("cl-tag", "AUTRE");
    const list = el("ul", "cl-list");
    for (const item of rest) list.append(el("li", "cl-item", item.text || ""));
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
    if (person.for) body.append(el("span", "cl-thanks-for", person.for));

    item.append(body);
    list.append(item);
  });
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
    if (release.title) summary.append(el("span", "cl-history-title", release.title));
    details.append(summary);

    const list = el("ul", "cl-list");
    for (const change of release.changes || []) {
      list.append(el("li", "cl-item", change.text || ""));
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
    ? `MISE À JOUR · ${date}`
    : "MISE À JOUR INSTALLÉE";

  renderDisplay(release.title || `Version ${release.version}`);

  // Explicit subtitle wins; otherwise summarise so the hero never sits on top
  // of a generic sentence that says nothing about this release.
  const subtitle = document.getElementById("cl-subtitle");
  if (release.subtitle) {
    subtitle.textContent = release.subtitle;
  } else {
    const count = Array.isArray(release.changes) ? release.changes.length : 0;
    subtitle.textContent = count
      ? `${count} changement${count > 1 ? "s" : ""} dans cette version.`
      : "Corrections internes et améliorations de stabilité.";
  }

  renderChanges(release);
  renderThanks(release);
  renderHistory(release.version);
}

function init() {
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
    renderDisplay("Aucune note disponible");
    document.getElementById("cl-subtitle").textContent =
      "Les notes de cette version n'ont pas encore été publiées.";
    document.getElementById("cl-version").textContent = version ? `v${version}` : "—";
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

init();
