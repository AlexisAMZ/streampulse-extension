(() => {
  "use strict";

  // Applique la qualite choisie par l'utilisateur au lecteur Twitch.
  //
  // Tourne dans le monde MAIN : l'instance du lecteur n'existe que dans la page,
  // elle est atteinte via le fibre React du conteneur video. Le reglage arrive
  // par localStorage, ecrit depuis twitchPlayerEnhancer.js (monde isole, seul a
  // pouvoir lire chrome.storage).
  //
  // "auto" (defaut) ne touche a rien : Twitch garde entierement la main.

  if (window.__streampulsePlayerQuality) return;
  window.__streampulsePlayerQuality = true;

  const FLAG_KEY = "streampulse:playerQuality";
  const TICK_MS = 2000;
  const RETRY_AFTER_CHANGE_MS = 1200;

  let lastApplied = "";
  let lastChannel = "";

  function wanted() {
    try {
      return window.localStorage.getItem(FLAG_KEY) || "auto";
    } catch (_error) {
      return "auto";
    }
  }

  function fiberOf(node) {
    if (!node) return null;
    for (const key of Object.keys(node)) {
      if (key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")) {
        return node[key];
      }
    }
    return null;
  }

  /** Remonte le fibre React jusqu'a l'instance du lecteur exposee par Twitch. */
  function findPlayer() {
    const node =
      document.querySelector('div[data-a-target="video-player"]') ||
      document.querySelector("video");
    let fiber = fiberOf(node);
    while (fiber) {
      const props = fiber.memoizedProps || fiber.pendingProps;
      const candidate = props?.mediaPlayerInstance || props?.player;
      if (candidate && typeof candidate.getQualities === "function") return candidate;
      fiber = fiber.return;
    }
    return null;
  }

  // Premier nombre du libelle : "1440p60" vaut 1440, pas 144060.
  const heightOf = (q) =>
    Number(q.height) || Number(/(\d+)/.exec(String(q.name || q.quality || ""))?.[1]) || 0;

  /**
   * Choisit la qualite la plus proche de la cible, et a egalite la superieure.
   *
   * Descendre systematiquement serait faux sur Twitch : quand une chaine diffuse
   * en 1440p, le 1080p disparait de la liste. Demander 1080p doit alors donner
   * 1440p, pas 720p.
   *
   * "source" prend la premiere, que Twitch classe de la meilleure a la moins bonne.
   */
  function pickQuality(qualities, target) {
    if (!Array.isArray(qualities) || qualities.length === 0) return null;
    if (target === "source") return qualities[0];
    const wantedHeight = Number(target);
    if (!Number.isFinite(wantedHeight)) return null;
    const usable = qualities.filter((q) => heightOf(q) > 0);
    if (usable.length === 0) return null;
    return usable.reduce((best, q) => {
      const gap = Math.abs(heightOf(q) - wantedHeight);
      const bestGap = Math.abs(heightOf(best) - wantedHeight);
      if (gap < bestGap) return q;
      if (gap === bestGap && heightOf(q) > heightOf(best)) return q;
      return best;
    });
  }

  function currentChannel() {
    return window.location.pathname;
  }

  function apply() {
    const target = wanted();
    const channel = currentChannel();
    if (channel !== lastChannel) {
      lastChannel = channel;
      lastApplied = "";
    }
    if (target === "auto") {
      lastApplied = "auto";
      return;
    }
    if (lastApplied === target) return;

    const player = findPlayer();
    if (!player) return;
    let qualities;
    try {
      qualities = player.getQualities();
    } catch (_error) {
      return;
    }
    const quality = pickQuality(qualities, target);
    if (!quality) return;

    try {
      if (typeof player.setAutoQualityMode === "function") player.setAutoQualityMode(false);
      try {
        player.setQuality(quality.group ?? quality);
      } catch (_error) {
        player.setQuality(quality);
      }
      lastApplied = target;
    } catch (error) {
      console.warn("StreamPulse: impossible d'appliquer la qualite", error);
    }
  }

  window.setInterval(apply, TICK_MS);
  window.addEventListener("streampulse:quality-changed", () => {
    lastApplied = "";
    window.setTimeout(apply, RETRY_AFTER_CHANGE_MS);
  });
  apply();
})();
