# Onglet Badges : statuts et dates — plan d'implémentation

> **Pour l'exécution :** sous-skill requis : superpowers:executing-plans (choisi : exécution dans la
> session) ou superpowers:subagent-driven-development. Les étapes utilisent des cases `- [ ]`.

**But :** dire pour chaque badge global Twitch s'il est en cours, à venir ou terminé, avec ses vraies
dates, son coût, son objectif et sa date d'ajout, sans action de l'utilisateur.

**Architecture :** le pont de la page Twitch lit la liste des campagnes de Drops avec leurs Drops (et, à
défaut, le détail des campagnes « Twitch Gaming », 5 par minute). Le service worker relie chaque badge du
catalogue au Drop qui le donne (par le nom de la récompense BADGE, sinon par le jeu) dans un journal
`streamPulseBadgeEvents`. Le popup calcule les statuts. streampulse.fr fournit la date d'ajout de chaque
badge.

**Pile :** JavaScript ES modules (extension MV3, sans build), `node:test`, Vercel Functions (site),
Upstash Redis REST.

**Spec :** `docs/superpowers/specs/2026-10-05-badges-statuts-design.md`

## Contraintes globales

- Twitch uniquement ; aucun site tiers de badges lu ni cité.
- Voix de DESIGN.md : tutoiement, accords neutres, glossaire (« chat », « Récupération auto »…).
- 11 langues publiées : fr, en, es, pt-BR, de, it, pl, tr, ru, ja, ko. `npm run verify` fait autorité.
- Popup fixe 780×600, aucune nouvelle animation, `prefers-reduced-motion` respecté.
- Les requêtes GraphQL qui exigent l'intégrité partent uniquement du pont, dans la page ; le jeton et
  l'en-tête `Client-Integrity` ne quittent jamais la page.
- Valeurs : détail des campagnes ≤ 5 par minute, gardé 24 h ; journal gardé 60 jours après la fin ;
  terminé affiché 7 jours ; « à venir » sans campagne 30 jours ; dates du site relues toutes les 6 h ;
  cache CDN du site 10 min ; cron quotidien (plan Hobby).
