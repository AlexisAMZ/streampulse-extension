# Suivi des points de chaîne : plan d'implémentation

> **Pour les agents :** sous-compétence requise : superpowers:executing-plans (exécution dans la session, demandée par Alexis). Les étapes utilisent des cases `- [ ]`.

**Objectif :** enregistrer chaque gain de points de chaîne Twitch et l'afficher par chaîne et par raison, dans un panneau Points des Réglages et dans le récap.

**Architecture :** un pont dans le monde de la page Twitch repère les messages `points-earned` sur les WebSocket (Hermes ou PubSub) et les poste à un relais isolé. Le relais les transmet au service worker, seul écrivain, qui dédoublonne et agrège par jour, chaîne et raison. Le popup et le récap lisent le stockage et appellent les fonctions pures de `js/points-data.js`.

**Pile :** extension MV3 en JavaScript sans framework, `node:test`, ESLint, `npm run verify`.

**Spec :** `docs/superpowers/specs/2026-09-26-suivi-des-points-design.md`

## Contraintes globales

- Twitch uniquement, points gagnés uniquement ; aucun historique rétroactif.
- Gratuit : total par chaîne. StreamPulse+ : détail par raison, bonus d'abonné, jour par jour, fiche streamer, journal.
- Un seul écrivain : le service worker. Aucune mutation d'état : chaque fonction de `points-data.js` renvoie un nouvel objet.
- Aucun `import()` dans un content script (Firefox le refuse).
- Toute chaîne visible dans les 11 langues publiées : fr, en, es, pt-BR, de, it, pl, tr, ru, ja, ko. `npm run verify` fait autorité.
- Jamais de tiret cadratin dans les textes ni les commentaires.
- Clés de stockage : `streamPulsePointsDaily`, `streamPulsePointsJournal`, `streamPulsePointsChannels`.
- Préférence : `pointsTracking`, vraie par défaut.
- Rétention : `daily` 400 jours ; `journal` 60 jours et 1 000 gains au plus.
- Forme Hermes vérifiée le 2026-09-26 : `{"notification":{"subscription":{"id":…},"type":"pubsub","pubsub":"<message PubSub en chaîne JSON>"},"id":…,"type":"notification","timestamp":…}`.
- Codes de raison Twitch : `CHEER`, `CLAIM`, `FOLLOW`, `PREDICTION`, `PRIME_SUB`, `RAID`, `REFUND`, `SUB_GIFT`, `WATCH`, `WATCH_STREAK`.

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `js/points-data.js` (nouveau) | module pur : normalisation, agrégation, résumés, fiche chaîne |
| `js/inject/points-bridge.js` (nouveau) | monde MAIN : écoute les WebSocket, extrait `points-earned` |
| `js/pointsRecorder.js` (nouveau) | monde isolé : relais vers le service worker, respecte la préférence |
| `js/points-store.js` (nouveau) | service worker : file sérialisée, écriture, noms de chaînes, remise à zéro |
| `js/popup-points.js` (nouveau) | panneau Points : vue gratuite, vue d'ensemble et fiche StreamPulse+ |
| `tests/points-data.test.mjs`, `tests/points-bridge.test.mjs`, `tests/points-store.test.mjs`, `tests/backup-points.test.mjs` (nouveaux) | tests |
| `manifest.json` | deux content scripts |
| `js/background.js` | store, résolveur Helix, messages, préférence dans `sanitize()` |
| `js/preferences-data.js` | `pointsTracking: true` |
| `js/backup.js` | trois clés sauvegardées, nettoyées et fusionnées |
| `html/popup.html`, `css/popup.css`, `js/popup.js`, `js/popup-features.js` | panneau et interrupteur |
| `html/recap.html`, `css/recap.css`, `js/recap.js`, `js/recap-card.js`, `js/recap-story.js` | tuile de points et section avancée |
| `i18n/translations.js` | textes des 11 langues |
| `js/changelog-data.js`, `manifest.json`, `package.json` | release 26.9.27 |
| `scripts/dev/mock-chrome.js` | données de démo du banc |
| `eslint.config.mjs` | modules ES ajoutés |

---

### Tâche 1 : module de données `js/points-data.js`

**Fichiers :**
- Créer : `js/points-data.js`
- Créer : `tests/points-data.test.mjs`
- Modifier : `eslint.config.mjs` (liste des modules ES)

**Interfaces produites** (utilisées par les tâches 3, 4, 5, 6, 7) :
- Constantes : `POINTS_DAILY_KEY`, `POINTS_JOURNAL_KEY`, `POINTS_CHANNELS_KEY`, `POINTS_KEYS`, `REASONS`, `REASON_LABEL_KEYS`, `PANEL_PERIODS`, `JOURNAL_LIMIT`
- `emptyState()` → `{ daily, journal, channels }`
- `stateFrom(stored)` / `toStorage(state)`
- `normalizeGain(raw, now)` → `Gain | null`, avec `Gain = { key, at, day, channelId, reason, rawReason, points, base, factor, balance }`
- `addGain(state, gain)` → nouvel état (même objet si doublon)
- `prune(state, now)` → nouvel état
- `dayKeysForPeriod(periodId, state, now)` → `string[]` ; périodes `today`, `7d`, `30d`, `all`, `month:AAAA-MM`, `year:AAAA`
- `summarizeDays(state, dayKeys)` / `summarize(state, periodId, now)` → `{ total, base, subBonus, count, byReason[], byChannel[], channelCount }`
- `daySeries(state, periodId, now, channelId?)` → `[{ key, points }]`
- `channelDetail(state, channelId, periodId, now)` → voir le code
- `lastGainAt(state)` → `number` (0 si aucun gain)
- `tierFromFactor(factor)` → `0 | 1 | 2 | 3`
- `channelName(state, channelId)` → nom affichable

- [ ] **Étape 1 : écrire les tests**

<!-- fichier: tests/points-data.test.mjs -->
```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  REASONS,
  addGain,
  channelDetail,
  channelName,
  dayKeysForPeriod,
  daySeries,
  emptyState,
  lastGainAt,
  normalizeGain,
  prune,
  stateFrom,
  summarize,
  tierFromFactor,
  toStorage,
  POINTS_DAILY_KEY,
} from "../js/points-data.js";

const NOW = new Date(2026, 8, 26, 21, 50).getTime(); // 26 sept. 2026, 21 h 50, heure locale

/** Charge utile telle que Twitch l'envoie dans un message « points-earned ». */
function raw({ channel = "123", reason = "WATCH", total = 12, base = 10, factor = 0.2, at = NOW, balance = 23410 } = {}) {
  return {
    timestamp: new Date(at).toISOString(),
    channel_id: channel,
    point_gain: {
      user_id: "999",
      channel_id: channel,
      total_points: total,
      baseline_points: base,
      reason_code: reason,
      multipliers: factor ? [{ reason_code: "SUB_T1", factor }] : [],
    },
    balance: { user_id: "999", channel_id: channel, balance },
  };
}

const gainOf = (options, now = NOW) => normalizeGain(raw(options), now);

test("normalizeGain lit un gain de visionnage avec multiplicateur", () => {
  const gain = gainOf();
  assert.equal(gain.channelId, "123");
  assert.equal(gain.reason, "WATCH");
  assert.equal(gain.points, 12);
  assert.equal(gain.base, 10);
  assert.equal(gain.factor, 0.2);
  assert.equal(gain.balance, 23410);
  assert.equal(gain.day, "2026-09-26");
  assert.equal(gain.at, NOW);
  assert.match(gain.key, /^123\|\d+\|WATCH\|12$/);
});

test("normalizeGain range un code inconnu dans OTHER en gardant le code d'origine", () => {
  const gain = gainOf({ reason: "PREDICTION", total: 500, base: 500, factor: 0 });
  assert.equal(gain.reason, "OTHER");
  assert.equal(gain.rawReason, "PREDICTION");
});

test("normalizeGain refuse une charge invalide", () => {
  assert.equal(normalizeGain(null), null);
  assert.equal(normalizeGain({}), null);
  assert.equal(normalizeGain(raw({ channel: "abc" })), null);
  assert.equal(normalizeGain(raw({ total: 0 })), null);
  assert.equal(normalizeGain(raw({ total: 2.5 })), null);
  assert.equal(normalizeGain(raw({ total: 5_000_000 })), null);
});

test("normalizeGain replie la base sur le total quand elle est absente ou incohérente", () => {
  const missing = raw();
  delete missing.point_gain.baseline_points;
  assert.equal(normalizeGain(missing, NOW).base, 12);
  assert.equal(gainOf({ base: 99 }).base, 12);
});

test("normalizeGain prend l'heure courante si l'horodatage est illisible", () => {
  const payload = raw();
  payload.timestamp = "pas une date";
  assert.equal(normalizeGain(payload, NOW).at, NOW);
});

test("addGain agrège par jour, chaîne et raison sans muter l'état", () => {
  const start = emptyState();
  const one = addGain(start, gainOf({ at: NOW - 1000 }));
  const two = addGain(one, gainOf({ at: NOW }));
  assert.deepEqual(start, emptyState());
  assert.deepEqual(two.daily["2026-09-26"]["123"].WATCH, { count: 2, points: 24, base: 20 });
  assert.equal(two.journal.length, 2);
  assert.equal(two.journal[0].at, NOW);
});

test("addGain ignore un doublon (deux onglets reçoivent le même gain)", () => {
  const once = addGain(emptyState(), gainOf());
  const twice = addGain(once, gainOf());
  assert.equal(twice, once);
});

test("addGain garde solde, multiplicateur et dates des gains uniques", () => {
  let state = addGain(emptyState(), gainOf({ at: NOW - 5000, balance: 100 }));
  state = addGain(state, gainOf({ reason: "CHEER", total: 350, base: 350, factor: 0, at: NOW - 4000, balance: 450 }));
  state = addGain(state, gainOf({ reason: "FOLLOW", total: 300, base: 300, factor: 0, at: NOW - 3000, balance: 750 }));
  const channel = state.channels["123"];
  assert.equal(channel.balance, 750);
  assert.equal(channel.factor, 0.2);
  assert.equal(channel.firsts.CHEER, NOW - 4000);
  assert.equal(channel.firsts.FOLLOW, NOW - 3000);
  assert.equal(channel.lastGainAt, NOW - 3000);
});

test("addGain ne remplace pas un solde récent par un gain plus ancien", () => {
  let state = addGain(emptyState(), gainOf({ at: NOW, balance: 900 }));
  state = addGain(state, gainOf({ at: NOW - 60_000, total: 60, base: 50, reason: "CLAIM", balance: 800 }));
  assert.equal(state.channels["123"].balance, 900);
});

test("prune coupe le journal et les jours trop anciens", () => {
  let state = emptyState();
  state = addGain(state, gainOf({ at: NOW - 70 * 86_400_000 }));
  state = addGain(state, gainOf({ at: NOW - 500 * 86_400_000, total: 60, base: 50, reason: "CLAIM" }));
  state = addGain(state, gainOf({ at: NOW }));
  const pruned = prune(state, NOW);
  assert.equal(pruned.journal.length, 1);
  assert.equal(Object.keys(pruned.daily).length, 2);
});

test("dayKeysForPeriod couvre le panneau et le récap", () => {
  const state = addGain(emptyState(), gainOf({ at: new Date(2026, 7, 3).getTime() }));
  assert.deepEqual(dayKeysForPeriod("today", state, NOW), ["2026-09-26"]);
  assert.equal(dayKeysForPeriod("7d", state, NOW).length, 7);
  assert.equal(dayKeysForPeriod("30d", state, NOW).length, 30);
  assert.deepEqual(dayKeysForPeriod("all", state, NOW), ["2026-08-03"]);
  assert.deepEqual(dayKeysForPeriod("month:2026-08", state, NOW), ["2026-08-03"]);
  assert.deepEqual(dayKeysForPeriod("year:2026", state, NOW), ["2026-08-03"]);
  assert.deepEqual(dayKeysForPeriod("inconnue", state, NOW), []);
});

test("summarize totalise par raison et par chaîne, avec le bonus d'abonné", () => {
  let state = emptyState();
  state = addGain(state, gainOf({ channel: "1", reason: "CLAIM", total: 60, base: 50, at: NOW - 3000 }));
  state = addGain(state, gainOf({ channel: "1", reason: "WATCH", total: 12, base: 10, at: NOW - 2000 }));
  state = addGain(state, gainOf({ channel: "2", reason: "RAID", total: 250, base: 250, factor: 0, at: NOW - 1000 }));
  const summary = summarize(state, "7d", NOW);
  assert.equal(summary.total, 322);
  assert.equal(summary.subBonus, 12);
  assert.equal(summary.count, 3);
  assert.equal(summary.channelCount, 2);
  assert.deepEqual(summary.byReason.map((r) => r.code), REASONS.map((r) => r.code));
  assert.equal(summary.byReason.find((r) => r.code === "CLAIM").points, 60);
  assert.equal(summary.byChannel[0].channelId, "2");
  assert.equal(summary.byChannel[1].reasons.WATCH.count, 1);
});

test("daySeries renvoie un point par jour, dans l'ordre chronologique", () => {
  const state = addGain(emptyState(), gainOf({ at: NOW }));
  const series = daySeries(state, "7d", NOW);
  assert.equal(series.length, 7);
  assert.equal(series[6].key, "2026-09-26");
  assert.equal(series[6].points, 12);
  assert.equal(daySeries(state, "year:2026", NOW).length, 12);
  assert.equal(daySeries(state, "month:2026-09", NOW).length, 30);
});

test("channelDetail donne la fiche d'une chaîne et les états mensuels", () => {
  let state = emptyState();
  state = addGain(state, gainOf({ reason: "CLAIM", total: 60, base: 50, at: NOW - 3000 }));
  state = addGain(state, gainOf({ reason: "CHEER", total: 350, base: 350, factor: 0, at: new Date(2026, 8, 3).getTime() }));
  state = addGain(state, gainOf({ reason: "SUB_GIFT", total: 500, base: 500, factor: 0, at: new Date(2026, 7, 20).getTime() }));
  const detail = channelDetail(state, "123", "7d", NOW);
  assert.equal(detail.total, 60);
  assert.equal(detail.subBonus, 10);
  assert.equal(detail.reasons.find((r) => r.code === "CLAIM").count, 1);
  assert.equal(detail.status.CHEER.done, true);
  assert.equal(detail.status.SUB_GIFT.done, false, "un sub offert en août ne compte pas pour septembre");
  assert.equal(detail.status.FOLLOW.done, false);
  assert.equal(detail.factor, 0.2);
  assert.equal(detail.balance, 23410);
  assert.equal(detail.days.length, 7);
  assert.equal(detail.journal[0].reason, "CLAIM");
});

test("tierFromFactor retrouve le palier d'abonnement", () => {
  assert.equal(tierFromFactor(0), 0);
  assert.equal(tierFromFactor(0.2), 1);
  assert.equal(tierFromFactor(0.4), 2);
  assert.equal(tierFromFactor(1), 3);
});

test("lastGainAt et channelName", () => {
  let state = addGain(emptyState(), gainOf({ at: NOW - 5000 }));
  assert.equal(lastGainAt(state), NOW - 5000);
  assert.equal(lastGainAt(emptyState()), 0);
  assert.equal(channelName(state, "123"), "#123");
  state = { ...state, channels: { ...state.channels, 123: { ...state.channels["123"], login: "novastream", displayName: "Novastream" } } };
  assert.equal(channelName(state, "123"), "Novastream");
});

test("stateFrom et toStorage font l'aller-retour, et stateFrom répare une forme invalide", () => {
  const state = addGain(emptyState(), gainOf());
  assert.deepEqual(stateFrom(toStorage(state)), state);
  assert.deepEqual(stateFrom({ [POINTS_DAILY_KEY]: [] }), emptyState());
});
```

- [ ] **Étape 2 : lancer les tests, ils doivent échouer**

Lancer : `node --test tests/points-data.test.mjs`
Attendu : échec, `Cannot find module '../js/points-data.js'`.

- [ ] **Étape 3 : écrire le module**

