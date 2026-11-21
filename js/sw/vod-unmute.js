// StreamPulse+ : Résolution locale autonome et gestion des règles declarativeNetRequest pour la lecture vidéo.

const TWITCH_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const MUTED_MARKER = /-(?:muted|unmuted)(?=\.[^.]*(?:\?|$))/;

let updateQueue = Promise.resolve();
let nextRuleId = 1;
const MAX_RULE_ID = 2147480000;
const CHUNK_SIZE = 40;
const _activeVodRuleIds = new Set();

const _resolvedVodCache = new Map();
const RESOLVED_VOD_CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure de cache memoire pour VOD resolue

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

export async function clearVodRulesForTab(_tabId) {
  return enqueueUpdate(async () => {
    if (!chrome.declarativeNetRequest?.updateSessionRules) return;

    try {
      const liveRules = await chrome.declarativeNetRequest.getSessionRules();
      const toRemove = [];
      for (const r of liveRules) {
        if (_activeVodRuleIds.has(r.id)) {
          toRemove.push(r.id);
        }
      }

      if (toRemove.length > 0) {
        await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: toRemove });
        for (const id of toRemove) _activeVodRuleIds.delete(id);
      }
    } catch (error) {
      console.warn("[StreamPulse] Erreur lors du nettoyage des regles VOD :", error?.message || error);
    }
  });
}