- Pas de commit, de push ni de déploiement sans l'accord d'Alexis (branche `feat/badges-statuts` dans
  l'extension, `feat/badges-added` dans le site). Jamais `vercel deploy` depuis le dossier du site.
- Firefox : aucun `import()` ajouté dans un content script.

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `js/drops-data.js` | Pur : Drops détaillés, fusion des campagnes, journal des badges, statuts, catalogue |
| `js/drops-store.js` | Écrit campagnes, détail, journal, dates du site (file sérialisée) |
| `js/inject/drops-bridge.js` | Liste avec Drops, action `details`, retrait du repli Apollo |
| `js/dropsRecorder.js` | Relaie le détail demandé par le service worker, une fois par minute |
| `js/sw/messages-drops.js`, `js/sw/messages.js` | Message `recordDropsCampaignDetails` |
| `js/sw/drops.js` | `refreshBadgeAdded()` (dates de streampulse.fr) |
| `js/badge-auto-worker.js` | Catalogue du mode auto lu depuis le journal |
| `js/popup-drops.js`, `html/popup.html`, `css/popup.css` | Maquette 1 |
| `i18n/lang/*.js` (11) | 21 clés ajoutées, 2 modifiées, 3 retirées |
| `js/changelog-data.js`, `manifest.json`, `package.json` | Version 26.10.3 |
| `scripts/dev/mock-chrome.js` | Données de démo du banc |
| `tests/helpers/badges-fixtures.mjs` | Vrais badges et campagnes du 2026-10-05 |
| `tests/drops-campaign-details.test.mjs`, `tests/badge-events.test.mjs`, `tests/badge-statuses.test.mjs` | Nouveaux tests |
| `tests/drops-store.test.mjs`, `tests/drops-bridge.test.mjs`, `tests/drops-recorder.test.mjs`, `tests/drops-rewards.test.mjs`, `tests/badge-auto-worker.test.mjs` | Tests mis à jour |
| Site : `api/twitch-badges.mjs`, `api/twitch-badges-refresh.mjs`, `vercel.json` | `?added=1`, cron quotidien |

---

### Tâche 1 : Drops détaillés et fusion des campagnes (`js/drops-data.js`)

**Fichiers :**
- Créer : `tests/helpers/badges-fixtures.mjs`, `tests/drops-campaign-details.test.mjs`
- Modifier : `js/drops-data.js` (constantes en tête, `normalizeCampaign`, section Campagnes)

**Interfaces :**
- Produit : `normalizeCampaigns(rawList)` → campagnes avec `drops: Drop[] | null` et `detailedAt: 0` ;
  `Drop = { id, name, startsAt, endsAt, minutes, subs, badges: string[] }` ;
  `mergeCampaigns(previous, incoming, now)` ; `applyCampaignDetails(campaigns, details, ids, now)` ;
  `campaignsNeedingDetails(campaigns, now, max = DETAILS_PER_READ)` → `string[]` ;
  `DETAILS_PER_READ = 5`.

- [ ] **Étape 1 : fixtures partagées** — `tests/helpers/badges-fixtures.mjs` :

```js
// Vrais badges et campagnes Twitch du 2026-10-05 (catalogue GraphQL `badges` et
// page twitch.tv/drops/campaigns), réduits à ce que les tests utilisent.

export const NOW = Date.parse("2026-10-05T20:15:00Z");
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

const badgeDrop = (id, name, { start, end, minutes = 0, subs = 0 }) => ({
  id, name, startAt: start, endAt: end, requiredMinutesWatched: minutes, requiredSubs: subs,
  benefitEdges: [{ benefit: { id: `b-${id}`, name, distributionType: "BADGE" } }],
});

const campaign = (id, game, gameId, start, end, drops, extra = {}) => ({
  id, name: game, status: "ACTIVE", startAt: start, endAt: end,
  game: { id: gameId, displayName: game }, owner: { name: "Twitch Gaming" },
  ...(drops ? { timeBasedDrops: drops } : {}), ...extra,
});

export const CAMPAIGNS_RAW = [
  campaign("c-er", "ELDEN RING", "512953", "2026-10-01T07:00:00Z", "2026-10-29T06:59:00Z", [
    badgeDrop("d-er", "Bloody Finger ELDEN RING", { start: "2026-10-01T07:00:00Z", end: "2026-10-29T06:59:00Z", subs: 1 }),
  ]),
  campaign("c-sm", "Warhammer 40,000: Space Marine II", "1234", "2026-10-01T08:00:00Z", "2026-10-29T08:59:00Z", [
    badgeDrop("d-sm1", "Ultramarine", { start: "2026-10-01T08:00:00Z", end: "2026-10-29T07:59:00Z", subs: 1 }),
    { id: "d-sm2", name: "The Anniversary Update II", startAt: "2026-10-01T09:20:00Z", endAt: "2026-10-29T08:59:00Z", requiredMinutesWatched: 120, benefitEdges: [{ benefit: { id: "b-acc", name: "100 Accolades", distributionType: "DIRECT_ENTITLEMENT" } }] },
  ]),
  campaign("c-p3", "PERSONA3 RELOAD", "p3", "2026-09-24T16:00:00Z", "2026-10-11T06:58:00Z", null),
  campaign("c-ac", "ACE COMBAT 8: WINGS OF THEVE", "404069058", "2026-09-28T22:00:00Z", "2026-10-26T06:59:00Z", null),
  campaign("c-dd", "Dungeons & Dragons", "509577", "2026-09-24T01:15:00Z", "2026-10-21T06:58:00Z", [
    badgeDrop("d-d20", "d20", { start: "2026-09-24T01:15:00Z", end: "2026-10-21T06:58:00Z", minutes: 30 }),
    badgeDrop("d-amp", "Ampersand", { start: "2026-09-24T01:15:00Z", end: "2026-10-21T06:58:00Z", subs: 1 }),
  ]),
  campaign("c-rm", "REMATCH", "1362102608", "2026-09-23T23:01:00Z", "2026-10-21T22:58:00Z", [
    badgeDrop("d-rm", "Rematch Blue Lock", { start: "2026-09-23T23:01:00Z", end: "2026-10-21T22:58:00Z", minutes: 30 }),
  ]),
  campaign("c-pd", "PAYDAY 3", "1234567", "2026-09-24T12:00:00Z", "2026-10-10T11:59:00Z", [
    badgeDrop("d-dal", "Dallas", { start: "2026-09-24T12:00:00Z", end: "2026-10-10T11:59:00Z", subs: 1 }),
    badgeDrop("d-hox", "Hoxton", { start: "2026-09-24T12:00:00Z", end: "2026-10-10T11:59:00Z", minutes: 60 }),
    badgeDrop("d-wolf", "Wolf", { start: "2026-09-24T12:00:00Z", end: "2026-10-10T11:59:00Z", minutes: 90 }),
  ]),
  campaign("c-rs", "Old School RuneScape", "459931", "2026-10-03T13:00:00Z", "2026-10-04T22:59:00Z", [
    badgeDrop("d-yph", "Yellow Party Hat", { start: "2026-10-03T13:00:00Z", end: "2026-10-04T22:59:00Z", minutes: 60 }),
  ], { status: "EXPIRED" }),
  { id: "c-lol", name: "LoL", status: "ACTIVE", startAt: "2026-09-29T18:00:00Z", endAt: "2026-10-06T17:59:00Z", game: { id: "21779", displayName: "League of Legends" }, owner: { name: "Riot Games" } },
];

const badge = (setID, title, description) => ({ setID, version: "1", title, description, imageURL: `https://static-cdn.jtvnw.net/badges/v1/${setID}/3` });

export const CATALOG_RAW = {
  badges: [
    badge("bloody-finger-elden-ring", "Bloody Finger ELDEN RING", "This badge was earned by subscribing or gifting a sub to a streamer in the ELDEN RING category."),
    badge("elden-ring-recluse", "Recluse", "This badge was earned by watching a streamer in the ELDEN RING category during the launch of Nightreign."),
    badge("ultramarine", "Ultramarine", "This badge was earned by subscribing or gifting a sub to a streamer in the Space Marine 2 category during the 3rd anniversary!"),
    badge("koromaru", "Koromaru", "This badge was earned by subscribing to a streamer in the Persona 3 Reload category during the 2026 ATLUS celebration!"),
    badge("ace-combat-8-nugget", "ACE COMBAT 8 Nugget", "This badge was earned by subscribing or gifting a sub to a streamer in the ACE COMBAT 8 category during the game's launch!"),
    badge("d20", "d20", "This badge was earned by watching Dungeon Masters on Twitch."),
    badge("ampersand", "Ampersand", "This badge was earned by subscribing to a streamer in the Dungeons & Dragons category."),
    badge("rematch-blue-lock", "Rematch Blue Lock", "This badge was earned by watching a streamer in the Rematch category for 30 minutes"),
    badge("dallas", "Dallas", "This badge was earned by subscribing or gifting a sub to a streamer in the PAYDAY 3 category"),
    badge("hoxton", "Hoxton", "This badge was earned by watching a streamer in the PAYDAY 3 category for 60 minutes"),
    badge("wolf", "Wolf", "This badge was earned by watching a streamer in the PAYDAY 3 category for 90 minutes"),
    badge("vaultbreakers", "Vaultbreakers", "This badge was earned by watching a streamer in the Vaultbreakers category for 60 minutes"),
    badge("yellow-party-hat", "Yellow Party Hat", "This badge was awarded to people who viewed the official 2026 RuneFest livestream for one hour."),
    badge("clipped-that", "Clipped That", "This limited-time badge was earned by a DJ Program creator who clipped an epic mid-set moment and downloaded + shared it to social."),
    badge("twitchcon-2026---san-diego---taco", "TwitchCon 2026 - San Diego - Taco", "This badge is given to anyone who purchased a 3-day ticket to TwitchCon San Diego 2026."),
  ],
  owned: ["hoxton"],
};

/** Dates d'ajout notées par streampulse.fr (relevé du 2026-10-05). */
export const SITE_ADDED = {
  vaultbreakers: Date.parse("2026-10-05T11:39:15Z"),
  "clipped-that": Date.parse("2026-10-05T11:39:15Z"),
  "twitchcon-2026---san-diego---taco": Date.parse("2026-10-05T11:39:15Z"),
  "bloody-finger-elden-ring": Date.parse("2026-09-30T22:38:51Z"),
};
```

- [ ] **Étape 2 : test en échec** — `tests/drops-campaign-details.test.mjs` :

```js
import test from "node:test";
import assert from "node:assert/strict";
import { applyCampaignDetails, campaignsNeedingDetails, mergeCampaigns, normalizeCampaigns } from "../js/drops-data.js";
import { CAMPAIGNS_RAW, DAY, HOUR, NOW } from "./helpers/badges-fixtures.mjs";

const iso = (at) => new Date(at).toISOString();
const raw = (id) => CAMPAIGNS_RAW.find((campaign) => campaign.id === id);

test("normalizeCampaigns garde les Drops détaillés : dates, condition et badges donnés", () => {
  const [er, sm, p3] = normalizeCampaigns([raw("c-er"), raw("c-sm"), raw("c-p3")]);
  assert.deepEqual(er.drops, [{
    id: "d-er", name: "Bloody Finger ELDEN RING",
    startsAt: Date.parse("2026-10-01T07:00:00Z"), endsAt: Date.parse("2026-10-29T06:59:00Z"),
    minutes: 0, subs: 1, badges: ["Bloody Finger ELDEN RING"],
  }]);
  assert.deepEqual(sm.drops.map((drop) => drop.badges), [["Ultramarine"], []]);
  assert.equal(sm.drops[1].minutes, 120);
  assert.equal(p3.drops, null, "sans Drops dans la réponse, le détail reste à demander");
  assert.equal(er.detailedAt, 0);
});

test("mergeCampaigns garde le détail connu et les campagnes finies depuis moins de 7 jours", () => {
  const before = mergeCampaigns([], normalizeCampaigns([raw("c-er"), raw("c-p3")]), NOW - HOUR);
  assert.equal(before.find((c) => c.id === "c-er").detailedAt, NOW - HOUR);
  const runescape = { id: "c-old-rs", name: "RuneScape", owner: "Twitch Gaming", game: "RuneScape", startsAt: NOW - 2 * DAY, endsAt: NOW - DAY, status: "EXPIRED", drops: null, detailedAt: 0 };
  const old = { ...runescape, id: "c-old", endsAt: NOW - 8 * DAY };
  const gone = { ...runescape, id: "c-gone", endsAt: NOW + DAY, status: "ACTIVE" };
  const incoming = normalizeCampaigns([{ ...raw("c-er"), timeBasedDrops: undefined }, raw("c-p3")]);
  const merged = mergeCampaigns([...before, runescape, old, gone], incoming, NOW);
  const er = merged.find((c) => c.id === "c-er");
  assert.equal(er.drops[0].badges[0], "Bloody Finger ELDEN RING", "la liste revenue sans Drops n'efface pas le détail");
  assert.equal(er.detailedAt, NOW - HOUR);
  assert.deepEqual(merged.map((c) => c.id).sort(), ["c-er", "c-old-rs", "c-p3"], "finie hier : gardée ; finie il y a 8 jours ou disparue en cours : retirée");
});

test("campaignsNeedingDetails : Twitch Gaming sans détail frais, en cours d'abord, 5 au plus", () => {
  const extra = [1, 2, 3, 4, 5].map((n) => ({ ...raw("c-p3"), id: `c-x${n}`, endAt: iso(NOW + (6 + n) * DAY) }));
  const merged = mergeCampaigns([], normalizeCampaigns([raw("c-er"), raw("c-p3"), raw("c-lol"), ...extra]), NOW);
  const ids = campaignsNeedingDetails(merged, NOW);
  assert.deepEqual(ids, ["c-p3", "c-x1", "c-x2", "c-x3", "c-x4"], "celle qui finit la première d'abord ; ni ELDEN RING (détaillée) ni LoL (éditeur)");
  const stale = merged.map((c) => (c.id === "c-er" ? { ...c, detailedAt: NOW - 25 * HOUR } : c));
  assert.ok(campaignsNeedingDetails(stale, NOW, 10).includes("c-er"), "détail de plus de 24 h : redemandé");
});

test("applyCampaignDetails range les Drops reçus et date aussi les campagnes restées sans réponse", () => {
  const campaigns = mergeCampaigns([], normalizeCampaigns([raw("c-p3"), { ...raw("c-p3"), id: "c-p5" }]), NOW);
  const details = [{ id: "c-p3", timeBasedDrops: [{ id: "d-k", name: "Koromaru", startAt: raw("c-p3").startAt, endAt: raw("c-p3").endAt, requiredSubs: 1, benefitEdges: [{ benefit: { id: "b-k", name: "Koromaru", distributionType: "BADGE" } }] }] }];
  const next = applyCampaignDetails(campaigns, details, ["c-p3", "c-p5"], NOW + 1);
  const p3 = next.find((c) => c.id === "c-p3");
  assert.deepEqual(p3.drops[0].badges, ["Koromaru"]);
  assert.equal(p3.badgeOnly, true);
  assert.equal(p3.detailedAt, NOW + 1);
  const p5 = next.find((c) => c.id === "c-p5");
  assert.equal(p5.drops, null);
  assert.equal(p5.detailedAt, NOW + 1, "pas de nouvelle demande pendant 24 h");
  assert.equal(campaigns[0].detailedAt, 0, "aucune mutation");
});
```

- [ ] **Étape 3 : lancer** `node --test tests/drops-campaign-details.test.mjs` → ÉCHEC attendu
  (`mergeCampaigns` n'existe pas).

- [ ] **Étape 4 : implémenter** dans `js/drops-data.js`.

Après `const DAY_MS = 24 * HOUR_MS;` :

```js
/** Le détail d'une campagne (ses Drops) est relu au bout de ce délai. */
const DETAIL_MAX_AGE_MS = DAY_MS;
/** Campagnes détaillées par lecture : discret auprès de Twitch (au plus 5 par minute). */
export const DETAILS_PER_READ = 5;
```

Dans la section Campagnes, avant `normalizeCampaign`, ajouter :

```js
/** Un Drop d'une campagne détaillée : dates, condition et noms des badges qu'il donne. */
function normalizeCampaignDrop(raw) {
  const id = idOf(raw.id);
  if (!id) return null;
  const benefits = list(raw.benefitEdges).map((edge) => edge?.benefit).filter(isPlainObject);
  return {
    id,
    name: text(raw.name, 160),
    startsAt: timeOf(raw.startAt),
    endsAt: timeOf(raw.endAt),
    minutes: minutesOf(raw.requiredMinutesWatched),
    subs: minutesOf(raw.requiredSubs),
    badges: benefits.filter((benefit) => benefit.distributionType === "BADGE").map((benefit) => text(benefit.name, 120)).filter(Boolean),
  };
}

/** Ce que les Drops d'une campagne disent d'elle ; `drops` à null tant que Twitch ne les a pas envoyés. */
function dropsSummary(rawDrops) {
  const drops = Array.isArray(rawDrops) ? rawDrops.filter(isPlainObject) : null;
  const benefits = drops ? drops.flatMap((drop) => list(drop.benefitEdges).map((edge) => edge?.benefit).filter(isPlainObject)) : [];
  return {
    rewardCount: drops ? benefits.length || drops.length : null,
    badgeOnly: drops && benefits.length ? benefits.every((benefit) => benefit.distributionType === "BADGE") : null,
    drops: drops && drops.length ? drops.map(normalizeCampaignDrop).filter(Boolean) : null,
  };
}
```

Dans `normalizeCampaign`, supprimer les lignes `const drops = …` et `const benefits = …`, et remplacer
les deux champs `rewardCount: …` et `badgeOnly: …` du retour par :

```js
    ...dropsSummary(raw.timeBasedDrops),
    detailedAt: 0,
```

Après `pruneCampaigns`, ajouter :

```js
/**
 * Nouvelle lecture de la liste : le détail déjà lu d'une campagne reste si la
 * liste revient sans ses Drops, et une campagne finie sortie de la liste reste
 * jusqu'à 7 jours après sa fin (pour dater « Terminé le … »).
 */
export function mergeCampaigns(previous, incoming, now) {
  const before = new Map(list(previous).map((campaign) => [campaign.id, campaign]));
  const merged = incoming.map((campaign) => {
    if (campaign.drops) return { ...campaign, detailedAt: now };
    const old = before.get(campaign.id);
    return old?.drops ? { ...campaign, drops: old.drops, rewardCount: old.rewardCount, badgeOnly: old.badgeOnly, detailedAt: old.detailedAt || 0 } : campaign;
  });
  const seen = new Set(merged.map((campaign) => campaign.id));
  const ended = list(previous).filter((campaign) => !seen.has(campaign.id) && campaign.endsAt && campaign.endsAt <= now);
  return pruneCampaigns([...merged, ...ended], now);
}

/** Détail reçu pour les campagnes demandées ; une campagne restée sans réponse est datée quand même. */
export function applyCampaignDetails(campaigns, details, ids, now) {
  const byId = new Map(list(details).filter(isPlainObject).map((raw) => [idOf(raw.id), raw]));
  const asked = new Set(list(ids).map(String));
  return campaigns.map((campaign) => {
    if (!asked.has(campaign.id)) return campaign;
    const summary = dropsSummary(byId.get(campaign.id)?.timeBasedDrops);
    return summary.drops ? { ...campaign, ...summary, detailedAt: now } : { ...campaign, detailedAt: now };
  });
}
```

Dans la section des badges, juste après `export const isBadgeCampaign = …`, ajouter :

```js
const isTwitchGaming = (campaign) => BADGE_OWNER.test(campaign.owner || "");

/**
 * Campagnes Twitch Gaming dont il faut lire le détail : sans Drops connus ou
 * lus il y a plus de 24 h, en cours ou finies depuis moins de 7 jours. Les
 * campagnes en cours passent d'abord, celle qui finit la première en tête.
 */
export function campaignsNeedingDetails(campaigns, now, max = DETAILS_PER_READ) {
  return list(campaigns)
    .filter((campaign) => isTwitchGaming(campaign) && (!campaign.endsAt || campaign.endsAt > now - EXPIRED_KEEP_MS))
    .filter((campaign) => now - (campaign.detailedAt || 0) >= DETAIL_MAX_AGE_MS)
    .sort((a, b) => Number(isActiveCampaign(b, now)) - Number(isActiveCampaign(a, now)) || (a.endsAt || Infinity) - (b.endsAt || Infinity))
    .slice(0, max)
    .map((campaign) => campaign.id);
}
```

- [ ] **Étape 5 : lancer** `node --test tests/drops-campaign-details.test.mjs tests/drops-data.test.mjs`
  → SUCCÈS (les tests existants de `rewardCount`/`badgeOnly` restent verts).

- [ ] **Étape 6 : point de commit** (fait à la fin, après accord) :
  `feat: Drops détaillés des campagnes et fusion des lectures`.

---

### Tâche 2 : Journal des badges (`js/drops-data.js`)

**Fichiers :**
- Créer : `tests/badge-events.test.mjs`
- Modifier : `js/drops-data.js` (constantes, `DROPS_KEYS`, nouvelle section après `RETIRED_BADGES`)

**Interfaces :**
- Consomme : `normalizeCampaigns`, `mergeCampaigns` (tâche 1) ; `badgesFrom`, `mergeBadges`,
  `normalizeRewards`, `gameFromDescription`, `fold`, `RETIRED_BADGES`, `isTwitchGaming` (existants).
- Produit : `BADGE_EVENTS_KEY`, `eventsFrom(stored)` → `{ updatedAt, events }`, `gameKey(value)`,
  `sameGame(a, b)`, `categoryFromDescription(description)`,
  `buildBadgeEvents({ campaigns, rewards, catalog, previous, now })` → `Event[]` avec
  `Event = { badgeId, kind: "drops" | "rewards", campaignId, dropId, game, gameId, owner, startsAt, endsAt, minutes, subs, link: "reward" | "game", seenAt }`.

- [ ] **Étape 1 : test en échec** — `tests/badge-events.test.mjs` :

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCampaignDetails,
  buildBadgeEvents,
  categoryFromDescription,
  gameKey,
  mergeBadges,
  mergeCampaigns,
  normalizeCampaigns,
  normalizeRewards,
  sameGame,
} from "../js/drops-data.js";
import { CAMPAIGNS_RAW, CATALOG_RAW, DAY, NOW } from "./helpers/badges-fixtures.mjs";

const catalog = mergeBadges({ updatedAt: 0, syncedAt: 0, badges: [], owned: [] }, CATALOG_RAW, NOW).state.badges;
const campaigns = mergeCampaigns([], normalizeCampaigns(CAMPAIGNS_RAW), NOW);
const eventOf = (events, badgeId) => events.filter((event) => event.badgeId === badgeId);

test("gameKey et sameGame reconnaissent un jeu sous ses différents noms", () => {
  assert.equal(gameKey("PERSONA3 RELOAD"), gameKey("Persona 3 Reload"));
  assert.equal(gameKey("Warhammer 40,000: Space Marine II"), "warhammer40000spacemarine2");
  assert.ok(sameGame("ACE COMBAT 8: WINGS OF THEVE", "ACE COMBAT 8"));
  assert.ok(sameGame("Warhammer 40,000: Space Marine II", "Space Marine 2"));
  assert.ok(sameGame("Shin Megami Tensei V: Vengeance", "Shin Megami Tensei 5: Vengeance"));
  assert.equal(sameGame("Rust", "Rust Console Edition"), false, "nom trop court : égalité seulement");
  assert.equal(sameGame("", "REMATCH"), false);
});

test("categoryFromDescription lit « in the X category »", () => {
  assert.equal(categoryFromDescription("earned by subscribing or gifting a sub to a streamer in the ELDEN RING category."), "ELDEN RING");
  assert.equal(categoryFromDescription("a streamer in The Witcher 3: Wild Hunt category during launch"), "Witcher 3: Wild Hunt");
  assert.equal(categoryFromDescription("earned by watching Dungeon Masters on Twitch."), "");
});

test("buildBadgeEvents relie chaque badge au Drop qui le nomme, avec les dates du Drop", () => {
  const events = buildBadgeEvents({ campaigns, catalog, now: NOW });
  const [bloody] = eventOf(events, "bloody-finger-elden-ring");
  assert.deepEqual(
    [bloody.kind, bloody.link, bloody.campaignId, bloody.dropId, bloody.subs, bloody.gameId],
    ["drops", "reward", "c-er", "d-er", 1, "512953"],
  );
  assert.equal(eventOf(events, "ultramarine")[0].endsAt, Date.parse("2026-10-29T07:59:00Z"), "fin du Drop, pas de la campagne");
  assert.equal(eventOf(events, "d20")[0].minutes, 30, "d20 ne cite aucun jeu : seul le nom de la récompense le relie");
  assert.deepEqual(eventOf(events, "hoxton").map((e) => e.campaignId), ["c-pd"]);
  assert.equal(eventOf(events, "yellow-party-hat")[0].endsAt, Date.parse("2026-10-04T22:59:00Z"));
});

test("secours par le jeu, seulement pour une campagne Twitch Gaming sans détail", () => {
  const events = buildBadgeEvents({ campaigns, catalog, now: NOW });
  assert.deepEqual(eventOf(events, "koromaru").map((e) => [e.campaignId, e.link]), [["c-p3", "game"]]);
  assert.deepEqual(eventOf(events, "ace-combat-8-nugget").map((e) => [e.campaignId, e.link]), [["c-ac", "game"]]);
  assert.deepEqual(eventOf(events, "elden-ring-recluse"), [], "ELDEN RING est détaillée : seul le badge qu'elle nomme s'y rattache");
  for (const id of ["vaultbreakers", "clipped-that", "twitchcon-2026---san-diego---taco"]) assert.deepEqual(eventOf(events, id), []);
  assert.ok(!events.some((event) => event.campaignId === "c-lol"), "campagne d'éditeur : jamais de secours");
});

test("le détail arrivé remplace la liaison par le jeu", () => {
  const first = buildBadgeEvents({ campaigns, catalog, now: NOW });
  const details = [{ id: "c-p3", timeBasedDrops: [{ id: "d-k", name: "Koromaru", startAt: "2026-09-24T16:00:00Z", endAt: "2026-10-11T06:58:00Z", requiredSubs: 1, benefitEdges: [{ benefit: { id: "b-k", name: "Koromaru", distributionType: "BADGE" } }] }] }];
  const detailed = applyCampaignDetails(campaigns, details, ["c-p3"], NOW + 1);
  const next = buildBadgeEvents({ campaigns: detailed, catalog, previous: first, now: NOW + 1 });
  assert.deepEqual(eventOf(next, "koromaru").map((e) => [e.link, e.dropId, e.subs]), [["reward", "d-k", 1]]);
});

test("un nom de récompense de campagne égal au titre d'un badge le relie aussi", () => {
  const rewards = normalizeRewards([{ id: "rw-poke", name: "First Partners Collection", brand: "Pokemon", startsAt: "2026-08-24T17:00:00Z", endsAt: "2026-11-01T07:00:00Z", unlockRequirements: { subsGoal: 0, minuteWatchedGoal: 20 }, rewards: [{ id: "r1", name: "Poké Ball" }] }]);
  const withBall = [...catalog, { id: "poke-ball", title: "Poké Ball", description: "Pokémon collection", game: "", firstSeen: 0 }];
  const [ball] = eventOf(buildBadgeEvents({ campaigns: [], rewards, catalog: withBall, now: NOW }), "poke-ball");
  assert.deepEqual([ball.kind, ball.link, ball.minutes, ball.endsAt], ["rewards", "reward", 20, Date.parse("2026-11-01T07:00:00Z")]);
});

test("un badge daté d'une année passée ou retiré n'est jamais relié par le jeu", () => {
  const lol = normalizeCampaigns([{ id: "c-lolb", name: "LoL", status: "ACTIVE", startAt: "2026-09-20T18:00:00Z", endAt: "2026-10-10T15:59:00Z", game: { displayName: "League of Legends" }, owner: { name: "Twitch Gaming" } }]);
  const control = normalizeCampaigns([{ id: "c-ctl", name: "CONTROL", status: "ACTIVE", startAt: "2026-09-22T14:00:00Z", endAt: "2026-10-13T13:59:00Z", game: { displayName: "CONTROL Resonant" }, owner: { name: "Twitch Gaming" } }]);
  const old = [
    { id: "league-of-legends-classic", title: "League of Legends Classic", description: "earned by watching a streamer in the League of Legends category during the LoL Classic launch", game: "", firstSeen: 0 },
    { id: "old-control", title: "Old Control", description: "watching a streamer in the CONTROL Resonant category during the 2025 reveal", game: "", firstSeen: 0 },
  ];
  assert.deepEqual(buildBadgeEvents({ campaigns: [...lol, ...control], catalog: old, now: NOW }), []);
});

test("le journal garde 60 jours après la fin, sans muter ce qu'il reçoit", () => {
  const ended = (days) => ({ badgeId: "x", kind: "drops", campaignId: `c${days}`, dropId: "", game: "X", gameId: "", owner: "Twitch Gaming", startsAt: 0, endsAt: NOW - days * DAY, minutes: 0, subs: 0, link: "reward", seenAt: NOW - days * DAY });
  const previous = [ended(59), ended(61)];
  const frozen = structuredClone(previous);
  const events = buildBadgeEvents({ campaigns: [], catalog, previous, now: NOW });
  assert.deepEqual(events.map((e) => e.campaignId), ["c59"]);
  assert.deepEqual(previous, frozen);
});
```

- [ ] **Étape 2 : lancer** `node --test tests/badge-events.test.mjs` → ÉCHEC attendu (`buildBadgeEvents`
  n'existe pas).

- [ ] **Étape 3 : implémenter** dans `js/drops-data.js`.

En tête, après `BADGE_AUTO_KEY` :

```js
/** Journal des badges : chaque badge relié au Drop (ou à la récompense) qui le donne, avec ses dates. */
export const BADGE_EVENTS_KEY = "streamPulseBadgeEvents";
/** Dates d'ajout des badges notées par streampulse.fr : { fetchedAt, added: { setID: ms } }. */
export const BADGE_ADDED_KEY = "streamPulseBadgeAdded";
export const DROPS_KEYS = [DROPS_PROGRESS_KEY, DROPS_CAMPAIGNS_KEY, DROPS_HISTORY_KEY, DROPS_SINCE_KEY, DROPS_REWARDS_KEY, DROPS_BADGES_KEY, BADGE_EVENTS_KEY, BADGE_ADDED_KEY];
```

(remplace l'ancienne ligne `export const DROPS_KEYS = …`). Après `DETAILS_PER_READ` :

```js
/** Un événement de badge reste au journal jusqu'à 60 jours après sa fin. */
const EVENT_KEEP_MS = 60 * DAY_MS;
```

Après la déclaration de `RETIRED_BADGES`, ajouter la section :

```js
// ─── Journal des badges ───────────────────────────────────────────────────────

export function eventsFrom(stored = {}) {
  const value = (stored || {})[BADGE_EVENTS_KEY];
  if (!isPlainObject(value)) return { updatedAt: 0, events: [] };
  return {
    updatedAt: timeOf(value.updatedAt),
    events: list(value.events).filter((event) => isPlainObject(event) && typeof event.badgeId === "string" && event.badgeId),
  };
}

const ROMAN_NUMERALS = Object.freeze({ ii: "2", iii: "3", iv: "4", v: "5", vi: "6" });

/** Nom de jeu comparable : replié, chiffres romains isolés en chiffres, sans espaces ni ponctuation. */
export function gameKey(value) {
  return fold(value).split(/[^a-z0-9]+/).map((word) => ROMAN_NUMERALS[word] || word).join("");
}

/**
 * Deux noms du même jeu : égaux une fois comparables, ou l'un contenu dans
 * l'autre s'il fait au moins 6 caractères (« ACE COMBAT 8 » dans « ACE COMBAT 8:
 * WINGS OF THEVE », « Space Marine 2 » dans « Warhammer 40,000: Space Marine II »).
 */
export function sameGame(a, b) {
  const x = gameKey(a);
  const y = gameKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 6 && long.includes(short);
}

/** Catégorie citée par une description : « … a streamer in the ELDEN RING category ». */
export function categoryFromDescription(description) {
  return (/\bin (?:the )?(.+?) category/i.exec(String(description || ""))?.[1] || "").trim().slice(0, 80);
}

/** Jeux qu'un badge cite : lien de catégorie, « in the X category », « watching X for… ». */
function badgeGames(badge) {
  return [badge.game, categoryFromDescription(badge.description), gameFromDescription(badge.description)].filter(Boolean);
}

/** Description qui cite une année passée : l'événement est fini. */
function mentionsPastYear(badge, now) {
  const year = new Date(now).getFullYear();
  return (fold(badge.description).match(/\b20\d\d\b/g) || []).some((value) => Number(value) < year);
}

const eventKey = (event) => `${event.badgeId}|${event.campaignId}|${event.dropId}`;

function dropEvent(badgeId, campaign, drop, link, now) {
  return {
    badgeId,
    kind: "drops",
    campaignId: campaign.id,
    dropId: drop?.id || "",
    game: campaign.game || "",
    gameId: campaign.gameId || "",
    owner: campaign.owner || "",
    startsAt: drop?.startsAt || campaign.startsAt || 0,
    endsAt: drop?.endsAt || campaign.endsAt || 0,
    minutes: drop?.minutes || 0,
    subs: drop?.subs || 0,
    link,
    seenAt: now,
  };
}

function rewardEvent(badgeId, reward, item, now) {
  return {
    badgeId,
    kind: "rewards",
    campaignId: reward.id,
    dropId: item.id || "",
    game: reward.game || reward.brand || "",
    gameId: "",
    owner: reward.brand || "",
    startsAt: reward.startsAt || 0,
    endsAt: reward.endsAt || 0,
    minutes: reward.minutesGoal || 0,
    subs: reward.subsGoal || 0,
    link: "reward",
    seenAt: now,
  };
}

/**
 * Journal des badges : chaque badge du catalogue relié aux Drops (ou aux
 * récompenses de campagne) qui le donnent, avec les dates du Drop. Liaison
 * exacte par le nom de la récompense ; secours par le jeu, seulement pour une
 * campagne Twitch Gaming dont on n'a pas encore le détail. Dès que le détail
 * d'une campagne est connu, seuls les badges qu'elle nomme s'y rattachent.
 * Les événements finis restent 60 jours.
 */
export function buildBadgeEvents({ campaigns = [], rewards = [], catalog = [], previous = [], now }) {
  const byTitle = new Map();
  for (const badge of catalog) {
    const key = fold(badge.title).trim();
    if (key && !byTitle.has(key)) byTitle.set(key, badge);
  }
  const named = (name) => byTitle.get(fold(name).trim());
  const fresh = [];
  for (const campaign of campaigns) {
    for (const drop of campaign.drops || []) {
      for (const name of drop.badges || []) {
        const badge = named(name);
        if (badge) fresh.push(dropEvent(badge.id, campaign, drop, "reward", now));
      }
    }
  }
  for (const reward of rewards) {
    for (const item of reward.rewards || []) {
      const badge = named(item.name);
      if (badge) fresh.push(rewardEvent(badge.id, reward, item, now));
    }
  }
  const exact = new Set([...previous, ...fresh].filter((event) => event.link === "reward").map((event) => event.badgeId));
  for (const campaign of campaigns) {
    if (campaign.drops || !isTwitchGaming(campaign) || !campaign.game) continue;
    for (const badge of catalog) {
      if (exact.has(badge.id) || RETIRED_BADGES.has(badge.id) || mentionsPastYear(badge, now)) continue;
      if (badgeGames(badge).some((game) => sameGame(game, campaign.game))) fresh.push(dropEvent(badge.id, campaign, null, "game", now));
    }
  }
  const detailed = new Set(campaigns.filter((campaign) => campaign.drops).map((campaign) => campaign.id));
  const merged = new Map(previous
    .filter((event) => !(event.link === "game" && detailed.has(event.campaignId)))
    .map((event) => [eventKey(event), event]));
  for (const event of fresh) merged.set(eventKey(event), event);
  return [...merged.values()].filter((event) => (event.endsAt || event.seenAt) + EVENT_KEEP_MS > now);
}
```

- [ ] **Étape 4 : lancer** `node --test tests/badge-events.test.mjs` → SUCCÈS.

- [ ] **Étape 5 : point de commit** : `feat: journal des badges relié aux Drops qui les donnent`.

---

### Tâche 3 : Statuts, dates d'ajout et catalogue (`js/drops-data.js`)

**Fichiers :**
- Créer : `tests/badge-statuses.test.mjs`
- Modifier : `js/drops-data.js` (remplace `activeNames`, `BADGE_TESTS`, `BADGE_FILTERS`,
  `badgeCampaignFor`, `catalogBadges`, `countBadges`), `js/badge-auto-worker.js` (fonction `catalog`),
  `tests/drops-rewards.test.mjs`, `tests/badge-auto-worker.test.mjs`

**Interfaces :**
- Consomme : `buildBadgeEvents`, `BADGE_ADDED_KEY` (tâche 2).
- Produit : `viewerEarnable(description)`, `badgeAddedAt(badge, siteAdded)`, `normalizeAdded(raw)`,
  `addedFrom(stored)` → `{ fetchedAt, added }`, `badgeStatus(badge, events, { now, addedAt })` →
  `{ status: "live" | "soon" | "ended" | null, event }`,
  `catalogBadges(state, { status = "all", cost = "all", query = "", now, events = [], added = {} })`
  → badges avec `owned, paid, addedAt, status, event, campaign`, et
  `countBadges(state, context)` → `{ all, live, soon, ended, owned, liveFree }`.

- [ ] **Étape 1 : test en échec** — `tests/badge-statuses.test.mjs` :

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  addedFrom,
  badgeAddedAt,
  badgeStatus,
  buildBadgeEvents,
  catalogBadges,
  countBadges,
  mergeBadges,
  mergeCampaigns,
  normalizeAdded,
  normalizeCampaigns,
  viewerEarnable,
} from "../js/drops-data.js";
import { CAMPAIGNS_RAW, CATALOG_RAW, DAY, NOW, SITE_ADDED } from "./helpers/badges-fixtures.mjs";

const state = mergeBadges({ updatedAt: 0, syncedAt: 0, badges: [], owned: [] }, CATALOG_RAW, NOW).state;
const events = buildBadgeEvents({ campaigns: mergeCampaigns([], normalizeCampaigns(CAMPAIGNS_RAW), NOW), catalog: state.badges, now: NOW });
const context = { now: NOW, events, added: SITE_ADDED };
const ids = (list) => list.map((badge) => badge.id);

test("viewerEarnable : regarder, s'abonner, offrir ou Bits ; jamais un badge de créateur, de billet ou de salon", () => {
  assert.ok(viewerEarnable("earned by watching a streamer in the Vaultbreakers category for 60 minutes"));
  assert.ok(viewerEarnable("earned by subscribing or gifting a sub to a streamer in the DayZ category"));
  assert.ok(viewerEarnable("awarded to people who viewed the official 2026 RuneFest livestream"));
  assert.equal(viewerEarnable("earned by a DJ Program creator who clipped an epic mid-set moment"), false);
  assert.equal(viewerEarnable("given to anyone who purchased a 3-day ticket to TwitchCon"), false);
  assert.equal(viewerEarnable(""), false);
});

test("badgeAddedAt garde la plus ancienne date connue ; normalizeAdded écarte l'illisible", () => {
  assert.equal(badgeAddedAt({ id: "a", firstSeen: 200 }, { a: 100 }), 100);
  assert.equal(badgeAddedAt({ id: "a", firstSeen: 0 }, { a: 100 }), 100);
  assert.equal(badgeAddedAt({ id: "a", firstSeen: 300 }, {}), 300);
  assert.equal(badgeAddedAt({ id: "a", firstSeen: 0 }, {}), 0);
  assert.deepEqual(normalizeAdded({ vaultbreakers: 1759664355452, "bad id!": 5, d20: "x", ok: -3 }), { vaultbreakers: 1759664355452 });
  assert.deepEqual(addedFrom({}), { fetchedAt: 0, added: {} });
  assert.deepEqual(addedFrom({ streamPulseBadgeAdded: { fetchedAt: 5, added: { d20: 7 } } }), { fetchedAt: 5, added: { d20: 7 } });
});

test("statuts du 5 octobre 2026", () => {
  const status = (id, ctx = context) => badgeStatus(state.badges.find((b) => b.id === id), ctx.events, { now: ctx.now, addedAt: badgeAddedAt(state.badges.find((b) => b.id === id), ctx.added) }).status;
  for (const id of ["bloody-finger-elden-ring", "ultramarine", "koromaru", "ace-combat-8-nugget", "d20", "rematch-blue-lock", "dallas", "hoxton"]) assert.equal(status(id), "live", id);
  assert.equal(status("yellow-party-hat"), "ended");
  assert.equal(status("yellow-party-hat", { ...context, now: NOW + 8 * DAY }), null, "terminé depuis plus de 7 jours : retiré");
  assert.equal(status("vaultbreakers"), "soon", "ajouté le jour même, pas encore de campagne");
  assert.equal(status("vaultbreakers", { ...context, added: {} }), null, "sans date d'ajout, rien n'annonce sa venue");
  assert.equal(status("vaultbreakers", { ...context, now: NOW + 31 * DAY }), null, "30 jours sans campagne : retiré");
  assert.equal(status("clipped-that"), null);
  assert.equal(status("twitchcon-2026---san-diego---taco"), null);
  assert.equal(status("elden-ring-recluse"), null);
});

test("un Drop qui démarre plus tard rend le badge « à venir », daté", () => {
  const later = { badgeId: "vaultbreakers", kind: "drops", campaignId: "c-vb", dropId: "d-vb", game: "Vaultbreakers", gameId: "547208385", owner: "Twitch Gaming", startsAt: NOW + DAY, endsAt: NOW + 20 * DAY, minutes: 60, subs: 0, link: "reward", seenAt: NOW };
  const result = badgeStatus(state.badges.find((b) => b.id === "vaultbreakers"), [later], { now: NOW, addedAt: 0 });
  assert.deepEqual([result.status, result.event.startsAt], ["soon", NOW + DAY]);
});

test("catalogBadges : statut, coût, recherche et ordre", () => {
  assert.deepEqual(ids(catalogBadges(state, { ...context, status: "live" })), [
    "dallas", "hoxton", "wolf", "koromaru", "ampersand", "d20", "rematch-blue-lock", "ace-combat-8-nugget", "bloody-finger-elden-ring", "ultramarine",
  ]);
  assert.deepEqual(ids(catalogBadges(state, { ...context, status: "live", cost: "free" })), ["hoxton", "wolf", "d20", "rematch-blue-lock"]);
  assert.deepEqual(ids(catalogBadges(state, { ...context, status: "soon" })), ["vaultbreakers"]);
  assert.deepEqual(ids(catalogBadges(state, { ...context, status: "ended" })), ["yellow-party-hat"]);
  assert.deepEqual(ids(catalogBadges(state, { ...context, status: "owned" })), ["hoxton"]);
  assert.deepEqual(ids(catalogBadges(state, { ...context, query: "persona" })), ["koromaru"]);
  const koromaru = catalogBadges(state, context).find((b) => b.id === "koromaru");
  assert.equal(koromaru.paid, true, "liaison par le jeu sans condition : la description fait foi");
  const bloody = catalogBadges(state, context).find((b) => b.id === "bloody-finger-elden-ring");
  assert.deepEqual([bloody.paid, bloody.addedAt], [true, SITE_ADDED["bloody-finger-elden-ring"]]);
});

test("catalogBadges donne au mode auto la campagne du Drop en cours", () => {
  const rematch = catalogBadges(state, { ...context, status: "live" }).find((b) => b.id === "rematch-blue-lock");
  assert.deepEqual(rematch.campaign, { id: "c-rm", game: "REMATCH", gameId: "1362102608", endsAt: Date.parse("2026-10-21T22:58:00Z") });
  assert.equal(catalogBadges(state, { ...context, status: "ended" })[0].campaign, null);
});

test("countBadges compte chaque statut et les gratuits en cours", () => {
  assert.deepEqual(countBadges(state, context), { all: 12, live: 10, soon: 1, ended: 1, owned: 1, liveFree: 4 });
});
```

- [ ] **Étape 2 : lancer** `node --test tests/badge-statuses.test.mjs` → ÉCHEC attendu.

- [ ] **Étape 3 : implémenter** dans `js/drops-data.js`.

Après `EVENT_KEEP_MS` :

```js
/** Un badge sans campagne reste « à venir » pendant 30 jours après son ajout. */
const SOON_WINDOW_MS = 30 * DAY_MS;
/** Un badge terminé reste affiché 7 jours. */
const ENDED_SHOWN_MS = 7 * DAY_MS;
```

Supprimer `BADGE_FILTERS`, `activeNames`, `BADGE_TESTS`, `badgeCampaignFor`, l'ancien `catalogBadges` et
l'ancien `countBadges`, ainsi que le commentaire orphelin « Catalogue complet : filtre, recherche… ».
Garder `isPaidBadge`, `fold`, `BADGE_OWNER`, `isBadgeCampaign`, `RETIRED_BADGES`, `newBadges`. Ajouter,
après la section « Journal des badges » :

```js
// ─── Statuts de l'onglet Badges ───────────────────────────────────────────────

const VIEWER_ACTION = /\b(watch\w*|view\w*|subscrib\w*|gift\w*|cheer\w*|bits?)\b/i;
const NOT_VIEWER = /\b(creators?|streamers? who|tickets?|attend\w*|DJ Program|partners?|affiliates?)\b/i;

/** Badge qu'un spectateur peut gagner (regarder, s'abonner, offrir, Bits), pas un badge de créateur, de billet ou de salon. */
export function viewerEarnable(description) {
  const value = String(description || "");
  return VIEWER_ACTION.test(value) && !NOT_VIEWER.test(value);
}

const SET_ID = /^[a-z0-9][a-z0-9_-]{0,119}$/i;

/** Dates d'ajout renvoyées par streampulse.fr : { setID: ms }, valeurs illisibles écartées. */
export function normalizeAdded(raw) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  for (const [id, value] of Object.entries(raw)) {
    const at = timeOf(value);
    if (SET_ID.test(id) && at) out[id] = at;
  }
  return out;
}

export function addedFrom(stored = {}) {
  const value = (stored || {})[BADGE_ADDED_KEY];
  if (!isPlainObject(value)) return { fetchedAt: 0, added: {} };
  return { fetchedAt: timeOf(value.fetchedAt), added: normalizeAdded(value.added) };
}

/** Date d'ajout d'un badge : la plus ancienne entre celle du site et celle de l'appareil ; 0 si aucune. */
export function badgeAddedAt(badge, siteAdded = {}) {
  const values = [Number(siteAdded?.[badge.id]) || 0, Number(badge.firstSeen) || 0].filter((at) => at > 0);
  return values.length ? Math.min(...values) : 0;
}

const isLiveEvent = (event, now) => (!event.startsAt || event.startsAt <= now) && (!event.endsAt || event.endsAt > now);

/**
 * Statut d'un badge : `live` (un Drop qui le donne est ouvert ; le plus tardif
 * s'il y en a plusieurs), `soon` (un Drop démarre plus tard, ou badge ajouté
 * depuis moins de 30 jours, sans campagne, gagnable en spectateur), `ended`
 * (tous ses Drops finis, affiché 7 jours), sinon null.
 */
export function badgeStatus(badge, events, { now, addedAt = 0 }) {
  const mine = list(events).filter((event) => event.badgeId === badge.id);
  const live = mine.filter((event) => isLiveEvent(event, now)).sort((a, b) => (b.endsAt || Infinity) - (a.endsAt || Infinity));
  if (live.length) return { status: "live", event: live[0] };
  const later = mine.filter((event) => event.startsAt > now).sort((a, b) => a.startsAt - b.startsAt);
  if (later.length) return { status: "soon", event: later[0] };
  const ended = mine.filter((event) => event.endsAt && event.endsAt <= now).sort((a, b) => b.endsAt - a.endsAt);
  if (ended.length) return { status: now - ended[0].endsAt <= ENDED_SHOWN_MS ? "ended" : null, event: ended[0] };
  const recent = addedAt > 0 && now - addedAt <= SOON_WINDOW_MS;
  if (recent && viewerEarnable(badge.description) && !RETIRED_BADGES.has(badge.id) && !mentionsPastYear(badge, now)) return { status: "soon", event: null };
  return { status: null, event: null };
}

const STATUS_RANK = Object.freeze({ live: 0, soon: 1, ended: 2 });

/** En cours : fin la plus proche ; à venir : datés, puis ajoutés récemment ; terminés : fin la plus récente. */
function compareBadges(a, b) {
  const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (rank) return rank;
  if (a.status === "live") return (a.event?.endsAt || Infinity) - (b.event?.endsAt || Infinity) || a.title.localeCompare(b.title);
  if (a.status === "soon") return (a.event?.startsAt || Infinity) - (b.event?.startsAt || Infinity) || b.addedAt - a.addedAt || a.title.localeCompare(b.title);
  return (b.event?.endsAt || 0) - (a.event?.endsAt || 0) || a.title.localeCompare(b.title);
}

/**
 * Badges de l'onglet, chacun avec son statut, l'événement retenu (dates,
 * condition), sa date d'ajout et son coût. `status` : live | soon | ended |
 * owned | all ; `cost` : all | free | paid. `campaign` garde la forme attendue
 * par le mode auto (badge-auto.js) : le Drop en cours et son jeu.
 */
export function catalogBadges(state, { status = "all", cost = "all", query = "", now = Date.now(), events = [], added = {} } = {}) {
  const owned = new Set(state.owned);
  const needle = String(query || "").trim().toLowerCase();
  return state.badges
    .map((badge) => {
      const addedAt = badgeAddedAt(badge, added);
      const result = badgeStatus(badge, events, { now, addedAt });
      const event = result.event;
      const paid = event?.subs > 0 ? true : event?.minutes > 0 ? false : isPaidBadge(badge);
      return {
        ...badge,
        owned: owned.has(badge.id),
        paid,
        addedAt,
        status: result.status,
        event,
        campaign: result.status === "live" && event?.kind === "drops" ? { id: event.campaignId, game: event.game, gameId: event.gameId, endsAt: event.endsAt } : null,
      };
    })
    .filter((badge) => badge.status !== null)
    .filter((badge) => status === "all" || (status === "owned" ? badge.owned : badge.status === status))
    .filter((badge) => cost === "all" || badge.paid === (cost === "paid"))
    .filter((badge) => !needle || `${badge.title} ${badge.description}`.toLowerCase().includes(needle))
    .sort(compareBadges);
}

export function countBadges(state, context = {}) {
  const all = catalogBadges(state, { ...context, status: "all", cost: "all", query: "" });
  return {
    all: all.length,
    live: all.filter((badge) => badge.status === "live").length,
    soon: all.filter((badge) => badge.status === "soon").length,
    ended: all.filter((badge) => badge.status === "ended").length,
    owned: all.filter((badge) => badge.owned).length,
    liveFree: all.filter((badge) => badge.status === "live" && !badge.paid).length,
  };
}
```

`mentionsPastYear` est défini dans la section « Journal des badges » (tâche 2), avant cette section.

- [ ] **Étape 4 : mode auto** — dans `js/badge-auto-worker.js`, remplacer la fonction `catalog` et
  ajuster l'import (retirer `DROPS_CAMPAIGNS_KEY` et `campaignsFrom` s'ils ne servent plus ailleurs dans
  le fichier ; ajouter `BADGE_ADDED_KEY`, `BADGE_EVENTS_KEY`, `addedFrom`, `eventsFrom`) :

```js
  /** Badges en cours avec le Drop qui les donne (pour « tous les badges »). */
  async function catalog() {
    const stored = await chrome.storage.local.get([DROPS_BADGES_KEY, BADGE_EVENTS_KEY, BADGE_ADDED_KEY]);
    return catalogBadges(badgesFrom(stored), { status: "live", now: Date.now(), events: eventsFrom(stored).events, added: addedFrom(stored).added });
  }
```

Dans `tests/badge-auto-worker.test.mjs`, importer `buildBadgeEvents` et, partout où le test pose
`store.streamPulseDropsCampaigns = { updatedAt: now, campaigns };`, ajouter juste après :

```js
  store.streamPulseBadgeEvents = { updatedAt: now, events: buildBadgeEvents({ campaigns, catalog: badges, now }) };
```

(Les badges du test citent leur jeu par `game` ; les campagnes Twitch Gaming sans Drops les relient par
le jeu ; le badge « sub » reste payant par sa description et n'entre pas dans la file.)

- [ ] **Étape 5 : anciens tests du catalogue** — dans `tests/drops-rewards.test.mjs`, supprimer les tests
  qui décrivent l'ancien comportement (`catalogBadges filtre gratuits, payants…`, `citer le jeu d'une
  campagne de récompenses ne suffit plus…`, `un vieux badge du même jeu, daté d'une année passée…`,
  `un badge est relié à la campagne de Drops en cours de son jeu…`, `un badge d'événement terminé (LoL
  Classic)…`) et les imports devenus inutiles (`activeNames`, `badgeCampaignFor`, `countBadges`). Leur
  intention est reprise par `tests/badge-events.test.mjs` et `tests/badge-statuses.test.mjs`. Remplacer le
  test de la Rematch Nations Cup par sa seule partie encore valable :

