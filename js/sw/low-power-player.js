// Script injecté par le mode auto des badges (monde MAIN de la page Twitch).

// ─── Mode auto des badges ─────────────────────────────────────────────────────
// File de badges regardée par un onglet épinglé et muet, un jeu à la fois :
// voir js/badge-auto-worker.js et js/badge-auto.js.

/**
 * Exécuté dans la page Twitch (monde MAIN) : lecteur en 360p (ou la plus basse
 * offerte), volume à peine audible, et clic sur les écrans bloquants — porte de
 * contenu averti, consentements du chat — qui laissent le live en pause et le
 * temps de regard à zéro, ce qui ressemblait à un mode auto en panne. Le
 * lecteur n'a pas d'API publique : on le trouve dans l'arbre React, comme le
 * font les autres extensions. Une boucle lente réapplique tout : les pubs et
 * les reprises de live remettent la qualité et le volume par défaut.
 */
export function lowPowerPlayer() {
  const TARGET_HEIGHT = 360;
  // Les libellés varient avec la langue du compte : on filtre sur le début du
  // mot, tous les écrans bloquants de Twitch se résument à « continuer/accepter ».
  const ACCEPT_RE = /^(continue|start watching|accept|j'accepte|accepter|continuer|commencer|d'accord|reprendre|regarde)/i;
  const handled = new WeakSet();

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
    player.setAutoSwitchQuality?.(false);
    if (target) player.setQuality?.(target);
    // 0.001 : inaudible même casque à fond. L'onglet est déjà muet côté API
    // tabs ; ce volume interne n'existe que pour que le lecteur Twitch se
    // comporte comme un lecteur non muet (il met en pause certains états muets).
    player.setVolume?.(0.001);
    player.setMuted?.(false);
    if (typeof player.paused === "function" && player.paused() === true && typeof player.play === "function") {
      player.play();
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
