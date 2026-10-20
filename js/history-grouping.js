// Historique : les sessions des comptes d'un même groupe lié (js/linked-accounts.js)
// sont présentées sous une seule identité. Deux sessions de plateformes différentes
// qui se chevauchent dans le temps forment une seule carte avec un lien par
// plateforme. Module pur : rien n'est écrit, l'historique stocké reste intact.
import { getLinkedGroup } from "./linked-accounts.js";

const toTime = (value) => {
  const time = typeof value === "number" ? value : Date.parse(value || "");
  return Number.isFinite(time) ? time : null;
};

function interval(entry) {
  const end = toTime(entry.endedAt) ?? 0;
  const start = toTime(entry.startedAt) ?? end - (entry.durationSec || 0) * 1000;
  return { start, end };
}

const overlaps = (a, b) => a.start < b.end && b.start < a.end;

const variantOf = (entry) => ({
  id: entry.id,
  streamerId: entry.streamerId,
  platform: entry.platform,
  handle: entry.handle,
  vodUrl: entry.vodUrl,
  hasVod: Boolean(entry.hasVod),
  seen: Boolean(entry.seen),
});

function buildItem(cluster, group, roster) {
  const preferred = cluster.find((entry) => entry.streamerId === group?.preferredId) || cluster[0];
  const account = group ? roster.find((streamer) => streamer.id === group.preferredId) : null;
  const variants = [preferred, ...cluster.filter((entry) => entry !== preferred)].map(variantOf);
  return {
    ...preferred,
    displayName: group ? group.name : preferred.displayName,
    avatarUrl: (group && account?.avatarUrl) || preferred.avatarUrl,
    streamerId: group ? group.preferredId : preferred.streamerId,
    seen: variants.every((variant) => variant.seen),
    durationSec: Math.max(...cluster.map((entry) => entry.durationSec || 0)),
    ids: variants.map((variant) => variant.id),
    variants,
  };
}

/**
 * @param {object[]} entries sessions déjà filtrées (ordre d'affichage conservé)
 * @param {object[]} groups groupes liés bruts
 * @param {object[]} roster liste des streamers (avatars, plateformes)
 */
export function groupMissedEntries(entries, groups, roster = []) {
  const clusters = [];
  for (const entry of entries) {
    const group = getLinkedGroup(groups, entry.streamerId);
    const span = interval(entry);
    const host = group && clusters.find((cluster) => (
      cluster.group?.id === group.id
      && cluster.entries.every((other) => other.platform !== entry.platform)
      && cluster.entries.some((other) => overlaps(span, interval(other)))
    ));
    if (host) host.entries = [...host.entries, entry];
    else clusters.push({ group, entries: [entry] });
  }
  return clusters.map((cluster) => buildItem(cluster.entries, cluster.group, roster));
}