```js
test("la Rematch Nations Cup terminée n'est pas comptée comme nouveauté", async () => {
  const { newBadges } = await import("../js/drops-data.js");
  const now = Date.parse("2026-10-02T12:00:00Z");
  const raw = { badges: [{ setID: "rematch-nations-cup", title: "Rematch Nations Cup", description: "This badge was earned by watching the Rematch Nations Cup!", version: "1" }], owned: [] };
  const { state } = mergeBadges({ updatedAt: 0, syncedAt: 0, badges: [], owned: [] }, raw, now);
  assert.equal(newBadges({ ...state, badges: state.badges.map((b) => ({ ...b, firstSeen: now })) }, now).length, 0);
});
```

- [ ] **Étape 6 : lancer** `npm test` → SUCCÈS (sauf `popup-drops` qui importe encore `activeNames` :
  l'import est retiré à la tâche 8 ; si `popup-drops-fill.test.mjs` échoue ici, faire tout de suite la
  partie « imports » de la tâche 8, étape 3).

- [ ] **Étape 7 : point de commit** : `feat: statuts en cours, à venir et terminé des badges`.

---

### Tâche 4 : Écriture côté service worker (`js/drops-store.js`, messages)

**Fichiers :**
- Modifier : `js/drops-store.js`, `js/sw/messages-drops.js`, `js/sw/messages.js`, `tests/drops-store.test.mjs`

