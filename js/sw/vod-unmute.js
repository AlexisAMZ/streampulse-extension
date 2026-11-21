// StreamPulse+ : Résolution locale autonome et gestion des règles declarativeNetRequest pour la lecture vidéo.

const TWITCH_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const MUTED_MARKER = /-(?:muted|unmuted)(?=\.[^.]*(?:\?|$))/;

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
            priority: 2,
            action: {
              type: "redirect",
              redirect: { regexSubstitution: isUnmutedTarget ? "\\1\\2-unmuted\\3" : "\\1\\2\\3" },
            },
            condition: {
              regexFilter: `^(https://[a-zA-Z0-9.-]+(?:\\.cloudfront\\.net|\\.ttvnw\\.net|\\.twitch\\.tv)/.+/)(${pattern})-(?:muted|unmuted)(\\.(?:ts|mp4|m4s)(?:\\?.*)?)$`,
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
            priority: 2,
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

      // Règle modifyHeaders pour lever le blocage CORS Amazon S3 sur les segments réorientés.
      // S3 rejette (403 AccessDenied) tout appel portant l'en-tête Origin vers les segments audio bruts.
      // On retire Origin en sortie vers S3 et on injecte Access-Control-Allow-Origin pour le lecteur Twitch.
      if (addRules.length > 0) {
        const corsRuleId = allocateRuleId(usedIds);
        addRules.push({
          id: corsRuleId,
          priority: 1,
          action: {
            type: "modifyHeaders",
            requestHeaders: [
              { header: "Origin", operation: "remove" },
            ],
            responseHeaders: [
              { header: "Access-Control-Allow-Origin", operation: "set", value: "https://www.twitch.tv" },
              { header: "Access-Control-Allow-Credentials", operation: "set", value: "true" },
              { header: "Access-Control-Allow-Methods", operation: "set", value: "GET, HEAD, OPTIONS" },
              { header: "Access-Control-Expose-Headers", operation: "set", value: "Accept-Ranges, Content-Length, Content-Range, Date, Server" },
            ],
          },
          condition: {
            regexFilter: "^https://[a-zA-Z0-9.-]+(?:\\.cloudfront\\.net|\\.ttvnw\\.net|\\.twitch\\.tv)/.+/[^/?#]+(?:-(?:muted|unmuted))?\\.(?:ts|mp4|m4s)(?:\\?.*)?$",
            tabIds: [tabId],
            resourceTypes: ["xmlhttprequest", "media", "other"],
          },
        });
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

function extractFirstMediaPlaylist(masterText, baseUrl) {
  const lines = masterText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("#EXT-X-STREAM-INF") && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      if (nextLine && !nextLine.startsWith("#")) {
        try {
          return new URL(nextLine, baseUrl).href;
        } catch (_e) {
          return nextLine;
        }
      }
    }
  }
  return null;
}

function parseM3u8(text, playlistUrl) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  let currentTime = 0;
  let pendingDuration = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF:")) {
      const d = Number.parseFloat(line.slice(8).split(",")[0]);
      pendingDuration = Number.isFinite(d) && d >= 0 ? d : 10;
      continue;
    }
    if (line.startsWith("#")) continue;
    if (pendingDuration === null) continue;

    let absoluteUrl = line;
    try {
      absoluteUrl = new URL(line, playlistUrl).href;
    } catch (_e) {
      // url relative
    }

    entries.push({
      url: absoluteUrl,
      startTime: currentTime,
      duration: pendingDuration,
      isMuted: MUTED_MARKER.test(line),
    });

    currentTime += pendingDuration;
    pendingDuration = null;
  }
  return { entries, totalDuration: currentTime };
}

async function probeSegment(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Range: "bytes=0-100",
      },
    });
    clearTimeout(timeoutId);
    return res.status === 200 || res.status === 206;
  } catch (_e) {
    return false;
  }
}

