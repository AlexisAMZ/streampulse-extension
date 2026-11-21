import test from "node:test";
import assert from "node:assert/strict";
import {
  KICK_DROPS_KEY,
  kickDropsFrom,
  normalizeKickProgress,
  normalizeKickChallenges,
  normalizeKickBoxed,
  normalizeKickCampaigns,
  isKickBadge,
  kickBadgesFrom,
  formatKickDuration,
} from "../js/kick-drops-data.js";
import { DROPS_HISTORY_KEY } from "../js/drops-data.js";

test("kickDropsFrom : valeurs saines par défaut", () => {
  const empty = kickDropsFrom({});
  assert.deepEqual(empty.progress, []);
  assert.deepEqual(empty.challenges, []);
  assert.deepEqual(empty.campaigns, []);
  assert.deepEqual(empty.boxed, []);
  assert.equal(empty.updatedAt, 0);
  assert.equal(empty.user, null);
  assert.equal(empty.disconnected, false);

  const stored = kickDropsFrom({
    [KICK_DROPS_KEY]: {
      progress: [{ id: "1" }],
      challenges: [{ id: "c1" }],
      campaigns: [{ id: "camp1" }],
      boxed: [{ id: "b1" }],
      updatedAt: 123456,
      user: { username: "Alexis" },
      disconnected: true,
    },
  });
  assert.equal(stored.progress.length, 1);
  assert.equal(stored.challenges.length, 1);
  assert.equal(stored.campaigns.length, 1);
  assert.equal(stored.boxed.length, 1);
  assert.equal(stored.updatedAt, 123456);
  assert.equal(stored.user.username, "Alexis");
  assert.equal(stored.disconnected, true);
});

test("normalizeKickProgress : normalise correctement les campagnes et récompenses", () => {
  const raw = [
    {
      id: "camp_gta",
      name: "Sunset Drop",
      category: { id: 13155, name: "Grand Theft Auto VI (GTA)", slug: "grand-theft-auto-vi" },
      progress_units: 4,
      status: "in progress",
      rewards: [
        {
          id: "rew_badge",
          name: "SunsetK Badge",
          image_url: "drops/reward-image/sample.png",
          progress: 0.0002666,
          required_units: 15000,
          claimed: false,
        },
      ],
    },
    {
      id: "camp_done",
      name: "Done Drop",
      category: { name: "Fortnite", slug: "fortnite" },
      progress_units: 120,
      status: "in progress",
      rewards: [
        {
          id: "rew_ready",
          name: "Fortnite Ready",
          progress: 1.0,
          required_units: 120,
          claimed: false,
        },
        {
          id: "rew_claimed",
          name: "Fortnite Claimed",
          progress: 1.0,
          required_units: 120,
          claimed: true,
        },
      ],
    },
  ];

  const items = normalizeKickProgress(raw);
  assert.equal(items.length, 3);

  const gta = items[0];
  assert.equal(gta.id, "rew_badge");
  assert.equal(gta.game, "Grand Theft Auto VI (GTA)");
  assert.equal(gta.gameSlug, "grand-theft-auto-vi");
  assert.equal(gta.image, "https://ext.cdn.kick.com/drops/reward-image/sample.png");
  assert.equal(gta.claimed, false);
  assert.equal(gta.ready, false);
  assert.equal(gta.platform, "kick");
  assert.equal(gta.url, "https://kick.com/category/grand-theft-auto-vi/drops");

  const ready = items[1];
  assert.equal(ready.id, "rew_ready");
  assert.equal(ready.ready, true);
  assert.equal(ready.claimed, false);

  const claimed = items[2];
  assert.equal(claimed.id, "rew_claimed");
  assert.equal(claimed.ready, false);
  assert.equal(claimed.claimed, true);
});

test("normalizeKickChallenges : normalise les défis quotidiens et spéciaux", () => {
  const raw = [
    {
      id: "ch_daily",
      name: "Daily Reward",
      description: "Claim your Daily Reward",
      condition: { progress: 18, threshold: 60, type: "watch_time_minutes" },
      status: "in_progress",
    },
    {
      id: "ch_sunset",
      name: "Sunset Reward Case",
      description: "Watch any stream for 3 hours",
      condition: { progress: 180, threshold: 180, type: "watch_time_minutes" },
      status: "claimable",
    },
  ];

  const items = normalizeKickChallenges(raw);
  assert.equal(items.length, 2);

  const daily = items[0];
  assert.equal(daily.name, "Daily Reward");
  assert.equal(daily.minutes, 18);
  assert.equal(daily.required, 60);
  assert.equal(daily.progress, 0.3);
  assert.equal(daily.ready, false);
  assert.equal(daily.isChallenge, true);

  const sunset = items[1];
  assert.equal(sunset.name, "Sunset Reward Case");
  assert.equal(sunset.minutes, 180);
  assert.equal(sunset.required, 180);
  assert.equal(sunset.progress, 1);
  assert.equal(sunset.ready, true);
});