**Interfaces :**
- Consomme : `mergeCampaigns`, `applyCampaignDetails`, `campaignsNeedingDetails`, `buildBadgeEvents`,
  `eventsFrom`, `normalizeAdded`, `rewardsFrom`, `BADGE_EVENTS_KEY`, `BADGE_ADDED_KEY`.
- Produit : `recordCampaigns(rawList, source)` → `{ recorded, count?, details: string[] }` ;
  `recordCampaignDetails(rawList, ids)` → `{ recorded, details: string[] }` ;
  `recordBadgeAdded(raw)` → `{ recorded, count }` ; message `recordDropsCampaignDetails`
  `{ ok, data, ids, error }` → `{ success, recorded, details }`.

- [ ] **Étape 1 : test en échec** — ajouter à `tests/drops-store.test.mjs` :

```js
import { BADGE_ADDED_KEY, BADGE_EVENTS_KEY, DROPS_BADGES_KEY, mergeBadges } from "../js/drops-data.js";
import { CAMPAIGNS_RAW, CATALOG_RAW, NOW as BADGES_NOW } from "./helpers/badges-fixtures.mjs";

function badgeStorage() {
  const catalog = mergeBadges({ updatedAt: 0, syncedAt: 0, badges: [], owned: [] }, CATALOG_RAW, BADGES_NOW).state;
  return memoryStorage({ [DROPS_BADGES_KEY]: catalog });
}

test("recordCampaigns relie les badges et demande le détail des campagnes Twitch Gaming qui en manquent", async () => {
  const storage = badgeStorage();
  const store = createDropsStore({ storage, now: () => BADGES_NOW, log: silent });
  const result = await store.recordCampaigns(CAMPAIGNS_RAW, "gql");
  assert.deepEqual(result.details, ["c-p3", "c-ac"]);
  const events = storage.data[BADGE_EVENTS_KEY].events;
  assert.ok(events.some((event) => event.badgeId === "bloody-finger-elden-ring" && event.link === "reward"));
  assert.ok(events.some((event) => event.badgeId === "koromaru" && event.link === "game"));
});

test("recordCampaignDetails range le détail, relie de nouveau et rend la suite", async () => {
  const storage = badgeStorage();
  const store = createDropsStore({ storage, now: () => BADGES_NOW, log: silent });
  await store.recordCampaigns(CAMPAIGNS_RAW, "gql");
  const details = [{ id: "c-p3", timeBasedDrops: [{ id: "d-k", name: "Koromaru", startAt: "2026-09-24T16:00:00Z", endAt: "2026-10-11T06:58:00Z", requiredSubs: 1, benefitEdges: [{ benefit: { id: "b-k", name: "Koromaru", distributionType: "BADGE" } }] }] }];
  const result = await store.recordCampaignDetails(details, ["c-p3", "c-ac"]);
  assert.deepEqual(result, { recorded: true, details: [] });
  const koromaru = storage.data[BADGE_EVENTS_KEY].events.filter((event) => event.badgeId === "koromaru");
  assert.deepEqual(koromaru.map((event) => event.link), ["reward"]);
  // La liste relue sans Drops ne fait pas oublier le détail.
  await store.recordCampaigns(CAMPAIGNS_RAW, "gql");
  assert.equal(storage.data[DROPS_CAMPAIGNS_KEY].campaigns.find((c) => c.id === "c-p3").drops[0].badges[0], "Koromaru");
});

test("recordBadges relie un badge qui vient d'apparaître ; recordBadgeAdded range les dates du site", async () => {
  const storage = memoryStorage();
  const store = createDropsStore({ storage, now: () => BADGES_NOW, log: silent });
  await store.recordCampaigns(CAMPAIGNS_RAW, "gql");
  assert.equal(storage.data[BADGE_EVENTS_KEY], undefined, "sans catalogue, rien à relier");
  await store.recordBadges(CATALOG_RAW);
  assert.ok(storage.data[BADGE_EVENTS_KEY].events.some((event) => event.badgeId === "rematch-blue-lock"));
  const added = await store.recordBadgeAdded({ vaultbreakers: 1759664355452, "pas bon!": 3 });
  assert.deepEqual(added, { recorded: true, count: 1 });
  assert.deepEqual(storage.data[BADGE_ADDED_KEY], { fetchedAt: BADGES_NOW, added: { vaultbreakers: 1759664355452 } });
});
```

