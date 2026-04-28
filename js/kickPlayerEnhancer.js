(() => {
  // Kick Player Enhancer
  // Features: Fast Forward to Live, Latency Monitor (Simplified)

  // Top-frame guard: avoid duplicating intervals in sub-frames (perf).
  if (window.top !== window) return;

  const PREFERENCES_KEY = "betaGeneralPreferences";
  const FAST_FORWARD_ID = "streampulse-kick-fast-forward";
  
  let fastForwardEnabled = true;
  let intervalId = null;

  function loadSettings() {
    chrome.storage.local.get([PREFERENCES_KEY], (result) => {
      const prefs = result[PREFERENCES_KEY] || {};
      fastForwardEnabled = prefs.enableFastForwardButton !== false; // Default true
      if (fastForwardEnabled) {
        startLoop();
      } else {
        stopLoop();
        removeButton();
      }
    });
  }

  function findVideo() {
    return document.querySelector("video");
  }

  function findControls() {
    // Kick uses various classes based on player version.
    // Common: .vjs-control-bar, or generic container checking.
    // We try to find the row of controls at the bottom.
    const vjs = document.querySelector(".vjs-control-bar");
    if (vjs) return vjs;

    // Fallback: look for play button parent
    const playBtn = document.querySelector("button[title='Play'], button[title='Pause']");
    if (playBtn && playBtn.parentElement) {
      // Traverse up to find the bar
      return playBtn.parentElement.parentElement || playBtn.parentElement;
    }
    
    return null;
  }

  function isBehind(video) {
    if (!video || !video.buffered.length) return false;
    const end = video.buffered.end(video.buffered.length - 1);
    const current = video.currentTime;
    // If we are more than 3 seconds behind the buffer end, we assume we can skip
    return (end - current) > 2.5; 
  }

  function createButton() {
    if (document.getElementById(FAST_FORWARD_ID)) return document.getElementById(FAST_FORWARD_ID);

    const btn = document.createElement("button");
    btn.id = FAST_FORWARD_ID;
    btn.className = "streampulse-kick-btn";
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/>
      </svg>
    `;
    btn.style.cssText = `
      background: transparent;
      border: none;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 5px;
      margin-left: 5px;
      opacity: 0.8;
      transition: opacity 0.2s;
    `;
    btn.title = "Jump to Live (StreamPulse)";
    
    btn.onmouseenter = () => btn.style.opacity = "1";
    btn.onmouseleave = () => btn.style.opacity = "0.8";

    btn.onclick = () => {
      const video = findVideo();
      if (video && video.buffered.length) {
        const end = video.buffered.end(video.buffered.length - 1);
        video.currentTime = end - 0.5; // Jump to end minus safety buffer
        video.play().catch(()=>{});
      }
    };

    return btn;
  }

  function ensureButton() {
    if (!fastForwardEnabled) return;
    const controls = findControls();
    if (!controls) return;

    // Check if already inserted
    if (document.getElementById(FAST_FORWARD_ID)) {
      // Check if still in DOM
      if (!controls.contains(document.getElementById(FAST_FORWARD_ID))) {
        // Re-append if moved/removed
        controls.appendChild(createButton());
      }
      return;
    }

    // Append to controls
    // Kick controls usually have left/right sections. We assume appending works ok.
    controls.appendChild(createButton());
  }

  function startLoop() {
    if (intervalId) return;
    intervalId = setInterval(ensureButton, 2000);
    ensureButton();
  }

  function stopLoop() {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
  }

  function removeButton() {
    const btn = document.getElementById(FAST_FORWARD_ID);
    if (btn) btn.remove();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[PREFERENCES_KEY]) {
      loadSettings();
    }
  });

  loadSettings();

})();
