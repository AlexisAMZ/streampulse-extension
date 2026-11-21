// StreamPulse+ : Gestion des règles de redirection declarativeNetRequest pour la lecture vidéo.

const REMOTE_UNMUTE_URL = "https://streampulse.tech/api/vod-unmute";

let updateQueue = Promise.resolve();
let nextRuleId = 1;
const MAX_RULE_ID = 2147480000;
const CHUNK_SIZE = 40;

const _resolvedVodCache = new Map();
const RESOLVED_VOD_CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure de cache mémoire pour VOD résolue

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
      const liveRules = await chrome.declarativeNetRequest.getSessionRules();
      const toRemove = liveRules
        .filter((r) => r.condition?.tabIds?.includes(tabId))
        .map((r) => r.id);

      if (toRemove.length > 0) {
        await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: toRemove });
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
      const liveRules = await chrome.declarativeNetRequest.getSessionRules();
      const toRemove = [];
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
      if (toRemove.length > 0) {
        await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: toRemove });
      }
    } catch (_err) {
      // Nettoyage orphelin silencieux
    }
  });
}

export function handleVodUnmuteInstallRules(message, sender, sendResponse) {
  const runner = () => enqueueUpdate(async () => {
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

      // Si append !== true, on purge les règles existantes de cet onglet
      if (!message?.append) {
        for (const rule of liveRules) {
          if (rule.condition?.tabIds?.includes(tabId)) {
            staleIds.push(rule.id);
          }
        }
      }

      // Séparation des identifiants selon le mode de redirection (standard sans suffixe ou -unmuted)
      const bareIds = new Set();
      const unmutedIds = new Set();

      if (Array.isArray(message?.redirects)) {
        for (const item of message.redirects) {
          const segId = item?.segmentId || extractSegmentId(item?.sourceUrl || item);
          if (!segId) continue;
          const targetUrl = item?.targetUrl || "";
          if (item?.targetType === "unmuted" || targetUrl.includes("-unmuted")) {
            unmutedIds.add(String(segId));
          } else {
            bareIds.add(String(segId));
          }
        }
      }

      if (Array.isArray(message?.segmentIds)) {
        for (const id of message.segmentIds) {
          const sId = String(id);
          if (!unmutedIds.has(sId)) {
            bareIds.add(sId);
          }
        }
      }

      const addRules = [];

      const installChunkedGroup = (idList, isUnmutedTarget) => {
        const uniqueIds = Array.from(new Set(idList));
        for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
          const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
          const pattern = chunk
            .map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("|");
          const ruleId = allocateRuleId(usedIds);

          addRules.push({
            id: ruleId,
            priority: 1,
            action: {
              type: "redirect",
              redirect: { regexSubstitution: isUnmutedTarget ? "\\1\\2-unmuted\\3" : "\\1\\2\\3" },
            },
            condition: {
              regexFilter: `^(https://[a-zA-Z0-9.-]+(?:\\.cloudfront\\.net|\\.ttvnw\\.net)/.+/)(${pattern})-(?:muted|unmuted)(\\.(?:ts|mp4|m4s)(?:\\?.*)?)$`,
              tabIds: [tabId],
              resourceTypes: ["xmlhttprequest", "media", "other"],
            },
          });
        }
      };

      if (bareIds.size > 0) {
        installChunkedGroup(bareIds, false);
      }
      if (unmutedIds.size > 0) {
        installChunkedGroup(unmutedIds, true);
      }

      // Fallback pour toute redirection spécifique qui ne correspondrait pas au schéma de segment ts standard
      if (Array.isArray(message?.redirects)) {
        for (const item of message.redirects) {
          if (!item?.sourceUrl || !item?.targetUrl) continue;
          if (extractSegmentId(item.sourceUrl)) continue; // Déjà pris en compte par regex
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
        }
      }

      if (staleIds.length > 0 || addRules.length > 0) {
        await chrome.declarativeNetRequest.updateSessionRules({
          removeRuleIds: staleIds,
          addRules,
        });
      }

      return { ok: true, count: addRules.length };
    } catch (error) {
      console.warn("[StreamPulse] Échec de l'installation des règles VOD Unmute :", error?.message || error);
      return { ok: false, error: error?.message || String(error) };
    }
  });

  if (typeof sendResponse === "function") {
    runner()
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
    return true;
  }
  return runner();
}

export function handleVodUnmuteClearRules(_message, sender, sendResponse) {
  const runner = async () => {
    const tabId = sender?.tab?.id;
    if (tabId) {
      await clearVodRulesForTab(tabId);
    }
    return { ok: true };
  };

  if (typeof sendResponse === "function") {
    runner()
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
    return true;
  }
  return runner();
}

export function handleVodUnmuteResolve(message, sender, sendResponse) {
  const runner = async () => {
    const vodId = message?.vodId;
    if (!vodId || !/^\d+$/.test(String(vodId))) {
      return { ok: false, error: "invalid_vod_id" };
    }

    const cacheKey = String(vodId);
    const cached = _resolvedVodCache.get(cacheKey);

    let license = null;
    if (chrome.storage?.local) {
      try {
        const stored = await chrome.storage.local.get("streamPulsePlus");
        const record = stored?.streamPulsePlus;
        if (record && record.licenseKey && record.sig) {
          license = {
            key: record.licenseKey,
            device: record.device,
            plan: record.plan,
            role: record.role,
            since: record.since,
            referrals: record.referrals,
            iat: record.iat,
            sig: record.sig,
            twitch: record.twitchAccount,
          };
        }
      } catch (_e) {
        // Fallback sans licence
      }
    }

    if (cached && Date.now() < cached.expiresAt) {
      // Si le cache a été résolu avec un niveau Plus identique ou supérieur, renvoi immédiat
      if (!license || Boolean(cached.data?.isPlus)) {
        return cached.data;
      }
    }

    try {
      const res = await fetch(REMOTE_UNMUTE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ vodId, license }),
      });

      if (!res.ok) return { ok: false, error: `http_${res.status}` };
      const data = await res.json();

      if (data?.ok) {
        _resolvedVodCache.set(cacheKey, {
          data,
          expiresAt: Date.now() + RESOLVED_VOD_CACHE_TTL_MS,
        });
      }

      return data;
    } catch (error) {
      console.warn("[StreamPulse] Erreur résolution VOD distante :", error?.message || error);
      return { ok: false, error: error?.message || "network_error" };
    }
  };

  if (typeof sendResponse === "function") {
    runner()
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
    return true;
  }
  return runner();
}

// Nettoyage automatique au démarrage et à la fermeture d'onglet
if (chrome.tabs?.onRemoved) {
  chrome.tabs.onRemoved.addListener((closedTabId) => {
    clearVodRulesForTab(closedTabId).catch(() => {});
  });
}

pruneOrphanVodRules().catch(() => {});