- [ ] **Étape 2 : lancer** `node --test tests/drops-store.test.mjs` → ÉCHEC attendu.

- [ ] **Étape 3 : implémenter** dans `js/drops-store.js`. Ajouter aux imports : `BADGE_ADDED_KEY`,
  `BADGE_EVENTS_KEY`, `applyCampaignDetails`, `buildBadgeEvents`, `campaignsNeedingDetails`,
  `eventsFrom`, `mergeCampaigns`, `normalizeAdded`, `rewardsFrom` ; retirer `pruneCampaigns` s'il ne sert
  plus. Dans `createDropsStore`, ajouter avant `recordInventory` :

```js
  /** Relie de nouveau badges et campagnes après toute lecture qui les touche. */
  async function relinkBadges(clock) {
    const stored = await storage.get([DROPS_CAMPAIGNS_KEY, DROPS_REWARDS_KEY, DROPS_BADGES_KEY, BADGE_EVENTS_KEY]);
    const catalog = badgesFrom(stored).badges;
    if (!catalog.length) return;
    const events = buildBadgeEvents({
      campaigns: campaignsFrom(stored).campaigns,
      rewards: rewardsFrom(stored).rewards,
      catalog,
      previous: eventsFrom(stored).events,
      now: clock,
    });
    await storage.set({ [BADGE_EVENTS_KEY]: { updatedAt: clock, events } });
  }
```

Remplacer `recordCampaigns`, `recordRewards` et `recordBadges` par :

```js
  function recordCampaigns(rawList, source) {
    return enqueue(async () => {
      const clock = now();
      const incoming = normalizeCampaigns(rawList);
      if (!incoming.length) return { recorded: false, details: [] };
      const previous = campaignsFrom(await storage.get([DROPS_CAMPAIGNS_KEY])).campaigns;
      const campaigns = mergeCampaigns(previous, incoming, clock);
      await storage.set({ [DROPS_CAMPAIGNS_KEY]: { updatedAt: clock, source: String(source || ""), campaigns } });
      await relinkBadges(clock);
      return { recorded: true, count: campaigns.length, details: campaignsNeedingDetails(campaigns, clock) };
    });
  }

  /** Détail des campagnes demandé par le relais ; renvoie les suivantes à lire. */
  function recordCampaignDetails(rawList, ids) {
    return enqueue(async () => {
      const clock = now();
      const stored = campaignsFrom(await storage.get([DROPS_CAMPAIGNS_KEY]));
      const asked = (Array.isArray(ids) ? ids : []).map(String).filter(Boolean);
      if (!stored.campaigns.length || !asked.length) return { recorded: false, details: [] };
      const campaigns = applyCampaignDetails(stored.campaigns, rawList, asked, clock);
      await storage.set({ [DROPS_CAMPAIGNS_KEY]: { ...stored, campaigns } });
      await relinkBadges(clock);
      return { recorded: true, details: campaignsNeedingDetails(campaigns, clock) };
    });
  }

  function recordRewards(rawList) {
    return enqueue(async () => {
      const clock = now();
      const rewards = normalizeRewards(rawList);
      await storage.set({ [DROPS_REWARDS_KEY]: { updatedAt: clock, rewards } });
      await relinkBadges(clock);
      return { recorded: true, count: rewards.length };
    });
  }

  function recordBadges(raw) {
    return enqueue(async () => {
      const clock = now();
      const result = mergeBadges(badgesFrom(await storage.get([DROPS_BADGES_KEY])), raw, clock);
      if (result.state.updatedAt) await storage.set({ [DROPS_BADGES_KEY]: result.state });
      await relinkBadges(clock);
      return { added: result.added };
    });
  }

  /** Dates d'ajout des badges notées par streampulse.fr. */
  function recordBadgeAdded(raw) {
    return enqueue(async () => {
      const added = normalizeAdded(raw);
      await storage.set({ [BADGE_ADDED_KEY]: { fetchedAt: now(), added } });
      return { recorded: true, count: Object.keys(added).length };
    });
  }
```

et compléter le `return` final : `recordCampaignDetails, recordBadgeAdded`.

- [ ] **Étape 4 : message** — dans `js/sw/messages-drops.js`, après `handleRecordDropsCampaigns` :

```js
export function handleRecordDropsCampaignDetails(request, sender, sendResponse) {
  (async () => {
    try {
      const prefs = await PreferenceStore.get();
      const result = prefs.dropsTracking === false || request.ok !== true
        ? { recorded: false, details: [] }
        : await dropsStore.recordCampaignDetails(request.data, request.ids);
      sendResponse({ success: true, ...result });
    } catch (error) {
      sendResponse({ error: error?.message || String(error) });
    }
  })();
  return true;
}
```

Dans `js/sw/messages.js`, importer `handleRecordDropsCampaignDetails` et ajouter
`recordDropsCampaignDetails: handleRecordDropsCampaignDetails,` après `recordDropsCampaigns`.

- [ ] **Étape 5 : lancer** `node --test tests/drops-store.test.mjs tests/message-dispatch.test.mjs` →
  SUCCÈS.

- [ ] **Étape 6 : point de commit** : `feat: le service worker range le détail des campagnes et relie les badges`.

---

### Tâche 5 : Pont et relais (`js/inject/drops-bridge.js`, `js/dropsRecorder.js`)

**Fichiers :**
- Modifier : `js/inject/drops-bridge.js`, `js/dropsRecorder.js`, `tests/drops-bridge.test.mjs`,
  `tests/drops-recorder.test.mjs`

**Interfaces :**
- Consomme : réponse `details: string[]` des messages `recordDropsCampaigns` et
  `recordDropsCampaignDetails` (tâche 4).
- Produit : commande `details` `{ ids }` → résultat `{ campaigns: object[], ids: string[] }` ; le relais
  envoie `recordDropsCampaignDetails` `{ ok, data, ids, error }`.

- [ ] **Étape 1 : tests en échec** — dans `tests/drops-bridge.test.mjs`, remplacer les deux tests
  « sans en-tête d'intégrité, les campagnes viennent du cache Apollo de la page » et « avec l'en-tête
  d'intégrité, les campagnes viennent de GraphQL ; un refus retombe sur le cache » par :

```js
const withIntegrity = async (box) => box.win.fetch(GQL, { headers: { Authorization: "OAuth t", "Client-Integrity": "v4" } });

test("sans en-tête d'intégrité, la liste des campagnes n'est pas demandée", async () => {
  const box = sandbox({ cookie: "auth-token=t" });
  const result = await box.run("campaigns");
  assert.deepEqual([result.ok, result.error], [false, "unavailable"]);
  assert.equal(box.requests.length, 0);
});

test("la liste des campagnes est demandée avec les Drops de chaque campagne", async () => {
  const campaigns = [{ id: "c1", name: "ELDEN RING", game: { displayName: "ELDEN RING" }, timeBasedDrops: [] }];
  const box = sandbox({ respond: () => ({ data: { currentUser: { id: "1", dropCampaigns: campaigns } } }) });
  await withIntegrity(box);
  const result = await box.run("campaigns");
  assert.deepEqual([result.ok, result.data.source, result.data.campaigns], [true, "gql", campaigns]);
  assert.match(box.requests[1].body.query, /timeBasedDrops[\s\S]*requiredSubs[\s\S]*distributionType/);
});

test("si Twitch refuse les Drops dans la liste, la liste est relue sans", async () => {
  const campaigns = [{ id: "c1", name: "HEAT", game: { displayName: "World of Tanks: HEAT" } }];
  const box = sandbox({
    respond: (url, init, count) => (count === 2
      ? { data: null, errors: [{ message: "Cannot query field \"requiredSubs\" on type \"TimeBasedDrop\"." }] }
      : { data: { currentUser: { id: "1", dropCampaigns: campaigns } } }),
  });
  await withIntegrity(box);
  const result = await box.run("campaigns");
  assert.equal(result.ok, true);
  assert.doesNotMatch(box.requests[2].body.query, /timeBasedDrops/);
});

test("le détail de 5 campagnes au plus part en une seule requête, identifiants vérifiés", async () => {
  const box = sandbox({
    respond: () => ({ data: { currentUser: { id: "1", c0: { id: "a-1", timeBasedDrops: [{ id: "d" }] }, c1: null, c2: { id: "d", timeBasedDrops: [] } } } }),
  });
  await withIntegrity(box);
  const result = await box.run("details", { ids: ["a-1", 'b"} evil', "c", "d", "e", "f", "g"] });
  assert.equal(result.ok, true);
  assert.equal(box.requests.length, 2, "une seule requête de détail");
  const query = box.requests[1].body.query;
  assert.match(query, /c0: dropCampaign\(id: "a-1"\)/);
  assert.doesNotMatch(query, /evil/);
  assert.deepEqual(result.data.ids, ["a-1", "c", "d", "e", "f"]);
  assert.deepEqual(result.data.campaigns.map((c) => c.id), ["a-1", "d"]);
});

test("sans en-tête d'intégrité, aucun détail n'est demandé", async () => {
  const box = sandbox({ cookie: "auth-token=t" });
  const result = await box.run("details", { ids: ["a-1"] });
  assert.deepEqual([result.ok, result.error], [false, "integrity"]);
  assert.equal(box.requests.length, 0);
});
```

Supprimer l'option `apollo` du `sandbox` (et la ligne `__APOLLO_CLIENT__`) si plus aucun test ne s'en
sert. Dans `tests/drops-recorder.test.mjs`, ajouter :

```js
test("le détail demandé par le service worker part vers le pont, puis au plus une fois par minute", async (t) => {
  let clock = 1_000_000;
  t.mock.method(Date, "now", () => clock);
  const box = sandbox({
    respond: (message) => (message.type === "recordDropsCampaigns" ? { details: ["c-p3", "c-ac"] } : message.type === "recordDropsCampaignDetails" ? { details: ["c-x1"] } : {}),
  });
  box.fromPage({ source: "streampulse:drops", v: 1, kind: "result", action: "campaigns", ok: true, data: { campaigns: [{ id: "c-p3" }], source: "gql" } });
  await box.flush();
  const [details] = box.commands();
  assert.deepEqual([details.action, details.ids], ["details", ["c-p3", "c-ac"]]);

  box.fromPage({ source: "streampulse:drops", v: 1, kind: "result", action: "details", ok: true, data: { campaigns: [], ids: ["c-p3", "c-ac"] } });
  await box.flush();
  assert.deepEqual(box.sent.at(-1), { type: "recordDropsCampaignDetails", ok: true, data: [], ids: ["c-p3", "c-ac"], error: undefined });
  assert.equal(box.commands().length, 1, "la suite attend la minute suivante");

  clock += 61_000;
  box.timers[0]();
  // Le passage suivant relit aussi inventaire et campagnes : on cherche la demande de détail.
  assert.deepEqual(box.commands().filter((command) => command.action === "details").at(-1).ids, ["c-x1"]);
});
```

- [ ] **Étape 2 : lancer** `node --test tests/drops-bridge.test.mjs tests/drops-recorder.test.mjs` →
  ÉCHEC attendu.

- [ ] **Étape 3 : implémenter le pont** (`js/inject/drops-bridge.js`).

Après `CAMPAIGNS_QUERY_LITE` :

```js
  // Drops d'une campagne : dates, condition (minutes ou abonnements) et récompenses.
  const DROP_FIELDS = `timeBasedDrops {
        id name startAt endAt requiredMinutesWatched requiredSubs
        benefitEdges { benefit { id name distributionType } }
      }`;

  // La liste avec les Drops de chaque campagne : de quoi relier les badges sans autre requête.
  const CAMPAIGNS_QUERY_DROPS = `query StreamPulseDropCampaignsDrops {
  currentUser {
    id
    dropCampaigns {
      id name status startAt endAt accountLinkURL
      self { isAccountConnected }
      game { id displayName boxArtURL }
      owner { id name }
      ${DROP_FIELDS}
    }
  }
}`;

  const SCHEMA_ERROR = /Cannot query field|Unknown (type|argument)/i;
  const CAMPAIGN_ID = /^[\w-]{1,80}$/;
  const DETAILS_MAX = 5;
```

Dans `gqlWithFallback`, remplacer la regex en ligne par `SCHEMA_ERROR.test(message)`. Supprimer les
fonctions `field` et `campaignsFromApollo`, puis remplacer `readCampaigns` par :

```js
  /** La liste avec les Drops de chaque campagne, sinon sans (repli complet, puis minimal). */
  async function readCampaignList() {
    try {
      const result = await gql(CAMPAIGNS_QUERY_DROPS);
      if (!result.errors.some((message) => SCHEMA_ERROR.test(message))) return result;
    } catch (error) {
      if (error.code !== "graphql") throw error;
    }
    return gqlWithFallback(CAMPAIGNS_QUERY, CAMPAIGNS_QUERY_LITE);
  }

  async function readCampaigns() {
    // Sans en-tête d'intégrité, Twitch refuse la liste : inutile d'essayer.
    if (!seen["client-integrity"]) throw failure("unavailable");
    const { data } = await readCampaignList();
    if (!data.currentUser) throw failure("signed-out");
    const list = data.currentUser.dropCampaigns;
    if (!Array.isArray(list) || !list.length) throw failure("unavailable");
    return { campaigns: list, source: "gql" };
  }

  /**
   * Détail de campagnes précises (5 au plus), en une requête : quand la liste
   * revient sans les Drops, c'est lui qui relie les badges à leur campagne.
   */
  async function readDetails(ids) {
    const wanted = (Array.isArray(ids) ? ids : []).map(String).filter((id) => CAMPAIGN_ID.test(id)).slice(0, DETAILS_MAX);
    if (!wanted.length) return { campaigns: [], ids: [] };
    if (!seen["client-integrity"]) throw failure("integrity");
    const fields = wanted.map((id, index) => `c${index}: dropCampaign(id: ${JSON.stringify(id)}) { id ${DROP_FIELDS} }`).join("\n    ");
    const { data } = await gql(`query StreamPulseDropCampaignDetails {\n  currentUser {\n    id\n    ${fields}\n  }\n}`);
    if (!data.currentUser) throw failure("signed-out");
    const campaigns = wanted.map((id, index) => data.currentUser[`c${index}`]).filter((item) => item && typeof item === "object");
    return { campaigns, ids: wanted };
  }
```

Dans `ACTIONS`, ajouter `details: (message) => readDetails(message.ids),`. Mettre à jour le commentaire
d'en-tête : commandes « inventory », « campaigns », « details », « claim ».

- [ ] **Étape 4 : implémenter le relais** (`js/dropsRecorder.js`).

Après `CAMPAIGNS_RETRY_MS` :

```js
  // Détail des campagnes demandé par le service worker : au plus une demande par minute.
  const DETAILS_EVERY_MS = 60_000;
```

