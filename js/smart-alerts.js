// Alertes intelligentes (StreamPulse+) : règles par streamer qui remplacent
// l'alerte classique « passe en live ». Module pur, testé à part.

export const SMART_ALERTS_KEY = "streamPulseSmartAlerts";

export const MAX_RULES_PER_STREAMER = 6;
export const MAX_TERMS_PER_RULE = 8;

function cleanTerms(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const term = String(raw ?? "").trim().slice(0, 60);
    const key = term.toLowerCase();
    if (!term || seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length >= MAX_TERMS_PER_RULE) break;
  }
  return out;
}

export function normalizeRule(rule) {
  const minViewers = Math.max(0, Math.floor(Number(rule?.minViewers) || 0));
  return {
    id: String(rule?.id || `r_${Math.random().toString(36).slice(2, 10)}`),
    name: String(rule?.name || "").trim().slice(0, 60),
    enabled: rule?.enabled !== false,
    games: cleanTerms(rule?.games),
    keywords: cleanTerms(rule?.keywords),
    minViewers,
  };
}

/** { [streamerId]: Rule[] } nettoyé, sans streamer vide. */
export function normalizeRules(stored) {
  const out = {};
  if (!stored || typeof stored !== "object") return out;
  for (const [streamerId, rules] of Object.entries(stored)) {
    if (!Array.isArray(rules)) continue;
    const clean = rules.map(normalizeRule).slice(0, MAX_RULES_PER_STREAMER);
    if (clean.length) out[streamerId] = clean;
  }
  return out;
}

const fold = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Une règle vide (ni jeu, ni mot, ni seuil) accepte tout live. */
export function ruleMatches(rule, status) {
  if (!rule?.enabled || !status?.isLive) return false;
  const game = fold(status.game);
  const title = fold(status.title);
  if (rule.games.length && !rule.games.some((g) => game && game === fold(g))) return false;
  if (rule.keywords.length && !rule.keywords.some((k) => title.includes(fold(k)))) return false;
  if (rule.minViewers > 0 && !(Number(status.viewers) >= rule.minViewers)) return false;
  return true;
}

/**
 * Décide d'une alerte pour un streamer.
 *
 * - Pas de règle active : `null`, l'alerte classique s'applique.
 * - Sinon on prévient quand une règle devient vraie (passage en live qui
 *   correspond, ou changement de jeu, de titre ou d'audience qui la rend vraie).
 *   Une règle déjà vraie au sondage précédent ne renvoie rien : pas de doublon.
 */
export function decideSmartAlert(rules, status, previouslyMatchedIds = []) {
  const active = (rules || []).filter((rule) => rule.enabled);
  if (!active.length) return null;
  const matchedIds = active.filter((rule) => ruleMatches(rule, status)).map((rule) => rule.id);
  const fresh = matchedIds.find((id) => !previouslyMatchedIds.includes(id));
  return {
    matchedIds,
    notifyRule: fresh ? active.find((rule) => rule.id === fresh) : null,
  };
}