<!-- fichier: js/points-data.js -->
```js
// Suivi des points de chaîne Twitch. Module pur : normalisation des gains
// captés sur Twitch, agrégation par jour, par chaîne et par raison, résumés
// pour le panneau Points et pour le récap. Aucun accès à chrome.* ni au DOM.
// Testé par tests/points-data.test.mjs.

import { dayKey, rollingDayKeys } from "./recap-data.js";

export const POINTS_DAILY_KEY = "streamPulsePointsDaily";
export const POINTS_JOURNAL_KEY = "streamPulsePointsJournal";
export const POINTS_CHANNELS_KEY = "streamPulsePointsChannels";
export const POINTS_KEYS = [POINTS_DAILY_KEY, POINTS_JOURNAL_KEY, POINTS_CHANNELS_KEY];

export const DAILY_RETENTION_DAYS = 400;
export const JOURNAL_RETENTION_DAYS = 60;
export const JOURNAL_LIMIT = 1000;
const DAY_MS = 86_400_000;
const MAX_POINTS = 1_000_000;
const MAX_FACTOR = 5;
const DETAIL_JOURNAL = 20;
const ALL_SERIES_DAYS = 30;

/**
 * Raisons affichées, dans l'ordre. `rule` est le gain de base annoncé par
 * Twitch, `upTo` en fait un plafond (séries de visionnage). OTHER regroupe
 * PREDICTION, REFUND, PRIME_SUB et tout code que Twitch ajouterait.
 */
export const REASONS = Object.freeze([
  Object.freeze({ code: "CLAIM", rule: 50 }),
  Object.freeze({ code: "WATCH", rule: 10 }),
  Object.freeze({ code: "WATCH_STREAK", rule: 450, upTo: true }),
  Object.freeze({ code: "RAID", rule: 250 }),
  Object.freeze({ code: "FOLLOW", rule: 300 }),
  Object.freeze({ code: "CHEER", rule: 350, monthly: true }),
  Object.freeze({ code: "SUB_GIFT", rule: 500, monthly: true }),
  Object.freeze({ code: "OTHER", rule: null }),
]);
const KNOWN_CODES = new Set(REASONS.map((r) => r.code).filter((code) => code !== "OTHER"));

/** Clé de traduction du libellé de chaque raison, partagée par le popup et le récap. */
export const REASON_LABEL_KEYS = Object.freeze({
  CLAIM: "popup.points.reasonClaim",
  WATCH: "popup.points.reasonWatch",
  WATCH_STREAK: "popup.points.reasonStreak",
  RAID: "popup.points.reasonRaid",
  FOLLOW: "popup.points.reasonFollow",
  CHEER: "popup.points.reasonCheer",
  SUB_GIFT: "popup.points.reasonSubGift",
  OTHER: "popup.points.reasonOther",
});
/** Gains uniques (une fois, ou une fois par mois) dont on garde la date. */
const FIRSTS = ["FOLLOW", "CHEER", "SUB_GIFT"];
/** Seuls ces gains portent le multiplicateur d'abonnement de façon fiable. */
const FACTOR_SOURCES = new Set(["WATCH", "CLAIM"]);

export const PANEL_PERIODS = Object.freeze(["today", "7d", "30d", "all"]);
const ROLLING = { today: 1, "7d": 7, "30d": 30 };

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const pad = (n) => String(n).padStart(2, "0");
const round2 = (n) => Math.round(n * 100) / 100;

export function emptyState() {
  return { daily: {}, journal: [], channels: {} };
}

/** État lu du storage, sans faire confiance à sa forme. */
export function stateFrom(stored = {}) {
  const source = stored || {};
  return {
    daily: isPlainObject(source[POINTS_DAILY_KEY]) ? source[POINTS_DAILY_KEY] : {},
    journal: Array.isArray(source[POINTS_JOURNAL_KEY]) ? source[POINTS_JOURNAL_KEY] : [],
    channels: isPlainObject(source[POINTS_CHANNELS_KEY]) ? source[POINTS_CHANNELS_KEY] : {},
  };
}

export function toStorage(state) {
  return {
    [POINTS_DAILY_KEY]: state.daily,
    [POINTS_JOURNAL_KEY]: state.journal,
    [POINTS_CHANNELS_KEY]: state.channels,
  };
}

/**
 * Transforme la charge d'un message « points-earned » en gain, ou `null` si
 * elle est invalide. La page Twitch peut poster n'importe quoi : tout est
 * vérifié et borné.
 */
export function normalizeGain(raw, now = Date.now()) {
  if (!isPlainObject(raw) || !isPlainObject(raw.point_gain)) return null;
  const gain = raw.point_gain;
  const channelId = String(gain.channel_id ?? raw.channel_id ?? "");
  if (!/^\d{1,20}$/.test(channelId)) return null;

  const points = Number(gain.total_points);
  if (!Number.isInteger(points) || points < 1 || points > MAX_POINTS) return null;
  const baseValue = Number(gain.baseline_points);
  const base = Number.isInteger(baseValue) && baseValue >= 0 && baseValue <= points ? baseValue : points;

  const rawReason = typeof gain.reason_code === "string" ? gain.reason_code.slice(0, 40) : "";
  const reason = KNOWN_CODES.has(rawReason) ? rawReason : "OTHER";

  const factorSum = (Array.isArray(gain.multipliers) ? gain.multipliers : []).reduce((sum, multiplier) => {
    const value = Number(multiplier?.factor);
    return Number.isFinite(value) && value > 0 ? sum + value : sum;
  }, 0);
  const factor = round2(Math.min(MAX_FACTOR, factorSum));

  const parsed = Date.parse(raw.timestamp);
  const at = Number.isFinite(parsed) ? parsed : now;
  const balanceValue = Number(raw.balance?.balance);
  const balance = Number.isInteger(balanceValue) && balanceValue >= 0 ? balanceValue : null;

  return {
    key: `${channelId}|${at}|${rawReason || reason}|${points}`,
    at,
    day: dayKey(new Date(at)),
    channelId,
    reason,
    rawReason,
    points,
    base,
    factor,
    balance,
  };
}

function nextChannel(channel, gain) {
  const next = { ...channel, lastGainAt: Math.max(channel.lastGainAt || 0, gain.at) };
  if (gain.balance !== null && gain.at >= (channel.balanceAt || 0)) {
    next.balance = gain.balance;
    next.balanceAt = gain.at;
  }
  if (FACTOR_SOURCES.has(gain.reason) && gain.at >= (channel.factorAt || 0)) {
    next.factor = gain.factor;
    next.factorAt = gain.at;
  }
  if (FIRSTS.includes(gain.reason)) {
    const firsts = isPlainObject(channel.firsts) ? channel.firsts : {};
    next.firsts = { ...firsts, [gain.reason]: Math.max(firsts[gain.reason] || 0, gain.at) };
  }
  return next;
}

/** Ajoute un gain et renvoie un nouvel état ; renvoie l'état tel quel si le gain est déjà connu. */
export function addGain(state, gain) {
  const current = state || emptyState();
  if (!gain || current.journal.some((entry) => entry.key === gain.key)) return current;

  const dayBucket = current.daily[gain.day] || {};
  const channelBucket = dayBucket[gain.channelId] || {};
  const previous = channelBucket[gain.reason] || { count: 0, points: 0, base: 0 };
  const entry = {
    key: gain.key,
    at: gain.at,
    channelId: gain.channelId,
    reason: gain.reason,
    rawReason: gain.rawReason,
    points: gain.points,
    base: gain.base,
    factor: gain.factor,
  };

  return {
    daily: {
      ...current.daily,
      [gain.day]: {
        ...dayBucket,
        [gain.channelId]: {
          ...channelBucket,
          [gain.reason]: {
            count: previous.count + 1,
            points: previous.points + gain.points,
            base: previous.base + gain.base,
          },
        },
      },
    },
    journal: [entry, ...current.journal].sort((a, b) => b.at - a.at),
    channels: { ...current.channels, [gain.channelId]: nextChannel(current.channels[gain.channelId] || {}, gain) },
  };
}

/** Oublie les jours et les gains trop anciens. */
export function prune(state, now = Date.now()) {
  const oldestDay = dayKey(new Date(now - DAILY_RETENTION_DAYS * DAY_MS));
  const oldestGain = now - JOURNAL_RETENTION_DAYS * DAY_MS;
  return {
    ...state,
    daily: Object.fromEntries(Object.entries(state.daily).filter(([day]) => day >= oldestDay)),
    journal: state.journal.filter((entry) => entry.at >= oldestGain).slice(0, JOURNAL_LIMIT),
  };
}

/** Jours d'une période du panneau (today, 7d, 30d, all) ou du récap (month:, year:). */
export function dayKeysForPeriod(periodId, state, now = Date.now()) {
  if (ROLLING[periodId]) return rollingDayKeys(ROLLING[periodId], new Date(now));
  const days = Object.keys((state || emptyState()).daily).sort();
  if (periodId === "all") return days;
  const month = /^month:(\d{4}-\d{2})$/.exec(periodId || "");
  if (month) return days.filter((day) => day.startsWith(`${month[1]}-`));
  const year = /^year:(\d{4})$/.exec(periodId || "");
  if (year) return days.filter((day) => day.startsWith(`${year[1]}-`));
  return [];
}

const emptyTotals = () => ({ count: 0, points: 0, base: 0 });

function addTotals(target, values) {
  target.count += Number(values?.count) || 0;
  target.points += Number(values?.points) || 0;
  target.base += Number(values?.base) || 0;
}

/** Totaux d'une liste de jours : par raison, par chaîne, et au global. */
export function summarizeDays(state, dayKeys) {
  const source = state || emptyState();
  const byReason = new Map(REASONS.map((reason) => [reason.code, { code: reason.code, ...emptyTotals() }]));
  const byChannel = new Map();
  const totals = emptyTotals();

  for (const day of dayKeys || []) {
    for (const [channelId, reasons] of Object.entries(source.daily[day] || {})) {
      if (!byChannel.has(channelId)) byChannel.set(channelId, { channelId, ...emptyTotals(), reasons: {} });
      const channel = byChannel.get(channelId);
      for (const [code, values] of Object.entries(reasons || {})) {
        const reasonCode = byReason.has(code) ? code : "OTHER";
        addTotals(byReason.get(reasonCode), values);
        addTotals(channel, values);
        channel.reasons[reasonCode] = channel.reasons[reasonCode] || emptyTotals();
        addTotals(channel.reasons[reasonCode], values);
        addTotals(totals, values);
      }
    }
  }

  const channels = [...byChannel.values()]
    .map((channel) => ({ ...channel, share: totals.points > 0 ? channel.points / totals.points : 0 }))
    .sort((a, b) => b.points - a.points);

  return {
    total: totals.points,
    base: totals.base,
    subBonus: totals.points - totals.base,
    count: totals.count,
    byReason: REASONS.map((reason) => byReason.get(reason.code)),
    byChannel: channels,
    channelCount: channels.length,
  };
}

export function summarize(state, periodId, now = Date.now()) {
  return summarizeDays(state, dayKeysForPeriod(periodId, state, now));
}

function dayPoints(state, day, channelId) {
  const bucket = state.daily[day] || {};
  const channels = channelId ? [bucket[channelId] || {}] : Object.values(bucket);
  let points = 0;
  for (const reasons of channels) {
    for (const values of Object.values(reasons || {})) points += Number(values?.points) || 0;
  }
  return points;
}

/** Courbe d'une période : un point par jour, ou par mois pour une année. */
export function daySeries(state, periodId, now = Date.now(), channelId = null) {
  const source = state || emptyState();
  const rollingDays = ROLLING[periodId] || (periodId === "all" ? ALL_SERIES_DAYS : 0);
  if (rollingDays) {
    return rollingDayKeys(rollingDays, new Date(now))
      .reverse()
      .map((key) => ({ key, points: dayPoints(source, key, channelId) }));
  }
  const month = /^month:(\d{4})-(\d{2})$/.exec(periodId || "");
  if (month) {
    const count = new Date(Number(month[1]), Number(month[2]), 0).getDate();
    return Array.from({ length: count }, (_, i) => {
      const key = `${month[1]}-${month[2]}-${pad(i + 1)}`;
      return { key, points: dayPoints(source, key, channelId) };
    });
  }
  const year = /^year:(\d{4})$/.exec(periodId || "");
  if (year) {
    return Array.from({ length: 12 }, (_, i) => {
      const key = `${year[1]}-${pad(i + 1)}`;
      const points = Object.keys(source.daily)
        .filter((day) => day.startsWith(`${key}-`))
        .reduce((sum, day) => sum + dayPoints(source, day, channelId), 0);
      return { key, points };
    });
  }
  return [];
}

/** Fiche d'une chaîne pour une période du panneau. */
export function channelDetail(state, channelId, periodId, now = Date.now()) {
  const source = state || emptyState();
  const summary = summarize(source, periodId, now);
  const row = summary.byChannel.find((channel) => channel.channelId === channelId)
    || { channelId, ...emptyTotals(), reasons: {} };
  const channel = source.channels[channelId] || {};
  const firsts = isPlainObject(channel.firsts) ? channel.firsts : {};
  const month = dayKey(new Date(now)).slice(0, 7);
  const monthly = (code) => {
    const at = firsts[code];
    return at && dayKey(new Date(at)).startsWith(month) ? { done: true, at } : { done: false };
  };

  return {
    channelId,
    name: channelName(source, channelId),
    login: channel.login || "",
    avatar: channel.avatar || "",
    total: row.points,
    subBonus: row.points - row.base,
    count: row.count,
    reasons: REASONS.map((reason) => ({ ...reason, ...(row.reasons[reason.code] || emptyTotals()) })),
    status: {
      CHEER: monthly("CHEER"),
      SUB_GIFT: monthly("SUB_GIFT"),
      FOLLOW: firsts.FOLLOW ? { done: true, at: firsts.FOLLOW } : { done: false },
    },
    days: daySeries(source, periodId, now, channelId),
    journal: source.journal.filter((entry) => entry.channelId === channelId).slice(0, DETAIL_JOURNAL),
    factor: Number(channel.factor) || 0,
    balance: Number.isInteger(channel.balance) ? channel.balance : null,
  };
}

/** Date du dernier gain capté, toutes chaînes confondues (0 si aucun). */
export function lastGainAt(state) {
  return Object.values((state || emptyState()).channels)
    .reduce((latest, channel) => Math.max(latest, Number(channel?.lastGainAt) || 0), 0);
}

/** Palier d'abonnement déduit du facteur (T1 : 0,2, T2 : 0,4, T3 : 1). */
export function tierFromFactor(factor) {
  const value = Number(factor) || 0;
  if (value >= 0.95) return 3;
  if (value >= 0.35) return 2;
  if (value >= 0.15) return 1;
  return 0;
}

/** Nom affichable : nom Twitch s'il est connu, sinon l'identifiant. */
export function channelName(state, channelId) {
  const channel = (state || emptyState()).channels[channelId] || {};
  return channel.displayName || channel.login || `#${channelId}`;
}
```

- [ ] **Étape 4 : déclarer le module ES dans ESLint**

Dans `eslint.config.mjs`, ajouter `"js/points-data.js",` juste après `"js/points-bonus.js",` dans la liste des modules ES.

- [ ] **Étape 5 : lancer les tests, ils doivent passer**

Lancer : `node --test tests/points-data.test.mjs && npx eslint js/points-data.js tests/points-data.test.mjs`
Attendu : tous les tests passent, aucune erreur de lint.

- [ ] **Étape 6 : commit**

```bash
git add js/points-data.js tests/points-data.test.mjs eslint.config.mjs
git commit -m "feat(points): module pur d'agrégation des gains de points de chaîne"
```

---

### Tâche 2 : capture sur Twitch (pont, relais, manifeste, préférence)

**Fichiers :**
- Créer : `js/inject/points-bridge.js`, `js/pointsRecorder.js`, `tests/points-bridge.test.mjs`
- Modifier : `manifest.json` (content scripts), `js/preferences-data.js:36` (après `watchTimeTracker`), `js/background.js:689` (dans `PreferenceStore.sanitize`)

**Interfaces :**
- Produit : message `window.postMessage({ source: "streampulse:points", v: 1, data }, location.origin)`, où `data` est la charge `points-earned` (celle qu'attend `normalizeGain`) ; le relais répond `{ source: "streampulse:points:ready" }`.
- Produit : `chrome.runtime.sendMessage({ type: "recordPointsGain", data })` (consommé par la tâche 3).
- Produit : préférence `pointsTracking` (booléen, vrai par défaut).

- [ ] **Étape 1 : écrire le test du pont**

<!-- fichier: tests/points-bridge.test.mjs -->
```js
/**
 * Le pont tourne dans la page Twitch : on le charge dans un bac à sable avec
 * un faux WebSocket, puis on lui envoie les messages tels que Twitch les reçoit.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("../js/inject/points-bridge.js", import.meta.url), "utf8");
const ORIGIN = "https://www.twitch.tv";

const pointsEarned = {
  type: "points-earned",
  data: {
    timestamp: "2026-09-26T19:47:12.3Z",
    channel_id: "123",
    point_gain: { channel_id: "123", total_points: 12, baseline_points: 10, reason_code: "WATCH", multipliers: [{ reason_code: "SUB_T1", factor: 0.2 }] },
    balance: { channel_id: "123", balance: 23410 },
  },
};

/** Enveloppe Hermes relevée sur twitch.tv le 2026-09-26. */
const hermes = (inner) => JSON.stringify({
  notification: { subscription: { id: "abc" }, type: "pubsub", pubsub: JSON.stringify(inner) },
  id: "msg-1",
  type: "notification",
  timestamp: "2026-09-26T19:47:12.4Z",
});

/** Enveloppe de l'ancien PubSub. */
const pubsub = (inner) => JSON.stringify({
  type: "MESSAGE",
  data: { topic: "community-points-user-v1.999", message: JSON.stringify(inner) },
});

function sandbox() {
  class FakeWebSocket {
    static OPEN = 1;
    constructor(url) {
      this.url = url;
      this.listeners = [];
    }
    addEventListener(type, listener) {
      if (type === "message") this.listeners.push(listener);
    }
    receive(data) {
      this.listeners.forEach((listener) => listener({ data }));
    }
  }
  const posted = [];
  const pageListeners = [];
  const win = {
    WebSocket: FakeWebSocket,
    postMessage: (message, origin) => posted.push({ message, origin }),
    addEventListener: (type, listener) => {
      if (type === "message") pageListeners.push(listener);
    },
  };
  win.top = win;
  new Function("window", "location", SOURCE)(win, { origin: ORIGIN });
  const ready = () => pageListeners.forEach((listener) => listener({ source: win, data: { source: "streampulse:points:ready" } }));
  return { win, posted, ready, FakeWebSocket };
}

test("un gain reçu par Hermes est transmis une fois", () => {
  const { win, posted, ready } = sandbox();
  ready();
  const socket = new win.WebSocket("wss://hermes.twitch.tv/v1");
  socket.receive(hermes(pointsEarned));
  assert.equal(posted.length, 1);
  assert.deepEqual(posted[0].message, { source: "streampulse:points", v: 1, data: pointsEarned.data });
  assert.equal(posted[0].origin, ORIGIN);
});

test("un gain reçu par l'ancien PubSub est transmis aussi", () => {
  const { win, posted, ready } = sandbox();
  ready();
  new win.WebSocket("wss://pubsub-edge.twitch.tv/v1").receive(pubsub(pointsEarned));
  assert.equal(posted.length, 1);
  assert.equal(posted[0].message.data.point_gain.reason_code, "WATCH");
});

test("les autres messages sont ignorés", () => {
  const { win, posted, ready } = sandbox();
  ready();
  const socket = new win.WebSocket("wss://hermes.twitch.tv/v1");
  socket.receive(hermes({ type: "viewcount", viewers: 35271 }));
  socket.receive('{"type":"keepalive"}');
  socket.receive("pas du json mais points-earned quand même");
  socket.receive(new ArrayBuffer(8));
  assert.equal(posted.length, 0);
});

test("les gains reçus avant le relais sont gardés puis transmis", () => {
  const { win, posted, ready } = sandbox();
  const socket = new win.WebSocket("wss://hermes.twitch.tv/v1");
  socket.receive(hermes(pointsEarned));
  assert.equal(posted.length, 0);
  ready();
  assert.equal(posted.length, 1);
});

