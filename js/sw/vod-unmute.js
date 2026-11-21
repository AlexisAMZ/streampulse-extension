// StreamPulse+ : Démutage automatique des VODs Twitch coupées par le copyright.
// Gère l'installation et la suppression des règles déclaratives de redirection
// par onglet (chrome.declarativeNetRequest.updateSessionRules).

const tabRulesMap = new Map(); // tabId -> Set<number>
let nextRuleId = 1;
const MAX_RULE_ID = 2147480000;
const MAX_RULES_PER_TAB = 4500;

function allocateRuleId(usedIds) {
  for (let i = 0; i < 100000; i++) {
    if (nextRuleId > MAX_RULE_ID) nextRuleId = 1;
    const id = nextRuleId++;
    if (!usedIds.has(id)) {
      usedIds.add(id);
      return id;
    }
  }
  throw new Error("Aucun identifiant declarativeNetRequest disponible");
}

export async function clearVodRulesForTab(tabId) {
  if (!chrome.declarativeNetRequest?.updateSessionRules) return;
  const existingIds = tabRulesMap.get(tabId);
  if (!existingIds || existingIds.size === 0) return;

  try {
    const liveRules = await chrome.declarativeNetRequest.getSessionRules();
    const toRemove = liveRules
      .filter((r) => r.condition?.tabIds?.includes(tabId))
      .map((r) => r.id);

    if (toRemove.length > 0) {
      await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: toRemove });
    }
  } catch (error) {
    console.warn("[StreamPulse] Erreur lors du nettoyage des règles VOD :", error?.message || error);
  } finally {
    tabRulesMap.delete(tabId);
  }
}

export async function handleVodUnmuteInstallRules(message, sender) {
  const tabId = sender?.tab?.id;
  if (!tabId || !Array.isArray(message?.redirects) || message.redirects.length === 0) {
    return { ok: false, error: "Paramètres invalides" };
  }

  if (!chrome.declarativeNetRequest?.updateSessionRules) {
    return { ok: false, error: "declarativeNetRequest indisponible" };
  }

  try {
    const liveRules = await chrome.declarativeNetRequest.getSessionRules();
    const usedIds = new Set(liveRules.map((r) => r.id));

    // Supprimer les règles existantes pour cet onglet avant d'en installer de nouvelles
    const staleIds = liveRules
      .filter((r) => r.condition?.tabIds?.includes(tabId))
      .map((r) => r.id);

    const plannedRedirects = message.redirects.slice(0, MAX_RULES_PER_TAB);
    const addRules = [];
    const newTabRuleIds = new Set();

    for (const item of plannedRedirects) {
      if (!item.sourceUrl || !item.targetUrl) continue;
      const cleanSource = item.sourceUrl.split("?")[0];
      const ruleId = allocateRuleId(usedIds);

      addRules.push({
        id: ruleId,
        priority: 1,
        action: {
          type: "redirect",
          redirect: { url: item.targetUrl },
        },
        condition: {
          urlFilter: `|${cleanSource}`,
          tabIds: [tabId],
          resourceTypes: ["xmlhttprequest", "media", "other"],
        },
      });
      newTabRuleIds.add(ruleId);
    }

    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: staleIds,
      addRules,
    });

    tabRulesMap.set(tabId, newTabRuleIds);
    return { ok: true, count: addRules.length };
  } catch (error) {
    console.warn("[StreamPulse] Échec de l'installation des règles VOD Unmute :", error?.message || error);
    return { ok: false, error: error?.message || String(error) };
  }
}

export async function handleVodUnmuteClearRules(_message, sender) {
  const tabId = sender?.tab?.id;
  if (tabId) {
    await clearVodRulesForTab(tabId);
  }
  return { ok: true };
}

// Nettoyage automatique à la fermeture d'un onglet
if (chrome.tabs?.onRemoved) {
  chrome.tabs.onRemoved.addListener((closedTabId) => {
    clearVodRulesForTab(closedTabId).catch(() => {});
  });
}