Après `let timer = null;` :

```js
  let pendingDetails = [];
  let detailsAt = 0;
```

Avant `onResult`, ajouter :

```js
  /** Campagnes dont le service worker veut le détail : tout de suite, puis au plus une demande par minute. */
  function queueDetails(ids) {
    pendingDetails = Array.isArray(ids) ? ids.filter((id) => typeof id === "string" && id).slice(0, 5) : [];
    askDetails();
  }

  function askDetails() {
    if (!enabled || !pendingDetails.length || Date.now() < detailsAt) return;
    detailsAt = Date.now() + DETAILS_EVERY_MS;
    const ids = pendingDetails;
    pendingDetails = [];
    command("details", { ids });
  }
```

Dans `onResult`, remplacer la branche `campaigns` et ajouter `details` :

```js
    } else if (message.action === "campaigns" && message.ok) {
      const response = await send({ type: "recordDropsCampaigns", data: message.data?.campaigns, source: message.data?.source });
      queueDetails(response?.details);
    } else if (message.action === "details") {
      const response = await send({ type: "recordDropsCampaignDetails", ok: message.ok === true, data: message.data?.campaigns, ids: message.data?.ids, error: message.error });
      queueDetails(response?.details);
    } else if (message.action === "claim") {
```

Au début de `tick()`, après la garde `if (!enabled || !contextAlive()) return;`, ajouter `askDetails();`.

- [ ] **Étape 5 : lancer** `node --test tests/drops-bridge.test.mjs tests/drops-recorder.test.mjs` →
  SUCCÈS.

- [ ] **Étape 6 : point de commit** : `feat: le pont lit les Drops des campagnes et leur détail, 5 par minute`.

---

### Tâche 6 : Dates d'ajout du site dans le service worker (`js/sw/drops.js`)

**Fichiers :** Modifier : `js/sw/drops.js`

**Interfaces :** Consomme `dropsStore.recordBadgeAdded`, `addedFrom`, `BADGE_ADDED_KEY`.

- [ ] **Étape 1 : implémenter.** Importer `BADGE_ADDED_KEY` et `addedFrom` depuis `../drops-data.js`.
  Avant `refreshRewardsFromWorker`, ajouter :

```js
/** Dates d'ajout des badges notées par streampulse.fr (le CDN garde la réponse 10 min). */
const BADGE_ADDED_URL = "https://streampulse.fr/api/twitch-badges?added=1";
const BADGE_ADDED_EVERY_MS = 6 * 3_600_000;

/** Relues toutes les 6 h, ou tout de suite quand un badge vient d'apparaître. */
async function refreshBadgeAdded({ force = false } = {}) {
  const { fetchedAt } = addedFrom(await chrome.storage.local.get(BADGE_ADDED_KEY));
  if (!force && Date.now() - fetchedAt < BADGE_ADDED_EVERY_MS) return;
  const response = await fetch(BADGE_ADDED_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  await dropsStore.recordBadgeAdded(json?.added);
}
```

Dans `refreshRewardsFromWorker`, remplacer le bloc des badges globaux par :

```js
  // En mode auto, les badges obtenus se relisent à chaque passage pour fermer l'onglet au plus vite.
  let freshBadge = false;
  if (stored[BADGE_AUTO_KEY] || now - (Number(stored.streamPulseDropsBadges?.updatedAt) || 0) >= maxAgeMs) {
    const result = await dropsClient.readBadges().then((raw) => dropsStore.recordBadges(raw)).catch(warn("badges globaux"));
    if (result) {
      freshBadge = result.added.length > 0;
      announceBadges(result.added).catch(warnWith("annonce des badges"));
    }
  }
  await refreshBadgeAdded({ force: freshBadge }).catch(warnWith("dates d'ajout des badges"));
  await checkBadgeAuto();
```

- [ ] **Étape 2 : vérifier** `node --check js/sw/drops.js` puis `npm test` → SUCCÈS.

- [ ] **Étape 3 : point de commit** : `feat: dates d'ajout des badges lues sur streampulse.fr`.

---

### Tâche 7 : Site — dates d'ajout et relevé quotidien (dépôt `StreampulseSite`)

**Fichiers :**
- Modifier : `api/twitch-badges.mjs`, `vercel.json`
- Créer : `api/twitch-badges-refresh.mjs`

**Interfaces :** Produit `GET /api/twitch-badges?added=1` → `{ added: { setID: ms } }` ;
`GET /api/twitch-badges-refresh` → `{ ok, count, at }` (no-store).

- [ ] **Étape 1 : branche** `git -C ~/dev/StreampulseSite switch -c feat/badges-added`.

- [ ] **Étape 2 : implémenter** dans `api/twitch-badges.mjs` :
  - `const CATALOG_MAX_AGE_MS = 10 * 60 * 1000;`
  - `async function catalog()` devient `export async function catalog()` ;
  - après `catalog()`, ajouter :

```js
/** HGETALL d'Upstash (liste plate champ, valeur…) → { setID: ms } des dates connues. */
export function firstSeenMap(flat) {
  const added = {};
  const items = Array.isArray(flat) ? flat : [];
  for (let i = 0; i + 1 < items.length; i += 2) {
    const at = Number(items[i + 1]) || 0;
    if (at > 0 && ID_RE.test(String(items[i]))) added[items[i]] = at;
  }
  return added;
}
```

  - dans le handler, juste après le refus des méthodes autres que GET, ajouter :

```js
  // Dates d'ajout de tous les badges, pour l'onglet Badges de l'extension.
  if (req.query.added === '1') {
    try {
      await catalog();
      const added = firstSeenMap(await redis(['HGETALL', FIRST_SEEN_KEY]));
      res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
      return res.status(200).json({ added });
    } catch (error) {
      console.error('[twitch-badges] dates d\'ajout :', error.message);
      return res.status(503).json({ error: 'unavailable' });
    }
  }
```

  - compléter le commentaire d'en-tête : `GET ?added=1 → { added: { id: ms } }`.

- [ ] **Étape 3 : route du cron** — `api/twitch-badges-refresh.mjs` :

```js
/**
 * Relevé quotidien du catalogue des badges Twitch (cron Vercel, plan Hobby) :
 * date l'apparition des nouveaux badges même sans visite. Sans effet si le
 * catalogue a moins de 10 minutes. Jamais mis en cache.
 */
import { catalog } from './twitch-badges.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const badges = await catalog();
    return res.status(200).json({ ok: true, count: Object.keys(badges).length, at: Date.now() });
  } catch (error) {
    console.error('[twitch-badges-refresh]', error.message);
    return res.status(503).json({ ok: false });
  }
}
```

- [ ] **Étape 4 : cron** — dans `vercel.json`, au premier niveau :

```json
  "crons": [
    { "path": "/api/twitch-badges-refresh", "schedule": "0 7 * * *" }
  ],
```

- [ ] **Étape 5 : vérifier sans secret** — script jetable dans le scratchpad : faux `fetch` qui joue
  Upstash (GET, SET, HSETNX, HLEN, HMGET, HGETALL, HSET en mémoire) et Helix (jeton + badges), faux
  `req`/`res`. Attendus : `?added=1` → 200, `{ added }` sans les badges du premier relevé (0), en-tête
  `s-maxage=600` ; la route du cron → 200, `no-store` ; deuxième appel à moins de 10 min → aucune
  requête Helix. Puis `node --check` sur les deux fichiers et `python3 -m json.tool vercel.json`.

- [ ] **Étape 6 : point de commit** (site) : `feat: dates d'ajout des badges pour l'extension et relevé quotidien`.
  Déploiement = push sur `main` du site, **après accord d'Alexis**.

---

### Tâche 8 : Écran — maquette 1 (`html/popup.html`, `css/popup.css`, `js/popup-drops.js`, `i18n`)

**Fichiers :** Modifier : `html/popup.html`, `css/popup.css`, `js/popup-drops.js`, `i18n/lang/*.js` (11)

**Interfaces :** Consomme `catalogBadges`, `countBadges`, `eventsFrom`, `addedFrom`, `activeRewards`.

- [ ] **Étape 1 : HTML** — dans `#menu-badges`, remplacer `.badges-toolbar` et les éléments jusqu'à
  `#drops-badges-sync` par :

```html
            <div class="badges-toolbar">
              <div class="segmented" id="badges-filters" role="group" data-i18n-attr-ariaLabel="popup.drops.badgeStatusLabel">
                <button type="button" class="pf-btn active" aria-pressed="true" data-filter="live"><span data-i18n="popup.drops.badgeFilterLive">En cours</span><em data-count="live"></em></button>
                <button type="button" class="pf-btn" aria-pressed="false" data-filter="soon"><span data-i18n="popup.drops.badgeFilterSoon">À venir</span><em data-count="soon"></em></button>
                <button type="button" class="pf-btn" aria-pressed="false" data-filter="ended"><span data-i18n="popup.drops.badgeFilterEnded">Terminés</span><em data-count="ended"></em></button>
                <button type="button" class="pf-btn" aria-pressed="false" data-filter="owned"><span data-i18n="popup.drops.badgeFilterOwned">Obtenus</span><em data-count="owned"></em></button>
              </div>
              <div class="segmented" id="badges-cost" role="group" data-i18n-attr-ariaLabel="popup.drops.badgeCostLabel">
                <button type="button" class="pf-btn active" aria-pressed="true" data-cost="all"><span data-i18n="popup.drops.badgeCostAll">Tous</span></button>
                <button type="button" class="pf-btn" aria-pressed="false" data-cost="free"><span data-i18n="popup.drops.badgeFilterFree">Gratuits</span></button>
                <button type="button" class="pf-btn" aria-pressed="false" data-cost="paid"><span data-i18n="popup.drops.badgeFilterPaid">Payants</span></button>
              </div>
              <label class="badges-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                <span class="visually-hidden" data-i18n="popup.drops.searchBadges">Chercher un badge</span>
                <input id="badges-search" type="search" autocomplete="off" spellcheck="false" data-i18n-attr-placeholder="popup.drops.searchBadges" placeholder="Chercher un badge" />
              </label>
            </div>
            <p class="badges-sort" id="badges-sort"></p>
            <ul class="badge-grid" id="badges-catalog"></ul>
            <p class="drops-empty" id="badges-catalog-empty" hidden></p>
            <button id="badges-more" class="button button-quiet" type="button" data-i18n="popup.drops.showMore" hidden>Voir plus</button>
            <p class="badges-note" data-i18n="popup.drops.catalogNote">Les dates viennent des campagnes Twitch, relues dès qu'un onglet Twitch est ouvert. Clique sur un badge en cours pour ouvrir un live où le gagner.</p>
            <p class="badges-note" id="badges-campaigns-note" role="status"></p>
            <p class="badges-note" id="drops-badges-sync" role="status"></p>
```

Et dans les deux écrans verts, remplacer le texte par défaut `DISPONIBLES` par `EN COURS`.

- [ ] **Étape 2 : CSS** — dans `css/popup.css`, après `.badges-note:empty { display: none; }` :

```css
.badges-sort { margin: -4px 0 8px; color: var(--text-3); font-size: 11px; }
.badges-sort:empty { display: none; }
.badge-card-added { color: var(--text-3); font-size: 10.5px; }
.badge-status-soon { padding: 1px 7px; border: 1px solid var(--violet-line); border-radius: 999px; background: var(--violet-soft); color: var(--violet-text); font-size: 10.5px; font-weight: 800; white-space: nowrap; }
.badge-card.is-soon { box-shadow: none; outline: 1px dashed var(--violet-line); outline-offset: -1px; }
.badge-card.is-ended { opacity: 0.6; }
.badge-card.is-ended img { filter: grayscale(1); }
```

- [ ] **Étape 3 : JS** — `js/popup-drops.js` :
  - imports : retirer `activeNames` ; ajouter `addedFrom`, `countBadges`, `eventsFrom` ;
  - état : `let badgeEvents = eventsFrom({});`, `let badgeAdded = addedFrom({});`,
    `let badgeFilter = "live";`, `let badgeCost = "all";` (remplace `let badgeFilter = "all";`) ;
  - constantes :

```js
/** Au-delà, l'onglet Badges signale que les campagnes n'ont pas été relues. */
const CAMPAIGNS_OLD_MS = 12 * 3_600_000;
const BADGE_SORT_KEYS = Object.freeze({ live: "popup.drops.badgeSortLive", soon: "popup.drops.badgeSortSoon", ended: "popup.drops.badgeSortEnded", owned: "popup.drops.badgeSortOwned" });
const BADGE_EMPTY_KEYS = Object.freeze({ live: "popup.drops.badgesEmptyLive", soon: "popup.drops.badgesEmptySoon", ended: "popup.drops.badgesEmptyEnded", owned: "popup.drops.badgesEmptyOwned" });
```

  - remplacer `badgeCard` par :

```js
/** Statut au pied d'une carte : « finit dans … », « À venir » ou « dès le … », « Terminé le … ». */
function statusNodes(status, startsAt, endsAt, now) {
  if (status === "soon") return [el("span", "badge-status-soon", startsAt > now ? t("popup.drops.badgeStartsOn", { date: shortDate(startsAt) }) : t("popup.drops.badgeSoon"))];
  if (status === "ended") return endsAt ? [el("span", "badge-when", t("popup.drops.badgeEndedOn", { date: shortDate(endsAt) }))] : [];
  if (endsAt > now) return [el("span", endsAt - now < 48 * 3_600_000 ? "badge-when is-soon" : "badge-when", t("popup.drops.endsIn", { time: spanLabel(endsAt - now) }))];
  return [];
}

/**
 * Carte d'un badge ou d'une récompense : image, nom, condition courte, jeu,
 * date d'ajout, coût et statut. Un clic ouvre un live où la gagner, seulement
 * si le badge est en cours.
 */
function badgeCard({ title, image, condition, fallback, game, gameId, link, clickable = true, paid, owned, status = "live", startsAt = 0, endsAt = 0, addedAt = 0, tooltip, autoId }) {
  const now = Date.now();
  const item = el("li");
  const target = clickable && (game || link);
  const classes = ["badge-card", owned ? "is-owned" : "", status === "soon" ? "is-soon" : "", status === "ended" ? "is-ended" : ""].filter(Boolean).join(" ");
  const card = el(target ? "button" : "div", classes);
  if (target && game) {
    card.type = "button";
    card.dataset.gameId = gameId || "";
    card.dataset.game = game;
  } else if (target) {
    card.type = "button";
    card.dataset.url = link;
  }
  if (tooltip) card.title = tooltip;
  const art = el("span", "badge-card-art");
  if (image) {
    const img = el("img");
    img.src = image;
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => img.remove();
    art.append(img);
  }
  if (owned) art.append(el("span", "badge-card-check", "✓"));
  const body = el("span", "badge-card-body");
  body.append(el("b", null, title));
  const line = [condition, game].filter(Boolean).join(" · ");
  body.append(el("small", line ? "badge-card-cond" : "badge-card-cond is-long", line || fallback || ""));
  if (addedAt) body.append(el("small", "badge-card-added", t("popup.drops.badgeAddedOn", { date: shortDate(addedAt) })));
  const foot = el("span", "badge-card-foot");
  foot.append(el("span", owned ? "badge-pill is-owned" : paid ? "badge-pill is-paid" : "badge-pill is-free", t(owned ? "popup.drops.badgeOwned" : paid ? "popup.drops.badgePaid" : "popup.drops.badgeFree")));
  foot.append(...statusNodes(status, startsAt, endsAt, now));
  card.append(art, body, foot);
  item.append(card);
```

  suivi du bloc du bouton « Obtenir en auto » **inchangé** (`if (autoId && !owned) { … }`), puis
  `return item; }` ;
  - remplacer `badgeRow` par :

