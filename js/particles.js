/* ════════════════════════════════════════════════
   StreamPulse — Floating particles
   Subtle drifting violet motes for cinematic depth
   ════════════════════════════════════════════════ */
(() => {
  const canvas = document.getElementById("particles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });

  let w = 0, h = 0, dpr = 1;
  let particles = [];
  let raf = null;
  let mx = 0.5, my = 0.5;
  let lastT = 0;

  const COUNT = 38;
  const COLORS = [
    "rgba(145, 70, 255, ALPHA)",    // violet
    "rgba(182, 129, 255, ALPHA)",   // light violet
    "rgba(255, 255, 255, ALPHA)",   // white motes
  ];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth = window.innerWidth;
    h = canvas.clientHeight = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function spawn() {
    particles = [];
    for (let i = 0; i < COUNT; i++) {
      const r = rand(0.6, 2.2);
      const colorIdx = Math.random() < 0.7 ? 0 : Math.random() < 0.6 ? 1 : 2;
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: rand(-0.18, 0.18),
        vy: rand(-0.35, -0.10),
        r,
        baseAlpha: rand(0.10, 0.55),
        twinkle: rand(0, Math.PI * 2),
        twinkleSpeed: rand(0.4, 1.6),
        color: COLORS[colorIdx],
        glow: r > 1.6,
      });
    }
  }

  function tick(t) {
    const dt = lastT ? Math.min((t - lastT) / 1000, 0.05) : 0.016;
    lastT = t;

    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      /* Mouse parallax pull (very subtle) */
      const dx = (mx - 0.5) * 12;
      const dy = (my - 0.5) * 12;

      p.x += (p.vx + dx * 0.002) * 60 * dt;
      p.y += (p.vy + dy * 0.002) * 60 * dt;

      /* Wrap */
      if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;

      p.twinkle += p.twinkleSpeed * dt;
      const a = p.baseAlpha * (0.55 + 0.45 * Math.sin(p.twinkle));

      ctx.beginPath();
      if (p.glow) {
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
        grad.addColorStop(0, p.color.replace("ALPHA", String(a * 0.9)));
        grad.addColorStop(1, p.color.replace("ALPHA", "0"));
        ctx.fillStyle = grad;
        ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
      } else {
        ctx.fillStyle = p.color.replace("ALPHA", String(a));
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (raf) cancelAnimationFrame(raf);
    resize();
    spawn();
    lastT = 0;
    raf = requestAnimationFrame(tick);
  }

  window.addEventListener("resize", () => {
    resize();
    /* keep existing particles, just clamp to new bounds */
    for (const p of particles) {
      if (p.x > w) p.x = Math.random() * w;
      if (p.y > h) p.y = Math.random() * h;
    }
  });

  window.addEventListener("mousemove", (e) => {
    mx = e.clientX / window.innerWidth;
    my = e.clientY / window.innerHeight;
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    } else if (!raf) {
      lastT = 0;
      raf = requestAnimationFrame(tick);
    }
  });

  start();
})();
