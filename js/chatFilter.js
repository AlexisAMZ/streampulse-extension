(() => {
  const PREFERENCES_KEY = "betaGeneralPreferences";
  const FALLBACK_REPLACEMENT_EN = "Message removed by StreamPulse";
  const FALLBACK_REPLACEMENT_FR = "Message supprimé par StreamPulse";
  const REPLACEMENT_MESSAGE =
    (typeof chrome !== "undefined" &&
      chrome?.i18n?.getMessage?.("chatFilterReplacement")) ||
    (typeof navigator !== "undefined" &&
    typeof navigator.language === "string" &&
    navigator.language.toLowerCase().startsWith("fr")
      ? FALLBACK_REPLACEMENT_FR
      : FALLBACK_REPLACEMENT_EN);

  let blockedKeywords = [];
  let blockedUsers = [];
  let observer = null;
  let pollIntervalId = null;

  // Pre-joined selectors for fewer querySelectorAll calls
  const MESSAGE_SELECTOR = [
    ".chat-line__message",
    "[data-a-target='chat-line-message']",
    "[data-test-selector='chat-line-message']",
    ".seventv-user-message",
    ".chat-entry",
    ".chat-message-identity",
    "[data-testid='chat-message']",
    ".chat-message",
  ].join(",");

  const CONTENT_SELECTORS = [
    "[data-a-target='chat-line-message-body']",
    ".message-text",
    ".chat-line__message-body",
    ".chat-line__message-container",
    "span.text-fragment",
    ".seventv-chat-message-body",
    ".chat-entry-content",
    "span[data-test-selector='chat-entry-content']",
    "[data-testid='chat-message-content']",
  ];

  const USERNAME_SELECTORS = [
    ".chat-author__display-name",
    "[data-a-target='chat-message-username']",
    "[data-a-target='chat-message-author-name']",
    ".seventv-chat-user-username",
    ".seventv-chat-user-username span",
    ".chat-entry-username",
    ".chat-message-identity .font-bold",
    "[data-testid='chat-message-username']",
  ];

  function hasActiveFilters() {
    return blockedKeywords.length > 0 || blockedUsers.length > 0;
  }

  function loadSettings() {
    chrome.storage.local.get([PREFERENCES_KEY], (result) => {
      const prefs = result[PREFERENCES_KEY] || {};
      blockedKeywords = parseList(prefs.chatKeywords || "");
      blockedUsers = parseList(prefs.chatBlockedUsers || "");

      if (hasActiveFilters()) {
        runFilter();
        startObserver();
        startPolling();
      } else {
        stopObserver();
        stopPolling();
      }
    });
  }

  function parseList(input) {
    if (Array.isArray(input)) return input.map(normalizeName).filter(Boolean);
    if (typeof input === "string") {
      return input.split(/[\n,;]+/).map(normalizeName).filter(Boolean);
    }
    return [];
  }

  function normalizeName(s) {
    return String(s)
      .toLowerCase()
      .trim()
      .replace(/^@+/, "")
      .replace(/[^a-z0-9_.-]/g, "");
  }

  function extractUsername(messageNode) {
    for (const sel of USERNAME_SELECTORS) {
      const found = messageNode.querySelector(sel);
      if (found?.textContent) return normalizeName(found.textContent);
    }
    const attrUser =
      messageNode.getAttribute("data-a-user") ||
      messageNode.getAttribute("data-user") ||
      messageNode.dataset?.aUser ||
      messageNode.dataset?.user ||
      "";
    if (attrUser) return normalizeName(attrUser);

    const dirSpan = messageNode.querySelector("span[dir='auto']");
    if (dirSpan?.textContent?.trim().startsWith("@")) {
      return normalizeName(dirSpan.textContent);
    }
    return "";
  }

  function shouldFilter(text, username) {
    if (username && blockedUsers.includes(username)) return true;
    if (text) {
      const lower = text.toLowerCase();
      for (let i = 0; i < blockedKeywords.length; i++) {
        if (lower.includes(blockedKeywords[i])) return true;
      }
    }
    return false;
  }

  function processNode(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches?.(MESSAGE_SELECTOR)) {
      checkAndReplace(node);
      return;
    }
    const messages = node.querySelectorAll(MESSAGE_SELECTOR);
    for (let i = 0; i < messages.length; i++) {
      checkAndReplace(messages[i]);
    }
  }

  function findContentCandidate(messageNode) {
    for (const sel of CONTENT_SELECTORS) {
      const found = messageNode.querySelector(sel);
      if (found) return { contentNode: found, text: found.textContent };
    }
    const fragments = messageNode.querySelectorAll(
      "span.text-fragment, span[data-a-target='chat-message-text']"
    );
    if (fragments.length) {
      const text = Array.from(fragments).map((f) => f.textContent).join(" ").trim();
      const parent = fragments[0].closest(
        "[data-a-target='chat-line-message-body'], .chat-line__message-body, .chat-entry-content"
      );
      return { contentNode: parent || fragments[0].parentElement || fragments[0], text };
    }
    return { contentNode: null, text: "" };
  }

  function checkAndReplace(messageNode) {
    if (messageNode.dataset.spFiltered) return;
    const { contentNode, text } = findContentCandidate(messageNode);
    if (!contentNode) return;
    const username = extractUsername(messageNode);
    if (shouldFilter(text, username)) {
      applyReplacement(contentNode, messageNode);
      messageNode.dataset.spFiltered = "true";
    }
  }

  function applyReplacement(contentNode, messageNode) {
    const replacement = document.createElement("span");
    replacement.textContent = REPLACEMENT_MESSAGE;
    replacement.style.cssText =
      "color:rgba(255,255,255,0.6);font-style:italic;font-size:0.9em;display:inline;text-shadow:none";
    contentNode.textContent = "";
    contentNode.appendChild(replacement);
    contentNode.style.opacity = "1";
    contentNode.style.filter = "none";
    contentNode.style.visibility = "visible";
    if (messageNode !== contentNode) {
      messageNode.style.opacity = "1";
      messageNode.style.filter = "none";
      messageNode.style.visibility = "visible";
    }
  }

  function runFilter() {
    if (!hasActiveFilters()) return;
    const messages = document.querySelectorAll(MESSAGE_SELECTOR);
    for (let i = 0; i < messages.length; i++) {
      checkAndReplace(messages[i]);
    }
  }

  // Throttled MutationObserver — batch DOM mutations
  let pendingNodes = [];
  let rafId = null;

  function flushPending() {
    rafId = null;
    const nodes = pendingNodes;
    pendingNodes = [];
    for (let i = 0; i < nodes.length; i++) {
      processNode(nodes[i]);
    }
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        const added = mutations[i].addedNodes;
        for (let j = 0; j < added.length; j++) {
          pendingNodes.push(added[j]);
        }
      }
      if (pendingNodes.length > 0 && !rafId) {
        rafId = requestAnimationFrame(flushPending);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    pendingNodes = [];
  }

  function startPolling() {
    if (pollIntervalId) return;
    pollIntervalId = setInterval(runFilter, 3000);
  }

  function stopPolling() {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[PREFERENCES_KEY]) {
      loadSettings();
    }
  });

  // Init
  loadSettings();
})();
