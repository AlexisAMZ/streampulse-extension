// Données pures des Drops et défis Kick (normalisation, parsing et structures).
// Testé par tests/kick-drops-data.test.mjs.

export const KICK_DROPS_KEY = "streamPulseKickDrops";

/**
 * Détecte si un élément (récompense, drop, campagne) est un badge.
 */
export function isKickBadge(item) {
  if (!item || typeof item !== "object") return false;
  const name = String(item.name || item.title || item.label || "").toLowerCase();
  const desc = String(item.description || "").toLowerCase();
  const type = String(item.type || "").toLowerCase();
  return Boolean(item.isBadge) || type === "badge" || name.includes("badge") || desc.includes("badge");
}

/**
 * Extrait l'état stocké des Drops Kick avec des valeurs par défaut sûres.
 */
export function kickDropsFrom(stored) {
  const root = stored?.[KICK_DROPS_KEY] || stored || {};
  return {
    progress: Array.isArray(root.progress) ? root.progress : [],
    challenges: Array.isArray(root.challenges) ? root.challenges : [],
    campaigns: Array.isArray(root.campaigns) ? root.campaigns : [],
    boxed: Array.isArray(root.boxed) ? root.boxed : [],
    updatedAt: Number(root.updatedAt) || 0,
    user: root.user && typeof root.user === "object" ? root.user : null,
    disconnected: Boolean(root.disconnected),
  };
}

/**
 * Normalise le tableau de progression retourné par GET /api/v1/drops/progress.
 */
export function normalizeKickProgress(data) {
  if (!Array.isArray(data)) return [];
  const items = [];
  for (const camp of data) {
    if (!camp || typeof camp !== "object") continue;
    const gameName = String(camp.category?.name || camp.name || "Kick").trim();
    const gameSlug = String(camp.category?.slug || "").trim();
    const status = String(camp.status || "in progress").toLowerCase();
    const campUrl = camp.url || (gameSlug ? `https://kick.com/category/${gameSlug}/drops` : "https://kick.com/drops/campaigns");
    const progressUnits = Number(camp.progress_units) || 0;
    const rewards = Array.isArray(camp.rewards) ? camp.rewards : [];
    for (const r of rewards) {
      if (!r || typeof r !== "object") continue;
      const required = Number(r.required_units) || 0;
      const progressRate = typeof r.progress === "number" ? r.progress : (required > 0 ? progressUnits / required : 0);
      const claimed = Boolean(r.claimed);
      const rawMinutes = Math.round(progressRate * required);
      const minutes = isNaN(rawMinutes) || rawMinutes <= 0 ? progressUnits : rawMinutes;
      const ready = !claimed && (progressRate >= 1.0 || (required > 0 && progressUnits >= required));
      const rawImg = String(r.image_url || "");
      const image = rawImg ? (rawImg.startsWith("http") ? rawImg : `https://ext.cdn.kick.com/${rawImg.replace(/^\/+/, "")}`) : "";
      const isBadge = /badge/i.test(r.name || "") || /badge/i.test(camp.name || "") || r.type === "badge";
      items.push({
        id: String(r.id || `${camp.id}_${r.name}`),
        campaignId: String(camp.id || ""),
        name: String(r.name || "Récompense Kick").trim(),
        game: gameName,
        gameSlug,
        image,
        minutes,
        required,
        progress: Math.min(1, Math.max(0, progressRate)),
        claimed,
        ready,
        platform: "kick",
        status,
        url: campUrl,
        isBadge,
      });
    }
  }
  return items;
}

/**
 * Normalise les défis de visionnage retournés par GET /api/v1/gamification/challenges.
 */
export function normalizeKickChallenges(data) {
  if (!Array.isArray(data)) return [];
  const items = [];
  for (const ch of data) {
    if (!ch || typeof ch !== "object") continue;
    const cond = ch.condition || {};
    const progress = Number(cond.progress) || 0;
    const threshold = Number(cond.threshold) || 60;
    const rate = threshold > 0 ? Math.min(1, progress / threshold) : 0;
    const status = String(ch.status || "in_progress").toLowerCase();
    const claimed = status === "completed";
    const ready = status === "claimable" || (threshold > 0 && progress >= threshold && !claimed);
    const isBadge = /badge/i.test(ch.name || "") || /badge/i.test(ch.description || "");
    items.push({
      id: String(ch.id || ch.name),
      name: String(ch.name || "Défi Kick").trim(),
      game: "Kick Rewards",
      gameSlug: "kick",
      description: String(ch.description || "").trim(),
      image: "",
      minutes: progress,
      required: threshold,
      progress: rate,
      claimed,
      ready,
      platform: "kick",
      isChallenge: true,
      isBadge,
      status,
      url: "https://kick.com/drops/rewards",
    });
  }
  return items;
}

