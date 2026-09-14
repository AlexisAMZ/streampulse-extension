// Prédictions assistées (StreamPulse+) : sur une chaîne Twitch ouverte, lit la
// prédiction en cours par predictions-bridge.js, mise selon la règle de
// l'utilisateur quelques secondes avant la fin, puis estime le résultat.
(() => {
  "use strict";

  if (window.top !== window) return;

  const PLUS_KEY = "streamPulsePlus";
  const PLUS_GRACE_MS = 30 * 24 * 60 * 60 * 1000;
  const POLL_MS = 10_000;
  const FAST_POLL_MS = 3_000;
  const REQUEST_TIMEOUT_MS = 8_000;
  const IGNORED_ROUTES = new Set([
    "directory", "settings", "subscriptions", "drops", "wallet", "u", "search",
    "videos", "moderator", "inventory", "friends", "popout", "turbo",
  ]);

  let data = null;
  let sequence = 0;
  const waiting = new Map();

  function channelLogin() {
    const segment = (window.location.pathname.split("/").filter(Boolean)[0] || "").toLowerCase();
    return /^[a-z0-9_]{2,25}$/.test(segment) && !IGNORED_ROUTES.has(segment) ? segment : "";
  }

  /** Même règle que js/plus.js : à vie toujours active, mensuelle 30 jours après la dernière vérification. */
  function plusActive(record) {
    if (!record || record.status !== "active" || !record.licenseKey) return false;
    if (record.plan === "lifetime") return true;
    return Date.now() - (Number(record.verifiedAt) || 0) <= PLUS_GRACE_MS;
  }

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (event.source !== window || !message || message.__sp !== "prediction-response") return;
    const resolve = waiting.get(message.id);
    if (!resolve) return;
    waiting.delete(message.id);
    resolve(message);
  });

  function ask(op, payload) {
    return new Promise((resolve) => {
      const id = `sp-pred-${Date.now()}-${++sequence}`;
      waiting.set(id, resolve);
      window.postMessage({ __sp: "prediction-request", id, op, ...payload }, location.origin);
      setTimeout(() => {
        if (waiting.delete(id)) resolve({ ok: false, error: "timeout" });
      }, REQUEST_TIMEOUT_MS);
    });
  }

  async function tick() {
    let delay = POLL_MS;
    try {
      const channel = channelLogin();
      if (!channel || !chrome.runtime?.id) return;
      const stored = await chrome.storage.local.get([PLUS_KEY, data.PREDICTION_RULE_KEY, data.PREDICTION_HISTORY_KEY]);
      if (!plusActive(stored[PLUS_KEY])) return;
      const rule = data.normalizeRule(stored[data.PREDICTION_RULE_KEY]);
      const before = Array.isArray(stored[data.PREDICTION_HISTORY_KEY]) ? stored[data.PREDICTION_HISTORY_KEY] : [];
      const waitingResult = before.some((bet) => bet.status === "pending" && bet.channel === channel);
      if (!rule.enabled && !waitingResult) return;

      const context = await ask("context", { channel });
      if (!context.ok) return;
      const events = (context.events || []).map(data.parseEvent).filter(Boolean);
      const balance = Number.isFinite(context.balance) ? context.balance : NaN;
      const now = Date.now();
      let history = data.settle(before, channel, events.map((event) => event.id), balance, now);

      for (const event of events) {
        const left = data.secondsLeft(event, now);
        if (event.status === "ACTIVE" && left > 0 && left <= rule.secondsBeforeEnd + 15) delay = FAST_POLL_MS;
        const decision = data.decideBet(event, balance, rule, history, now);
        if (!decision) continue;
        const result = await ask("bet", { eventId: event.id, outcomeId: decision.outcome.id, points: decision.points });
        history = data.addBet(history, {
          eventId: event.id,
          channel,
          title: event.title,
          outcomeTitle: decision.outcome.title,
          points: decision.points,
          placedAt: Date.now(),
          seenAt: Date.now(),
          balanceAfter: balance - decision.points,
          status: result.ok ? "pending" : "failed",
          error: result.ok ? "" : String(result.error || "").slice(0, 80),
          payout: 0,
        });
      }

      if (JSON.stringify(history) !== JSON.stringify(before)) {
        await chrome.storage.local.set({ [data.PREDICTION_HISTORY_KEY]: history });
      }
    } catch {
      // Contexte d'extension invalidé ou réponse inattendue : on réessaie au prochain passage.
    } finally {
      setTimeout(tick, delay);
    }
  }

  import(chrome.runtime.getURL("js/predictions-data.js"))
    .then((module) => {
      data = module;
      setTimeout(tick, 4_000);
    })
    .catch(() => {});
})();