test("Twitch garde ses propres écouteurs et un vrai WebSocket", () => {
  const { win, FakeWebSocket } = sandbox();
  const socket = new win.WebSocket("wss://hermes.twitch.tv/v1");
  const seen = [];
  socket.addEventListener("message", (event) => seen.push(event.data));
  socket.receive("bonjour");
  assert.deepEqual(seen, ["bonjour"]);
  assert.ok(socket instanceof FakeWebSocket);
  assert.ok(socket instanceof win.WebSocket);
  assert.equal(win.WebSocket.OPEN, 1);
});
```

- [ ] **Étape 2 : lancer le test, il doit échouer**

Lancer : `node --test tests/points-bridge.test.mjs`
Attendu : échec, `ENOENT` sur `js/inject/points-bridge.js`.

- [ ] **Étape 3 : écrire le pont**

<!-- fichier: js/inject/points-bridge.js -->
```js
// Pont du suivi des points, exécuté dans le monde de la page Twitch. Twitch
// reçoit chaque gain de points de chaîne par sa connexion temps réel (Hermes,
// ou l'ancien PubSub) : ce script écoute les WebSocket de la page, repère les
// messages « points-earned » et les transmet à pointsRecorder.js par
// window.postMessage. Il ne modifie rien de ce que Twitch reçoit.
(() => {
  "use strict";

  if (window.top !== window || window.__streamPulsePointsBridge) return;
  window.__streamPulsePointsBridge = true;

  const SOURCE = "streampulse:points";
  const READY = "streampulse:points:ready";
  const MARKER = "points-earned";
  const QUEUE_LIMIT = 50;
  // Hermes emballe le message PubSub dans une chaîne JSON, elle-même dans un
  // objet : il faut descendre de quatre niveaux, on en autorise six.
  const MAX_DEPTH = 6;

  let ready = false;
  const queue = [];

  /** Cherche { type: "points-earned", data } dans un message, quel que soit son emballage. */
  function findPointsEarned(value, depth) {
    if (depth > MAX_DEPTH || value === null || value === undefined) return null;
    if (typeof value === "string") {
      if (!value.includes(MARKER)) return null;
      try {
        return findPointsEarned(JSON.parse(value), depth + 1);
      } catch {
        return null;
      }
    }
    if (typeof value !== "object") return null;
    if (value.type === MARKER && value.data && typeof value.data === "object") return value.data;
    for (const key of Object.keys(value)) {
      const found = findPointsEarned(value[key], depth + 1);
      if (found) return found;
    }
    return null;
  }

  function post(data) {
    window.postMessage({ source: SOURCE, v: 1, data }, location.origin);
  }

  function emit(data) {
    if (ready) post(data);
    else if (queue.length < QUEUE_LIMIT) queue.push(data);
  }

  function onSocketMessage(event) {
    try {
      const raw = event.data;
      // Filtre bon marché : la plupart des messages ne parlent pas de points.
      if (typeof raw !== "string" || !raw.includes(MARKER)) return;
      const data = findPointsEarned(raw, 0);
      if (data) emit(data);
    } catch {
      // Ne jamais gêner la connexion de Twitch.
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.source !== READY) return;
    ready = true;
    queue.splice(0).forEach(post);
  });

  const NativeWebSocket = window.WebSocket;
  if (typeof NativeWebSocket !== "function") return;
  // Un Proxy garde instanceof, le prototype et les constantes (OPEN, CLOSED…).
  window.WebSocket = new Proxy(NativeWebSocket, {
    construct(target, args, newTarget) {
      const socket = Reflect.construct(target, args, newTarget);
      try {
        socket.addEventListener("message", onSocketMessage);
      } catch {
        // Socket inattendue : on la laisse telle quelle.
      }
      return socket;
    },
  });
})();
```

- [ ] **Étape 4 : lancer le test, il doit passer**

Lancer : `node --test tests/points-bridge.test.mjs`
Attendu : 5 tests passent.

- [ ] **Étape 5 : écrire le relais**

<!-- fichier: js/pointsRecorder.js -->
```js
// Relais du suivi des points : reçoit les gains repérés dans la page Twitch par
// inject/points-bridge.js et les transmet au service worker, qui les range.
// Rien n'est relayé si le suivi est désactivé dans les réglages.
(() => {
  "use strict";

  if (window.top !== window) return;

  const SOURCE = "streampulse:points";
  const READY = "streampulse:points:ready";
  const PREFERENCES_KEY = "betaGeneralPreferences";

  let enabled = true;

  const isEnabled = (prefs) => !prefs || prefs.pointsTracking !== false;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const message = event.data;
    if (!message || message.source !== SOURCE || message.v !== 1) return;
    if (!enabled || !message.data || typeof message.data !== "object") return;
    try {
      chrome.runtime.sendMessage({ type: "recordPointsGain", data: message.data }).catch(() => {});
    } catch {
      // Contexte d'extension invalidé par une mise à jour : ce gain est perdu.
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[PREFERENCES_KEY]) enabled = isEnabled(changes[PREFERENCES_KEY].newValue);
  });

  // Le pont garde les gains en attente jusqu'à ce signal : on ne l'envoie
  // qu'une fois la préférence connue, pour ne rien relayer à tort.
  chrome.storage.local.get([PREFERENCES_KEY], (result) => {
    enabled = chrome.runtime.lastError ? true : isEnabled(result?.[PREFERENCES_KEY]);
    window.postMessage({ source: READY }, location.origin);
  });
})();
```

- [ ] **Étape 6 : déclarer les deux scripts dans `manifest.json`**

Dans le bloc `content_scripts` qui charge `js/inject/predictions-bridge.js` (monde `MAIN`, `document_start`), ajouter le pont à la liste :

```json
      "js": [
        "js/inject/predictions-bridge.js",
        "js/inject/points-bridge.js"
      ],
```

Puis ajouter un bloc isolé juste après ce bloc MAIN :

```json
    {
      "matches": [
        "https://www.twitch.tv/*"
      ],
      "all_frames": false,
      "js": [
        "js/pointsRecorder.js"
      ],
      "run_at": "document_start"
    },
```

- [ ] **Étape 7 : ajouter la préférence**

Dans `js/preferences-data.js`, après `watchTimeTracker: true,` :

```js
  pointsTracking: true,
```

Dans `js/background.js`, dans `PreferenceStore.sanitize`, après `watchTimeTracker: preferences.watchTimeTracker !== false,` :

```js
      pointsTracking: preferences.pointsTracking !== false,
```

- [ ] **Étape 8 : vérifier**

Lancer : `node --test tests/points-bridge.test.mjs && npx eslint js/inject/points-bridge.js js/pointsRecorder.js && npm run verify`
Attendu : tests au vert ; `verify` passe, dont le contrôle « preferences survive sanitize() » qui compte une préférence de plus.

- [ ] **Étape 9 : commit**

```bash
git add js/inject/points-bridge.js js/pointsRecorder.js tests/points-bridge.test.mjs manifest.json js/preferences-data.js js/background.js
git commit -m "feat(points): capter les gains points-earned sur Twitch (Hermes et PubSub)"
```

---

### Tâche 3 : écrivain unique `js/points-store.js` et branchement du service worker

**Fichiers :**
- Créer : `js/points-store.js`, `tests/points-store.test.mjs`
- Modifier : `js/background.js` (import, résolveur Helix, store, deux messages)
- Modifier : `eslint.config.mjs` (`"js/points-store.js",` après `"js/points-data.js",`)

**Interfaces :**
- Consomme : `normalizeGain`, `addGain`, `prune`, `stateFrom`, `toStorage`, `POINTS_KEYS`, `POINTS_CHANNELS_KEY` (tâche 1).
- Produit : `createPointsStore({ storage, resolveChannels, now, log })` → `{ record(raw), resolveNames(), reset() }`.
  - `record(raw)` → `Promise<{ recorded: boolean, reason?: "invalid" | "duplicate", channelId?: string }>`
  - `resolveNames()` → `Promise<number>` (nombre de chaînes nommées)
  - `resolveChannels(ids)` → `Promise<Array<{ id, login, displayName, avatar }>>`
- Produit : messages `recordPointsGain` et `resetPoints` (consommé par la tâche 5).

- [ ] **Étape 1 : écrire les tests**

<!-- fichier: tests/points-store.test.mjs -->
```js
import test from "node:test";
import assert from "node:assert/strict";
import { createPointsStore } from "../js/points-store.js";
import { POINTS_CHANNELS_KEY, POINTS_DAILY_KEY, POINTS_JOURNAL_KEY } from "../js/points-data.js";

const NOW = new Date(2026, 8, 26, 21, 50).getTime();

function memoryStorage(initial = {}) {
  const data = structuredClone(initial);
  return {
    data,
    async get(keys) {
      const out = {};
      for (const key of [].concat(keys)) if (key in data) out[key] = structuredClone(data[key]);
      return out;
    },
    async set(values) {
      Object.assign(data, structuredClone(values));
    },
    async remove(keys) {
      for (const key of [].concat(keys)) delete data[key];
    },
  };
}

const raw = (channel, total, at = NOW, reason = "WATCH") => ({
  timestamp: new Date(at).toISOString(),
  point_gain: { channel_id: channel, total_points: total, baseline_points: total, reason_code: reason, multipliers: [] },
  balance: { balance: 1000 },
});

const silent = { warn() {} };

test("record enregistre un gain et refuse un doublon ou une charge invalide", async () => {
  const storage = memoryStorage();
  const store = createPointsStore({ storage, resolveChannels: async () => [], now: () => NOW, log: silent });
  assert.deepEqual(await store.record(raw("1", 10)), { recorded: true, channelId: "1" });
  assert.deepEqual(await store.record(raw("1", 10)), { recorded: false, reason: "duplicate" });
  assert.deepEqual(await store.record({ nope: true }), { recorded: false, reason: "invalid" });
  assert.equal(storage.data[POINTS_JOURNAL_KEY].length, 1);
});

test("deux gains simultanés sont tous les deux gardés (file sérialisée)", async () => {
  const storage = memoryStorage();
  const store = createPointsStore({ storage, resolveChannels: async () => [], now: () => NOW, log: silent });
  await Promise.all([store.record(raw("1", 10, NOW - 1)), store.record(raw("2", 50, NOW, "CLAIM"))]);
  const day = storage.data[POINTS_DAILY_KEY]["2026-09-26"];
  assert.equal(day["1"].WATCH.points, 10);
  assert.equal(day["2"].CLAIM.points, 50);
});

test("resolveNames nomme les chaînes inconnues, et survit à un échec du réseau", async () => {
  const storage = memoryStorage();
  let calls = 0;
  const store = createPointsStore({
    storage,
    resolveChannels: async (ids) => {
      calls += 1;
      if (calls === 1) throw new Error("réseau");
      return ids.map((id) => ({ id, login: `chaine${id}`, displayName: `Chaine${id}`, avatar: "https://x/a.png" }));
    },
    now: () => NOW,
    log: silent,
  });
  await store.record(raw("7", 10));
  assert.equal(await store.resolveNames(), 0);
  assert.equal(await store.resolveNames(), 1);
  assert.equal(storage.data[POINTS_CHANNELS_KEY]["7"].displayName, "Chaine7");
  assert.equal(storage.data[POINTS_CHANNELS_KEY]["7"].balance, 1000, "le reste de la fiche est gardé");
  assert.equal(await store.resolveNames(), 0, "plus rien à résoudre");
  assert.equal(calls, 2);
});

test("reset efface les trois clés", async () => {
  const storage = memoryStorage();
  const store = createPointsStore({ storage, resolveChannels: async () => [], now: () => NOW, log: silent });
  await store.record(raw("1", 10));
  await store.reset();
  assert.deepEqual(Object.keys(storage.data).filter((key) => key.startsWith("streamPulsePoints")), []);
});

test("le nettoyage des vieux gains passe au plus une fois par jour", async () => {
  const old = NOW - 90 * 86_400_000;
  const storage = memoryStorage();
  let clock = old;
  const store = createPointsStore({ storage, resolveChannels: async () => [], now: () => clock, log: silent });
  await store.record(raw("1", 10, old));
  clock = NOW;
  await store.record(raw("1", 12, NOW));
  assert.equal(storage.data[POINTS_JOURNAL_KEY].length, 1, "le gain de 90 jours sort du journal");
});
```

- [ ] **Étape 2 : lancer les tests, ils doivent échouer**

Lancer : `node --test tests/points-store.test.mjs`
Attendu : échec, `Cannot find module '../js/points-store.js'`.

- [ ] **Étape 3 : écrire le store**

<!-- fichier: js/points-store.js -->
```js
// Écrivain unique du suivi des points, côté service worker. Les gains relayés
// par pointsRecorder.js passent tous par une file : deux gains simultanés ne
// peuvent pas s'écraser. Les calculs vivent dans points-data.js ; ce module
// ne fait que lire, appliquer et écrire, puis nommer les chaînes.

import {
  POINTS_CHANNELS_KEY,
  POINTS_KEYS,
  addGain,
  normalizeGain,
  prune,
  stateFrom,
  toStorage,
} from "./points-data.js";

const PRUNED_AT_KEY = "streamPulsePointsPrunedAt";
const PRUNE_EVERY_MS = 86_400_000;
const RESOLVE_BATCH = 100;

/**
 * @param {{
 *   storage: { get(keys: string[]): Promise<object>, set(values: object): Promise<void>, remove(keys: string[]): Promise<void> },
 *   resolveChannels: (ids: string[]) => Promise<Array<{ id: string, login: string, displayName: string, avatar: string }>>,
 *   now?: () => number,
 *   log?: { warn: (...args: unknown[]) => void },
 * }} deps
 */
export function createPointsStore({ storage, resolveChannels, now = () => Date.now(), log = console }) {
  let queue = Promise.resolve();

  function enqueue(task) {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  }

  async function read() {
    const stored = await storage.get([...POINTS_KEYS, PRUNED_AT_KEY]);
    return { state: stateFrom(stored), prunedAt: Number(stored[PRUNED_AT_KEY]) || 0 };
  }

  function record(raw) {
    return enqueue(async () => {
      const clock = now();
      const gain = normalizeGain(raw, clock);
      if (!gain) return { recorded: false, reason: "invalid" };
      const { state, prunedAt } = await read();
      const added = addGain(state, gain);
      if (added === state) return { recorded: false, reason: "duplicate" };
      const due = clock - prunedAt >= PRUNE_EVERY_MS;
      const next = due ? prune(added, clock) : added;
      await storage.set({ ...toStorage(next), ...(due ? { [PRUNED_AT_KEY]: clock } : {}) });
      return { recorded: true, channelId: gain.channelId };
    });
  }

  function resolveNames() {
    return enqueue(async () => {
      const { state } = await read();
      const missing = Object.entries(state.channels)
        .filter(([, channel]) => !channel?.login)
        .map(([id]) => id)
        .slice(0, RESOLVE_BATCH);
      if (missing.length === 0) return 0;

      let users;
      try {
        users = await resolveChannels(missing);
      } catch (error) {
        log.warn("[StreamPulse] noms des chaînes de points indisponibles", error);
        return 0;
      }

      const channels = { ...state.channels };
      let named = 0;
      for (const user of Array.isArray(users) ? users : []) {
        const id = String(user?.id || "");
        if (!channels[id] || !user.login) continue;
        channels[id] = {
          ...channels[id],
          login: String(user.login),
          displayName: String(user.displayName || user.login),
          avatar: String(user.avatar || ""),
        };
        named += 1;
      }
      if (named > 0) await storage.set({ [POINTS_CHANNELS_KEY]: channels });
      return named;
    });
  }

  function reset() {
    return enqueue(() => storage.remove([...POINTS_KEYS, PRUNED_AT_KEY]));
  }

  return { record, resolveNames, reset };
}
```

- [ ] **Étape 4 : lancer les tests, ils doivent passer**

Lancer : `node --test tests/points-store.test.mjs`
Attendu : 5 tests passent.

- [ ] **Étape 5 : brancher le service worker**

Dans `js/background.js`, ajouter l'import à la suite des autres (après la ligne `import { PLUS_KEY, … } from "./plus.js";`) :

```js
import { createPointsStore } from "./points-store.js";
```

Juste avant la section `// ─── Historique des lives ───` (après la fonction de résolution des avatars), ajouter :

```js
// ─── Suivi des points de chaîne ───────────────────────────────────────────────
// Les gains arrivent de pointsRecorder.js ; points-store.js est le seul à les
// écrire. Les noms des chaînes viennent de Helix, par lots de 100 identifiants.

async function resolveTwitchChannels(ids) {
  await ensureConfig();
  const query = ids.map((id) => `id=${encodeURIComponent(id)}`).join("&");
  const data = await fetchTwitchJson(`https://api.twitch.tv/helix/users?${query}`, { headers: twitchHeaders() });
  return (data?.data || []).map((user) => ({
    id: String(user.id),
    login: user.login,
    displayName: user.display_name || user.login,
    avatar: user.profile_image_url || "",
  }));
}

const pointsStore = createPointsStore({ storage: chrome.storage.local, resolveChannels: resolveTwitchChannels });
```

Dans le `switch` des messages, juste avant `case "incrementStat":`, ajouter :

```js
    case "recordPointsGain":
      (async () => {
        try {
          const prefs = await PreferenceStore.get();
          if (prefs.pointsTracking === false) {
            sendResponse({ success: true, recorded: false });
            return;
          }
          const result = await pointsStore.record(request.data);
          sendResponse({ success: true, ...result });
          if (result.recorded) pointsStore.resolveNames().catch(() => {});
        } catch (error) {
          sendResponse({ error: error?.message || String(error) });
        }
      })();
      return true;

    case "resetPoints":
      pointsStore.reset().then(
        () => sendResponse({ success: true }),
        (error) => sendResponse({ error: error?.message || String(error) }),
      );
      return true;
```

- [ ] **Étape 6 : vérifier et committer**

Lancer : `npm test && npx eslint js/points-store.js js/background.js tests/points-store.test.mjs && npm run verify`
Attendu : tout passe.

```bash
git add js/points-store.js tests/points-store.test.mjs js/background.js eslint.config.mjs
git commit -m "feat(points): écrivain unique des gains dans le service worker, noms via Helix"
```

---

### Tâche 4 : sauvegarde des trois clés

**Fichiers :**
- Modifier : `js/backup.js` (constantes, `BACKUP_KEYS`, `cleanValue`, `mergeBackup`)
- Créer : `tests/backup-points.test.mjs`

**Interfaces :**
- Consomme : `POINTS_DAILY_KEY`, `POINTS_JOURNAL_KEY`, `POINTS_CHANNELS_KEY`, `JOURNAL_LIMIT` (tâche 1).
- Produit : les trois clés sont exportées, restaurées et fusionnées.

- [ ] **Étape 1 : écrire les tests**

<!-- fichier: tests/backup-points.test.mjs -->
```js
import test from "node:test";
import assert from "node:assert/strict";
import { BACKUP_KEYS, buildBackup, mergeBackup, parseBackup } from "../js/backup.js";
import { POINTS_CHANNELS_KEY, POINTS_DAILY_KEY, POINTS_JOURNAL_KEY } from "../js/points-data.js";

const daily = { "2026-09-26": { 123: { WATCH: { count: 2, points: 24, base: 20 } } } };
const journal = [{ key: "123|1|WATCH|12", at: 1, channelId: "123", reason: "WATCH", rawReason: "WATCH", points: 12, base: 10, factor: 0.2 }];
const channels = { 123: { login: "novastream", displayName: "Novastream", balance: 900, lastGainAt: 1 } };

test("les trois clés de points font partie de la sauvegarde", () => {
  assert.ok(BACKUP_KEYS.includes(POINTS_DAILY_KEY));
  assert.ok(BACKUP_KEYS.includes(POINTS_JOURNAL_KEY));
  assert.ok(BACKUP_KEYS.includes(POINTS_CHANNELS_KEY));
  const file = buildBackup({ [POINTS_DAILY_KEY]: daily, [POINTS_JOURNAL_KEY]: journal, [POINTS_CHANNELS_KEY]: channels }, { version: "26.9.27" });
  const parsed = parseBackup(file);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.data[POINTS_DAILY_KEY], daily);
  assert.deepEqual(parsed.data[POINTS_JOURNAL_KEY], journal);
  assert.deepEqual(parsed.data[POINTS_CHANNELS_KEY], channels);
});

test("la restauration écarte les entrées de points mal formées", () => {
  const parsed = parseBackup({
    [POINTS_DAILY_KEY]: { "pas-un-jour": {}, "2026-09-26": { abc: { WATCH: { count: 1, points: 1, base: 1 } }, 123: { WATCH: { count: "x" } } } },
    [POINTS_JOURNAL_KEY]: [...journal, { key: 5 }, null],
    [POINTS_CHANNELS_KEY]: { 123: channels[123], abc: {} },
  });
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.data[POINTS_DAILY_KEY], { "2026-09-26": {} });
  assert.deepEqual(parsed.data[POINTS_JOURNAL_KEY], journal);
  assert.deepEqual(Object.keys(parsed.data[POINTS_CHANNELS_KEY]), ["123"]);
});

