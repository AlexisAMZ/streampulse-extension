/**
 * Le geste du produit, en version barre : port fidèle de ReframeMorph
 * (streampulse-clips/apps/mobile/src/components/ReframeMorph.tsx).
 *
 * Un clip 16:9 dont la cam violette (en bas à droite) remonte et devient la
 * bande du haut d'un 9:16 ; le jeu glisse sous la bande et zoome. Mêmes
 * gabarits, mêmes durées (pose 1 400 ms, morph 900 ms, retour 630 ms) et
 * même easing sort-exponentiel que l'app. Réduction d'animations : figé à
 * l'état final (9:16, bande en haut), comme dans l'app.
 */

const OUT_H = 44;
const OUT_W = (OUT_H * 9) / 16;
const SRC_W = Math.min(OUT_H * 1.15, 340);
const SRC_H = (SRC_W * 9) / 16;
const K = OUT_H / 300; // les valeurs absolues de l'app (hauteur 300), à l'échelle
const CAM_BAND = 0.32;

const HOLD = 1400;
const MORPH = 900;
const HOLD_BACK = Math.round(1400 * 1.6);
const MORPH_BACK = Math.round(MORPH * 0.7);
const CYCLE = HOLD + MORPH + HOLD_BACK + MORPH_BACK;
const O1 = HOLD / CYCLE;
const O2 = (HOLD + MORPH) / CYCLE;
const O3 = (HOLD + MORPH + HOLD_BACK) / CYCLE;
const EXP = "cubic-bezier(0.19, 1, 0.22, 1)";

// Couleurs du thème spclips (apps/mobile/src/theme.ts)
const C = {
  frame: "#2C2C2E",
  separator: "rgba(84, 84, 88, 0.65)",
  active: "#9146FF",
  activeText: "#B794FF",
  surface: "#1C1C1E",
  silhouette: "rgba(0, 0, 0, 0.3)",
};

function el(className, styles) {
  const node = document.createElement("div");
  node.className = className;
  Object.assign(node.style, styles);
  return node;
}

/** Arrête les boucles et fige à l'état final (réduction d'animations). */
function freezeAtEnd(parts) {
  const { frame, cam, game } = parts;
  Object.assign(frame.style, { width: `${OUT_W}px`, height: `${OUT_H}px`, borderRadius: `${4 * K}px` });
  Object.assign(cam.style, {
    width: `${OUT_W}px`, height: `${OUT_H * CAM_BAND}px`, left: "0", top: "0",
    borderRadius: "0", borderWidth: "0px",
  });
  Object.assign(game.style, { top: `${OUT_H * CAM_BAND}px`, transform: "scale(1.35)" });
}

export function mountClipsMorph(container) {
  if (!container) return;

  const frame = el("clips-frame", { width: `${SRC_W}px`, height: `${SRC_H}px` });
  const hud = el("clips-hud", {});
  const target = el("clips-target", {});
  const ground = el("clips-ground", {});
  const game = el("clips-game", {});
  game.append(hud, target, ground);
  const cam = el("clips-cam", {
    width: `${SRC_W * 0.27}px`, height: `${SRC_H * 0.34}px`,
    left: `${SRC_W - SRC_W * 0.27 - 10 * K}px`, top: `${SRC_H - SRC_H * 0.34 - 10 * K}px`,
  });
  const head = el("clips-head", {});
  const shoulders = el("clips-shoulders", {});
  cam.append(head, shoulders);
  frame.append(game, cam);
  container.append(frame);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    freezeAtEnd({ frame, cam, game });
    return;
  }

  const stops = (values) => [
    { ...values[0], offset: 0, easing: EXP },
    { ...values[0], offset: O1, easing: EXP },
    { ...values[1], offset: O2, easing: EXP },
    { ...values[1], offset: O3, easing: EXP },
    { ...values[0], offset: 1 },
  ];

  frame.animate(
    stops([
      { width: `${SRC_W}px`, height: `${SRC_H}px`, borderRadius: `${2 * K}px` },
      { width: `${OUT_W}px`, height: `${OUT_H}px`, borderRadius: `${4 * K}px` },
    ]),
    { duration: CYCLE, iterations: Infinity }
  );

  cam.animate(
    stops([
      {
        width: `${SRC_W * 0.27}px`, height: `${SRC_H * 0.34}px`,
        left: `${SRC_W - SRC_W * 0.27 - 10 * K}px`, top: `${SRC_H - SRC_H * 0.34 - 10 * K}px`,
        borderRadius: `${1 * K}px`, borderWidth: "1px",
      },
      {
        width: `${OUT_W}px`, height: `${OUT_H * CAM_BAND}px`,
        left: "0px", top: "0px", borderRadius: "0px", borderWidth: "0px",
      },
    ]),
    { duration: CYCLE, iterations: Infinity }
  );

  game.animate(
    stops([
      { top: "0px", transform: "scale(1)" },
      { top: `${OUT_H * CAM_BAND + 0.3 * K}px`, transform: "scale(1.35)" },
    ]),
    { duration: CYCLE, iterations: Infinity }
  );
}
