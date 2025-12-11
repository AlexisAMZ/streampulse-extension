(() => {
  const PREFERENCES_KEY = "betaGeneralPreferences";
  const FILTER_STORAGE_KEY = "chatFilterKeywords"; // Separate key or part of preferences?
  // User asked for "feature 6", I'll put it in preferences key to keep it unified if possible,
  // but separate key might be cleaner. Let's stick to adding it to preferences for now as 'chatKeywords'.

  let blockedKeywords = [];
  let observer = null;
  let filterEnabled = true;

  // Selectors for Twitch and Kick
  const SELECTORS = {
    message: [
      ".chat-line__message", // Twitch
      ".chat-entry", // Kick
      ".chat-message-identity" // Kick alternative
    ],
    content: [
      ".message-text", // Twitch (fragment)
      ".chat-line__message-body", // Twitch (body)
      ".chat-entry-content" // Kick
    ]
  };

  function loadSettings() {
    chrome.storage.local.get([PREFERENCES_KEY], (result) => {
      const prefs = result[PREFERENCES_KEY] || {};
      // Expecting comma separated string or array. I'll support both.
      const raw = prefs.chatKeywords || "";
      if (Array.isArray(raw)) {
        blockedKeywords = raw.map(k => k.toLowerCase().trim()).filter(Boolean);
      } else if (typeof raw === "string") {
        blockedKeywords = raw.split(",").map(k => k.toLowerCase().trim()).filter(Boolean);
      }
      
      filterEnabled = blockedKeywords.length > 0;
      if (filterEnabled) {
        runFilter();
      }
    });
  }

  function shouldFilter(text) {
    if (!text || !filterEnabled) return false;
    const lower = text.toLowerCase();
    return blockedKeywords.some(keyword => lower.includes(keyword));
  }

  function processNode(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    // Check if node itself is a message or contains messages
    const isMessage = SELECTORS.message.some(sel => node.matches(sel));
    if (isMessage) {
      checkAndBlur(node);
      return;
    }

    // Checking children
    SELECTORS.message.forEach(sel => {
      const messages = node.querySelectorAll(sel);
      messages.forEach(checkAndBlur);
    });
  }

  function checkAndBlur(messageNode) {
    if (messageNode.dataset.spFiltered) return;

    // Extract text content
    let text = "";
    // Try structured selectors first
    let foundContent = false;
    for (const sel of SELECTORS.content) {
      const contentNodes = messageNode.querySelectorAll(sel);
      if (contentNodes.length > 0) {
        contentNodes.forEach(n => text += " " + n.textContent);
        foundContent = true;
      }
    }
    
    // Fallback
    if (!foundContent) {
      text = messageNode.textContent;
    }

    if (shouldFilter(text)) {
      applyFilter(messageNode);
    }
    
    // Mark as processed
    messageNode.dataset.spFiltered = "true";
  }

  function applyFilter(node) {
    // Style the node to be blurred/hidden
    // We can add a class or inline style
    // Let's use inline style for simplicity and strictness
    node.style.filter = "blur(4px)";
    node.style.opacity = "0.6";
    node.style.pointerEvents = "none"; // Prevent clicking links in spoilers
    node.title = "Message masqué par StreamPulse (Spoiler/Mot-clé)";
    
    // Optional: Add a way to reveal on hover?
    node.addEventListener("mouseenter", () => {
        node.style.filter = "blur(2px)";
        node.style.opacity = "0.8";
    });
    node.addEventListener("mouseleave", () => {
        node.style.filter = "blur(4px)";
        node.style.opacity = "0.6";
    });
  }

  function runFilter() {
    // Initial pass
    const body = document.body;
    processNode(body);
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      if (!filterEnabled) return;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          mutation.addedNodes.forEach(processNode);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[PREFERENCES_KEY]) {
      loadSettings();
    }
  });

  loadSettings();
  startObserver();

})();
