// Pont des prédictions assistées (StreamPulse+), exécuté dans le monde de la
// page Twitch. Twitch signe ses propres requêtes GraphQL (session, jeton
// d'intégrité) : ce script garde une copie de ces en-têtes pour lire la
// prédiction en cours et placer une mise exactement comme le ferait le site,
// sans permission supplémentaire. Il ne sert que predictionsAssist.js, qui lui
// parle par window.postMessage.
(() => {
  "use strict";

  if (window.top !== window || window.__streamPulsePredictionBridge) return;
  window.__streamPulsePredictionBridge = true;

  const GQL_URL = "https://gql.twitch.tv/gql";
  const HEADER_NAMES = ["authorization", "client-id", "client-integrity", "client-session-id", "client-version", "x-device-id"];
  // Requêtes persistées de l'application web Twitch.
  const HASHES = {
    predictions: "beb846598256b75bd7c1fe54a80431335996153e358ca9c7837ce7bb83d7d383",
    points: "1530a003a7d374b0380b79db0be0534f30ff46e61cffa2bc0e2468a909fbc024",
    bet: "b44682ecc88358817009f20e69d75081b1e58825bb40aa53d5dbadcc17c881d8",
  };
  const captured = {};
  // Après un échec réseau (TypeError du fetch), inutile de retenter GraphQL à
  // chaque poll de 10 s : le repli DOM prend le relais jusqu'à cette échéance.
  let gqlNetworkDownUntil = 0;

  function headerReader(headers) {
    if (!headers) return () => null;
    if (typeof Headers !== "undefined" && headers instanceof Headers) return (name) => headers.get(name);
    if (Array.isArray(headers)) {
      return (name) => {
        const pair = headers.find((entry) => String(entry[0]).toLowerCase() === name);
        return pair ? pair[1] : null;
      };
    }
    return (name) => {
      const key = Object.keys(headers).find((item) => item.toLowerCase() === name);
      return key ? headers[key] : null;
    };
  }

  function remember(headers) {
    try {
      const read = headerReader(headers);
      HEADER_NAMES.forEach((name) => {
        const value = read(name);
        if (value) captured[name] = String(value);
      });
    } catch {
      // En-têtes illisibles : la prochaine requête de Twitch servira.
    }
  }

  const nativeFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      if (url.startsWith(GQL_URL)) remember((init && init.headers) || (input instanceof Request ? input.headers : null));
    } catch {
      // Ne jamais gêner les requêtes de Twitch.
    }
    return nativeFetch.apply(this, arguments);
  };

  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__spGql = String(url || "").startsWith(GQL_URL);
    return nativeOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    try {
      const key = String(name).toLowerCase();
      if (this.__spGql && HEADER_NAMES.includes(key) && value) captured[key] = String(value);
    } catch {
      // Ne jamais gêner les requêtes de Twitch.
    }
    return nativeSetHeader.apply(this, arguments);
  };

  const persisted = (operationName, sha256Hash, variables) => ({
    operationName,
    variables,
    extensions: { persistedQuery: { version: 1, sha256Hash } },
  });

  async function gql(operations) {
    if (!captured.authorization || !captured["client-id"]) throw new Error("no_session");
    const headers = { "Content-Type": "text/plain;charset=UTF-8" };
    HEADER_NAMES.forEach((name) => {
      if (captured[name]) headers[name] = captured[name];
    });
    let response;
    try {
      response = await nativeFetch.call(window, GQL_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(operations),
        credentials: "omit",
      });
    } catch (networkError) {
      if (networkError instanceof TypeError) gqlNetworkDownUntil = Date.now() + 120_000;
      throw networkError;
    }
    if (!response.ok) throw new Error(`http_${response.status}`);
    return response.json();
  }

  async function readContext(channel) {
    const login = String(channel || "").toLowerCase();
    const [predictions, points] = await gql([
      persisted("ChannelPointsPredictionContext", HASHES.predictions, { count: 1, channelLogin: login }),
      persisted("ChannelPointsContext", HASHES.points, { channelLogin: login, includeGoalTypes: ["CREATOR", "BOOST"] }),
    ]);
    const community = predictions && predictions.data && predictions.data.community;
    const channelData = community && community.channel;
    const self = points && points.data && points.data.community && points.data.community.channel && points.data.community.channel.self;
    const balance = self && self.communityPoints ? Number(self.communityPoints.balance) : null;
    return {
      ok: true,
      events: [...((channelData && channelData.activePredictionEvents) || []), ...((channelData && channelData.lockedPredictionEvents) || [])],
      balance: Number.isFinite(balance) ? balance : null,
    };
  }

  async function placeBet(eventId, outcomeId, points) {
    const transactionID = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())).replace(/-/g, "");
    const [result] = await gql([
      persisted("MakePrediction", HASHES.bet, {
        input: { eventID: String(eventId), outcomeID: String(outcomeId), points: Math.floor(Number(points)), transactionID },
      }),
    ]);
    const error = (result && result.errors && result.errors[0] && result.errors[0].message) ||
      (result && result.data && result.data.makePrediction && result.data.makePrediction.error && result.data.makePrediction.error.code);
    return error ? { ok: false, error: String(error) } : { ok: true };
  }

  // ---- Voie de secours DOM -------------------------------------------------
  // Les requêtes persistées ci-dessus reposent sur des hash que Twitch fait
  // tourner : quand ils expirent, gql() renvoie http_400 et la prédiction
  // devient illisible. Le site, lui, continue de fonctionner : on pilote donc
  // l'interface exactement comme un utilisateur (clics et champs de formulaire)
  // pour lire l'événement en cours et placer la mise sans GraphQL.

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function summaryBalance() {
    const summary = document.querySelector(
      '[data-test-selector="community-points-summary"], .community-points-summary'
    );
    const amount = summary && String(summary.textContent || "").match(/\d[\d\s\u202f,]*/);
    if (!amount) return null;
    const value = Number(amount[0].replace(/[^\d]/g, ""));
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  /**
   * Attend que test() renvoie vrai (poll court) au lieu de dormir un temps
   * fixe : sur machine lente, un wait(500) lisait un panneau pas encore rendu.
   * Renvoie le résultat de test(), ou null à l'échéance.
   */
  function waitFor(test, timeout = 2500, step = 120) {
    return new Promise((resolve) => {
      const started = Date.now();
      const timer = setInterval(() => {
        let found = null;
        try {
          found = test();
        } catch (_) {
          // Sélecteur pas encore valide : on retente.
        }
        if (found) {
          clearInterval(timer);
          resolve(found);
        } else if (Date.now() - started >= timeout) {
          clearInterval(timer);
          resolve(null);
        }
      }, step);
    });
  }

  function closePredictionPanel() {
    // L'en-tête du popover porte le bouton de fermeture, mais sa position dans
    // l'arbre dépend des versions de l'interface : on cherche n'importe quel
    // bouton cliquable dans l'en-tête, puis on vérifie que ça a fermé, sinon
    // Escape (comportement natif du popover) — un panneau qui resterait ouvert
    // serait rrouvert à chaque poll.
    const header = document.querySelector(".rewards-popover-header");
    const close = header
      ? Array.from(header.querySelectorAll('button, [role="button"]')).find((el) => el instanceof HTMLElement)
      : null;
    if (close) close.click();
    setTimeout(() => {
      if (document.querySelector(".rewards-popover-header")) {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true }));
      }
    }, 200);
  }

  function subtitleSeconds(text) {
    const clock = String(text || "").match(/(\d+)\s*:\s*(\d+)/);
    if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
    const plain = String(text || "").match(/\d+/);
    return plain ? Number(plain[0]) : 0;
  }

  /** Lit la prédiction en cours via le panneau, au format brut attendu par parseEvent. */
  async function readPanelEvent() {
    const item = document.querySelector(".predictions-list-item");
    if (!item) return null;

    const subtitle = document.querySelector('p[data-test-selector="predictions-list-item__subtitle"]');
    const seconds = subtitleSeconds(subtitle && subtitle.textContent);

    item.click();
    // Le panneau se monte en async : attendre son rendu (ou un état non votable).
    const rendered = await waitFor(
      () =>
        document.querySelector(".prediction-checkout-details-header") ||
        document.querySelector('[data-test-selector="prediction-checkout-completion-step__winnings-string"]') ||
        document.querySelector('p[data-test-selector="prediction-checkout-completion-step__luck-string"]') ||
        document.querySelector('span[data-test-selector="user-prediction-string__outcome-title"]')
    );
    if (!rendered) {
      closePredictionPanel();
      return null;
    }

    try {
      // Déjà misé, terminé ou résolu : le panneau ne propose plus de vote.
      const ended =
        document.querySelector('[data-test-selector="prediction-checkout-completion-step__winnings-string"]') ||
        document.querySelector('p[data-test-selector="prediction-checkout-completion-step__luck-string"]');
      const ownBet = document.querySelector('span[data-test-selector="user-prediction-string__outcome-title"]');
      if (ended || ownBet) return null;

      if (!seconds) return null;

      const header = document.querySelector(".prediction-checkout-details-header");
      const title = String(header && header.textContent || "").split("\n")[0].trim();
      const outcomeTitles = Array.from(
        document.querySelectorAll('div[data-test-selector="prediction-summary-outcome__title"]')
      ).map((node) => String(node.textContent || "").trim());

      if (!title || outcomeTitles.length < 2) return null;

      // Points de chaque option : l'entier le plus grand du bloc de l'option
      // (le bloc contient aussi des cotes décimales, plus petites).
      const outcomes = outcomeTitles.map((outcomeTitle) => {
        const block = Array.from(
          document.querySelectorAll('div[data-test-selector="prediction-summary-outcome__title"]')
        ).find((node) => String(node.textContent || "").trim() === outcomeTitle)?.parentElement;
        let totalPoints = 0;
        for (const match of String((block && block.textContent) || "").matchAll(/\d[\d\s\u202f,]*/g)) {
          const value = Number(match[0].replace(/[^\d]/g, ""));
          if (Number.isFinite(value) && value > totalPoints) totalPoints = value;
        }
        return { id: outcomeTitle, title: outcomeTitle, totalPoints };
      });

      return {
        id: `${title}|${outcomeTitles.join("|")}`,
        title,
        // Le compte à rebours du panneau part de maintenant.
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        predictionWindowSeconds: seconds,
        outcomes,
      };
    } finally {
      closePredictionPanel();
    }
  }

  async function domContext() {
    const event = await readPanelEvent();
    return {
      ok: true,
      events: event ? [event] : [],
      balance: summaryBalance(),
    };
  }

  /** Remplit le champ personnalisé comme le ferait le site (setter natif + événement input pour React). */
  function setNativeValue(input, value) {
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value");
    if (descriptor && descriptor.set) descriptor.set.call(input, String(value));
    else input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function domBet(outcomeTitle, points) {
    const item = document.querySelector(".predictions-list-item");
    if (!item) return { ok: false, error: "panel_not_found" };

    item.click();
    await wait(500);

    try {
      const toggle = document.querySelector('button[data-test-selector="prediction-checkout-active-footer__input-type-toggle"]');
      if (!toggle) return { ok: false, error: "panel_not_votable" };

      toggle.click();
      const toggled = await waitFor(() => document.querySelector(".custom-prediction-button"));
      if (!toggled) return { ok: false, error: "panel_not_votable" };

      const buttons = Array.from(document.querySelectorAll(".custom-prediction-button"));
      const index = outcomeTitle
        ? buttons.findIndex((button) => String(button.textContent || "").includes(outcomeTitle))
        : 0;
      if (index === -1) return { ok: false, error: "outcome_not_found" };

      const input = buttons[index].querySelector("input");
      const confirm = buttons[index].querySelector(".custom-prediction-button__interactive");
      if (!input || !confirm) return { ok: false, error: "input_not_found" };

      setNativeValue(input, Math.floor(Number(points)));
      await wait(200);
      confirm.click();
      const accept = await waitFor(
        () =>
          document.querySelector('button[data-test-selector="prediction-terms-step__accept-button"]') ||
          document.querySelector('button[data-test-selector="prediction-mod-confirmation__accept-button"]')
      );
      if (!accept) return { ok: false, error: "confirm_not_found" };
      accept.click();
      return { ok: true };
    } finally {
      await wait(300);
      closePredictionPanel();
    }
  }

  // Les bascules GraphQL → DOM sont normales (hash tourné, réseau coupé,
  // bloqueur de pub) : une ligne par type et par tranche de 10 minutes suffit,
  // en console.info pour ne pas alimenter les rapports d'erreurs du store.
  const FALLBACK_LOG_INTERVAL_MS = 10 * 60_000;
  const lastFallbackLog = { predictions: 0, bet: 0 };
  function logFallback(kind, reason) {
    const now = Date.now();
    if (now - lastFallbackLog[kind] < FALLBACK_LOG_INTERVAL_MS) return;
    lastFallbackLog[kind] = now;
    console.info(`StreamPulse: GraphQL ${kind} unavailable, DOM fallback:`, reason);
  }

  window.addEventListener("message", async (event) => {
    const message = event.data;
    if (event.source !== window || !message || message.__sp !== "prediction-request") return;
    const reply = (payload) => window.postMessage({ __sp: "prediction-response", id: message.id, ...payload }, location.origin);
    try {
      if (message.op === "context") {
        let context = null;
        if (Date.now() >= gqlNetworkDownUntil) {
          try {
            context = await readContext(message.channel);
          } catch (graphqlError) {
            // Hash de requête persistée expiré, session illisible... : on passe
            // par l'interface plutôt que de laisser la prédiction invisible.
            logFallback("predictions", String((graphqlError && graphqlError.message) || graphqlError));
          }
        }
        reply(context || (await domContext()));
      } else if (message.op === "bet") {
        let result = { ok: false, error: "no_session" };
        try {
          result = await placeBet(message.eventId, message.outcomeId, message.points);
        } catch (graphqlError) {
          logFallback("bet", String((graphqlError && graphqlError.message) || graphqlError));
        }
        if (!result.ok && message.outcomeTitle) {
          result = await domBet(message.outcomeTitle, message.points);
        }
        reply(result);
      } else reply({ ok: false, error: "unknown_op" });
    } catch (error) {
      reply({ ok: false, error: String((error && error.message) || error) });
    }
  });
})();
