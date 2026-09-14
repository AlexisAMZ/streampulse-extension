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
    overlayEl.className = "sp-pred";
    overlayEl.style.display = "none";

    overlayEl.innerHTML = `
      <div class="sp-pred-head" id="${WIDGET_ID}-header">
        <span class="sp-pred-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/></svg>
          Prédiction en cours
        </span>
        <button class="sp-pred-close" id="${WIDGET_ID}-close" type="button" aria-label="Fermer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="sp-pred-body" id="${WIDGET_ID}-body">
        <div class="sp-pred-title" id="${WIDGET_ID}-title">Chargement…</div>
        <div class="sp-pred-options" id="${WIDGET_ID}-options">
          <div class="sp-pred-opt sp-pred-opt-a" id="${WIDGET_ID}-opt1">--</div>
          <div class="sp-pred-opt sp-pred-opt-b" id="${WIDGET_ID}-opt2">--</div>
        </div>
        <button class="sp-pred-action" id="${WIDGET_ID}-action" type="button">Miser / Voter dans le Chat</button>
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
