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
    const response = await nativeFetch.call(window, GQL_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(operations),
      credentials: "omit",
    });
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

  window.addEventListener("message", async (event) => {
    const message = event.data;
    if (event.source !== window || !message || message.__sp !== "prediction-request") return;
    const reply = (payload) => window.postMessage({ __sp: "prediction-response", id: message.id, ...payload }, location.origin);
    try {
      if (message.op === "context") reply(await readContext(message.channel));
      else if (message.op === "bet") reply(await placeBet(message.eventId, message.outcomeId, message.points));
      else reply({ ok: false, error: "unknown_op" });
    } catch (error) {
      reply({ ok: false, error: String((error && error.message) || error) });
    }
  });
})();