/**
 * Normalise les boîtes/coffres en attente d'ouverture (GET /api/v1/rewards/boxed).
 */
export function normalizeKickBoxed(data) {
  const list = Array.isArray(data) ? data : (Array.isArray(data?.rewards) ? data.rewards : []);
  return list.map((item) => ({
    id: String(item.id || ""),
    label: String(item.display_label || item.name || "Coffre Kick").trim(),
    source: String(item.source_label || item.source || "").trim(),
    thumbnail: String(item.thumbnail_url || ""),
    type: String(item.type || "reward"),
  })).filter((item) => item.id.length > 0);
}

/**
 * Normalise la liste des campagnes retournée par GET /api/v1/drops/campaigns.
 */
export function normalizeKickCampaigns(data) {
  if (!Array.isArray(data)) return [];
  return data.map((c) => {
    const cat = c.category || {};
    const org = c.organization || {};
    const rewards = Array.isArray(c.rewards) ? c.rewards : [];
    const gameSlug = String(cat.slug || "").trim();
    const startsAt = c.starts_at ? new Date(c.starts_at).getTime() : 0;
    const endsAt = c.ends_at ? new Date(c.ends_at).getTime() : 0;
    const isBadge = /badge/i.test(c.name || "") || rewards.some((r) => /badge/i.test(r?.name || "") || r?.type === "badge");
    return {
      id: String(c.id || ""),
      name: String(c.name || cat.name || "").trim(),
      game: String(cat.name || c.name || "Kick").trim(),
      gameSlug,
      boxArt: cat.image_url || cat.banner_image_url || org.logo_url || "",
      owner: String(org.name || "KICK").trim(),
      rewardCount: rewards.length,
      startsAt,
      endsAt,
      status: String(c.status || "active").toUpperCase(),
      url: c.url || (gameSlug ? `https://kick.com/category/${gameSlug}/drops` : "https://kick.com/drops/campaigns"),
      platform: "kick",
      badgeOnly: isBadge,
      isBadge,
    };
  }).filter((c) => c.id.length > 0);
}

/** Formate une durée en minutes vers une chaîne lisible : « 45 min », « 5 h », « 10 j 10 h ». */
export function formatKickDuration(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m < 60) return `${m} min`;
  if (m < 1440) {
    const hours = Math.floor(m / 60);
    const rest = m % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
  }
  const days = Math.floor(m / 1440);
  const remainingMin = m % 1440;
  const hours = Math.floor(remainingMin / 60);
  return hours ? `${days} j ${hours} h` : `${days} j`;
}

/**
 * Extrait les badges Kick pour le catalogue de badges (onglet Badges).
 */
export function kickBadgesFrom(kickDrops, now = Date.now()) {
  const list = [];
  const progressBadges = (kickDrops?.progress || []).filter(isKickBadge);
  for (const p of progressBadges) {
    list.push({
      id: `kick_${p.id}`,
      kickId: p.id,
      title: p.name,
      description: `${p.game} · ${formatKickDuration(p.minutes)} / ${formatKickDuration(p.required)}`,
      image: p.image,
      url: p.url || "https://kick.com/drops/campaigns",
      game: p.game,
      platform: "kick",
      status: p.claimed ? "owned" : "live",
      owned: Boolean(p.claimed),
      paid: false,
      addedAt: Number(kickDrops?.updatedAt) || now,
      minutes: p.minutes,
      required: p.required,
      progress: p.progress,
      ready: p.ready,
      event: {
        badgeId: `kick_${p.id}`,
        kind: "drops",
        game: p.game,
        owner: "KICK",
        startsAt: 0,
        endsAt: 0,
        minutes: p.required,
        subs: 0,
        link: "kick",
      },
    });
  }
  return list;
}
