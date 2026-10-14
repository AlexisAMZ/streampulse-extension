/**
 * Le geste du produit, en version barre : port de ReframeMorph
 * (streampulse-clips/apps/mobile/src/components/ReframeMorph.tsx) qui atterrit
 * sur le LogoMark canonique (apps/mobile/src/components/LogoMark.tsx).
 *
 * Départ : un clip 16:9 — jeu, HUD, cible, sol — avec la cam violette en bas à
 * droite. Arrivée : le 9:16 de la marque — bande violette #9146FF en haut
 * (32 %), fin interstice noir, zone blanche au triangle de lecture noir.
 * Mêmes durées et easing que l'app (pose 1 400, morph 900, retour 630,
 * sort-exponentiel). Réduction d'animations : figé sur le logo, état final.
 */

const OUT_H = 44;
const OUT_W = (OUT_H * 9) / 16;
const SRC_W = Math.min(OUT_H * 1.15, 340);
const SRC_H = (SRC_W * 9) / 16;
const K = OUT_H / 300; // les valeurs absolues de l'app (hauteur 300), à l'échelle
const CAM_BAND = 0.32;
const SEAM = Math.max(1.5, OUT_H * 0.04); // l'interstice noir du LogoMark

const HOLD = 1400;
const MORPH = 900;
const HOLD_BACK = Math.round(1400 * 1.6);
const MORPH_BACK = Math.round(MORPH * 0.7);
const CYCLE = HOLD + MORPH + HOLD_BACK + MORPH_BACK;
const O1 = HOLD / CYCLE;
const O2 = (HOLD + MORPH) / CYCLE;
const O3 = (HOLD + MORPH + HOLD_BACK) / CYCLE;
const EXP = "cubic-bezier(0.19, 1, 0.22, 1)";

function el(className, styles) {
  const node = document.createElement("div");
  node.className = className;
  Object.assign(node.style, styles);
  return node;
}

/** Figé : le LogoMark complet (bande, interstice, jeu blanc au play). */
function freezeAtLogo(parts) {
  const { frame, cam, game, seam, whitezone } = parts;
  Object.assign(frame.style, { width: `${OUT_W}px`, height: `${OUT_H}px`, borderRadius: `${Math.round(OUT_W * 0.2)}px` });
  Object.assign(cam.style, {
    width: `${OUT_W}px`, height: `${OUT_H * CAM_BAND}px`, left: "0", top: "0",
    borderRadius: "0", borderWidth: "0px", background: "#9146FF",
  });
  Object.assign(game.style, { opacity: "0" });
  Object.assign(seam.style, { opacity: "1" });
  Object.assign(whitezone.style, { opacity: "1" });
}

export function mountClipsMorph(container) {
  if (!container) return;

  // ── Le clip 16:9 (état de départ) ──
  const game = el("clips-game", {});
  game.append(
    el("clips-hud", {}),
    el("clips-target", {}),
    el("clips-ground", {})
  );
  // ── La cam, future bande ──
  const cam = el("clips-cam", {
    width: `${SRC_W * 0.27}px`, height: `${SRC_H * 0.34}px`,
    left: `${SRC_W - SRC_W * 0.27 - 10 * K}px`, top: `${SRC_H - SRC_H * 0.34 - 10 * K}px`,
  });
  cam.append(el("clips-head", {}), el("clips-shoulders", {}));
  // ── L'arrivée : interstice + zone blanche au play (le LogoMark) ──
  const seam = el("clips-seam", { top: `${OUT_H * CAM_BAND}px`, height: `${SEAM}px`, opacity: "0" });
  const play = el("clips-play", {});
  const whitezone = el("clips-whitezone", {
    top: `${OUT_H * CAM_BAND + SEAM}px`, opacity: "0",
  });
  whitezone.append(play);

  const frame = el("clips-frame", { width: `${SRC_W}px`, height: `${SRC_H}px` });
  frame.append(game, seam, whitezone, cam);
  container.append(frame);

  // Même gabarit de cycle partout : pose, morph aller, pose, morph retour.
  const stops = (values) => [
    { ...values[0], offset: 0, easing: EXP },
    { ...values[0], offset: O1, easing: EXP },
    { ...values[1], offset: O2, easing: EXP },
    { ...values[1], offset: O3, easing: EXP },
    { ...values[0], offset: 1 },
  ];

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    freezeAtLogo({ frame, cam, game, seam, whitezone });
    return;
  }

  frame.animate(
    stops([
      { width: `${SRC_W}px`, height: `${SRC_H}px`, borderRadius: `${Math.round(2 * K)}px` },
      { width: `${OUT_W}px`, height: `${OUT_H}px`, borderRadius: `${Math.round(OUT_W * 0.2)}px` },
    ]),
    { duration: CYCLE, iterations: Infinity }
  );

  cam.animate(
    stops([
      {
        width: `${SRC_W * 0.27}px`, height: `${SRC_H * 0.34}px`,
        left: `${SRC_W - SRC_W * 0.27 - 10 * K}px`, top: `${SRC_H - SRC_H * 0.34 - 10 * K}px`,
        borderRadius: `${Math.max(1, Math.round(1 * K))}px`, borderWidth: "1px",
      },
      {
        width: `${OUT_W}px`, height: `${OUT_H * CAM_BAND}px`,
        left: "0px", top: "0px", borderRadius: "0px", borderWidth: "0px",
      },
    ]),
    { duration: CYCLE, iterations: Infinity }
  );

  game.animate(
    [
      { opacity: "1", top: "0px", transform: "scale(1)", offset: 0, easing: EXP },
      { opacity: "1", top: "0px", transform: "scale(1)", offset: O1, easing: EXP },
      { opacity: "0.25", top: `${OUT_H * CAM_BAND + SEAM + 0.3 * K}px`, transform: "scale(1.35)", offset: O2, easing: EXP },
      { opacity: "0.25", top: `${OUT_H * CAM_BAND + SEAM + 0.3 * K}px`, transform: "scale(1.35)", offset: O3, easing: EXP },
      { opacity: "1", top: "0px", transform: "scale(1)", offset: 1 },
    ],
    { duration: CYCLE, iterations: Infinity }
  );

  // L'arrivée du logo : interstice + zone blanche apparaissent au passage
  // (le jeu s'estompe dessous, comme la bascule de libellé de l'app).
  for (const layer of [seam, whitezone]) {
    layer.animate(
      stops([{ opacity: "0" }, { opacity: "1" }]),
      { duration: CYCLE, iterations: Infinity }
    );
  }
}