test("la fusion garde le plus grand compte par jour, l'union du journal et la fiche locale", () => {
  const current = {
    [POINTS_DAILY_KEY]: { "2026-09-26": { 123: { WATCH: { count: 3, points: 36, base: 30 } } } },
    [POINTS_JOURNAL_KEY]: [{ ...journal[0], key: "123|2|WATCH|12", at: 2 }],
    [POINTS_CHANNELS_KEY]: { 123: { login: "novastream", balance: 1200 } },
  };
  const merged = mergeBackup(current, { [POINTS_DAILY_KEY]: daily, [POINTS_JOURNAL_KEY]: journal, [POINTS_CHANNELS_KEY]: channels }).data;
  assert.deepEqual(merged[POINTS_DAILY_KEY]["2026-09-26"][123].WATCH, { count: 3, points: 36, base: 30 });
  assert.deepEqual(merged[POINTS_JOURNAL_KEY].map((entry) => entry.at), [2, 1]);
  assert.equal(merged[POINTS_CHANNELS_KEY][123].balance, 1200);
  assert.equal(merged[POINTS_CHANNELS_KEY][123].displayName, "Novastream");
});
```

- [ ] **Étape 2 : lancer les tests, ils doivent échouer**

Lancer : `node --test tests/backup-points.test.mjs`
Attendu : échec sur `BACKUP_KEYS.includes(POINTS_DAILY_KEY)`.

- [ ] **Étape 3 : modifier `js/backup.js`**

En tête du fichier, avec les autres imports (ou en première ligne s'il n'y en a pas) :

```js
import { JOURNAL_LIMIT, POINTS_CHANNELS_KEY, POINTS_DAILY_KEY, POINTS_JOURNAL_KEY } from "./points-data.js";
```

Remplacer la déclaration de `BACKUP_KEYS` par :

```js
export const BACKUP_KEYS = [
  STREAMERS, PREFERENCES, STATS, WATCH_MONTHLY, WATCH_DAILY, PROFILE,
  PINNED, GROUPS, HISTORY, SMART_ALERTS, COSMETICS, ACCENT, PREDICTION_RULE,
  POINTS_DAILY_KEY, POINTS_JOURNAL_KEY, POINTS_CHANNELS_KEY,
];
```

Juste avant `function cleanValue`, ajouter :

```js
const CHANNEL_ID = /^\d{1,20}$/;
const isCount = (value) => Number.isInteger(value) && value >= 0;

function isPointsTotals(value) {
  return isPlainObject(value) && isCount(value.count) && isCount(value.points) && isCount(value.base);
}

/** Jours bien formés ; dans chacun, chaînes numériques et totaux entiers. */
function cleanPointsDaily(value) {
  const cleaned = {};
  for (const [day, channels] of Object.entries(value)) {
    if (!DAY_KEY.test(day) || !isPlainObject(channels)) continue;
    cleaned[day] = {};
    for (const [channelId, reasons] of Object.entries(channels)) {
      if (!CHANNEL_ID.test(channelId) || !isPlainObject(reasons)) continue;
      const kept = Object.fromEntries(Object.entries(reasons).filter(([, totals]) => isPointsTotals(totals)));
      if (Object.keys(kept).length) cleaned[day][channelId] = kept;
    }
  }
  return cleaned;
}

function isJournalEntry(entry) {
  return (
    isPlainObject(entry) &&
    typeof entry.key === "string" &&
    Number.isFinite(entry.at) &&
    CHANNEL_ID.test(String(entry.channelId)) &&
    typeof entry.reason === "string" &&
    isCount(entry.points)
  );
}

function cleanPointsChannels(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([id, channel]) => CHANNEL_ID.test(id) && isPlainObject(channel) && Object.keys(channel).length > 0)
  );
}

/** Pour chaque jour, chaîne et raison, garde le plus grand total : pas de double compte. */
function mergePointsDaily(current, incoming) {
  const merged = structuredClone(current);
  for (const [day, channels] of Object.entries(incoming)) {
    merged[day] = merged[day] || {};
    for (const [channelId, reasons] of Object.entries(channels)) {
      merged[day][channelId] = merged[day][channelId] || {};
      for (const [code, totals] of Object.entries(reasons)) {
        const mine = merged[day][channelId][code];
        if (!mine || totals.points > mine.points) merged[day][channelId][code] = totals;
      }
    }
  }
  return merged;
}

function mergePointsJournal(current, incoming) {
  const keys = new Set(current.map((entry) => entry.key));
  return [...current, ...incoming.filter((entry) => !keys.has(entry.key))]
    .sort((a, b) => b.at - a.at)
    .slice(0, JOURNAL_LIMIT);
}

/** La fiche locale gagne, complétée par ce que la sauvegarde sait en plus. */
function mergePointsChannels(current, incoming) {
  const merged = { ...incoming };
  for (const [id, channel] of Object.entries(current)) merged[id] = { ...(incoming[id] || {}), ...channel };
  return merged;
}
```

Dans `cleanValue`, avant `default:`, ajouter :

```js
    case POINTS_DAILY_KEY:
      return isPlainObject(value) ? cleanPointsDaily(value) : undefined;
    case POINTS_JOURNAL_KEY:
      return Array.isArray(value) ? value.filter(isJournalEntry) : undefined;
    case POINTS_CHANNELS_KEY:
      return isPlainObject(value) ? cleanPointsChannels(value) : undefined;
```

Dans `mergeBackup`, dans le `switch`, avant `default:`, ajouter :

```js
      case POINTS_DAILY_KEY:
        data[key] = mergePointsDaily(isPlainObject(now[key]) ? now[key] : {}, value);
        break;
      case POINTS_JOURNAL_KEY:
        data[key] = mergePointsJournal(Array.isArray(now[key]) ? now[key] : [], value);
        break;
      case POINTS_CHANNELS_KEY:
        data[key] = mergePointsChannels(isPlainObject(now[key]) ? now[key] : {}, value);
        break;
