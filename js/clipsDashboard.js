// Gestionnaire de clips du tableau de bord Twitch (dashboard.twitch.tv/u/<chaîne>/content/clips/…) : une icône
// StreamPulse Clips dans les actions de chaque clip. Un clic copie le lien du clip et l'ouvre dans le studio 9:16.
// Script de page enregistré seulement quand l'utilisateur a accordé l'accès (js/clips-dashboard-access.js).
(() => {
  "use strict";

  if (window.top !== window || window.__streampulseClipsDashboard) return;
  window.__streampulseClipsDashboard = true;

  const HANDOFF = window.StreamPulseClipsHandoff; // js/inject/clips-handoff.js, chargé avant
  const PREFERENCES_KEY = "betaGeneralPreferences";
  const ICON_CLASS = "streampulse-clips-dashboard-icon";
  const STYLE_ID = "streampulse-clips-dashboard-style";
  const ENSURE_INTERVAL_MS = 1500;
  const LOGO_URL = chrome.runtime?.getURL ? chrome.runtime.getURL("images/photos/spclips-logo.png") : "";
  let language;

  function i18n(key) {
    const api = window.__SP_I18N__;
    if (!api || typeof api.get !== "function") return key;
    const lang = typeof api.resolve === "function" ? api.resolve(language) : "en";
    return api.get(lang, "player." + key);
  }

  function insertStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${ICON_CLASS} {
        display: inline-flex; align-items: center; justify-content: center;
        width: 30px; height: 30px; padding: 0; border: 0; border-radius: 9000px; cursor: pointer;
        background: #0e0e10; box-shadow: inset 0 0 0 1.5px rgba(145, 70, 255, 0.85);
        transition: transform 160ms ease, box-shadow 160ms ease;
      }
      .${ICON_CLASS}:hover { transform: scale(1.08); box-shadow: inset 0 0 0 1.5px #b794ff; }
      .${ICON_CLASS}:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
      .${ICON_CLASS} img { width: 19px; height: 19px; object-fit: contain; pointer-events: none; }
      .streampulse-clips-dashboard-toast {
        position: fixed; inset-block-end: 28px; inset-inline-start: 50%; transform: translateX(-50%);
        z-index: 2147483000; padding: 10px 16px; border-radius: 10px; background: #18181b; color: #fff;
        font: 600 13px/1.3 inherit; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
      }
    `;
    document.head?.appendChild(style);
  }

  function toast(message) {
    document.querySelector(".streampulse-clips-dashboard-toast")?.remove();
    const node = document.createElement("div");
    node.className = "streampulse-clips-dashboard-toast";
    node.setAttribute("role", "status");
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 3000);
  }

  async function openClip(row, link) {
    const parsed = HANDOFF.parseClipUrl(link);
    const url = parsed && HANDOFF.editorUrlForClip(link, "twitch_dashboard");
    if (!url) return;
    try {
      await navigator.clipboard.writeText(parsed.canonicalUrl);
    } catch (_) {
      // Copie refusée : l'ouverture du studio suffit.
    }
    const title = row.querySelector("h5[title]")?.getAttribute("title") || "Clip";
    HANDOFF.saveClipToHistory?.({ id: parsed.slug, url: parsed.canonicalUrl, title, channel: parsed.channel || "", platform: "twitch" });
    toast(i18n("clipLinkCopied"));
    window.open(url, "_blank", "noopener");
  }

  /** Lien du clip d'une ligne du tableau : le premier lien /clip/ qu'elle contient. */
  function clipLinkOf(row) {
    for (const anchor of row.querySelectorAll('a[href*="/clip/"]')) {
      if (HANDOFF.parseClipUrl(anchor.href)) return anchor.href;
    }
    return null;
  }

  /** Icône ronde avant le premier bouton d'action (« Partager ») de la ligne. */
  function ensureRow(row) {
    if (row.querySelector(`.${ICON_CLASS}`)) return;
    const link = clipLinkOf(row);
    const columns = row.querySelectorAll(".tw-col");
    const firstAction = columns.length ? columns[columns.length - 1].querySelector('button[class*="ScButtonIcon"]') : null;
    const anchor = firstAction?.parentElement?.parentElement;
    if (!link || !anchor?.parentElement) return;
    const wrapper = document.createElement("div");
    const button = document.createElement("button");
    button.type = "button";
    button.className = ICON_CLASS;
    const label = i18n("clipOpenEditor");
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML = LOGO_URL ? `<img src="${LOGO_URL}" alt="" />` : "SP";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openClip(row, link).catch((error) => console.warn("StreamPulse: SP Clips dashboard failed", error));
    });
    wrapper.appendChild(button);
    anchor.parentElement.insertBefore(wrapper, anchor);
  }

  function ensure() {
    if (!HANDOFF) return;
    insertStyle();
    document.querySelectorAll('[role="row"]').forEach(ensureRow);
  }

  try {
    chrome.storage.local.get(PREFERENCES_KEY, (result) => {
      language = result?.[PREFERENCES_KEY]?.language;
      ensure();
    });
  } catch (_) {
    ensure();
  }
  window.setInterval(ensure, ENSURE_INTERVAL_MS);
})();
