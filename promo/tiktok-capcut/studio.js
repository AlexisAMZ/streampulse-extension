/**
 * Studio Vidéo TikTok & CapCut pour StreamPulse
 * Pilotage du moteur Canvas 2D 60 FPS, synchronisation audio et enregistrement MP4 fluide.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const ToastRenderer = window.ToastRenderer;
  const liveCanvas = document.getElementById("live-canvas");
  const posBtns = document.querySelectorAll("[data-pos]");
  const inputStreamer = document.getElementById("input-streamer");
  const inputUrl = document.getElementById("input-url");
  const toggleSafeArea = document.getElementById("toggle-safe-area");
  const toggleSound = document.getElementById("toggle-sound");
  const safeAreaOverlay = document.getElementById("safe-area-overlay");
  const notifSound = document.getElementById("notif-sound");

  const btnReplay = document.getElementById("btn-replay");
  const btnRecordVideo = document.getElementById("btn-record-video");
  const recordBtnText = document.getElementById("record-btn-text");

  let currentPos = "pos-bottom";
  let isRecording = false;

  // Charger les images
  async function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  await document.fonts.ready;
  const avatarImg = await loadImage("assets/anyme_avatar.png");
  const logoImg = await loadImage("assets/logo.png");
  const twitchImg = await loadImage("assets/twitch.svg");
  const kickImg = await loadImage("assets/kick.svg");

  const renderer = new ToastRenderer(liveCanvas, {
    streamer: inputStreamer.value.trim() || "anyme023",
    url: inputUrl.value.trim() || "streampulse.fr",
    position: currentPos,
    avatarImg,
    logoImg,
    twitchImg,
    kickImg,
  });

  // Boucle de rendu temps réel 60 FPS
  let startTime = performance.now();

  function animateLoop(now) {
    const elapsedSeconds = ((now - startTime) / 1000) % 12.5;
    renderer.draw(elapsedSeconds);
    requestAnimationFrame(animateLoop);
  }

  requestAnimationFrame(animateLoop);

  // 1. Changement de position (Haut / Bas)
  posBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      posBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentPos = btn.dataset.pos;
      renderer.updateConfig({ position: currentPos });
    });
  });

  // 2. Réactivité instantanée des inputs
  inputStreamer.addEventListener("input", (e) => {
    const val = e.target.value.trim() || "anyme023";
    renderer.updateConfig({ streamer: val });
  });

  inputUrl.addEventListener("input", (e) => {
    const val = e.target.value.trim() || "streampulse.fr";
    renderer.updateConfig({ url: val });
  });

  // 3. Safe Area TikTok
  toggleSafeArea.addEventListener("change", (e) => {
    if (e.target.checked) {
      safeAreaOverlay.classList.add("active");
    } else {
      safeAreaOverlay.classList.remove("active");
    }
  });

  // 4. Rejouer l'animation depuis t=0 avec son
  function replayCycle() {
    startTime = performance.now();
    if (toggleSound.checked) {
      try {
        notifSound.currentTime = 0;
        notifSound.play().catch(() => {});
      } catch (err) {
        void err;
      }
    }
  }

  btnReplay.addEventListener("click", replayCycle);

  // 5. Enregistrement direct 60 FPS depuis le Canvas (sans freeze)
  btnRecordVideo.addEventListener("click", () => {
    if (isRecording) return;
    isRecording = true;
    recordBtnText.textContent = "Enregistrement MP4 (12.5s)...";
    btnRecordVideo.style.opacity = "0.7";

    replayCycle();

    const stream = liveCanvas.captureStream(60);

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();
      const source = audioCtx.createMediaElementSource(notifSound);
      source.connect(dest);
      source.connect(audioCtx.destination);
      stream.addTrack(dest.stream.getAudioTracks()[0]);
    } catch (err) {
      void err;
    }

    const mimeType = MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")
      ? "video/mp4;codecs=avc1"
      : MediaRecorder.isTypeSupported("video/mp4")
      ? "video/mp4"
      : "video/webm";

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 16000000,
    });

    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType.startsWith("video/mp4") ? "video/mp4" : mimeType });
      const videoUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = videoUrl;
      a.download = `streampulse_overlay_greenscreen_${inputStreamer.value.trim() || "anyme"}_12s.mp4`;
      a.click();

      isRecording = false;
      recordBtnText.textContent = "Enregistrer nouveau MP4 direct";
      btnRecordVideo.style.opacity = "1";
    };

    recorder.start();

    // Arrêt après 12.5 secondes exactes
    setTimeout(() => {
      if (recorder.state === "recording") {
        recorder.stop();
      }
    }, 12500);
  });

  // Démarrage initial avec son
  setTimeout(replayCycle, 300);
});