```

- [ ] **Étape 4 : lancer tous les tests**

Lancer : `npm test && npx eslint js/backup.js tests/backup-points.test.mjs`
Attendu : tout passe, y compris `tests/backup.test.mjs` et `tests/backup-merge.test.mjs` existants.

- [ ] **Étape 5 : commit**

```bash
git add js/backup.js tests/backup-points.test.mjs
git commit -m "feat(points): sauvegarder, restaurer et fusionner l'historique des points"
```

---

### Tâche 5 : textes des 11 langues

**Fichiers :**
- Modifier : `i18n/translations.js` (par insertion de lignes, sans resérialiser : le fichier contient des lignes vides et des commentaires qu'une resérialisation JSON effacerait)
- Script jetable, non versionné : `<scratchpad>/add-points-i18n.mjs`

**Interfaces produites** (utilisées par les tâches 6 et 7) :
- `popup.osd.menuPoints`
- `popup.points.*` : `title`, `periodLabel`, `periodToday`, `period7d`, `period30d`, `periodAll`, `unit`, `metaChannels`, `metaSubBonus`, `byChannel`, `clickHint`, `openDetail`, `empty`, `lockedBody`, `tileCount`, `subBonusTile`, `subBonusTileNote`, `back`, `balance`, `tier`, `detailSubBonus`, `tableSource`, `tableRule`, `tableCount`, `tablePoints`, `total`, `subBonusRow`, `subBonusRule`, `ruleUpTo`, `statusDone`, `statusNotYet`, `days`, `journal`, `journalEmpty`, `healthLast`, `healthNever`, `trackingTitle`, `trackingBody`, `reset`, `resetConfirm`, `resetDone`, `reasonClaim`, `reasonWatch`, `reasonStreak`, `reasonRaid`, `reasonFollow`, `reasonCheer`, `reasonSubGift`, `reasonOther`
- `recap.card.statPoints`
- `recap.plus.pointsReasons`, `pointsTimeline`, `pointsPeakDay`, `pointsPeakMonth`, `pointsBest`, `pointsSubBonus`

Ancres d'insertion, chacune présente une seule fois par bloc de langue :
- `popup.osd.menuPoints` : après la ligne `        "menuData": …`
- bloc `popup.points` : avant la ligne `      "osd": {`
- `recap.card.statPoints` : après la ligne `        "statPlatforms": …`
- clés `recap.plus.points*` : après la ligne `        "noActivity": …`

- [ ] **Étape 1 : écrire le script d'insertion**

<!-- fichier: SCRATCHPAD/add-points-i18n.mjs -->
```js
// Ajoute les textes du suivi des points aux 11 langues publiées de
// i18n/translations.js, par insertion de lignes. Idempotent.
import { readFile, writeFile } from "node:fs/promises";

const FILE = process.argv[2];
if (!FILE) throw new Error("usage : node add-points-i18n.mjs <chemin de translations.js>");

const T = {
  fr: {
    menuPoints: "Points",
    points: {
      title: "Points", periodLabel: "Période", periodToday: "Aujourd'hui", period7d: "7 jours", period30d: "30 jours", periodAll: "Tout",
      unit: "PTS", metaChannels: "Chaînes : {{count}}", metaSubBonus: "Dont +{{points}} grâce à tes abonnements",
      byChannel: "Par chaîne", clickHint: "Clique sur une chaîne pour le détail", openDetail: "Voir le détail des points sur {{name}}",
      empty: "Aucun gain de points sur cette période. Regarde un live Twitch avec StreamPulse actif : chaque gain sera compté ici.",
      lockedBody: "D'où viennent tes points ? Visionnage, bonus, raids, séries, bonus d'abonné, fiche de chaque streamer et journal des gains. Réservé à StreamPulse+.",
      tileCount: "{{count}} fois", subBonusTile: "Bonus d'abonné", subBonusTileNote: "inclus ci-dessus",
      back: "Toutes les chaînes", balance: "Solde sur la chaîne", tier: "Abonné Tier {{tier}} · ×{{factor}}",
      detailSubBonus: "Dont +{{points}} grâce à ton abonnement",
      tableSource: "D'où viennent tes points", tableRule: "Règle Twitch", tableCount: "Fois", tablePoints: "Points", total: "Total",
      subBonusRow: "dont bonus d'abonné", subBonusRule: "T1 ×1,2 · T2 ×1,4 · T3 ×2", ruleUpTo: "jusqu'à +{{points}}",
      statusDone: "fait le {{date}}", statusNotYet: "pas encore ce mois-ci",
      days: "Jour par jour", journal: "Derniers gains", journalEmpty: "Aucun gain sur cette chaîne pour l'instant.",
      healthLast: "Dernier gain capté {{ago}}.", healthNever: "Aucun gain capté pour l'instant.",
      trackingTitle: "Suivre les points gagnés", trackingBody: "Actif tant qu'un onglet Twitch est ouvert, sur toutes tes chaînes.",
      reset: "Remettre à zéro", resetConfirm: "Confirmer l'effacement", resetDone: "Historique des points effacé.",
      reasonClaim: "Bonus spéciaux", reasonWatch: "Regarder 5 minutes", reasonStreak: "Série de visionnage", reasonRaid: "Participer à un raid",
      reasonFollow: "Suivre la chaîne", reasonCheer: "1er cheer du mois", reasonSubGift: "1er sub offert du mois", reasonOther: "Autres gains",
    },
    statPoints: "Points gagnés",
    plus: {
      pointsReasons: "Points par raison", pointsTimeline: "Tes points sur la période",
      pointsPeakDay: "Jour le plus rentable : {{label}} · {{points}} points", pointsPeakMonth: "Mois le plus rentable : {{label}} · {{points}} points",
      pointsBest: "Meilleure chaîne : {{name}} · {{points}} points", pointsSubBonus: "Bonus d'abonné : +{{points}} points",
    },
  },
  en: {
    menuPoints: "Points",
    points: {
      title: "Points", periodLabel: "Period", periodToday: "Today", period7d: "7 days", period30d: "30 days", periodAll: "All",
      unit: "PTS", metaChannels: "Channels: {{count}}", metaSubBonus: "Including +{{points}} from your subs",
      byChannel: "By channel", clickHint: "Click a channel for details", openDetail: "See point details for {{name}}",
      empty: "No points earned in this period. Watch a Twitch live with StreamPulse on: every gain will be counted here.",
      lockedBody: "Where do your points come from? Watching, bonuses, raids, streaks, sub bonus, a card for each streamer and a log of every gain. StreamPulse+ only.",
      tileCount: "{{count}} times", subBonusTile: "Sub bonus", subBonusTileNote: "included above",
      back: "All channels", balance: "Channel balance", tier: "Tier {{tier}} sub · ×{{factor}}",
      detailSubBonus: "Including +{{points}} from your sub",
      tableSource: "Where your points come from", tableRule: "Twitch rule", tableCount: "Times", tablePoints: "Points", total: "Total",
      subBonusRow: "of which sub bonus", subBonusRule: "T1 ×1.2 · T2 ×1.4 · T3 ×2", ruleUpTo: "up to +{{points}}",
      statusDone: "done on {{date}}", statusNotYet: "not yet this month",
      days: "Day by day", journal: "Latest gains", journalEmpty: "No gains on this channel yet.",
      healthLast: "Last gain captured {{ago}}.", healthNever: "No gain captured yet.",
      trackingTitle: "Track points earned", trackingBody: "Active while a Twitch tab is open, across all your channels.",
      reset: "Reset", resetConfirm: "Confirm reset", resetDone: "Points history cleared.",
      reasonClaim: "Special bonuses", reasonWatch: "Watch for 5 minutes", reasonStreak: "Watch streak", reasonRaid: "Participate in a raid",
      reasonFollow: "Follow the channel", reasonCheer: "Monthly 1st cheer", reasonSubGift: "Monthly 1st gift sub", reasonOther: "Other gains",
    },
    statPoints: "Points earned",
    plus: {
      pointsReasons: "Points by source", pointsTimeline: "Your points over the period",
      pointsPeakDay: "Best day: {{label}} · {{points}} points", pointsPeakMonth: "Best month: {{label}} · {{points}} points",
      pointsBest: "Top channel: {{name}} · {{points}} points", pointsSubBonus: "Sub bonus: +{{points}} points",
    },
  },
  es: {
    menuPoints: "Puntos",
    points: {
      title: "Puntos", periodLabel: "Periodo", periodToday: "Hoy", period7d: "7 días", period30d: "30 días", periodAll: "Todo",
      unit: "PTS", metaChannels: "Canales: {{count}}", metaSubBonus: "Incluye +{{points}} gracias a tus suscripciones",
      byChannel: "Por canal", clickHint: "Haz clic en un canal para ver el detalle", openDetail: "Ver el detalle de puntos de {{name}}",
      empty: "Ningún punto ganado en este periodo. Mira un directo de Twitch con StreamPulse activo: cada ganancia se contará aquí.",
      lockedBody: "¿De dónde vienen tus puntos? Visualización, bonos, raids, rachas, bono de suscriptor, ficha de cada streamer y registro de ganancias. Solo con StreamPulse+.",
      tileCount: "{{count}} veces", subBonusTile: "Bono de suscriptor", subBonusTileNote: "incluido arriba",
      back: "Todos los canales", balance: "Saldo en el canal", tier: "Suscriptor Tier {{tier}} · ×{{factor}}",
      detailSubBonus: "Incluye +{{points}} gracias a tu suscripción",
      tableSource: "De dónde vienen tus puntos", tableRule: "Regla de Twitch", tableCount: "Veces", tablePoints: "Puntos", total: "Total",
      subBonusRow: "de ellos, bono de suscriptor", subBonusRule: "T1 ×1,2 · T2 ×1,4 · T3 ×2", ruleUpTo: "hasta +{{points}}",
      statusDone: "hecho el {{date}}", statusNotYet: "aún no este mes",
      days: "Día a día", journal: "Últimas ganancias", journalEmpty: "Todavía no hay ganancias en este canal.",
      healthLast: "Última ganancia registrada: {{ago}}.", healthNever: "Aún no se ha registrado ninguna ganancia.",
      trackingTitle: "Registrar los puntos ganados", trackingBody: "Activo mientras haya una pestaña de Twitch abierta, en todos tus canales.",
      reset: "Restablecer", resetConfirm: "Confirmar el borrado", resetDone: "Historial de puntos borrado.",
      reasonClaim: "Bonos especiales", reasonWatch: "Ver 5 minutos", reasonStreak: "Racha de visualización", reasonRaid: "Participar en un raid",
      reasonFollow: "Seguir el canal", reasonCheer: "1.er cheer del mes", reasonSubGift: "1.ª suscripción regalada del mes", reasonOther: "Otras ganancias",
    },
    statPoints: "Puntos ganados",
    plus: {
      pointsReasons: "Puntos por origen", pointsTimeline: "Tus puntos en el periodo",
      pointsPeakDay: "Mejor día: {{label}} · {{points}} puntos", pointsPeakMonth: "Mejor mes: {{label}} · {{points}} puntos",
      pointsBest: "Mejor canal: {{name}} · {{points}} puntos", pointsSubBonus: "Bono de suscriptor: +{{points}} puntos",
    },
  },
  "pt-BR": {
    menuPoints: "Pontos",
    points: {
      title: "Pontos", periodLabel: "Período", periodToday: "Hoje", period7d: "7 dias", period30d: "30 dias", periodAll: "Tudo",
      unit: "PTS", metaChannels: "Canais: {{count}}", metaSubBonus: "Inclui +{{points}} graças às suas inscrições",
      byChannel: "Por canal", clickHint: "Clique em um canal para ver os detalhes", openDetail: "Ver os detalhes de pontos de {{name}}",
      empty: "Nenhum ponto ganho neste período. Assista a uma live da Twitch com o StreamPulse ativo: cada ganho será contado aqui.",
      lockedBody: "De onde vêm seus pontos? Assistir, bônus, raids, sequências, bônus de inscrito, ficha de cada streamer e registro de ganhos. Exclusivo do StreamPulse+.",
      tileCount: "{{count}} vezes", subBonusTile: "Bônus de inscrito", subBonusTileNote: "incluído acima",
      back: "Todos os canais", balance: "Saldo no canal", tier: "Inscrito Tier {{tier}} · ×{{factor}}",
      detailSubBonus: "Inclui +{{points}} graças à sua inscrição",
      tableSource: "De onde vêm seus pontos", tableRule: "Regra da Twitch", tableCount: "Vezes", tablePoints: "Pontos", total: "Total",
      subBonusRow: "dos quais bônus de inscrito", subBonusRule: "T1 ×1,2 · T2 ×1,4 · T3 ×2", ruleUpTo: "até +{{points}}",
      statusDone: "feito em {{date}}", statusNotYet: "ainda não neste mês",
      days: "Dia a dia", journal: "Últimos ganhos", journalEmpty: "Nenhum ganho neste canal por enquanto.",
      healthLast: "Último ganho registrado: {{ago}}.", healthNever: "Nenhum ganho registrado por enquanto.",
      trackingTitle: "Registrar os pontos ganhos", trackingBody: "Ativo enquanto houver uma aba da Twitch aberta, em todos os seus canais.",
      reset: "Zerar", resetConfirm: "Confirmar a exclusão", resetDone: "Histórico de pontos apagado.",
      reasonClaim: "Bônus especiais", reasonWatch: "Assistir 5 minutos", reasonStreak: "Sequência de lives", reasonRaid: "Participar de uma raid",
      reasonFollow: "Seguir o canal", reasonCheer: "1º cheer do mês", reasonSubGift: "1º sub de presente do mês", reasonOther: "Outros ganhos",
    },
    statPoints: "Pontos ganhos",
    plus: {
      pointsReasons: "Pontos por origem", pointsTimeline: "Seus pontos no período",
      pointsPeakDay: "Melhor dia: {{label}} · {{points}} pontos", pointsPeakMonth: "Melhor mês: {{label}} · {{points}} pontos",
      pointsBest: "Melhor canal: {{name}} · {{points}} pontos", pointsSubBonus: "Bônus de inscrito: +{{points}} pontos",
    },
  },
  de: {
    menuPoints: "Punkte",
    points: {
      title: "Punkte", periodLabel: "Zeitraum", periodToday: "Heute", period7d: "7 Tage", period30d: "30 Tage", periodAll: "Alle",
      unit: "PKT", metaChannels: "Kanäle: {{count}}", metaSubBonus: "Davon +{{points}} durch deine Abos",
      byChannel: "Nach Kanal", clickHint: "Klicke auf einen Kanal für Details", openDetail: "Punktedetails für {{name}} ansehen",
      empty: "In diesem Zeitraum wurden keine Punkte verdient. Schau einen Twitch-Stream mit aktivem StreamPulse: Jeder Gewinn wird hier gezählt.",
      lockedBody: "Woher kommen deine Punkte? Zuschauen, Boni, Raids, Serien, Abo-Bonus, eine Übersicht pro Streamer und ein Protokoll aller Gewinne. Nur mit StreamPulse+.",
      tileCount: "{{count}}-mal", subBonusTile: "Abo-Bonus", subBonusTileNote: "oben enthalten",
      back: "Alle Kanäle", balance: "Kontostand im Kanal", tier: "Tier-{{tier}}-Abo · ×{{factor}}",
      detailSubBonus: "Davon +{{points}} durch dein Abo",
      tableSource: "Woher deine Punkte kommen", tableRule: "Twitch-Regel", tableCount: "Mal", tablePoints: "Punkte", total: "Gesamt",
      subBonusRow: "davon Abo-Bonus", subBonusRule: "T1 ×1,2 · T2 ×1,4 · T3 ×2", ruleUpTo: "bis zu +{{points}}",
      statusDone: "erledigt am {{date}}", statusNotYet: "diesen Monat noch nicht",
      days: "Tag für Tag", journal: "Letzte Gewinne", journalEmpty: "Noch keine Gewinne auf diesem Kanal.",
      healthLast: "Letzter erfasster Gewinn: {{ago}}.", healthNever: "Noch kein Gewinn erfasst.",
      trackingTitle: "Verdiente Punkte erfassen", trackingBody: "Aktiv, solange ein Twitch-Tab geöffnet ist, für alle deine Kanäle.",
      reset: "Zurücksetzen", resetConfirm: "Löschen bestätigen", resetDone: "Punkteverlauf gelöscht.",
      reasonClaim: "Sonderboni", reasonWatch: "5 Minuten zuschauen", reasonStreak: "Zuschauserie", reasonRaid: "An einem Raid teilnehmen",
      reasonFollow: "Dem Kanal folgen", reasonCheer: "1. Cheer des Monats", reasonSubGift: "1. verschenktes Abo des Monats", reasonOther: "Andere Gewinne",
    },
    statPoints: "Verdiente Punkte",
    plus: {
      pointsReasons: "Punkte nach Quelle", pointsTimeline: "Deine Punkte im Zeitraum",
      pointsPeakDay: "Bester Tag: {{label}} · {{points}} Punkte", pointsPeakMonth: "Bester Monat: {{label}} · {{points}} Punkte",
      pointsBest: "Top-Kanal: {{name}} · {{points}} Punkte", pointsSubBonus: "Abo-Bonus: +{{points}} Punkte",
    },
  },
  it: {
    menuPoints: "Punti",
    points: {
      title: "Punti", periodLabel: "Periodo", periodToday: "Oggi", period7d: "7 giorni", period30d: "30 giorni", periodAll: "Tutto",
      unit: "PTI", metaChannels: "Canali: {{count}}", metaSubBonus: "Di cui +{{points}} grazie ai tuoi abbonamenti",
      byChannel: "Per canale", clickHint: "Clicca su un canale per il dettaglio", openDetail: "Vedi il dettaglio dei punti di {{name}}",
      empty: "Nessun punto guadagnato in questo periodo. Guarda una live su Twitch con StreamPulse attivo: ogni guadagno verrà contato qui.",
      lockedBody: "Da dove vengono i tuoi punti? Visione, bonus, raid, serie, bonus abbonato, scheda di ogni streamer e registro dei guadagni. Solo con StreamPulse+.",
      tileCount: "{{count}} volte", subBonusTile: "Bonus abbonato", subBonusTileNote: "incluso sopra",
      back: "Tutti i canali", balance: "Saldo sul canale", tier: "Abbonato Tier {{tier}} · ×{{factor}}",
      detailSubBonus: "Di cui +{{points}} grazie al tuo abbonamento",
      tableSource: "Da dove vengono i tuoi punti", tableRule: "Regola Twitch", tableCount: "Volte", tablePoints: "Punti", total: "Totale",
      subBonusRow: "di cui bonus abbonato", subBonusRule: "T1 ×1,2 · T2 ×1,4 · T3 ×2", ruleUpTo: "fino a +{{points}}",
      statusDone: "fatto il {{date}}", statusNotYet: "non ancora questo mese",
      days: "Giorno per giorno", journal: "Ultimi guadagni", journalEmpty: "Ancora nessun guadagno su questo canale.",
      healthLast: "Ultimo guadagno registrato: {{ago}}.", healthNever: "Nessun guadagno registrato per ora.",
      trackingTitle: "Registra i punti guadagnati", trackingBody: "Attivo finché è aperta una scheda di Twitch, su tutti i tuoi canali.",
      reset: "Azzera", resetConfirm: "Conferma la cancellazione", resetDone: "Cronologia dei punti cancellata.",
      reasonClaim: "Bonus speciali", reasonWatch: "Guardare 5 minuti", reasonStreak: "Serie di visione", reasonRaid: "Partecipare a un raid",
      reasonFollow: "Seguire il canale", reasonCheer: "1º cheer del mese", reasonSubGift: "1º abbonamento regalato del mese", reasonOther: "Altri guadagni",
    },
    statPoints: "Punti guadagnati",
    plus: {
      pointsReasons: "Punti per origine", pointsTimeline: "I tuoi punti nel periodo",
      pointsPeakDay: "Giorno migliore: {{label}} · {{points}} punti", pointsPeakMonth: "Mese migliore: {{label}} · {{points}} punti",
      pointsBest: "Canale migliore: {{name}} · {{points}} punti", pointsSubBonus: "Bonus abbonato: +{{points}} punti",
    },
  },
  pl: {
    menuPoints: "Punkty",
    points: {
      title: "Punkty", periodLabel: "Okres", periodToday: "Dziś", period7d: "7 dni", period30d: "30 dni", periodAll: "Wszystko",
      unit: "PKT", metaChannels: "Kanały: {{count}}", metaSubBonus: "W tym +{{points}} dzięki subskrypcjom",
      byChannel: "Według kanału", clickHint: "Kliknij kanał, aby zobaczyć szczegóły", openDetail: "Zobacz szczegóły punktów na kanale {{name}}",
      empty: "Brak zdobytych punktów w tym okresie. Oglądaj transmisję na Twitchu z włączonym StreamPulse: każdy zysk zostanie tu policzony.",
      lockedBody: "Skąd biorą się twoje punkty? Oglądanie, bonusy, rajdy, serie, bonus subskrybenta, karta każdego streamera i dziennik zysków. Tylko w StreamPulse+.",
      tileCount: "{{count}} razy", subBonusTile: "Bonus subskrybenta", subBonusTileNote: "wliczony powyżej",
      back: "Wszystkie kanały", balance: "Saldo na kanale", tier: "Subskrypcja Tier {{tier}} · ×{{factor}}",
      detailSubBonus: "W tym +{{points}} dzięki subskrypcji",
      tableSource: "Skąd biorą się twoje punkty", tableRule: "Zasada Twitcha", tableCount: "Razy", tablePoints: "Punkty", total: "Razem",
      subBonusRow: "w tym bonus subskrybenta", subBonusRule: "T1 ×1,2 · T2 ×1,4 · T3 ×2", ruleUpTo: "do +{{points}}",
      statusDone: "zrobione {{date}}", statusNotYet: "jeszcze nie w tym miesiącu",
      days: "Dzień po dniu", journal: "Ostatnie zyski", journalEmpty: "Na tym kanale nie ma jeszcze zysków.",
      healthLast: "Ostatni zarejestrowany zysk: {{ago}}.", healthNever: "Nie zarejestrowano jeszcze żadnego zysku.",
      trackingTitle: "Rejestruj zdobyte punkty", trackingBody: "Działa, dopóki otwarta jest karta Twitcha, na wszystkich twoich kanałach.",
      reset: "Wyzeruj", resetConfirm: "Potwierdź usunięcie", resetDone: "Historia punktów usunięta.",
      reasonClaim: "Bonusy specjalne", reasonWatch: "Oglądanie przez 5 minut", reasonStreak: "Seria oglądania", reasonRaid: "Udział w rajdzie",
      reasonFollow: "Obserwowanie kanału", reasonCheer: "1. cheer w miesiącu", reasonSubGift: "1. podarowana subskrypcja w miesiącu", reasonOther: "Inne zyski",
    },
    statPoints: "Zdobyte punkty",
    plus: {
      pointsReasons: "Punkty według źródła", pointsTimeline: "Twoje punkty w okresie",
      pointsPeakDay: "Najlepszy dzień: {{label}} · {{points}} pkt", pointsPeakMonth: "Najlepszy miesiąc: {{label}} · {{points}} pkt",
      pointsBest: "Najlepszy kanał: {{name}} · {{points}} pkt", pointsSubBonus: "Bonus subskrybenta: +{{points}} pkt",
    },
  },
  tr: {
    menuPoints: "Puanlar",
    points: {
      title: "Puanlar", periodLabel: "Dönem", periodToday: "Bugün", period7d: "7 gün", period30d: "30 gün", periodAll: "Tümü",
      unit: "PUAN", metaChannels: "Kanal: {{count}}", metaSubBonus: "Aboneliklerin sayesinde +{{points}} dahil",
      byChannel: "Kanala göre", clickHint: "Ayrıntılar için bir kanala tıkla", openDetail: "{{name}} kanalının puan ayrıntılarını gör",
      empty: "Bu dönemde puan kazanılmadı. StreamPulse açıkken bir Twitch yayını izle: her kazanç burada sayılacak.",
      lockedBody: "Puanların nereden geliyor? İzleme, bonuslar, baskınlar, seriler, abone bonusu, her yayıncı için bir kart ve kazanç kaydı. Yalnızca StreamPulse+ ile.",
      tileCount: "{{count}} kez", subBonusTile: "Abone bonusu", subBonusTileNote: "yukarıya dahil",
      back: "Tüm kanallar", balance: "Kanaldaki bakiye", tier: "Tier {{tier}} abone · ×{{factor}}",
      detailSubBonus: "Aboneliğin sayesinde +{{points}} dahil",
      tableSource: "Puanların nereden geliyor", tableRule: "Twitch kuralı", tableCount: "Kez", tablePoints: "Puan", total: "Toplam",
      subBonusRow: "bunun abone bonusu", subBonusRule: "T1 ×1,2 · T2 ×1,4 · T3 ×2", ruleUpTo: "en fazla +{{points}}",
      statusDone: "{{date}} tarihinde yapıldı", statusNotYet: "bu ay henüz değil",
      days: "Gün gün", journal: "Son kazançlar", journalEmpty: "Bu kanalda henüz kazanç yok.",
      healthLast: "Son kaydedilen kazanç: {{ago}}.", healthNever: "Henüz kazanç kaydedilmedi.",
      trackingTitle: "Kazanılan puanları kaydet", trackingBody: "Bir Twitch sekmesi açık olduğu sürece tüm kanallarında etkin.",
      reset: "Sıfırla", resetConfirm: "Silmeyi onayla", resetDone: "Puan geçmişi silindi.",
      reasonClaim: "Özel bonuslar", reasonWatch: "5 dakika izleme", reasonStreak: "İzleme serisi", reasonRaid: "Baskına katılma",
      reasonFollow: "Kanalı takip etme", reasonCheer: "Ayın ilk cheer'ı", reasonSubGift: "Ayın ilk hediye aboneliği", reasonOther: "Diğer kazançlar",
    },
    statPoints: "Kazanılan puan",
    plus: {
      pointsReasons: "Kaynağa göre puanlar", pointsTimeline: "Dönem boyunca puanların",
      pointsPeakDay: "En iyi gün: {{label}} · {{points}} puan", pointsPeakMonth: "En iyi ay: {{label}} · {{points}} puan",
      pointsBest: "En iyi kanal: {{name}} · {{points}} puan", pointsSubBonus: "Abone bonusu: +{{points}} puan",
    },
  },
  ru: {
    menuPoints: "Баллы",
    points: {
      title: "Баллы", periodLabel: "Период", periodToday: "Сегодня", period7d: "7 дней", period30d: "30 дней", periodAll: "Всё",
      unit: "БАЛЛ.", metaChannels: "Каналов: {{count}}", metaSubBonus: "Из них +{{points}} благодаря подпискам",
      byChannel: "По каналам", clickHint: "Нажмите на канал, чтобы увидеть подробности", openDetail: "Подробности о баллах на канале {{name}}",
      empty: "За этот период баллы не заработаны. Смотрите трансляцию на Twitch с включённым StreamPulse: каждое начисление будет учтено здесь.",
      lockedBody: "Откуда берутся ваши баллы? Просмотр, бонусы, рейды, серии, бонус подписчика, карточка каждого стримера и журнал начислений. Только в StreamPulse+.",
      tileCount: "{{count}} раз", subBonusTile: "Бонус подписчика", subBonusTileNote: "учтён выше",
      back: "Все каналы", balance: "Баланс на канале", tier: "Подписка Tier {{tier}} · ×{{factor}}",
      detailSubBonus: "Из них +{{points}} благодаря подписке",
      tableSource: "Откуда берутся ваши баллы", tableRule: "Правило Twitch", tableCount: "Раз", tablePoints: "Баллы", total: "Итого",
      subBonusRow: "в том числе бонус подписчика", subBonusRule: "T1 ×1,2 · T2 ×1,4 · T3 ×2", ruleUpTo: "до +{{points}}",
      statusDone: "выполнено {{date}}", statusNotYet: "в этом месяце ещё нет",
      days: "По дням", journal: "Последние начисления", journalEmpty: "На этом канале пока нет начислений.",
      healthLast: "Последнее начисление: {{ago}}.", healthNever: "Начислений пока не зафиксировано.",
      trackingTitle: "Учитывать заработанные баллы", trackingBody: "Работает, пока открыта вкладка Twitch, на всех ваших каналах.",
      reset: "Сбросить", resetConfirm: "Подтвердить удаление", resetDone: "История баллов удалена.",
      reasonClaim: "Особые бонусы", reasonWatch: "Просмотр 5 минут", reasonStreak: "Серия просмотров", reasonRaid: "Участие в рейде",
      reasonFollow: "Подписка на канал", reasonCheer: "1-й чир за месяц", reasonSubGift: "1-я подаренная подписка за месяц", reasonOther: "Другие начисления",
    },
    statPoints: "Заработано баллов",
    plus: {
      pointsReasons: "Баллы по источникам", pointsTimeline: "Ваши баллы за период",
      pointsPeakDay: "Лучший день: {{label}} · {{points}} баллов", pointsPeakMonth: "Лучший месяц: {{label}} · {{points}} баллов",
      pointsBest: "Лучший канал: {{name}} · {{points}} баллов", pointsSubBonus: "Бонус подписчика: +{{points}} баллов",
    },
  },
  ja: {
    menuPoints: "ポイント",
    points: {
      title: "ポイント", periodLabel: "期間", periodToday: "今日", period7d: "7日間", period30d: "30日間", periodAll: "すべて",
      unit: "PT", metaChannels: "チャンネル数：{{count}}", metaSubBonus: "うちサブスクで +{{points}}",
      byChannel: "チャンネル別", clickHint: "チャンネルをクリックすると詳細を表示", openDetail: "{{name}} のポイント詳細を見る",
      empty: "この期間に獲得したポイントはありません。StreamPulse を有効にして Twitch の配信を視聴すると、獲得がすべてここに記録されます。",
      lockedBody: "ポイントの出どころは？視聴、ボーナス、レイド、連続視聴、サブスクボーナス、配信者ごとの詳細、獲得履歴。StreamPulse+ 限定。",
      tileCount: "{{count}} 回", subBonusTile: "サブスクボーナス", subBonusTileNote: "上記に含む",
      back: "すべてのチャンネル", balance: "チャンネルの残高", tier: "Tier {{tier}} サブスク · ×{{factor}}",
      detailSubBonus: "うちサブスクで +{{points}}",
      tableSource: "ポイントの出どころ", tableRule: "Twitch のルール", tableCount: "回数", tablePoints: "ポイント", total: "合計",
      subBonusRow: "うちサブスクボーナス", subBonusRule: "T1 ×1.2 · T2 ×1.4 · T3 ×2", ruleUpTo: "最大 +{{points}}",
      statusDone: "{{date}} に達成", statusNotYet: "今月はまだ",
      days: "日別", journal: "最近の獲得", journalEmpty: "このチャンネルではまだ獲得がありません。",
      healthLast: "最後に記録した獲得：{{ago}}", healthNever: "まだ獲得を記録していません。",
      trackingTitle: "獲得ポイントを記録", trackingBody: "Twitch のタブが開いている間、すべてのチャンネルで有効です。",
      reset: "リセット", resetConfirm: "削除を確認", resetDone: "ポイント履歴を削除しました。",
      reasonClaim: "スペシャルボーナス", reasonWatch: "5分間の視聴", reasonStreak: "連続視聴", reasonRaid: "レイドに参加",
      reasonFollow: "チャンネルをフォロー", reasonCheer: "今月初のチア", reasonSubGift: "今月初のギフトサブ", reasonOther: "その他の獲得",
    },
    statPoints: "獲得ポイント",
    plus: {
      pointsReasons: "出どころ別ポイント", pointsTimeline: "期間中のポイント",
      pointsPeakDay: "最も稼いだ日：{{label}} · {{points}} ポイント", pointsPeakMonth: "最も稼いだ月：{{label}} · {{points}} ポイント",
      pointsBest: "トップチャンネル：{{name}} · {{points}} ポイント", pointsSubBonus: "サブスクボーナス：+{{points}} ポイント",
    },
  },
  ko: {
    menuPoints: "포인트",
    points: {
      title: "포인트", periodLabel: "기간", periodToday: "오늘", period7d: "7일", period30d: "30일", periodAll: "전체",
      unit: "PT", metaChannels: "채널: {{count}}", metaSubBonus: "구독 덕분에 +{{points}} 포함",
      byChannel: "채널별", clickHint: "채널을 클릭하면 자세히 볼 수 있어요", openDetail: "{{name}} 포인트 자세히 보기",
      empty: "이 기간에 획득한 포인트가 없습니다. StreamPulse를 켠 채로 Twitch 방송을 시청하면 모든 획득이 여기에 기록됩니다.",
      lockedBody: "포인트는 어디서 왔을까요? 시청, 보너스, 레이드, 연속 시청, 구독 보너스, 스트리머별 상세, 획득 기록. StreamPulse+ 전용.",
      tileCount: "{{count}}회", subBonusTile: "구독 보너스", subBonusTileNote: "위에 포함",
      back: "모든 채널", balance: "채널 잔액", tier: "Tier {{tier}} 구독 · ×{{factor}}",
      detailSubBonus: "구독 덕분에 +{{points}} 포함",
      tableSource: "포인트 출처", tableRule: "Twitch 규칙", tableCount: "횟수", tablePoints: "포인트", total: "합계",
      subBonusRow: "그중 구독 보너스", subBonusRule: "T1 ×1.2 · T2 ×1.4 · T3 ×2", ruleUpTo: "최대 +{{points}}",
      statusDone: "{{date}} 완료", statusNotYet: "이번 달엔 아직",
      days: "일별", journal: "최근 획득", journalEmpty: "이 채널에는 아직 획득이 없습니다.",
      healthLast: "마지막 획득 기록: {{ago}}", healthNever: "아직 기록된 획득이 없습니다.",
      trackingTitle: "획득 포인트 기록", trackingBody: "Twitch 탭이 열려 있는 동안 모든 채널에서 작동합니다.",
      reset: "초기화", resetConfirm: "삭제 확인", resetDone: "포인트 기록이 삭제되었습니다.",
      reasonClaim: "스페셜 보너스", reasonWatch: "5분 시청", reasonStreak: "연속 시청", reasonRaid: "레이드 참여",
      reasonFollow: "채널 팔로우", reasonCheer: "이달의 첫 응원", reasonSubGift: "이달의 첫 구독 선물", reasonOther: "기타 획득",
    },
    statPoints: "획득 포인트",
    plus: {
      pointsReasons: "출처별 포인트", pointsTimeline: "기간 중 포인트",
      pointsPeakDay: "가장 많이 번 날: {{label}} · {{points}} 포인트", pointsPeakMonth: "가장 많이 번 달: {{label}} · {{points}} 포인트",
      pointsBest: "최고 채널: {{name}} · {{points}} 포인트", pointsSubBonus: "구독 보너스: +{{points}} 포인트",
    },
  },
};

const line = (indent, key, value, comma = true) => `${" ".repeat(indent)}${JSON.stringify(key)}: ${JSON.stringify(value)}${comma ? "," : ""}`;

const source = await readFile(FILE, "utf8");
if (source.includes('"menuPoints"')) {
  console.log("déjà présent, rien à faire");
  process.exit(0);
}
const lines = source.split("\n");
const starts = Object.keys(T).map((code) => {
  const index = lines.findIndex((l) => l === `  ${JSON.stringify(code)}: {`);
  if (index === -1) throw new Error(`bloc de langue introuvable : ${code}`);
  return { code, index };
}).sort((a, b) => a.index - b.index);

// On traite du dernier bloc au premier : les insertions ne décalent pas les blocs restants.
for (let i = starts.length - 1; i >= 0; i -= 1) {
  const { code, index } = starts[i];
  const end = i + 1 < starts.length ? starts[i + 1].index : lines.findIndex((l, k) => k > index && l === "};");
  const text = T[code];
  const find = (re) => {
    const hits = [];
    for (let k = index; k < end; k += 1) if (re.test(lines[k])) hits.push(k);
    if (hits.length !== 1) throw new Error(`${code} : ancre ${re} trouvée ${hits.length} fois`);
    return hits[0];
  };
  const noActivity = find(/^ {8}"noActivity": /);
  const statPlatforms = find(/^ {8}"statPlatforms": /);
  const osd = find(/^ {6}"osd": \{$/);
  const menuData = find(/^ {8}"menuData": /);

  const plusLines = Object.entries(text.plus).map(([k, v]) => line(8, k, v));
  const pointsEntries = Object.entries(text.points);
  const pointsBlock = [
    `      "points": {`,
    ...pointsEntries.map(([k, v], n) => line(8, k, v, n < pointsEntries.length - 1)),
    `      },`,
  ];
  // Les ancres sont traitées de la plus basse à la plus haute dans le fichier.
  const edits = [
    { at: noActivity, after: true, add: plusLines },
    { at: statPlatforms, after: true, add: [line(8, "statPoints", text.statPoints)] },
    { at: menuData, after: true, add: [line(8, "menuPoints", text.menuPoints)] },
    { at: osd, after: false, add: pointsBlock },
  ].sort((a, b) => b.at - a.at);
  for (const edit of edits) lines.splice(edit.after ? edit.at + 1 : edit.at, 0, ...edit.add);
}

await writeFile(FILE, lines.join("\n"), "utf8");
console.log(`textes ajoutés à ${starts.length} langues`);
```

- [ ] **Étape 2 : lancer le script et vérifier le fichier**

Lancer : `node <scratchpad>/add-points-i18n.mjs i18n/translations.js && node -e 'import("./i18n/translations.js").then(({translations: t}) => console.log(Object.keys(t).length, t.fr.popup.points.reasonWatch, t.ko.recap.plus.pointsBest))'`
Attendu : `textes ajoutés à 11 langues`, puis `11 Regarder 5 minutes 최고 채널: {{name}} · {{points}} 포인트`.

Si une ancre manque ou apparaît deux fois, le script s'arrête sans rien écrire : regarder la structure de la langue concernée et corriger l'ancre.

- [ ] **Étape 3 : régénérer les textes des content scripts et vérifier**

Lancer : `npm run gen:i18n-inline && npm test && npm run verify`
Attendu : `translations-integrity` au vert (mêmes clés dans les 11 langues), `verify` sans erreur.

- [ ] **Étape 4 : commit**

```bash
git add i18n/translations.js js/inject/i18n-inline.js
git commit -m "i18n(points): textes du suivi des points dans les 11 langues"
```

---

### Tâche 6 : panneau « Points » du popup

**Fichiers :**
- Créer : `js/popup-points.js`
- Modifier : `html/popup.html` (entrée de menu après `menu-tab-data`, section après `menu-data`)
- Modifier : `css/popup.css` (styles `pts-*` en fin de fichier)
- Modifier : `js/popup.js` (interrupteur `pref-points-tracking`)
- Modifier : `js/popup-features.js` (appel de `initPoints`)
- Modifier : `eslint.config.mjs` (`"js/popup-points.js",` après `"js/popup-features.js",`)

**Interfaces :**
- Consomme : `POINTS_KEYS`, `REASONS`, `REASON_LABEL_KEYS`, `stateFrom`, `summarize`, `channelDetail`, `channelName`, `lastGainAt`, `tierFromFactor` (tâche 1) ; message `resetPoints` (tâche 3) ; clés `popup.points.*` (tâche 5) ; `plusActive`, `plusListeners`, `openPlus` de `popup-features.js`.
- Produit : `initPoints({ isPlus, onPlusChange, openPlus })` → `Promise<void>`.

- [ ] **Étape 1 : ajouter l'entrée de menu et la section dans `html/popup.html`**

Juste après le bouton `menu-tab-data` (qui se termine par `<span data-i18n="popup.osd.menuData">Temps et données</span></button>`) :

```html
        <button id="menu-tab-points" class="menu-tab" type="button" role="tab" aria-selected="false" aria-controls="menu-points" data-panel="points" tabindex="-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 19 9 12 22 5 9"/><line x1="5" y1="9" x2="19" y2="9"/></svg>
          <span data-i18n="popup.osd.menuPoints">Points</span>
        </button>
```

Juste après la balise fermante de `<section class="menu-panel" id="menu-data" …>` :

```html
        <section class="menu-panel points-panel" id="menu-points" role="tabpanel" aria-labelledby="menu-tab-points" hidden>
          <div class="pts-head">
            <h2 data-i18n="popup.points.title">Points</h2>
            <div class="segmented" id="points-period" role="group" data-i18n-attr-ariaLabel="popup.points.periodLabel">
              <button type="button" class="pf-btn" aria-pressed="false" data-period="today" data-i18n="popup.points.periodToday">Aujourd'hui</button>
              <button type="button" class="pf-btn active" aria-pressed="true" data-period="7d" data-i18n="popup.points.period7d">7 jours</button>
              <button type="button" class="pf-btn" aria-pressed="false" data-period="30d" data-i18n="popup.points.period30d">30 jours</button>
              <button type="button" class="pf-btn" aria-pressed="false" data-period="all" data-i18n="popup.points.periodAll">Tout</button>
            </div>
          </div>

          <div id="points-overview">
            <div class="pts-lcd">
              <p class="pts-lcd-total"><span id="points-total">0</span><small data-i18n="popup.points.unit">PTS</small></p>
              <p class="pts-lcd-meta" id="points-meta"></p>
            </div>
            <div class="pts-tiles" id="points-reasons" hidden></div>
            <h4 class="list-caption pts-caption"><span data-i18n="popup.points.byChannel">Par chaîne</span><span class="pts-hint" id="points-click-hint" data-i18n="popup.points.clickHint" hidden>Clique sur une chaîne pour le détail</span></h4>
            <ol class="pts-list" id="points-channels"></ol>
            <p class="wt-empty-state" id="points-empty" data-i18n="popup.points.empty" hidden>Aucun gain de points sur cette période.</p>
            <div class="smart-locked" id="points-locked">
              <p class="settings-description" data-i18n="popup.points.lockedBody">D'où viennent tes points ? Réservé à StreamPulse+.</p>
              <button class="button button-primary" id="points-unlock" type="button" data-i18n="popup.smart.unlock">Débloquer</button>
            </div>
          </div>

          <div id="points-detail" hidden>
            <button class="pts-back" id="points-back" type="button"><span aria-hidden="true">‹</span> <span data-i18n="popup.points.back">Toutes les chaînes</span></button>
            <div id="points-detail-body"></div>
          </div>

          <p class="pts-health" id="points-health" role="status"></p>
          <label class="settings-toggle">
            <span class="settings-text">
              <span class="settings-title" data-i18n="popup.points.trackingTitle">Suivre les points gagnés</span>
              <span class="settings-description" data-i18n="popup.points.trackingBody">Actif tant qu'un onglet Twitch est ouvert, sur toutes tes chaînes.</span>
            </span>
            <input id="pref-points-tracking" type="checkbox" role="switch" />
          </label>
          <div class="settings-row">
            <span class="settings-description" id="points-reset-status" role="status"></span>
            <button id="btn-reset-points" class="button button-quiet" type="button" data-i18n="popup.points.reset">Remettre à zéro</button>
          </div>
        </section>
```

- [ ] **Étape 2 : écrire `js/popup-points.js`**

<!-- fichier: js/popup-points.js -->
```js
// Panneau « Points » des Réglages : points de chaîne gagnés sur Twitch. Vue
// gratuite : total par chaîne. StreamPulse+ : tuiles par raison, fiche de
// chaque streamer et journal des gains. Lit le storage, que le service worker
// alimente ; tous les calculs viennent de points-data.js.

import { t, getCurrentLanguage } from "./i18n.js";
import {
  POINTS_KEYS,
  REASONS,
  REASON_LABEL_KEYS,
  channelDetail,
  channelName,
  lastGainAt,
  stateFrom,
  summarize,
  tierFromFactor,
} from "./points-data.js";

const $ = (id) => document.getElementById(id);
const LIST_LIMIT = 25;
const JOURNAL_ROWS = 8;
const RESET_ARM_MS = 4000;
/** Gains uniques : sans gain sur la période, on montre leur état plutôt qu'un zéro. */
const STATUS_CODES = new Set(["FOLLOW", "CHEER", "SUB_GIFT"]);

let deps = { isPlus: () => false, openPlus: () => {} };
let state = stateFrom({});
let period = "7d";
let selected = null;
let resetTimer = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const locale = () => getCurrentLanguage();
const fmt = (value) => new Intl.NumberFormat(locale()).format(value);
const factorLabel = (factor) => new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(1 + factor);
const reasonLabel = (code) => t(REASON_LABEL_KEYS[code] || REASON_LABEL_KEYS.OTHER);

function dayLabel(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d || 1).toLocaleDateString(locale(), { day: "numeric", month: "short" });
}

function dateLabel(at) {
  return new Date(at).toLocaleDateString(locale(), { day: "numeric", month: "short" });
}

function whenLabel(at, now) {
  const sameDay = new Date(at).toDateString() === new Date(now).toDateString();
  return sameDay
    ? new Date(at).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })
    : dateLabel(at);
}

