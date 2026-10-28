// Confettis de l'activation de l'essai StreamPulse+ : une seule salve qui part
// du bouton cliqué, aux couleurs du popup (vert LCD, violet, papier), puis
// retombe et s'efface. Canvas temporaire, retiré à la fin. Sans animation
// demandée par le système (prefers-reduced-motion) : rien ne s'affiche.

const COLORS = ["#c6d4a0", "#9146ff", "#ffffff", "#c4a3ff", "#1c2615"];
const PIECES = 90;
const DURATION_MS = 1600;
const GRAVITY = 0.32;
const DRAG = 0.985;

const reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** Une pièce : rectangle ou ruban, lancée en éventail vers le haut. */
function piece(x, y, scale) {
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
  const speed = (7 + Math.random() * 8) * scale;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    w: 4 + Math.random() * 5,
    h: 6 + Math.random() * 8,
    spin: Math.random() * Math.PI,
    spinSpeed: (Math.random() - 0.5) * 0.4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

/**
 * Lance la salve depuis le centre d'un élément (ou du popup).
 * @param {Element} [origin]
 * @returns {Promise<void>} résolue quand le canvas est retiré
 */
export function burstConfetti(origin) {
  if (reducedMotion() || typeof document === "undefined") return Promise.resolve();
  const width = document.documentElement.clientWidth;
  const height = document.documentElement.clientHeight;
  const rect = origin?.getBoundingClientRect?.();
  const x = rect ? rect.left + rect.width / 2 : width / 2;
  const y = rect ? rect.top + rect.height / 2 : height / 3;

  const canvas = document.createElement("canvas");
  const ratio = globalThis.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: `${width}px`, height: `${height}px`, pointerEvents: "none", zIndex: "60" });
  document.body.append(canvas);
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);

  const pieces = Array.from({ length: PIECES }, () => piece(x, y, Math.min(1.2, height / 600)));
  const start = performance.now();

  return new Promise((resolve) => {
    function frame(now) {
      const elapsed = now - start;
      // Fondu sur le dernier tiers, courbe douce.
      const fade = Math.min(1, Math.max(0, (DURATION_MS - elapsed) / (DURATION_MS / 3)));
      ctx.clearRect(0, 0, width, height);
      for (const p of pieces) {
        p.vx *= DRAG;
        p.vy = p.vy * DRAG + GRAVITY;
        p.x += p.vx;
        p.y += p.vy;
        p.spin += p.spinSpeed;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        // Le ruban tourne sur lui-même : sa largeur apparente suit le cosinus.
        ctx.scale(Math.cos(p.spin * 2), 1);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (elapsed < DURATION_MS) {
        requestAnimationFrame(frame);
      } else {
        canvas.remove();
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}
