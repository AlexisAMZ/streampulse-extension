// Prédictions assistées (StreamPulse+). Module pur : règle de mise, choix de
// l'option, historique et statistiques. Aucun accès à chrome.* ni au DOM.
// Testé par tests/predictions-data.test.mjs, chargé par predictionsAssist.js.

export const PREDICTION_RULE_KEY = "streamPulsePredictionRule";
export const PREDICTION_HISTORY_KEY = "streamPulsePredictionHistory";
export const HISTORY_LIMIT = 200;
/** Mise minimale acceptée par Twitch. */
export const MIN_BET = 10;
/** Sans nouvelle lecture de la chaîne pendant ce délai, le résultat est inconnu. */
export const STALE_MS = 10 * 60 * 1000;
export const STRATEGIES = ["majority", "underdog"];

export const DEFAULT_RULE = Object.freeze({
  enabled: false,
  strategy: "majority",
  percent: 5,
  maxPoints: 1000,
  reserve: 1000,
  secondsBeforeEnd: 20,
});

function clampInt(value, min, max, fallback) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function normalizeRule(input) {
  const rule = input && typeof input === "object" ? input : {};
  return {
    enabled: rule.enabled === true,
    strategy: STRATEGIES.includes(rule.strategy) ? rule.strategy : DEFAULT_RULE.strategy,
    percent: clampInt(rule.percent, 1, 50, DEFAULT_RULE.percent),
    maxPoints: clampInt(rule.maxPoints, MIN_BET, 250000, DEFAULT_RULE.maxPoints),
    reserve: clampInt(rule.reserve, 0, 100000000, DEFAULT_RULE.reserve),
    secondsBeforeEnd: clampInt(rule.secondsBeforeEnd, 5, 120, DEFAULT_RULE.secondsBeforeEnd),
  };
}

/** Événement renvoyé par Twitch (ChannelPointsPredictionContext) vers la forme interne. */
export function parseEvent(raw) {
  if (!raw || !raw.id || !Array.isArray(raw.outcomes) || raw.outcomes.length < 2) return null;
  const createdAt = Date.parse(raw.createdAt || "");
  const windowSeconds = Number(raw.predictionWindowSeconds) || 0;
  return {
    id: String(raw.id),
    title: String(raw.title || "").slice(0, 120),
    status: String(raw.status || "").toUpperCase(),
    endsAt: Number.isFinite(createdAt) ? createdAt + windowSeconds * 1000 : 0,
    outcomes: raw.outcomes.map((outcome) => ({
      id: String(outcome.id),
      title: String(outcome.title || "").slice(0, 60),
      totalPoints: Math.max(0, Number(outcome.totalPoints) || 0),
    })),
  };
}

export function secondsLeft(event, now = Date.now()) {
  return event && event.endsAt ? Math.floor((event.endsAt - now) / 1000) : -1;
}

/**
 * Option retenue : la plus jouée (la plus probable selon le tchat) ou la moins
 * jouée (la meilleure cote). Sans aucune mise, rien ne permet de choisir.
 */
export function chooseOutcome(event, rule) {
  const outcomes = (event && event.outcomes) || [];
  if (outcomes.length < 2) return null;
  const sorted = outcomes.slice().sort((a, b) => b.totalPoints - a.totalPoints);
  if (sorted[0].totalPoints === 0) return null;
  return rule.strategy === "underdog" ? sorted[sorted.length - 1] : sorted[0];
}

/** Mise en points : pourcentage du solde, plafonnée, sans entamer la réserve. */
export function stakeFor(balance, rule) {
  const total = Math.floor(Number(balance) || 0);
  const available = total - rule.reserve;
  if (available < MIN_BET) return 0;
  const stake = Math.min(Math.floor((total * rule.percent) / 100), rule.maxPoints, available);
  return stake >= MIN_BET ? stake : 0;
}

/** Décision pour un événement : { outcome, points }, ou null s'il ne faut pas miser. */
export function decideBet(event, balance, rule, history, now = Date.now()) {
  if (!rule.enabled || !event || event.status !== "ACTIVE") return null;
  if ((history || []).some((bet) => bet.eventId === event.id)) return null;
  const left = secondsLeft(event, now);
  if (left < 2 || left > rule.secondsBeforeEnd) return null;
  const outcome = chooseOutcome(event, rule);
  const points = stakeFor(balance, rule);
  return outcome && points ? { outcome, points } : null;
}

export function addBet(history, bet) {
  return [bet, ...(history || []).filter((item) => item.eventId !== bet.eventId)].slice(0, HISTORY_LIMIT);
}

/**
 * Résultat estimé d'après le solde, faute de résultat renvoyé par Twitch : un
 * remboursement rend exactement la mise, un gain rapporte davantage.
 */
export function resolveBet(bet, balance) {
  const delta = Math.floor(Number(balance) || 0) - bet.balanceAfter;
  if (Math.abs(delta - bet.points) <= 1) return { ...bet, status: "refunded", payout: bet.points };
  if (delta > bet.points) return { ...bet, status: "won", payout: delta };
  return { ...bet, status: "lost", payout: 0 };
}

/**
 * Met à jour les mises en attente d'une chaîne. Tant que l'événement est visible,
 * le solde de référence suit les bonus récupérés ; une fois disparu, le résultat
 * est estimé, ou déclaré inconnu si la chaîne n'a pas été lue depuis longtemps.
 */
export function settle(history, channel, liveEventIds, balance, now = Date.now()) {
  const live = new Set(liveEventIds || []);
  const known = Number.isFinite(balance);
  return (history || []).map((bet) => {
    if (bet.status !== "pending" || bet.channel !== channel) return bet;
    if (live.has(bet.eventId)) return known ? { ...bet, balanceAfter: balance, seenAt: now } : { ...bet, seenAt: now };
    if (!known || now - (Number(bet.seenAt) || 0) > STALE_MS) return { ...bet, status: "unknown", payout: 0 };
    return resolveBet(bet, balance);
  });
}

export function summarize(history) {
  const stats = { bets: 0, won: 0, lost: 0, refunded: 0, pending: 0, unknown: 0, failed: 0, net: 0, rate: null };
  for (const bet of history || []) {
    if (!(bet.status in stats)) continue;
    stats[bet.status] += 1;
    if (bet.status !== "failed") stats.bets += 1;
    if (bet.status === "won") stats.net += bet.payout - bet.points;
    if (bet.status === "lost") stats.net -= bet.points;
  }
  const decided = stats.won + stats.lost;
  stats.rate = decided ? stats.won / decided : null;
  return stats;
}