test("normalizeKickBoxed : extrait les coffres non ouverts", () => {
  const raw = {
    rewards: [
      {
        id: "box_1",
        display_label: "VHSUP",
        source_label: "Sunset Reward Case",
        thumbnail_url: "https://content.kick.com/.../thumb.png",
        type: "emote",
      },
    ],
  };

  const boxed = normalizeKickBoxed(raw);
  assert.equal(boxed.length, 1);
  assert.equal(boxed[0].id, "box_1");
  assert.equal(boxed[0].label, "VHSUP");
  assert.equal(boxed[0].source, "Sunset Reward Case");
});

test("normalizeKickCampaigns : normalise les campagnes Kick", () => {
  const raw = [
    {
      id: "camp_cod",
      name: "Modern Warfare 4",
      category: { id: 14138, name: "Call of Duty: Modern Warfare 4", slug: "call-of-duty-modern-warfare-4" },
      organization: { name: "KICK" },
      rewards: [{ id: "r1" }],
      starts_at: "2026-10-23T00:00:00Z",
      ends_at: "2026-11-23T00:00:00Z",
      status: "in progress",
    },
  ];

  const camps = normalizeKickCampaigns(raw);
  assert.equal(camps.length, 1);
  assert.equal(camps[0].game, "Call of Duty: Modern Warfare 4");
  assert.equal(camps[0].owner, "KICK");
  assert.equal(camps[0].rewardCount, 1);
  assert.equal(camps[0].platform, "kick");
  assert.ok(camps[0].startsAt > 0);
  assert.ok(camps[0].endsAt > 0);
});

test("isKickBadge et kickBadgesFrom : isole les badges des drops", () => {
  assert.equal(isKickBadge({ name: "SunsetK Badge" }), true);
  assert.equal(isKickBadge({ name: "Ghost Operator Skin" }), false);
  assert.equal(isKickBadge({ isBadge: true }), true);
  assert.equal(isKickBadge({ type: "badge" }), true);

  const kickDrops = {
    progress: [
      { id: "rew_badge", name: "SunsetK Badge", game: "GTA VI", minutes: 10, required: 15000, progress: 0.001, isBadge: true, claimed: false },
      { id: "rew_skin", name: "Skin MW4", game: "CoD", minutes: 60, required: 60, progress: 1, isBadge: false, claimed: false },
    ],
    updatedAt: 1700000000000,
  };

  const badges = kickBadgesFrom(kickDrops);
  assert.equal(badges.length, 1);
  assert.equal(badges[0].id, "kick_rew_badge");
  assert.equal(badges[0].title, "SunsetK Badge");
  assert.equal(badges[0].game, "GTA VI");
  assert.equal(badges[0].platform, "kick");
  assert.equal(badges[0].status, "live");
  assert.equal(badges[0].description, "GTA VI · 10 min / 10 j 10 h");
});

test("formatKickDuration : convertit les durées en minutes, heures et jours", () => {
  assert.equal(formatKickDuration(0), "0 min");
  assert.equal(formatKickDuration(45), "45 min");
  assert.equal(formatKickDuration(60), "1 h");
  assert.equal(formatKickDuration(125), "2 h 5 min");
  assert.equal(formatKickDuration(300), "5 h");
  assert.equal(formatKickDuration(600), "10 h");
  assert.equal(formatKickDuration(1440), "1 j");
  assert.equal(formatKickDuration(3000), "2 j 2 h");
  assert.equal(formatKickDuration(15000), "10 j 10 h");
});

test("unboxKickRewards : déballe et enregistre dans DROPS_HISTORY_KEY", async () => {
  const data = {
    [KICK_DROPS_KEY]: {
      boxed: [{ id: "box_123", label: "Caisse Légendaire", source: "GTA VI", thumbnail: "img.jpg" }],
      updatedAt: 1000,
    },
    [DROPS_HISTORY_KEY]: [],
  };
  globalThis.chrome = {
    cookies: { get: async () => ({ value: "test_token" }) },
    storage: {
      local: {
        get: async (keys) => {
          const res = {};
          for (const k of [].concat(keys)) if (k in data) res[k] = data[k];
          return res;
        },
        set: async (obj) => Object.assign(data, obj),
      },
    },
  };
  globalThis.fetch = async (url) => {
    if (url.includes("mark-unboxed")) return { ok: true, status: 200, json: async () => ({ success: true }) };
    return { ok: false, status: 404 };
  };

  const { unboxKickRewards } = await import("../js/sw/kick-drops.js");
  const res = await unboxKickRewards(["box_123"]);
  assert.equal(res.success, true);
  assert.equal(res.count, 1);
  assert.equal(data[KICK_DROPS_KEY].boxed.length, 0);
  assert.equal(data[DROPS_HISTORY_KEY].length, 1);
  assert.equal(data[DROPS_HISTORY_KEY][0].name, "Caisse Légendaire");
  assert.equal(data[DROPS_HISTORY_KEY][0].platform, "kick");
});
