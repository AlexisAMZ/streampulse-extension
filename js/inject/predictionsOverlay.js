(() => {
  "use strict";

  if (window.top !== window) return;

  const PREFERENCES_KEY = "betaGeneralPreferences";
  const WIDGET_ID = "streampulse-prediction-overlay";

  let isEnabled = true;
  let overlayEl = null;
  let checkIntervalId = null;
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  function createOverlay() {
    if (document.getElementById(WIDGET_ID)) return;

    overlayEl = document.createElement("div");
    overlayEl.id = WIDGET_ID;
    overlayEl.style.cssText = `
      position: absolute;
      top: 70px;
      right: 20px;
      z-index: 9999;
      width: 280px;
      background: rgba(15, 15, 23, 0.85);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(145, 71, 255, 0.3);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      color: #ffffff;
      font-family: Roobert, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      user-select: none;
      transition: border-color 0.2s ease, transform 0.1s ease;
      overflow: hidden;
      display: none;
    `;

    overlayEl.innerHTML = `
      <div id="${WIDGET_ID}-header" style="
        padding: 8px 12px;
        background: rgba(145, 71, 255, 0.2);
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: move;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      ">
        <span style="font-weight: 700; display: flex; align-items: center; gap: 6px; color: #a970ff;">
          🔮 Prédiction en cours
        </span>
        <button id="${WIDGET_ID}-close" style="
          background: transparent;
          border: none;
          color: #aaa;
          cursor: pointer;
          font-size: 14px;
          padding: 0 4px;
        ">✕</button>
      </div>
      <div id="${WIDGET_ID}-body" style="padding: 12px;">
        <div id="${WIDGET_ID}-title" style="font-weight: 600; margin-bottom: 8px; font-size: 12px; line-height: 1.3; color: #efeff1;">
          Chargement...
        </div>
        <div id="${WIDGET_ID}-options" style="display: flex; gap: 8px; margin-bottom: 10px;">
          <div id="${WIDGET_ID}-opt1" style="
            flex: 1;
            padding: 8px;
            background: rgba(59, 130, 246, 0.2);
            border: 1px solid rgba(59, 130, 246, 0.5);
            border-radius: 6px;
            text-align: center;
            font-weight: 700;
            color: #60a5fa;
            cursor: pointer;
          ">--</div>
          <div id="${WIDGET_ID}-opt2" style="
            flex: 1;
            padding: 8px;
            background: rgba(236, 72, 153, 0.2);
            border: 1px solid rgba(236, 72, 153, 0.5);
            border-radius: 6px;
            text-align: center;
            font-weight: 700;
            color: #f472b6;
            cursor: pointer;
          ">--</div>
        </div>
        <button id="${WIDGET_ID}-action" style="
          width: 100%;
          padding: 8px;
          background: #9147ff;
          border: none;
          border-radius: 6px;
          color: #fff;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s ease;
        ">Miser / Voter dans le Chat</button>
      </div>
    `;

    const playerContainer = document.querySelector('.video-player__container, [data-a-target="video-player"]');
    if (playerContainer) {
      playerContainer.appendChild(overlayEl);
    } else {
      document.body.appendChild(overlayEl);
    }

    // Draggable logic
    const headerEl = document.getElementById(`${WIDGET_ID}-header`);
    headerEl.addEventListener("mousedown", (e) => {
      isDragging = true;
      const rect = overlayEl.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging || !overlayEl) return;
      overlayEl.style.left = `${e.clientX - dragOffsetX}px`;
      overlayEl.style.top = `${e.clientY - dragOffsetY}px`;
      overlayEl.style.right = "auto";
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
    });

    document.getElementById(`${WIDGET_ID}-close`).addEventListener("click", () => {
      overlayEl.style.display = "none";
    });

    document.getElementById(`${WIDGET_ID}-action`).addEventListener("click", () => {
      const predWidget = document.querySelector('.community-prediction-highlight-header, [data-test-selector="prediction-widget"]');
      if (predWidget) {
        predWidget.scrollIntoView({ behavior: "smooth" });
        predWidget.click();
      }
    });
  }

  function checkPrediction() {
    if (!isEnabled) {
      if (overlayEl) overlayEl.style.display = "none";
      return;
    }

    const predWidget = document.querySelector(
      '.community-prediction-highlight-header, [data-test-selector="prediction-widget"], .community-prediction-summary-header'
    );

    if (!predWidget) {
      if (overlayEl) overlayEl.style.display = "none";
      return;
    }

    createOverlay();
    if (!overlayEl) return;

    const titleEl = document.getElementById(`${WIDGET_ID}-title`);
    const opt1El = document.getElementById(`${WIDGET_ID}-opt1`);
    const opt2El = document.getElementById(`${WIDGET_ID}-opt2`);

    const titleText = predWidget.textContent || "Prédiction Twitch";
    if (titleEl) titleEl.textContent = titleText.slice(0, 80);

    const outcomes = document.querySelectorAll('.community-prediction-highlight-outcome, [data-test-selector="prediction-outcome"]');
    if (outcomes.length >= 2) {
      if (opt1El) opt1El.textContent = outcomes[0].textContent?.slice(0, 20) || "Option 1";
      if (opt2El) opt2El.textContent = outcomes[1].textContent?.slice(0, 20) || "Option 2";
    }

    overlayEl.style.display = "block";
  }

  function init() {
    chrome.storage.local.get([PREFERENCES_KEY], (res) => {
      isEnabled = res?.[PREFERENCES_KEY]?.enablePredictionsPopup !== false;
      if (isEnabled && !checkIntervalId) {
        checkIntervalId = setInterval(checkPrediction, 3000);
      }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[PREFERENCES_KEY]) {
        isEnabled = changes[PREFERENCES_KEY].newValue?.enablePredictionsPopup !== false;
      }
    });
  }

  init();
})();
