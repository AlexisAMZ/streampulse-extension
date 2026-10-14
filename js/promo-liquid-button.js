/**
 * Bouton « métal liquide » du bandeau StreamPulse+, adapté du composant
 * LiquidMetalButton (shadcn / @paper-design/shaders, Apache-2.0) en module
 * natif : la popup n'a ni React ni build (décision PRODUCT.md), donc le port
 * garde exactement les couches 3D, les vitesses de shader et les ripples de
 * l'original, sans JSX.
 *
 * Le vrai rendu vient de @paper-design/shaders (js/vendor/paper-shaders/).
 * Repli statique (dégradé métal) si prefers-reduced-motion ou WebGL absent :
 * la règle reduced-motion de DESIGN.md vaut pour ce composant aussi.
 */

import { liquidMetalFragmentShader } from "./vendor/paper-shaders/shaders/liquid-metal.js";
import { ShaderMount } from "./vendor/paper-shaders/shader-mount.js";

const STYLE_ID = "promo-liquid-button-style";

const LAYER_TRANSITION = "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)";

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .promo-metal canvas {
      width: 100% !important;
      height: 100% !important;
      display: block !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      border-radius: 100px !important;
    }
    .promo-metal.is-static .promo-metal-shader {
      background:
        radial-gradient(120% 160% at 20% 0%, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0) 45%),
        linear-gradient(180deg, #3a3a3c 0%, #161616 55%, #000 100%);
    }
    @keyframes promo-metal-ripple {
      0% { transform: translate(-50%, -50%) scale(0); opacity: 0.6; }
      100% { transform: translate(-50%, -50%) scale(4); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

function el(tag, styles) {
  const node = document.createElement(tag);
  Object.assign(node.style, styles);
  return node;
}

/**
 * Monte le bouton métal dans `container`. Retourne { destroy } : la popup est
 * courte vie, mais le shader doit être détruit si la carte disparaît.
 */
export function mountLiquidMetalButton(container, { label, onClick } = {}) {
  if (!container) return { destroy() {} };
  injectStyles();

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ring = el("div", {
    position: "absolute", top: "0", left: "0", width: "100%", height: "100%",
    transformStyle: "preserve-3d", transition: LAYER_TRANSITION, zIndex: "10",
  });
  const metal = el("div", {
    width: "100%", height: "100%", borderRadius: "100px", overflow: "hidden",
    position: "relative",
  });
  metal.className = "promo-metal";
  const shader = el("div", {
    borderRadius: "100px", position: "relative", width: "100%", height: "100%",
  });
  shader.className = "promo-metal-shader";
  metal.append(shader);
  ring.append(metal);

  const inner = el("div", {
    position: "absolute", top: "0", left: "0", width: "100%", height: "100%",
    transformStyle: "preserve-3d", transition: LAYER_TRANSITION, zIndex: "20",
  });
  const innerPill = el("div", {
    height: "calc(100% - 4px)", margin: "2px", borderRadius: "100px",
    background: "linear-gradient(180deg, #202020 0%, #000000 100%)",
    transition: `${LAYER_TRANSITION}, box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1)`,
  });
  inner.append(innerPill);

  const labelLayer = el("div", {
    position: "absolute", top: "0", left: "0", width: "100%", height: "100%",
    display: "flex", alignItems: "center", justifyContent: "center",
    transformStyle: "preserve-3d", transition: LAYER_TRANSITION,
    transform: "translateZ(20px)", zIndex: "30", pointerEvents: "none",
  });
  const labelSpan = el("span", {
    fontSize: "14px", color: "#ffffff", fontWeight: "600",
    textShadow: "0px 1px 2px rgba(0, 0, 0, 0.6)",
    transition: LAYER_TRANSITION, whiteSpace: "nowrap", padding: "0 4px",
  });
  labelSpan.textContent = label;
  // Reprise par applyTranslations si la langue change pendant la session.
  labelSpan.setAttribute("data-i18n", "changelog.plusCta");
  labelLayer.append(labelSpan);

  const hit = el("button", {
    position: "absolute", top: "0", left: "0", width: "100%", height: "100%",
    background: "transparent", border: "none", cursor: "pointer",
    outline: "none", zIndex: "40", transformStyle: "preserve-3d",
    transform: "translateZ(25px)", overflow: "hidden", borderRadius: "100px",
    transition: LAYER_TRANSITION,
  });
  hit.setAttribute("aria-label", label);
  hit.type = "button";

  const stage = el("div", {
    position: "relative", width: "100%", height: "100%",
    transformStyle: "preserve-3d", transition: `${LAYER_TRANSITION}, width 0.4s ease, height 0.4s ease`,
  });
  stage.append(ring, inner, labelLayer, hit);

  const perspective = el("div", { perspective: "1000px", perspectiveOrigin: "50% 50%", width: "100%" });
  perspective.append(stage);
  container.append(perspective);

  // Largeur pilotée par le libellé (11 langues) : le canvas du shader suit.
  const sizeToLabel = () => {
    const width = Math.max(150, labelSpan.offsetWidth + 56);
    stage.style.width = `${width}px`;
    stage.style.height = "46px";
  };
  const observer = new ResizeObserver(sizeToLabel);
  observer.observe(labelSpan);
  sizeToLabel();

  // Mesure finale AVANT de construire le ShaderMount : il fige la taille de
  // son canvas à la construction — mesuré pendant que la mise en page se
  // stabilise, le métal sort étiré (c'était l'« effet bizarre »).
  const metalW = Math.round(metal.clientWidth);
  const metalH = Math.round(metal.clientHeight);
  shader.style.width = `${metalW}px`;
  shader.style.height = `${metalH}px`;

  let shaderMount = null;
  let webgl = false;
  if (!reducedMotion) {
    try {
      shaderMount = new ShaderMount(shader, liquidMetalFragmentShader, {
        u_repetition: 4,
        u_softness: 0.5,
        u_shiftRed: 0.3,
        u_shiftBlue: 0.3,
        u_distortion: 0,
        u_contour: 0,
        u_angle: 45,
        u_scale: 8,
        u_shape: 1,
        u_offsetX: 0.1,
        u_offsetY: -0.1,
      }, undefined, 0.6);
      webgl = true;
    } catch (error) {
      console.warn("[popup] métal liquide indisponible, repli statique :", error?.message || error);
    }
  }
  if (!webgl) metal.classList.add("is-static");

  const setSpeed = (speed) => {
    if (webgl) shaderMount?.setSpeed?.(speed);
  };

  let isHovered = false;
  hit.addEventListener("mouseenter", () => {
    isHovered = true;
    setSpeed(1);
  });
  hit.addEventListener("mouseleave", () => {
    isHovered = false;
    setSpeed(0.6);
  });
  hit.addEventListener("click", (event) => {
    setSpeed(2.4);
    setTimeout(() => setSpeed(isHovered ? 1 : 0.6), 300);
    if (!reducedMotion) {
      const rect = hit.getBoundingClientRect();
      const ripple = document.createElement("span");
      ripple.style.cssText = `position:absolute;left:${event.clientX - rect.left}px;top:${event.clientY - rect.top}px;width:20px;height:20px;border-radius:50%;pointer-events:none;background:radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 70%);animation:promo-metal-ripple 0.6s ease-out;`;
      hit.append(ripple);
      setTimeout(() => ripple.remove(), 600);
    }
    onClick?.();
  });

  return {
    destroy() {
      observer.disconnect();
      shaderMount?.destroy?.();
      perspective.remove();
    },
  };
}
