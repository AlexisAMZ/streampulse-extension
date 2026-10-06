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
