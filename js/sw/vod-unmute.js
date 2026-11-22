// StreamPulse+ : Démutage automatique des VODs Twitch coupées par le copyright.
// Gère l'installation et la suppression des règles déclaratives de redirection
// par onglet (chrome.declarativeNetRequest.updateSessionRules) de manière compacte
// et résiliente multi-résolution.

let updateQueue = Promise.resolve();
let nextRuleId = 1;
const MAX_RULE_ID = 2147480000;
const CHUNK_SIZE = 15;
const tabRulesMap = new Map(); // tabId -> Set<ruleId>

function enqueueUpdate(task) {
  const next = updateQueue.then(task, task);
  updateQueue = next;
  return next;
}

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

function extractSegmentId(url) {
  if (!url || typeof url !== "string") return null;
  const match = /\/([^/?#]+)-(?:muted|unmuted)(?=\.[^.]*(?:\?|$))/.exec(url);
  return match ? match[1] : null;
}

export async function clearVodRulesForTab(tabId) {
  return enqueueUpdate(async () => {
    if (!chrome.declarativeNetRequest?.updateSessionRules || !tabId) return;

    try {
      const tabRuleSet = tabRulesMap.get(tabId);
      const toRemove = tabRuleSet ? Array.from(tabRuleSet) : [];
      tabRulesMap.delete(tabId);

      const liveRules = await chrome.declarativeNetRequest.getSessionRules();
      for (const r of liveRules) {
        if (r.condition?.tabIds?.includes(tabId)) {
          toRemove.push(r.id);
        }
      }

      const uniqueRemove = Array.from(new Set(toRemove));
      if (uniqueRemove.length > 0) {
        await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: uniqueRemove });
      }
    } catch (error) {
      console.warn("[StreamPulse] Erreur lors du nettoyage des règles VOD :", error?.message || error);
    }
  });
}

export async function pruneOrphanVodRules() {
  return enqueueUpdate(async () => {
    if (!chrome.declarativeNetRequest?.getSessionRules || !chrome.tabs?.get) return;
    try {
      const toRemove = [];
      for (const [tabId, ruleSet] of tabRulesMap.entries()) {
        try {
          await chrome.tabs.get(tabId);
        } catch (_e) {
          toRemove.push(...ruleSet);
          tabRulesMap.delete(tabId);
        }
      }

      const liveRules = await chrome.declarativeNetRequest.getSessionRules();
      for (const rule of liveRules) {
        const tabIds = rule.condition?.tabIds;
        if (Array.isArray(tabIds) && tabIds.length === 1) {
          const tid = tabIds[0];
          try {
            await chrome.tabs.get(tid);
          } catch (_e) {
            toRemove.push(rule.id);
          }
        }
      }

      const uniqueRemove = Array.from(new Set(toRemove));
      if (uniqueRemove.length > 0) {
        await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: uniqueRemove });
      }
    } catch (_err) {
      // Nettoyage orphelin silencieux
    }
  });
}