```js
function badgeRow(badge) {
  const text = badgeText[getCurrentLanguage()]?.[badge.id]?.text || badge.description;
  const event = badge.event;
  return badgeCard({
    title: badge.title,
    image: sharpImage(badge.image),
    condition: event?.minutes ? t("popup.drops.badgeWatch", { time: minutesLabel(event.minutes) }) : badgeCondition(badge.description),
    fallback: text,
    game: event?.game || categoryOf(badge.description) || gameFromDescription(badge.description),
    gameId: event?.gameId || "",
    link: badge.campaign ? "" : badge.url,
    // Seul un badge en cours ouvre un live : à venir ou terminé, il n'y a rien à gagner.
    clickable: badge.status === "live",
    paid: badge.paid,
    owned: badge.owned,
    status: badge.status,
    startsAt: event?.startsAt || 0,
    endsAt: event?.endsAt || 0,
    addedAt: badge.addedAt,
    tooltip: text,
    // Le mode auto a besoin d'un Drop en cours : c'est lui qui dit où regarder.
    autoId: badge.campaign && !badge.paid ? badge.id : "",
  });
}
```

  - remplacer `renderCatalog` par :

```js
function setPressed(selector, isActive, extra) {
  document.querySelectorAll(selector).forEach((button) => {
    const active = isActive(button);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    extra?.(button);
  });
}

/** Note sous la grille : campagnes jamais lues, ou pas relues depuis 12 h. */
function renderBadgesNote(now) {
  const note = $("badges-campaigns-note");
  if (!note) return;
  const at = campaigns.updatedAt;
  note.textContent = !at ? t("popup.drops.badgesCampaignsNever") : now - at > CAMPAIGNS_OLD_MS ? t("popup.drops.badgesCampaignsOld", { date: dateTime(at) }) : "";
}

function renderCatalog() {
  if (!$("badges-catalog")) return;
  renderAutoBar();
  const now = Date.now();
  const context = { now, events: badgeEvents.events, added: badgeAdded.added };
  const counts = countBadges(badges, context);
  // Les récompenses de campagne en cours comptent avec les badges en cours.
  const running = activeRewards(rewards.rewards, now);
  const rewardPaid = (reward) => reward.subsGoal > 0 && !reward.minutesGoal;
  const live = counts.live + running.length;
  const liveFree = counts.liveFree + running.filter((reward) => !rewardPaid(reward)).length;
  const plus = deps.isPlus();
  $("badges-locked").hidden = plus;
  $("badges-content").hidden = !plus;
  const filterCounts = { live, soon: counts.soon, ended: counts.ended, owned: counts.owned };
  setPressed("#badges-filters [data-filter]", (button) => button.dataset.filter === badgeFilter, (button) => {
    const count = button.querySelector("[data-count]");
    if (count) count.textContent = String(filterCounts[button.dataset.filter] ?? 0);
  });
  setPressed("#badges-cost [data-cost]", (button) => button.dataset.cost === badgeCost);
  const list = catalogBadges(badges, { ...context, status: badgeFilter, cost: badgeCost, query: badgeQuery });
  const needle = badgeQuery.trim().toLowerCase();
  const rewardCards = badgeFilter !== "live" ? [] : running
    .filter((reward) => badgeCost === "all" || rewardPaid(reward) === (badgeCost === "paid"))
    .filter((reward) => !needle || `${reward.name} ${reward.brand} ${reward.game} ${reward.rewards.map((item) => item.name).join(" ")}`.toLowerCase().includes(needle));
  const shown = list.slice(0, badgeLimit);
  $("badges-catalog").replaceChildren(...rewardCards.map(rewardCard), ...shown.map(badgeRow));
  translateBadges(shown.filter((badge) => !badgeCondition(badge.description)).map((badge) => badge.id));
  const empty = list.length + rewardCards.length === 0;
  $("badges-catalog-empty").hidden = !empty;
  $("badges-catalog-empty").textContent = needle ? t("popup.drops.noBadgeMatch") : t(BADGE_EMPTY_KEYS[badgeFilter]);
  $("badges-sort").textContent = empty ? "" : t(BADGE_SORT_KEYS[badgeFilter]);
  $("badges-more").hidden = list.length <= badgeLimit;
  $("badges-total").textContent = String(live);
  $("badges-teaser").hidden = plus || live === 0;
  $("badges-teaser-total").textContent = String(live);
  const soonLine = t("popup.drops.badgesLcdSoon", { count: counts.soon });
  const freeLine = t("popup.drops.badgesLcdFree", { count: liveFree });
  $("badges-teaser-meta").replaceChildren(el("span", null, freeLine));
  $("badges-lcd-meta").replaceChildren(el("span", null, soonLine), el("span", null, freeLine));
  renderBadgesNote(now);
}
```

  - `bind()` : garder le clic sur `#badges-filters` ; ajouter :

```js
  $("badges-cost")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cost]");
    if (!button) return;
    badgeCost = button.dataset.cost;
    badgeLimit = 40;
    renderCatalog();
  });
```

  - `toggleAuto` : remplacer les deux lignes `const context = …` / `const campaign = …` par :

```js
  const campaign = badge && catalogBadges({ ...badges, badges: [badge] }, { status: "live", now: Date.now(), events: badgeEvents.events, added: badgeAdded.added })[0]?.campaign;
```

  - `reload()` : après `badges = badgesFrom(stored);`, ajouter `badgeEvents = eventsFrom(stored);` et
    `badgeAdded = addedFrom(stored);`.

- [ ] **Étape 4 : textes** — dans les 11 fichiers `i18n/lang/<code>.js`, bloc `popup.drops` :
  supprimer `allBadges`, `badgeFilterMissing`, `badgesLcdOwned` ; remplacer `badgesUnit` et
  `catalogNote` ; ajouter les 21 clés (après `badgeFilterOwned`) :

| clé | fr | en | es | pt-BR | de | it |
|---|---|---|---|---|---|---|
| badgesUnit | EN COURS | ACTIVE | ACTIVAS | ATIVOS | AKTIV | ATTIVI |
| badgeFilterLive | En cours | Active | Activas | Ativos | Aktiv | Attivi |
| badgeFilterSoon | À venir | Upcoming | Próximas | Em breve | Demnächst | In arrivo |
| badgeFilterEnded | Terminés | Ended | Terminadas | Encerrados | Beendet | Terminati |
| badgeCostAll | Tous | All | Todas | Todos | Alle | Tutti |
| badgeStatusLabel | Filtrer par statut | Filter by status | Filtrar por estado | Filtrar por status | Nach Status filtern | Filtra per stato |
| badgeCostLabel | Filtrer par coût | Filter by cost | Filtrar por coste | Filtrar por custo | Nach Kosten filtern | Filtra per costo |
| badgeSortLive | Fin la plus proche d'abord | Ending soonest first | Primero las que terminan antes | Primeiro os que terminam antes | Bald endende zuerst | Prima quelli in scadenza |
| badgeSortSoon | Datés d'abord, puis ajoutés récemment | Dated first, then recently added | Primero las que tienen fecha, luego las añadidas hace poco | Primeiro os com data, depois os adicionados há pouco | Zuerst mit Datum, dann kürzlich hinzugefügt | Prima quelli con data, poi i più recenti |
| badgeSortEnded | Terminés ces 7 derniers jours | Ended in the last 7 days | Terminadas en los últimos 7 días | Encerrados nos últimos 7 dias | In den letzten 7 Tagen beendet | Terminati negli ultimi 7 giorni |
| badgeSortOwned | Déjà sur ton compte | Already on your account | Ya en tu cuenta | Já na sua conta | Schon in deinem Konto | Già sul tuo account |
| badgesEmptyLive | Aucun badge en cours pour l'instant. | No active badges right now. | Ninguna insignia activa por ahora. | Nenhum emblema ativo no momento. | Gerade keine aktiven Abzeichen. | Nessun badge attivo al momento. |
| badgesEmptySoon | Aucun badge à venir pour l'instant. | No upcoming badges right now. | Ninguna insignia próxima por ahora. | Nenhum emblema a caminho no momento. | Gerade keine kommenden Abzeichen. | Nessun badge in arrivo al momento. |
| badgesEmptyEnded | Aucun badge terminé ces 7 derniers jours. | No badges ended in the last 7 days. | Ninguna insignia terminó en los últimos 7 días. | Nenhum emblema encerrado nos últimos 7 dias. | In den letzten 7 Tagen ist kein Abzeichen beendet worden. | Nessun badge terminato negli ultimi 7 giorni. |
| badgesEmptyOwned | Aucun badge obtenu parmi ceux-ci. | None of these badges is on your account yet. | Todavía no tienes ninguna de estas insignias. | Você ainda não tem nenhum destes emblemas. | Du hast noch keines dieser Abzeichen. | Non hai ancora nessuno di questi badge. |
| badgeEndedOn | Terminé le {{date}} | Ended {{date}} | Terminó el {{date}} | Encerrado em {{date}} | Beendet am {{date}} | Terminato il {{date}} |
| badgeAddedOn | Ajouté le {{date}} | Added {{date}} | Añadida el {{date}} | Adicionado em {{date}} | Hinzugefügt am {{date}} | Aggiunto il {{date}} |
| badgeSoon | À venir | Upcoming | Próximamente | Em breve | Demnächst | In arrivo |
| badgeStartsOn | dès le {{date}} | from {{date}} | desde el {{date}} | a partir de {{date}} | ab {{date}} | dal {{date}} |
| badgesLcdSoon | À venir : {{count}} | Upcoming: {{count}} | Próximas: {{count}} | Em breve: {{count}} | Demnächst: {{count}} | In arrivo: {{count}} |
| badgesCampaignsOld | Campagnes relues le {{date}} | Campaigns last read {{date}} | Campañas leídas por última vez el {{date}} | Campanhas lidas pela última vez em {{date}} | Kampagnen zuletzt gelesen am {{date}} | Campagne lette l'ultima volta il {{date}} |
| badgesCampaignsNever | Ouvre Twitch une fois pour charger les dates des campagnes. | Open Twitch once to load campaign dates. | Abre Twitch una vez para cargar las fechas de las campañas. | Abra a Twitch uma vez para carregar as datas das campanhas. | Öffne Twitch einmal, um die Kampagnendaten zu laden. | Apri Twitch una volta per caricare le date delle campagne. |

| clé | pl | tr | ru | ja | ko |
|---|---|---|---|---|---|
| badgesUnit | AKTYWNE | AKTİF | АКТИВНЫ | 開催中 | 진행 중 |
| badgeFilterLive | Aktywne | Aktif | Активные | 開催中 | 진행 중 |
| badgeFilterSoon | Nadchodzące | Yakında | Скоро | 近日開始 | 예정 |
| badgeFilterEnded | Zakończone | Sona eren | Завершённые | 終了 | 종료 |
| badgeCostAll | Wszystkie | Tümü | Все | すべて | 전체 |
| badgeStatusLabel | Filtruj według statusu | Duruma göre filtrele | Фильтр по статусу | 状態で絞り込む | 상태별 필터 |
| badgeCostLabel | Filtruj według kosztu | Maliyete göre filtrele | Фильтр по стоимости | 費用で絞り込む | 비용별 필터 |
| badgeSortLive | Najpierw kończące się najwcześniej | Önce en yakında bitenler | Сначала те, что скоро закончатся | 終了が近い順 | 종료 임박 순 |
| badgeSortSoon | Najpierw z datą, potem ostatnio dodane | Önce tarihi belli olanlar, sonra yeni eklenenler | Сначала с датой, затем недавно добавленные | 日付ありを先に、次に追加が新しい順 | 날짜가 정해진 배지 먼저, 그다음 최근 추가순 |
| badgeSortEnded | Zakończone w ciągu ostatnich 7 dni | Son 7 günde sona erenler | Завершились за последние 7 дней | 過去7日間に終了 | 최근 7일 이내 종료 |
| badgeSortOwned | Już na twoim koncie | Hesabında zaten var | Уже в твоём аккаунте | アカウントに追加済み | 이미 계정에 있음 |
| badgesEmptyLive | Brak aktywnych odznak w tej chwili. | Şu anda aktif rozet yok. | Сейчас нет активных значков. | 現在開催中のバッジはありません。 | 현재 진행 중인 배지가 없습니다. |
| badgesEmptySoon | Brak nadchodzących odznak w tej chwili. | Şu anda yakında gelecek rozet yok. | Сейчас нет ожидаемых значков. | 現在予定されているバッジはありません。 | 현재 예정된 배지가 없습니다. |
| badgesEmptyEnded | W ciągu ostatnich 7 dni nie zakończyła się żadna odznaka. | Son 7 günde sona eren rozet yok. | За последние 7 дней не завершилось ни одного значка. | 過去7日間に終了したバッジはありません。 | 최근 7일 이내 종료된 배지가 없습니다. |
| badgesEmptyOwned | Nie masz jeszcze żadnej z tych odznak. | Bu rozetlerden henüz hiçbiri sende yok. | У тебя пока нет ни одного из этих значков. | これらのバッジはまだ取得していません。 | 아직 이 배지 중 획득한 것이 없습니다. |
| badgeEndedOn | Zakończono {{date}} | {{date}} tarihinde sona erdi | Завершён {{date}} | {{date}}に終了 | {{date}} 종료 |
| badgeAddedOn | Dodano {{date}} | {{date}} tarihinde eklendi | Добавлен {{date}} | {{date}}に追加 | {{date}} 추가 |
| badgeSoon | Wkrótce | Yakında | Скоро | 近日開始 | 예정 |
| badgeStartsOn | od {{date}} | {{date}} itibarıyla | с {{date}} | {{date}}から | {{date}}부터 |
| badgesLcdSoon | Nadchodzące: {{count}} | Yakında: {{count}} | Скоро: {{count}} | 近日：{{count}} | 예정: {{count}} |
| badgesCampaignsOld | Kampanie ostatnio odczytane {{date}} | Kampanyalar en son {{date}} tarihinde okundu | Кампании последний раз прочитаны {{date}} | キャンペーンの最終読み込み：{{date}} | 캠페인 마지막 확인: {{date}} |
| badgesCampaignsNever | Otwórz raz Twitcha, aby wczytać daty kampanii. | Kampanya tarihlerini yüklemek için Twitch'i bir kez aç. | Открой Twitch один раз, чтобы загрузить даты кампаний. | キャンペーンの日付を読み込むには、Twitchを一度開いてください。 | 캠페인 날짜를 불러오려면 Twitch를 한 번 열어 주세요. |