export async function pruneOrphanVodRules() {
  return enqueueUpdate(async () => {
    if (!chrome.declarativeNetRequest?.getSessionRules) return;
    try {
      const liveRules = await chrome.declarativeNetRequest.getSessionRules();
      const toRemove = [];
      for (const rule of liveRules) {
        // Purge des regles orphelines VOD
        if (_activeVodRuleIds.has(rule.id) || (rule.condition?.tabIds && rule.condition.tabIds.includes(9999))) {
          toRemove.push(rule.id);
        }
      }
      if (toRemove.length > 0) {
        await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: toRemove });
        for (const id of toRemove) _activeVodRuleIds.delete(id);
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

      // Si append !== true, on purge les regles VOD existantes
      if (!message?.append) {
        for (const id of _activeVodRuleIds) {
          staleIds.push(id);
        }
        for (const rule of liveRules) {
          if (_activeVodRuleIds.has(rule.id) || (tabId && rule.condition?.tabIds?.includes(tabId))) {
            staleIds.push(rule.id);
          }
        }
      }

      const addRules = [];

      // Traitement des redirections :
      // 1. Si redirects est fourni (cas standard du lecteur VOD) : regles directes urlFilter
      //    (zero compilation DFA re2, zero limite 2KB, execution en O(1)).
      // 2. Si segmentIds seul est fourni (repli minimal/tests) : regex par chunks de 15 sans backtracking glouton.
      if (Array.isArray(message?.redirects) && message.redirects.length > 0) {
        const seenSegIds = new Set();
        for (const item of message.redirects) {
          const segId = item?.segmentId || extractSegmentId(item?.sourceUrl || item?.targetUrl || item);
          if (!segId || !item?.targetUrl) continue;
          if (seenSegIds.has(segId)) continue;
          seenSegIds.add(segId);

          let domain = "cloudfront.net";
          try {
            domain = new URL(item.targetUrl).host;
          } catch (_e) {
            // Repli sur le domaine CloudFront standard
          }

          addRules.push({
            id: allocateRuleId(usedIds),
            priority: 3,
            action: {
              type: "redirect",
              redirect: { url: item.targetUrl },
            },
            condition: {
              urlFilter: `||${domain}/*/${segId}-muted.*`,
              resourceTypes: ["xmlhttprequest", "media", "other"],
            },
          });

          addRules.push({
            id: allocateRuleId(usedIds),
            priority: 3,
            action: {
              type: "redirect",
              redirect: { url: item.targetUrl },
            },
            condition: {
              urlFilter: `||${domain}/*/${segId}-unmuted.*`,
              resourceTypes: ["xmlhttprequest", "media", "other"],
            },
          });
        }
      } else if (Array.isArray(message?.segmentIds) && message.segmentIds.length > 0) {
        const bareIds = new Set(message.segmentIds.map(String));
        const CHUNK_SIZE_SAFE = 15;
        const uniqueIds = Array.from(bareIds);
        for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE_SAFE) {
          const chunk = uniqueIds.slice(i, i + CHUNK_SIZE_SAFE);
          const pattern = chunk
            .map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("|");
          const ruleId = allocateRuleId(usedIds);

          addRules.push({
            id: ruleId,
            priority: 2,
            action: {
              type: "redirect",
              redirect: { regexSubstitution: "\\1\\2\\3" },
            },
            condition: {
              regexFilter: `^(https://[^/]+\\.(?:cloudfront\\.net|ttvnw\\.net|twitch\\.tv)/[^?#]+/)(${pattern})-(?:muted|unmuted)(\\.(?:ts|mp4|m4s)(?:\\?.*)?)$`,
              resourceTypes: ["xmlhttprequest", "media", "other"],
            },
          });
        }
      }

      // Fallback pour toute redirection specifique qui ne correspondrait pas au schema de segment standard
      if (Array.isArray(message?.redirects)) {
        for (const item of message.redirects) {
          if (!item?.sourceUrl || !item?.targetUrl) continue;
          if (extractSegmentId(item.sourceUrl)) continue;
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
              resourceTypes: ["xmlhttprequest", "media", "other"],
            },
          });
        }
      }

      // Regles modifyHeaders pour lever le blocage CORS Amazon S3 sur les segments audio bruts
      // Amazon S3 renvoie 403 AccessDenied si l'en-tete Origin est transmis sur les segments originaux.
      // On retire Origin vers CloudFront et on declare les en-tetes CORS pour autoriser la lecture dans le lecteur Twitch.
      // Utilisation stricte de urlFilter (zero compilation DFA re2, zero risque de depassement de la limite de 2KB).
      if (addRules.length > 0) {
        const corsDomains = ["cloudfront.net", "ttvnw.net", "twitch.tv"];
        const corsRules = corsDomains.map((domain) => ({
          id: allocateRuleId(usedIds),
          priority: 4,
          action: {
            type: "modifyHeaders",
            requestHeaders: [
              { header: "Origin", operation: "remove" },
              { header: "Accept-Encoding", operation: "set", value: "identity" },
            ],
            responseHeaders: [
              { header: "Access-Control-Allow-Origin", operation: "set", value: "https://www.twitch.tv" },
              { header: "Access-Control-Allow-Credentials", operation: "set", value: "true" },
              { header: "Access-Control-Allow-Methods", operation: "set", value: "GET, HEAD, OPTIONS" },
              { header: "Access-Control-Expose-Headers", operation: "set", value: "Accept-Ranges, Content-Length, Content-Range, Date, Server" },
            ],
          },
          condition: {
            urlFilter: `||${domain}/*`,
            resourceTypes: ["xmlhttprequest", "media", "other"],
          },
        }));

        const rememberAddedRules = (rules) => {
          for (const r of rules) _activeVodRuleIds.add(r.id);
        };

        try {
          await chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: staleIds,
            addRules: [...addRules, ...corsRules],
          });
          rememberAddedRules([...addRules, ...corsRules]);
          return { ok: true, count: addRules.length + corsRules.length };
        } catch (corsErr) {
          console.warn("[StreamPulse] updateSessionRules avec responseHeaders echoue, repli :", corsErr?.message || corsErr);
          const lightCorsRules = corsRules.map((r) => ({
            ...r,
            action: {
              type: "modifyHeaders",
              requestHeaders: [
                { header: "Origin", operation: "remove" },
                { header: "Accept-Encoding", operation: "set", value: "identity" },
              ],
            },
          }));
          try {
            await chrome.declarativeNetRequest.updateSessionRules({
              removeRuleIds: staleIds,
              addRules: [...addRules, ...lightCorsRules],
            });
            rememberAddedRules([...addRules, ...lightCorsRules]);
            return { ok: true, count: addRules.length + lightCorsRules.length };
          } catch (_lightErr) {
            await chrome.declarativeNetRequest.updateSessionRules({
              removeRuleIds: staleIds,
              addRules,
            });
            rememberAddedRules(addRules);
            return { ok: true, count: addRules.length };
          }
        }
      }

      if (staleIds.length > 0) {
        await chrome.declarativeNetRequest.updateSessionRules({
          removeRuleIds: staleIds,
        });
      }

      return { ok: true, count: 0 };
    } catch (error) {
      console.warn("[StreamPulse] Echec de l'installation des regles VOD Unmute :", error?.message || error);
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
      const ALTERNATE_QUALITIES = ["720p60", "480p30", "360p30", "160p30"];

      await Promise.all(
        blocks.map(async (block) => {
          const head = block[0];
          const bareUrl = head.url.replace(MUTED_MARKER, "");
          const unmutedUrl = head.url.replace(MUTED_MARKER, "-unmuted");

          let confirmedType = null;
          let confirmedTargetQuality = null;

          if (await probeSegment(bareUrl)) {
            confirmedType = "bare";
          } else if (await probeSegment(unmutedUrl)) {
            confirmedType = "unmuted";
          } else {
            // Repli multi-qualités : sondage dans les transcodages (ex: 720p60) si chunked a été altéré
            for (const altQ of ALTERNATE_QUALITIES) {
              const altBare = bareUrl.replace(/\/chunked\//, `/${altQ}/`);
              if (await probeSegment(altBare)) {
                confirmedType = "bare";
                confirmedTargetQuality = altQ;
                break;
              }
              const altUnmuted = unmutedUrl.replace(/\/chunked\//, `/${altQ}/`);
              if (await probeSegment(altUnmuted)) {
                confirmedType = "unmuted";
                confirmedTargetQuality = altQ;
                break;
              }
            }
          }

          if (confirmedType) {
            for (const item of block) {
              let targetUrl = item.url.replace(MUTED_MARKER, confirmedType === "bare" ? "" : "-unmuted");
              if (confirmedTargetQuality) {
                targetUrl = targetUrl.replace(/\/chunked\//, `/${confirmedTargetQuality}/`);
              }
              restoredRanges.push({
                segmentId: extractSegmentId(item.url),
                sourceUrl: item.url,
                targetUrl,
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