function agoLabel(at, now) {
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: "auto" });
  const minutes = Math.round((at - now) / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

function avatar(channelId) {
  const name = channelName(state, channelId);
  const initial = name.replace(/^#/, "").charAt(0).toUpperCase() || "?";
  const wrap = el("span", "pts-avatar");
  const url = state.channels[channelId]?.avatar;
  if (url) {
    const img = el("img");
    img.src = url;
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => {
      img.remove();
      wrap.textContent = initial;
    };
    wrap.append(img);
  } else {
    wrap.textContent = initial;
  }
  return wrap;
}

/** Barre empilée : un segment coloré par raison, à la part de chaque raison. */
function stackBar(reasons, total) {
  const bar = el("span", "pts-stack");
  for (const reason of REASONS) {
    const points = reasons?.[reason.code]?.points || 0;
    if (!points || !total) continue;
    const segment = el("i");
    segment.dataset.reason = reason.code;
    segment.style.width = `${(points / total) * 100}%`;
    bar.append(segment);
  }
  return bar;
}

function lcdBlock(total, meta) {
  const block = el("div", "pts-lcd");
  const value = el("p", "pts-lcd-total");
  value.append(el("span", null, fmt(total)), el("small", null, t("popup.points.unit")));
  const metaLine = el("p", "pts-lcd-meta");
  meta.filter(Boolean).forEach((text) => metaLine.append(el("span", null, text)));
  block.append(value, metaLine);
  return block;
}

// ─── Vue d'ensemble ────────────────────────────────────────────────────────────

function renderTiles(summary) {
  const tiles = summary.byReason
    .filter((reason) => reason.code !== "OTHER" || reason.points > 0)
    .map((reason) => {
      const tile = el("div", reason.points > 0 ? "pts-tile" : "pts-tile is-zero");
      const label = el("span", "pts-tile-label", reasonLabel(reason.code));
      label.dataset.reason = reason.code;
      tile.append(label, el("b", null, fmt(reason.points)), el("span", "pts-tile-note", reason.count ? t("popup.points.tileCount", { count: fmt(reason.count) }) : "—"));
      return tile;
    });
  if (summary.subBonus > 0) {
    const tile = el("div", "pts-tile is-sub");
    tile.append(el("span", "pts-tile-label", t("popup.points.subBonusTile")), el("b", null, `+${fmt(summary.subBonus)}`), el("span", "pts-tile-note", t("popup.points.subBonusTileNote")));
    tiles.push(tile);
  }
  $("points-reasons").replaceChildren(...tiles);
}

function renderChannels(summary, plus) {
  const max = summary.byChannel[0]?.points || 0;
  $("points-channels").replaceChildren(
    ...summary.byChannel.slice(0, LIST_LIMIT).map((row, index) => {
      const name = channelName(state, row.channelId);
      const track = el("span", "pts-track");
      const fill = plus ? stackBar(row.reasons, row.points) : el("span", "pts-fill");
      fill.style.width = `${max ? Math.max(3, (row.points / max) * 100) : 0}%`;
      track.append(fill);
      const cells = [
        el("span", "pts-rank", String(index + 1).padStart(2, "0")),
        avatar(row.channelId),
        el("span", "pts-name", name),
        track,
        el("span", "pts-value", fmt(row.points)),
      ];
      const item = el("li");
      if (plus) {
        const button = el("button", "pts-row");
        button.type = "button";
        button.dataset.channel = row.channelId;
        button.setAttribute("aria-label", t("popup.points.openDetail", { name }));
        button.append(...cells, el("span", "pts-chevron", "›"));
        item.append(button);
      } else {
        const line = el("div", "pts-row");
        line.append(...cells);
        item.append(line);
      }
      return item;
    }),
  );
}

function renderOverview(now, plus) {
  const summary = summarize(state, period, now);
  const empty = summary.total === 0;
  $("points-total").textContent = fmt(summary.total);
  const meta = [t("popup.points.metaChannels", { count: fmt(summary.channelCount) })];
  if (plus && summary.subBonus > 0) meta.push(t("popup.points.metaSubBonus", { points: fmt(summary.subBonus) }));
  $("points-meta").replaceChildren(...meta.map((text) => el("span", null, text)));
  $("points-empty").hidden = !empty;
  $("points-reasons").hidden = !plus || empty;
  $("points-click-hint").hidden = !plus || empty;
  $("points-locked").hidden = plus;
  if (plus && !empty) renderTiles(summary);
  renderChannels(summary, plus);
}

// ─── Fiche d'une chaîne (StreamPulse+) ─────────────────────────────────────────

function statusBadge(code, detail) {
  const status = detail.status[code];
  if (status?.done) return el("span", "pts-status is-done", t("popup.points.statusDone", { date: dateLabel(status.at) }));
  if (code === "FOLLOW") return el("span", "pts-status", "—");
  return el("span", "pts-status is-open", t("popup.points.statusNotYet"));
}

function ruleLabel(reason) {
  if (!reason.rule) return "—";
  return reason.upTo ? t("popup.points.ruleUpTo", { points: fmt(reason.rule) }) : `+${fmt(reason.rule)}`;
}

function reasonTable(detail) {
  const table = el("table", "pts-table");
  const head = el("tr");
  [["popup.points.tableSource", ""], ["popup.points.tableRule", ""], ["popup.points.tableCount", "n"], ["popup.points.tablePoints", "n"]]
    .forEach(([key, className]) => head.append(el("th", className, t(key))));
  head.append(el("th"));
  const thead = el("thead");
  thead.append(head);

  const rows = detail.reasons
    .filter((reason) => reason.code !== "OTHER" || reason.count > 0)
    .map((reason) => {
      const row = el("tr", reason.count ? "" : "is-muted");
      const label = el("td", "pts-reason", reasonLabel(reason.code));
      label.dataset.reason = reason.code;
      const extra = el("td");
      if (!reason.count && STATUS_CODES.has(reason.code)) {
        extra.append(statusBadge(reason.code, detail));
      } else if (reason.count) {
        const bar = el("span", "pts-minibar");
        const fill = el("i");
        fill.dataset.reason = reason.code;
        fill.style.width = `${detail.total ? Math.max(4, (reason.points / detail.total) * 100) : 0}%`;
        bar.append(fill);
        extra.append(bar);
      }
      row.append(label, el("td", "pts-rule", ruleLabel(reason)), el("td", "n", reason.count ? fmt(reason.count) : "—"), el("td", "n pts-points", fmt(reason.points)), extra);
      return row;
    });

  if (detail.subBonus > 0) {
    const row = el("tr", "is-sub");
    row.append(el("td", "pts-reason", t("popup.points.subBonusRow")), el("td", "pts-rule", t("popup.points.subBonusRule")), el("td"), el("td", "n pts-points", `+${fmt(detail.subBonus)}`), el("td"));
    rows.push(row);
  }
  const total = el("tr", "is-total");
  total.append(el("td", null, t("popup.points.total")), el("td"), el("td", "n", fmt(detail.count)), el("td", "n", fmt(detail.total)), el("td"));
  rows.push(total);

  const tbody = el("tbody");
  tbody.append(...rows);
  table.append(thead, tbody);
  return table;
}

function daysChart(days) {
  const block = el("div", "pts-days-block");
  block.append(el("p", "pts-subtitle", t("popup.points.days")));
  const max = Math.max(0, ...days.map((day) => day.points));
  const bars = el("div", "pts-days");
  days.forEach((day) => {
    const bar = el("i", day.points ? "" : "is-empty");
    bar.style.height = max && day.points ? `${Math.max(6, (day.points / max) * 100)}%` : "2px";
    bar.title = `${dayLabel(day.key)} · ${fmt(day.points)}`;
    bars.append(bar);
  });
  const axis = el("div", "pts-axis");
  axis.append(el("span", null, days[0] ? dayLabel(days[0].key) : ""), el("span", null, days.length ? dayLabel(days[days.length - 1].key) : ""));
  block.append(bars, axis);
  return block;
}

function journalList(journal, now) {
  const block = el("div", "pts-journal");
  block.append(el("p", "pts-subtitle", t("popup.points.journal")));
  if (!journal.length) {
    block.append(el("p", "pts-muted", t("popup.points.journalEmpty")));
    return block;
  }
  journal.slice(0, JOURNAL_ROWS).forEach((entry) => {
    const row = el("div", "pts-journal-row");
    const label = el("span", null, reasonLabel(entry.reason));
    if (entry.factor > 0) label.append(el("small", null, ` ×${factorLabel(entry.factor)}`));
    row.append(el("time", null, whenLabel(entry.at, now)), label, el("b", null, `+${fmt(entry.points)}`));
    block.append(row);
  });
  return block;
}

function renderDetail(now) {
  const detail = channelDetail(state, selected, period, now);
  const head = el("div", "pts-detail-head");
  const info = el("div", "pts-detail-info");
  info.append(el("h3", null, detail.name));
  const tier = tierFromFactor(detail.factor);
  if (tier) info.append(el("span", "pts-badge", t("popup.points.tier", { tier, factor: factorLabel(detail.factor) })));
  const balance = el("div", "pts-balance");
  if (detail.balance !== null) balance.append(el("span", null, t("popup.points.balance")), el("b", null, fmt(detail.balance)));
  head.append(avatar(selected), info, balance);

  const lcd = lcdBlock(detail.total, [detail.subBonus > 0 ? t("popup.points.detailSubBonus", { points: fmt(detail.subBonus) }) : ""]);
  const bottom = el("div", "pts-detail-bottom");
  bottom.append(daysChart(detail.days), journalList(detail.journal, now));
  $("points-detail-body").replaceChildren(head, lcd, reasonTable(detail), bottom);
}

// ─── Rendu et événements ───────────────────────────────────────────────────────

function renderHealth(now) {
  const last = lastGainAt(state);
  $("points-health").textContent = last
    ? t("popup.points.healthLast", { ago: agoLabel(last, now) })
    : t("popup.points.healthNever");
}

function syncPeriodButtons() {
  document.querySelectorAll("#points-period [data-period]").forEach((button) => {
    const active = button.dataset.period === period;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function render() {
  if (!$("menu-points")) return;
  const now = Date.now();
  const plus = deps.isPlus();
  if (!plus || (selected && !state.channels[selected])) selected = null;
  $("points-overview").hidden = Boolean(selected);
  $("points-detail").hidden = !selected;
  if (selected) renderDetail(now);
  else renderOverview(now, plus);
  renderHealth(now);
  syncPeriodButtons();
}

async function resetPoints(button) {
  // Double clic volontaire : le premier arme le bouton, le second efface.
  if (!button.dataset.armed) {
    button.dataset.armed = "1";
    button.textContent = t("popup.points.resetConfirm");
    resetTimer = setTimeout(() => {
      delete button.dataset.armed;
      button.textContent = t("popup.points.reset");
    }, RESET_ARM_MS);
    return;
  }
  clearTimeout(resetTimer);
  delete button.dataset.armed;
  button.textContent = t("popup.points.reset");
  button.disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({ type: "resetPoints" });
    if (result?.error) throw new Error(result.error);
    $("points-reset-status").textContent = t("popup.points.resetDone");
  } catch (error) {
    $("points-reset-status").textContent = error?.message || String(error);
  } finally {
    button.disabled = false;
  }
}

function bind() {
  $("points-period")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-period]");
    if (!button) return;
    period = button.dataset.period;
    render();
  });
  $("points-channels")?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-channel]");
    if (!row || !deps.isPlus()) return;
    selected = row.dataset.channel;
    render();
    $("points-back")?.focus();
    $("menu-panels")?.scrollTo({ top: 0 });
  });
  $("points-back")?.addEventListener("click", () => {
    selected = null;
    render();
  });
  $("points-unlock")?.addEventListener("click", () => deps.openPlus());
  $("btn-reset-points")?.addEventListener("click", (event) => resetPoints(event.currentTarget));
}

