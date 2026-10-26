// Script injecté par le mode auto des badges (monde MAIN de la page Twitch).

// ─── Mode auto des badges ─────────────────────────────────────────────────────
// File de badges regardée par un onglet épinglé et muet, un jeu à la fois :
// voir js/badge-auto-worker.js et js/badge-auto.js.

/**
 * Exécuté dans la page Twitch (monde MAIN) : lecteur en 360p (ou la plus basse
 * offerte), lecteur non muet à 2 % (l'onglet, lui, est muet), et clic sur les écrans bloquants — porte de
 * contenu averti, consentements du chat — qui laissent le live en pause et le
 * temps de regard à zéro, ce qui ressemblait à un mode auto en panne.
 *
 * Le lecteur n'a pas d'API publique : on le trouve dans l'arbre React, comme le
 * font les autres extensions. Son API perd des morceaux à chaque refonte de
 * Twitch (mediaPlayerInstance.core, paused(), setAutoSwitchQuality ont
 * disparu) : chaque appel est donc optionnel, et l'état de lecture se lit sur
 * l'élément <video>, qui reste stable. Une boucle lente réapplique ce qui a
 * dérivé (pubs, reprises de live) ; setQuality redémarre le lecteur (1 à 2 s
 * figé), elle n'est donc rappelée que si la qualité active n'est déjà pas la
 * cible — sans quoi le flux joue/pause à chaque passage de la boucle.
 */
export function lowPowerPlayer(targetHeight = 360) {
  const TARGET_HEIGHT = Number(targetHeight) > 0 ? Number(targetHeight) : 360;
  // Volume du lecteur : bas mais jamais nul (l'onglet, lui, est muet).
  const MIN_VOLUME = 0.02;
  // Les libellés varient avec la langue du compte : on filtre sur le début du
  // mot, tous les écrans bloquants de Twitch se résument à « continuer/accepter ».
  const ACCEPT_RE = /^(continue|start watching|accept|j'accepte|accepter|continuer|commencer|d'accord|reprendre|regarde)/i;
  const handled = new WeakSet();

  /**
   * L'onglet du mode auto est épinglé et en arrière-plan : sans cette correction Twitch voit
   * document.hidden, suspend la lecture ou baisse la qualité, quel que soit le réglage « ne pas
   * mettre en pause ». Même correction que js/inject/preventPause.js (le script injecté ne peut
   * rien importer) ; elle ne se pose qu'une fois, ou jamais si le réglage l'a déjà posée.
   */
  const keepPageVisible = () => {
    if (typeof Document === "undefined" || typeof window === "undefined") return;
    if (window.__streampulsePreventPause || window.__streampulseAutoVisible) return;
    const win = window;
    win.__streampulseAutoVisible = true;
    const alwaysVisible = (value) => ({ get: () => value, configurable: true });
    try {
      Object.defineProperties(Document.prototype, {
        hidden: alwaysVisible(false),
        webkitHidden: alwaysVisible(false),
        visibilityState: alwaysVisible("visible"),
        webkitVisibilityState: alwaysVisible("visible"),
      });
      Document.prototype.hasFocus = () => true;
    } catch (_) {
      // Prototype verrouillé : le passage suivant réessaiera la lecture, sans la correction.
    }
    const swallow = (event) => event.stopImmediatePropagation();
    for (const type of ["visibilitychange", "webkitvisibilitychange"]) {
      document.addEventListener(type, swallow, true);
      win.addEventListener(type, swallow, true);
    }
    win.addEventListener("blur", (event) => {
      if (event.target === win) event.stopImmediatePropagation();
    }, true);
  };
  keepPageVisible();
  /** L'ancienne API n'a pas de sonde isAutoQualityMode : on ne tente le verrou qu'une fois. */
  let abrLocked = false;

  const findPlayer = () => {
    const root = document.querySelector(".video-player, [data-a-target='video-player']");
    const fiberKey = root && Object.keys(root).find((key) => key.startsWith("__reactFiber$"));
    let node = fiberKey ? root[fiberKey] : null;
    for (let depth = 0; node && depth < 60; depth += 1, node = node.return) {
      const props = node.memoizedProps || {};
      const player = props.mediaPlayerInstance?.core || props.mediaPlayerInstance || null;
      if (player?.getQualities?.().length) return player;
    }
    return null;
  };

  const applyPlayer = () => {
    const player = findPlayer();
    if (!player) return false;
    const sorted = [...(player.getQualities?.() || [])].sort((a, b) => (a.bitrate || a.height || 0) - (b.bitrate || b.height || 0));
    const target = sorted.find((q) => Number(q.height) === TARGET_HEIGHT) || sorted[0];
    // L'ABR re-monterait la qualité et chaque retour à 360p redémarrerait le
    // flux : on le coupe. Le nom actuel est setAutoQualityMode, avec sa sonde
    // isAutoQualityMode ; setAutoSwitchQuality est l'ancien nom, sans sonde :
    // un seul appel alors (abrLocked).
    const autoMode = player.isAutoQualityMode?.();
    if (autoMode === true || (autoMode === undefined && !abrLocked)) {
      if (typeof player.setAutoQualityMode === "function") player.setAutoQualityMode(false);
      else if (typeof player.setAutoSwitchQuality === "function") player.setAutoSwitchQuality(false);
      abrLocked = true;
    }
    if (target) {
      const active = player.getQuality?.();
      if (!active || active.group !== target.group) player.setQuality?.(target);
    }
    // Le silence vient de l'onglet (muet côté API tabs), jamais du lecteur :
    // Twitch ne compte pas le temps de regard d'un lecteur muet ou à 0 %, et
    // arrondit un volume trop faible à 0. Le lecteur reste donc non muet et à
    // 2 % au moins, revérifié à chaque passage (pubs, reprises de live).
    if (!(Number(player.getVolume?.()) >= MIN_VOLUME / 2)) player.setVolume?.(MIN_VOLUME);
    if (player.isMuted?.() !== false) player.setMuted?.(false);
    const video = document.querySelector("video");
    if (video) {
      // Lecture relancée AVANT le démute : Chrome autorise toujours une
      // reprise muette, pas forcément une reprise avec le son. Twitch a retiré
      // paused() de son API : l'état de lecture se lit sur l'élément.
      if (video.paused) {
        try {
          const attempt = typeof player.play === "function" ? player.play() : video.play();
          attempt?.catch?.(() => {});
        } catch (_) {
          // Reprise refusée (politique autoplay) : le passage suivant retentera.
        }
      }
      if (video.muted) video.muted = false;
      if (video.volume < MIN_VOLUME / 2) video.volume = MIN_VOLUME;
    }
    return true;
  };

  /** Un clic par bouton : les écrans n'attendent qu'un « Continuer ». */
  const sweepGates = () => {
    for (const button of document.querySelectorAll("[data-a-button='content-classification-gate_continue'], [data-a-target='content-classification-gate_continue'], [role='dialog'] button")) {
      if (handled.has(button)) continue;
      const label = [button.getAttribute("data-a-button"), button.getAttribute("data-a-target"), button.getAttribute("aria-label"), button.textContent].filter(Boolean).join(" ").trim();
      if (ACCEPT_RE.test(label)) {
        handled.add(button);
        button.click();
      }
    }
  };

  let tries = 0;
  let looping = false;
  const tick = () => {
    const ready = applyPlayer();
    sweepGates();
    if (!looping && (ready || tries >= 15)) {
      looping = true;
      setInterval(tick, 5000);
      return;
    }
    tries += 1;
    setTimeout(tick, 2000);
  };
  tick();
}
