(() => {
  "use strict";

  if (window.top !== window) return;

  const CLAIM_CHECK_INTERVAL = 2500;
  /** Délais naturels avant chaque clic : js/inject/human-delay.js. */
  const HUMAN_DELAY = globalThis.StreamPulseHumanDelay;
  const PREFERENCES_KEY = "betaGeneralPreferences";

  let intervalId = null;
  let isPointsActive = true;
  let isDropsActive = true;
  let lastClaimTime = 0;
  /** Module js/points-bonus.js, chargé plus bas par import() dynamique. */
  let bonusRules = null;

  /**
   * Best-effort current channel login, used to label event logs.
   * Prefers the DOM (accurate on embeds and after SPA navigation) and falls back
   * to the URL. Returns "" when we are not on a channel page.
   */
  function getCurrentChannel() {
    try {
      const link = document.querySelector(
        'a[data-a-target="stream-title-link"], [data-a-target="channel-header-name"] a, a[data-a-target="user-channel-header-item"]'
      );
      const fromLink = link?.getAttribute("href")?.replace(/^\//, "").split("/")[0];
      if (fromLink) return fromLink.toLowerCase();

      const nameEl = document.querySelector(
        'h1[data-a-target="channel-header-name"], [data-a-target="channel-header-name"]'
      );
      const fromName = nameEl?.textContent?.trim();
      if (fromName) return fromName.toLowerCase();

      const segment = location.pathname.replace(/^\//, "").split("/")[0] || "";
      // Routes système et format de login : liste unique de js/inject/dom.js.
      const candidate = segment.toLowerCase();
      return window.__SP_DOM__.isChannelLogin(candidate) ? candidate : "";
    } catch (_) {
      return "";
    }
  }

  function describeButton(btn, summary) {
    return {
      label: btn.getAttribute("aria-label") || "",
      className: typeof btn.className === "string" ? btn.className : "",
      dataTarget: btn.getAttribute("data-a-target") || "",
      disabled: btn.hasAttribute("disabled"),
      hasBonusIcon: Boolean(btn.querySelector(".claimable-bonus__icon")),
      hasChestPath: Boolean(btn.querySelector(`path[d="${bonusRules.CHEST_PATH}"]`)),
      inPointsSummary: summary.contains(btn),
    };
  }

  function tryClaimChannelPoints() {
    // Règles chargées de façon asynchrone : rien à faire tant qu'elles manquent.
    if (!bonusRules) return false;

    // La caisse n'est cherchée que dans la zone des points : chercher « Bonus »
    // sur toute la page attrapait le bouton cadeau du SUBtember (voir
    // js/points-bonus.js). Le compteur de cette zone ouvre le popover de points,
    // isBonusChest l'écarte aussi.
    const summary = document.querySelector(
      "[data-test-selector='community-points-summary'], .community-points-summary"
    );
    if (!summary) return false;

    const buttons = Array.from(summary.querySelectorAll("button"));
    const index = bonusRules.pickBonusChest(buttons.map((b) => describeButton(b, summary)));
    if (index < 0) return false;
    const btn = buttons[index];

    // Garde anti-reclic : si ce bouton vient déjà d'être cliqué et reste
    // visible (claim en cours, ou faux positif), ne pas re-cliquer — un
    // même bouton cliqué à chaque poll tournerait en boucle visible.
    if (btn.__spClaimedAt && Date.now() - btn.__spClaimedAt < 30_000) return false;
    btn.__spClaimedAt = Date.now();

    // Channel points bonus chest found: claim it
    lastClaimTime = Date.now();
    btn.click();

    let points = 50;
    const match = (summary.textContent || "").match(/\+\s*(\d+)/);
    if (match) {
      const val = parseInt(match[1], 10);
      if (val > 0 && val <= 10000) points = val;
    }
    setTimeout(() => {
      try {
        chrome.runtime.sendMessage({
          type: "incrementStat",
          stat: "channelPointsClaimed",
          value: points,
          channel: getCurrentChannel(),
        }).catch(() => {}); // SW endormi ou contexte invalidé : échec attendu.
      } catch (_) {
        // Service worker endormi, ou contexte d'extension invalide par une mise a jour : le message est perdu sans consequence ici.
      }
    }, 300);

    return true;
  }

  function notifyDropClaimed() {
    // Resolve the channel now: the DOM can change during the 300ms debounce.
    const channel = getCurrentChannel();
    setTimeout(() => {
      try {
        // Le service worker relit l'inventaire pour compter ce Drop avec son nom.
        chrome.runtime.sendMessage({ type: "dropClaimedByClick", channel }).catch(() => {}); // SW endormi ou contexte invalidé : échec attendu.
      } catch (_) {
        // Service worker endormi, ou contexte d'extension invalide par une mise a jour : le message est perdu sans consequence ici.
      }
    }, 300);
  }

  /**
   * Un bouton n'est cliqué que s'il porte un verbe de réclamation.
   *
   * Les anciens sélecteurs `aria-label*="Drop"` et `aria-label*="drop"` étaient
   * bien trop larges : le second attrapait « dropdown », donc n'importe quel
   * menu déroulant, et le premier le bouton « Drops activés » des pages de
   * catégorie. Le clic basculait le filtre, Twitch redessinait, et on recliquait
   * toutes les 4 secondes en notifiant un Drop réclamé à chaque tour.
   */
  const CLAIM_VERB = /\b(claim|réclamer|reclamer|obtenir|resgatar|reclamar)\b/i;
  const NOT_A_CLAIM = /dropdown|menu|filtr|filter|activ(é|e)s?|enabled|param|settings|tri|sort/i;

  function isClaimButton(btn) {
    if (!(btn instanceof HTMLElement)) return false;
    if (btn.offsetParent === null || btn.hasAttribute("disabled")) return false;
    const label = `${btn.getAttribute("aria-label") || ""} ${btn.textContent || ""}`.trim();
    if (!label || NOT_A_CLAIM.test(label)) return false;
    return CLAIM_VERB.test(label);
  }

  /**
   * Programme le clic d'un bouton de Drop après un délai naturel. Faux si ce
   * bouton est déjà en attente ou vient d'être cliqué : le même bouton ne part
   * pas deux fois.
   */
  function scheduleDropClaim(btn) {
    if (btn.__spClaimedAt && Date.now() - btn.__spClaimedAt < 30_000) return false;
    btn.__spClaimedAt = Date.now();
    lastClaimTime = Date.now();
    setTimeout(() => {
      if (!btn.isConnected || btn.offsetParent === null || btn.hasAttribute("disabled")) return;
      btn.click();
      notifyDropClaimed();
    }, HUMAN_DELAY.pick("dropClick"));
    return true;
  }

  function tryClaimDrops() {
    // Boutons désignés par attribut : ce sont les vrais, on leur fait confiance.
    const exact = [
      '[data-a-target="claim-drop-button"]',
      'button[data-test-selector="claim-drop-button"]',
      ".claim-drop-button button",
      "button.claim-button",
    ];

    for (const selector of exact) {
      for (const btn of document.querySelectorAll(selector)) {
        if (
          btn instanceof HTMLElement &&
          btn.offsetParent !== null &&
          !btn.hasAttribute("disabled")
        ) {
          if (scheduleDropClaim(btn)) return true;
        }
      }
    }

    // Repli sur le libellé, cantonné aux zones qui parlent réellement de Drops.
    // On filtre sur « drops » au pluriel, qui ne se retrouve pas dans
    // « dropdown ». Hors de ces zones, un bouton « Réclamer » peut appartenir à
    // tout autre chose.
    const scopes = /^\/drops(\/|$)/.test(location.pathname)
      ? [document]
      : Array.from(
          document.querySelectorAll(
            '[class*="drops"], [data-a-target*="drops"], [data-test-selector*="drops"]'
          )
        );

    for (const scope of scopes) {
      for (const btn of scope.querySelectorAll("button")) {
        if (!isClaimButton(btn)) continue;
        if (scheduleDropClaim(btn)) return true;
      }
    }

    return false;
  }

  function tryClaim() {
    if (Date.now() - lastClaimTime < 4000) return;

    if (isPointsActive && tryClaimChannelPoints()) return;
    // Sur les pages Drops que l'on regarde soi-même, pas de clic : la
    // récupération passe par Twitch (dropsRecorder.js) et l'utilisateur garde la
    // main. Seul l'onglet d'inventaire ouvert en arrière-plan clique encore.
    const watchingDropsPage = /^\/drops(\/|$)/.test(location.pathname) && document.visibilityState === "visible";
    if (isDropsActive && !watchingDropsPage && tryClaimDrops()) return;
  }

  function start() {
    if (intervalId) return;
    intervalId = setInterval(tryClaim, CLAIM_CHECK_INTERVAL);
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  // Récupération auto des Drops : réservée à StreamPulse+.
  const PLUS_RULE = globalThis.StreamPulsePlusRule;
  let lastPrefs = {};
  let plusOn = false;

  function applyPref(prefs = lastPrefs) {
    lastPrefs = prefs || {};
    prefs = lastPrefs;
    isPointsActive = prefs.autoClaimChannelPoints !== false;
    isDropsActive = plusOn && prefs.autoClaimDrops !== false;

    const anyActive = isPointsActive || isDropsActive;
    anyActive ? start() : stop();
  }

  import(chrome.runtime.getURL("js/points-bonus.js"))
    .then((module) => {
      bonusRules = module;
    })
    .catch((error) => {
      // Sans ces règles, les points ne sont plus récupérés ; les Drops continuent.
      console.warn("[StreamPulse] règles de la caisse de bonus indisponibles", error);
    });

  chrome.storage.local.get([PREFERENCES_KEY, PLUS_RULE.PLUS_KEY], (result) => {
    if (chrome.runtime.lastError) {
      start();
      return;
    }
    // Essai sur un autre compte Twitch : isPlusActive répond non (js/inject/plus-rule.js).
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