export async function handleVodUnmuteInstallRules(message, sender) {
  return enqueueUpdate(async () => {
    const tabId = sender?.tab?.id;
    if (!tabId) {
      return { ok: false, error: "Identifiant d'onglet manquant" };
    }

    if (!chrome.declarativeNetRequest?.updateSessionRules) {
      return { ok: false, error: "declarativeNetRequest indisponible" };
    }

    try {
      const liveRules = await chrome.declarativeNetRequest.getSessionRules();
      const usedIds = new Set(liveRules.map((r) => r.id));
      const staleIds = [];

      let tabRuleSet = tabRulesMap.get(tabId);
      if (!tabRuleSet) {
        tabRuleSet = new Set();
        tabRulesMap.set(tabId, tabRuleSet);
      }

      // Si append !== true, on purge les règles existantes de cet onglet
      if (!message?.append) {
        for (const id of tabRuleSet) {
          staleIds.push(id);
        }
        tabRuleSet.clear();
        for (const rule of liveRules) {
          if (rule.condition?.tabIds?.includes(tabId)) {
            staleIds.push(rule.id);
          }
        }
      }

      // Extraction et déduplication des identifiants de segments
      let segmentIds = [];
      if (Array.isArray(message?.segmentIds) && message.segmentIds.length > 0) {
        segmentIds = message.segmentIds;
      } else if (Array.isArray(message?.redirects)) {
        segmentIds = message.redirects
          .map((r) => extractSegmentId(r?.sourceUrl || r))
          .filter(Boolean);
      }

      const addRules = [];

      if (segmentIds.length > 0) {
        const uniqueIds = Array.from(new Set(segmentIds.map(String)));
        const qualityPrefix = message?.quality
          ? `${message.quality.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/`
          : "";
        for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
          const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
          const pattern = chunk
            .map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("|");
          const ruleId = allocateRuleId(usedIds);
          tabRuleSet.add(ruleId);

          addRules.push({
            id: ruleId,
            priority: 1,
            action: {
              type: "redirect",
              redirect: { regexSubstitution: "\\1\\2\\3" },
            },
            condition: {
              regexFilter: `^(https://[a-zA-Z0-9.-]+(?:\\.cloudfront\\.net|\\.ttvnw\\.net)/.+/${qualityPrefix})(${pattern})-(?:muted|unmuted)(\\.ts(?:\\?.*)?)$`,
              resourceTypes: ["xmlhttprequest", "media", "other"],
            },
          });
        }
      }

      // Fallback pour toute redirection spécifique qui ne correspondrait pas au schéma de segment ts standard
      if (Array.isArray(message?.redirects)) {
        for (const item of message.redirects) {
          if (!item?.sourceUrl || !item?.targetUrl) continue;
          if (extractSegmentId(item.sourceUrl)) continue; // Déjà pris en compte par regex
          const cleanSource = item.sourceUrl.split("?")[0];
          const ruleId = allocateRuleId(usedIds);
          tabRuleSet.add(ruleId);

          addRules.push({
            id: ruleId,
            priority: 1,
            action: {
              type: "redirect",
              redirect: { url: item.targetUrl },
            },
            condition: {
              urlFilter: `|${cleanSource}`,
              resourceTypes: ["xmlhttprequest", "media", "other"],
            },
          });
        }
      }

      if (addRules.length > 0) {
        const corsRuleId = allocateRuleId(usedIds);
        tabRuleSet.add(corsRuleId);
        addRules.push({
          id: corsRuleId,
          priority: 2,
          action: {
            type: "modifyHeaders",
            requestHeaders: [
              { header: "Origin", operation: "remove" },
            ],
            responseHeaders: [
              { header: "Access-Control-Allow-Origin", operation: "set", value: "https://www.twitch.tv" },
              { header: "Access-Control-Allow-Credentials", operation: "set", value: "true" },
            ],
          },
          condition: {
            urlFilter: "||cloudfront.net/*.ts*",
            resourceTypes: ["xmlhttprequest", "media", "other"],
          },
        });
      }

      if (staleIds.length > 0 || addRules.length > 0) {
        try {
          await chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: staleIds,
            addRules,
          });
        } catch (_corsErr) {
          const fallbackRules = addRules.map((r) => {
            if (r.action?.type === "modifyHeaders" && r.action.responseHeaders) {
              return {
                ...r,
                action: {
                  type: "modifyHeaders",
                  requestHeaders: r.action.requestHeaders,
                },
              };
            }
            return r;
          });
          await chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: staleIds,
            addRules: fallbackRules,
          });
        }
      }

      return { ok: true, count: addRules.length };
    } catch (error) {
      console.warn("[StreamPulse] Échec de l'installation des règles VOD Unmute :", error?.message || error);
      return { ok: false, error: error?.message || String(error) };
    }
  });
}

export async function handleVodUnmuteClearRules(_message, sender) {
  const tabId = sender?.tab?.id;
  if (tabId) {
    await clearVodRulesForTab(tabId);
  }
  return { ok: true };
}

// Nettoyage automatique au démarrage et à la fermeture d'onglet
if (chrome.tabs?.onRemoved) {
  chrome.tabs.onRemoved.addListener((closedTabId) => {
    clearVodRulesForTab(closedTabId).catch(() => {});
  });
}

pruneOrphanVodRules().catch(() => {});