export function handleVodUnmuteResolve(message, sender, sendResponse) {
  const runner = async () => {
    const vodId = message?.vodId;
    if (!vodId || !/^\d+$/.test(String(vodId))) {
      return { ok: false, error: "invalid_vod_id" };
    }

    const cacheKey = String(vodId);
    const cached = _resolvedVodCache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
      // 1. Découverte de la playlist M3U8 via l'API GraphQL Twitch publique
      const gqlRes = await fetch("https://gql.twitch.tv/gql", {
        method: "POST",
        headers: {
          "Client-ID": TWITCH_CLIENT_ID,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            operationName: "VideoPlayer_SeekPreviews",
            query: "query VideoPlayer_SeekPreviews($videoID: ID!) { video(id: $videoID) { id seekPreviewsURL } }",
            variables: { videoID: String(vodId) },
          },
        ]),
      });

      if (!gqlRes.ok) return { ok: false, error: `gql_${gqlRes.status}` };
      const gqlData = await gqlRes.json();
      const seekPreviewsURL = gqlData?.[0]?.data?.video?.seekPreviewsURL;
      if (!seekPreviewsURL || !seekPreviewsURL.includes("/storyboards/")) {
        return { ok: false, error: "no_storyboard_url" };
      }

      const playlistUrl = seekPreviewsURL.replace(/storyboards\/.*$/, "chunked/index-dvr.m3u8");

      // 2. Téléchargement et analyse du manifest HLS M3U8 en local
      let targetPlaylist = playlistUrl;
      const m3u8Res = await fetch(targetPlaylist);
      if (!m3u8Res.ok) return { ok: false, error: `m3u8_${m3u8Res.status}` };
      let text = await m3u8Res.text();

      if (!text.includes("#EXTINF:") && text.includes("#EXT-X-STREAM-INF")) {
        const variantUrl = extractFirstMediaPlaylist(text, targetPlaylist);
        if (variantUrl) {
          targetPlaylist = variantUrl;
          const vRes = await fetch(targetPlaylist);
          if (vRes.ok) text = await vRes.text();
        }
      }

      const parsed = parseM3u8(text, targetPlaylist);
      if (!parsed || parsed.entries.length === 0) {
        return { ok: false, error: "empty_playlist" };
      }

      const mutedEntries = parsed.entries.filter((e) => e.isMuted);
      if (mutedEntries.length === 0) {
        const noMuteData = {
          ok: true,
          isPlus: true,
          vodId,
          totalDuration: parsed.totalDuration,
          mutedDetected: false,
          purgedByTwitch: false,
          restoredRanges: [],
          purgedRanges: [],
        };
        _resolvedVodCache.set(cacheKey, { data: noMuteData, expiresAt: Date.now() + RESOLVED_VOD_CACHE_TTL_MS });
        return noMuteData;
      }

      // 3. Regroupement par blocs contigus de segments mutés
      const blocks = [];
      let curBlock = [];
      for (const entry of mutedEntries) {
        if (curBlock.length === 0) {
          curBlock.push(entry);
        } else {
          const prev = curBlock[curBlock.length - 1];
          if (Math.abs(prev.startTime + prev.duration - entry.startTime) < 0.5) {
            curBlock.push(entry);
          } else {
            blocks.push(curBlock);
            curBlock = [entry];
          }
        }
      }
      if (curBlock.length > 0) blocks.push(curBlock);

      // 4. Sondage simultané de chaque bloc contigu pour isoler les portions restaurables
      const restoredRanges = [];
      const purgedRanges = [];

      await Promise.all(
        blocks.map(async (block) => {
          const head = block[0];
          const bareUrl = head.url.replace(MUTED_MARKER, "");
          const unmutedUrl = head.url.replace(MUTED_MARKER, "-unmuted");

          let confirmedType = null;
          if (await probeSegment(bareUrl)) {
            confirmedType = "bare";
          } else if (await probeSegment(unmutedUrl)) {
            confirmedType = "unmuted";
          }

          if (confirmedType) {
            for (const item of block) {
              restoredRanges.push({
                segmentId: extractSegmentId(item.url),
                sourceUrl: item.url,
                targetUrl: item.url.replace(MUTED_MARKER, confirmedType === "bare" ? "" : "-unmuted"),
                targetType: confirmedType,
                startTime: item.startTime,
                duration: item.duration,
              });
            }
          } else {
            for (const item of block) {
              purgedRanges.push({
                startTime: item.startTime,
                duration: item.duration,
              });
            }
          }
        })
      );

      const resultData = {
        ok: true,
        isPlus: true,
        vodId,
        totalDuration: parsed.totalDuration,
        mutedDetected: true,
        purgedByTwitch: mutedEntries.length > 0 && restoredRanges.length === 0,
        restoredRanges,
        purgedRanges,
      };

      _resolvedVodCache.set(cacheKey, {
        data: resultData,
        expiresAt: Date.now() + RESOLVED_VOD_CACHE_TTL_MS,
      });

      return resultData;
    } catch (error) {
      console.warn("[StreamPulse] Erreur résolution VOD locale :", error?.message || error);
      return { ok: false, error: error?.message || "local_error" };
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
