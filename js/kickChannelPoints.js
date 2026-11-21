// Kick : points de chaîne, récompense quotidienne et Drops, récupérés en
// cliquant dans la page de l'utilisateur, jamais par l'API ni avec son jeton.
// Les règles de reconnaissance vivent dans js/inject/kick-claim-rules.js.
(() => {
  "use strict";

  if (window.top !== window) return;

  const PREFERENCES_KEY = "betaGeneralPreferences";
  const CHECK_INTERVAL = 3000;
  /** Délai entre deux tentatives de récompense quotidienne (fenêtre restée ouverte, échec). */
  const DAILY_RETRY_MS = 5 * 60 * 1000;
  /** Attente de l'ouverture de la fenêtre, puis de la fin de l'animation d'ouverture de la caisse. */
  const DIALOG_OPEN_MS = 1500;
  const DIALOG_CLOSE_MS = 9000;
  const RECLICK_GUARD_MS = 30_000;
  const NOT_A_CHANNEL = /^(browse|categories|category|drops|events|following|search|settings|dashboard|rewards)$/i;

  const RULES = globalThis.StreamPulseKickClaim;
  const PLUS_RULE = globalThis.StreamPulsePlusRule;
  /** Délais naturels avant chaque clic : js/inject/human-delay.js. */
  const HUMAN_DELAY = globalThis.StreamPulseHumanDelay;

  let pointsActive = true;
  let dropsActive = false;
  let plusOn = false;
  let lastPrefs = {};
  let intervalId = null;
  let pointsObserver = null;
  let observedButton = null;
  let lastDailyAttempt = 0;
  /** Libellés lus dans les traductions de la page, une fois trouvés. */
  let labels = null;

  function safeSend(msg) {
    try {
      chrome.runtime.sendMessage(msg).catch(() => {}); // SW endormi ou contexte invalidé : échec attendu.
    } catch (_) {
      // Service worker endormi, ou contexte d'extension invalide par une mise a jour : le message est perdu sans consequence ici.
    }
  }

  function currentChannel() {
    const segment = location.pathname.split("/")[1] || "";
    return /^[a-z0-9_-]{2,}$/i.test(segment) && !NOT_A_CHANNEL.test(segment) ? segment.toLowerCase() : "";
  }

  function getLabels() {
    if (labels) return labels;
    const source = Array.from(document.scripts, (script) => script.textContent || "").join("\n");
    const found = RULES.readLabels(source);
    // Sans traduction trouvée, les règles retombent sur leurs verbes de repli ;
    // on relira la page au prochain passage.
    if (found.dropNamed || found.dailyClaim) labels = found;
    return found;
  }

  function describe(button) {
    return {
      aria: button.getAttribute("aria-label") || "",
      text: (button.textContent || "").trim(),
      disabled: button.disabled || button.getAttribute("aria-disabled") === "true",
      visible: button.offsetParent !== null,
    };
  }

  function recentlyClicked(button) {
    if (button.__spClaimedAt && Date.now() - button.__spClaimedAt < RECLICK_GUARD_MS) return true;
    button.__spClaimedAt = Date.now();
    return false;
  }

  // ─── Points de chaîne ─────────────────────────────────────────────────────
  // Kick crédite les points tout seul ; il affiche « +N » une seconde à côté du
  // compteur. On compte ces gains, le compteur abrégé (« 14,4 k ») ne le permet pas.

  function onPointsMutation(mutations) {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        const earned = RULES.parseEarnedPoints(node.textContent);
        if (!earned) continue;
        safeSend({ type: "incrementStat", stat: "channelPointsClaimed", value: earned, channel: currentChannel() });
        return;
      }
    }
  }

  function watchPointsButton() {
    const button = pointsActive ? document.querySelector("[data-testid='channel-points-button']") : null;
    if (button === observedButton) return;
    pointsObserver?.disconnect();
    pointsObserver = null;
    observedButton = button;
    if (!button) return;
    pointsObserver = new MutationObserver(onPointsMutation);
    pointsObserver.observe(button, { childList: true, subtree: true });
  }

  // ─── Récompense quotidienne ───────────────────────────────────────────────
  // Prête après 60 min de visionnage : la barre du haut joue alors une
  // animation. On ouvre la fenêtre, on clique « Récupérer », puis on la referme.

  function closeDialog(dialog) {
    if (!dialog.isConnected) return;
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
  }

  function dismissUnboxing() {
    for (const dialog of document.querySelectorAll("[role='dialog']")) {
      const btn = Array.from(dialog.querySelectorAll("button")).find((b) => {
        const text = (b.textContent || "").trim().toLowerCase();
        return (text === "passer" || text === "quitter" || text === "skip" || text === "close") && !b.disabled;
      });
      if (btn) {
        btn.click();
        return true;
      }
    }
    return false;
  }

  function claimInOpenDialog() {
    const dialog = Array.from(document.querySelectorAll("[role='dialog']")).pop();
    if (!dialog) return;
    const current = getLabels();
    const button = Array.from(dialog.querySelectorAll("button")).find((b) => RULES.isDailyClaimButton(describe(b), current));
    if (button) button.click();
    setTimeout(() => {
      dismissUnboxing();
      closeDialog(dialog);
    }, button ? DIALOG_CLOSE_MS : 0);
  }

  function tryClaimDailyReward() {
    if (Date.now() - lastDailyAttempt < DAILY_RETRY_MS) return false;
    const media = Array.from(document.querySelectorAll(`[src*='${RULES.DAILY_READY_SRC}']`));
    if (!RULES.isDailyRewardReady(media.map((el) => el.getAttribute("src")))) return false;
    const trigger = media[0].closest("button");
    // Une fenêtre déjà ouverte appartient à l'utilisateur : on n'y touche pas.
    if (!trigger || trigger.getAttribute("aria-expanded") === "true") return false;
    lastDailyAttempt = Date.now();
    trigger.click();
    setTimeout(claimInOpenDialog, DIALOG_OPEN_MS);
    return true;
  }

  // ─── Drops ────────────────────────────────────────────────────────────────

  function tryClaimDrop() {
    const current = getLabels();
    for (const button of document.querySelectorAll("button[aria-label]")) {
      // Le libellé d'abord : le chat compte des centaines de boutons, et la
      // visibilité (offsetParent) force un calcul de mise en page.
      const aria = button.getAttribute("aria-label") || "";
      if (!RULES.isDropClaimButton({ aria }, current)) continue;
      const description = describe(button);
      if (!RULES.isDropClaimButton(description, current) || recentlyClicked(button)) continue;
      // Clic après un délai naturel ; recentlyClicked() garde le bouton en attente.
      const channel = currentChannel();
      setTimeout(() => {
        if (!button.isConnected || button.disabled) return;
        button.click();
        safeSend({ type: "incrementStat", stat: "dropsClaimed", value: 1, channel, text: description.aria });
      }, HUMAN_DELAY.pick("dropClick"));
      return true;
    }
    return false;
  }

  function tick() {
    watchPointsButton();
    if (dropsActive && tryClaimDrop()) return;
    if (pointsActive) tryClaimDailyReward();
  }

  function start() {
    if (intervalId) return;
    intervalId = setInterval(tick, CHECK_INTERVAL);
  }

  function stop() {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    pointsObserver?.disconnect();
    pointsObserver = null;
    observedButton = null;
  }

  // Récupération auto des Drops : réservée à StreamPulse+, comme sur Twitch.
  function applyPref(prefs = lastPrefs) {
    lastPrefs = prefs || {};
    pointsActive = lastPrefs.autoClaimChannelPoints !== false;
    dropsActive = plusOn && lastPrefs.autoClaimDrops !== false;
    pointsActive || dropsActive ? start() : stop();
  }

  chrome.storage.local.get([PREFERENCES_KEY, PLUS_RULE.PLUS_KEY], (result) => {
    if (chrome.runtime.lastError) { start(); return; }
    plusOn = PLUS_RULE.isPlusActive(result?.[PLUS_RULE.PLUS_KEY]);
    applyPref(result?.[PREFERENCES_KEY]);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[PLUS_RULE.PLUS_KEY]) plusOn = PLUS_RULE.isPlusActive(changes[PLUS_RULE.PLUS_KEY].newValue);
    if (changes[PREFERENCES_KEY]) applyPref(changes[PREFERENCES_KEY].newValue);
    else if (changes[PLUS_RULE.PLUS_KEY]) applyPref();
  });
})();
