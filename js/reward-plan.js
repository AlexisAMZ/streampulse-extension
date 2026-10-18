/**
 * Estimates (never promises) how long selected Drops take under a session budget.
 * Twitch counts watch minutes on every Drop of a campaign at the same time, so one
 * campaign costs as long as its slowest selected Drop; campaigns are watched one
 * after the other, so their durations add up.
 * `progress` is one { dropId, minutes }; `progressById` maps every in-progress Drop to its minutes.
 */
export function buildRewardPlan({ campaigns = [], selectedIds = [], budgetMinutes = null, now = Date.now(), progress = null, progressById = null } = {}) {
  // Callers may pass the raw selected set: make selecting all drops possible.
  selectedIds = selectedIds === "all" ? campaigns.flatMap((campaign) => campaign?.drops || []).map((drop) => drop.id) : selectedIds;
  const selected = new Set(selectedIds);
  const watched = (drop) => {
    const known = progressById?.[drop.id] ?? (progress?.dropId === drop.id ? progress.minutes : 0);
    return Math.max(0, Number(known) || 0);
  };
  const rows = [];
  const campaignMinutes = [];
  for (const campaign of campaigns) {
    if (!Array.isArray(campaign?.drops) || !campaign.drops.some((drop) => selected.has(drop.id))) continue;
    const drops = campaign.drops
      .filter((drop) => selected.has(drop.id))
      .sort((a, b) => (Number(a.minutes) || 0) - (Number(b.minutes) || 0));
    let slowest = 0;
    for (const drop of drops) {
      const required = Number.isFinite(drop.minutes) && drop.minutes > 0 ? drop.minutes : null;
      const remaining = required === null ? null : Math.max(0, required - watched(drop));
      if (remaining !== null) slowest = Math.max(slowest, remaining);
      const deadline = Math.min(...[drop.endsAt, campaign.endsAt].filter((time) => Number.isFinite(time) && time > 0), Infinity);
      rows.push({
        id: drop.id,
        name: drop.name || campaign.game || drop.id,
        campaignId: campaign.id,
        minutesRemaining: remaining,
        endsAt: deadline === Infinity ? 0 : deadline,
        impossibleDeadline: remaining !== null && deadline !== Infinity && now + remaining * 60_000 > deadline,
      });
    }
    campaignMinutes.push(slowest);
  }
  const total = campaignMinutes.reduce((sum, minutes) => sum + minutes, 0);
  // An unknown duration makes the total a lower bound, never a certainty.
  const incomplete = rows.some((row) => row.minutesRemaining === null);
  const budget = Number.isFinite(budgetMinutes) && budgetMinutes >= 0 ? Math.round(budgetMinutes) : null;
  return {
    rows,
    totalMinutes: total,
    incomplete,
    budgetMinutes: budget,
    overBudget: budget !== null && total > budget,
    deadlineReached: rows.some((row) => row.impossibleDeadline),
  };
}

export function normalizePlanSelection(value) {
  const ids = (Array.isArray(value?.selectedIds) ? value.selectedIds : [])
    .filter((id) => typeof id === "string" && id.length > 0 && id.length <= 200);
  const budget = Number(value?.budgetMinutes);
  // No deadline and no duration are both unknown, never "0 minutes left".
  return {
    selectedIds: [...new Set(ids)].slice(0, 50),
    budgetMinutes: Number.isFinite(budget) && budget >= 0 ? Math.min(720, Math.round(budget)) : null,
  };
}

export function formatPlanMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 min";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h} h${m ? ` ${m}` : ""}` : `${m} min`;
}