`catalogNote` :
- fr : Les dates viennent des campagnes Twitch, relues dès qu'un onglet Twitch est ouvert. Clique sur un badge en cours pour ouvrir un live où le gagner.
- en : Dates come from Twitch campaigns, re-read whenever a Twitch tab is open. Click an active badge to open a live where you can earn it.
- es : Las fechas vienen de las campañas de Twitch, que se vuelven a leer cada vez que hay una pestaña de Twitch abierta. Haz clic en una insignia activa para abrir un directo donde ganarla.
- pt-BR : As datas vêm das campanhas da Twitch, relidas sempre que uma aba da Twitch está aberta. Clique em um emblema ativo para abrir uma live onde ganhá-lo.
- de : Die Daten stammen aus den Twitch-Kampagnen und werden neu gelesen, sobald ein Twitch-Tab offen ist. Klick auf ein aktives Abzeichen, um einen passenden Livestream zu öffnen.
- it : Le date vengono dalle campagne di Twitch, rilette ogni volta che una scheda di Twitch è aperta. Clicca su un badge attivo per aprire una diretta dove ottenerlo.
- pl : Daty pochodzą z kampanii Twitcha, odczytywanych ponownie, gdy otwarta jest karta Twitcha. Kliknij aktywną odznakę, aby otworzyć transmisję, na której ją zdobędziesz.
- tr : Tarihler Twitch kampanyalarından gelir ve bir Twitch sekmesi açık olduğunda yeniden okunur. Aktif bir rozete tıklayarak onu kazanabileceğin bir yayını aç.
- ru : Даты берутся из кампаний Twitch и перечитываются, когда открыта вкладка Twitch. Нажми на активный значок, чтобы открыть эфир, где его можно заработать.
- ja : 日付はTwitchのキャンペーンから取得し、Twitchのタブを開くたびに読み直します。開催中のバッジをクリックすると、入手できる配信が開きます。
- ko : 날짜는 Twitch 캠페인에서 가져오며, Twitch 탭이 열려 있을 때마다 다시 읽습니다. 진행 중인 배지를 클릭하면 얻을 수 있는 방송이 열립니다.

- [ ] **Étape 5 : vérifier** `npm test`, `npm run lint`, `npm run verify` → SUCCÈS (aucune clé
  manquante ni utilisée sans traduction).

- [ ] **Étape 6 : point de commit** : `feat: onglet Badges en cours, à venir, terminés (maquette 1)`.

---

### Tâche 9 : Banc du popup (`scripts/dev/mock-chrome.js`)

**Fichiers :** Modifier : `scripts/dev/mock-chrome.js`

- [ ] **Étape 1 : données de démo** — dans `store`, à côté de `streamPulseDropsBadges`, ajouter un
  journal et des dates d'ajout qui montrent les quatre statuts avec les badges de démo existants :

```js
    // Journal des badges (tâche « statuts ») : en cours, terminé, et dates d'ajout du site.
    streamPulseBadgeEvents: dropsMode === "none" ? undefined : {
      updatedAt: now - 5 * 60e3,
      events: [
        { badgeId: "tarnished-sigil", kind: "drops", campaignId: "c-eld", dropId: "d1", game: "ELDEN RING", gameId: "512953", owner: "Twitch Gaming", startsAt: now - 3 * 24 * H, endsAt: now + 40 * H, minutes: 30, subs: 0, link: "reward", seenAt: now },
        { badgeId: "payday-mask", kind: "drops", campaignId: "c-pay", dropId: "d2", game: "PAYDAY 3", gameId: "1234567", owner: "Twitch Gaming", startsAt: now - 3 * 24 * H, endsAt: now + 14 * 24 * H, minutes: 60, subs: 0, link: "reward", seenAt: now },
        { badgeId: "ace-combat-8-nugget", kind: "drops", campaignId: "c-ac", dropId: "d3", game: "ACE COMBAT 8", gameId: "404069058", owner: "Twitch Gaming", startsAt: now - 6 * 24 * H, endsAt: now + 20 * 24 * H, minutes: 0, subs: 1, link: "reward", seenAt: now },
        { badgeId: "rematch-blue-lock", kind: "drops", campaignId: "c-rm", dropId: "d4", game: "REMATCH", gameId: "1362102608", owner: "Twitch Gaming", startsAt: now - 12 * 24 * H, endsAt: now + 16 * 24 * H, minutes: 30, subs: 0, link: "reward", seenAt: now },
        { badgeId: "d20", kind: "drops", campaignId: "c-dd", dropId: "d5", game: "Dungeons & Dragons", gameId: "509577", owner: "Twitch Gaming", startsAt: now - 12 * 24 * H, endsAt: now + 15 * 24 * H, minutes: 30, subs: 0, link: "reward", seenAt: now },
        { badgeId: "big-walk", kind: "drops", campaignId: "c-bw", dropId: "d6", game: "Big Walk", gameId: "1", owner: "Twitch Gaming", startsAt: now - 10 * 24 * H, endsAt: now - 30 * H, minutes: 0, subs: 1, link: "reward", seenAt: now },
      ],
    },
    streamPulseBadgeAdded: { fetchedAt: now, added: { "dont-eat-the-mold": now - 2 * 24 * H, "ace-combat-8-nugget": now - 24 * H } },
```

  et ajouter au catalogue de démo un badge à venir :
  `{ id: "vaultbreakers", title: "Vaultbreakers", description: "This badge was earned by watching a streamer in the Vaultbreakers category for 60 minutes", image: reward(260, "V"), firstSeen: now - 6 * H },`.
  Retirer `firstSeen` de « Don't Eat The Mold » au profit de la date du site (garder `0`).

- [ ] **Étape 2 : vérifier à l'œil** — serveur Portly `StreamPulseMain` (port 5179), banc
  `/scripts/dev/popup-harness.html?tab=menu&panel=badges&plus=1` à 780×600, thèmes sombre et clair
  (`&theme=light`) : filtres et compteurs, carte à venir en pointillés, terminé grisé « Terminé le … »,
  « Ajouté le … », note sous la grille, mode auto sur un gratuit en cours. Captures envoyées à Alexis.

- [ ] **Étape 3 : point de commit** : `chore: banc du popup avec les statuts des badges`.

---

### Tâche 10 : Version 26.10.3 et notes de version

**Fichiers :** Modifier : `manifest.json`, `package.json`, `js/changelog-data.js` ; régénérer
`js/inject/i18n-inline.js` si `npm run gen:i18n-inline` le change.

- [ ] **Étape 1 :** `"version": "26.10.3"` dans `manifest.json` et `package.json`.
- [ ] **Étape 2 :** entrée en tête de `RELEASES` :

```js
  {
    version: "26.10.3",
    date: "2026-10-05",
    title: {
      "fr": "Des badges aux vraies dates",
      "en": "Badges with real dates",
      "es": "Insignias con fechas reales",
      "pt-BR": "Emblemas com datas reais",
      "de": "Abzeichen mit echten Daten",
      "it": "Badge con date reali",
      "pl": "Odznaki z prawdziwymi datami",
      "tr": "Gerçek tarihli rozetler",
      "ru": "Значки с настоящими датами",
      "ja": "本当の日付つきバッジ",
      "ko": "실제 날짜가 있는 배지",
    },
    changes: [
      {
        type: "new",
        area: "badges",
        text: {
          "fr": "Onglet Badges : chaque badge est En cours, À venir ou Terminé, avec les vraies dates des campagnes Twitch, son coût, ce qu'il faut faire et la date à laquelle Twitch l'a ajouté. Tout se met à jour seul dès qu'un onglet Twitch est ouvert.",
          "en": "Badges tab: every badge is Active, Upcoming or Ended, with the real dates of the Twitch campaigns, its cost, what to do and the date Twitch added it. Everything updates on its own whenever a Twitch tab is open.",
          "es": "Pestaña Insignias: cada insignia está Activa, Próxima o Terminada, con las fechas reales de las campañas de Twitch, su coste, qué hay que hacer y la fecha en que Twitch la añadió. Todo se actualiza solo en cuanto hay una pestaña de Twitch abierta.",
          "pt-BR": "Aba Emblemas: cada emblema aparece como Ativo, Em breve ou Encerrado, com as datas reais das campanhas da Twitch, o custo, o que fazer e a data em que a Twitch o adicionou. Tudo se atualiza sozinho assim que uma aba da Twitch está aberta.",
          "de": "Tab Abzeichen: Jedes Abzeichen ist Aktiv, Demnächst oder Beendet, mit den echten Daten der Twitch-Kampagnen, den Kosten, der Aufgabe und dem Datum, an dem Twitch es hinzugefügt hat. Alles aktualisiert sich von selbst, sobald ein Twitch-Tab offen ist.",
          "it": "Scheda Badge: ogni badge è Attivo, In arrivo o Terminato, con le date reali delle campagne di Twitch, il costo, cosa fare e la data in cui Twitch l'ha aggiunto. Tutto si aggiorna da solo quando una scheda di Twitch è aperta.",
          "pl": "Karta Odznaki: każda odznaka jest Aktywna, Nadchodząca lub Zakończona, z prawdziwymi datami kampanii Twitcha, kosztem, zadaniem do wykonania i datą dodania przez Twitcha. Wszystko aktualizuje się samo, gdy otwarta jest karta Twitcha.",
          "tr": "Rozetler sekmesi: her rozet Aktif, Yakında veya Sona eren olarak görünür; Twitch kampanyalarının gerçek tarihleri, maliyeti, yapılması gereken ve Twitch'in onu eklediği tarih ile. Bir Twitch sekmesi açık olduğunda her şey kendiliğinden güncellenir.",
          "ru": "Вкладка «Значки»: каждый значок — активный, скоро или завершённый, с настоящими датами кампаний Twitch, стоимостью, условием и датой, когда Twitch его добавил. Всё обновляется само, когда открыта вкладка Twitch.",
          "ja": "バッジタブ：各バッジが開催中・近日開始・終了のいずれかで表示され、Twitchキャンペーンの実際の日付、費用、獲得条件、Twitchが追加した日付がわかります。Twitchのタブを開いていれば自動で更新されます。",
          "ko": "배지 탭: 모든 배지가 진행 중, 예정, 종료로 표시되며 Twitch 캠페인의 실제 날짜, 비용, 획득 조건, Twitch가 추가한 날짜를 보여 줍니다. Twitch 탭이 열려 있으면 자동으로 업데이트됩니다.",
        },
      },
      {
        type: "fix",
        area: "badges",
        text: {
          "fr": "Les badges terminés ne sont plus présentés comme obtenables, et les badges à venir ne sont plus annoncés comme disponibles avant leur début.",
          "en": "Ended badges are no longer shown as earnable, and upcoming badges are no longer announced as available before they start.",
          "es": "Las insignias terminadas ya no aparecen como obtenibles, y las próximas ya no se anuncian como disponibles antes de empezar.",
          "pt-BR": "Os emblemas encerrados não aparecem mais como obtíveis, e os que estão por vir não são mais anunciados como disponíveis antes de começar.",
          "de": "Beendete Abzeichen werden nicht mehr als erhältlich angezeigt, und kommende Abzeichen werden nicht mehr vor ihrem Start als verfügbar angekündigt.",
          "it": "I badge terminati non sono più indicati come ottenibili e quelli in arrivo non sono più annunciati come disponibili prima dell'inizio.",
          "pl": "Zakończone odznaki nie są już pokazywane jako możliwe do zdobycia, a nadchodzące nie są już ogłaszane jako dostępne przed startem.",
          "tr": "Sona eren rozetler artık kazanılabilir olarak gösterilmiyor ve yakında gelecek rozetler başlamadan önce mevcut diye duyurulmuyor.",
          "ru": "Завершённые значки больше не показываются как доступные, а будущие не объявляются доступными до начала.",
          "ja": "終了したバッジが獲得可能と表示されなくなり、近日開始のバッジが開始前に獲得可能と表示されることもなくなりました。",
          "ko": "종료된 배지가 더 이상 획득 가능으로 표시되지 않으며, 예정된 배지도 시작 전에 획득 가능으로 안내되지 않습니다.",
        },
      },
      {
        type: "fix",
        area: "badges",
        text: {
          "fr": "Ultramarine, ACE COMBAT 8 Nugget, Koromaru et d20 sont enfin reliés à leur campagne : leur date de fin s'affiche, et d20 peut s'obtenir en mode auto.",
          "en": "Ultramarine, ACE COMBAT 8 Nugget, Koromaru and d20 are finally linked to their campaign: their end date shows, and d20 can be earned in auto mode.",
          "es": "Ultramarine, ACE COMBAT 8 Nugget, Koromaru y d20 por fin están vinculadas a su campaña: se muestra su fecha de fin y d20 se puede obtener en modo automático.",
          "pt-BR": "Ultramarine, ACE COMBAT 8 Nugget, Koromaru e d20 finalmente estão ligados à sua campanha: a data de término aparece e d20 pode ser obtido no modo automático.",
          "de": "Ultramarine, ACE COMBAT 8 Nugget, Koromaru und d20 sind endlich mit ihrer Kampagne verknüpft: Das Enddatum wird angezeigt, und d20 lässt sich im Automodus holen.",
          "it": "Ultramarine, ACE COMBAT 8 Nugget, Koromaru e d20 sono finalmente collegati alla loro campagna: la data di fine è visibile e d20 si può ottenere in modalità automatica.",
          "pl": "Ultramarine, ACE COMBAT 8 Nugget, Koromaru i d20 są wreszcie powiązane ze swoją kampanią: widać datę zakończenia, a d20 można zdobyć w trybie automatycznym.",
          "tr": "Ultramarine, ACE COMBAT 8 Nugget, Koromaru ve d20 artık kampanyalarına bağlı: bitiş tarihleri görünüyor ve d20 otomatik modda alınabiliyor.",
          "ru": "Ultramarine, ACE COMBAT 8 Nugget, Koromaru и d20 наконец связаны со своей кампанией: видна дата окончания, а d20 можно получить в автоматическом режиме.",
          "ja": "Ultramarine、ACE COMBAT 8 Nugget、Koromaru、d20がようやくキャンペーンと紐づき、終了日が表示されるようになりました。d20はオートモードで獲得できます。",
          "ko": "Ultramarine, ACE COMBAT 8 Nugget, Koromaru, d20이 드디어 캠페인과 연결되어 종료일이 표시되며, d20은 자동 모드로 획득할 수 있습니다.",
        },
      },
    ],
  },
```

- [ ] **Étape 3 :** `npm run gen:i18n-inline`, puis `npm run lint`, `npm test`, `npm run verify` →
  SUCCÈS ; `git status` pour voir si `js/inject/i18n-inline.js` a changé.

- [ ] **Étape 4 : point de commit** : `chore: version 26.10.3 et notes de version (3 items ×11 langues)`.

---

### Tâche 11 : Relecture et livraison

- [ ] **Étape 1 :** relecture par l'agent `code-reviewer` (règles du projet) sur le diff de
  `feat/badges-statuts` et de `feat/badges-added` ; corriger les points CRITICAL et HIGH.
- [ ] **Étape 2 :** `npm run build` (lint, i18n inline, tests, zip) → SUCCÈS.
- [ ] **Étape 3 :** demander à Alexis l'accord pour : commits de l'extension, fusion dans `main`,
  push du site (déploiement), publication (Chrome, Edge par `npm run publish:edge`, Firefox après
  `sync-from-chrome`).
- [ ] **Étape 4 :** vérification réelle sur twitch.tv avec l'extension chargée : détail des campagnes
  lu en arrière-plan, Ultramarine et Koromaru datés, Vaultbreakers « À venir », RuneScape « Terminé ».