async function reload() {
  state = stateFrom(await chrome.storage.local.get(POINTS_KEYS));
  render();
}

export async function initPoints({ isPlus, onPlusChange, openPlus }) {
  if (!$("menu-points")) return;
  deps = { isPlus, openPlus };
  bind();
  onPlusChange(() => render());
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && POINTS_KEYS.some((key) => key in changes)) reload().catch(() => {});
  });
  await reload();
}
```

- [ ] **Étape 3 : ajouter les styles en fin de `css/popup.css`**

```css
/* ─── Panneau Points ───────────────────────────────────────────────────────── */
.points-panel [data-reason] { --reason: var(--text-3); }
.points-panel [data-reason="CLAIM"] { --reason: var(--lcd); }
.points-panel [data-reason="WATCH"] { --reason: var(--violet); }
.points-panel [data-reason="WATCH_STREAK"] { --reason: var(--star); }
.points-panel [data-reason="RAID"] { --reason: #ff8a80; }
.points-panel [data-reason="FOLLOW"] { --reason: #7fb2ff; }
.points-panel [data-reason="CHEER"] { --reason: #e0a0ff; }
.points-panel [data-reason="SUB_GIFT"] { --reason: #ffb86b; }
.pts-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.pts-head h2 { margin: 0; }
.pts-lcd { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 14px; padding: 14px 16px; border-radius: 10px; background: var(--lcd); color: var(--lcd-ink); }
.pts-lcd-total { margin: 0; font-family: var(--display); font-size: 32px; font-weight: 800; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.pts-lcd-total small { margin-left: 6px; font-size: 13px; }
.pts-lcd-meta { display: grid; gap: 2px; margin: 0; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-align: right; text-transform: uppercase; }
.pts-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 14px; }
.pts-tile { display: grid; gap: 2px; padding: 9px 10px; border-radius: 10px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--line-2); }
.pts-tile.is-zero { opacity: 0.55; }
.pts-tile.is-sub { background: var(--violet-soft); box-shadow: inset 0 0 0 1px var(--violet-line); }
.pts-tile b { font-family: var(--display); font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; }
.pts-tile-label { display: flex; align-items: center; gap: 6px; overflow: hidden; color: var(--text-2); font-size: 11px; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }
.pts-tile-label[data-reason]::before,
.pts-reason[data-reason]::before { content: ""; flex: none; width: 8px; height: 8px; border-radius: 2px; background: var(--reason); }
.pts-tile-note { color: var(--text-3); font-size: 11px; }
.pts-caption { display: flex; justify-content: space-between; gap: 8px; }
.pts-hint { color: var(--lcd); font-size: 11px; font-weight: 700; }
.pts-list { margin: 0; padding: 0; list-style: none; }
.pts-row { display: grid; grid-template-columns: 22px 24px minmax(0, 1fr) 120px 64px; align-items: center; gap: 10px; width: 100%; min-height: 40px; padding: 0 6px; border: 0; border-radius: 10px; background: transparent; box-shadow: inset 0 -1px 0 var(--line); color: var(--text); text-align: left; }
button.pts-row { grid-template-columns: 22px 24px minmax(0, 1fr) 120px 64px 10px; cursor: pointer; }
button.pts-row:hover,
button.pts-row:focus-visible { background: var(--surface-2); }
.pts-rank { color: var(--text-3); font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; }
.pts-avatar { display: grid; place-items: center; width: 24px; height: 24px; overflow: hidden; border-radius: 50%; background: var(--violet); color: var(--paper); font-size: 11px; font-weight: 800; }
.pts-avatar img { width: 100%; height: 100%; object-fit: cover; }
.pts-name { overflow: hidden; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.pts-track { height: 6px; overflow: hidden; border-radius: 3px; background: var(--line); }
.pts-fill,
.pts-stack { display: flex; height: 100%; }
.pts-fill { border-radius: 3px; background: var(--violet); }
.pts-stack i { display: block; height: 100%; background: var(--reason); }
.pts-value { font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
.pts-chevron { color: var(--text-3); }
.pts-back { display: inline-flex; gap: 4px; margin-bottom: 10px; padding: 0; border: 0; background: transparent; color: var(--violet-text); font-weight: 600; cursor: pointer; }
.pts-detail-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.pts-detail-head .pts-avatar { width: 40px; height: 40px; font-size: 16px; }
.pts-detail-info { display: grid; gap: 4px; min-width: 0; }
.pts-detail-info h3 { overflow: hidden; margin: 0; font-size: 17px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.pts-badge { justify-self: start; padding: 2px 8px; border-radius: 999px; background: var(--violet-soft); box-shadow: inset 0 0 0 1px var(--violet-line); color: var(--violet-text); font-size: 11px; font-weight: 700; }
.pts-balance { display: grid; margin-left: auto; color: var(--text-3); font-size: 11px; text-align: right; }
.pts-balance b { color: var(--lcd); font-family: var(--display); font-size: 16px; }
.pts-table { width: 100%; margin-bottom: 14px; border-collapse: collapse; font-size: 12px; }
.pts-table th { padding: 0 6px 6px; box-shadow: inset 0 -1px 0 var(--line-2); color: var(--text-3); font-size: 11px; font-weight: 600; text-align: left; }
.pts-table td { padding: 7px 6px; box-shadow: inset 0 -1px 0 var(--line); vertical-align: middle; }
.pts-table .n { text-align: right; font-variant-numeric: tabular-nums; }
.pts-reason { display: flex; align-items: center; gap: 7px; }
.pts-rule { color: var(--text-3); }
.pts-points { font-weight: 700; }
.pts-table tr.is-muted td { color: var(--text-3); }
.pts-table tr.is-muted .pts-points { font-weight: 500; }
.pts-table tr.is-sub td { color: var(--violet-text); }
.pts-table tr.is-total td { box-shadow: inset 0 1px 0 var(--line-2); font-weight: 700; }
.pts-minibar { display: inline-block; width: 64px; height: 5px; overflow: hidden; border-radius: 3px; background: var(--line); vertical-align: middle; }
.pts-minibar i { display: block; height: 100%; background: var(--reason); }
.pts-status { padding: 2px 7px; border-radius: 999px; box-shadow: inset 0 0 0 1px var(--line-2); color: var(--text-3); font-size: 11px; font-weight: 700; white-space: nowrap; }
.pts-status.is-done { background: var(--lcd-soft); box-shadow: inset 0 0 0 1px var(--lcd-line); color: var(--lcd); }
.pts-status.is-open { background: rgba(255, 210, 63, 0.12); box-shadow: inset 0 0 0 1px rgba(255, 210, 63, 0.4); color: var(--star); }
.pts-detail-bottom { display: grid; grid-template-columns: 1fr 1.15fr; gap: 16px; }
.pts-subtitle { margin: 0 0 6px; color: var(--text-2); font-size: 12px; font-weight: 600; }
.pts-days { display: flex; align-items: flex-end; gap: 4px; height: 96px; box-shadow: inset 0 -1px 0 var(--line); }
.pts-days i { flex: 1; border-radius: 3px 3px 0 0; background: var(--violet); }
.pts-days i.is-empty { background: var(--line-2); }
.pts-axis { display: flex; justify-content: space-between; margin-top: 4px; color: var(--text-3); font-size: 10.5px; }
.pts-journal-row { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 8px; padding: 5px 0; box-shadow: inset 0 -1px 0 var(--line); font-size: 12px; }
.pts-journal-row time { color: var(--text-3); font-variant-numeric: tabular-nums; }
.pts-journal-row small { color: var(--violet-text); font-weight: 600; }
.pts-journal-row b { font-variant-numeric: tabular-nums; }
.pts-muted { color: var(--text-3); font-size: 12px; }
.pts-health { margin: 16px 0 0; color: var(--text-3); font-size: 12px; }
```

- [ ] **Étape 4 : brancher l'interrupteur dans `js/popup.js`**

Après `const watchTimeToggle = document.getElementById("pref-watch-time");` :

```js
const pointsTrackingToggle = document.getElementById("pref-points-tracking");
```

Dans le rendu des préférences, juste après le bloc `if (watchTimeToggle) { watchTimeToggle.checked = prefs.watchTimeTracker !== false; }` :

```js
  if (pointsTrackingToggle) {
    pointsTrackingToggle.checked = prefs.pointsTracking !== false;
  }
```

Dans le branchement des écouteurs, juste après le bloc `if (watchTimeToggle) { watchTimeToggle.addEventListener("change", …); }` :

```js
    if (pointsTrackingToggle) {
      pointsTrackingToggle.addEventListener("change", (e) => {
        updatePreferences({ pointsTracking: e.target.checked });
      });
    }
```

- [ ] **Étape 5 : appeler `initPoints` depuis `js/popup-features.js`**

Ajouter l'import en tête :

```js
import { initPoints } from "./popup-points.js";
```

Dans `initFeatures`, juste après `renderPlus();` :

```js
  initPoints({ isPlus: plusActive, onPlusChange: (listener) => plusListeners.add(listener), openPlus })
    .catch((error) => console.warn("[popup] points init failed:", error));
```

- [ ] **Étape 6 : lint et verify**

Lancer : `npx eslint js/popup-points.js js/popup.js js/popup-features.js && npm run verify`
Attendu : aucune erreur ; `verify` vérifie que chaque clé `t("…")` utilisée existe.

- [ ] **Étape 7 : commit**

```bash
git add html/popup.html css/popup.css js/popup-points.js js/popup.js js/popup-features.js eslint.config.mjs
git commit -m "feat(points): panneau Points des Réglages, vue gratuite et fiche streamer StreamPulse+"
```

---

### Tâche 7 : récap (tuile sur l'image, section avancée)

**Fichiers :**
- Modifier : `js/recap.js`, `html/recap.html`, `css/recap.css`, `js/recap-card.js`, `js/recap-story.js`

**Interfaces :**
- Consomme : `POINTS_KEYS`, `REASON_LABEL_KEYS`, `stateFrom`, `summarizeDays`, `dayKeysForPeriod`, `daySeries`, `channelName` (tâche 1) ; `recap.card.statPoints`, `recap.plus.points*`, `popup.points.reason*` (tâche 5).
- Produit : modèle de carte enrichi de `points: { total, label } | null` et `labels.statPoints` ; les deux mises en page dessinent une troisième tuile quand `model.points` existe.

Écart assumé avec la spec : la ligne « Meilleure chaîne en points » vit dans la section avancée, pas sur l'image. Trois tuiles tiennent sur l'image ; un quatrième texte y serait illisible.

- [ ] **Étape 1 : `html/recap.html`, dans `#insights`, juste après la `div class="insights-grid"` existante**

```html
            <div class="insights-grid points-insights" id="points-insights" hidden>
              <div class="insight">
                <h3 class="insight-title" data-i18n="recap.plus.pointsReasons">Points par raison</h3>
                <ol class="cat-list" id="points-reason-list"></ol>
              </div>
              <div class="insight">
                <h3 class="insight-title" data-i18n="recap.plus.pointsTimeline">Tes points sur la période</h3>
                <div class="timeline" id="points-timeline" role="img"></div>
                <div class="timeline-axis" id="points-timeline-axis" aria-hidden="true"></div>
                <p class="timeline-peak" id="points-peak"></p>
                <p class="timeline-peak" id="points-extra"></p>
              </div>
            </div>
```

- [ ] **Étape 2 : `css/recap.css`, en fin de fichier**

```css
.points-insights { margin-top: 24px; padding-top: 20px; box-shadow: inset 0 1px 0 var(--line); }
```

- [ ] **Étape 3 : `js/recap.js`**

Ajouter l'import :

```js
import { POINTS_KEYS, REASON_LABEL_KEYS, channelName, dayKeysForPeriod, daySeries, stateFrom, summarizeDays } from "./points-data.js";
```

Remplacer `let stored = { monthly: {}, daily: {}, pseudo: "", plus: false };` par :

```js
let stored = { monthly: {}, daily: {}, pseudo: "", plus: false, points: stateFrom({}) };
```

Après la fonction `locale()`, ajouter :

```js
const formatPoints = (value) => new Intl.NumberFormat(locale()).format(value);

/** Points gagnés sur la période du récap, ou `null` s'il n'y en a aucun. */
function pointsFor(period) {
  const summary = summarizeDays(stored.points, dayKeysForPeriod(period.id, stored.points, Date.now()));
  return summary.total > 0 ? summary : null;
}
```

Dans `buildLabels`, ajouter la ligne `statPoints: t("recap.card.statPoints"),` après `statPlatforms: …`.

Dans `renderPeriod`, remplacer `renderInsights(period, recap);` par :

```js
  const points = pointsFor(period);
  renderInsights(period, recap, points);
```

et remplacer `currentRecap = { ...recap, labels: buildLabels(period), periodTitle: periodTitle(period) };` par :

```js
  currentRecap = {
    ...recap,
    points: points ? { total: points.total, label: `+${formatPoints(points.total)}` } : null,
    labels: buildLabels(period),
    periodTitle: periodTitle(period),
  };
```

Remplacer `renderCategories` et `renderTimeline` par ces fonctions, qui servent aussi aux points :

```js
function barItem(nameText, valueText, ratio) {
  const item = document.createElement("li");
  const name = document.createElement("span");
  name.className = "cat-name";
  name.textContent = nameText;
  name.title = nameText;
  const value = document.createElement("span");
  value.className = "cat-time";
  value.textContent = valueText;
  const bar = document.createElement("span");
  bar.className = "cat-bar";
  const fill = document.createElement("i");
  fill.style.width = `${Math.max(3, ratio * 100)}%`;
  bar.append(fill);
  item.append(name, value, bar);
  return item;
}

function renderCategories(categories) {
  const list = document.getElementById("cat-list");
  if (!categories.length) {
    const empty = document.createElement("li");
    empty.className = "cat-empty";
    empty.textContent = t("recap.plus.noCategories");
    list.replaceChildren(empty);
    return;
  }
  const max = categories[0].seconds || 1;
  list.replaceChildren(
    ...categories.map((category) =>
      barItem(category.name, `${formatDuration(category.seconds)} · ${Math.round(category.share * 100)} %`, category.seconds / max),
    ),
  );
}

/** Barres d'une période : une par jour, ou une par mois pour une année. */
function renderBars({ hostId, axisId, peakId }, series, period, { valueOf, format, peakParams, peakKeys, emptyKey }) {
  const host = document.getElementById(hostId);
  const axis = document.getElementById(axisId);
  const peakEl = document.getElementById(peakId);
  const max = Math.max(0, ...series.map(valueOf));
  host.replaceChildren(
    ...series.map((point) => {
      const value = valueOf(point);
      const bar = document.createElement("span");
      bar.className = value > 0 ? "tl-bar" : "tl-bar is-empty";
      bar.style.height = max > 0 && value > 0 ? `${Math.max(4, (value / max) * 100)}%` : "2px";
      bar.title = `${pointLabel(point.key, "long")} · ${format(value)}`;
      return bar;
    }),
  );
  axis.replaceChildren(
    ...[series[0], series[series.length - 1]].map((point) => {
      const label = document.createElement("span");
      label.textContent = point ? pointLabel(point.key, "short") : "";
      return label;
    }),
  );
  const peak = series.reduce((best, point) => (valueOf(point) > (best ? valueOf(best) : 0) ? point : best), null);
  const summary = peak
    ? t(period.kind === "year" ? peakKeys.month : peakKeys.day, { label: pointLabel(peak.key, "long"), ...peakParams(valueOf(peak)) })
    : t(emptyKey);
  peakEl.textContent = summary;
  host.setAttribute("aria-label", summary);
}

function renderTimeline(points, period) {
  renderBars({ hostId: "timeline", axisId: "timeline-axis", peakId: "timeline-peak" }, points, period, {
    valueOf: (point) => point.seconds,
    format: formatDuration,
    peakParams: (seconds) => ({ time: formatDuration(seconds) }),
    peakKeys: { day: "recap.plus.peakDay", month: "recap.plus.peakMonth" },
    emptyKey: "recap.plus.noActivity",
  });
}

function renderPointsInsights(period, points) {
  const host = document.getElementById("points-insights");
  if (!host) return;
  show(host, Boolean(points));
  if (!points) return;
  const reasons = points.byReason.filter((reason) => reason.points > 0).sort((a, b) => b.points - a.points);
  const max = reasons[0]?.points || 1;
  document.getElementById("points-reason-list").replaceChildren(
    ...reasons.map((reason) =>
      barItem(
        t(REASON_LABEL_KEYS[reason.code]),
        `${formatPoints(reason.points)} · ${Math.round((reason.points / points.total) * 100)} %`,
        reason.points / max,
      ),
    ),
  );
  renderBars({ hostId: "points-timeline", axisId: "points-timeline-axis", peakId: "points-peak" }, daySeries(stored.points, period.id), period, {
    valueOf: (point) => point.points,
    format: formatPoints,
    peakParams: (value) => ({ points: formatPoints(value) }),
    peakKeys: { day: "recap.plus.pointsPeakDay", month: "recap.plus.pointsPeakMonth" },
    emptyKey: "recap.plus.noActivity",
  });
  const best = points.byChannel[0];
  const extra = [t("recap.plus.pointsBest", { name: channelName(stored.points, best.channelId), points: formatPoints(best.points) })];
  if (points.subBonus > 0) extra.push(t("recap.plus.pointsSubBonus", { points: formatPoints(points.subBonus) }));
  document.getElementById("points-extra").textContent = extra.join(" · ");
}
```

Remplacer `renderInsights` par :

```js
function renderInsights(period, recap, points) {
  show(insightsLockedEl, !stored.plus && !recap.isEmpty);
  show(insightsEl, stored.plus && !recap.isEmpty);
  if (!stored.plus || recap.isEmpty) return;
  renderCategories(recap.categories);
  renderTimeline(buildTimeline(stored.monthly, stored.daily, period.id), period);
  renderPointsInsights(period, points);
}
```

Dans `readStorage`, lire aussi les points :

```js
async function readStorage() {
  const data = await chrome.storage.local.get([WATCH_TIME_KEY, WATCH_TIME_DAILY_KEY, PREFERENCES_KEY, PLUS_KEY, ...POINTS_KEYS]);
  const prefs = data[PREFERENCES_KEY] || {};
  return {
    monthly: data[WATCH_TIME_KEY] || {},
    daily: data[WATCH_TIME_DAILY_KEY] || {},
    pseudo: typeof prefs.pseudo === "string" ? prefs.pseudo.trim().slice(0, 40) : "",
    plus: isPlusActive(data[PLUS_KEY]),
    points: stateFrom(data),
  };
}
```

- [ ] **Étape 4 : troisième tuile sur l'image, `js/recap-card.js`**

Ajouter `LCD,` à l'import depuis `./recap-draw.js`. Dans `drawLeftColumn`, remplacer le bloc des tuiles par :

```js
  // Deux tuiles, trois quand la période compte des points de chaîne.
  const tileY = 500;
  const tileH = 128;
  const tiles = [
    { label: labels.statChannels, value: String(model.streamerCount) },
    { label: labels.statTop, value: model.top[0]?.channel || "—" },
    ...(model.points ? [{ label: labels.statPoints, value: model.points.label, color: LCD }] : []),
  ];
  const tileW = (maxWidth - 20 * (tiles.length - 1)) / tiles.length;
  tiles.forEach((tile, i) => {
    const x = PAD + i * (tileW + 20);
    drawPanel(ctx, x, tileY, tileW, tileH, 16);
    ctx.fillStyle = FAINT;
    setFont(ctx, 700, 16, MONO);
    ctx.fillText(fitText(ctx, tile.label.toUpperCase(), tileW - 48), x + 24, tileY + 42);
    ctx.fillStyle = tile.color || INK;
    setFittedFont(ctx, tile.value, tileW - 48, 800, 44, DISPLAY);
    ctx.fillText(fitText(ctx, tile.value, tileW - 48), x + 24, tileY + 100);
  });
```

- [ ] **Étape 5 : même chose en 9:16, `js/recap-story.js`**

Ajouter `LCD,` à l'import depuis `./recap-draw.js`. Remplacer le corps de `drawTiles` par :

```js
function drawTiles(ctx, model, top) {
  const { labels } = model;
  const gap = 24;
  const h = 150;
  const tiles = [
    { label: labels.statChannels, value: String(model.streamerCount) },
    { label: labels.statTop, value: model.top[0]?.channel || "—" },
    ...(model.points ? [{ label: labels.statPoints, value: model.points.label, color: LCD }] : []),
  ];
  const w = (CONTENT_W - gap * (tiles.length - 1)) / tiles.length;
  tiles.forEach((tile, i) => {
    const x = LEFT + i * (w + gap);
    drawPanel(ctx, x, top, w, h, 20);
    ctx.fillStyle = FAINT;
    setFont(ctx, 700, 20, MONO);
    ctx.fillText(fitText(ctx, tile.label.toUpperCase(), w - 56), x + 28, top + 50);
    ctx.fillStyle = tile.color || INK;
    setFittedFont(ctx, tile.value, w - 56, 800, 54, DISPLAY);
    ctx.fillText(fitText(ctx, tile.value, w - 56), x + 28, top + 118);
  });
  return top + h;
}
```

- [ ] **Étape 6 : lint, tests, verify, commit**

Lancer : `npx eslint js/recap.js js/recap-card.js js/recap-story.js && npm test && npm run verify`
Attendu : tout passe.

```bash
git add js/recap.js html/recap.html css/recap.css js/recap-card.js js/recap-story.js
git commit -m "feat(points): points gagnés sur l'image du récap et section Points du récap avancé"
```

---

### Tâche 8 : banc de démo, vérification visuelle, note de version

**Fichiers :**
- Modifier : `scripts/dev/mock-chrome.js` (données de démo des points)
- Modifier : `js/changelog-data.js`, `manifest.json`, `package.json` (26.9.27)

- [ ] **Étape 1 : données de démo dans `scripts/dev/mock-chrome.js`**

Juste avant `const store = {` :

```js
  // Points de chaîne gagnés : 7 jours de démo sur les chaînes Twitch (onglet Réglages > Points).
  const pointsDaily = {};
  const pointsJournal = [];
  const pointsChannels = {};
  const pointStreamers = channels.streamers.filter((s) => s.platform === "twitch").slice(0, 5);
  pointStreamers.forEach((s, i) => {
    pointsChannels[String(1001 + i)] = {
      login: s.handle,
      displayName: s.displayName || s.handle,
      avatar: s.avatarUrl || "",
      balance: 23410 - i * 3100,
      balanceAt: now,
      lastGainAt: now - (i + 1) * 180000,
      factor: i < 2 ? 0.2 : 0,
      factorAt: now,
      firsts: i === 0 ? { CHEER: now - 2 * 86400000 } : {},
    };
  });
  for (let d = 0; d < 7; d++) {
    const date = new Date(now - d * 86400000);
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    pointsDaily[key] = {};
    pointStreamers.forEach((s, i) => {
      if ((d + i) % 4 === 3) return;
      const mult = i < 2 ? 1.2 : 1;
      const watch = 12 + ((d * 7 + i * 5) % 9);
      const claims = 3 + ((d + i) % 4);
      const reasons = {
        WATCH: { count: watch, points: Math.round(watch * 10 * mult), base: watch * 10 },
        CLAIM: { count: claims, points: Math.round(claims * 50 * mult), base: claims * 50 },
      };
      if (d === 2 && i === 0) reasons.WATCH_STREAK = { count: 1, points: 450, base: 450 };
      if (d === 1 && i === 1) reasons.RAID = { count: 1, points: 300, base: 250 };
      if (d === 4 && i === 2) reasons.FOLLOW = { count: 1, points: 300, base: 300 };
      pointsDaily[key][String(1001 + i)] = reasons;
    });
  }
  pointStreamers.slice(0, 2).forEach((s, i) => {
    for (let k = 0; k < 6; k++) {
      const at = now - (k * 4 + i + 1) * 60000;
      const reason = k % 3 === 0 ? "CLAIM" : "WATCH";
      pointsJournal.push({ key: `${1001 + i}|${at}|${reason}`, at, channelId: String(1001 + i), reason, rawReason: reason, points: reason === "CLAIM" ? 60 : 12, base: reason === "CLAIM" ? 50 : 10, factor: 0.2 });
    }
  });
  pointsJournal.sort((a, b) => b.at - a.at);
```

Dans l'objet `store`, après `streamPulseHistory: …,` :

```js
    streamPulsePointsDaily: scenario === "empty" ? {} : pointsDaily,
    streamPulsePointsJournal: scenario === "empty" ? [] : pointsJournal,
    streamPulsePointsChannels: scenario === "empty" ? {} : pointsChannels,
```

- [ ] **Étape 2 : vérifier les écrans dans le banc (Portly : `StreamPulseMain/harness`, port 5179)**

À 780×600, faire une capture de chacune de ces URL et vérifier que rien ne déborde ni ne se chevauche :
- `http://127.0.0.1:5179/scripts/dev/popup-harness.html?state=live&tab=menu&panel=points` : vue gratuite (écran LCD, liste, encart StreamPulse+).
- `…&panel=points&plus=1` : vue d'ensemble (8 tuiles, barres empilées, indication de clic).
- Même URL, puis clic sur la première chaîne : fiche (en-tête, tableau des 7 raisons, jour par jour, derniers gains).
- `…&panel=points&plus=1&theme=light` : lisibilité en thème clair.
- `…&state=empty&tab=menu&panel=points` : état vide.
- `http://127.0.0.1:5179/scripts/dev/page-harness.html?page=recap&state=live&plus=1` : troisième tuile sur l'image et section Points du récap avancé, en 16:9 puis 9:16.

Corriger ce qui déborde (largeur des tuiles, colonnes du tableau) avant de continuer.

- [ ] **Étape 3 : note de version 26.9.27**

Passer `"version"` à `"26.9.27"` dans `manifest.json` et `package.json`. En tête de `RELEASES` dans `js/changelog-data.js`, ajouter :

```js
  {
    version: "26.9.27",
    date: "2026-09-27",
    title: {
      fr: "D'où viennent tes points ?",
      en: "Where do your points come from?",
      es: "¿De dónde vienen tus puntos?",
      "pt-BR": "De onde vêm seus pontos?",
      de: "Woher kommen deine Punkte?",
      it: "Da dove vengono i tuoi punti?",
      pl: "Skąd biorą się twoje punkty?",
      tr: "Puanların nereden geliyor?",
      ru: "Откуда берутся твои баллы?",
      ja: "ポイントの出どころは？",
      ko: "포인트는 어디서 왔을까?",
    },
    changes: [
      {
        type: "new",
        text: {
          fr: "Nouveau panneau Points dans les Réglages : StreamPulse enregistre chaque point de chaîne gagné sur Twitch et te montre combien tu en as gagné sur chaque chaîne. Avec StreamPulse+, tu vois d'où ils viennent (regarder, bonus, raids, suivis, séries, cheers et subs offerts), ce que ton abonnement t'a rapporté en plus, et une fiche par streamer avec le journal de tes gains. Le récap affiche aussi tes points gagnés.",
          en: "New Points panel in Settings: StreamPulse records every channel point you earn on Twitch and shows how many you earned on each channel. With StreamPulse+, see where they come from (watching, bonuses, raids, follows, streaks, cheers and gift subs), what your sub added on top, and a card for each streamer with a log of your gains. Your recap now shows the points you earned too.",
          es: "Nuevo panel Puntos en los Ajustes: StreamPulse registra cada punto de canal que ganas en Twitch y te muestra cuántos ganaste en cada canal. Con StreamPulse+, ves de dónde vienen (ver, bonos, raids, follows, rachas, cheers y suscripciones regaladas), lo que tu suscripción añadió y una ficha por streamer con el registro de tus ganancias. El resumen también muestra tus puntos ganados.",
          "pt-BR": "Novo painel Pontos nas Configurações: o StreamPulse registra cada ponto de canal que você ganha na Twitch e mostra quantos você ganhou em cada canal. Com o StreamPulse+, você vê de onde eles vêm (assistir, bônus, raids, follows, sequências, cheers e subs de presente), o que sua inscrição rendeu a mais e uma ficha por streamer com o registro dos seus ganhos. O resumo também mostra os pontos ganhos.",
          de: "Neues Punkte-Panel in den Einstellungen: StreamPulse erfasst jeden Kanalpunkt, den du auf Twitch verdienst, und zeigt, wie viele du auf jedem Kanal verdient hast. Mit StreamPulse+ siehst du, woher sie kommen (Zuschauen, Boni, Raids, Follows, Serien, Cheers und verschenkte Abos), was dein Abo zusätzlich gebracht hat, und eine Übersicht pro Streamer mit dem Protokoll deiner Gewinne. Auch dein Rückblick zeigt jetzt deine verdienten Punkte.",
          it: "Nuovo pannello Punti nelle Impostazioni: StreamPulse registra ogni punto canale che guadagni su Twitch e mostra quanti ne hai guadagnati su ogni canale. Con StreamPulse+ vedi da dove vengono (visione, bonus, raid, follow, serie, cheer e abbonamenti regalati), quanto ti ha fruttato in più l'abbonamento e una scheda per ogni streamer con il registro dei guadagni. Anche il riepilogo mostra i punti guadagnati.",
          pl: "Nowy panel Punkty w Ustawieniach: StreamPulse zapisuje każdy punkt kanału zdobyty na Twitchu i pokazuje, ile zdobyłeś na każdym kanale. Ze StreamPulse+ widzisz, skąd pochodzą (oglądanie, bonusy, rajdy, obserwacje, serie, cheery i podarowane suby), ile dodała twoja subskrypcja oraz kartę każdego streamera z dziennikiem zysków. Podsumowanie pokazuje też zdobyte punkty.",
          tr: "Ayarlar'da yeni Puanlar paneli: StreamPulse, Twitch'te kazandığın her kanal puanını kaydeder ve her kanalda ne kadar kazandığını gösterir. StreamPulse+ ile puanların nereden geldiğini (izleme, bonuslar, baskınlar, takipler, seriler, cheer'lar ve hediye abonelikler), aboneliğinin ne kadar ekstra kazandırdığını ve kazanç kaydıyla her yayıncı için bir kartı görürsün. Özet de artık kazandığın puanları gösteriyor.",
          ru: "Новая панель «Баллы» в настройках: StreamPulse записывает каждый балл канала, заработанный на Twitch, и показывает, сколько вы получили на каждом канале. Со StreamPulse+ видно, откуда они берутся (просмотр, бонусы, рейды, подписки на канал, серии, чиры и подаренные подписки), сколько добавила ваша подписка, и карточку каждого стримера с журналом начислений. Итоги теперь тоже показывают заработанные баллы.",
          ja: "設定に新しい「ポイント」パネル：StreamPulse が Twitch で獲得したチャンネルポイントをすべて記録し、チャンネルごとの獲得数を表示します。StreamPulse+ なら、出どころ（視聴、ボーナス、レイド、フォロー、連続視聴、チア、ギフトサブ）、サブスクで上乗せされた分、配信者ごとの獲得履歴も確認できます。まとめにも獲得ポイントが表示されます。",
          ko: "설정에 새로운 포인트 패널: StreamPulse가 Twitch에서 획득한 모든 채널 포인트를 기록하고 채널별 획득량을 보여줍니다. StreamPulse+로는 출처(시청, 보너스, 레이드, 팔로우, 연속 시청, 응원, 구독 선물), 구독으로 추가된 포인트, 획득 기록이 담긴 스트리머별 카드까지 볼 수 있습니다. 요약에도 획득 포인트가 표시됩니다.",
        },
      },
    ],
    thanks: [
      {
        handle: "shiroa",
        for: {
          fr: "idée du suivi des points par chaîne",
          en: "the idea of per-channel points tracking",
          es: "la idea del registro de puntos por canal",
          "pt-BR": "a ideia do registro de pontos por canal",
          de: "die Idee der Punkteerfassung pro Kanal",
          it: "l'idea del registro dei punti per canale",
          pl: "pomysł śledzenia punktów na każdym kanale",
          tr: "kanal başına puan takibi fikri",
          ru: "идея учёта баллов по каналам",
          ja: "チャンネル別ポイント記録のアイデア",
          ko: "채널별 포인트 기록 아이디어",
        },
      },
    ],
  },
```

- [ ] **Étape 4 : tout vérifier et committer**

Lancer : `npm run build`
Attendu : lint, génération des textes, tests et zip `StreamPulseExtension_26.9.27.zip` au vert ; le zip contient `js/points-data.js`, `js/points-store.js`, `js/pointsRecorder.js`, `js/inject/points-bridge.js`, `js/popup-points.js`.

```bash
git add scripts/dev/mock-chrome.js js/changelog-data.js manifest.json package.json
git commit -m "release: 26.9.27, suivi des points de chaîne (idée de shiroa)"
```

---

### Tâche 9 : port Firefox

**Fichiers (dans `~/dev/StreampulseFirefox`) :** `manifest.json`, `js/changelog-data.js`, `package.json`, `eslint.config.mjs`, et ce que recopie `scripts/sync-from-chrome.mjs`.

- [ ] **Étape 1 : simuler puis synchroniser**

Lancer : `node scripts/sync-from-chrome.mjs`, relire la liste (attendu : les fichiers des tâches 1 à 8, rien d'autre), puis `node scripts/sync-from-chrome.mjs --write`.

- [ ] **Étape 2 : manifeste Firefox**

Ajouter `"js/inject/points-bridge.js"` au bloc MAIN qui charge `js/inject/predictions-bridge.js`, et ajouter le bloc isolé `js/pointsRecorder.js` (`document_start`, `https://www.twitch.tv/*`) comme en tâche 2. Passer la version à `26.9.27` dans `manifest.json` et `package.json`.

- [ ] **Étape 3 : note de version et ESLint**

Copier l'entrée `26.9.27` de la référence en tête de `RELEASES` du port (ce fichier n'est jamais recopié par la synchronisation). Ajouter `"js/points-data.js"`, `"js/points-store.js"` et `"js/popup-points.js"` à la liste des modules ES de `eslint.config.mjs`.

- [ ] **Étape 4 : vérifier, construire, committer**

Lancer : `npm run lint && npm test && npm run verify && npm run build`
Attendu : tout passe ; `StreampulseFirefox_26.9.27.zip` produit.

```bash
git add -A
git commit -m "release: 26.9.27, suivi des points de chaîne (portage)"
```

---

### Tâche 10 : release

- [ ] **Étape 1 : pousser les deux dépôts** (`git push origin main` dans chacun).
- [ ] **Étape 2 : demander à Alexis avant de publier.** Chrome refuse un envoi tant que la 26.9.26 est en revue ; l'état se voit à la réponse de `npm run publish:chrome`.
- [ ] **Étape 3 : publier** avec `npm run publish:edge`, `npm run publish:chrome`, `npm run publish:firefox`.
- [ ] **Étape 4 : vérification réelle.** Sur un compte Twitch, avec la version installée : regarder un live 10 minutes (attendu : deux gains « Regarder 5 minutes »), récupérer une caisse (attendu : un « Bonus spéciaux »), ouvrir deux onglets (attendu : aucun doublon). Le panneau affiche « Dernier gain capté il y a … ».
