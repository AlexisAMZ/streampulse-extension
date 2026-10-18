// Relier un streamer à son compte d'une autre plateforme, depuis la carte du live
// d'accueil : un bouton ouvre la liste des comptes reliables, un clic suffit.
// Le lien écrit le même groupe que les Réglages ; seul l'affichage est regroupé.
import { t } from "./i18n.js";
import { LINKED_ACCOUNTS_KEY, getLinkedGroup, linkCandidates, linkPair, unlinkStreamer } from "./linked-accounts.js";
import { getPlatformIcon, getPlatformLabelKey } from "./platforms.js";

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

const nameOf = (streamer) => streamer.displayName || streamer.handle || streamer.twitch || streamer.id;
const platformName = (streamer) => t(getPlatformLabelKey(streamer.platform || "twitch"));

/**
 * @param {{ mount: HTMLElement, getStreamers: () => object[], getGroups: () => object[], notify: (message: string, type?: string) => void }} options
 * Renvoie { toggle(streamer), refresh(), close(), isOpenFor(id) }.
 */
export function createLinkPicker({ mount, getStreamers, getGroups, notify }) {
  const panel = el("div", "link-picker");
  panel.setAttribute("role", "dialog");
  panel.hidden = true;
  mount.append(panel);
  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    close();
    mount.querySelector(".link-button")?.focus();
  });
  let openFor = null;
  let busy = false;

  async function write(nextGroups, message) {
    if (busy) return;
    busy = true;
    try {
      await chrome.storage.local.set({ [LINKED_ACCOUNTS_KEY]: nextGroups });
      notify(message, "success");
      close();
    } catch (error) {
      console.warn("[popup] lien impossible à enregistrer", error);
      notify(t("popup.linkPicker.error"), "error");
    } finally {
      // eslint-disable-next-line require-atomic-updates -- garde de réentrance : seul ce flux écrit `busy`.
      busy = false;
    }
  }

  function candidateRow(streamer, source) {
    const row = el("button", "link-option");
    row.type = "button";
    const avatar = el("img", "link-option-avatar");
    avatar.alt = "";
    avatar.src = streamer.avatarUrl || chrome.runtime.getURL(getPlatformIcon(streamer.platform || "twitch"));
    avatar.addEventListener("error", () => { avatar.src = chrome.runtime.getURL(getPlatformIcon(streamer.platform || "twitch")); }, { once: true });
    const text = el("span", "link-option-text");
    text.append(el("span", "link-option-name", nameOf(streamer)), el("span", "link-option-platform", platformName(streamer)));
    row.append(avatar, text);
    row.addEventListener("click", () => {
      const next = linkPair(getGroups(), getStreamers(), source.id, streamer.id, nameOf(source));
      if (next.length === getGroups().length) {
        notify(t("popup.linkPicker.error"), "error");
        return;
      }
      write(next, t("popup.linkPicker.done", { first: nameOf(source), second: nameOf(streamer) }));
    });
    return row;
  }

  function render() {
    const streamers = getStreamers();
    const source = streamers.find((streamer) => streamer.id === openFor);
    if (!source) {
      close();
      return;
    }
    const heading = el("p", "link-picker-title", t("popup.linkPicker.title", { name: nameOf(source) }));
    const close_ = el("button", "link-picker-close");
    close_.type = "button";
    close_.setAttribute("aria-label", t("popup.linkPicker.close"));
    close_.textContent = "×";
    close_.addEventListener("click", close);
    const head = el("div", "link-picker-head");
    head.append(heading, close_);
    panel.setAttribute("aria-label", heading.textContent);

    const group = getLinkedGroup(getGroups(), source.id);
    const body = el("div", "link-picker-body");
    if (group) {
      const partners = group.streamerIds.filter((id) => id !== source.id).map((id) => streamers.find((streamer) => streamer.id === id)).filter(Boolean);
      body.append(el("p", "link-picker-note", t("popup.linkPicker.linkedWith", { names: partners.map((p) => `${nameOf(p)} (${platformName(p)})`).join(", ") })));
      const unlink = el("button", "button button-quiet", t("popup.linkPicker.unlink"));
      unlink.type = "button";
      unlink.addEventListener("click", () => write(unlinkStreamer(getGroups(), streamers, source.id), t("popup.linkPicker.unlinked")));
      body.append(unlink);
    } else {
      const candidates = linkCandidates(streamers, getGroups(), source.id);
      body.append(el("p", "link-picker-note", t(candidates.length ? "popup.linkPicker.hint" : "popup.linkPicker.none", { platform: platformName(source) })));
      const rows = candidates.map((candidate) => ({ candidate, node: candidateRow(candidate, source) }));
      // Beaucoup de comptes : un champ de recherche filtre la liste sans la recharger.
      if (rows.length > 6) {
        const search = el("input", "link-picker-search");
        search.type = "search";
        search.placeholder = t("popup.linkPicker.search");
        search.setAttribute("aria-label", t("popup.linkPicker.search"));
        search.addEventListener("input", () => {
          const query = search.value.trim().toLowerCase();
          rows.forEach(({ candidate, node }) => { node.hidden = Boolean(query) && !nameOf(candidate).toLowerCase().includes(query); });
        });
        body.append(search);
      }
      rows.forEach(({ node }) => body.append(node));
    }
    panel.replaceChildren(head, body);
  }

  function close() {
    openFor = null;
    panel.hidden = true;
    panel.replaceChildren();
    mount.classList.remove("has-link-picker");
  }

  return {
    toggle(streamer) {
      if (openFor === streamer.id) {
        close();
        return;
      }
      openFor = streamer.id;
      panel.hidden = false;
      mount.classList.add("has-link-picker");
      render();
      panel.querySelector("button")?.focus();
    },
    refresh() {
      if (openFor) render();
    },
    close,
    isOpenFor: (id) => openFor === id,
  };
}
