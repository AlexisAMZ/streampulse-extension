// Ouvre la chaîne d'un streamer : réutilise un onglet déjà sur cette chaîne,
// sinon en crée un. tabs.query({ url }) marche sans la permission « tabs »
// grâce aux host_permissions Twitch / Kick / YouTube du manifeste.

function channelKey(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  const segments = url.pathname.split("/").filter(Boolean).map((s) => decodeURIComponent(s).toLowerCase());
  if (!segments.length) return null;
  const depth = host === "youtube.com" && (segments[0] === "channel" || segments[0] === "c") ? 2 : 1;
  if (segments.length < depth) return null;
  return `${host}/${segments.slice(0, depth).join("/")}`;
}

export function isSameChannel(tabUrl, channelUrl) {
  const target = channelKey(channelUrl);
  return Boolean(target) && channelKey(tabUrl) === target;
}

export function findChannelTab(tabs, channelUrl) {
  const matches = (tabs || []).filter((tab) => tab?.url && isSameChannel(tab.url, channelUrl));
  return matches.find((tab) => tab.active) || matches[0] || null;
}

export function channelQueryPatterns(channelUrl) {
  try {
    const { hostname } = new URL(channelUrl);
    const bare = hostname.replace(/^www\./, "");
    return [...new Set([`https://${bare}/*`, `https://*.${bare}/*`])];
  } catch {
    return [];
  }
}

export async function openChannel(chromeApi, channelUrl) {
  const patterns = channelQueryPatterns(channelUrl);
  let existing = null;
  if (patterns.length) {
    try {
      existing = findChannelTab(await chromeApi.tabs.query({ url: patterns }), channelUrl);
    } catch (error) {
      console.warn("[open-channel] recherche d'onglet impossible", error);
    }
  }
  if (!existing) {
    await chromeApi.tabs.create({ url: channelUrl });
    return { reused: false };
  }
  await chromeApi.tabs.update(existing.id, { active: true });
  if (Number.isInteger(existing.windowId)) {
    await chromeApi.windows.update(existing.windowId, { focused: true });
  }
  return { reused: true, tabId: existing.id };
}
