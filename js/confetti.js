// Célébration de l'essai StreamPulse+ : le pager « reçoit » son message.
// Un écran LCD s'ouvre au centre du popup, tape « > STREAMPULSE+ ACTIVÉ »,
// affiche « 7 J », puis ses pixels carrés éclatent depuis le centre et
// retombent. Environ 2 s, fermé au clic ou tout seul. Avec
// prefers-reduced-motion : l'écran s'affiche sans animation ni pixels.

const PIXEL_COLORS = ["#c6d4a0", "#c6d4a0", "#dfe8bf", "#9fb07a", "#c6d4a0", "#9146ff", "#ffffff"];
const PIXELS = 190;
const TYPE_STEP_MS = 34;
const BURST_AT_MS = 520;
const CLOSE_AT_MS = 2300;
const GRAVITY = 0.22;
const DRAG = 0.982;
/** Grille des pixels : tout se cale sur 2 px, comme un écran LCD. */
const GRID = 2;

const reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
const snap = (value) => Math.round(value / GRID) * GRID;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** Pixels carrés lancés dans toutes les directions depuis (x, y). */
function pixelBurst(layer, x, y) {
  const width = layer.clientWidth;
  const height = layer.clientHeight;
  const canvas = el("canvas", "trial-celebration-pixels");
  const ratio = globalThis.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  layer.append(canvas);
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  ctx.imageSmoothingEnabled = false;

  const pixels = Array.from({ length: PIXELS }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 10;
    return {
      x: x + Math.cos(angle) * 30,
      y: y + Math.sin(angle) * 18,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      size: GRID * (3 + Math.floor(Math.random() * 4)),
      color: PIXEL_COLORS[Math.floor(Math.random() * PIXEL_COLORS.length)],
      // Clignotement de pager : chaque pixel s'éteint par moments.
      blink: Math.random() < 0.35,
    };
  });

  const start = performance.now();
  const life = CLOSE_AT_MS - BURST_AT_MS;
  function frame(now) {
    if (!canvas.isConnected) return;
    const t = now - start;
    const fade = Math.min(1, Math.max(0, (life - t) / 500));
    ctx.clearRect(0, 0, width, height);
    for (const p of pixels) {
      p.vx *= DRAG;
      p.vy = p.vy * DRAG + GRAVITY;
      p.x += p.vx;
      p.y += p.vy;
      if (p.blink && Math.floor(t / 90) % 3 === 0) continue;
      ctx.globalAlpha = fade;
      ctx.fillStyle = p.color;
      ctx.fillRect(snap(p.x), snap(p.y), p.size, p.size);
    }
    if (t < life) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/** Tape le texte lettre à lettre dans le nœud, curseur au bout. */
function typeInto(node, text, still) {
  if (still) {
    node.textContent = text;
    return;
  }
  let shown = 0;
  const timer = setInterval(() => {
    shown += 1;
    node.textContent = text.slice(0, shown);
    if (shown >= text.length) clearInterval(timer);
  }, TYPE_STEP_MS);
}

/**
 * @param {{ line: string, big: string, caption: string }} copy textes déjà traduits
 * @returns {Promise<void>} résolue à la fermeture
 */
export function celebrateTrial({ line, big, caption }) {
  if (typeof document === "undefined") return Promise.resolve();
  const still = reducedMotion();
  const layer = el("div", `trial-celebration${still ? " is-still" : ""}`);
  layer.setAttribute("role", "status");
  layer.setAttribute("aria-live", "polite");
  const screen = el("div", "trial-celebration-screen");
  const typed = el("p", "trial-celebration-line");
  const cursor = el("span", "trial-celebration-cursor", "_");
  cursor.setAttribute("aria-hidden", "true");
  const lineRow = el("div", "trial-celebration-row");
  lineRow.append(typed, cursor);
  screen.append(lineRow, el("p", "trial-celebration-big", big), el("p", "trial-celebration-caption", caption));
  layer.append(screen);
  document.body.append(layer);
  typeInto(typed, line, still);

  return new Promise((resolve) => {
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      layer.classList.add("is-leaving");
      setTimeout(() => {
        layer.remove();
        resolve();
      }, still ? 0 : 280);
    };
    layer.addEventListener("click", close);
    if (!still) {
      setTimeout(() => {
        const box = screen.getBoundingClientRect();
        pixelBurst(layer, box.left + box.width / 2, box.top + box.height / 2);
        layer.classList.add("is-burst");
      }, BURST_AT_MS);
    }
    setTimeout(close, still ? 1800 : CLOSE_AT_MS);
  });
}
